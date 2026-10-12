from datetime import datetime, timezone


def utc_now() -> datetime:
    """Return an aware UTC timestamp for application-level values."""
    return datetime.now(timezone.utc)


def utc_now_naive() -> datetime:
    """Return UTC without tzinfo for legacy TIMESTAMP database columns."""
    return utc_now().replace(tzinfo=None)
