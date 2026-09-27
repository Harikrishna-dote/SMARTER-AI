from fastapi import APIRouter, Depends, File, Query, UploadFile

from app.application.orchestrator import AIOrchestrator
from app.core.deps import get_current_user, get_orchestrator
from app.models.user import User
from app.schemas.vision import ImageAnalysisResponse, MediaContextResponse, OCRResponse


router = APIRouter()


@router.post("/ocr", response_model=OCRResponse)
async def ocr(file: UploadFile = File(...), current_user: User = Depends(get_current_user), orchestrator: AIOrchestrator = Depends(get_orchestrator)):
    return OCRResponse(text=await orchestrator.vision_service.ocr(file))


@router.post("/analyze", response_model=ImageAnalysisResponse)
async def analyze_image(file: UploadFile = File(...), current_user: User = Depends(get_current_user), orchestrator: AIOrchestrator = Depends(get_orchestrator)):
    description = await orchestrator.vision_service.analyze(file)
    return ImageAnalysisResponse(description=description)


@router.post("/media-context", response_model=MediaContextResponse)
async def media_context(file: UploadFile = File(...), current_user: User = Depends(get_current_user), orchestrator: AIOrchestrator = Depends(get_orchestrator)):
    return await orchestrator.vision_service.media_context(file)
