"""Persistent class-builder and pre-class preparation service."""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.tutor.class_preparation import (
    compare_curriculum,
    compile_prepared_content,
    extract_syllabus_topics,
    merge_topics,
)
from app.models.classroom import LearningClass
from app.schemas.classroom import (
    CheckpointUpdateRequest,
    ClassroomConfig,
    CreateLearningClassRequest,
    CurriculumUpdateRequest,
    LearningClassRead,
    SyllabusExtractionRead,
)
from app.services.ai_gateway import AIGateway
from app.services.classroom_service import ClassroomService


_STAGES = (
    ("goal", "Understanding your learning goal"),
    ("curriculum", "Building your curriculum"),
    ("comparison", "Checking syllabus alignment"),
    ("lesson", "Preparing the first lesson"),
    ("board", "Compiling interactive board scenes"),
    ("practice", "Preparing practice and notes"),
)

logger = logging.getLogger(__name__)


def _stages() -> list[dict[str, str]]:
    return [{"id": stage_id, "label": label, "status": "pending"} for stage_id, label in _STAGES]


def _hash_content(*values: Any) -> str:
    payload = json.dumps(values, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _stable_id(prefix: str, value: str) -> str:
    return f"{prefix}-{hashlib.sha1(value.strip().lower().encode('utf-8')).hexdigest()[:16]}"


def _checkpoint_identity(record: LearningClass, current_lesson: int, scene_id: str | None, concept: str | None) -> dict[str, Any]:
    topic_id = scene_id or (concept.strip() if concept and concept.strip() else f"topic-{current_lesson + 1}")
    return {
        "student_id": record.user_id,
        "course_id": record.id,
        "subject_id": _stable_id("subject", record.subject or record.goal),
        "curriculum_id": _stable_id("curriculum", "|".join(record.curriculum or [record.goal])),
        "module_id": f"module-{(current_lesson // 4) + 1}",
        "lesson_id": f"lesson-{current_lesson + 1}",
        "topic_id": topic_id,
        "subtopic_id": concept or topic_id,
        "current_visual_scene": scene_id,
    }


def _config(payload: CreateLearningClassRequest, goal: str) -> ClassroomConfig:
    return ClassroomConfig(
        avatar_type=payload.avatar_type,
        learning_mode=payload.learning_mode,
        teaching_style=payload.teaching_style,
        language=payload.language,
        topic=goal[:120],
        level=payload.level,
        curriculum_context=payload.curriculum_context,
    )


class ClassPreparationService:
    def __init__(self, db: AsyncSession, gateway: AIGateway | None = None, orchestrator: Any | None = None):
        self.db = db
        self.gateway = gateway
        self.orchestrator = orchestrator

    async def extract_syllabus(self, filename: str, text: str) -> SyllabusExtractionRead:
        topics = extract_syllabus_topics(text)
        return SyllabusExtractionRead(
            filename=filename,
            text=text,
            topics=topics,
            character_count=len(text),
        )

    async def create(self, payload: CreateLearningClassRequest, user_id: str) -> LearningClassRead:
        if payload.syllabus_source != "smart" and not payload.syllabus_text.strip():
            raise ValueError("A syllabus is required when comparison is selected")

        goal = " ".join(payload.goal.split())
        syllabus_topics = extract_syllabus_topics(payload.syllabus_text)
        record = LearningClass(
            user_id=user_id,
            title=f"{goal[:150]} class",
            goal=goal,
            subject=goal[:160],
            level=payload.level,
            language=payload.language,
            status="preparing",
            syllabus_source=payload.syllabus_source,
            syllabus_filename=payload.syllabus_filename,
            syllabus_text=payload.syllabus_text,
            syllabus_topics=syllabus_topics,
            preparation=_stages(),
        )
        self.db.add(record)
        await self.db.flush()
        await self.db.commit()

        try:
            await self._set_stage(record, "goal", "running")
            config = _config(payload, goal)
            await self._set_stage(record, "goal", "complete")

            await self._set_stage(record, "curriculum", "running")
            runtime = ClassroomService(self.db, self.gateway)
            lesson = await runtime.generate_lesson(config, goal, user_id)
            lesson_data = lesson.model_dump()
            generated_topics = [item.title for item in lesson.outline if item.title.strip()]
            if not generated_topics:
                generated_topics = [goal]
            record.subject = lesson.subject or goal
            await self._set_stage(record, "curriculum", "complete")

            await self._set_stage(record, "comparison", "running")
            comparison = compare_curriculum(syllabus_topics, generated_topics)
            record.comparison = {
                **comparison,
                "student_topics": syllabus_topics,
                "ai_topics": generated_topics,
                "curriculum_context": payload.curriculum_context.model_dump(exclude_none=True),
                "curriculum_context_status": "provided" if payload.curriculum_context.model_dump(exclude_none=True) else "not_specified",
            }
            record.curriculum = merge_topics(syllabus_topics, generated_topics, payload.syllabus_source)
            if not record.curriculum:
                record.curriculum = generated_topics[:]
            await self._set_stage(record, "comparison", "complete")

            await self._set_stage(record, "lesson", "running")
            lesson_data = await self._enrich_missing_topics(lesson_data, record.curriculum, config, user_id, payload.language)
            prepared = compile_prepared_content(lesson_data, record.curriculum, payload.language)
            record.prepared_content = prepared
            await self._set_stage(record, "lesson", "complete")

            await self._set_stage(record, "board", "running")
            # Board scenes are compiled from declarative data above. This stage
            # is separate so the UI can distinguish lesson generation from
            # visual preparation and future renderers can be added safely.
            record.prepared_content = prepared
            await self._set_stage(record, "board", "complete")

            await self._set_stage(record, "practice", "running")
            first_topic = (record.curriculum or [goal])[0]
            if self.orchestrator is not None:
                batch = await self.orchestrator.run_multi_agent([
                    {
                        "id": "notes",
                        "agent": "notes",
                        "payload": {"config": config.model_dump(), "topic": first_topic},
                    },
                    {
                        "id": "quiz",
                        "agent": "quiz",
                        "payload": {
                            "config": config.model_dump(),
                            "topic": first_topic,
                            "count": 3,
                            "types": ["mcq", "true_false", "fill_blank"],
                        },
                    },
                ])
                notes_result = batch["results"].get("notes", {})
                quiz_result = batch["results"].get("quiz", {})
                if notes_result.get("status") != "completed":
                    raise RuntimeError(f"Notes agent failed: {notes_result.get('error', 'unknown error')}")
                if quiz_result.get("status") != "completed":
                    raise RuntimeError(f"Quiz agent failed: {quiz_result.get('error', 'unknown error')}")
                prepared_notes = notes_result["output"]
                prepared_quiz = quiz_result["output"]
            else:
                prepared_notes = await runtime.generate_notes(config, first_topic)
                prepared_quiz = await runtime.generate_quiz(config, first_topic, 3, ["mcq", "true_false", "fill_blank"])
            prepared = {
                **prepared,
                "notes": {**prepared_notes.model_dump(), "generated": True},
                "quiz": prepared_quiz.model_dump(),
                "practice": [
                {"id": question.id, "topic": first_topic, "prompt": question.question}
                for question in prepared_quiz.questions
                ],
            }
            record.prepared_content = prepared
            record.content_hash = _hash_content(goal, payload.level, payload.language, record.curriculum, payload.curriculum_context.model_dump(exclude_none=True), prepared)
            record.checkpoint = {
                **_checkpoint_identity(record, 0, "scene-1", (record.curriculum or [goal])[0]),
                "current_lesson": 0,
                "scene_id": "scene-1",
                "stage": "introduction",
                "position": 0.0,
                "paused": False,
            }
            await self._set_stage(record, "practice", "complete")
            record.status = "ready"
            record.last_error = None
            await self.db.commit()
            await self.db.refresh(record)
            return LearningClassRead.model_validate(record)
        except Exception as exc:
            record.status = "failed"
            record.last_error = str(exc)[:1000]
            for item in record.preparation or []:
                if item.get("status") == "running":
                    item["status"] = "failed"
            await self.db.commit()
            raise

    async def list_for_user(self, user_id: str) -> list[LearningClassRead]:
        result = await self.db.execute(
            select(LearningClass).where(LearningClass.user_id == user_id).order_by(desc(LearningClass.updated_at))
        )
        return [LearningClassRead.model_validate(item) for item in result.scalars().all()]

    async def get_for_user(self, class_id: str, user_id: str) -> LearningClass:
        result = await self.db.execute(
            select(LearningClass).where(LearningClass.id == class_id, LearningClass.user_id == user_id)
        )
        record = result.scalar_one_or_none()
        if not record:
            raise LookupError("Learning class not found")
        return record

    async def update_curriculum(self, class_id: str, payload: CurriculumUpdateRequest, user_id: str) -> LearningClassRead:
        record = await self.get_for_user(class_id, user_id)
        record.curriculum = merge_topics([], payload.topics, "custom")
        record.syllabus_source = payload.source
        record.comparison = {
            **(record.comparison or {}),
            "selected_source": payload.source,
            "selected_topics": record.curriculum,
        }
        lesson = dict((record.prepared_content or {}).get("lesson") or {})
        record.prepared_content = compile_prepared_content(lesson, record.curriculum, record.language)
        record.content_hash = _hash_content(record.goal, record.level, record.language, record.curriculum, (record.comparison or {}).get("curriculum_context") or {}, record.prepared_content)
        record.status = "ready"
        record.last_error = None
        await self.db.commit()
        await self.db.refresh(record)
        return LearningClassRead.model_validate(record)

    async def save_checkpoint(self, class_id: str, payload: CheckpointUpdateRequest, user_id: str) -> LearningClassRead:
        record = await self.get_for_user(class_id, user_id)
        record.current_lesson = payload.current_lesson
        existing_checkpoint = dict(record.checkpoint or {})
        checkpoint = {
            **existing_checkpoint,
            **_checkpoint_identity(record, payload.current_lesson, payload.scene_id, payload.current_concept),
            "current_lesson": payload.current_lesson,
            "scene_id": payload.scene_id,
            "stage": payload.stage,
            "position": payload.position,
            "paused": payload.paused,
            "saved_at": datetime.utcnow().isoformat(),
        }
        optional_fields = (
            "current_concept",
            "current_sentence",
            "visual_state",
            "animation_time",
            "lesson_progress",
            "mastery",
            "language",
            "voice_settings",
            "difficulty",
            "pending_question",
            "pending_task",
        )
        for field_name in optional_fields:
            if field_name in payload.model_fields_set:
                checkpoint[field_name] = getattr(payload, field_name)
        record.checkpoint = checkpoint
        await self.db.commit()
        await self.db.refresh(record)
        return LearningClassRead.model_validate(record)

    async def start(self, class_id: str, user_id: str) -> dict[str, Any]:
        record = await self.get_for_user(class_id, user_id)
        if record.status != "ready":
            raise ValueError("Class preparation is not ready")
        config = ClassroomConfig(
            avatar_type="friendly_mentor",
            learning_mode="school",
            teaching_style="visual",
            language=record.language,
            topic=record.subject[:120],
            level=record.level,
            curriculum_context=(record.comparison or {}).get("curriculum_context") or {},
        )
        runtime = ClassroomService(self.db, self.gateway)
        checkpoint = dict(record.checkpoint or {})
        existing_session_id = checkpoint.get("session_id")
        if isinstance(existing_session_id, str) and existing_session_id:
            existing_state = await runtime.get_lesson_state(existing_session_id, user_id)
            if existing_state is not None:
                paused = bool(existing_state.get("is_paused", checkpoint.get("paused", False)))
                record.checkpoint = {**checkpoint, "paused": paused}
                await self.db.commit()
                await self.db.refresh(record)
                session = {
                    "session_id": existing_session_id,
                    "type": "classroom_resumed",
                    "stage": existing_state.get("current_stage", checkpoint.get("stage")),
                    "current_step": existing_state.get("current_step", checkpoint.get("current_lesson", 0)),
                    "progress_percent": existing_state.get("progress_percent", 0.0),
                    "paused": paused,
                    "current_concept": existing_state.get("last_taught_concept") or existing_state.get("current_stage"),
                    "visualization_state": existing_state.get("visualization_state", {}),
                    "voice_state": existing_state.get("voice_state", {"language": record.language, "speaking": False, "rate": 1.0}),
                    "concepts_covered": existing_state.get("concepts_covered", []),
                    "pending_concepts": existing_state.get("pending_concepts", []),
                    "resume_snapshot": existing_state.get("resume_snapshot"),
                    "content": existing_state.get("last_teacher_response")
                    or existing_state.get("greeting")
                    or existing_state.get("content")
                    or existing_state.get("message", ""),
                }
                return {"learning_class": LearningClassRead.model_validate(record), "session": session}

        topic = (record.curriculum or [record.goal])[record.current_lesson % max(1, len(record.curriculum or [record.goal]))]
        session = await runtime.start_autonomous_lesson(config, topic, user_id)
        record.checkpoint = {
            **(record.checkpoint or {}),
            **_checkpoint_identity(record, record.current_lesson, checkpoint.get("scene_id"), checkpoint.get("current_concept")),
            "session_id": session.get("session_id"),
            "paused": False,
        }
        await self.db.commit()
        await self.db.refresh(record)
        return {"learning_class": LearningClassRead.model_validate(record), "session": session}

    async def _set_stage(self, record: LearningClass, stage_id: str, status: str) -> None:
        stages = [dict(item) for item in (record.preparation or _stages())]
        current_index = next((index for index, item in enumerate(stages) if item.get("id") == stage_id), 0)
        if status == "running":
            for item in stages[:current_index]:
                item["status"] = "complete"
        for item in stages:
            if item.get("id") == stage_id:
                item["status"] = status
        record.preparation = stages
        await self.db.commit()

    async def _enrich_missing_topics(
        self,
        lesson: dict[str, Any],
        curriculum: list[str],
        config: ClassroomConfig,
        user_id: str,
        language: str,
    ) -> dict[str, Any]:
        """Ask independent lesson agents for provider-missed topics before fallback compilation."""

        if self.orchestrator is None or not curriculum:
            return lesson
        initial = compile_prepared_content(lesson, curriculum, language)
        missing_topics = list((initial.get("coverage") or {}).get("fallback_topics") or [])
        if not missing_topics or not hasattr(self.orchestrator, "run_multi_agent"):
            return lesson

        tasks = [
            {
                "id": _stable_id("coverage", topic),
                "agent": "lesson_planner",
                "payload": {"config": config.model_dump(), "topic": topic},
            }
            for topic in missing_topics
        ]
        try:
            batch = await self.orchestrator.run_multi_agent(tasks)
        except Exception as exc:
            logger.warning("Coverage agents unavailable; keeping explicit fallback scenes: %s", exc)
            return lesson

        outline = [item for item in (lesson.get("outline") or []) if isinstance(item, dict)]
        additions: list[dict[str, Any]] = []
        for topic, task in zip(missing_topics, tasks, strict=False):
            result = (batch.get("results") or {}).get(task["id"], {})
            generated = result.get("output") if result.get("status") == "completed" else None
            if generated is None:
                continue
            generated_data = generated.model_dump() if hasattr(generated, "model_dump") else generated if isinstance(generated, dict) else {}
            generated_outline = [item for item in (generated_data.get("outline") or []) if isinstance(item, dict)]
            explanation = "\n\n".join(str(item.get("content") or "").strip() for item in generated_outline if str(item.get("content") or "").strip())
            if not explanation:
                continue
            additions.append({
                "step": len(outline) + len(additions) + 1,
                "title": topic,
                "content": explanation,
                "minutes": max(8, sum(int(item.get("minutes") or 0) for item in generated_outline)),
                "module": "Coverage completion",
                "chapter": topic,
                "subtopics": ["definition and purpose", "step-by-step method", "worked example", "quick check"],
            })
        if not additions:
            return lesson
        return {**lesson, "outline": [*outline, *additions]}


__all__ = ["ClassPreparationService"]
