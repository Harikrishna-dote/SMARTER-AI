"""Central AI Orchestrator for SMARTER-AI.

The AIOrchestrator is the single entry point for all AI operations. It coordinates
13 specialized agents, manages model fallback (Ollama primary, Gemini fallback),
and owns all service instances so every user request flows through a single brain.

Agents
------
- LessonPlannerAgent  – lesson blueprint generation
- TutorAgent          – adaptive tutoring dialogue
- MemoryAgent         – durable memory operations
- VoiceAgent          – speech-to-text and text-to-speech
- TranslationAgent    – multilingual translation
- OCRAgent            – optical character recognition
- RAGAgent            – retrieval-augmented generation
- NotesAgent          – study notes synthesis
- QuizAgent           – quiz generation
- HomeworkAgent       – homework generation and evaluation
- ProgressAgent       – learning progress tracking
- RecommendationAgent – topic recommendations
- AnalyticsAgent      – learning analytics
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.orchestration.orchestrator import AIOrchestrator as ModelExecutionOrchestrator
from app.services.ai_gateway import AIGateway
from app.services.agent_service import AgentService
from app.services.chat_service import ChatService
from app.services.classroom_service import ClassroomService
from app.services.document_service import DocumentService
from app.services.knowledge_graph_service import KnowledgeGraphService
from app.services.memory_service import MemoryService
from app.services.source_service import SourceService
from app.services.tool_service import ToolService
from app.services.translation_engine import TranslationEngine
from app.services.vector_service import VectorService
from app.services.vision_service import VisionService
from app.services.voice_service import VoiceService
from app.application.agents import (
    AnalyticsAgent,
    HomeworkAgent,
    LessonPlannerAgent,
    MemoryAgent,
    NotesAgent,
    OCRAgent,
    ProgressAgent,
    QuizAgent,
    RAGAgent,
    RecommendationAgent,
    TranslationAgent,
    TutorAgent,
    VoiceAgent,
)
from app.application.ai_brain_adapter import AIBrainAdapter

logger = logging.getLogger(__name__)


class AIOrchestrator:
    """Central brain that routes every AI request through a controlled gateway.

    The orchestrator owns the model gateway, caching layer, vector search,
    and all specialized agents. Services receive ``self`` as their ``ai_client``
    so no service can bypass the orchestrator to call a model directly.
    """

    def __init__(self, db: AsyncSession, user_id: str | None = None) -> None:
        self.db = db
        self.user_id = user_id
        self.settings = get_settings()

        # Core AI gateway (Ollama primary, Gemini fallback)
        self.gateway = AIGateway()
        self.model_orchestrator = ModelExecutionOrchestrator(self.gateway)

        # Knowledge graph for prerequisite validation
        self.knowledge_graph = KnowledgeGraphService()

        # Owned services – all AI calls go through these instances
        self.memory_service = MemoryService(db)
        self.vector_service = VectorService(self.settings, embed_fn=self.embed)
        self.classroom_service = ClassroomService(db, gateway=self.gateway)
        self.chat_service = ChatService(
            db,
            gateway=self.gateway,
            orchestrator=self.model_orchestrator,
            vector_service=self.vector_service,
        )
        self.document_service = DocumentService(db, gateway=self, vector_service=self.vector_service)
        self.source_service = SourceService(gateway=self)
        self.translation_engine = TranslationEngine(db, gateway=self)
        self.vision_service = VisionService(gateway=self)
        self.voice_service = VoiceService()
        self.agent_service = AgentService(db, gateway=self)
        self.tool_service = ToolService()

        # Specialized agents
        self._agents: dict[str, Any] = {
            agent.name: agent(self)
            for agent in [
                LessonPlannerAgent,
                TutorAgent,
                MemoryAgent,
                VoiceAgent,
                TranslationAgent,
                OCRAgent,
                RAGAgent,
                NotesAgent,
                QuizAgent,
                HomeworkAgent,
                ProgressAgent,
                RecommendationAgent,
                AnalyticsAgent,
            ]
        }

        # AI Brain adapter
        self.brain = AIBrainAdapter(self)

    # ------------------------------------------------------------------
    # Raw model access (used by services and agents)
    # ------------------------------------------------------------------

    async def chat(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        tools: list[dict[str, Any]] | None = None,
        *,
        temperature: float = 0.35,
        max_output_tokens: int | None = None,
        json_mode: bool = False,
        context_window: int | None = None,
        request_timeout_seconds: int | None = None,
    ) -> str:
        """Send a chat completion request through the gateway."""
        return await self.model_orchestrator.execute_request(
            self.user_id or "",
            messages,
            model=model,
            tools=tools,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            json_mode=json_mode,
            context_window=context_window,
            request_timeout_seconds=request_timeout_seconds,
        )

    async def stream_chat(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        tools: list[dict[str, Any]] | None = None,
        *,
        temperature: float = 0.35,
        max_output_tokens: int | None = None,
        json_mode: bool = False,
        context_window: int | None = None,
        request_timeout_seconds: int | None = None,
    ) -> AsyncIterator[str]:
        """Stream a chat completion response through the gateway."""
        async for chunk in self.model_orchestrator.stream_request(
            self.user_id or "",
            messages,
            model=model,
            tools=tools,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            json_mode=json_mode,
            context_window=context_window,
            request_timeout_seconds=request_timeout_seconds,
        ):
            yield chunk

    async def embed(self, text: str) -> list[float]:
        """Return an embedding vector for the given text."""
        return await self.gateway.embed(text)

    # ------------------------------------------------------------------
    # Agent coordination
    # ------------------------------------------------------------------

    async def run_agent(self, agent_name: str, payload: dict[str, Any]) -> Any:
        """Execute a single specialized agent by name."""
        agent = self._agents.get(agent_name)
        if agent is None:
            raise ValueError(f"Unknown orchestrator agent: {agent_name}")
        return await agent.execute(self.user_id, payload)

    async def run_parallel(self, tasks: list[tuple[str, dict[str, Any]]]) -> list[Any]:
        """Execute multiple agents concurrently and return their results."""
        return await asyncio.gather(
            *(self.run_agent(name, payload) for name, payload in tasks)
        )

    async def run_multi_agent(self, tasks: list[dict[str, Any]]) -> dict[str, Any]:
        """Run independent specialist tasks concurrently with isolated outcomes.

        Each task must provide ``id``, ``agent`` and ``payload``. A failed
        specialist is reported beside successful results so callers can apply a
        deliberate fallback or surface the exact failed feature instead of
        losing the whole batch to the first exception.
        """
        if not tasks:
            return {"status": "completed", "results": {}}

        async def execute(task: dict[str, Any]) -> tuple[str, dict[str, Any]]:
            task_id = str(task.get("id") or task.get("agent") or "task")
            agent_name = str(task.get("agent") or "")
            try:
                output = await self.run_agent(agent_name, dict(task.get("payload") or {}))
                return task_id, {"agent": agent_name, "status": "completed", "output": output}
            except Exception as exc:
                logger.warning("Multi-agent task '%s' failed: %s", task_id, exc)
                return task_id, {"agent": agent_name, "status": "failed", "error": str(exc)}

        outcomes = await asyncio.gather(*(execute(task) for task in tasks))
        results = dict(outcomes)
        status = "completed" if all(item["status"] == "completed" for item in results.values()) else "partial"
        return {"status": status, "results": results}

    async def run_custom_agent(self, agent_config: Any, task: str) -> tuple[str, list[dict[str, Any]]]:
        """Run a user-defined custom agent configuration."""
        tool_specs = self.tool_service.openai_compatible_specs(getattr(agent_config, "tools", []))
        output = await self.chat(
            [
                {"role": "system", "content": getattr(agent_config, "system_prompt", "")},
                {"role": "user", "content": task},
            ],
            tools=tool_specs,
        )
        return output, []

    async def process_with_brain(self, intent: str, context: dict[str, Any]) -> dict[str, Any]:
        """Process a request through the AI Brain planning and agent coordination."""
        return await self.brain.process(intent, context)

    def run_streaming(self, agent_name: str, payload: dict[str, Any]) -> AsyncIterator[dict[str, Any]]:
        """Stream agent execution messages."""
        return self._stream_agent_messages(agent_name, payload)

    async def _stream_agent_messages(self, agent_name: str, payload: dict[str, Any]) -> AsyncIterator[dict[str, Any]]:
        result = await self.run_agent(agent_name, payload)
        yield {"type": "done", "payload": result}

    # ------------------------------------------------------------------
    # Response helpers
    # ------------------------------------------------------------------

    @staticmethod
    def as_response(content: str) -> dict[str, Any]:
        """Wrap a string output in a standard API response envelope."""
        return {"output": content}
