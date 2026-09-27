from sqlalchemy.ext.asyncio import AsyncSession

from app.models.settings import UserSettings
from app.repositories.settings import SettingsRepository
from app.schemas.settings import SettingsUpdate


class SettingsService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = SettingsRepository(db)

    async def get_or_create(self, user_id: str) -> UserSettings:
        settings = await self.repo.get_for_user(user_id)
        if settings:
            return settings
        return await self.repo.add(UserSettings(user_id=user_id))

    async def update(self, user_id: str, payload: SettingsUpdate) -> UserSettings:
        settings = await self.get_or_create(user_id)
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(settings, key, value)
        await self.db.commit()
        await self.db.refresh(settings)
        return settings

