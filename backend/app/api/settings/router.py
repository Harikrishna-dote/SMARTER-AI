from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.settings import SettingsRead, SettingsUpdate
from app.services.settings_service import SettingsService


router = APIRouter()


@router.get("", response_model=SettingsRead)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await SettingsService(db).get_or_create(current_user.id)


@router.patch("", response_model=SettingsRead)
async def update_settings(
    payload: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await SettingsService(db).update(current_user.id, payload)

