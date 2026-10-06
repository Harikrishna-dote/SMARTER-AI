from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.user import User
from app.schemas.auth import RegisterRequest
from app.services.auth_service import AuthService


@pytest.mark.asyncio
async def test_public_registration_never_grants_admin_access():
    db = MagicMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    service = AuthService(db)
    service.users.get_by_email = AsyncMock(return_value=None)

    user = await service.register(
        RegisterRequest(
            email="student@example.com",
            password="a-secure-password",
            full_name="Example Student",
        )
    )

    assert isinstance(user, User)
    assert user.is_admin is False
    db.add.assert_any_call(user)
