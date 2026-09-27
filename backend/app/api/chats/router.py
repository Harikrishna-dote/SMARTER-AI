import json

from fastapi import APIRouter, Depends, Query, Response, WebSocket, WebSocketDisconnect
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import StreamingResponse

from app.application.orchestrator import AIOrchestrator
from app.core.database import AsyncSessionLocal, get_db
from app.core.deps import get_current_user, get_orchestrator
from app.models.user import User
from app.repositories.users import UserRepository
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ConversationCreate,
    ConversationRead,
    MessageRead,
)
from app.security.jwt import decode_access_token
from app.services.chat_service import ChatService


router = APIRouter()


@router.post("/conversations", response_model=ConversationRead, status_code=201)
async def create_conversation(
    payload: ConversationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    return await orchestrator.chat_service.create_conversation(current_user.id, payload.title)


@router.get("/conversations", response_model=list[ConversationRead])
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    return await orchestrator.chat_service.conversations.list_for_user(current_user.id)


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageRead])
async def list_messages(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    service = orchestrator.chat_service
    conversation = await service.conversations.get_for_user(conversation_id, current_user.id)
    if not conversation:
        return []
    return await service.messages.list_for_conversation(conversation_id)


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    await orchestrator.chat_service.delete_conversation(current_user.id, conversation_id)
    return Response(status_code=204)


@router.post("/conversations/{conversation_id}/messages", response_model=ChatResponse)
async def send_message(
    conversation_id: str,
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    message = await orchestrator.chat_service.send(current_user.id, conversation_id, payload)
    return ChatResponse(conversation_id=conversation_id, message=message)


@router.post("/conversations/{conversation_id}/stream")
async def stream_message(
    conversation_id: str,
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    orchestrator: AIOrchestrator = Depends(get_orchestrator),
):
    service = orchestrator.chat_service

    async def event_stream():
        async for event in service.stream_send(current_user.id, conversation_id, payload):
            if event["type"] == "done":
                event["message"] = MessageRead.model_validate(event["message"]).model_dump(mode="json")
            yield json.dumps(event, ensure_ascii=False) + "\n"

    return StreamingResponse(
        event_stream(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Content-Encoding": "identity",
            "X-Accel-Buffering": "no",
        },
    )


@router.websocket("/ws/{conversation_id}")
async def websocket_chat(websocket: WebSocket, conversation_id: str, token: str = Query("")):
    await websocket.accept()
    async with AsyncSessionLocal() as db:
        try:
            payload = decode_access_token(token)
            user = await UserRepository(db).get(payload["sub"])
            if not user:
                await websocket.close(code=4401)
                return
        except (JWTError, KeyError):
            await websocket.close(code=4401)
            return

        orchestrator = AIOrchestrator(db)
        # Manually ensure the gateway is initialized if needed
        # In current design, AIOrchestrator creates AIGateway in __init__
        service = orchestrator.chat_service
        try:
            while True:
                text = await websocket.receive_text()
                message = await service.send(user.id, conversation_id, ChatRequest(message=text))
                await websocket.send_json(MessageRead.model_validate(message).model_dump(mode="json"))
        except WebSocketDisconnect:
            return
