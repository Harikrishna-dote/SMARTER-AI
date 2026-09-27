from sqlalchemy import select

from app.models.memory import MemoryItem
from app.repositories.base import BaseRepository


class MemoryRepository(BaseRepository[MemoryItem]):
    model = MemoryItem

    async def list_for_user(self, user_id: str) -> list[MemoryItem]:
        result = await self.db.execute(
            select(MemoryItem)
            .where(MemoryItem.user_id == user_id)
            .order_by(MemoryItem.updated_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_key(self, user_id: str, key: str) -> MemoryItem | None:
        result = await self.db.execute(
            select(MemoryItem).where(MemoryItem.user_id == user_id, MemoryItem.key == key)
        )
        return result.scalar_one_or_none()

    async def get_for_user(self, item_id: str, user_id: str) -> MemoryItem | None:
        result = await self.db.execute(
            select(MemoryItem).where(MemoryItem.id == item_id, MemoryItem.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def search(self, user_id: str, query: str, limit: int = 5) -> list[MemoryItem]:
        terms = [term.lower() for term in query.split() if len(term) > 2]
        memories = await self.list_for_user(user_id)
        if not terms:
            return memories[:limit]
        scored: list[tuple[int, MemoryItem]] = []
        for memory in memories:
            haystack = f"{memory.key} {memory.value} {memory.source}".lower()
            score = sum(haystack.count(term) for term in terms)
            if memory.key.startswith(("learning:", "preference:")):
                score += 1
            if score:
                scored.append((score, memory))
        return [memory for _, memory in sorted(scored, key=lambda item: item[0], reverse=True)[:limit]]
