from types import SimpleNamespace

import httpx
import pytest

from app.orchestration.model_router import ModelHealthManager, ModelRouter, ModelRoutingError


class _Response:
    def __init__(self, data):
        self._data = data

    def raise_for_status(self):
        return None

    def json(self):
        return self._data


class _HealthClient:
    def __init__(self, models, loaded=None, fail=False):
        self.models = models
        self.loaded = loaded or []
        self.fail = fail

    async def get(self, path, **kwargs):
        if self.fail:
            raise httpx.ConnectError("offline")
        if path == "/api/tags":
            return _Response({"models": [{"name": model} for model in self.models]})
        if path == "/api/ps":
            return _Response({"models": [{"name": model} for model in self.loaded]})
        raise AssertionError(path)


@pytest.mark.parametrize(
    ("prompt", "expected_task", "expected_model"),
    [
        ("Teach me Python classes", "programming", "qwen2.5-coder:7b"),
        ("Solve this quadratic equation", "mathematics", "qwen2-math:7b"),
        ("Explain this in Telugu", "telugu", "aya-expanse:8b"),
        ("Give me a very simple definition", "simple", "gemma3:1b"),
        ("Analyze this difficult problem", "deep_reasoning", "deepseek-r1:7b"),
        ("Teach me photosynthesis", "ai_tutor", "smarter-qwen3:4b"),
    ],
)
def test_model_router_classifies_tasks(prompt, expected_task, expected_model):
    route = ModelRouter().plan_route([{"role": "user", "content": prompt}])

    assert route.task_type == expected_task
    assert route.selected_model == expected_model


@pytest.mark.asyncio
async def test_model_router_selects_available_fallback():
    router = ModelRouter()
    client = _HealthClient(models=["qwen3:4b", "gemma3:4b"], loaded=["qwen3:4b"])

    route = await router.select_route(
        client,
        {},
        [{"role": "user", "content": "Solve this equation: x + 2 = 4"}],
    )

    assert route.requested_model == "qwen2-math:7b"
    assert route.selected_model == "qwen3:4b"
    assert route.health_status["qwen2-math:7b"] == "unknown"
    assert route.health_status["qwen3:4b"] == "loaded"


@pytest.mark.asyncio
async def test_model_router_reports_ollama_offline():
    router = ModelRouter(SimpleNamespace(model_health_cache_ttl_seconds=1))
    client = _HealthClient(models=[], fail=True)

    with pytest.raises(ModelRoutingError) as exc:
        await router.select_route(client, {}, [{"role": "user", "content": "Hello"}])

    assert "No Ollama model is available" in str(exc.value)


def test_embedding_route_does_not_fall_back_to_chat_models():
    route = ModelRouter().plan_route(
        [{"role": "user", "content": "embed this"}],
        task_type="embeddings",
    )

    assert route.fallback_chain == ("nomic-embed-text:latest",)


@pytest.mark.asyncio
async def test_production_loopback_ollama_is_skipped_when_gemini_is_configured():
    settings = SimpleNamespace(
        environment="production",
        ollama_base_url="http://127.0.0.1:11434",
        ollama_allow_local_in_production=False,
        ollama_enabled=True,
        model_fallback_chains={"general": ["gemini-2.0-flash", "ollama:smarter-qwen3:4b"]},
    )
    router = ModelRouter(settings)

    class NoNetworkClient:
        async def get(self, *_args, **_kwargs):
            raise AssertionError("production routing must not probe local Ollama")

    route = await router.select_route(NoNetworkClient(), {}, [{"role": "user", "content": "Hello"}])

    assert route.selected_model == "gemini-2.0-flash"
    assert route.candidate_models == ("gemini-2.0-flash",)


@pytest.mark.asyncio
async def test_failed_health_probe_is_cooled_down_and_not_repeated():
    health = ModelHealthManager(cache_ttl_seconds=1, cooldown_seconds=60)
    calls = 0

    class OfflineClient:
        async def get(self, *_args, **_kwargs):
            nonlocal calls
            calls += 1
            raise httpx.ConnectError("offline")

    client = OfflineClient()
    await health.refresh(client, {})
    await health.refresh(client, {})

    assert calls == 1
    assert health.ollama_available is False
