import json
from hashlib import sha256

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.application.memory_engine import MemoryEngine
from app.domain.memory import MemoryLayer, should_store_conversation_memory
from app.models.memory import MemoryItem
from app.repositories.memory import MemoryRepository
from app.schemas.memory import MemoryCreate
from app.schemas.chat import TutorProfile
from app.services.knowledge_graph_service import KnowledgeGraphService


class MemoryService:
    def __init__(self, db: AsyncSession):
        self.repo = MemoryRepository(db)
        self.engine = MemoryEngine(self.repo, KnowledgeGraphService())

    async def list_memories(self, user_id: str) -> list[MemoryItem]:
        return await self.repo.list_for_user(user_id)

    async def remember(self, user_id: str, payload: MemoryCreate) -> MemoryItem:
        return await self.repo.add(
            MemoryItem(user_id=user_id, key=payload.key, value=payload.value, source=payload.source)
        )

    async def delete_memory(self, user_id: str, memory_id: str) -> None:
        item = await self.repo.get_for_user(memory_id, user_id)
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Memory not found")
        await self.repo.delete(item)

    async def stage_learning_profile(self, user_id: str, profile: TutorProfile) -> MemoryItem:
        return await self.engine.stage_learning_profile(user_id, profile)

    async def relevant_context(self, user_id: str, query: str) -> str:
        context = await self.engine.build_retrieval_context(user_id, query)
        return context.format_for_prompt()

    async def persist_lesson_context(self, user_id: str, topic: str, context: dict) -> None:
        value = json.dumps(context, ensure_ascii=False, sort_keys=True)
        await self.engine.remember_layer(
            user_id,
            MemoryLayer.KNOWLEDGE,
            f"lesson:{topic}",
            value,
            source="classroom-tutor",
        )
        await self.repo.db.commit()

    async def persist_learning_progress(self, user_id: str, topic: str, score: float | None = None) -> None:
        try:
            await self.engine.record_learning_event(user_id, topic=topic, score=score)
            await self.repo.db.commit()
        except SQLAlchemyError:
            await self.repo.db.rollback()

    async def persist_conversation_signal(self, user_id: str, conversation_id: str, content: str) -> None:
        if not should_store_conversation_memory(content):
            return
        digest = sha256(content.strip().encode("utf-8")).hexdigest()[:12]
        await self.engine.remember_layer(
            user_id,
            MemoryLayer.CONVERSATION,
            f"{conversation_id}:{digest}",
            content.strip()[:2000],
            source="conversation-summary",
        )

    async def persist_document_memory(self, user_id: str, document_id: str, filename: str, extracted_text: str) -> None:
        snippet = " ".join((extracted_text or "").split())[:1200]
        value = json.dumps(
            {
                "filename": filename,
                "summary": snippet or "No readable text was extracted.",
                "indexed_for": ["document_rag", "knowledge_memory", "search"],
            },
            ensure_ascii=False,
            sort_keys=True,
        )
        await self.engine.remember_layer(
            user_id,
            MemoryLayer.KNOWLEDGE,
            f"document:{document_id}",
            value,
            source="document-intelligence",
        )
        await self.repo.db.commit()
