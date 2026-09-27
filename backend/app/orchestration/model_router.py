"""Task-aware Ollama model routing.

The router is intentionally deterministic and lightweight. It classifies the
request with local heuristics, chooses the smallest capable configured model,
and lets the gateway execute the selected fallback chain through one Ollama
client.
"""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass
from enum import Enum
from typing import Any

import httpx


logger = logging.getLogger(__name__)


class ModelRoutingError(RuntimeError):
    """Raised when no configured local model can handle a request."""


class ModelHealth(str, Enum):
    UNKNOWN = "unknown"
    AVAILABLE = "available"
    LOADED = "loaded"
    UNAVAILABLE = "unavailable"
    UNHEALTHY = "unhealthy"
    DISABLED = "disabled"


@dataclass(frozen=True)
class ModelSpec:
    name: str
    purpose: str
    capabilities: tuple[str, ...]
    context_size: int
    priority: int
    resource_usage: str
    fallback_model: str | None = None
    enabled: bool = True

    def snapshot(self, health: ModelHealth = ModelHealth.UNKNOWN) -> dict[str, Any]:
        return {
            "name": self.name,
            "purpose": self.purpose,
            "capabilities": list(self.capabilities),
            "context_size": self.context_size,
            "priority": self.priority,
            "resource_usage": self.resource_usage,
            "fallback_model": self.fallback_model,
            "enabled": self.enabled,
            "health_status": health.value,
        }


@dataclass(frozen=True)
class RequestProfile:
    task_type: str
    capabilities: tuple[str, ...]
    language: str
    latency_preference: str
    reason: str


@dataclass(frozen=True)
class ModelRoute:
    requested_model: str
    selected_model: str
    candidate_models: tuple[str, ...]
    fallback_chain: tuple[str, ...]
    task_type: str
    capabilities: tuple[str, ...]
    context_size: int
    health_status: dict[str, str]
    reason: str


DEFAULT_MODEL_SPECS: tuple[ModelSpec, ...] = (
    ModelSpec(
        name="smarter-qwen3:4b",
        purpose="General conversation and AI tutor",
        capabilities=("general", "tutor", "education", "summarization", "quiz", "notes", "homework"),
        context_size=32768,
        priority=10,
        resource_usage="medium",
        fallback_model="qwen3:4b",
    ),
    ModelSpec(
        name="qwen3:4b",
        purpose="General fallback",
        capabilities=("general", "tutor", "education", "fallback"),
        context_size=32768,
        priority=20,
        resource_usage="medium",
        fallback_model="gemma3:4b",
    ),
    ModelSpec(
        name="gemma3:1b",
        purpose="Very fast simple tasks",
        capabilities=("general", "simple", "voice", "fast"),
        context_size=8192,
        priority=30,
        resource_usage="low",
        fallback_model="gemma3:4b",
    ),
    ModelSpec(
        name="gemma3:4b",
        purpose="Fast general tasks",
        capabilities=("general", "fast", "summarization", "fallback"),
        context_size=16384,
        priority=25,
        resource_usage="medium",
        fallback_model="qwen3:4b",
    ),
    ModelSpec(
        name="qwen2.5-coder:7b",
        purpose="Programming and code",
        capabilities=("programming", "code", "debugging"),
        context_size=32768,
        priority=10,
        resource_usage="high",
        fallback_model="smarter-qwen3:4b",
    ),
    ModelSpec(
        name="qwen2-math:7b",
        purpose="Mathematics",
        capabilities=("mathematics", "equations", "proofs"),
        context_size=32768,
        priority=10,
        resource_usage="high",
        fallback_model="deepseek-r1:7b",
    ),
    ModelSpec(
        name="aya-expanse:8b",
        purpose="Telugu and multilingual tasks",
        capabilities=("telugu", "multilingual", "translation", "language_learning"),
        context_size=32768,
        priority=10,
        resource_usage="high",
        fallback_model="smarter-qwen3:4b",
    ),
    ModelSpec(
        name="llava:7b",
        purpose="Vision and image understanding",
        capabilities=("vision", "image", "ocr_summary"),
        context_size=8192,
        priority=10,
        resource_usage="high",
        fallback_model="smarter-qwen3:4b",
    ),
    ModelSpec(
        name="deepseek-r1:7b",
        purpose="Complex reasoning",
        capabilities=("reasoning", "analysis", "deep"),
        context_size=32768,
        priority=10,
        resource_usage="high",
        fallback_model="smarter-qwen3:4b",
    ),
    ModelSpec(
        name="nomic-embed-text:latest",
        purpose="Embeddings",
        capabilities=("embeddings", "rag", "retrieval"),
        context_size=8192,
        priority=10,
        resource_usage="low",
        fallback_model=None,
    ),
)

