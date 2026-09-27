import os
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest


ROOT = Path(__file__).parents[2]
sys.path.insert(0, str(ROOT / "backend"))
os.environ["AUTO_CREATE_TABLES"] = "false"

import app.api.classroom.router as classroom_router
from app.application.orchestrator import AIOrchestrator
from app.schemas.classroom import (
    AutonomousSessionRequest,
    ChangeAutonomousTopicRequest,
    ClassroomConfig,
    ContinueAutonomousLessonRequest,
    GenerateLessonRequest,
)


class _CapturingClassroomService:
    seen_language: str | None = None
    seen_user_id: str | None = None
    seen_session_id: str | None = None
    seen_student_input: str | None = None
    seen_topic: str | None = None

    def __init__(self, db: object) -> None:
        self.db = db

    async def generate_lesson(self, config: ClassroomConfig, topic: str, user_id: str) -> dict:
        _CapturingClassroomService.seen_language = config.language
        _CapturingClassroomService.seen_user_id = user_id
        return {
            "title": topic,
            "subject": "General",
            "difficulty": config.level,
            "estimated_minutes": 5,
            "learning_objectives": [],
            "outline": [],
            "key_concepts": [],
            "completed_topics": [],
            "remaining_topics": [],
        }

    async def continue_lesson(self, session_id: str, user_id: str, student_input: str | None = None) -> dict:
        _CapturingClassroomService.seen_session_id = session_id
        _CapturingClassroomService.seen_user_id = user_id
        _CapturingClassroomService.seen_student_input = student_input
        return {"session_id": session_id, "type": "response"}

    async def pause_lesson(self, session_id: str, user_id: str) -> bool:
        _CapturingClassroomService.seen_session_id = session_id
        _CapturingClassroomService.seen_user_id = user_id
        return True

    async def resume_lesson(self, session_id: str, user_id: str) -> dict:
        _CapturingClassroomService.seen_session_id = session_id
        _CapturingClassroomService.seen_user_id = user_id
        return {"session_id": session_id, "type": "lesson_resumed"}

    async def change_topic(self, session_id: str, user_id: str, new_topic: str, config: ClassroomConfig) -> dict:
        _CapturingClassroomService.seen_session_id = session_id
        _CapturingClassroomService.seen_user_id = user_id
        _CapturingClassroomService.seen_topic = new_topic
        _CapturingClassroomService.seen_language = config.language
        return {"session_id": session_id, "type": "topic_changed", "new_topic": new_topic}


class _FakeOrchestrator:
    def __init__(self) -> None:
        self.classroom_service = _CapturingClassroomService(None)
        self.gateway = object()


def test_preparation_service_uses_shared_ai_gateway():
    orchestrator = _FakeOrchestrator()

    service = classroom_router._preparation_service(object(), orchestrator)

    assert service.gateway is orchestrator.gateway


@pytest.mark.asyncio
async def test_classroom_lesson_route_preserves_bilingual_language(monkeypatch):
    monkeypatch.setattr(classroom_router, "ClassroomService", _CapturingClassroomService)
    payload = GenerateLessonRequest(
        config=ClassroomConfig(language="bilingual", topic="Photosynthesis"),
        topic="Photosynthesis",
    )

    await classroom_router.create_lesson(
        payload,
        current_user=SimpleNamespace(id="user-1"),
        db=object(),
        orchestrator=_FakeOrchestrator(),
    )

    assert _CapturingClassroomService.seen_language == "bilingual"
    assert _CapturingClassroomService.seen_user_id == "user-1"


@pytest.mark.asyncio
async def test_autonomous_control_routes_read_session_id_from_json_body():
    user = SimpleNamespace(id="user-1")
    orchestrator = _FakeOrchestrator()

    await classroom_router.continue_autonomous_lesson(
        ContinueAutonomousLessonRequest(session_id="session-1", student_input="Smart, what is chlorophyll?"),
        current_user=user,
        db=object(),
        orchestrator=orchestrator,
    )
    assert _CapturingClassroomService.seen_session_id == "session-1"
    assert _CapturingClassroomService.seen_student_input == "Smart, what is chlorophyll?"

    paused = await classroom_router.pause_autonomous_lesson(
        AutonomousSessionRequest(session_id="session-1"),
        current_user=user,
        db=object(),
        orchestrator=orchestrator,
    )
    assert paused == {"paused": True}

    resumed = await classroom_router.resume_autonomous_lesson(
        AutonomousSessionRequest(session_id="session-1"),
        current_user=user,
        db=object(),
        orchestrator=orchestrator,
    )
    assert resumed["type"] == "lesson_resumed"

    changed = await classroom_router.change_topic(
        ChangeAutonomousTopicRequest(
            session_id="session-1",
            new_topic="Cell biology",
            config=ClassroomConfig(language="te", topic="Cell biology"),
        ),
        current_user=user,
        db=object(),
        orchestrator=orchestrator,
    )
    assert changed["new_topic"] == "Cell biology"
    assert _CapturingClassroomService.seen_language == "te"
