"""Enhanced error handling and logging middleware."""
import logging
import uuid
from contextlib import asynccontextmanager
from typing import Callable

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()


class ErrorResponse:
    """Standard error response format."""

    def __init__(
        self,
        error_id: str,
        message: str,
        code: str,
        status_code: int,
        details: dict = None,
    ):
        self.error_id = error_id
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}

    def to_dict(self) -> dict:
        """Convert to response dictionary."""
        return {
            "error": {
                "id": self.error_id,
                "message": self.message,
                "code": self.code,
                "details": self.details,
            }
        }


class EnhancedErrorMiddleware(BaseHTTPMiddleware):
    """Middleware for enhanced error handling and logging."""

    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.logger = logging.getLogger(__name__)

    async def dispatch(self, request: Request, call_next: Callable) -> JSONResponse:
        """Handle request with error catching."""
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        request.state.start_time = None

        try:
            response = await call_next(request)
            return response
        except HTTPException:
            raise
        except RequestValidationError:
            raise
        except Exception as exc:
            return await self._handle_exception(request, exc, request_id)

    async def _handle_exception(
        self, request: Request, exc: Exception, request_id: str
    ) -> JSONResponse:
        """Handle and log exceptions uniformly."""
        error_code = "INTERNAL_ERROR"
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        details = {}

        if isinstance(exc, ValueError):
            error_code = "VALIDATION_ERROR"
            status_code = status.HTTP_400_BAD_REQUEST
        elif isinstance(exc, PermissionError):
            error_code = "PERMISSION_DENIED"
            status_code = status.HTTP_403_FORBIDDEN
        elif isinstance(exc, FileNotFoundError):
            error_code = "NOT_FOUND"
            status_code = status.HTTP_404_NOT_FOUND
        elif isinstance(exc, TimeoutError):
            error_code = "TIMEOUT"
            status_code = status.HTTP_504_GATEWAY_TIMEOUT

        self.logger.error(
            "Request %s error: %s - %s",
            request_id,
            error_code,
            str(exc),
            exc_info=True,
            extra={
                "request_id": request_id,
                "path": request.url.path,
                "method": request.method,
                "error_code": error_code,
            },
        )

        error_response = ErrorResponse(
            error_id=request_id,
            message="An unexpected server error occurred. Please try again.",
            code=error_code,
            status_code=status_code,
            details=details,
        )

        return JSONResponse(
            status_code=status_code,
            content=error_response.to_dict(),
        )
