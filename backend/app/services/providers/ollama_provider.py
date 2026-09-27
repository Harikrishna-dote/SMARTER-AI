import asyncio
import json
import logging
import time
from typing import Any, AsyncIterator

import httpx

from app.core.config import get_settings
from app.orchestration.model_router import ModelRouter

logger = logging.getLogger(__name__)

class OllamaProvider:
    def __init__(self, model_router: ModelRouter):
        self.settings = get_settings()
        self.model_router = model_router
        self._client: httpx.AsyncClient | None = None
        self._client_base_url: str | None = None

    async def _get_client(self, base_url: str) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed or self._client_base_url != base_url:
            if self._client is not None and not self._client.is_closed:
                await self._client.aclose()
            self._client = httpx.AsyncClient(
                base_url=base_url,
                timeout=httpx.Timeout(120, connect=3),
                limits=httpx.Limits(max_connections=100, max_keepalive_connections=40, keepalive_expiry=60),
            )
            self._client_base_url = base_url
        return self._client

    def _headers(self) -> dict[str, str]:
        if self.settings.ollama_api_key.strip():
            return {"Authorization": f"Bearer {self.settings.ollama_api_key}"}
        return {}

    def _payload(
        self,
        messages: list[dict[str, str]],
        *,
        model: str,
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.35,
        max_output_tokens: int | None = None,
        json_mode: bool = False,
        context_window: int | None = None,
        stream: bool,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "stream": stream,
            "think": False,
            "keep_alive": self.settings.ollama_keep_alive,
            "options": {
                "num_ctx": context_window or self.settings.instant_context_window,
                "num_predict": max_output_tokens or self.settings.instant_max_output_tokens,
                "temperature": temperature,
                "top_k": 40,
                "top_p": 0.9,
            },
        }
        if json_mode:
            payload["format"] = "json"
        if tools:
            payload["tools"] = tools
        return payload

    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        model: str,
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.35,
        max_output_tokens: int | None = None,
        json_mode: bool = False,
        context_window: int | None = None,
        request_timeout_seconds: int | None = None,
    ) -> str:
        timeout = httpx.Timeout(request_timeout_seconds or self.settings.ai_request_timeout_seconds, connect=3)
        client = await self._get_client(self.settings.ollama_base_url)
        headers = self._headers()
        payload = self._payload(
            messages,
            model=model,
            tools=tools,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            json_mode=json_mode,
            context_window=context_window,
            stream=False,
        )
        
        start_time = time.time()
        response = await client.post("/api/chat", json=payload, headers=headers, timeout=timeout)
        response.raise_for_status()
        
        data = response.json()
        text = data.get("message", {}).get("content") or data.get("response") or ""
        if not str(text).strip():
            raise ValueError("Ollama returned an empty response")
        
        self.model_router.health.mark_success(model, time.time() - start_time)
        return str(text)

    async def stream_chat(
        self,
        messages: list[dict[str, str]],
        *,
        model: str,
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.35,
        max_output_tokens: int | None = None,
        json_mode: bool = False,
        context_window: int | None = None,
        request_timeout_seconds: int | None = None,
    ) -> AsyncIterator[str]:
        timeout = httpx.Timeout(request_timeout_seconds or self.settings.ai_request_timeout_seconds, connect=3)
        client = await self._get_client(self.settings.ollama_base_url)
        headers = self._headers()
        payload = self._payload(
            messages,
            model=model,
            tools=tools,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            json_mode=json_mode,
            context_window=context_window,
            stream=True,
        )

        start_time = time.time()
        async with client.stream("POST", "/api/chat", json=payload, headers=headers, timeout=timeout) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                chunk = data.get("message", {}).get("content", "")
                if chunk:
                    yield chunk
        self.model_router.health.mark_success(model, time.time() - start_time)

    async def embed(self, text: str, model: str) -> list[float]:
        client = await self._get_client(self.settings.ollama_base_url)
        payload = {"model": model, "prompt": text}
        start_time = time.time()
        response = await client.post("/api/embeddings", json=payload, headers=self._headers(), timeout=60)
        response.raise_for_status()
        self.model_router.health.mark_success(model, time.time() - start_time)
        return response.json().get("embedding", [])
