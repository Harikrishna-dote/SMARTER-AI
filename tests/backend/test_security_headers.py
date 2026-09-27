from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware.security_headers import SecurityHeadersMiddleware


def test_permissions_policy_allows_explicit_microphone_permission():
    app = FastAPI()
    app.add_middleware(SecurityHeadersMiddleware)

    @app.get("/probe")
    async def probe():
        return {"ok": True}

    with TestClient(app) as client:
        response = client.get("/probe")

    assert response.headers["permissions-policy"] == "camera=(), microphone=(self), geolocation=()"