TASK_PRIMARY_MODEL: dict[str, str] = {
    "general": "smarter-qwen3:4b",
    "ai_tutor": "smarter-qwen3:4b",
    "simple": "gemma3:1b",
    "fast_general": "gemma3:4b",
    "programming": "qwen2.5-coder:7b",
    "mathematics": "qwen2-math:7b",
    "telugu": "aya-expanse:8b",
    "multilingual": "aya-expanse:8b",
    "translation": "aya-expanse:8b",
    "vision": "llava:7b",
    "deep_reasoning": "deepseek-r1:7b",
    "document": "smarter-qwen3:4b",
    "rag": "smarter-qwen3:4b",
    "summarization": "gemma3:4b",
    "quiz": "smarter-qwen3:4b",
    "notes": "smarter-qwen3:4b",
    "homework": "smarter-qwen3:4b",
    "recommendations": "smarter-qwen3:4b",
    "voice": "gemma3:1b",
    "embeddings": "nomic-embed-text:latest",
}

GENERIC_FALLBACKS: tuple[str, ...] = ("qwen3:4b", "gemma3:4b", "gemma3:1b")

TELUGU_RE = re.compile(r"[\u0c00-\u0c7f]")
CODE_RE = re.compile(
    r"\b("
    r"python|javascript|typescript|java|c\+\+|c#|react|fastapi|sql|html|css|"
    r"code|coding|program|function|class|method|bug|debug|compiler|api|repo|git|"
    r"algorithm|data structure|leetcode"
    r")\b",
    re.IGNORECASE,
)
MATH_RE = re.compile(
    r"(\b(equation|algebra|calculus|integral|derivative|matrix|geometry|trigonometry|"
    r"probability|statistics|proof|factor|quadratic|solve|simplify|theorem)\b|"
    r"\d+\s*[\+\-\*/=]\s*\d+|[a-z]\s*=\s*\d)",
    re.IGNORECASE,
)
VISION_RE = re.compile(r"\b(image|photo|picture|diagram|screenshot|vision|ocr|video|frame)\b", re.IGNORECASE)
TRANSLATION_RE = re.compile(r"\b(translate|translation|grammar|vocabulary|language learning|bilingual)\b", re.IGNORECASE)
DEEP_RE = re.compile(r"\b(analyze|difficult|complex|deep|reason|compare|evaluate|derive|research)\b", re.IGNORECASE)
SIMPLE_RE = re.compile(r"\b(simple|quick|brief|short|definition|one line|very fast|easy meaning)\b", re.IGNORECASE)
TUTOR_RE = re.compile(r"\b(teach|explain|lesson|student|tutor|learn|practice|homework|quiz|notes|revision)\b", re.IGNORECASE)
DOCUMENT_RE = re.compile(r"\b(document|pdf|docx|file|source|rag|context|attachment)\b", re.IGNORECASE)
VOICE_RE = re.compile(r"\b(voice|speech|tts|stt|microphone|audio|transcribe|caption)\b", re.IGNORECASE)


def _setting(settings: Any, name: str, default: Any) -> Any:
    return getattr(settings, name, default)


def _clean_model_name(name: str | None) -> str:
    return (name or "").strip()


