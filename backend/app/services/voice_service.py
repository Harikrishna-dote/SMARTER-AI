"""Natural Telugu voice AI with multilingual conversation support.

Phase 2 enhancements:
- Robust Telugu/English/mixed-language detection
- Mixed-language TTS (Telugu + English segments synthesized with correct voices)
- Streaming TTS for low-latency lesson playback
- Audio caching for repeated educational phrases
- Voice session management for lesson pause/resume
- Model warmup and graceful fallback
- Faster Whisper STT with per-segment language tagging
"""
from __future__ import annotations

import asyncio
import hashlib
import io
import json
# ...

import logging
import os
import re
import time
import uuid
from pathlib import Path
from typing import Any, AsyncIterator, Protocol

import numpy as np
from fastapi import HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

from app.core.config import get_settings

try:
    import torch
except ImportError:  # pragma: no cover - optional GPU support
    torch = None

try:
    from faster_whisper import WhisperModel
except ImportError:  # pragma: no cover - optional STT runtime
    WhisperModel = None

try:
    from piper import PiperVoice
except ImportError:  # pragma: no cover - optional local TTS runtime
    PiperVoice = None

try:
    from parler_tts import ParlerTTSForConditionalGeneration
    from transformers import AutoTokenizer
except ImportError:
    ParlerTTSForConditionalGeneration = None
    AutoTokenizer = None

try:
    import soundfile as sf
except ImportError:  # pragma: no cover - optional audio file writer
    sf = None

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Language detection
# ---------------------------------------------------------------------------

TELUGU_UNICODE_RE = re.compile(r"[\u0C00-\u0C7F]")
HINDI_UNICODE_RE = re.compile(r"[\u0900-\u097F]")
LATIN_ALPHA_RE = re.compile(r"[A-Za-z]")


def detect_text_language(text: str) -> str:
    """Detect primary language of a text string.

    Backward-compatible heuristic: any Telugu character wins,
    otherwise fall back to Latin detection.
    """
    if TELUGU_UNICODE_RE.search(text):
        return "te"
    if any(char.isalpha() for char in text):
        return "en"
    return "en"


_detect_text_language = detect_text_language


def _normalize_language_code(language: str | None) -> str:
    if not language:
        return "en"
    language = language.lower().strip()
    if language.startswith("te"):
        return "te"
    if language.startswith("hi"):
        return "hi"
    if language in ("en", "english", "eng", "en-us", "en-in"):
        return "en"
    return "en"


def _requested_tts_language(language: str | None) -> str | None:
    """Return a forced TTS language, or None for automatic/mixed speech."""
    if not language:
        return None
    normalized = language.lower().strip()
    if normalized in {"auto", "bilingual", "mixed"}:
        return None
    return _normalize_language_code(normalized)


class LanguageDetector:
    """Robust language detection supporting Telugu, English, Hindi, and code-switching."""

    @staticmethod
    def detect(text: str) -> str:
        return detect_text_language(text)

    @staticmethod
    def detect_whisper(whisper_lang: str | None) -> str:
        if not whisper_lang:
            return "en"
        return _normalize_language_code(whisper_lang)

    @staticmethod
    def segment(text: str) -> list[tuple[str, str]]:
        """Split text into (segment_text, language) tuples for code-switched content."""
        segments: list[tuple[str, str]] = []
        current: list[str] = []
        current_lang: str | None = None

        for char in text:
            if TELUGU_UNICODE_RE.search(char):
                char_lang = "te"
            elif HINDI_UNICODE_RE.search(char):
                char_lang = "hi"
            elif LATIN_ALPHA_RE.search(char):
                char_lang = "en"
            else:
                char_lang = current_lang or "en"

            if current_lang is None:
                current_lang = char_lang
                current.append(char)
            elif char_lang == current_lang:
                current.append(char)
            else:
                segment_text = "".join(current).strip()
                if segment_text:
                    segments.append((segment_text, current_lang))
                current = [char]
                current_lang = char_lang

        segment_text = "".join(current).strip()
        if segment_text:
            segments.append((segment_text, current_lang or "en"))

        return segments if segments else [(text, detect_text_language(text))]


# ---------------------------------------------------------------------------
# Audio utilities
# ---------------------------------------------------------------------------


def _resolve_asset_path(path_value: str) -> Path:
    path = Path(path_value)
    if path.is_absolute() or path.exists():
        return path
    backend_root = Path(__file__).resolve().parents[2]
    return backend_root / path

