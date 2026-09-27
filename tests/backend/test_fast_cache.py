import asyncio
import time

from app.core.cache import InMemoryTTLCache


def test_cache_stores_and_expires_values() -> None:
    cache = InMemoryTTLCache(ttl_seconds=0.2, max_entries=4)

    asyncio.run(cache.set("demo", {"answer": "fast"}))
    assert asyncio.run(cache.get("demo")) == {"answer": "fast"}

    time.sleep(0.25)
    assert asyncio.run(cache.get("demo")) is None
