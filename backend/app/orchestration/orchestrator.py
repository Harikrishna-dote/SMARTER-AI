"""Central AI Orchestrator.

The Orchestrator is the central brain.
Flow:
USER
↓
REQUEST ANALYSIS
↓
INTENT CLASSIFICATION
↓
CONTEXT RETRIEVAL
↓
PLAN
↓
MODEL ROUTING
↓
TASK GRAPH
↓
PARALLEL EXECUTION WHERE SAFE
↓
RESULT VALIDATION
↓
RESPONSE STREAMING
↓
MEMORY UPDATE
"""

import logging
import time
from typing import Any, AsyncIterator

from app.core.metrics.tracker import metrics_tracker
from app.services.ai_gateway import AIGateway

logger = logging.getLogger(__name__)

class AIOrchestrator:
    def __init__(self, gateway: AIGateway):
        self.gateway = gateway
        self.router = gateway.model_router

    async def execute_request(self, user_id: str, messages: list[dict[str, str]], **kwargs) -> str:
        """
        Coordinates the execution of an AI request.
        """
        start_time = time.perf_counter()
        provider = "unknown"
        success = False
        
        try:
            provider = self._expected_provider(messages, kwargs)
            response = await self.gateway.chat(
                messages,
                model=kwargs.get("model"),
                tools=kwargs.get("tools"),
                task_type=kwargs.get("task_type"),
                latency_preference=kwargs.get("latency_preference", "balanced"),
                temperature=kwargs.get("temperature", 0.35),
                max_output_tokens=kwargs.get("max_output_tokens"),
                json_mode=kwargs.get("json_mode", False),
                context_window=kwargs.get("context_window"),
                request_timeout_seconds=kwargs.get("request_timeout_seconds"),
            )
            success = True
            return response
        except Exception as e:
            logger.error(f"Orchestration failed: {e}")
            raise
        finally:
            latency = time.perf_counter() - start_time
            metrics_tracker.record_request(provider, latency, success)

    async def stream_request(
        self,
        user_id: str,
        messages: list[dict[str, str]],
        **kwargs: Any,
    ) -> AsyncIterator[str]:
        """Coordinate a streaming model request through the shared gateway."""
        start_time = time.perf_counter()
        provider = self._expected_provider(messages, kwargs)
        success = False
        try:
            async for chunk in self.gateway.stream_chat(
                messages,
                model=kwargs.get("model"),
                tools=kwargs.get("tools"),
                task_type=kwargs.get("task_type"),
                latency_preference=kwargs.get("latency_preference", "balanced"),
                temperature=kwargs.get("temperature", 0.35),
                max_output_tokens=kwargs.get("max_output_tokens"),
                json_mode=kwargs.get("json_mode", False),
                context_window=kwargs.get("context_window"),
                request_timeout_seconds=kwargs.get("request_timeout_seconds"),
            ):
                yield chunk
            success = True
        finally:
            latency = time.perf_counter() - start_time
            metrics_tracker.record_request(provider, latency, success)

    def _expected_provider(self, messages: list[dict[str, str]], kwargs: dict[str, Any]) -> str:
        profile = self.router.classify(
            messages,
            task_type=kwargs.get("task_type"),
            latency_preference=kwargs.get("latency_preference", "balanced"),
        )
        local_required = self.gateway._requires_local_model(
            kwargs.get("model"),
            kwargs.get("tools"),
            profile.task_type,
        )
        return "ollama" if local_required or not self.gateway.gemini.is_enabled() else "gemini"
