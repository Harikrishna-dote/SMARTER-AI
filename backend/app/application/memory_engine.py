"""Application layer for multi-layer memory and retrieval context."""

from datetime import date, timedelta
from typing import Iterable

from app.domain.memory import (
    LearningMemoryRecord,
    MasteryState,
    MemoryLayer,
    RetrievalContext,
    canonical_memory_key,
    estimate_mastery_state,
    next_review_interval_days,
    parse_memory_layer,
)
from app.models.memory import MemoryItem
from app.repositories.memory import MemoryRepository
from app.schemas.chat import TutorProfile
from app.services.knowledge_graph_service import KnowledgeGraphService


class MemoryEngine:
    """Coordinates durable memory layers without depending on a model provider."""

    def __init__(self, repo: MemoryRepository, knowledge_graph: KnowledgeGraphService):
        self.repo = repo
        self.knowledge_graph = knowledge_graph

    async def remember_layer(
        self,
        user_id: str,
        layer: MemoryLayer,
        key: str,
        value: str,
        *,
        source: str,
    ) -> MemoryItem:
        canonical_key = canonical_memory_key(layer, key)
        existing = await self.repo.get_by_key(user_id, canonical_key)
        if existing:
            existing.value = value
            existing.source = source
            self.repo.db.add(existing)
            await self.repo.db.flush()
            return existing

        item = MemoryItem(user_id=user_id, key=canonical_key, value=value, source=source)
        self.repo.db.add(item)
        await self.repo.db.flush()
        return item

    async def stage_learning_profile(self, user_id: str, profile: TutorProfile) -> MemoryItem:
        preference_value = (
            f"language={profile.language}; teaching_mode={profile.teaching_mode}; "
            f"response_style={profile.response_style}; response_speed={profile.response_speed}"
        )
        await self.remember_layer(
            user_id,
            MemoryLayer.PREFERENCE,
            "tutor_profile",
            preference_value,
            source="auto-tutor",
        )
        return await self.remember_layer(
            user_id,
            MemoryLayer.LEARNING,
            "current_profile",
            f"subject={profile.subject}; level={profile.level}",
            source="auto-tutor",
        )

    async def record_learning_event(
        self,
        user_id: str,
        *,
        topic: str,
        score: float | None = None,
        source: str = "classroom-progress",
    ) -> MemoryItem:
        mastery = estimate_mastery_state(score)
        review_date = date.today() + timedelta(days=next_review_interval_days(mastery))
        value = (
            f"topic={topic}; mastery={mastery.value}; "
            f"score={score if score is not None else 'unknown'}; review_on={review_date.isoformat()}"
        )
        return await self.remember_layer(user_id, MemoryLayer.LEARNING, f"mastery:{topic}", value, source=source)

    async def build_retrieval_context(self, user_id: str, query: str, *, limit: int = 8) -> RetrievalContext:
        memories = await self.repo.search(user_id, query, limit=limit)
        records = tuple(self._to_record(memory) for memory in memories)
        return RetrievalContext(
            query=query,
            records=records,
            knowledge_graph_notes=tuple(self._knowledge_graph_notes(query)),
        )

    def _knowledge_graph_notes(self, query: str) -> Iterable[str]:
        topic = query.strip().lower().replace(" ", "_")
        description = self.knowledge_graph.describe_concept(topic)
        if description:
            yield f"{topic}: {description}"
        prerequisites = self.knowledge_graph.get_prerequisites(topic)
        if prerequisites:
            yield f"{topic} prerequisites: {', '.join(prerequisites)}"
            yield f"{topic} learning path: {' -> '.join(self.knowledge_graph.learning_path(topic))}"

    @staticmethod
    def _to_record(memory: MemoryItem) -> LearningMemoryRecord:
        layer = parse_memory_layer(memory.key, memory.source)
        display_key = memory.key.split(":", 1)[1] if ":" in memory.key else memory.key
        return LearningMemoryRecord(
            layer=layer,
            key=display_key,
            value=memory.value,
            source=memory.source,
            importance=0.7 if layer in {MemoryLayer.LEARNING, MemoryLayer.PREFERENCE} else 0.5,
        )
