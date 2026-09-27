"""AI Brain adapter for the existing AIOrchestrator.

This module integrates the new AI Brain architecture with the existing
AIOrchestrator, allowing gradual migration without breaking existing code.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from app.application.ai_brain.brain import AIBrain
from app.application.ai_brain.rag import RAGPipeline
from app.application.ai_brain.registry import AgentRegistry
from app.application.ai_brain.reviewer import SelfReviewEngine
from app.domain.ai_brain import AgentCapability


class AIBrainAdapter:
    """Adapts the existing AIOrchestrator to use the AI Brain architecture."""

    def __init__(self, orchestrator: Any) -> None:
        self.orchestrator = orchestrator
        self.brain = AIBrain(
            registry=self._build_registry(),
            rag_pipeline=RAGPipeline(
                vector_service=getattr(orchestrator, "vector_service", None),
                knowledge_graph=getattr(orchestrator, "knowledge_graph", None),
                source_service=getattr(orchestrator, "source_service", None),
                document_service=getattr(orchestrator, "document_service", None),
            ),
        )

    def _build_registry(self) -> AgentRegistry:
        registry = AgentRegistry()
        agents = getattr(self.orchestrator, "_agents", {})
        for name, agent in agents.items():
            capability = self._map_agent_to_capability(name)
            if capability:
                registry.register(capability, plugin=_AgentWrapper(agent, capability))
        return registry

    def _map_agent_to_capability(self, name: str) -> AgentCapability | None:
        mapping = {
            "lesson_planner": AgentCapability.LESSON_PLANNING,
            "LessonPlannerAgent": AgentCapability.LESSON_PLANNING,
            "tutor": AgentCapability.TEACHING,
            "TutorAgent": AgentCapability.TEACHING,
            "memory": AgentCapability.MEMORY,
            "MemoryAgent": AgentCapability.MEMORY,
            "voice": AgentCapability.VOICE,
            "VoiceAgent": AgentCapability.VOICE,
            "translation": AgentCapability.TRANSLATION,
            "TranslationAgent": AgentCapability.TRANSLATION,
            "ocr": AgentCapability.OCR,
            "OCRAgent": AgentCapability.OCR,
            "rag": AgentCapability.KNOWLEDGE_RETRIEVAL,
            "RAGAgent": AgentCapability.KNOWLEDGE_RETRIEVAL,
            "notes": AgentCapability.NOTES,
            "NotesAgent": AgentCapability.NOTES,
            "quiz": AgentCapability.QUIZ,
            "QuizAgent": AgentCapability.QUIZ,
            "homework": AgentCapability.HOMEWORK,
            "HomeworkAgent": AgentCapability.HOMEWORK,
            "progress": AgentCapability.PROGRESS,
            "ProgressAgent": AgentCapability.PROGRESS,
            "recommendation": AgentCapability.RECOMMENDATION,
            "RecommendationAgent": AgentCapability.RECOMMENDATION,
            "analytics": AgentCapability.ANALYTICS,
            "AnalyticsAgent": AgentCapability.ANALYTICS,
        }
        return mapping.get(name)

    async def process(self, intent: str, context: dict[str, Any]) -> dict[str, Any]:
        return await self.brain.process_request(intent, context)

    async def chat(self, messages: list[dict[str, str]], **kwargs: Any) -> str:
        return await self.orchestrator.chat(messages, **kwargs)

    async def stream_chat(self, messages: list[dict[str, str]], **kwargs: Any) -> Any:
        async for chunk in self.orchestrator.stream_chat(messages, **kwargs):
            yield chunk

    async def embed(self, text: str) -> list[float]:
        return await self.orchestrator.embed(text)

    async def run_agent(self, agent_name: str, payload: dict[str, Any]) -> Any:
        return await self.orchestrator.run_agent(agent_name, payload)

    async def run_parallel(self, tasks: list[tuple[str, dict[str, Any]]]) -> list[Any]:
        return await self.orchestrator.run_parallel(tasks)

    async def run_multi_agent(self, tasks: list[dict[str, Any]]) -> dict[str, Any]:
        return await self.orchestrator.run_multi_agent(tasks)

    @property
    def gateway(self):
        return self.orchestrator.gateway

    @property
    def knowledge_graph(self):
        return self.orchestrator.knowledge_graph

    @property
    def memory_service(self):
        return self.orchestrator.memory_service

    @property
    def vector_service(self):
        return self.orchestrator.vector_service

    @property
    def classroom_service(self):
        return self.orchestrator.classroom_service

    @property
    def chat_service(self):
        return self.orchestrator.chat_service

    @property
    def document_service(self):
        return self.orchestrator.document_service

    @property
    def source_service(self):
        return self.orchestrator.source_service

    @property
    def translation_engine(self):
        return self.orchestrator.translation_engine

    @property
    def vision_service(self):
        return self.orchestrator.vision_service

    @property
    def voice_service(self):
        return self.orchestrator.voice_service

    @property
    def agent_service(self):
        return self.orchestrator.agent_service

    @property
    def tool_service(self):
        return self.orchestrator.tool_service


class _AgentWrapper:
    """Wraps existing agents to conform to the new AgentPlugin interface."""

    def __init__(self, agent: Any, capability_name: str) -> None:
        self._agent = agent
        self.capability = capability_name
        self.name = getattr(agent, "name", capability_name)
        self.description = getattr(agent, "description", "")

    async def execute(self, step: Any, context: dict[str, Any]) -> dict[str, Any]:
        payload = {**step.input, "context": context}
        result = await self._agent.execute(context.get("user_id"), payload)
        if hasattr(result, "to_dict"):
            return result.to_dict()
        if isinstance(result, BaseModel):
            return result.model_dump(mode="json")
        if isinstance(result, dict):
            return result
        if isinstance(result, list):
            return {"items": result}
        return {"output": str(result)}

    async def validate(self, step: Any) -> bool:
        return True

    async def health_check(self) -> bool:
        return True
