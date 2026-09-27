import sys
from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

ROOT = Path(__file__).parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.database import Base  # noqa: E402
from app.models.classroom import ClassroomProgress, ClassroomSession, LearningClass  # noqa: E402,F401
import app.models.ecosystem  # noqa: E402,F401
from app.schemas.classroom import (  # noqa: E402
    CheckpointUpdateRequest,
    CreateLearningClassRequest,
    CurriculumContext,
    GeneratedLesson,
    GeneratedNotes,
    GeneratedQuiz,
    LessonOutlineItem,
)
from app.services import class_preparation_service  # noqa: E402
from app.services.class_preparation_service import ClassPreparationService  # noqa: E402


class FakeRuntime:
    def __init__(self, db, gateway=None):
        self.db = db

    async def generate_lesson(self, config, topic, user_id):
        return GeneratedLesson(
            title="Prepared physics",
            subject="Physics",
            difficulty="beginner",
            estimated_minutes=20,
            learning_objectives=["Connect force and motion"],
            outline=[LessonOutlineItem(step=1, title="Motion", content="Motion describes a change in position.")],
            key_concepts=["Motion"],
            remaining_topics=[],
        )

    async def generate_notes(self, config, topic):
        return GeneratedNotes(summary=f"Notes for {topic}", key_points=[topic])

    async def generate_quiz(self, config, topic, count, types):
        return GeneratedQuiz(topic=topic, questions=[])


class ResumeRuntime:
    def __init__(self, db, gateway=None):
        self.db = db

    async def get_lesson_state(self, session_id, user_id):
        assert session_id == "session-1"
        assert user_id == "student-1"
        return {
            "current_stage": "explanation",
            "progress_percent": 42.0,
            "is_paused": True,
            "last_teacher_response": "We are continuing from the saved explanation.",
        }

    async def start_autonomous_lesson(self, config, topic, user_id):
        raise AssertionError("an existing classroom session must be reused")


class MultiAgentPreparationRuntime:
    gateway = object()
    calls: list[dict] = []

    async def run_multi_agent(self, tasks):
        self.calls = tasks
        return {
            "status": "completed",
            "results": {
                "notes": {"status": "completed", "output": GeneratedNotes(summary="Agent notes", key_points=["Motion"])},
                "quiz": {"status": "completed", "output": GeneratedQuiz(topic="Motion", questions=[])},
            },
        }


@pytest.mark.asyncio
async def test_create_uses_notes_and_quiz_agents_when_orchestrator_is_available(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(class_preparation_service, "ClassroomService", FakeRuntime)
    agent_runner = MultiAgentPreparationRuntime()

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with session_factory() as db:
        result = await ClassPreparationService(db, orchestrator=agent_runner).create(
            CreateLearningClassRequest(
                goal="Newton's laws",
                level="Beginner",
                language="bilingual",
                syllabus_source="smart",
                curriculum_context=CurriculumContext(country="India", board="CBSE", class_name="Class 10", academic_year="2026-27", exam="Board exam"),
            ),
            "student-1",
        )

        assert result.prepared_content["notes"]["summary"] == "Agent notes"
        assert [task["agent"] for task in agent_runner.calls] == ["notes", "quiz"]
        assert result.comparison["curriculum_context"] == {
            "country": "India",
            "board": "CBSE",
            "class_name": "Class 10",
            "academic_year": "2026-27",
            "exam": "Board exam",
        }
        assert result.comparison["curriculum_context_status"] == "provided"
    await engine.dispose()


@pytest.mark.asyncio
async def test_create_persists_prepared_class_and_real_stage_completion(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(class_preparation_service, "ClassroomService", FakeRuntime)

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with session_factory() as db:
        result = await ClassPreparationService(db).create(
            CreateLearningClassRequest(
                goal="Newton's laws",
                level="Beginner",
                language="bilingual",
                syllabus_source="merged",
                syllabus_text="Unit 1: Motion\n- Newton's laws",
            ),
            "student-1",
        )

        assert result.status == "ready"
        assert result.curriculum == ["Motion", "Newton's laws"]
        assert all(stage.status == "complete" for stage in result.preparation)
        assert result.prepared_content["board_scenes"][0]["visual_type"] == "diagram"
        assert result.content_hash
        assert result.checkpoint["student_id"] == "student-1"
        assert result.checkpoint["course_id"] == result.id
        assert result.checkpoint["module_id"] == "module-1"
    await engine.dispose()


@pytest.mark.asyncio
async def test_start_reuses_existing_session_checkpoint(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(class_preparation_service, "ClassroomService", ResumeRuntime)

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with session_factory() as db:
        record = LearningClass(
            user_id="student-1",
            title="Physics class",
            goal="Newton's laws",
            subject="Physics",
            level="Beginner",
            language="te",
            status="ready",
            syllabus_source="smart",
            syllabus_text="",
            syllabus_topics=[],
            curriculum=["Motion"],
            comparison={},
            prepared_content={},
            preparation=[],
            checkpoint={"session_id": "session-1", "paused": True},
            content_hash="content-hash",
            current_lesson=0,
        )
        db.add(record)
        await db.commit()
        await db.refresh(record)

        result = await ClassPreparationService(db).start(record.id, "student-1")

        assert result["session"]["session_id"] == "session-1"
        assert result["session"]["type"] == "classroom_resumed"
        assert result["session"]["paused"] is True
        assert result["session"]["content"].startswith("We are continuing")
        assert result["learning_class"].checkpoint["paused"] is True

        checkpointed = await ClassPreparationService(db).save_checkpoint(
            record.id,
            CheckpointUpdateRequest(
                current_lesson=1,
                scene_id="scene-2",
                stage="Second topic",
                current_concept="Newton's second law",
                current_sentence="Force equals mass times acceleration.",
                visual_state={"visual_type": "formula", "scene_id": "scene-2"},
                animation_time=12.5,
                lesson_progress=50,
                mastery={"Newton's second law": 0.6},
                language="te",
                voice_settings={"provider": "piper", "speaking": False},
                difficulty="Beginner",
                pending_question="Why does acceleration change?",
                pending_task={"id": "practice-2", "topic": "acceleration"},
            ),
            "student-1",
        )
        assert checkpointed.checkpoint["session_id"] == "session-1"
        assert checkpointed.checkpoint["scene_id"] == "scene-2"
        assert checkpointed.checkpoint["current_concept"] == "Newton's second law"
        assert checkpointed.checkpoint["visual_state"]["visual_type"] == "formula"
        assert checkpointed.checkpoint["lesson_progress"] == 50
        assert checkpointed.checkpoint["voice_settings"]["provider"] == "piper"
    await engine.dispose()
