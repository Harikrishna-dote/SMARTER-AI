from fastapi import APIRouter

from app.application.operations_engine import OperationsEngine
from app.schemas.operations import ProductionReadinessResponse
from app.services.ai_gateway import AIGateway


router = APIRouter()


@router.get("/readiness", response_model=ProductionReadinessResponse)
async def readiness() -> ProductionReadinessResponse:
    return OperationsEngine().readiness()


@router.get("/models")
async def model_health() -> dict:
    return await AIGateway().model_health()
