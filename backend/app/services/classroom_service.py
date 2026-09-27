"""Classroom generation + gamified progress service.

Uses the shared AIGateway so it automatically benefits from the Gemini/Ollama
fallbacks already configured for the rest of the platform.
"""
import asyncio
import json
import logging
import re
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.utils import JSONParser
from app.application.tutor_brain import TutorBrain
from app.models.classroom import ClassroomProgress, ClassroomSession
from app.schemas.classroom import (
    Badge,
    ClassroomConfig,
    ClassroomProgressRead,
    EvaluatedItem,
    GeneratedHomework,
    GeneratedLesson,
    GeneratedNotes,
    GeneratedQuiz,
    HomeworkEvaluation,
    HomeworkTask,
    LessonOutlineItem,
    ProgressUpdate,
    QuizQuestion,
)
from app.services.ai_gateway import AIGateway
from app.services.knowledge_graph_service import KnowledgeGraphService
from app.services.memory_service import MemoryService


logger = logging.getLogger(__name__)

_LEVEL_TARGET_XP = 500  # XP required to advance one level.

_AVATAR_LABEL = {
    "male_teacher": "a friendly male teacher",
    "female_teacher": "a friendly female teacher",
    "professor": "a distinguished university professor",
    "school_teacher": "a patient school teacher",
    "friendly_mentor": "a warm, encouraging mentor",
    "kids_teacher": "a playful teacher for young children",
}
_MODE_LABEL = {
    "school": "school curriculum",
    "college": "college / undergraduate level",
    "competitive_exam": "competitive exam preparation",
    "programming": "computer programming",
    "interview": "job interview preparation",
    "language_learning": "language learning",
    "research": "academic research",
    "professional_certification": "professional certification",
}
_STYLE_LABEL = {
    "slow": "slow pace, extra repetition",
    "normal": "a normal steady pace",
    "fast": "a fast pace, minimal repetition",
    "very_detailed": "very detailed explanations with many examples",
    "quick_revision": "a quick revision style",
    "visual": "visual learning with diagrams and imagery",
    "story_based": "story-based explanations with analogies",
    "practical": "practical, real-world examples",
    "exam_oriented": "exam-oriented, focused on patterns and marks",
    "concept_based": "deep concept-based understanding",
}
_LANGUAGE_NAME = {
    "en": "English",
    "te": "Telugu",
    "bilingual": "English and Telugu",
}

_BADGE_CATALOG = [
    Badge(id="first_lesson", label="First Lesson", description="Completed your first classroom lesson."),
    Badge(id="quiz_ace", label="Quiz Ace", description="Scored 90%+ on a quiz."),
    Badge(id="homework_hero", label="Homework Hero", description="Submitted homework."),
    Badge(id="streak_3", label="On A Roll", description="Maintained a 3-day streak."),
    Badge(id="topic_master", label="Topic Master", description="Completed 5 topics."),
    Badge(id="streak_7", label="Week Warrior", description="Maintained a 7-day streak."),
]


def _persona(config: ClassroomConfig) -> str:
    avatar = _AVATAR_LABEL.get(config.avatar_type, "a friendly teacher")
    mode = _MODE_LABEL.get(config.learning_mode, "general learning")
    
    if config.teaching_style == "custom" and config.custom_style_description:
        style = config.custom_style_description
    else:
        style = _STYLE_LABEL.get(config.teaching_style, "a balanced style")
        
    language = _LANGUAGE_NAME.get(config.language, config.language)
    context = config.curriculum_context.model_dump(exclude_none=True)
    context_instruction = (
        "Use this explicitly provided curriculum context and do not replace it with a guessed board or year: "
        + ", ".join(f"{key}={value}" for key, value in context.items())
        if context
        else "The student did not specify a country, board, institution, course, class, academic year, or exam; do not claim current-board alignment."
    )
    return (
        "You are the Ultimate AI Tutor, a hyper-intelligent Pedagogical Orchestrator, Career Mentor, and empathetic study companion. "
        f"Present yourself as {avatar}. "
        "You control the classroom environment. Deliver your response as structured data followed by explanation. "
        "Format: { \"ui_action\": \"set_board_theme\", \"theme\": \"...\" , \"visual_script\": [ ... ], \"voice_mode\": \"telugu_neural | english_neural\", \"next_stage\": integer } "
        "followed by your pedagogical explanation. "
        f"Teach {mode} in {language} at {config.level} level using {style}. "
        f"Curriculum context: {context_instruction} "
        "Be proactive, continuous, and visually grounded. Use the Knowledge Graph for prerequisite validation. "
        "EMOTIONAL SUPPORT: Actively monitor student frustration or confusion. If detected, offer reassurance and pivot to a different explanation style (e.g., analogy-based). "
        "CAREER MENTORSHIP: Proactively connect concepts to real-world industry career paths, certifications, and project-based applications. "
    )


