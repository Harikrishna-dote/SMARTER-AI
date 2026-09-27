from fastapi import APIRouter, Body, Depends
from pydantic import BaseModel, Field

from app.application.orchestrator import AIOrchestrator
from app.core.deps import get_current_user, get_orchestrator
from app.models.user import User


router = APIRouter()


class BrainProcessRequest(BaseModel):
    intent: str = Field(..., min_length=1, max_length=2000)
    context: dict = Field(default_factory=dict)


class BrainProcessResponse(BaseModel):
    plan_id: str
    status: str
    response: str
    results: dict


@router.post("/process", response_model=BrainProcessResponse)
async def process_with_brain(
    payload: BrainProcessRequest,
    current_user: User = Depends(get_current_user),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
) -> BrainProcessResponse:
    result = await orchestrator.process_with_brain(
        intent=payload.intent,
        context={**payload.context, "user_id": current_user.id},
    )
    return BrainProcessResponse(
        plan_id=result.get("plan", {}).get("plan_id", ""),
        status=result.get("plan", {}).get("status", "completed"),
        response=result.get("response", ""),
        results=result.get("results", {}),
    )
