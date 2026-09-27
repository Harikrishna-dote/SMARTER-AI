from fastapi import APIRouter, Depends

from app.application.orchestrator import AIOrchestrator
from app.core.deps import get_current_user, get_orchestrator
from app.models.user import User
from app.schemas.learning import URLContextRequest, URLContextResponse
from app.services.source_service import SourceService


router = APIRouter()


@router.post("/sources/url", response_model=URLContextResponse)
async def extract_url_context(
    payload: URLContextRequest,
    current_user: User = Depends(get_current_user),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    return await orchestrator.source_service.extract_url_context(str(payload.url))