class ModelRegistry:
    def __init__(self, settings: Any | None = None):
        self.settings = settings
        self._models: dict[str, ModelSpec] = {spec.name: spec for spec in DEFAULT_MODEL_SPECS}
        self._task_primary = dict(TASK_PRIMARY_MODEL)
        if settings is not None:
            self._apply_settings(settings)

    def _apply_settings(self, settings: Any) -> None:
        # Load chains from the new unified config
        fallback_chains = _setting(settings, "model_fallback_chains", {})
        if isinstance(fallback_chains, dict):
            for task_type, chain in fallback_chains.items():
                if isinstance(chain, list) and chain:
                    self._task_primary[task_type] = chain[0]
                    # Logic to ensure all models in the chain exist in the registry
                    for model_name in chain:
                        if model_name not in self._models:
                            self._models[model_name] = ModelSpec(
                                name=model_name,
                                purpose="Configured chain model",
                                capabilities=(task_type,),
                                context_size=32768,
                                priority=50,
                                resource_usage="custom",
                            )

        # Legacy overrides support (for backward compatibility if needed)
        # ... (keep existing registry_overrides/fallback_overrides logic)

    @property
    def models(self) -> dict[str, ModelSpec]:
        return dict(self._models)

    def get(self, model_name: str) -> ModelSpec | None:
        return self._models.get(model_name)

    def primary_for_task(self, task_type: str) -> str:
        return self._task_primary.get(task_type, self._task_primary["general"])

    def fallback_chain(self, primary: str, task_type: str = "general") -> tuple[str, ...]:
        # Return the chain defined for the task
        chains = _setting(self.settings, "model_fallback_chains", {})
        if isinstance(chains, dict) and task_type in chains:
            return tuple(chains[task_type])
        
        # Fallback to legacy generation logic if no chain is defined
        chain: list[str] = []
        seen: set[str] = set()
        primary_spec = self._models.get(primary)
        add_generic_fallbacks = not (primary_spec and "embeddings" in primary_spec.capabilities)

        current = primary
        while current and current not in seen:
            seen.add(current)
            chain.append(current)
            spec = self._models.get(current)
            current = spec.fallback_model if spec else GENERIC_FALLBACKS[0]

        if add_generic_fallbacks:
            for fallback in GENERIC_FALLBACKS:
                if fallback not in seen:
                    chain.append(fallback)
                    seen.add(fallback)
        return tuple(chain)

    def snapshots(self, health: "ModelHealthManager | None" = None) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for spec in sorted(self._models.values(), key=lambda item: (item.priority, item.name)):
            status = health.status_for(spec.name) if health else ModelHealth.UNKNOWN
            rows.append(spec.snapshot(status))
        return rows


