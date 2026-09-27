from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.database import get_db
from app.models.document import Document
from app.models.chat import Conversation, Message
from app.models.memory import MemoryItem
from app.models.user import User

router = APIRouter()


@router.get("", summary="Search")
async def search(q: str = Query(..., min_length=1), current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q_like = f"%{q}%"
    results: list[dict] = []

    # search documents
    doc_stmt = select(Document).where(Document.user_id == current_user.id).where(
        (Document.filename.ilike(q_like)) | (Document.extracted_text.ilike(q_like))
    )
    docs = (await db.execute(doc_stmt)).scalars().all()
    for d in docs[:10]:
        results.append({"id": d.id, "title": d.filename, "snippet": (d.extracted_text or '')[:200], "type": "document", "href": f"/documents/{d.id}"})

    memory_stmt = select(MemoryItem).where(MemoryItem.user_id == current_user.id).where(
        (MemoryItem.key.ilike(q_like)) | (MemoryItem.value.ilike(q_like))
    ).order_by(MemoryItem.updated_at.desc())
    memories = (await db.execute(memory_stmt)).scalars().all()
    for memory in memories[:8]:
        results.append({
            "id": memory.id,
            "title": memory.key,
            "snippet": (memory.value or "")[:200],
            "type": "memory",
            "href": "/memory",
        })

    # search conversations (title + latest messages)
    conv_stmt = select(Conversation).where(Conversation.user_id == current_user.id).where(Conversation.title.ilike(q_like))
    convs = (await db.execute(conv_stmt)).scalars().all()
    for c in convs[:6]:
        results.append({"id": c.id, "title": c.title or 'Conversation', "snippet": '', "type": "chat", "href": f"/chat?conversation={c.id}"})

    # fallback: search messages content
    msg_stmt = select(Message).where(Message.content.ilike(q_like)).join(Conversation).where(Conversation.user_id == current_user.id).order_by(Message.created_at.desc())
    msgs = (await db.execute(msg_stmt)).scalars().all()
    for m in msgs[:6]:
        results.append({"id": m.id, "title": f"Message in {m.conversation.title}", "snippet": (m.content or '')[:200], "type": "chat", "href": f"/chat?conversation={m.conversation_id}"})

    return {"results": results}


@router.get("/index", summary="Search index")
async def index(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Return a small index useful for client-side Fuse fallback (pages + recent docs/chats)
    items: list[dict] = []
    # pages (static)
    pages = [
        {"id": "page-dashboard", "title": "Dashboard", "type": "page", "href": "/dashboard"},
        {"id": "page-chat", "title": "Chat", "type": "page", "href": "/chat"},
        {"id": "page-translate", "title": "Translate", "type": "page", "href": "/translate"},
        {"id": "page-documents", "title": "Documents", "type": "page", "href": "/documents"},
    ]
    items.extend(pages)

    docs = (await db.execute(select(Document).where(Document.user_id == current_user.id).order_by(Document.created_at.desc()))).scalars().all()
    for d in docs[:20]:
        items.append({"id": d.id, "title": d.filename, "snippet": (d.extracted_text or '')[:200], "type": "document", "href": f"/documents/{d.id}"})

    memories = (await db.execute(select(MemoryItem).where(MemoryItem.user_id == current_user.id).order_by(MemoryItem.updated_at.desc()))).scalars().all()
    for memory in memories[:20]:
        items.append({"id": memory.id, "title": memory.key, "snippet": (memory.value or '')[:200], "type": "memory", "href": "/memory"})

    convs = (await db.execute(select(Conversation).where(Conversation.user_id == current_user.id).order_by(Conversation.created_at.desc()))).scalars().all()
    for c in convs[:20]:
        items.append({"id": c.id, "title": c.title or 'Conversation', "snippet": '', "type": "chat", "href": f"/chat?conversation={c.id}"})

    return {"items": items}
