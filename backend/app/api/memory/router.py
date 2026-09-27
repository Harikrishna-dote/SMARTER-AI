from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.orchestrator import AIOrchestrator
from app.core.database import get_db
from app.core.deps import get_current_user, get_orchestrator
from app.models.user import User
from app.schemas.memory import MemoryCreate, MemoryRead


router = APIRouter()


@router.get("", response_model=list[MemoryRead])
async def list_memory(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    return await orchestrator.memory_service.list_memories(current_user.id)


@router.post("", response_model=MemoryRead, status_code=201)
async def create_memory(
    payload: MemoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    return await orchestrator.memory_service.remember(current_user.id, payload)


@router.delete("/{memory_id}", status_code=204)
async def delete_memory(
    memory_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> None:
    await orchestrator.memory_service.delete_memory(current_user.id, memory_id)
