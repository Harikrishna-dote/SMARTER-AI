from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.agent import AgentConfig
from app.models.chat import Conversation
from app.models.document import Document
from app.models.memory import MemoryItem
from app.models.user import User
from app.schemas.user import DashboardStats, UserRead


router = APIRouter()


@router.get("/me", response_model=UserRead)
async def get_profile(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.get("/dashboard", response_model=DashboardStats)
async def dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardStats:
    conversations = await db.scalar(select(func.count(Conversation.id)).where(Conversation.user_id == current_user.id))
    memories = await db.scalar(select(func.count(MemoryItem.id)).where(MemoryItem.user_id == current_user.id))
    documents = await db.scalar(select(func.count(Document.id)).where(Document.user_id == current_user.id))
    agents = await db.scalar(select(func.count(AgentConfig.id)).where(AgentConfig.user_id == current_user.id))
    return DashboardStats(
        conversations=conversations or 0,
        memories=memories or 0,
        documents=documents or 0,
        agents=agents or 0,
    )