def _resample_audio(data: np.ndarray, orig_sr: int, target_sr: int) -> np.ndarray:
    if orig_sr == target_sr or data.size == 0:
        return data
    ratio = target_sr / orig_sr
    new_length = max(1, int(len(data) * ratio))
    return np.interp(np.linspace(0, len(data) - 1, new_length), np.arange(len(data)), data)


def _write_wav(output_path: str, pcm_bytes: bytes, sample_rate: int, sample_channels: int, sample_width: int) -> None:
    import wave

    with wave.open(output_path, "wb") as wav_file:
        wav_file.setnchannels(sample_channels)
        wav_file.setsampwidth(sample_width)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_bytes)


def _apply_wav_speed(output_path: str, rate: float) -> None:
    """Adjust local WAV playback speed without changing the provider contract."""

    import wave

    rate = min(1.4, max(0.6, float(rate)))
    if abs(rate - 1.0) < 0.01:
        return
    try:
        with wave.open(output_path, "rb") as wav_file:
            channels = wav_file.getnchannels()
            sample_width = wav_file.getsampwidth()
            sample_rate = wav_file.getframerate()
            raw = wav_file.readframes(wav_file.getnframes())
    except (EOFError, wave.Error, OSError):
        # Injected providers may return non-WAV test bytes or another media type.
        return
    if sample_width != 2 or not raw:
        return

    samples = np.frombuffer(raw, dtype=np.int16)
    if channels > 1:
        samples = samples[: len(samples) - (len(samples) % channels)].reshape(-1, channels)
    else:
        samples = samples.reshape(-1, 1)
    if len(samples) < 2:
        return
    new_length = max(1, int(round(len(samples) / rate)))
    positions = np.linspace(0, len(samples) - 1, new_length)
    source_positions = np.arange(len(samples))
    adjusted = np.column_stack([
        np.interp(positions, source_positions, samples[:, channel]).round()
        for channel in range(samples.shape[1])
    ]).astype(np.int16)
    _write_wav(output_path, adjusted.tobytes(), sample_rate, channels, sample_width)


def _concat_wavs(wav_bytes_list: list[bytes], target_sr: int = 22050) -> bytes:
    if not wav_bytes_list:
        return b""
    if len(wav_bytes_list) == 1:
        return wav_bytes_list[0]

    arrays: list[np.ndarray] = []
    for wav_bytes in wav_bytes_list:
        if not wav_bytes:
            continue
        data, sr = sf.read(io.BytesIO(wav_bytes), dtype="float32", always_2d=False)
        if data.ndim > 1:
            data = data.mean(axis=1)
        data = _resample_audio(data, sr, target_sr)
        arrays.append(data)

    if not arrays:
        return b""
    concatenated = np.concatenate(arrays)
    buffer = io.BytesIO()
    sf.write(buffer, concatenated, target_sr, format="WAV", subtype="PCM_16")
    return buffer.getvalue()


# ---------------------------------------------------------------------------
# Model engines
# ---------------------------------------------------------------------------


class SpeechRecognitionProvider(Protocol):
    @property
    def available(self) -> bool: ...

    def warmup(self) -> bool: ...

    def transcribe(self, file_path: str) -> dict[str, Any]: ...

    def stream_transcribe(self, file_path: str) -> Any: ...


class TextToSpeechProvider(Protocol):
    @property
    def available(self) -> bool: ...

    def synthesize_segment(self, text: str, language: str, output_path: str) -> None: ...

    def synthesize_stream(self, text: str, language: str | None = None) -> Any: ...


