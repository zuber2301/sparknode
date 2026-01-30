import pytest
from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_health_endpoint():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json().get("status") == "healthy"


def test_auth_login_seeded_admin():
    """Verify seeded system admin can login (requires DB + seed present).

    This smoke test expects the local dev DB to be seeded with admin@sparknode.io
    and password `jspark123` as provided in `database/seed.sql`.
    """
    payload = {"email": "admin@sparknode.io", "password": "jspark123"}
    r = client.post("/api/auth/login", json=payload)

    # If DB is not reachable or app not started correctly, give a helpful message
    assert r.status_code == 200, f"Auth login failed: {r.status_code} - {r.text}"
    body = r.json()
    assert "access_token" in body and body["access_token"], "No access token returned"
