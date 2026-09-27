from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.orchestrator import AIOrchestrator
from app.core.database import get_db
from app.core.deps import get_current_user, get_orchestrator
from app.models.user import User
from app.schemas.document import DocumentChatRequest, DocumentChatResponse, DocumentRead


router = APIRouter()


@router.get("", response_model=list[DocumentRead])
async def list_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    return await orchestrator.document_service.repo.list_for_user(current_user.id)


@router.post("", response_model=DocumentRead, status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    return await orchestrator.document_service.save_upload(current_user.id, file)


@router.post("/{document_id}/chat", response_model=DocumentChatResponse)
async def chat_with_document(
    document_id: str,
    payload: DocumentChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    answer = await orchestrator.document_service.answer_question(current_user.id, document_id, payload.question)
    return DocumentChatResponse(answer=answer, document_id=document_id)

