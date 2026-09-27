from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent import AgentConfig
from app.repositories.agents import AgentRepository
from app.schemas.agent import AgentCreate
from app.services.ai_gateway import AIGateway
from app.services.tool_service import ToolService


class AgentService:
    def __init__(self, db: AsyncSession, gateway: AIGateway | None = None):
        self.db = db
        self.repo = AgentRepository(db)
        self.gateway = gateway or AIGateway()
        self.tools = ToolService()

    async def create(self, user_id: str, payload: AgentCreate) -> AgentConfig:
        return await self.repo.add(AgentConfig(user_id=user_id, **payload.model_dump()))

    async def run(self, user_id: str, agent_id: str, task: str) -> tuple[str, list[dict]]:
        agent = await self.repo.get_available(agent_id, user_id)
        if not agent:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
        tool_specs = self.tools.openai_compatible_specs(agent.tools)
        output = await self.gateway.chat(
            [
                {"role": "system", "content": agent.system_prompt},
                {"role": "user", "content": task},
            ],
            tools=tool_specs,
        )
        return output, []

