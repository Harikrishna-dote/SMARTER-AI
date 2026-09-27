import asyncio
import json
import os
import time
from collections import OrderedDict
from typing import Any, Optional

try:
    import redis.asyncio as redis
    from redis.exceptions import RedisError
except ImportError:  # pragma: no cover - redis is an optional runtime dependency
    redis = None  # type: ignore[assignment]
    RedisError = Exception  # type: ignore[assignment]


class InMemoryTTLCache:
    """Small async-safe TTL cache for fast repeated AI responses."""

    def __init__(self, ttl_seconds: float = 300, max_entries: int = 512):
        self.ttl_seconds = ttl_seconds
        self.max_entries = max_entries
        self._items: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Any | None:
        now = time.monotonic()
        async with self._lock:
            self._prune_expired(now)
            item = self._items.get(key)
            if item is None:
                return None

            expires_at, value = item
            if expires_at <= now:
                self._items.pop(key, None)
                return None

            self._items.move_to_end(key)
            return value

    async def set(self, key: str, value: Any, ttl_seconds: float | None = None) -> None:
        ttl = self.ttl_seconds if ttl_seconds is None else ttl_seconds
        expires_at = time.monotonic() + max(ttl, 0)
        async with self._lock:
            self._prune_expired()
            self._items[key] = (expires_at, value)
            self._items.move_to_end(key)
            while len(self._items) > self.max_entries:
                self._items.popitem(last=False)

    async def delete(self, key: str) -> None:
        async with self._lock:
            self._items.pop(key, None)

    async def clear(self) -> None:
        async with self._lock:
            self._items.clear()

    def _prune_expired(self, now: float | None = None) -> None:
        current = time.monotonic() if now is None else now
        expired = [key for key, (expires_at, _) in self._items.items() if expires_at <= current]
        for key in expired:
            self._items.pop(key, None)


fast_response_cache = InMemoryTTLCache(ttl_seconds=300, max_entries=512)
translation_cache = InMemoryTTLCache(ttl_seconds=3600, max_entries=512)
_visual_script_cache = InMemoryTTLCache(ttl_seconds=3600, max_entries=128)

_redis_client: "redis.Redis | None" = None
_redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")


def _cache_key(prefix: str, key: str) -> str:
    return f"{prefix}:{key.strip().lower()}"


async def _get_redis_client() -> "redis.Redis | None":
    global _redis_client
    if redis is None:
        return None
    if _redis_client is None:
        _redis_client = redis.from_url(
            _redis_url,
            decode_responses=True,
            socket_connect_timeout=0.5,
            socket_timeout=1.0,
        )
    return _redis_client


async def get_cached_visual_script(topic: str) -> Optional[list]:
    key = _cache_key("visual_script", topic)
    client = await _get_redis_client()
    if client is not None:
        try:
            data = await client.get(key)
            if data:
                return json.loads(data)
        except (RedisError, OSError, TimeoutError, json.JSONDecodeError):
            pass

    return await _visual_script_cache.get(key)


async def cache_visual_script(topic: str, script: list, ttl: int = 3600) -> None:
    key = _cache_key("visual_script", topic)
    await _visual_script_cache.set(key, script, ttl_seconds=ttl)

    client = await _get_redis_client()
    if client is None:
        return
    try:
        await client.setex(key, ttl, json.dumps(script, ensure_ascii=False))
    except (RedisError, OSError, TimeoutError):
        return


async def close_redis() -> None:
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None
