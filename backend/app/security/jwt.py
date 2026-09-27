from datetime import datetime, timedelta, timezone
from typing import Any

from jose import jwt

from app.core.config import get_settings


settings = get_settings()


def create_access_token(subject: str, role: str = "student", expires_delta: timedelta | None = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload: dict[str, Any] = {"sub": subject, "exp": expire, "type": "access", "role": role}
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm); return token.decode("utf-8") if isinstance(token, bytes) else token


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])

