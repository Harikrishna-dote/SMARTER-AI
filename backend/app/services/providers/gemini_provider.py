import asyncio
import logging
import random
import time
from typing import Any, AsyncIterator

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

class GeminiProvider:
    def __init__(self):
        self.settings = get_settings()
        self.api_key = self.settings.gemini_api_key.strip()
        self.default_model = self.settings.gemini_model.strip() or "gemini-2-flash"
        self._unavailable_until = 0.0
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=httpx.Timeout(30, connect=3),
                limits=httpx.Limits(max_connections=100, max_keepalive_connections=40, keepalive_expiry=60),
            )
        return self._client

    def is_enabled(self) -> bool:
        if time.time() < self._unavailable_until:
            return False
        return bool(self.api_key)

    def _mark_unavailable(self, duration: int = 60):
        self._unavailable_until = time.time() + duration
        logger.warning("Gemini marked unavailable for %d seconds.", duration)

    @staticmethod
    def _text(data: dict[str, Any]) -> str:
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        return "".join(part.get("text", "") for part in parts if isinstance(part, dict))

    def _build_payload(
        self,
        messages: list[dict[str, str]],
        *,
        temperature: float,
        max_output_tokens: int | None,
        json_mode: bool,
    ) -> dict[str, Any]:
        system_instruction: str | None = None
        contents: list[dict[str, Any]] = []
        for message in messages:
            role = message.get("role", "user")
            content = message.get("content", "")
            if not content:
                continue
            if role == "system":
                system_instruction = content if system_instruction is None else f"{system_instruction}\n{content}"
                continue
            contents.append({
                "role": "user" if role == "user" else "model",
                "parts": [{"text": content}],
            })
        
        payload: dict[str, Any] = {
            "contents": contents or [{"role": "user", "parts": [{"text": "Hello"}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_output_tokens or self.settings.instant_max_output_tokens,
            },
        }
        if json_mode:
            payload["generationConfig"]["responseMimeType"] = "application/json"
        if system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}
        return payload

    @staticmethod
    def _is_retryable_error(exc: Exception) -> bool:
        if isinstance(exc, httpx.HTTPStatusError):
            return exc.response.status_code in {429, 500, 502, 503, 504}
        return isinstance(exc, (httpx.TimeoutException, httpx.NetworkError, TimeoutError))

    async def chat(
        self,
        messages: list[dict[str, str]],
        *,
        model: str | None = None,
        temperature: float = 0.35,
        max_output_tokens: int | None = None,
        json_mode: bool = False,
        request_timeout_seconds: int | None = None,
    ) -> str:
        payload = self._build_payload(
            messages,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            json_mode=json_mode,
        )
        model_name = (model and "gemini" in model.lower()) and model or self.default_model
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
        headers = {"x-goog-api-key": self.api_key}
        client = await self._get_client()

        last_exc: Exception | None = None
        for attempt in range(4):
            try:
                response = await client.post(url, headers=headers, json=payload, timeout=request_timeout_seconds or self.settings.ai_request_timeout_seconds)
                response.raise_for_status()
                text = self._text(response.json())
                if not text.strip():
                    raise ValueError("The Gemini API returned an empty response")
                return text
            except Exception as exc:
                last_exc = exc
                if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code == 429:
                    self._mark_unavailable()
                if not self._is_retryable_error(exc) or attempt == 3:
                    break
                sleep = min(2 ** attempt + random.uniform(0, 1), 15)
                await asyncio.sleep(sleep)

        raise last_exc or RuntimeError("Gemini request failed after retries")

    async def stream_chat(
        self,
        messages: list[dict[str, str]],
        *,
        model: str | None = None,
        temperature: float = 0.35,
        max_output_tokens: int | None = None,
        json_mode: bool = False,
        request_timeout_seconds: int | None = None,
    ) -> AsyncIterator[str]:
        payload = self._build_payload(
            messages,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            json_mode=json_mode,
        )
        model_name = (model and "gemini" in model.lower()) and model or self.default_model
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:streamGenerateContent?alt=sse"
        headers = {"x-goog-api-key": self.api_key}
        client = await self._get_client()

        last_exc: Exception | None = None
        for attempt in range(3):
            emitted = False
            try:
                async with client.stream("POST", url, headers=headers, json=payload, timeout=request_timeout_seconds or self.settings.ai_request_timeout_seconds) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line or line.startswith(":"):
                            continue
                        if line.startswith("data:"):
                            line = line.removeprefix("data:").strip()
                        if line == "[DONE]":
                            break
                        try:
                            import json
                            data = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        text = self._text(data)
                        if text:
                            emitted = True
                            yield text
                if emitted:
                    return
                return
            except Exception as exc:
                last_exc = exc
                if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code == 429:
                    self._mark_unavailable()
                if not self._is_retryable_error(exc) or attempt == 2:
                    break
                sleep = min(2 ** attempt + random.uniform(0, 1), 12)
                await asyncio.sleep(sleep)
        
        raise last_exc or RuntimeError("Gemini stream failed after retries")
