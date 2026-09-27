from __future__ import annotations

from typing import Any, TYPE_CHECKING

from app.schemas.chat import ChatRequest
from app.schemas.classroom import ClassroomConfig
from app.schemas.translation import TranslationTextRequest
from app.services.vision_service import VisionService
from app.services.voice_service import VoiceService, detect_text_language

if TYPE_CHECKING:
    from app.application.orchestrator import AIOrchestrator


class AIAgent:
    """Specialized agent responsible for a single AI workflow."""

    name: str

    async def execute(self, user_id: str | None, payload: dict[str, Any]) -> Any:
        raise NotImplementedError


class LessonPlannerAgent(AIAgent):
    name = "lesson_planner"

    def __init__(self, orchestrator: AIOrchestrator):
        self.orchestrator = orchestrator
        self.service = orchestrator.classroom_service

    async def execute(self, user_id: str | None, payload: dict[str, Any]) -> Any:
        config = ClassroomConfig.model_validate(payload.get("config", {}))
        topic = payload.get("topic", "")
        return await self.service.generate_lesson(config, topic, user_id or "")


class TutorAgent(AIAgent):
    name = "tutor"

    def __init__(self, orchestrator: AIOrchestrator):
        self.orchestrator = orchestrator
        self.service = orchestrator.chat_service

    async def execute(self, user_id: str | None, payload: dict[str, Any]) -> Any:
        payload_model = ChatRequest.model_validate(payload)
        conversation_id = payload_model.conversation_id
        return await self.service.send(user_id or "", conversation_id, payload_model)


class MemoryAgent(AIAgent):
    name = "memory"

    def __init__(self, orchestrator: AIOrchestrator):
        self.orchestrator = orchestrator
        self.service = orchestrator.memory_service

    async def execute(self, user_id: str | None, payload: dict[str, Any]) -> Any:
        if payload.get("action") == "list":
            return await self.service.list_memories(user_id or "")
        if payload.get("action") == "remember":
            return await self.service.remember(user_id or "", payload["memory"])
        if payload.get("action") == "context":
            return await self.service.relevant_context(user_id or "", payload.get("query", ""))
        raise ValueError("Unsupported memory action")


class VoiceAgent(AIAgent):
    name = "voice"

    def __init__(self, orchestrator: AIOrchestrator):
        self.orchestrator = orchestrator
        self.service = orchestrator.voice_service

    async def execute(self, user_id: str | None, payload: dict[str, Any]) -> Any:
        action = payload.get("action", "synthesize")

        if action == "synthesize":
            return await self.service.synthesize(
                payload.get("text", ""),
                language=payload.get("language"),
            )
        if action == "synthesize_stream":
            return {
                "stream": self.service.synthesize_stream(
                    payload.get("text", ""),
                    language=payload.get("language"),
                ),
            }
        if action == "transcribe":
            return await self.service.transcribe(payload.get("file"))
        if action == "detect_language":
            text = payload.get("text", "")
            return {"language": detect_text_language(text)}
        if action == "create_lesson_session":
            return self.service.create_lesson_session(
                conversation_id=payload.get("conversation_id", ""),
                user_id=user_id or "",
                language=payload.get("language", "en"),
                segments=payload.get("segments", []),
            ).to_dict()
        if action == "pause_lesson":
            return {"paused": self.service.pause_lesson(payload.get("session_id", ""))}
        if action == "resume_lesson":
            return {"resumed": self.service.resume_lesson(payload.get("session_id", ""))}
        if action == "end_lesson":
            self.service.end_lesson(payload.get("session_id", ""))
            return {"ended": True}
        if action == "warmup":
            return await self.service.warmup()
        return {"status": "ok", "message": "Voice agent ready.", "supported_actions": [
            "synthesize", "synthesize_stream", "transcribe", "detect_language",
            "create_lesson_session", "pause_lesson", "resume_lesson", "end_lesson", "warmup"
        ]}


class TranslationAgent(AIAgent):
    name = "translation"

    def __init__(self, orchestrator: AIOrchestrator):
        self.orchestrator = orchestrator
        self.engine = orchestrator.translation_engine

    async def execute(self, user_id: str | None, payload: dict[str, Any]) -> Any:
        request = TranslationTextRequest.model_validate(payload.get("request", payload))
        return await self.engine.translate(request)