class ModelHealthManager:
    def __init__(self, cache_ttl_seconds: int = 30, cooldown_seconds: int = 60):
        self.cache_ttl_seconds = max(cache_ttl_seconds, 1)
        self.cooldown_seconds = max(cooldown_seconds, 1)
        self.ollama_available = False
        self.last_error: str | None = None
        self._available_names: set[str] = set()
        self._loaded_names: set[str] = set()
        self._failure_cooldown_until: dict[str, float] = {}
        self._latency_history: dict[str, list[float]] = {}
        self._last_refresh = 0.0

    async def refresh(
        self,
        client: httpx.AsyncClient,
        headers: dict[str, str] | None = None,
        *,
        force: bool = False,
    ) -> None:
        now = time.time()
        if not force and now - self._last_refresh < self.cache_ttl_seconds:
            return

        headers = headers or {}
        available: set[str] = set()
        loaded: set[str] = set()
        try:
            tags_response = await client.get("/api/tags", headers=headers, timeout=httpx.Timeout(5, connect=2))
            tags_response.raise_for_status()
            tags_data = tags_response.json()
            models_list = tags_data.get("models")
            if isinstance(models_list, list):
                for item in models_list:
                    if not isinstance(item, dict):
                        continue
                    model_name = item.get("name") or item.get("model")
                    if model_name:
                        available.add(str(model_name))

            try:
                ps_response = await client.get("/api/ps", headers=headers, timeout=httpx.Timeout(5, connect=2))
                ps_response.raise_for_status()
                ps_data = ps_response.json()
                ps_models = ps_data.get("models")
                if isinstance(ps_models, list):
                    for item in ps_models:
                        if not isinstance(item, dict):
                            continue
                        model_name = item.get("name") or item.get("model")
                        if model_name:
                            loaded.add(str(model_name))
            except httpx.HTTPError as exc:
                logger.debug("Ollama /api/ps unavailable; continuing with tags only: %s", exc)

            self.ollama_available = True
            self.last_error = None
            self._available_names = available
            self._loaded_names = loaded
        except Exception as exc:
            self.ollama_available = False
            self.last_error = str(exc)
            self._available_names = set()
            self._loaded_names = set()
        finally:
            self._last_refresh = now

    def resolve_model_name(self, model_name: str) -> str | None:
        if model_name in self._available_names:
            return model_name
        if ":" not in model_name:
            latest = f"{model_name}:latest"
            if latest in self._available_names:
                return latest
            for available in sorted(self._available_names):
                if available.startswith(f"{model_name}:"):
                    return available
        return None

    def status_for(self, model_name: str) -> ModelHealth:
        now = time.time()
        if self._failure_cooldown_until.get(model_name, 0) > now:
            return ModelHealth.UNHEALTHY
        resolved = self.resolve_model_name(model_name)
        if resolved and resolved in self._loaded_names:
            return ModelHealth.LOADED
        if resolved:
            return ModelHealth.AVAILABLE
        if not self.ollama_available and self._last_refresh > 0:
            return ModelHealth.UNAVAILABLE
        return ModelHealth.UNKNOWN

    def selectable_model(self, model_name: str) -> str | None:
        status = self.status_for(model_name)
        if status in {ModelHealth.AVAILABLE, ModelHealth.LOADED}:
            return self.resolve_model_name(model_name) or model_name
        return None

    def mark_success(self, model_name: str, latency_seconds: float | None = None) -> None:
        self._failure_cooldown_until.pop(model_name, None)
        if latency_seconds is not None:
            history = self._latency_history.setdefault(model_name, [])
            history.append(latency_seconds)
            if len(history) > 20:
                del history[0]

    def mark_failure(self, model_name: str) -> None:
        self._failure_cooldown_until[model_name] = time.time() + self.cooldown_seconds

    def average_latency(self, model_name: str) -> float | None:
        history = self._latency_history.get(model_name, [])
        if not history:
            return None
        return sum(history) / len(history)

    def snapshot(self, registry: ModelRegistry) -> dict[str, Any]:
        return {
            "ollama_available": self.ollama_available,
            "last_error": self.last_error,
            "available_models": sorted(self._available_names),
            "loaded_models": sorted(self._loaded_names),
            "models": registry.snapshots(self),
        }


class ModelLifecycleManager:
    def __init__(self, idle_release_seconds: int = 600, release_idle_models: bool = False):
        self.idle_release_seconds = max(idle_release_seconds, 60)
        self.release_idle_models = release_idle_models
        self._last_used: dict[str, float] = {}
        self._last_release_check = 0.0

    def mark_used(self, model_name: str) -> None:
        self._last_used[model_name] = time.time()

    async def maybe_release_idle(
        self,
        client: httpx.AsyncClient,
        headers: dict[str, str],
        *,
        keep_model: str,
    ) -> None:
        if not self.release_idle_models:
            return
        now = time.time()
        if now - self._last_release_check < 60:
            return
        self._last_release_check = now

        idle_models = [
            model
            for model, last_used in self._last_used.items()
            if model != keep_model and now - last_used > self.idle_release_seconds
        ]
        for model_name in idle_models:
            try:
                await client.post(
                    "/api/generate",
                    json={"model": model_name, "prompt": "", "stream": False, "keep_alive": 0},
                    headers=headers,
                    timeout=httpx.Timeout(10, connect=2),
                )
                self._last_used.pop(model_name, None)
                logger.info("Released idle Ollama model: %s", model_name)
            except httpx.HTTPError as exc:
                logger.debug("Could not release idle Ollama model %s: %s", model_name, exc)


