import base64
import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from app.application.orchestrator import AIOrchestrator
from app.core.deps import get_current_user, get_orchestrator
from app.models.user import User
from app.services.voice_service import VoiceService, detect_text_language

try:
    from parler_tts import ParlerTTSForConditionalGeneration
except ImportError:
    ParlerTTSForConditionalGeneration = None


router = APIRouter()


class SynthesisRequest(BaseModel):
    text: str = Field(min_length=1, max_length=5000)
    rate: float = Field(default=1.0, ge=0.6, le=1.4)


class LessonVoiceSyncRequest(BaseModel):
    conversation_id: str
    segments: list[str] = Field(default_factory=list, min_length=1)
    language: str = Field(default="en", min_length=1, max_length=12)


class LessonVoiceActionRequest(BaseModel):
    session_id: str


@router.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    return await orchestrator.voice_service.transcribe(file)


@router.post("/transcribe/stream")
async def stream_transcribe(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    service = orchestrator.voice_service

    async def event_stream():
        async for event in service.stream_transcribe(file):
            yield json.dumps(event, ensure_ascii=False) + "\n"

    return StreamingResponse(
        event_stream(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Content-Encoding": "identity",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/synthesize")
async def synthesize(
    payload: SynthesisRequest | None = Body(default=None),
    text: str | None = Query(default=None, min_length=1, max_length=5000),
    language: str | None = Query(default=None, min_length=2, max_length=12),
    rate: float = Query(default=1.0, ge=0.6, le=1.4),
    current_user: User = Depends(get_current_user),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    spoken_text = payload.text if payload else text
    if not spoken_text:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Text is required")

    requested_rate = payload.rate if payload else rate
    file_path = await orchestrator.voice_service.synthesize(spoken_text, language=language, rate=requested_rate)
    return FileResponse(file_path, media_type="audio/wav")


@router.post("/synthesize/stream")
async def stream_synthesize(
    payload: SynthesisRequest | None = Body(default=None),
    text: str | None = Query(default=None, min_length=1, max_length=5000),
    language: str | None = Query(default=None, min_length=2, max_length=12),
    rate: float = Query(default=1.0, ge=0.6, le=1.4),
    current_user: User = Depends(get_current_user),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    spoken_text = payload.text if payload else text
    if not spoken_text:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Text is required")

    async def event_stream():
        requested_rate = payload.rate if payload else rate
        async for event in orchestrator.voice_service.synthesize_stream(spoken_text, language=language, rate=requested_rate):
            if event.get("type") == "audio":
                path = Path(str(event.get("data", "")))
                try:
                    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
                    safe_event = {
                        "type": "audio",
                        "index": event.get("index", 0),
                        "total": event.get("total", 1),
                        "language": event.get("language", "en"),
                        "data": encoded,
                        "mime_type": "audio/wav",
                    }
                    yield json.dumps(safe_event, ensure_ascii=False) + "\n"
                finally:
                    path.unlink(missing_ok=True)
            else:
                yield json.dumps(event, ensure_ascii=False) + "\n"

    return StreamingResponse(
        event_stream(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Content-Encoding": "identity",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/detect-language")
async def detect_language(
    payload: SynthesisRequest,
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
        return {"language": detect_text_language(payload.text)}


@router.get("/status")
async def voice_status(
    current_user: User = Depends(get_current_user),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> dict[str, Any]:
    service = orchestrator.voice_service
    return {
        "stt_available": service.stt.available,
        "tts_available": service.tts.available,
        "piper_telugu": getattr(service.tts, "_piper_te", None) is not None,
        "piper_english": getattr(service.tts, "_piper_en", None) is not None,
        "parler_available": ParlerTTSForConditionalGeneration is not None,
        "supported_languages": getattr(service.settings, "voice_supported_languages", ["en", "te"]),
        "default_language": getattr(service.settings, "voice_default_language", "auto"),
    }


@router.post("/warmup")
async def warmup_voice(
    current_user: User = Depends(get_current_user),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> dict[str, bool]:
    return await orchestrator.voice_service.warmup()


@router.post("/lesson/sync")
async def create_lesson_voice_session(
    payload: LessonVoiceSyncRequest,
    current_user: User = Depends(get_current_user),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> dict[str, Any]:
    session = orchestrator.voice_service.create_lesson_session(
        conversation_id=payload.conversation_id,
        user_id=current_user.id,
        language=payload.language,
        segments=payload.segments,
    )
    return session.to_dict()


@router.post("/lesson/pause")
async def pause_lesson_voice(
    payload: LessonVoiceActionRequest,
    current_user: User = Depends(get_current_user),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> dict[str, bool]:
    return {"paused": orchestrator.voice_service.pause_lesson(payload.session_id)}


@router.post("/lesson/resume")
async def resume_lesson_voice(
    payload: LessonVoiceActionRequest,
    current_user: User = Depends(get_current_user),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> dict[str, bool]:
    return {"resumed": orchestrator.voice_service.resume_lesson(payload.session_id)}


@router.post("/lesson/end")
async def end_lesson_voice(
    payload: LessonVoiceActionRequest,
    current_user: User = Depends(get_current_user),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> dict[str, bool]:
    orchestrator.voice_service.end_lesson(payload.session_id)
    return {"ended": True}
