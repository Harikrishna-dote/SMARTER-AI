"""Redis caching layer for SMARTER-AI."""

from __future__ import annotations

import json
import logging
from typing import Any

from redis.asyncio import Redis

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class CacheService:
    """Async Redis cache with TTL support."""

    def __init__(self, redis_url: str | None = None) -> None:
        self._redis: Redis | None = None
        self._url = redis_url or settings.redis_url

    async def connect(self) -> None:
        if self._redis is None:
            try:
                self._redis = Redis.from_url(
                    self._url,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5,
                )
                await self._redis.ping()
                logger.info("Connected to Redis cache")
            except Exception as exc:
                logger.warning("Redis connection failed: %s", exc)
                self._redis = None

    async def disconnect(self) -> None:
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None

    async def get(self, key: str) -> Any | None:
        if self._redis is None:
            return None
        try:
            value = await self._redis.get(key)
            if value is None:
                return None
            return json.loads(value)
        except Exception as exc:
            logger.debug("Cache get failed for %s: %s", key, exc)
            return None

    async def set(self, key: str, value: Any, ttl: int | None = 300) -> None:
        if self._redis is None:
            return
        try:
            await self._redis.set(key, json.dumps(value), ex=ttl)
        except Exception as exc:
            logger.debug("Cache set failed for %s: %s", key, exc)

    async def delete(self, key: str) -> None:
        if self._redis is None:
            return
        try:
            await self._redis.delete(key)
        except Exception as exc:
            logger.debug("Cache delete failed for %s: %s", key, exc)

    async def invalidate_pattern(self, pattern: str) -> None:
        if self._redis is None:
            return
        try:
            keys = []
            async for key in self._redis.scan_iter(match=pattern):
                keys.append(key)
            if keys:
                await self._redis.delete(*keys)
        except Exception as exc:
            logger.debug("Cache invalidation failed for %s: %s", pattern, exc)

    async def get_or_set(self, key: str, factory, ttl: int = 300) -> Any:
        cached = await self.get(key)
        if cached is not None:
            return cached
        value = await factory()
        await self.set(key, value, ttl=ttl)
        return value


_cache_service: CacheService | None = None


def get_cache_service() -> CacheService:
    global _cache_service
    if _cache_service is None:
        _cache_service = CacheService()
    return _cache_service