class STTEngine:
    """Faster Whisper speech-to-text engine with Telugu and English support."""

    def __init__(self, model_name: str, device: str) -> None:
        self.model_name = model_name
        self.device = device
        self._model: Any = None
        self._warm = False

    @property
    def available(self) -> bool:
        return WhisperModel is not None

    def _resolve_device(self) -> str:
        if self.device and self.device.lower() != "auto":
            return self.device
        if torch is not None and torch.cuda.is_available():
            return "cuda"
        return "cpu"

    def warmup(self) -> bool:
        if self._warm:
            return True
        if not self.available:
            return False
        try:
            self._load_model()
            self._warm = True
            logger.info("Faster Whisper model '%s' warmed up on %s", self.model_name, self._resolve_device())
            return True
        except Exception as exc:
            logger.warning("Faster Whisper warmup failed: %s", exc)
            return False

    def _load_model(self) -> None:
        if not self.available:
            raise RuntimeError("Faster Whisper is not installed in this runtime.")
        if self._model is None:
            device = self._resolve_device()
            compute_type = "float16" if device == "cuda" else "int8"
            model_path = _resolve_asset_path(self.model_name)
            model_reference = str(model_path) if model_path.exists() else self.model_name
            self._model = WhisperModel(
                model_reference,
                device=device,
                compute_type=compute_type,
            )

    def transcribe(self, file_path: str) -> dict[str, Any]:
        self._load_model()
        segments, info = self._model.transcribe(
            file_path,
            task="transcribe",
            language=None,
            beam_size=3,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
        )
        segments_list = list(segments)
        transcript = " ".join(segment.text.strip() for segment in segments_list).strip()
        detected_lang = LanguageDetector.detect_whisper(getattr(info, "language", None))
        return {
            "text": transcript,
            "language": detected_lang,
            "segments": [
                {
                    "text": segment.text.strip(),
                    "start": getattr(segment, "start", None),
                    "end": getattr(segment, "end", None),
                    "language": detected_lang,
                }
                for segment in segments_list
            ],
        }

    def stream_transcribe(self, file_path: str) -> Any:
        self._load_model()
        segments, info = self._model.transcribe(
            file_path,
            task="transcribe",
            language=None,
            beam_size=3,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
        )
        segments_list = list(segments)
        detected_lang = LanguageDetector.detect_whisper(getattr(info, "language", None))
        for segment in segments_list:
            yield {
                "type": "segment",
                "language": detected_lang,
                "text": segment.text.strip(),
                "start": getattr(segment, "start", None),
                "end": getattr(segment, "end", None),
            }
        transcript = " ".join(segment.text.strip() for segment in segments_list).strip()
        yield {
            "type": "done",
            "language": detected_lang,
            "text": transcript,
        }