class OCRAgent(AIAgent):
    name = "ocr"

    def __init__(self, orchestrator: AIOrchestrator):
        self.orchestrator = orchestrator

    async def execute(self, user_id: str | None, payload: dict[str, Any]) -> Any:
        service = self.orchestrator.vision_service
        if payload.get("action") == "analyze":
            return await service.analyze(payload.get("file"))
        if payload.get("action") == "media_context":
            return await service.media_context(payload.get("file"))
        return await service.ocr(payload.get("file"))


class RAGAgent(AIAgent):
    name = "rag"

    def __init__(self, orchestrator: AIOrchestrator):
        self.orchestrator = orchestrator
        self.service = orchestrator.source_service

    async def execute(self, user_id: str | None, payload: dict[str, Any]) -> Any:
        query = payload.get("query", "")
        if not query:
            raise ValueError("RAG query is required")

        context_snippets = []
        if self.orchestrator.vector_service.available:
            search_results = await self.orchestrator.vector_service.search(query, user_id=user_id)
            context_snippets.extend(result.get("payload", {}).get("text", "") for result in search_results)

        if payload.get("source_url"):
            context = await self.service.extract_url_context(payload["source_url"])
            context_snippets.append(context.get("summary", ""))

        content = "\n\n".join([snippet for snippet in context_snippets if snippet])
        prompt = f"Answer the query using the retrieved context.\n\nContext:\n{content}\n\nQuery:\n{query}" if content else query
        return await self.orchestrator.chat(
            [
                {"role": "system", "content": "You are a retrieval-augmented tutor using trusted context from documents and web sources."},
                {"role": "user", "content": prompt},
            ],
        )


class NotesAgent(AIAgent):
    name = "notes"

    def __init__(self, orchestrator: AIOrchestrator):
        self.service = orchestrator.classroom_service

    async def execute(self, user_id: str | None, payload: dict[str, Any]) -> Any:
        config = ClassroomConfig.model_validate(payload.get("config", {}))
        return await self.service.generate_notes(config, payload.get("topic", ""))


class QuizAgent(AIAgent):
    name = "quiz"

    def __init__(self, orchestrator: AIOrchestrator):
        self.service = orchestrator.classroom_service

    async def execute(self, user_id: str | None, payload: dict[str, Any]) -> Any:
        config = ClassroomConfig.model_validate(payload.get("config", {}))
        return await self.service.generate_quiz(config, payload.get("topic", ""), payload.get("count", 3), payload.get("types", ["mcq"]))


class HomeworkAgent(AIAgent):
    name = "homework"

    def __init__(self, orchestrator: AIOrchestrator):
        self.service = orchestrator.classroom_service

    async def execute(self, user_id: str | None, payload: dict[str, Any]) -> Any:
        config = ClassroomConfig.model_validate(payload.get("config", {}))
        if payload.get("action") == "evaluate":
            return await self.service.evaluate_homework(config, payload.get("items", []), payload.get("topic", ""))
        return await self.service.generate_homework(config, payload.get("topic", ""), payload.get("difficulty", "medium"))


class ProgressAgent(AIAgent):
    name = "progress"

    def __init__(self, orchestrator: AIOrchestrator):
        self.service = orchestrator.classroom_service

    async def execute(self, user_id: str | None, payload: dict[str, Any]) -> Any:
        if payload.get("action") == "update":
            return await self.service.update_progress(user_id or "", payload.get("update", {}))
        return await self.service.get_progress(user_id or "")


class RecommendationAgent(AIAgent):
    name = "recommendation"

    def __init__(self, orchestrator: AIOrchestrator):
        self.orchestrator = orchestrator
        self.classroom = orchestrator.classroom_service

    async def execute(self, user_id: str | None, payload: dict[str, Any]) -> Any:
        progress = await self.classroom.get_progress(user_id or "")
        return {
            "summary": f"Keep your streak going with {progress.streak} days of progress and focus on {', '.join(progress.weak_topics or []) or 'core concepts'}.",
            "recommended_topics": [payload.get("topic", "Next topic")],
        }


class AnalyticsAgent(AIAgent):
    name = "analytics"

    def __init__(self, orchestrator: AIOrchestrator):
        self.orchestrator = orchestrator

    async def execute(self, user_id: str | None, payload: dict[str, Any]) -> Any:
        progress = await self.orchestrator.classroom_service.get_progress(user_id or "")
        return {
            "user_id": user_id,
            "level": progress.level,
            "streak": progress.streak,
            "accuracy": progress.accuracy,
            "quizzes_taken": progress.quizzes_taken,
            "homework_completed": progress.homework_completed,
        }
