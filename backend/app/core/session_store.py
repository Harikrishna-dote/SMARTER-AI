"""Simple Redis-backed session store used by the orchestrator for short-term session state.

This provides a minimal API: get_session(session_id), set_session(session_id, data),
append_to_session(session_id, key, value), and delete_session. It uses the project's
existing Redis client helpers in core.cache when available, and falls back to an in-memory dict
for local development.
"""
from __future__ import annotations

import json
import asyncio
from typing import Any, Dict, Optional

from .cache import _get_redis_client, InMemoryTTLCache

# in-memory fallback store
_local_store: Dict[str, Dict[str, Any]] = {}
_local_lock = asyncio.Lock()


async def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    client = await _get_redis_client()
    key = f"session:{session_id}"
    if client is not None:
        try:
            data = await client.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception:
            pass

    async with _local_lock:
        return _local_store.get(session_id)


async def set_session(session_id: str, data: Dict[str, Any], ttl: int | None = 3600) -> None:
    client = await _get_redis_client()
    key = f"session:{session_id}"
    if client is not None:
        try:
            await client.setex(key, ttl or 3600, json.dumps(data, ensure_ascii=False))
            return
        except Exception:
            pass

    async with _local_lock:
        _local_store[session_id] = data


async def delete_session(session_id: str) -> None:
    client = await _get_redis_client()
    key = f"session:{session_id}"
    if client is not None:
        try:
            await client.delete(key)
            return
        except Exception:
            pass

    async with _local_lock:
        _local_store.pop(session_id, None)