async def _generate_json(gateway: AIGateway, system: str, user: str, fallback: dict) -> dict:
    try:
        raw = await gateway.chat(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            temperature=0.4,
            max_output_tokens=1600,
            json_mode=True,
        )
        data = JSONParser.parse(raw, fallback)
        if isinstance(data, dict) and data:
            return data
        return fallback
    except Exception as exc:
        logger.warning("Classroom generation failed, using fallback: %s", exc)
        return fallback


class ClassroomService:
    def __init__(self, db: AsyncSession, gateway: AIGateway | None = None):
        self.db = db
        self.gateway = gateway or AIGateway()
        self.kg = KnowledgeGraphService()
        self.tutor_orchestrator = TutorBrain(db, self.gateway)

    async def start_autonomous_lesson(self, config: ClassroomConfig, topic: str, user_id: str) -> dict[str, Any]:
        result = await self.tutor_orchestrator.start_autonomous_lesson(config, topic, user_id)
        return result

    async def continue_lesson(self, session_id: str, user_id: str, student_input: str | None = None, config: ClassroomConfig | None = None) -> dict[str, Any]:
        return await self.tutor_orchestrator.continue_lesson(session_id, user_id, student_input, config)

    async def stream_autonomous_lesson(self, session_id: str, user_id: str, config: ClassroomConfig):
        async for chunk in self.tutor_orchestrator.stream_autonomous_lesson(session_id, user_id, config):
            yield chunk

    async def get_lesson_state(self, session_id: str, user_id: str) -> dict[str, Any] | None:
        return await self.tutor_orchestrator.get_lesson_state(session_id, user_id)

    async def get_lesson_config(self, session_id: str, user_id: str) -> ClassroomConfig | None:
        state = await self.tutor_orchestrator.get_lesson_state(session_id, user_id)
        if not state or "config" not in state:
            return None
        from app.schemas.classroom import ClassroomConfig
        return ClassroomConfig.model_validate(state["config"])

    async def pause_lesson(self, session_id: str, user_id: str) -> bool:
        return await self.tutor_orchestrator.pause_lesson(session_id, user_id)

    async def resume_lesson(self, session_id: str, user_id: str) -> dict[str, Any] | None:
        return await self.tutor_orchestrator.resume_lesson(session_id, user_id)

    async def change_topic(self, session_id: str, user_id: str, new_topic: str, config: ClassroomConfig) -> dict[str, Any]:
        return await self.tutor_orchestrator.change_topic(session_id, user_id, new_topic, config)

    async def generate_lesson(self, config: ClassroomConfig, topic: str, user_id: str) -> GeneratedLesson:
        progress = await self._get_or_create_progress(user_id)
        return await self.tutor_orchestrator.generate_lesson(
            config=config,
            topic=topic,
            user_id=user_id,
            completed_topics=progress.topics_completed or [],
            weak_topics=progress.weak_topics or [],
            strong_topics=progress.strong_topics or [],
        )

    # ----- Generation helpers -----

    async def generate_quiz(self, config: ClassroomConfig, topic: str, count: int, types: list[str]) -> GeneratedQuiz:
        system = _persona(config) + " Create a classroom quiz for the student."
        user = (
            f"Topic: {topic}. Question types allowed: {', '.join(types)}. "
            "Return JSON with key 'questions' (list of {id:str, type:str, question:str, "
            "options:list[str], answer:str, explanation:str}). Generate exactly "
            f"{count} questions. Use only the allowed types."
        )
        data = await _generate_json(self.gateway, system, user, {
            "questions": [
                {
                    "id": "q1",
                    "type": "mcq",
                    "question": f"What is the main idea of {topic}?",
                    "options": ["Concept A", "Concept B", "Concept C", "Concept D"],
                    "answer": "Concept A",
                    "explanation": "Pick the core concept.",
                }
            ]
        })
        questions = [QuizQuestion(**q) for q in data.get("questions", []) if isinstance(q, dict)]
        return GeneratedQuiz(topic=topic, questions=questions[:count])

    async def generate_notes(self, config: ClassroomConfig, topic: str) -> GeneratedNotes:
        system = _persona(config) + " Summarize the lesson into study notes."
        user = (
            f"Topic: {topic}. Return JSON with keys: summary (str), key_points (list[str]), "
            "formula_sheet (list[str]), flashcards (list of {term:str, definition:str}), "
            "revision_sheet (str), mindmap (str, a simple text/ASCII mind map)."
        )
        data = await _generate_json(self.gateway, system, user, {
            "summary": f"Notes on {topic}.",
            "key_points": [f"Key idea about {topic}"],
            "formula_sheet": [],
            "flashcards": [{"term": topic, "definition": f"A short definition of {topic}."}],
            "revision_sheet": f"Revise {topic} using these notes.",
            "mindmap": f"{topic}\n ├─ Key idea\n └─ Example",
        })
        flashcards = [
            {"term": f.get("term", ""), "definition": f.get("definition", "")}
            for f in data.get("flashcards", [])
            if isinstance(f, dict)
        ]
        return GeneratedNotes(
            summary=data.get("summary", ""),
            key_points=list(data.get("key_points", [])),
            formula_sheet=list(data.get("formula_sheet", [])),
            flashcards=flashcards,
            revision_sheet=data.get("revision_sheet", ""),
            mindmap=data.get("mindmap", ""),
        )

    async def generate_homework(self, config: ClassroomConfig, topic: str, difficulty: str) -> GeneratedHomework:
        system = _persona(config) + " Create personalized homework for the student."
        user = (
            f"Topic: {topic}. Difficulty: {difficulty}. Return JSON with key 'tasks' "
            "(list of {id:str, question:str, hint:str}) and 'note' (str). Make it personalized."
        )
        data = await _generate_json(self.gateway, system, user, {
            "tasks": [{"id": "h1", "question": f"Practice problem on {topic}.", "hint": "Review the core idea first."}],
            "note": "Submit your answers for feedback.",
        })
        tasks = [HomeworkTask(**t) for t in data.get("tasks", []) if isinstance(t, dict)]
        return GeneratedHomework(
            topic=topic,
            difficulty=difficulty,
            tasks=tasks,
            note=data.get("note", ""),
        )

    async def evaluate_homework(
        self, config: ClassroomConfig, items: list[dict], topic: str = ""
    ) -> HomeworkEvaluation:
        system = _persona(config) + " Grade the student's homework honestly and kindly."
        user = (
            f"Topic: {topic or 'the lesson'}. For each item grade the student answer against the "
            "expected answer. Return JSON with key 'items' (list of {question:str, correct:bool, "
            "score:int (0-100), feedback:str}). Items:\n"
            + json.dumps(items, ensure_ascii=False)
        )
        data = await _generate_json(self.gateway, system, user, {
            "items": [
                {"question": it.get("question", ""), "correct": False, "score": 50,
                 "feedback": "Review and try again."}
                for it in items
            ]
        })
        evaluated = [EvaluatedItem(**e) for e in data.get("items", []) if isinstance(e, dict)]
        overall = round(sum(e.score for e in evaluated) / len(evaluated)) if evaluated else 0
        return HomeworkEvaluation(overall_score=overall, items=evaluated)

    # ----- Progress / gamification -----
    async def _get_or_create_progress(self, user_id: str) -> ClassroomProgress:
        last_exc: Exception | None = None
        for attempt in range(5):
            try:
                result = await self.db.execute(
                    select(ClassroomProgress).where(ClassroomProgress.user_id == user_id)
                )
                progress = result.scalar_one_or_none()
                if not progress:
                    progress = ClassroomProgress(user_id=user_id)
                    self.db.add(progress)
                    await self.db.flush()
                return progress
            except OperationalError as exc:
                last_exc = exc
                if "database is locked" in str(exc).lower() and attempt < 4:
                    await asyncio.sleep(min(0.05 * (attempt + 1), 0.3))
                    continue
                raise
        raise last_exc if last_exc else RuntimeError("Failed to load classroom progress")

    @staticmethod
    def _compute_badges(progress: ClassroomProgress) -> list[Badge]:
        earned = set(progress.badges or [])
        if progress.topics_completed and len(progress.topics_completed) >= 1:
            earned.add("first_lesson")
        if progress.quizzes_taken and progress.accuracy >= 90:
            earned.add("quiz_ace")
        if progress.homework_completed >= 1:
            earned.add("homework_hero")
        if progress.streak >= 3:
            earned.add("streak_3")
        if progress.streak >= 7:
            earned.add("streak_7")
        if progress.topics_completed and len(progress.topics_completed) >= 5:
            earned.add("topic_master")
        earned.discard("")
        progress.badges = list(earned)
        return [b for b in _BADGE_CATALOG if b.id in earned]

    async def update_progress(self, user_id: str, update: ProgressUpdate) -> ClassroomProgressRead:
        progress = await self._get_or_create_progress(user_id)
        today = date.today()
        yesterday = today - timedelta(days=1)
        if progress.last_active_date == today:
            pass
        elif progress.last_active_date == yesterday:
            progress.streak += 1
        else:
            progress.streak = 1
        progress.last_active_date = today

        progress.xp += update.xp_delta
        new_level = max(1, progress.xp // _LEVEL_TARGET_XP + 1)
        progress.level = new_level

        if update.topic:
            completed = set(progress.topics_completed or [])
            completed.add(update.topic)
            progress.topics_completed = list(completed)

        learning_score: float | None = None
        if update.action == "quiz" and update.quiz_score is not None:
            learning_score = update.quiz_score
            progress.quizzes_taken += 1
            prev_total = max(1, progress.quizzes_taken - 1)
            progress.accuracy = round((progress.accuracy * prev_total + update.quiz_score) / progress.quizzes_taken)
            if update.quiz_score >= 70 and update.topic:
                strong = set(progress.strong_topics or [])
                strong.add(update.topic)
                progress.strong_topics = list(strong)
            elif update.topic:
                weak = set(progress.weak_topics or [])
                weak.add(update.topic)
                progress.weak_topics = list(weak)
        elif update.action == "homework" and update.homework_total:
            progress.homework_completed += 1
            correct = update.homework_correct or 0
            prev_total = max(1, progress.homework_completed - 1)
            score = round(100 * correct / max(1, update.homework_total))
            learning_score = score
            progress.accuracy = round((progress.accuracy * prev_total + score) / progress.homework_completed)
            if update.topic and score < 70:
                weak = set(progress.weak_topics or [])
                weak.add(update.topic)
                progress.weak_topics = list(weak)

        badges = self._compute_badges(progress)
        self.db.add(progress)
        await self.db.commit()
        await self.db.refresh(progress)
        if update.topic:
            await MemoryService(self.db).persist_learning_progress(user_id, update.topic, learning_score)

        xp_into = progress.xp % _LEVEL_TARGET_XP
        return ClassroomProgressRead(
            xp=progress.xp,
            level=progress.level,
            xp_for_next_level=_LEVEL_TARGET_XP,
            xp_into_level=xp_into,
            streak=progress.streak,
            quizzes_taken=progress.quizzes_taken,
            homework_completed=progress.homework_completed,
            accuracy=progress.accuracy,
            topics_completed=progress.topics_completed or [],
            weak_topics=progress.weak_topics or [],
            strong_topics=progress.strong_topics or [],
            badges=badges,
            achievements=progress.achievements or [],
            last_active_date=progress.last_active_date.isoformat() if progress.last_active_date else None,
        )

    async def get_progress(self, user_id: str) -> ClassroomProgressRead:
        progress = await self._get_or_create_progress(user_id)
        badges = self._compute_badges(progress)
        xp_into = progress.xp % _LEVEL_TARGET_XP
        return ClassroomProgressRead(
            xp=progress.xp,
            level=progress.level,
            xp_for_next_level=_LEVEL_TARGET_XP,
            xp_into_level=xp_into,
            streak=progress.streak,
            quizzes_taken=progress.quizzes_taken,
            homework_completed=progress.homework_completed,
            accuracy=progress.accuracy,
            topics_completed=progress.topics_completed or [],
            weak_topics=progress.weak_topics or [],
            strong_topics=progress.strong_topics or [],
            badges=badges,
            achievements=progress.achievements or [],
            last_active_date=progress.last_active_date.isoformat() if progress.last_active_date else None,
        )

    async def update_session_state(
        self, session_id: str, current_stage: int, lesson_data: dict
    ) -> ClassroomSession:
        result = await self.db.execute(
            select(ClassroomSession).where(ClassroomSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise ValueError("Session not found")
        session.current_stage = current_stage
        session.lesson_data = lesson_data
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def save_session(
        self, user_id: str, title: str, topic: str, config: ClassroomConfig, conversation_id: str
    ) -> ClassroomSession:
        session = ClassroomSession(
            user_id=user_id,
            title=title[:180],
            topic=topic[:180],
            conversation_id=conversation_id,
            config=config.model_dump(),
            current_stage=0,
            lesson_data={},
            completed=False,
        )
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return session


__all__ = ["ClassroomService"]
