from sqlalchemy import or_, select

from app.models.agent import AgentConfig
from app.repositories.base import BaseRepository


class AgentRepository(BaseRepository[AgentConfig]):
    model = AgentConfig

    async def list_available(self, user_id: str) -> list[AgentConfig]:
        result = await self.db.execute(
            select(AgentConfig)
            .where(or_(AgentConfig.user_id == user_id, AgentConfig.is_public.is_(True)))
            .order_by(AgentConfig.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_available(self, agent_id: str, user_id: str) -> AgentConfig | None:
        result = await self.db.execute(
            select(AgentConfig).where(
                AgentConfig.id == agent_id,
                or_(AgentConfig.user_id == user_id, AgentConfig.is_public.is_(True)),
            )
        )
        return result.scalar_one_or_none()