class TTSEngine:
    """Multilingual TTS engine with Piper (local) and Parler (Indic fallback)."""

    def __init__(self, settings: Any, cache: Any | None = None) -> None:
        self.settings = settings
        self.cache = cache
        self._piper_te = self._load_piper(settings.piper_model_path, settings.piper_config_path)
        self._piper_en = self._load_piper(settings.piper_model_path_en, settings.piper_config_path_en)
        self._parler_model = None
        self._parler_tokenizer = None
        self._parler_device = "cuda" if torch is not None and torch.cuda.is_available() else "cpu"

    @staticmethod
    def _resolve_asset_path(path_value: str) -> Path:
        return _resolve_asset_path(path_value)

    @classmethod
    def _load_piper(cls, model_path: str, config_path: str) -> Any | None:
        if PiperVoice is None:
            return None
        resolved_model_path = cls._resolve_asset_path(model_path)
        resolved_config_path = cls._resolve_asset_path(config_path)
        if not resolved_model_path.exists() or not resolved_config_path.exists():
            logger.warning("Piper model not found: %s / %s", resolved_model_path, resolved_config_path)
            return None
        try:
            return PiperVoice.load(str(resolved_model_path), config_path=str(resolved_config_path))
        except Exception as exc:
            logger.warning("Failed to load Piper model %s: %s", resolved_model_path, exc)
            return None

    @property
    def available(self) -> bool:
        return self._piper_te is not None or self._piper_en is not None or ParlerTTSForConditionalGeneration is not None

    def _load_parler(self) -> None:
        if self._parler_model is not None and self._parler_tokenizer is not None:
            return
        if ParlerTTSForConditionalGeneration is None or AutoTokenizer is None:
            raise RuntimeError("Parler TTS is not available in this runtime.")

        logger.info("Loading Parler TTS model: %s", self.settings.parler_tts_model)
        self._parler_model = ParlerTTSForConditionalGeneration.from_pretrained(self.settings.parler_tts_model)
        self._parler_tokenizer = AutoTokenizer.from_pretrained(self.settings.parler_tts_model)

    def _voice_description(self, language: str) -> str:
        if language == "te":
            return (
                "A friendly Telugu classroom teacher speaking naturally with warm pronunciation, "
                "clear pacing, and a calm educational tone."
            )
        if language == "hi":
            return (
                "A friendly Hindi classroom teacher speaking naturally with warm pronunciation, "
                "clear pacing, and a calm educational tone."
            )
        return (
            "A friendly English classroom teacher speaking naturally with warm pronunciation, "
            "clear pacing, and a calm educational tone."
        )

    def _synthesize_piper(self, text: str, output_path: str, voice: Any) -> None:
        chunks = list(voice.synthesize(text))
        if not chunks:
            raise RuntimeError("Piper returned no audio chunks.")
        sample_rate = chunks[0].sample_rate
        sample_channels = chunks[0].sample_channels
        sample_width = chunks[0].sample_width
        pcm = b"".join(chunk.audio_int16_bytes for chunk in chunks)
        _write_wav(output_path, pcm, sample_rate, sample_channels, sample_width)

    def _synthesize_parler(self, text: str, output_path: str, language: str) -> None:
        if sf is None:
            raise RuntimeError("soundfile package is required for Parler TTS output.")

        description = self._voice_description(language)
        description_inputs = self._parler_tokenizer(description, return_tensors="pt")
        prompt_inputs = self._parler_tokenizer(text, return_tensors="pt")

        description_inputs = {k: v.to(self._parler_device) for k, v in description_inputs.items()}
        prompt_inputs = {k: v.to(self._parler_device) for k, v in prompt_inputs.items()}

        audio = self._parler_model.generate(
            input_ids=description_inputs["input_ids"],
            attention_mask=description_inputs["attention_mask"],
            prompt_input_ids=prompt_inputs["input_ids"],
            prompt_attention_mask=prompt_inputs["attention_mask"],
        )
        audio_numpy = audio.cpu().numpy().squeeze()
        sf.write(output_path, audio_numpy, self._parler_model.config.sampling_rate)

    def _synthesize_segment(self, text: str, language: str, output_path: str) -> None:
        cache_key = f"tts:{hashlib.sha256(f'{language}:{text}'.encode()).hexdigest()}"
        if self.cache is not None:
            cached = self.cache.get(cache_key)
            if cached is not None:
                Path(output_path).write_bytes(cached)
                return

        if language == "te" and self._piper_te is not None:
            self._synthesize_piper(text, output_path, self._piper_te)
        elif language == "en" and self._piper_en is not None:
            self._synthesize_piper(text, output_path, self._piper_en)
        elif self._piper_te is not None:
            self._synthesize_piper(text, output_path, self._piper_te)
        elif self._piper_en is not None:
            self._synthesize_piper(text, output_path, self._piper_en)
        else:
            self._load_parler()
            self._synthesize_parler(text, output_path, language)

        if self.cache is not None:
            self.cache.set(cache_key, Path(output_path).read_bytes())

    def synthesize_segment(self, text: str, language: str, output_path: str) -> None:
        """Provider boundary for one language-tagged audio segment."""
        self._synthesize_segment(text, language, output_path)

    def synthesize(self, text: str, output_path: str, language: str | None = None) -> None:
        if not text.strip():
            raise ValueError("Text is required for speech synthesis.")

        segments = LanguageDetector.segment(text)
        forced_language = _requested_tts_language(language)

        if len(segments) == 1:
            segment_language = forced_language or segments[0][1]
            self._synthesize_segment(segments[0][0], segment_language, output_path)
            return

        wav_parts: list[bytes] = []
        temp_dir = Path(output_path).parent
        for idx, (seg_text, seg_lang) in enumerate(segments):
            seg_path = str(temp_dir / f"seg-{uuid.uuid4()}.wav")
            segment_language = forced_language or seg_lang
            self._synthesize_segment(seg_text, segment_language, seg_path)
            wav_parts.append(Path(seg_path).read_bytes())
            Path(seg_path).unlink(missing_ok=True)

        concatenated = _concat_wavs(wav_parts)
        Path(output_path).write_bytes(concatenated)

    def synthesize_stream(self, text: str, language: str | None = None) -> Any:
        if not text.strip():
            raise ValueError("Text is required for speech synthesis.")

        segments = LanguageDetector.segment(text)
        forced_language = _requested_tts_language(language)
        temp_dir = Path(self.settings.voice_temp_dir) / "stream"
        temp_dir.mkdir(parents=True, exist_ok=True)

        for idx, (seg_text, seg_lang) in enumerate(segments):
            seg_path = str(temp_dir / f"stream-{uuid.uuid4()}.wav")
            try:
                segment_language = forced_language or seg_lang
                self._synthesize_segment(seg_text, segment_language, seg_path)
                yield {
                    "type": "audio",
                    "index": idx,
                    "total": len(segments),
                    "language": segment_language,
                    "path": seg_path,
                }
            except Exception as exc:
                yield {"type": "error", "index": idx, "message": str(exc)}

        yield {"type": "done"}


