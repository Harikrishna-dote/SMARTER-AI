"""Rate limiting middleware for FastAPI."""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Callable

from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings

settings = get_settings()

_request_log: dict[str, list[float]] = defaultdict(list)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware using in-memory store."""

    def __init__(self, app):
        super().__init__(app)
        self.window = float(settings.rate_limit_window_seconds)
        self.limit = int(settings.rate_limit_requests)

    async def dispatch(self, request: Request, call_next: Callable):
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        requests = [t for t in _request_log.get(client_ip, []) if now - t < self.window]
        if len(requests) >= self.limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please try again later.",
            )
        requests.append(now)
        _request_log[client_ip] = requests
        return await call_next(request)
