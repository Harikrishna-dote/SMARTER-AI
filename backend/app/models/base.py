from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.core.time import utc_now_naive


def new_id() -> str:
    return str(uuid4())


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now_naive, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=utc_now_naive,
        onupdate=utc_now_naive,
        nullable=False,
    )

