from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.application.tutor_brain import TutorBrain
from app.application.teacher_persona import TeacherPersona
from app.domain.tutor.student_profile import StudentProfile
from app.schemas.classroom import ClassroomConfig


class _FakeDb:
    def add(self, _item):
        return None

    async def commit(self):
        return None

    async def refresh(self, _item):
        return None


class _FailingGateway:
    async def chat(self, *_args, **_kwargs):
        raise RuntimeError("offline")


class _TutorGateway:
    async def chat(self, messages, **_kwargs):
        prompt = messages[-1]["content"]
        if "Resume the autonomous lesson" in prompt:
            return "Resuming from the saved concept explanation."
        return "Chlorophyll is the pigment that helps plants capture light. Say continue when it is clear."


@pytest.mark.asyncio
async def test_tutor_brain_generates_arbitrary_subject_fallback_curriculum():
    brain = TutorBrain(_FakeDb(), _FailingGateway())
    config = ClassroomConfig(topic="Marine robotics", level="Beginner", language="en")

    lesson = await brain.generate_lesson(
        config,
        "Marine robotics",
        "user-1",
        completed_topics=["basic vocabulary"],
        weak_topics=["sensors"],
        strong_topics=["geometry"],
    )

    assert lesson.title == "Marine robotics learning plan"
    assert len(lesson.outline) >= 10
    assert any("Prerequisites" == item.title for item in lesson.outline)
    assert any("Advanced" in item.title for item in lesson.outline)
    assert "revision for sensors" in lesson.key_concepts
    assert lesson.completed_topics == ["basic vocabulary"]


@pytest.mark.asyncio
async def test_tutor_brain_preserves_resume_snapshot_for_doubt_interruption():
    brain = TutorBrain(_FakeDb(), _TutorGateway())
    brain._load_or_create_profile = AsyncMock(return_value=StudentProfile(user_id="user-1"))
    config = ClassroomConfig(topic="Photosynthesis", language="en")
    session = SimpleNamespace(
        id="session-1",
        user_id="user-1",
        topic="Photosynthesis",
        config=config.model_dump(),
        current_stage=5,
        completed=False,
        lesson_data={
            "current_stage": "concept_explanation",
            "current_step": 5,
            "progress_percent": 29.4,
            "last_taught_concept": "light energy conversion",
            "last_teacher_response": "Photosynthesis converts light energy into chemical energy.",
            "visualization_state": {"mode": "diagram", "concept": "chloroplast"},
            "quiz_state": {"current_question": 1, "answers": []},
            "voice_state": {"language": "en", "speaking": True, "rate": 1.0},
            "concepts_covered": ["topic_introduction"],
            "pending_concepts": ["concept_explanation", "visual_demonstration"],
            "context_summary": "Teacher explained light energy conversion.",
        },
    )

    doubt = await brain._handle_student_input(session, "Smart, what is chlorophyll?", None)

    assert doubt["resume_lesson"] is True
    assert doubt["interruption_type"] == "doubt"
    assert doubt["resume_snapshot"]["current_stage"] == "concept_explanation"
    assert doubt["resume_snapshot"]["visualization_state"] == {"mode": "diagram", "concept": "chloroplast"}
    assert session.lesson_data["interrupted"] is True

    brain._get_session = AsyncMock(return_value=session)
    resumed = await brain.resume_lesson("session-1", "user-1")

    assert resumed["type"] == "lesson_resumed"
    assert resumed["stage"] == "concept_explanation"
    assert session.lesson_data["current_stage"] == "concept_explanation"
    assert session.lesson_data["visualization_state"] == {"mode": "diagram", "concept": "chloroplast"}
    assert session.lesson_data["quiz_state"] == {"current_question": 1, "answers": []}
    assert session.lesson_data["interrupted"] is False


def test_teacher_persona_enforces_complete_concept_coverage():
    prompt = TeacherPersona.build_system_prompt(
        ClassroomConfig(topic="Physics", language="en").model_dump(),
        lesson_state={"concepts_covered": [], "pending_concepts": ["force"]},
    )

    assert "COMPLETE CONCEPT CONTRACT" in prompt
    assert "real-world example" in prompt
    assert "common mistakes" in prompt
    assert "Do not skip main syllabus content" in prompt
