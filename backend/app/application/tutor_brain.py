"""Autonomous AI Tutor Brain - the central teaching engine."""

from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.teacher_persona import TeacherPersona
from app.application.utils import JSONParser
from app.domain.tutor.lesson_flow import (
    AUTONOMOUS_LESSON_STAGES,
    LearningContext,
    choose_teaching_strategy,
)
from app.domain.tutor.knowledge_graph import KnowledgeGraph
from app.domain.tutor.roadmap import RoadmapGenerator
from app.domain.tutor.student_profile import LessonState, StudentProfile
from app.models.classroom import ClassroomSession, ClassroomProgress
from app.schemas.classroom import ClassroomConfig, GeneratedLesson, LessonOutlineItem
from app.services.wake_word import strip_wake_word

logger = logging.getLogger(__name__)

_LESSON_STAGES = [stage.value for stage in AUTONOMOUS_LESSON_STAGES]
_TOPIC_CHANGE_RE = re.compile(r"\b(change topic|new topic|switch to|teach me)\b", re.IGNORECASE)
_PAUSE_RE = re.compile(r"\b(pause|stop|break|hold on|wait)\b", re.IGNORECASE)
_RESUME_RE = re.compile(r"\b(resume|continue|start again|go on|carry on)\b", re.IGNORECASE)
_REPEAT_RE = re.compile(r"\b(repeat|say that again|again)\b", re.IGNORECASE)
_SLOWER_RE = re.compile(r"\b(slower|slowly|explain slowly|too fast)\b", re.IGNORECASE)
_BACK_RE = re.compile(r"\b(go back|previous|last step|back)\b", re.IGNORECASE)
_QUIZ_RE = re.compile(r"\b(quiz me|quiz|test me|question me)\b", re.IGNORECASE)
_SUMMARY_RE = re.compile(r"\b(summary|summarize|recap|revise)\b", re.IGNORECASE)
_TELUGU_PAUSE_RE = re.compile(r"ఆపు|ఆపండి|విరామం|ఆగు")
_TELUGU_RESUME_RE = re.compile(r"కొనసాగించు|ముందుకు|ప్రారంభించు|మళ్ళీ మొదలు")
_TELUGU_DOUBT_RE = re.compile(r"సందేహం|అర్థం కాలేదు|అర్థం కాలెదు|చెప్పండి|ఎందుకు|ఎలా|ఏమిటి")


class ChatGateway:
    def __init__(self, gateway: Any) -> None:
        self._gateway = gateway

    async def chat(self, messages: list[dict[str, str]], **kwargs: Any) -> str:
        return await self._gateway.chat(messages, **kwargs)

    async def stream(self, messages: list[dict[str, str]], **kwargs: Any) -> AsyncIterator[str]:
        stream_chat = getattr(self._gateway, "stream_chat", None)
        if stream_chat is not None:
            async for chunk in stream_chat(messages, **kwargs):
                yield chunk
            return

        stream = getattr(self._gateway, "stream", None)
        if stream is not None:
            async for chunk in stream(messages, **kwargs):
                yield chunk
            return

        yield await self.chat(messages, **kwargs)


