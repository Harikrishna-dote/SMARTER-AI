from sqlalchemy import select

from app.models.settings import UserSettings
from app.repositories.base import BaseRepository


class SettingsRepository(BaseRepository[UserSettings]):
    model = UserSettings

    async def get_for_user(self, user_id: str) -> UserSettings | None:
        result = await self.db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
        return result.scalar_one_or_none()

