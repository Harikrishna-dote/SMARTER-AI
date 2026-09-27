from collections.abc import Callable
from typing import Any
import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.orchestrator import AIOrchestrator
from app.core.config import get_settings
from app.core.database import get_db
from app.models.user import User
from app.repositories.users import UserRepository
from app.security.jwt import decode_access_token


settings = get_settings()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_v1_prefix}/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    logger = logging.getLogger(__name__)
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    logger.info(f"get_current_user: received token: {token[:10]}...")
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            logger.warning("get_current_user: no user_id in payload")
            raise credentials_error
    except JWTError as exc:
        logger.warning(f"get_current_user: JWT error: {exc}")
        raise credentials_error from exc

    user = await UserRepository(db).get(user_id)
    if not user or not user.is_active:
        logger.warning(f"get_current_user: user not found or inactive: {user_id}")
        raise credentials_error
    logger.info(f"get_current_user: success for user: {user_id}")
    return user


async def get_orchestrator(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> AIOrchestrator:
    """Provide the central AI orchestrator for the current request."""
    return AIOrchestrator(db, user_id=current_user.id)


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def require_role(*allowed_roles: str):
    async def _dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role required: {', '.join(allowed_roles)}",
            )
        return current_user
    return _dependency


_service_cache: dict[str, Callable[..., Any]] = {}


def plugin_service(name: str) -> Callable[..., Any]:
    """Return a stable FastAPI dependency callable resolving plugin service ``name``.

    The returned callable yields the *service factory* registered by the
    plugin, looked up in the global :class:`~app.plugins.registry.PluginRegistry`
    at request time. Because the same ``name`` always returns the same cached
    callable, FastAPI dependency overrides match reliably.

    A route receives the factory itself and may invoke it with whatever
    arguments it requires::

        from fastapi import Depends
        from app.core.deps import plugin_service

        @app.get("/demo")
        async def demo(greeter=Depends(plugin_service("hello_greeter"))):
            return {"greeting": greeter("Kilo")}
    """

    def resolve() -> Any:
        from app.plugins.registry import get_plugin_registry

        services = get_plugin_registry().get_services()
        if name not in services:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Plugin service '{name}' is not available",
            )
        return services[name]  # the callable factory itself

    cached = _service_cache.get(name)
    if cached is None:
        resolve.__name__ = f"plugin_service_{name}"
        resolve.__qualname__ = f"plugin_service_{name}"
        _service_cache[name] = resolve
        return resolve
    return cached
