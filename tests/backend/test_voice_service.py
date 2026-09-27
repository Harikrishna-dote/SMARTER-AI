import os
import sys
import wave
from pathlib import Path

import pytest
from fastapi import HTTPException

ROOT = Path(__file__).parents[2]
sys.path.insert(0, str(ROOT / "backend"))
os.environ["AUTO_CREATE_TABLES"] = "false"

from app.services.voice_service import TTSEngine, VoiceService, _apply_wav_speed
from app.services.voice_service import LanguageDetector, _requested_tts_language
from app.api.voice.router import LessonVoiceSyncRequest


def test_mixed_telugu_english_voice_contract_uses_detected_segments():
    segments = LanguageDetector.segment("Force \u0c28\u0c3f Telugu \u0c32\u0c4b explain cheyyandi")

    assert any(language == "te" for _, language in segments)
    assert any(language == "en" for _, language in segments)
    assert _requested_tts_language("bilingual") is None
    assert LessonVoiceSyncRequest(conversation_id="c1", segments=["answer"], language="bilingual").language == "bilingual"


def test_piper_asset_paths_resolve_from_backend_root():
    resolved = TTSEngine._resolve_asset_path("models/te/te_IN/padmavathi/medium/te_IN-padmavathi-medium.onnx")

    assert resolved.is_absolute()
    assert resolved.exists()


def test_tts_rate_adjustment_changes_valid_wav_duration(tmp_path):
    path = tmp_path / "speech.wav"
    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(1000)
        wav_file.writeframes((b"\x00\x00" * 1000))

    _apply_wav_speed(str(path), 1.4)

    with wave.open(str(path), "rb") as wav_file:
        assert wav_file.getnframes() == 714


class FakeSpeechProvider:
    available = True

    def warmup(self):
        return True

    def transcribe(self, file_path):
        return {"text": "hello", "language": "en"}

    def stream_transcribe(self, file_path):
        yield {"type": "done", "text": "hello", "language": "en"}


class FakeTextProvider:
    available = True

    def synthesize_segment(self, text, language, output_path):
        Path(output_path).write_bytes(b"RIFF")

    def synthesize_stream(self, text, language=None):
        yield {"type": "done"}


@pytest.mark.asyncio
async def test_voice_service_accepts_injected_provider_contracts(tmp_path):
    service = VoiceService(stt_provider=FakeSpeechProvider(), tts_provider=FakeTextProvider())
    service.temp_dir = tmp_path

    file_path = await service.synthesize("hello", language="en")

    assert Path(file_path).read_bytes() == b"RIFF"
    assert service.stt.available is True
    assert service.tts.available is True


def test_detect_text_language():
    assert VoiceService.detect_text_language("Hello world") == "en"
    assert VoiceService.detect_text_language("నమస్కారం") == "te"
    assert VoiceService.detect_text_language("Welcome to తెలుగు lessons") == "te"


@pytest.mark.asyncio
async def test_transcribe_placeholder_when_stt_unavailable(monkeypatch):
    service = VoiceService()
    monkeypatch.setattr(type(service.stt), "available", False)

    class DummyUpload:
        filename = "voice.wav"

        async def read(self):
            return b""

    result = await service.transcribe(DummyUpload())
    assert result["language"] == "unknown"
    assert "Local STT engine" in result["text"]


@pytest.mark.asyncio
async def test_synthesize_uses_detected_language(monkeypatch, tmp_path):
    service = VoiceService()
    service.temp_dir = tmp_path
    expected_language = VoiceService.detect_text_language("Hello world")
    assert expected_language == "en"

    def fake_synthesize(text: str, output_path: str, language: str | None = None):
        assert language is None
        Path(output_path).write_bytes(b"RIFF")

    monkeypatch.setattr(service.tts, "synthesize", fake_synthesize)

    file_path = await service.synthesize("Hello world")
    assert Path(file_path).exists()
    assert Path(file_path).read_bytes().startswith(b"RIFF")


@pytest.mark.asyncio
async def test_synthesize_honors_requested_telugu_language(monkeypatch, tmp_path):
    service = VoiceService()
    service.temp_dir = tmp_path
    seen_languages: list[str] = []

    def fake_synthesize(_engine, text: str, language: str | None, output_path: str):
        seen_languages.append(language or "")
        Path(output_path).write_bytes(b"RIFF")

    monkeypatch.setattr(type(service.tts), "_synthesize_segment", fake_synthesize)

    file_path = await service.synthesize("Explain this in Telugu", language="te")

    assert seen_languages == ["te"]
    assert Path(file_path).read_bytes().startswith(b"RIFF")
