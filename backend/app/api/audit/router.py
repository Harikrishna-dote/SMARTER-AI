from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_admin, get_current_user
from app.models.audit import AuditLog, SecurityEvent
from app.models.user import User


router = APIRouter()


@router.get("/logs")
async def list_audit_logs(
    user_id: str | None = Query(None),
    action: str | None = Query(None),
    resource_type: str | None = Query(None),
    status: str | None = Query(None),
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    cutoff = datetime.utcnow() - timedelta(days=days)
    query = select(AuditLog).where(AuditLog.created_at >= cutoff)
    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if action:
        query = query.where(AuditLog.action == action)
    if resource_type:
        query = query.where(AuditLog.resource_type == resource_type)
    if status:
        query = query.where(AuditLog.status == status)
    query = query.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    logs = result.scalars().all()
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "status": log.status,
            "ip_address": log.ip_address,
            "request_id": log.request_id,
            "duration_ms": log.duration_ms,
            "details": log.details,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]


@router.get("/security-events")
async def list_security_events(
    severity: str | None = Query(None),
    event_type: str | None = Query(None),
    days: int = Query(7, ge=1, le=90),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    cutoff = datetime.utcnow() - timedelta(days=days)
    query = select(SecurityEvent).where(SecurityEvent.created_at >= cutoff)
    if severity:
        query = query.where(SecurityEvent.severity == severity)
    if event_type:
        query = query.where(SecurityEvent.event_type == event_type)
    query = query.order_by(SecurityEvent.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    events = result.scalars().all()
    return [
        {
            "id": event.id,
            "user_id": event.user_id,
            "event_type": event.event_type,
            "severity": event.severity,
            "ip_address": event.ip_address,
            "description": event.description,
            "metadata": event.event_metadata,
            "created_at": event.created_at.isoformat(),
        }
        for event in events
    ]
