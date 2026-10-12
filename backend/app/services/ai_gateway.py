import logging
from typing import Any, AsyncIterator

from app.core.config import get_settings
from app.orchestration.model_router import ModelRoute
from app.orchestration.model_router import ModelRouter
from app.services.providers.gemini_provider import GeminiProvider
from app.services.providers.ollama_provider import OllamaProvider

logger = logging.getLogger(__name__)

_shared_gateway: "AIGateway | None" = None


async def close_gateway_clients() -> None:
    global _shared_gateway
    if _shared_gateway is not None:
        await _shared_gateway.close()
        _shared_gateway = None


def get_shared_gateway() -> "AIGateway":
    """Return the process gateway so health caches and HTTP clients are reused."""
    global _shared_gateway
    if _shared_gateway is None:
        _shared_gateway = AIGateway()
    return _shared_gateway

class AIGateway:
    def __init__(self):
        self.settings = get_settings()
        self.model_router = ModelRouter(self.settings)
        self.gemini = GeminiProvider()
        self.ollama = OllamaProvider(self.model_router)

    async def close(self) -> None:
        await self.gemini.close()
        await self.ollama.close()

    def embedding_available(self) -> bool:
        provider = str(getattr(self.settings, "embedding_provider", "ollama")).strip().lower()
        return bool(getattr(self.settings, "embedding_enabled", True)) and provider == "ollama" and self.model_router.local_provider_enabled

    _LOCAL_TASK_TYPES = {
        "programming",
        "mathematics",
        "telugu",
        "multilingual",
        "translation",
        "vision",
        "rag",
        "document",
        "voice",
        "embeddings",
    }

    @staticmethod
    def _route_fallback_chain(route: Any) -> tuple[str, ...]:
        chain = getattr(route, "fallback_chain", None)
        if isinstance(chain, str) and chain:
            return (chain,)
        if isinstance(chain, (list, tuple)) and chain:
            return tuple(chain)
        selected = getattr(route, "selected_model", None)
        return (selected,) if isinstance(selected, str) and selected else ()

    async def warmup(self, model: str | None = None) -> None:
        """Warm up Ollama models."""
        if not self.model_router.local_provider_enabled:
            logger.info("Ollama warmup skipped because the local provider is disabled")
            return
        await self.ollama.model_router.health.refresh(
            await self.ollama._get_client(self.settings.ollama_base_url),
            self.ollama._headers(),
            force=True
        )
        logger.info("AIGateway warmup complete.")

    async def model_health(self) -> dict[str, Any]:
        """Return non-secret model/provider health for operations dashboards."""
        if not self.model_router.local_provider_enabled:
            snapshot = self.model_router.health.snapshot(self.model_router.registry)
            snapshot["ollama_available"] = False
        else:
            client = await self.ollama._get_client(self.settings.ollama_base_url)
            snapshot = await self.model_router.health_snapshot(client, self.ollama._headers())
        snapshot["gemini_enabled"] = self.gemini.is_enabled()
        snapshot["gemini_model"] = self.settings.gemini_model
        snapshot["ollama_base_url_configured"] = bool(self.settings.ollama_base_url.strip())
        return snapshot

    async def chat(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        tools: list[dict[str, Any]] | None = None,
        *,
        task_type: str | None = None,
        latency_preference: str = "balanced",
        temperature: float = 0.35,
        max_output_tokens: int | None = None,
        json_mode: bool = False,
        context_window: int | None = None,
        request_timeout_seconds: int | None = None,
    ) -> str:
        client = await self.ollama._get_client(self.settings.ollama_base_url)
        try:
            route = await self.model_router.select_route(
                client,
                self.ollama._headers(),
                messages,
                requested_model=model,
                task_type=task_type,
                latency_preference=latency_preference,
            )
        except Exception as exc:
            logger.debug("No AI provider is available for the request: %s", exc)
            raise RuntimeError("No AI provider is currently available") from exc

        last_exc: Exception | None = None
        for model_name in self._route_fallback_chain(route):
            if "gemini" in model_name.lower():
                if not self.gemini.is_enabled():
                    continue
                try:
                    return await self.gemini.chat(
                        messages,
                        model=model_name,
                        temperature=temperature,
                        max_output_tokens=max_output_tokens,
                        json_mode=json_mode,
                        request_timeout_seconds=request_timeout_seconds,
                    )
                except Exception as exc:
                    last_exc = exc
                    logger.warning("Gemini model %s failed; trying fallback: %s", model_name, exc)
                    continue
            
            # Ollama path
            if not self.model_router.local_provider_enabled:
                continue
            ollama_model = model_name.split(":", 1)[1] if model_name.lower().startswith("ollama:") else model_name
            spec = self.model_router.registry.get(model_name) or self.model_router.registry.get(ollama_model)
            if spec is not None and not spec.enabled:
                continue
            
            # Check availability if we are falling back
            selected_model = self.model_router.health.selectable_model(ollama_model) or ollama_model
            try:
                return await self.ollama.chat(
                    messages,
                    model=selected_model,
                    tools=tools,
                    temperature=temperature,
                    max_output_tokens=max_output_tokens,
                    json_mode=json_mode,
                    context_window=context_window or (spec.context_size if spec else route.context_size),
                    request_timeout_seconds=request_timeout_seconds,
                )
            except Exception as exc:
                last_exc = exc
                first_failure = self.model_router.health.mark_failure(selected_model)
                if first_failure:
                    logger.warning("Ollama model %s failed; cooling it down for %ss: %s", selected_model, self.model_router.health.cooldown_seconds, exc)
                else:
                    logger.debug("Ollama model %s remains unavailable: %s", selected_model, exc)

        raise RuntimeError("All configured AI providers failed") from last_exc

    async def stream_chat(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        tools: list[dict[str, Any]] | None = None,
        *,
        task_type: str | None = None,
        latency_preference: str = "balanced",
        temperature: float = 0.35,
        max_output_tokens: int | None = None,
        json_mode: bool = False,
        context_window: int | None = None,
        request_timeout_seconds: int | None = None,
    ) -> AsyncIterator[str]:
        client = await self.ollama._get_client(self.settings.ollama_base_url)
        try:
            route = await self.model_router.select_route(
                client,
                self.ollama._headers(),
                messages,
                requested_model=model,
                task_type=task_type,
                latency_preference=latency_preference,
            )
        except Exception as exc:
            logger.debug("No AI provider is available for the streaming request: %s", exc)
            raise RuntimeError("No AI provider is currently available") from exc

        last_exc: Exception | None = None
        for model_name in self._route_fallback_chain(route):
            if "gemini" in model_name.lower():
                if not self.gemini.is_enabled():
                    continue
                try:
                    async for chunk in self.gemini.stream_chat(
                        messages,
                        model=model_name,
                        temperature=temperature,
                        max_output_tokens=max_output_tokens,
                        json_mode=json_mode,
                        request_timeout_seconds=request_timeout_seconds,
                    ):
                        yield chunk
                    return
                except Exception as exc:
                    last_exc = exc
                    logger.warning("Gemini model %s stream failed; trying fallback: %s", model_name, exc)
                    continue
            
            # Ollama path
            if not self.model_router.local_provider_enabled:
                continue
            ollama_model = model_name.split(":", 1)[1] if model_name.lower().startswith("ollama:") else model_name
            spec = self.model_router.registry.get(model_name) or self.model_router.registry.get(ollama_model)
            if spec is not None and not spec.enabled:
                continue

            selected_model = self.model_router.health.selectable_model(ollama_model) or ollama_model
            emitted = False
            try:
                async for chunk in self.ollama.stream_chat(
                    messages,
                    model=selected_model,
                    tools=tools,
                    temperature=temperature,
                    max_output_tokens=max_output_tokens,
                    json_mode=json_mode,
                    context_window=context_window or (spec.context_size if spec else route.context_size),
                    request_timeout_seconds=request_timeout_seconds,
                ):
                    emitted = True
                    yield chunk
                return
            except Exception as exc:
                if emitted:
                    raise
                last_exc = exc
                first_failure = self.model_router.health.mark_failure(selected_model)
                if first_failure:
                    logger.warning("Ollama stream model %s failed; cooling it down for %ss: %s", selected_model, self.model_router.health.cooldown_seconds, exc)
                else:
                    logger.debug("Ollama stream model %s remains unavailable: %s", selected_model, exc)
        
        raise RuntimeError("All configured AI providers failed") from last_exc

    async def embed(self, text: str) -> list[float]:
        """Create an embedding through the local Ollama embedding route."""
        if not self.embedding_available():
            return []
        client = await self.ollama._get_client(self.settings.ollama_base_url)
        try:
            route = await self.model_router.select_route(
                client,
                self.ollama._headers(),
                [{"role": "user", "content": text}],
                task_type="embeddings",
            )
        except Exception as exc:
            logger.debug("Embedding provider unavailable; optional retrieval is disabled: %s", exc)
            return []
        for model_name in route.candidate_models or route.fallback_chain:
            selected = self.model_router.health.selectable_model(model_name) or model_name
            try:
                return await self.ollama.embed(text, model=selected)
            except Exception as exc:
                first_failure = self.model_router.health.mark_failure(selected)
                if first_failure:
                    logger.warning("Ollama embedding model %s failed; cooling it down for %ss: %s", selected, self.model_router.health.cooldown_seconds, exc)
                else:
                    logger.debug("Ollama embedding model %s remains unavailable: %s", selected, exc)
        return []

    def _requires_local_model(
        self,
        model: str | None,
        tools: list[dict[str, Any]] | None,
        task_type: str,
    ) -> bool:
        if not self.model_router.local_provider_enabled:
            return False
        if tools:
            return True
        if model and "gemini" not in model.lower():
            return True
        return task_type in self._LOCAL_TASK_TYPES

    def _ollama_route(
        self,
        messages: list[dict[str, str]],
        *,
        model: str | None,
        task_type: str | None,
        latency_preference: str,
        language: str | None = None,
    ) -> ModelRoute:
        requested_model = model if not model or "gemini" not in model.lower() else None
        return self.model_router.plan_route(
            messages,
            requested_model=requested_model,
            task_type=task_type,
            latency_preference=latency_preference,
            language=language,
        )