class TutorBrain:
    """Autonomous AI teaching engine that acts as a continuous teacher."""

    def __init__(self, db: AsyncSession, orchestrator: Any) -> None:
        self.db = db
        self.gateway = ChatGateway(orchestrator)
        self.knowledge_graph = KnowledgeGraph()
        self.roadmap_generator = RoadmapGenerator()
        self.persona = TeacherPersona()

    async def generate_lesson(
        self,
        config: ClassroomConfig,
        topic: str,
        user_id: str,
        completed_topics: list[str] | None = None,
        weak_topics: list[str] | None = None,
        strong_topics: list[str] | None = None,
    ) -> GeneratedLesson:
        """Generate a structured, arbitrary-subject curriculum plan."""
        completed = completed_topics or []
        weak = weak_topics or []
        strong = strong_topics or []
        subject = config.topic or topic
        fallback = self._fallback_generated_lesson(config, topic, completed, weak, strong)

        context = LearningContext(
            user_id=user_id,
            topic=topic,
            subject=subject,
            level=config.level,
            language=config.language,
            learning_mode=config.learning_mode,
            completed_topics=tuple(completed),
            weak_topics=tuple(weak),
            strong_topics=tuple(strong),
        )
        strategy = choose_teaching_strategy(context, config.teaching_style)
        system_prompt = TeacherPersona.build_system_prompt(
            config.model_dump(),
            {
                "user_id": user_id,
                "weak_topics": weak[:5],
                "strong_topics": strong[:5],
                "completed_lessons": completed[:10],
                "current_emotion": "neutral",
            },
            {
                "current_stage": "personalized_plan",
                "pending_concepts": self.knowledge_graph.build_learning_path(topic, completed),
                "concepts_covered": completed[-5:],
            },
        )
        user_message = (
            "Create a structured learning curriculum for the requested subject. "
            "Support arbitrary legitimate academic or professional topics; do not limit the plan to demo subjects. "
            "Return JSON only with keys: title, subject, difficulty, estimated_minutes, learning_objectives, "
            "outline, key_concepts, remaining_topics. "
            "Each outline item must include step, module, chapter, title, subtopics, content, minutes, and visual_script. "
            "The outline must cover overview, prerequisites, beginner concepts, intermediate concepts, advanced concepts, "
            "practical applications, exercises, assessments, revision, and mastery checkpoints. "
            f"Topic: {topic}. Level: {config.level}. Language: {config.language}. "
            f"Curriculum context: {config.curriculum_context.model_dump(exclude_none=True) or 'not specified; do not assume a board or current year'}. "
            f"Teaching approach: {strategy.approach}; pacing: {strategy.pacing}; style: {strategy.explanation_style}. "
            f"Completed topics: {completed[:10]}. Weak topics: {weak[:10]}. Strong topics: {strong[:10]}."
        )

        try:
            raw = await self.gateway.chat(
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                task_type="ai_tutor",
                temperature=0.35,
                max_output_tokens=1800,
                json_mode=True,
                request_timeout_seconds=25,
            )
            data = JSONParser.parse(raw, fallback.model_dump())
            return self._coerce_generated_lesson(data, fallback)
        except Exception as exc:
            logger.warning("Tutor lesson plan generation failed, using deterministic plan: %s", exc)
            return fallback

    async def start_autonomous_lesson(
        self,
        config: ClassroomConfig,
        topic: str,
        user_id: str,
        student_profile: StudentProfile | None = None,
    ) -> dict[str, Any]:
        """Start a new autonomous lesson. Returns initial teaching content."""
        profile = student_profile or await self._load_or_create_profile(user_id)
        session = await self._create_session(user_id, topic, config)

        missing_prereqs = self.knowledge_graph.validate_prerequisites(
            topic, profile.completed_lessons
        )

        if missing_prereqs:
            lesson = self._build_prerequisite_lesson(topic, missing_prereqs, config)
            session.lesson_data = lesson.model_dump()
            session.current_stage = 0
            session.lesson_data["pending_concepts"] = missing_prereqs + [topic.lower()]
            self.db.add(session)
            await self.db.commit()
            await self.db.refresh(session)

            return {
                "session_id": session.id,
                "type": "prerequisite_lesson",
                "lesson": lesson.model_dump(),
                "message": self._persona_response(
                    config, profile, {"current_stage": "greeting", "concepts_covered": [], "pending_concepts": missing_prereqs + [topic.lower()]},
                    f"Before we start {topic}, let's build a strong foundation. We need to cover: {', '.join(missing_prereqs)}. This will make the main topic much easier to understand!"
                ),
                "roadmap": self._generate_roadmap(topic, config),
            }

        lesson_state = LessonState(
            session_id=session.id,
            user_id=user_id,
            topic=topic,
            subject=config.topic or topic,
            level=config.level,
            language=config.language,
            learning_mode=config.learning_mode,
            current_stage="greeting",
            total_steps=len(_LESSON_STAGES),
            pending_concepts=self.knowledge_graph.build_learning_path(topic, profile.completed_lessons),
        )

        greeting_content = self._build_greeting(config, profile, topic)
        session.lesson_data = lesson_state.to_dict()
        session.lesson_data["greeting"] = greeting_content
        session.current_stage = 1
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)

        return {
            "session_id": session.id,
            "type": "autonomous_lesson",
            "stage": "greeting",
            "progress_percent": 0.0,
            "content": greeting_content,
            "roadmap": self._generate_roadmap(topic, config),
            "next_stage": "learning_objective",
            "concepts_covered": [],
            "pending_concepts": lesson_state.pending_concepts,
        }

    async def continue_lesson(
        self,
        session_id: str,
        user_id: str,
        student_input: str | None = None,
        config: ClassroomConfig | None = None,
    ) -> dict[str, Any]:
        """Continue the autonomous lesson from where it left off."""
        session = await self._get_session(session_id, user_id)
        if not session:
            return {"error": "Session not found", "session_id": session_id}

        lesson_data = dict(session.lesson_data or {})
        current_stage = lesson_data.get("current_stage", "greeting")
        is_paused = lesson_data.get("is_paused", False)
        is_completed = lesson_data.get("is_completed", False)

        if is_completed:
            return {
                "session_id": session_id,
                "type": "lesson_completed",
                "message": "This lesson is complete! Would you like to start a new topic?",
            }

        if is_paused:
            return {
                "session_id": session_id,
                "type": "lesson_paused",
                "message": "The lesson is paused. Say 'resume' or 'continue' to continue learning.",
                "resume_snapshot": lesson_data.get("resume_snapshot"),
            }

        if student_input:
            result = await self._handle_student_input(session, student_input, config)
            return result

        if lesson_data.get("interrupted") and lesson_data.get("resume_snapshot"):
            resume_config = config or ClassroomConfig.model_validate(session.config or {})
            return await self._resume_from_snapshot(session, lesson_data, resume_config)

        stage_index = _LESSON_STAGES.index(current_stage) if current_stage in _LESSON_STAGES else 0
        next_stage = _LESSON_STAGES[min(stage_index + 1, len(_LESSON_STAGES) - 1)]

        if next_stage == current_stage and stage_index >= len(_LESSON_STAGES) - 1:
            lesson_data["is_completed"] = True
            lesson_data["current_stage"] = "summary"
            session.lesson_data = lesson_data
            self.db.add(session)
            await self.db.commit()
            return {
                "session_id": session_id,
                "type": "lesson_completed",
                "message": self._build_completion_message(session),
                "next_recommendation": lesson_data.get("next_recommendation"),
            }

        teaching_content = await self._generate_stage_content(session, next_stage, config)
        lesson_data["current_stage"] = next_stage
        lesson_data["current_step"] = _LESSON_STAGES.index(next_stage)
        lesson_data["last_taught_concept"] = next_stage
        lesson_data["last_teacher_response"] = teaching_content
        lesson_data["explanation_position"] = {
            "stage": next_stage,
            "segment": next_stage,
            "char_offset": len(teaching_content),
        }
        lesson_data["concepts_covered"] = lesson_data.get("concepts_covered", []) + [next_stage]
        lesson_data["context_summary"] = f"{lesson_data.get('context_summary', '')}\nTeacher ({next_stage}): {teaching_content}"
        lesson_data["progress_percent"] = self._calculate_progress(next_stage, lesson_data.get("total_steps", len(_LESSON_STAGES)))

        if next_stage == "next_lesson":
            lesson_data["is_completed"] = True
            lesson_data["next_recommendation"] = "Continue learning!"
            session.completed = True

        session.current_stage = _LESSON_STAGES.index(next_stage)
        session.lesson_data = lesson_data
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)

        return {
            "session_id": session_id,
            "type": "teaching_content",
            "stage": next_stage,
            "progress_percent": lesson_data["progress_percent"],
            "content": teaching_content, # Now a string
            "concepts_covered": lesson_data["concepts_covered"],
            "pending_concepts": lesson_data.get("pending_concepts", []),
            "next_stage": _LESSON_STAGES[min(_LESSON_STAGES.index(next_stage) + 1, len(_LESSON_STAGES) - 1)] if not lesson_data.get("is_completed") else None,
            "is_completed": lesson_data.get("is_completed", False),
            "next_recommendation": lesson_data.get("next_recommendation"),
        }

    async def _handle_student_input(
        self,
        session: ClassroomSession,
        student_input: str,
        config: ClassroomConfig | None,
    ) -> dict[str, Any]:
        """Handle student questions, interruptions, or topic changes."""
        lesson_data = dict(session.lesson_data or {})
        config = config or ClassroomConfig.model_validate(session.config or {})
        original_input = student_input.strip()
        command_text = self._strip_wake_word(original_input)
        intent = self._detect_student_intent(command_text)
        current_stage = lesson_data.get("current_stage", "greeting")

        if intent == "topic_change":
            new_topic = self._extract_requested_topic(command_text, config.topic)
            if not new_topic:
                new_topic = config.topic
            lesson_data["resume_snapshot"] = self._build_resume_snapshot(
                session, lesson_data, config, intent, original_input
            )
            lesson_data["interrupted"] = True
            lesson_data["interruption_type"] = "topic_change"
            session.lesson_data = lesson_data
            self.db.add(session)
            await self.db.commit()
            return {
                "session_id": session.id,
                "type": "topic_change",
                "message": f"Sure! Let's switch to {new_topic}. Give me a moment to prepare the best lesson for you.",
                "new_topic": new_topic,
            }

        if intent == "pause":
            lesson_data["resume_snapshot"] = self._build_resume_snapshot(
                session, lesson_data, config, intent, original_input
            )
            lesson_data["interrupted"] = True
            lesson_data["interruption_type"] = "pause"
            lesson_data["is_paused"] = True
            session.lesson_data = lesson_data
            self.db.add(session)
            await self.db.commit()
            return {
                "session_id": session.id,
                "type": "lesson_paused",
                "message": "No problem! Take your time. Say 'resume' or 'continue' whenever you're ready.",
                "resume_snapshot": lesson_data.get("resume_snapshot"),
            }

        if intent == "resume":
            lesson_data["is_paused"] = False
            return await self._resume_from_snapshot(session, lesson_data, config)

        if intent == "repeat":
            repeated = lesson_data.get("last_teacher_response") or lesson_data.get("greeting")
            if not repeated:
                repeated = self._fallback_stage_content(current_stage, session.topic, config)
            lesson_data["context_summary"] = (
                f"{lesson_data.get('context_summary', '')}\n"
                f"Student: {original_input}\nTeacher repeated ({current_stage}): {repeated}"
            )
            session.lesson_data = lesson_data
            self.db.add(session)
            await self.db.commit()
            return {
                "session_id": session.id,
                "type": "response",
                "message": repeated,
                "content": repeated,
                "stage": current_stage,
                "resume_lesson": False,
            }

        if intent == "go_back":
            stage_index = _LESSON_STAGES.index(current_stage) if current_stage in _LESSON_STAGES else 0
            previous_stage = _LESSON_STAGES[max(0, stage_index - 1)]
            lesson_data["current_stage"] = previous_stage
            lesson_data["current_step"] = _LESSON_STAGES.index(previous_stage)
            session.current_stage = lesson_data["current_step"]
            session.lesson_data = lesson_data
            teaching_content = await self._generate_stage_content(session, previous_stage, config)
            lesson_data["last_teacher_response"] = teaching_content
            lesson_data["context_summary"] = (
                f"{lesson_data.get('context_summary', '')}\n"
                f"Student: {original_input}\nTeacher went back ({previous_stage}): {teaching_content}"
            )
            session.lesson_data = lesson_data
            self.db.add(session)
            await self.db.commit()
            return {
                "session_id": session.id,
                "type": "teaching_content",
                "stage": previous_stage,
                "progress_percent": self._calculate_progress(previous_stage, lesson_data.get("total_steps", len(_LESSON_STAGES))),
                "content": teaching_content,
                "next_stage": current_stage,
            }

        profile = await self._load_or_create_profile(session.user_id)
        context_summary = lesson_data.get("context_summary", "")
        resume_snapshot = self._build_resume_snapshot(session, lesson_data, config, intent, original_input)
        lesson_data["resume_snapshot"] = resume_snapshot
        lesson_data["interrupted"] = True
        lesson_data["interruption_type"] = intent
        session.lesson_data = lesson_data

        system_prompt = TeacherPersona.build_system_prompt(
            config.model_dump(), profile.to_dict(), lesson_data
        )
        if intent == "quiz":
            instruction = "Create a short formative question for the current concept, then wait for the student's answer. Do not advance the lesson."
        elif intent == "summary":
            instruction = "Summarize the current lesson state briefly, list the key points, and invite the student to continue. Do not advance the lesson."
        elif intent == "slower":
            instruction = "Re-explain the current concept more slowly with smaller steps, one analogy, and one simple example. Do not advance the lesson."
        else:
            instruction = "Answer the doubt clearly, verify understanding, and then invite the student to continue from the saved point. Do not advance the lesson."
        user_message = (
            f"Student question/input: {original_input}\n"
            f"Current lesson stage: {current_stage}\n"
            f"Context so far: {context_summary}\n"
            f"Resume snapshot: {json.dumps(resume_snapshot, ensure_ascii=False)}\n"
            f"{instruction}"
        )

        try:
            response_text = await self.gateway.chat(
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                task_type="ai_tutor",
                temperature=0.4,
                max_output_tokens=800,
                request_timeout_seconds=20,
            )
        except Exception as exc:
            logger.warning("Tutor interruption response failed, using fallback: %s", exc)
            response_text = self._fallback_interruption_response(intent, original_input, session.topic, config)

        lesson_data["context_summary"] = f"{context_summary}\nStudent: {original_input}\nTeacher ({intent}): {response_text}"
        lesson_data["last_student_input"] = original_input
        lesson_data["last_teacher_response"] = response_text
        lesson_data["last_interruption_answer"] = response_text
        session.lesson_data = lesson_data
        self.db.add(session)
        await self.db.commit()

        return {
            "session_id": session.id,
            "type": "response",
            "message": response_text,
            "content": response_text,
            "stage": current_stage,
            "resume_lesson": True,
            "next_stage": current_stage,
            "interruption_type": intent,
            "resume_snapshot": resume_snapshot,
        }

    async def stream_autonomous_lesson(
        self,
        session_id: str,
        user_id: str,
        config: ClassroomConfig,
    ) -> AsyncIterator[dict[str, Any]]:
        """Stream an autonomous lesson stage by stage with raw text content."""
        session = await self._get_session(session_id, user_id)
        if not session:
            yield {"type": "error", "message": "Session not found"}
            return

        lesson_data = dict(session.lesson_data or {})
        
        # Start with greeting if just starting
        if lesson_data.get("current_stage") == "greeting":
            greeting = self._build_greeting(config, await self._load_or_create_profile(user_id), session.topic)
            yield {
                "type": "text",
                "content": greeting,
                "stage": "greeting",
            }
            yield {"type": "done", "stage": "greeting"}
            lesson_data["current_stage"] = "learning_objective"
            session.lesson_data = lesson_data
            await self.db.commit()
        
        while True:
            current_stage = lesson_data.get("current_stage", "greeting")
            if current_stage == "next_lesson" or lesson_data.get("is_completed"):
                break
                
            # Get next stage
            stage_index = _LESSON_STAGES.index(current_stage) if current_stage in _LESSON_STAGES else 0
            next_stage = _LESSON_STAGES[min(stage_index + 1, len(_LESSON_STAGES) - 1)]
            
            if next_stage == current_stage:
                break
                
            yield {"type": "stage_start", "stage": next_stage}
            
            # Stream the actual content from LLM
            profile = await self._load_or_create_profile(user_id)
            system_prompt = TeacherPersona.build_system_prompt(config.model_dump(), profile.to_dict(), lesson_data)
            user_message = TeacherPersona.build_user_message(session.topic, next_stage, lesson_data)
            
            async for token in self.gateway.stream(
                [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_message}],
                temperature=0.4,
            ):
                yield {"type": "token", "content": token, "stage": next_stage}
            
            # Update session state
            lesson_data["current_stage"] = next_stage
            lesson_data["concepts_covered"] = lesson_data.get("concepts_covered", []) + [next_stage]
            lesson_data["progress_percent"] = self._calculate_progress(next_stage, len(_LESSON_STAGES))
            session.current_stage = _LESSON_STAGES.index(next_stage)
            session.lesson_data = lesson_data
            await self.db.commit()
            
            yield {"type": "done", "stage": next_stage, "progress": lesson_data["progress_percent"]}
            
            # Wait for student engagement (simulated or real)
            await asyncio.sleep(2) 

    async def get_lesson_state(self, session_id: str, user_id: str) -> dict[str, Any] | None:
        session = await self._get_session(session_id, user_id)
        if not session:
            return None
        return dict(session.lesson_data or {})

    async def pause_lesson(self, session_id: str, user_id: str) -> bool:
        session = await self._get_session(session_id, user_id)
        if not session:
            return False
        lesson_data = dict(session.lesson_data or {})
        config = ClassroomConfig.model_validate(session.config or {})
        lesson_data["resume_snapshot"] = lesson_data.get("resume_snapshot") or self._build_resume_snapshot(
            session,
            lesson_data,
            config,
            "pause",
            "pause",
        )
        lesson_data["interrupted"] = True
        lesson_data["interruption_type"] = "pause"
        lesson_data["is_paused"] = True
        session.lesson_data = lesson_data
        self.db.add(session)
        await self.db.commit()
        return True

    async def resume_lesson(self, session_id: str, user_id: str) -> dict[str, Any] | None:
        session = await self._get_session(session_id, user_id)
        if not session:
            return None
        lesson_data = dict(session.lesson_data or {})
        lesson_data["is_paused"] = False
        config = ClassroomConfig.model_validate(session.config or {})
        if lesson_data.get("resume_snapshot"):
            return await self._resume_from_snapshot(session, lesson_data, config)
        session.lesson_data = lesson_data
        self.db.add(session)
        await self.db.commit()
        return await self.continue_lesson(session_id, user_id, None, config)

    async def change_topic(
        self, session_id: str, user_id: str, new_topic: str, config: ClassroomConfig
    ) -> dict[str, Any]:
        session = await self._get_session(session_id, user_id)
        if not session:
            return {"error": "Session not found"}

        session.topic = new_topic[:180]
        session.current_stage = 0
        lesson_data = {"is_paused": False, "is_completed": False, "interrupted": False, "concepts_covered": [], "pending_concepts": []}
        session.lesson_data = lesson_data
        self.db.add(session)
        await self.db.commit()

        profile = await self._load_or_create_profile(user_id)
        result = await self.start_autonomous_lesson(config, new_topic, user_id, profile)
        result["type"] = "topic_changed"
        return result

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _strip_wake_word(text: str) -> str:
        return strip_wake_word(text)

    @staticmethod
    def _detect_student_intent(text: str) -> str:
        normalized = text.strip().lower()
        if not normalized:
            return "doubt"
        if _TOPIC_CHANGE_RE.search(normalized):
            return "topic_change"
        if _PAUSE_RE.search(normalized) or _TELUGU_PAUSE_RE.search(text):
            return "pause"
        if _RESUME_RE.search(normalized) or _TELUGU_RESUME_RE.search(text):
            return "resume"
        if _REPEAT_RE.search(normalized):
            return "repeat"
        if _SLOWER_RE.search(normalized):
            return "slower"
        if _BACK_RE.search(normalized):
            return "go_back"
        if _QUIZ_RE.search(normalized):
            return "quiz"
        if _SUMMARY_RE.search(normalized):
            return "summary"
        if "?" in text or _TELUGU_DOUBT_RE.search(text):
            return "doubt"
        return "doubt"

    @staticmethod
    def _extract_requested_topic(text: str, fallback: str) -> str:
        candidate = _TOPIC_CHANGE_RE.sub("", text).strip(" :-,.\n\t")
        return candidate or fallback

    @staticmethod
    def _safe_int(value: Any, fallback: int) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return fallback

    @staticmethod
    def _coerce_string_list(value: Any, fallback: list[str], limit: int = 12) -> list[str]:
        if not isinstance(value, list):
            return fallback
        items = [str(item).strip() for item in value if str(item).strip()]
        return items[:limit] or fallback

    @staticmethod
    def _visual_script_for_step(topic: str, step: int, mode: str = "diagram") -> list[dict[str, Any]]:
        return [
            {
                "type": "label",
                "text": topic,
                "x": 120,
                "y": 80 + step * 12,
                "color": "#f8fafc",
            },
            {
                "type": "rect",
                "label": f"Step {step}",
                "x": 90,
                "y": 120,
                "w": 220,
                "h": 72,
                "color": "#2563eb" if mode != "practice" else "#16a34a",
            },
        ]

    def _fallback_generated_lesson(
        self,
        config: ClassroomConfig,
        topic: str,
        completed_topics: list[str],
        weak_topics: list[str],
        strong_topics: list[str],
    ) -> GeneratedLesson:
        normalized_topic = topic.strip() or "General learning"
        subject = config.topic or normalized_topic
        graph_prereqs = self.knowledge_graph.get_prerequisites(normalized_topic.lower())
        prerequisites = graph_prereqs or [
            f"What {normalized_topic} means",
            "basic vocabulary",
            "one everyday example",
        ]
        key_concepts = [
            normalized_topic,
            f"{normalized_topic} foundations",
            f"{normalized_topic} patterns",
            f"{normalized_topic} applications",
            f"{normalized_topic} practice",
            f"{normalized_topic} mastery",
        ]
        if weak_topics:
            key_concepts.insert(1, f"revision for {weak_topics[0]}")

        outline_specs = [
            ("Subject overview", f"Define {normalized_topic}, why it matters, and where the learner will use it.", 5, "diagram"),
            ("Prerequisites", f"Check readiness for {', '.join(prerequisites[:4])} before the main topic.", 6, "mindmap"),
            ("Beginner foundations", f"Teach the simplest building blocks of {normalized_topic} with one tiny example.", 8, "diagram"),
            ("Core concept", f"Explain the main idea of {normalized_topic} step by step.", 10, "flowchart"),
            ("Intermediate connections", f"Connect the core idea to related concepts and common patterns.", 10, "chart"),
            ("Advanced view", f"Show how experts think about {normalized_topic} without overwhelming the learner.", 8, "graph"),
            ("Practical application", f"Use a realistic scenario where {normalized_topic} solves a real problem.", 8, "simulation"),
            ("Guided exercise", f"Give a small task and coach the learner through the first attempt.", 8, "practice"),
            ("Assessment", "Ask a mixed mini-quiz and explain each answer.", 7, "quiz"),
            ("Revision and mastery checkpoint", "Summarize, schedule revision, estimate mastery, and recommend the next concept.", 5, "timeline"),
        ]
        outline = [
            LessonOutlineItem(
                step=index,
                title=title,
                content=content,
                minutes=minutes,
                visual_script=self._visual_script_for_step(normalized_topic, index, mode),
                module=("Foundations" if index <= 3 else "Core concepts" if index <= 6 else "Application and mastery"),
                chapter=title,
                subtopics=self._subtopics_for_outline_title(title),
            )
            for index, (title, content, minutes, mode) in enumerate(outline_specs, start=1)
        ]
        remaining = [
            concept
            for concept in self.knowledge_graph.build_learning_path(normalized_topic, completed_topics)
            if concept.lower() not in {item.lower() for item in completed_topics}
        ]
        if not remaining:
            remaining = key_concepts[:]

        objectives = [
            f"Explain {normalized_topic} in simple words.",
            f"Use {normalized_topic} in a realistic example.",
            f"Solve one guided practice task for {normalized_topic}.",
            "Identify doubts before moving to the next concept.",
            "Complete a short mastery checkpoint and revision plan.",
        ]
        if strong_topics:
            objectives.append(f"Connect this lesson to your strength in {strong_topics[0]}.")

        return GeneratedLesson(
            title=f"{normalized_topic} learning plan",
            subject=subject,
            difficulty=config.level or self.knowledge_graph.get_difficulty(normalized_topic.lower()),
            estimated_minutes=sum(item.minutes for item in outline),
            learning_objectives=objectives,
            outline=outline,
            key_concepts=key_concepts[:10],
            completed_topics=completed_topics,
            remaining_topics=remaining[:12],
        )

    def _coerce_generated_lesson(self, data: dict[str, Any], fallback: GeneratedLesson) -> GeneratedLesson:
        fallback_outline = fallback.outline
        outline: list[LessonOutlineItem] = []
        raw_outline = data.get("outline")
        if isinstance(raw_outline, list):
            for index, item in enumerate(raw_outline[:12], start=1):
                if not isinstance(item, dict):
                    continue
                outline.append(
                    LessonOutlineItem(
                        step=self._safe_int(item.get("step"), index),
                        title=str(item.get("title") or fallback_outline[min(index - 1, len(fallback_outline) - 1)].title),
                        content=str(item.get("content") or fallback_outline[min(index - 1, len(fallback_outline) - 1)].content),
                        minutes=max(1, self._safe_int(item.get("minutes"), 6)),
                        visual_script=item.get("visual_script") if isinstance(item.get("visual_script"), list) else [],
                        module=str(item.get("module") or fallback_outline[min(index - 1, len(fallback_outline) - 1)].module),
                        chapter=str(item.get("chapter") or item.get("title") or fallback_outline[min(index - 1, len(fallback_outline) - 1)].title),
                        subtopics=self._coerce_string_list(
                            item.get("subtopics"),
                            fallback_outline[min(index - 1, len(fallback_outline) - 1)].subtopics
                            or self._subtopics_for_outline_title(str(item.get("title") or "concept")),
                            limit=8,
                        ),
                    )
                )
        if not outline:
            outline = fallback_outline

        return GeneratedLesson(
            title=str(data.get("title") or fallback.title),
            subject=str(data.get("subject") or fallback.subject),
            difficulty=str(data.get("difficulty") or fallback.difficulty),
            estimated_minutes=max(5, self._safe_int(data.get("estimated_minutes"), fallback.estimated_minutes)),
            learning_objectives=self._coerce_string_list(
                data.get("learning_objectives"), fallback.learning_objectives
            ),
            outline=outline,
            key_concepts=self._coerce_string_list(data.get("key_concepts"), fallback.key_concepts),
            completed_topics=self._coerce_string_list(data.get("completed_topics"), fallback.completed_topics),
            remaining_topics=self._coerce_string_list(data.get("remaining_topics"), fallback.remaining_topics),
        )

    @staticmethod
    def _subtopics_for_outline_title(title: str) -> list[str]:
        normalized = title.lower()
        if "prerequisite" in normalized or "foundation" in normalized:
            return ["prior knowledge", "terminology", "simple example"]
        if "application" in normalized or "practical" in normalized:
            return ["real-world scenario", "decision or process", "reflection"]
        if "exercise" in normalized or "practice" in normalized:
            return ["guided attempt", "feedback", "independent try"]
        if "assessment" in normalized or "quiz" in normalized:
            return ["quick check", "mistake analysis", "mastery decision"]
        if "revision" in normalized or "summary" in normalized:
            return ["key ideas", "common mistakes", "next concept"]
        return ["meaning and purpose", "how it works", "worked example"]

    def _build_resume_snapshot(
        self,
        session: ClassroomSession,
        lesson_data: dict[str, Any],
        config: ClassroomConfig,
        intent: str,
        student_input: str,
    ) -> dict[str, Any]:
        current_stage = lesson_data.get("current_stage", "greeting")
        stage_index = _LESSON_STAGES.index(current_stage) if current_stage in _LESSON_STAGES else 0
        return {
            "lesson_id": session.id,
            "session_id": session.id,
            "concept_id": lesson_data.get("last_taught_concept") or current_stage,
            "topic": session.topic,
            "subject": config.topic or session.topic,
            "current_stage": current_stage,
            "current_step": self._safe_int(lesson_data.get("current_step"), stage_index),
            "stage_index": stage_index,
            "paragraph_index": self._safe_int(lesson_data.get("paragraph_index"), 0),
            "explanation_position": lesson_data.get(
                "explanation_position",
                {
                    "stage": current_stage,
                    "segment": lesson_data.get("last_taught_concept") or current_stage,
                    "char_offset": len(str(lesson_data.get("last_teacher_response", ""))),
                },
            ),
            "visualization_state": lesson_data.get(
                "visualization_state",
                {
                    "stage": current_stage,
                    "concept": lesson_data.get("last_taught_concept") or session.topic,
                    "mode": "auto",
                },
            ),
            "quiz_state": lesson_data.get("quiz_state", {}),
            "language": config.language,
            "voice_state": lesson_data.get(
                "voice_state",
                {"language": config.language, "speaking": False, "rate": 1.0},
            ),
            "progress_percent": lesson_data.get("progress_percent", self._calculate_progress(current_stage, len(_LESSON_STAGES))),
            "concepts_covered": lesson_data.get("concepts_covered", []),
            "pending_concepts": lesson_data.get("pending_concepts", []),
            "context_summary": lesson_data.get("context_summary", ""),
            "student_input": student_input,
            "interruption_type": intent,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    async def _resume_from_snapshot(
        self,
        session: ClassroomSession,
        lesson_data: dict[str, Any],
        config: ClassroomConfig,
    ) -> dict[str, Any]:
        snapshot = dict(lesson_data.get("resume_snapshot") or {})
        if not snapshot:
            snapshot = self._build_resume_snapshot(session, lesson_data, config, "resume", "continue")

        stage = str(snapshot.get("current_stage") or lesson_data.get("current_stage") or "greeting")
        if stage not in _LESSON_STAGES:
            stage = "greeting"
        stage_index = _LESSON_STAGES.index(stage)

        lesson_data["current_stage"] = stage
        lesson_data["current_step"] = self._safe_int(snapshot.get("current_step"), stage_index)
        lesson_data["progress_percent"] = snapshot.get("progress_percent", self._calculate_progress(stage, len(_LESSON_STAGES)))
        lesson_data["visualization_state"] = snapshot.get("visualization_state", lesson_data.get("visualization_state", {}))
        lesson_data["quiz_state"] = snapshot.get("quiz_state", lesson_data.get("quiz_state", {}))
        lesson_data["voice_state"] = snapshot.get("voice_state", lesson_data.get("voice_state", {}))
        lesson_data["is_paused"] = False
        lesson_data["interrupted"] = False
        lesson_data["interruption_type"] = None
        lesson_data["last_resume_snapshot"] = snapshot

        session.current_stage = stage_index
        session.lesson_data = lesson_data
        resume_content = await self._generate_resume_content(session, config, lesson_data, snapshot)
        lesson_data["last_teacher_response"] = resume_content
        lesson_data["context_summary"] = (
            f"{lesson_data.get('context_summary', '')}\nTeacher resumed ({stage}): {resume_content}"
        )
        session.lesson_data = lesson_data
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)

        return {
            "session_id": session.id,
            "type": "lesson_resumed",
            "stage": stage,
            "progress_percent": lesson_data.get("progress_percent", 0.0),
            "content": resume_content,
            "concepts_covered": lesson_data.get("concepts_covered", []),
            "pending_concepts": lesson_data.get("pending_concepts", []),
            "next_stage": _LESSON_STAGES[min(stage_index + 1, len(_LESSON_STAGES) - 1)],
            "resume_lesson": False,
            "resume_snapshot": snapshot,
        }

    async def _generate_resume_content(
        self,
        session: ClassroomSession,
        config: ClassroomConfig,
        lesson_data: dict[str, Any],
        snapshot: dict[str, Any],
    ) -> str:
        profile = await self._load_or_create_profile(session.user_id)
        system_prompt = TeacherPersona.build_system_prompt(config.model_dump(), profile.to_dict(), lesson_data)
        user_message = (
            "Resume the autonomous lesson from the saved snapshot. "
            "Do not restart the lesson and do not jump to a new stage. "
            "Acknowledge the doubt is handled, then continue from the saved stage and segment. "
            f"Saved snapshot: {json.dumps(snapshot, ensure_ascii=False)}"
        )
        try:
            return await self.gateway.chat(
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                task_type="ai_tutor",
                temperature=0.35,
                max_output_tokens=700,
                request_timeout_seconds=20,
            )
        except Exception as exc:
            logger.warning("Tutor resume generation failed, using fallback: %s", exc)
            return self._fallback_resume_response(session.topic, str(snapshot.get("current_stage") or "lesson"), config)

    @staticmethod
    def _fallback_interruption_response(intent: str, student_input: str, topic: str, config: ClassroomConfig) -> str:
        if config.language == "te":
            return (
                f"సరే, మీ సందేహం సహజమే. {topic} లో ఈ భాగాన్ని ఇంకా సులభంగా చూస్తాం. "
                "ఒక చిన్న ఉదాహరణతో మొదలు పెట్టండి: మొదట భావం ఏమిటి, తరువాత అది ఎలా పని చేస్తుంది, చివరగా ఒక ప్రశ్నతో చూసుకుందాం. "
                "ఇప్పుడు స్పష్టంగా ఉందా? స్పష్టంగా ఉంటే కొనసాగిద్దాం అని చెప్పండి."
            )
        if intent == "quiz":
            return f"Quick check on {topic}: can you explain the main idea in one sentence and give one real-life example?"
        if intent == "summary":
            return f"So far in {topic}, focus on the definition, one simple example, and the reason it matters. Say continue when you are ready."
        if intent == "slower":
            return f"Let's slow down. {topic} becomes easier when we handle one idea at a time: meaning first, example second, practice third."
        return (
            f"Good doubt. For {topic}, let's make it simpler: first understand the core meaning, "
            "then connect it to one everyday example, then try one tiny practice step. "
            "Is it clear now? Say continue when you are ready to resume."
        )

    @staticmethod
    def _fallback_resume_response(topic: str, stage: str, config: ClassroomConfig) -> str:
        if config.language == "te":
            return f"సరే, మనం ఆగిన చోటు నుంచే కొనసాగిద్దాం. ఇప్పుడు {topic} లో {stage} భాగాన్ని మళ్లీ కొనసాగిస్తున్నాం."
        return f"Great, let's continue exactly where we paused in {topic}. We are resuming the {stage.replace('_', ' ')} part now."

    async def _create_session(self, user_id: str, topic: str, config: ClassroomConfig) -> ClassroomSession:
        for attempt in range(5):
            try:
                session = ClassroomSession(
                    user_id=user_id,
                    title=f"Lesson: {topic}",
                    topic=topic[:180],
                    config=config.model_dump(),
                    current_stage=0,
                    lesson_data={},
                    completed=False,
                )
                self.db.add(session)
                await self.db.flush()
                return session
            except OperationalError as exc:
                if "database is locked" in str(exc).lower() and attempt < 4:
                    await asyncio.sleep(min(0.05 * (attempt + 1), 0.3))
                    continue
                raise
        raise RuntimeError("Failed to create classroom session")

    async def _get_session(self, session_id: str, user_id: str) -> ClassroomSession | None:
        result = await self.db.execute(
            select(ClassroomSession).where(
                ClassroomSession.id == session_id,
                ClassroomSession.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def _load_or_create_profile(self, user_id: str) -> StudentProfile:
        result = await self.db.execute(
            select(ClassroomProgress).where(ClassroomProgress.user_id == user_id)
        )
        progress = result.scalar_one_or_none()
        if not progress:
            progress = ClassroomProgress(user_id=user_id)
            self.db.add(progress)
            await self.db.flush()

        return StudentProfile(
            user_id=user_id,
            weak_topics=list(progress.weak_topics or []),
            strong_topics=list(progress.strong_topics or []),
            completed_lessons=list(progress.topics_completed or []),
            streak_days=progress.streak or 0,
            last_active_date=progress.last_active_date.isoformat() if progress.last_active_date else None,
        )

    def _build_prerequisite_lesson(self, topic: str, missing: list[str], config: ClassroomConfig) -> GeneratedLesson:
        return GeneratedLesson(
            title=f"Prerequisites for {topic}",
            subject=config.topic or topic,
            difficulty="Foundational",
            estimated_minutes=max(10, len(missing) * 8),
            learning_objectives=[f"Master {item} before continuing to {topic}" for item in missing],
            outline=[
                LessonOutlineItem(
                    step=index,
                    title=f"Foundation: {prerequisite}",
                    content=f"Learn {prerequisite} with a short definition, simple example, visual explanation, quick practice, and doubt check.",
                    minutes=8,
                    visual_script=[{"type": "mindmap", "label": prerequisite, "children": [topic], "color": "#38bdf8"}],
                )
                for index, prerequisite in enumerate(missing, start=1)
            ],
            key_concepts=missing,
            completed_topics=[],
            remaining_topics=missing + [topic.lower()],
        )

    def _build_greeting(self, config: ClassroomConfig, profile: StudentProfile, topic: str) -> str:
        language = config.language
        if language == "te":
            return f"నమస్కారం! నేను మీ AI ట్యూటర్. మీరు నేర్చుకోవాలనుకుంటున్న {topic} గురించి మాట్లాడాం. మీరు ఇప్పటికీ ఏమి తెలుసుకున్నారో చెప్పండి, అలాగే నేను మీకు అనుకూలంగా నేర్చిస్తాను!"
        elif language == "bilingual":
            return f"Hello! I'm your AI Tutor. Let's learn {topic} together! నమస్కారం! {topic} గురించి మాట్లాడాం. Tell me what you already know, and I'll personalize the lesson for you!"
        else:
            return f"Hello! I'm your AI Tutor, and I'm excited to help you master {topic}! Before we begin, tell me: what do you already know about this topic? Don't worry if you're starting from scratch - that's what I'm here for!"

    async def _generate_stage_content(
        self, session: ClassroomSession, stage: str, config: ClassroomConfig | None
    ) -> str:
        lesson_data = dict(session.lesson_data or {})
        config = config or ClassroomConfig.model_validate(session.config or {})
        profile = await self._load_or_create_profile(session.user_id)

        system_prompt = TeacherPersona.build_system_prompt(
            config.model_dump(), profile.to_dict(), lesson_data
        )

        user_message = TeacherPersona.build_user_message(
            topic=session.topic,
            stage=stage,
            context={
                "context_summary": lesson_data.get("context_summary", ""),
                "concepts_covered": lesson_data.get("concepts_covered", []),
                "pending_concepts": lesson_data.get("pending_concepts", []),
                "last_taught_concept": lesson_data.get("last_taught_concept"),
            },
        )

        try:
            raw = await self.gateway.chat(
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                task_type="ai_tutor",
                temperature=0.4,
                max_output_tokens=1200,
            )
            content = self._parse_teaching_response(raw, stage, session.topic)
        except Exception as exc:
            logger.warning("Tutor brain stage generation failed: %s", exc)
            content = self._fallback_stage_content(stage, session.topic, config)

        return content

    def _parse_teaching_response(self, raw: str, stage: str, topic: str) -> str:
        # Return only the raw content as a string
        return raw.strip()

    def _fallback_stage_content(self, stage: str, topic: str, config: ClassroomConfig) -> str:
        is_te = config.language == "te"
        fallbacks = {
            "greeting": "నమస్కారం! పాఠం ప్రారంభిద్దాం." if is_te else f"Hello! Let's start our lesson on {topic}.",
            "learning_objective": "ఈ పాఠంలో మనం ముఖ్యమైన విషయాలు నేర్చుకుందాం." if is_te else f"In this lesson, we will cover the core concepts of {topic}.",
            "concept_explanation": f"{topic} గురించి నేర్చుకుందాం." if is_te else f"Let's dive into {topic}.",
            "summary": "ఈ రోజు పాఠం చాలా బాగా జరిగింది!" if is_te else f"Great job today! We've covered the basics of {topic}.",
        }
        return fallbacks.get(stage, "పాఠం కొనసాగిద్దాం." if is_te else f"Let's continue learning about {topic}.")

    def _persona_response(
        self,
        config: ClassroomConfig,
        profile: StudentProfile,
        lesson_state: dict[str, Any],
        content: str,
    ) -> str:
        language = config.language
        if language == "te":
            return f"నమస్కారం! {content}"
        if language == "bilingual":
            return f"Hello! {content}\n\nనమస్కారం! మనం కలిసి నేర్చుకుందాం!"
        return content

    def _calculate_progress(self, current_stage: str, total_steps: int) -> float:
        try:
            index = _LESSON_STAGES.index(current_stage)
            return round((index / max(1, total_steps)) * 100, 1)
        except ValueError:
            return 0.0

    def _generate_roadmap(self, topic: str, config: ClassroomConfig) -> dict[str, Any]:
        mode = config.learning_mode
        if mode == "competitive_exam":
            return self.roadmap_generator.generate_certification_roadmap(topic, "Exam Preparation", config.level)
        if mode == "interview":
            return self.roadmap_generator.generate_interview_roadmap(topic, "Job Interview", config.level)
        if mode == "programming":
            return self.roadmap_generator.generate_project_roadmap(topic, "Coding Project", config.level)
        if mode == "professional_certification":
            return self.roadmap_generator.generate_certification_roadmap(topic, "Professional Certification", config.level)
        return self.roadmap_generator.generate_skill_roadmap(topic, config.learning_mode, config.level)

    def _build_completion_message(self, session: ClassroomSession) -> str:
        lesson_data = dict(session.lesson_data or {})
        topic = session.topic
        covered = lesson_data.get("concepts_covered", [])
        return (
            f"Congratulations! You've completed your lesson on {topic}. "
            f"You covered {len(covered)} concepts today. "
            "Keep up the great work, and remember: every small step leads to big achievements! "
            "Would you like to continue with a related topic or take a break?"
        )

    async def _simulate_student_engagement(self, result: dict[str, Any]) -> None:
        await asyncio.sleep(0.1)
