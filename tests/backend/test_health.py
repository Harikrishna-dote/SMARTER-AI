import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient


ROOT = Path(__file__).parents[2]
sys.path.insert(0, str(ROOT / "backend"))
os.environ["AUTO_CREATE_TABLES"] = "false"

from main import app


def test_health_check():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
