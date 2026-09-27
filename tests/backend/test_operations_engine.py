import os
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient


ROOT = Path(__file__).parents[2]
sys.path.insert(0, str(ROOT / "backend"))
os.environ["AUTO_CREATE_TABLES"] = "false"

import app.api.operations.router as operations_router
from app.application.operations_engine import OperationsEngine
from app.domain.operations import build_production_readiness_report
from main import app


def _settings(**overrides):
    values = {
        "app_name": "SMARTER AI",
        "environment": "development",
        "api_v1_prefix": "/api/v1",
        "jwt_secret": "x" * 32,
        "cors_origins": ["http://localhost:5173"],
        "redis_url": "redis://localhost:6379/0",
        "gzip_minimum_size": 500,
        "allowed_hosts": [],
        "auto_create_tables": False,
        "create_default_admin": False,
        "access_token_expire_minutes": 120,
        "max_chat_history_messages": 200,
        "max_context_chars": 50000,
        "feature_flags": {"virtual_labs": False},
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_production_readiness_blocks_unsafe_production_defaults() -> None:
    report = build_production_readiness_report(
        _settings(
            environment="production",
            jwt_secret="short-secret",
            cors_origins=["*"],
            allowed_hosts=[],
            auto_create_tables=True,
            create_default_admin=True,
        )
    )

    assert report.status == "blocked"
    assert any("jwt_secret_strength" in blocker for blocker in report.blockers)
    assert any("trusted_hosts" in blocker for blocker in report.blockers)
    assert any("schema_migrations" in blocker for blocker in report.blockers)


def test_operations_engine_maps_readiness_response_without_secrets() -> None:
    response = OperationsEngine(_settings(), metrics_available=True).readiness()

    assert response.status == "ready"
    assert response.feature_flags == {"virtual_labs": False}
    serialized = response.model_dump_json()
    assert "xxxxxxxx" not in serialized


@pytest.mark.asyncio
async def test_operations_route_returns_readiness_response(monkeypatch) -> None:
    monkeypatch.setattr(
        operations_router,
        "OperationsEngine",
        lambda: OperationsEngine(_settings(environment="development"), metrics_available=True),
    )

    response = await operations_router.readiness()

    assert response.service == "SMARTER AI"
    assert response.api_version_prefix == "/api/v1"
    assert response.status == "ready"


def test_health_and_authenticated_apis_have_safe_cache_headers() -> None:
    client = TestClient(app)

    health = client.get("/health")
    api_response = client.get("/api/v1/users/dashboard")

    assert health.status_code == 200
    assert "public" in health.headers["cache-control"]
    assert api_response.status_code == 401
    assert api_response.headers["cache-control"] == "no-store"


def test_ready_probe_exposes_non_secret_status() -> None:
    client = TestClient(app)

    response = client.get("/ready")

    assert response.status_code == 200
    data = response.json()
    assert set(data) == {"status", "service", "environment", "api_version_prefix"}