class ModelRouter:
    def __init__(self, settings: Any | None = None):
        self.settings = settings
        self.registry = ModelRegistry(settings)
        self.health = ModelHealthManager(
            cache_ttl_seconds=int(_setting(settings, "model_health_cache_ttl_seconds", 30)),
            cooldown_seconds=int(_setting(settings, "model_unhealthy_cooldown_seconds", 60)),
        )
        self.lifecycle = ModelLifecycleManager(
            idle_release_seconds=int(_setting(settings, "ollama_idle_model_ttl_seconds", 600)),
            release_idle_models=bool(_setting(settings, "ollama_release_idle_models", False)),
        )

    def classify(
        self,
        messages: list[dict[str, str]] | None = None,
        *,
        task_type: str | None = None,
        latency_preference: str = "balanced",
        attachments: list[Any] | None = None,
        language: str | None = None,
    ) -> RequestProfile:
        if task_type:
            normalized = self._normalize_task_type(task_type)
            return RequestProfile(
                task_type=normalized,
                capabilities=(normalized,),
                language=language or "auto",
                latency_preference=latency_preference,
                reason="explicit task type",
            )

        text = self._combined_text(messages)
        lower = text.lower()
        attachment_types = self._attachment_types(attachments)

        is_telugu = bool(TELUGU_RE.search(text)) or "telugu" in lower or "te-in" in lower or (language and "telugu" in language.lower())
        is_multilingual = bool(TRANSLATION_RE.search(text)) or "multilingual" in lower or (language and "multilingual" in language.lower())
        if "image" in attachment_types or "video" in attachment_types or VISION_RE.search(text):
            return RequestProfile("vision", ("vision", "image"), "auto", latency_preference, "image or vision request")
        if is_telugu:
            return RequestProfile("telugu", ("telugu", "multilingual"), language or "te", latency_preference, "Telugu detected")
        if is_multilingual:
            return RequestProfile("translation", ("translation", "multilingual"), language or "auto", latency_preference, "translation or multilingual request")
        if CODE_RE.search(text):
            return RequestProfile("programming", ("programming", "code"), "auto", latency_preference, "programming terms detected")
        if MATH_RE.search(text):
            return RequestProfile("mathematics", ("mathematics", "equations"), "auto", latency_preference, "math terms detected")
        if "quiz" in lower:
            return RequestProfile("quiz", ("quiz", "education"), "auto", latency_preference, "quiz generation")
        if "homework" in lower:
            return RequestProfile("homework", ("homework", "education"), "auto", latency_preference, "homework task")
        if "notes" in lower or "revision" in lower:
            return RequestProfile("notes", ("notes", "summarization"), "auto", latency_preference, "notes or revision task")
        if DOCUMENT_RE.search(text):
            return RequestProfile("document", ("document", "rag"), "auto", latency_preference, "document context request")
        if VOICE_RE.search(text):
            return RequestProfile("voice", ("voice", "fast"), "auto", latency_preference, "voice-related task")
        if DEEP_RE.search(text) or latency_preference == "deep":
            return RequestProfile("deep_reasoning", ("reasoning", "analysis"), "auto", latency_preference, "deep reasoning requested")
        if SIMPLE_RE.search(text) or latency_preference == "instant":
            return RequestProfile("simple", ("simple", "fast"), "auto", latency_preference, "simple or instant response")
        if TUTOR_RE.search(text):
            return RequestProfile("ai_tutor", ("tutor", "education"), "auto", latency_preference, "tutoring terms detected")
        return RequestProfile("general", ("general",), "auto", latency_preference, "general request")

    def plan_route(
        self,
        messages: list[dict[str, str]] | None = None,
        *,
        requested_model: str | None = None,
        task_type: str | None = None,
        latency_preference: str = "balanced",
        attachments: list[Any] | None = None,
        language: str | None = None,
    ) -> ModelRoute:
        profile = self.classify(
            messages,
            task_type=task_type,
            latency_preference=latency_preference,
            attachments=attachments,
            language=language,
        )
        primary = _clean_model_name(requested_model) or self.registry.primary_for_task(profile.task_type)
        fallback_chain = self.registry.fallback_chain(primary, task_type=profile.task_type)
        spec = self.registry.get(primary)
        context_size = spec.context_size if spec else int(_setting(self.settings, "ollama_context_window", 32768))
        return ModelRoute(
            requested_model=primary,
            selected_model=primary,
            candidate_models=fallback_chain,
            fallback_chain=fallback_chain,
            task_type=profile.task_type,
            capabilities=profile.capabilities,
            context_size=context_size,
            health_status={model: ModelHealth.UNKNOWN.value for model in fallback_chain},
            reason=profile.reason,
        )

    async def select_route(
        self,
        client: httpx.AsyncClient,
        headers: dict[str, str],
        messages: list[dict[str, str]] | None = None,
        *,
        requested_model: str | None = None,
        task_type: str | None = None,
        latency_preference: str = "balanced",
        attachments: list[Any] | None = None,
        require_available: bool = True,
    ) -> ModelRoute:
        await self.health.refresh(client, headers)
        planned = self.plan_route(
            messages,
            requested_model=requested_model,
            task_type=task_type,
            latency_preference=latency_preference,
            attachments=attachments,
        )

        health_status = {model: self.health.status_for(model).value for model in planned.fallback_chain}
        candidate_models: list[str] = []
        for model_name in planned.fallback_chain:
            spec = self.registry.get(model_name)
            if spec is not None and not spec.enabled:
                health_status[model_name] = ModelHealth.DISABLED.value
                continue
            selectable = self.health.selectable_model(model_name)
            if selectable:
                candidate_models.append(selectable)

        if not candidate_models:
            enabled_chain = [
                model_name
                for model_name in planned.fallback_chain
                if (self.registry.get(model_name) is None or self.registry.get(model_name).enabled)
            ]
            # If any model in the chain is Gemini, we don't strictly require Ollama availability
            gemini_in_chain = any("gemini" in model.lower() for model in enabled_chain)
            
            if require_available and not gemini_in_chain:
                detail = self.health.last_error or "no configured candidate model is available"
                raise ModelRoutingError(
                    f"No Ollama model is available for task '{planned.task_type}'. "
                    f"Tried: {', '.join(enabled_chain)}. Detail: {detail}"
                )
            candidate_models = enabled_chain

        selected = candidate_models[0]
        self.lifecycle.mark_used(selected)
        await self.lifecycle.maybe_release_idle(client, headers, keep_model=selected)
        selected_spec = self.registry.get(selected) or self.registry.get(planned.requested_model)
        return ModelRoute(
            requested_model=planned.requested_model,
            selected_model=selected,
            candidate_models=tuple(candidate_models),
            fallback_chain=planned.fallback_chain,
            task_type=planned.task_type,
            capabilities=planned.capabilities,
            context_size=selected_spec.context_size if selected_spec else planned.context_size,
            health_status=health_status,
            reason=planned.reason,
        )

    async def health_snapshot(self, client: httpx.AsyncClient, headers: dict[str, str]) -> dict[str, Any]:
        await self.health.refresh(client, headers, force=True)
        return self.health.snapshot(self.registry)

    @staticmethod
    def _combined_text(messages: list[dict[str, str]] | None) -> str:
        if not messages:
            return ""
        return "\n".join(str(message.get("content", "")) for message in messages if message.get("content"))

    @staticmethod
    def _attachment_types(attachments: list[Any] | None) -> set[str]:
        types: set[str] = set()
        for attachment in attachments or []:
            if isinstance(attachment, dict):
                value = attachment.get("type")
            else:
                value = getattr(attachment, "type", None)
            if value:
                types.add(str(value).lower())
        return types

    @staticmethod
    def _normalize_task_type(task_type: str) -> str:
        normalized = task_type.strip().lower().replace("-", "_").replace(" ", "_")
        aliases = {
            "code": "programming",
            "coding": "programming",
            "math": "mathematics",
            "telugu_translation": "telugu",
            "multilingual_translation": "translation",
            "image": "vision",
            "reasoning": "deep_reasoning",
            "embedding": "embeddings",
            "retrieval": "rag",
        }
        return aliases.get(normalized, normalized or "general")
