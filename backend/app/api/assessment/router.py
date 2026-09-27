from fastapi import APIRouter, Depends

from app.application.assessment_engine import AssessmentEngine
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.assessment import AssessmentPlanRequest, AssessmentPlanResponse


router = APIRouter()


@router.post("/plan", response_model=AssessmentPlanResponse)
async def create_assessment_plan(
    payload: AssessmentPlanRequest,
    current_user: User = Depends(get_current_user),
) -> AssessmentPlanResponse:
    return AssessmentEngine().create_plan(payload)
