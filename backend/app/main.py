import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from starlette.middleware.gzip import GZipMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

try:
    from prometheus_fastapi_instrumentator import Instrumentator
except ImportError:  # pragma: no cover - optional metrics dependency
    Instrumentator = None

from app.api.router import api_router
from app.core.cache import close_redis
from app.core.config import get_settings
from app.core.database import AsyncSessionLocal, Base, engine
from app.core.logging import configure_logging
from app.core.plugin_manager import PluginManager
from app.middleware.error_handling import EnhancedErrorMiddleware
from app.middleware.request_id import RequestIdMiddleware
from app.core.rate_limit import RateLimitMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.models.user import User
from app.models.settings import UserSettings
from app.security.password import hash_password
from app.services.ai_gateway import AIGateway, close_gateway_clients


settings = get_settings()
configure_logging(settings.environment)
logger = logging.getLogger(__name__)


class CacheControlMiddleware:
    PUBLIC_CACHEABLE_PATHS = {"/health", "/ready"}

    def __init__(self, app: FastAPI, max_age: int = 60):
        self.app = app
        self.max_age = max_age

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        method = scope.get("method", "GET")
        path = scope.get("path", "")

        if method == "GET":
            async def send_with_cache(message):
                if message["type"] == "http.response.start":
                    headers = message.get("headers", [])
                    cache_value = (
                        f"public, max-age={self.max_age}, stale-while-revalidate=30"
                        if path in self.PUBLIC_CACHEABLE_PATHS
                        else "no-store"
                    )
                    headers.append([b"cache-control", cache_value.encode("utf-8")])
                    headers.append([b"vary", b"Accept-Encoding"])
                    message["headers"] = headers
                await send(message)

            await self.app(scope, receive, send_with_cache)
        else:
            await self.app(scope, receive, send)


async def retire_default_admin_account() -> None:
    if settings.environment.lower() != "development" or not settings.retire_default_admin_account:
        return

    email = settings.retired_admin_email.strip().lower()
    if not email:
        return

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.email == email))
        admin_user = result.scalar_one_or_none()
        if admin_user:
            await session.delete(admin_user)
            await session.commit()


async def ensure_default_admin() -> None:
    if not settings.create_default_admin:
        return

    email = settings.default_admin_email.strip().lower()
    if not email:
        return

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            return
        admin = User(
            email=email,
            hashed_password=hash_password(settings.default_admin_password),
            full_name=settings.default_admin_name or "Platform Admin",
            is_active=True,
            is_admin=True,
        )
        session.add(admin)
        await session.flush()
        session.add(UserSettings(user_id=admin.id))
        await session.commit()
        logger.info("Provisioned default admin account: %s", email)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.auto_create_tables:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    await retire_default_admin_account()
    await ensure_default_admin()
    warmup_task = asyncio.create_task(AIGateway().warmup())
    plugin_manager = PluginManager(app=app, plugins_dir=settings.plugins_directory)
    app.state.plugin_manager = plugin_manager
    try:
        await plugin_manager.initialize(settings)
        plugin_manager.register_routes()
        plugin_manager.register_dependencies()
        plugin_manager.register_middlewares()
        yield
    finally:
        if not warmup_task.done():
            warmup_task.cancel()
            with suppress(asyncio.CancelledError):
                await warmup_task
        await plugin_manager.shutdown()
        await close_redis()
        await close_gateway_clients()
        await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="SMARTER AI is a self-hosted multimodal tutor powered by local open-source models.",
    lifespan=lifespan,
)

if Instrumentator is not None:
    Instrumentator().instrument(app).expose(app)

app.add_middleware(EnhancedErrorMiddleware)
app.add_middleware(RequestIdMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=settings.gzip_minimum_size)
app.add_middleware(CacheControlMiddleware, max_age=60)
app.add_middleware(RateLimitMiddleware)
if settings.allowed_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["system"])
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name, "environment": settings.environment}


@app.get("/ready", tags=["system"])
async def readiness_check() -> dict[str, str]:
    from app.application.operations_engine import OperationsEngine

    report = OperationsEngine(metrics_available=Instrumentator is not None).readiness()
    return {
        "status": report.status,
        "service": report.service,
        "environment": report.environment,
        "api_version_prefix": report.api_version_prefix,
    }


app.include_router(api_router, prefix=settings.api_v1_prefix)