# ---------------------------------------------------------------------------
# Caching
# ---------------------------------------------------------------------------


class InMemoryTTLCache:
    """Simple in-memory TTL cache with size limit."""

    def __init__(self, max_size: int = 256, ttl_seconds: int = 3600) -> None:
        self._store: dict[str, tuple[Any, float]] = {}
        self._max_size = max_size
        self._ttl = ttl_seconds

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expiry = entry
        if time.time() > expiry:
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any) -> None:
        if len(self._store) >= self._max_size:
            oldest = min(self._store.items(), key=lambda item: item[1][1])
            self._store.pop(oldest[0], None)
        self._store[key] = (value, time.time() + self._ttl)

    def clear(self) -> None:
        self._store.clear()


# ---------------------------------------------------------------------------
# Voice session (lesson pause/resume)
# ---------------------------------------------------------------------------


class VoiceSession:
    """Lightweight session state for classroom voice playback."""

    __slots__ = (
        "session_id",
        "conversation_id",
        "user_id",
        "language",
        "paused",
        "current_index",
        "segments",
        "created_at",
    )

    def __init__(self, session_id: str, conversation_id: str, user_id: str, language: str) -> None:
        self.session_id = session_id
        self.conversation_id = conversation_id
        self.user_id = user_id
        self.language = language
        self.paused = False
        self.current_index = 0
        self.segments: list[dict[str, Any]] = []
        self.created_at = time.time()

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "conversation_id": self.conversation_id,
            "user_id": self.user_id,
            "language": self.language,
            "paused": self.paused,
            "current_index": self.current_index,
            "segments": self.segments,
            "created_at": self.created_at,
        }


class VoiceSessionManager:
    """Manage active voice sessions for pause/resume in classroom mode."""

    def __init__(self) -> None:
        self._sessions: dict[str, VoiceSession] = {}

    def create(self, conversation_id: str, user_id: str, language: str) -> VoiceSession:
        session_id = str(uuid.uuid4())
        session = VoiceSession(session_id, conversation_id, user_id, language)
        self._sessions[session_id] = session
        return session

    def get(self, session_id: str) -> VoiceSession | None:
        return self._sessions.get(session_id)

    def pause(self, session_id: str) -> bool:
        session = self._sessions.get(session_id)
        if session is None:
            return False
        session.paused = True
        return True

    def resume(self, session_id: str) -> bool:
        session = self._sessions.get(session_id)
        if session is None:
            return False
        session.paused = False
        return True

    def remove(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)


# ---------------------------------------------------------------------------
# Main service
# ---------------------------------------------------------------------------


