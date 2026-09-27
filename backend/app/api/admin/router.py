from pathlib import Path
from urllib.parse import unquote, urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import require_admin, require_role, get_current_user
from app.models.agent import AgentConfig
from app.models.chat import Conversation, Message
from app.models.classroom import ClassroomProgress
from app.models.document import Document
from app.models.ecosystem import Notification, Project, StudyGroup
from app.models.memory import MemoryItem
from app.models.user import User
from app.schemas.ecosystem import RoleUpdateRequest


router = APIRouter()
settings = get_settings()


def _path_size(path: Path) -> tuple[int, int]:
    if not path.exists():
        return 0, 0
    if path.is_file():
        return path.stat().st_size, 1
    total = 0
    files = 0
    for item in path.rglob("*"):
        if item.is_file():
            files += 1
            total += item.stat().st_size
    return total, files


def _sqlite_database_path() -> Path | None:
    for prefix in ("sqlite+aiosqlite:///", "sqlite:///"):
        if settings.database_url.startswith(prefix):
            return Path(settings.database_url.removeprefix(prefix))
    parsed = urlparse(settings.database_url)
    if parsed.scheme not in {"sqlite", "sqlite+aiosqlite"}:
        return None
    raw_path = unquote(parsed.path)
    if not raw_path:
        return None
    if raw_path.startswith("/") and len(raw_path) > 3 and raw_path[2] == ":":
        raw_path = raw_path[1:]
    return Path(raw_path)


async def _count(db: AsyncSession, column) -> int:
    return int(await db.scalar(select(func.count(column))) or 0)


@router.get("/stats")
async def platform_stats(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    upload_path = Path(settings.upload_dir)
    extracted_path = Path(settings.extracted_dir)
    database_path = _sqlite_database_path()
    upload_bytes, upload_files = _path_size(upload_path)
    extracted_bytes, extracted_files = _path_size(extracted_path)
    database_bytes, database_files = _path_size(database_path) if database_path else (0, 0)

    return {
        "users": await _count(db, User.id),
        "active_users": int(await db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0),
        "admins": int(await db.scalar(select(func.count(User.id)).where(User.is_admin.is_(True))) or 0),
        "conversations": await _count(db, Conversation.id),
        "messages": await _count(db, Message.id),
        "documents": await _count(db, Document.id),
        "memories": await _count(db, MemoryItem.id),
        "agents": await _count(db, AgentConfig.id),
        "storage": {
            "database_bytes": database_bytes,
            "database_files": database_files,
            "uploads_bytes": upload_bytes,
            "uploads_files": upload_files,
            "extracted_bytes": extracted_bytes,
            "extracted_files": extracted_files,
            "total_bytes": database_bytes + upload_bytes + extracted_bytes,
        },
        "ai": {
            "gemini_configured": bool(settings.gemini_api_key.strip()),
            "gemini_model": settings.gemini_model,
            "ollama_base_url": settings.ollama_base_url,
            "ollama_fast_model": settings.ollama_fast_model,
            "ollama_quality_model": settings.ollama_quality_model,
            "ollama_translation_model": settings.ollama_translation_model,
            "ollama_keep_alive": settings.ollama_keep_alive,
        },
        "features": {
            "auto_create_tables": settings.auto_create_tables,
            "environment": settings.environment,
        },
        "requested_by": admin.email,
    }


@router.get("/users")
async def list_users(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    role: str | None = Query(None),
    search: str | None = Query(None),
):
    query = select(User)
    if role:
        query = query.where(User.role == role)
    if search:
        query = query.where((User.email.ilike(f"%{search}%")) | (User.full_name.ilike(f"%{search}%")))
    result = await db.execute(query.order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "is_active": u.is_active,
            "is_admin": u.is_admin,
            "xp": u.xp,
            "level": u.level,
            "streak": u.streak,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    payload: RoleUpdateRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if payload.role not in {"student", "teacher", "parent", "administrator", "institution", "mentor"}:
        raise HTTPException(status_code=400, detail="Invalid role")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = payload.role
    await db.commit()
    await db.refresh(user)
    return {"id": user.id, "role": user.role}


@router.patch("/users/{user_id}/activate")
async def toggle_user_active(
    user_id: str,
    active: bool = Query(True),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = active
    await db.commit()
    return {"id": user.id, "is_active": user.is_active}


@router.get("/students")
async def list_students(
    admin: User = Depends(require_role("teacher", "administrator")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.role == "student").order_by(User.created_at.desc()))
    students = result.scalars().all()
    return [
        {
            "id": s.id,
            "full_name": s.full_name,
            "email": s.email,
            "xp": s.xp,
            "level": s.level,
            "streak": s.streak,
            "created_at": s.created_at.isoformat(),
        }
        for s in students
    ]


@router.get("/students/{student_id}/progress")
async def get_student_progress(
    student_id: str,
    admin: User = Depends(require_role("teacher", "parent", "administrator")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ClassroomProgress).where(ClassroomProgress.user_id == student_id))
    progress = result.scalar_one_or_none()
    if not progress:
        return {"user_id": student_id, "xp": 0, "level": 1, "streak": 0, "accuracy": 0}
    return {
        "user_id": progress.user_id,
        "xp": progress.xp,
        "level": progress.level,
        "xp_for_next_level": progress.xp_for_next_level,
        "xp_into_level": progress.xp_into_level,
        "streak": progress.streak,
        "accuracy": progress.accuracy,
        "topics_completed": progress.topics_completed,
        "weak_topics": progress.weak_topics,
        "strong_topics": progress.strong_topics,
        "badges": progress.badges,
        "achievements": progress.achievements,
        "last_active_date": progress.last_active_date.isoformat() if progress.last_active_date else None,
    }


@router.get("/classes")
async def list_classes(
    admin: User = Depends(require_role("teacher", "administrator")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(StudyGroup).order_by(StudyGroup.created_at.desc()))
    groups = result.scalars().all()
    return [
        {
            "id": g.id,
            "name": g.name,
            "description": g.description,
            "subject": g.subject,
            "is_public": g.is_public,
            "owner_id": g.owner_id,
            "created_at": g.created_at.isoformat(),
        }
        for g in groups
    ]


@router.get("/activity")
async def platform_activity(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    users_result = await db.execute(select(func.count(User.id)).where(User.is_active.is_(True)))
    conversations_result = await db.execute(select(func.count(Conversation.id)))
    messages_result = await db.execute(select(func.count(Message.id)))
    projects_result = await db.execute(select(func.count(Project.id)).where(Project.status == "completed"))
    notifications_result = await db.execute(select(func.count(Notification.id)).where(Notification.is_read.is_(False)))

    return {
        "active_users": int(await users_result.scalar_one() or 0),
        "total_conversations": int(await conversations_result.scalar_one() or 0),
        "total_messages": int(await messages_result.scalar_one() or 0),
        "completed_projects": int(await projects_result.scalar_one() or 0),
        "unread_notifications": int(await notifications_result.scalar_one() or 0),
    }
