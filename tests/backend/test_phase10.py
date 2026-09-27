import pytest
from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_ready_endpoint():
    response = client.get("/ready")
    assert response.status_code == 200
    assert "status" in response.json()


def test_plugin_list_endpoint():
    response = client.get("/api/v1/developer/plugins")
    assert response.status_code in (401, 403, 200)


def test_agent_list_endpoint():
    response = client.get("/api/v1/developer/agents")
    assert response.status_code in (401, 403, 200)


def test_analytics_platform_usage():
    response = client.get("/api/v1/analytics/platform-usage")
    assert response.status_code in (401, 403, 200)


def test_audit_logs_endpoint():
    response = client.get("/api/v1/audit/logs")
    assert response.status_code in (401, 403, 200)


def test_security_events_endpoint():
    response = client.get("/api/v1/audit/security-events")
    assert response.status_code in (401, 403, 200)