class VoiceService:
    """Natural multilingual voice AI orchestrator.

    Provides speech-to-text, text-to-speech, streaming synthesis,
    lesson synchronization, and automatic language detection.
    """

    def __init__(
        self,
        *,
        stt_provider: SpeechRecognitionProvider | None = None,
        tts_provider: TextToSpeechProvider | None = None,
    ) -> None:
        self.settings = get_settings()
        self.cache = InMemoryTTLCache(
            max_size=512,
            ttl_seconds=int(getattr(self.settings, "voice_tts_cache_ttl", 3600)),
        )
        self.sessions = VoiceSessionManager()
        self.stt: SpeechRecognitionProvider = stt_provider or STTEngine(
            self.settings.voice_stt_model_name,
            self.settings.voice_stt_device,
        )
        self.tts: TextToSpeechProvider = tts_provider or TTSEngine(self.settings, cache=self.cache)
        self.temp_dir = Path(self.settings.voice_temp_dir)
        _ensure_directory(self.temp_dir)

    # ------------------------------------------------------------------
    # STT
    # ------------------------------------------------------------------

    async def transcribe(self, file: UploadFile) -> dict[str, Any]:
        if not self.stt.available:
            return {
                "text": f"Received audio file {file.filename}. Local STT engine is not configured in this runtime.",
                "language": "unknown",
            }

        file_path = await self._save_upload(file)
        try:
            return self.stt.transcribe(file_path)
        finally:
            Path(file_path).unlink(missing_ok=True)

    async def stream_transcribe(self, file: UploadFile) -> Any:
        if not self.stt.available:
            yield {
                "type": "error",
                "message": "Local STT engine is not configured in this runtime.",
            }
            return

        file_path = await self._save_upload(file)
        try:
            for event in self.stt.stream_transcribe(file_path):
                yield event
        finally:
            Path(file_path).unlink(missing_ok=True)

    async def detect_language_from_audio(self, file: UploadFile) -> dict[str, Any]:
        result = await self.transcribe(file)
        return {
            "language": result.get("language", "unknown"),
            "text": result.get("text", ""),
            "confidence": 1.0 if result.get("language") != "unknown" else 0.0,
        }

    # ------------------------------------------------------------------
    # TTS
    # ------------------------------------------------------------------

    async def synthesize(self, text: str, language: str | None = None, rate: float = 1.0) -> str:
        if not text or not text.strip():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Text is required")

        output_file = str(self.temp_dir / f"{uuid.uuid4()}.wav")
        segments = LanguageDetector.segment(text)
        forced_language = _requested_tts_language(language)
        
        # Parallel synthesis using TaskGroup
        wav_parts: list[bytes] = [b""] * len(segments)
        
        async with asyncio.TaskGroup() as tg:
            for idx, (seg_text, seg_lang) in enumerate(segments):
                tg.create_task(self._synthesize_segment_async(seg_text, forced_language or seg_lang, idx, wav_parts, rate))
                
        concatenated = _concat_wavs(wav_parts)
        Path(output_file).write_bytes(concatenated)

        return output_file

    async def _synthesize_segment_async(self, text: str, language: str, idx: int, wav_parts: list[bytes], rate: float = 1.0) -> None:
        seg_path = self.temp_dir / f"seg-{uuid.uuid4()}.wav"
        # Since TTSEngine methods are blocking, run in executor
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self.tts.synthesize_segment, text, language, str(seg_path))
        _apply_wav_speed(str(seg_path), rate)
        wav_parts[idx] = seg_path.read_bytes()
        seg_path.unlink(missing_ok=True)

    async def synthesize_stream(self, text: str, language: str | None = None, rate: float = 1.0) -> AsyncIterator[dict[str, Any]]:
        if not text or not text.strip():
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Text is required")

        for event in self.tts.synthesize_stream(text, language):
            if event.get("type") == "audio":
                _apply_wav_speed(str(event["path"]), rate)
                yield {
                    "type": "audio",
                    "index": event["index"],
                    "total": event["total"],
                    "language": event["language"],
                    "data": event["path"],
                }
            else:
                yield event

    def stream_audio(self, file_path: str) -> StreamingResponse:
        def iter_file() -> Any:
            with open(file_path, "rb") as audio_file:
                while chunk := audio_file.read(8192):
                    yield chunk

        return StreamingResponse(
            iter_file(),
            media_type="audio/wav",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "Content-Encoding": "identity",
                "X-Accel-Buffering": "no",
            },
        )

    # ------------------------------------------------------------------
    # Lesson voice sync
    # ------------------------------------------------------------------

    def create_lesson_session(self, conversation_id: str, user_id: str, language: str, segments: list[str]) -> VoiceSession:
        session = self.sessions.create(conversation_id, user_id, language)
        session.segments = [{"text": seg, "language": detect_text_language(seg)} for seg in segments]
        return session

    def get_lesson_session(self, session_id: str) -> VoiceSession | None:
        return self.sessions.get(session_id)

    def pause_lesson(self, session_id: str) -> bool:
        return self.sessions.pause(session_id)

    def resume_lesson(self, session_id: str) -> bool:
        return self.sessions.resume(session_id)

    def end_lesson(self, session_id: str) -> None:
        self.sessions.remove(session_id)

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    async def transcribe_text_language(self, text: str) -> str:
        return detect_text_language(text)

    @staticmethod
    def detect_text_language(text: str) -> str:
        return detect_text_language(text)

    async def warmup(self) -> dict[str, bool]:
        stt_ready = self.stt.warmup()
        tts_ready = self.tts.available
        logger.info("Voice warmup complete: stt=%s tts=%s", stt_ready, tts_ready)
        return {"stt": stt_ready, "tts": tts_ready}

    async def _save_upload(self, file: UploadFile) -> str:
        file_name = file.filename or f"upload-{uuid.uuid4()}.wav"
        safe_name = Path(file_name).name
        file_path = self.temp_dir / f"{uuid.uuid4()}-{safe_name}"
        contents = await file.read()
        file_path.write_bytes(contents)
        return str(file_path)


def _ensure_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
