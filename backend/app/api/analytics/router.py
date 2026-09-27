from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_admin
from app.models.user import User
from app.services.analytics_service import AnalyticsService


router = APIRouter()


@router.get("/learning-trends")
async def learning_trends(
    days: int = 30,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    service = AnalyticsService(db)
    return await service.get_learning_trends(days)


@router.get("/platform-usage")
async def platform_usage(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    service = AnalyticsService(db)
    return await service.get_platform_usage()


@router.get("/ai-usage")
async def ai_usage(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    service = AnalyticsService(db)
    return await service.get_ai_usage()


@router.get("/performance")
async def performance_metrics(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    service = AnalyticsService(db)
    return await service.get_performance_metrics()


@router.get("/engagement")
async def engagement_metrics(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    service = AnalyticsService(db)
    return await service.get_engagement_metrics()


@router.get("/lesson-completion")
async def lesson_completion(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    service = AnalyticsService(db)
    return await service.get_lesson_completion()
