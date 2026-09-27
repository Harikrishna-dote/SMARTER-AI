from collections.abc import AsyncGenerator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


settings = get_settings()

connect_args: dict = {}
if settings.database_url.startswith("sqlite"):
    # Generous busy timeout so concurrent readers/writers wait instead of
    # immediately failing with "database is locked" on SQLite.
    connect_args = {"timeout": 30, "check_same_thread": False}

engine = create_async_engine(
    settings.database_url,
    pool_pre_ping=True,
    # Roll back any uncommitted transaction when a connection returns to the
    # pool so a failed request can never leave the DB locked for the next one.
    pool_reset_on_return="rollback",
    connect_args=connect_args,
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


if settings.database_url.startswith("sqlite"):

    @event.listens_for(engine.sync_engine, "connect")
    def _enable_sqlite_wal(dbapi_conn, _conn_record) -> None:  # noqa: ANN001
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
