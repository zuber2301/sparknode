"""
Auth Login Modules Tests
=========================
Tests for login and /me endpoints returning enabled_modules.
Uses in-memory SQLite with FastAPI TestClient.
"""

import pytest
import uuid
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB as PG_JSONB

from main import app
from database import Base, get_db
from models import User, Tenant, Department, Wallet
from auth.utils import get_password_hash, create_access_token

# ── SQLite compatibility ────────────────────────────────────────────────
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@compiles(PG_UUID, "sqlite")
def compile_uuid_sqlite(type_, compiler, **kw):
    return "VARCHAR(36)"


@compiles(PG_JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "TEXT"


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

# ── Fixed UUIDs ─────────────────────────────────────────────────────────
TENANT_ID = uuid.UUID("550e8400-e29b-41d4-a716-446655440002")
DEPT_ID = uuid.UUID("660e8400-e29b-41d4-a716-446655440002")
USER_ID = uuid.UUID("770e8400-e29b-41d4-a716-446655440002")
PASSWORD = "password123"


def _seed(db, enabled_modules=None, email="user@loginco.com"):
    tenant = Tenant(
        id=TENANT_ID,
        name="LoginCo",
        slug="loginco",
        status="active",
        subscription_tier="starter",
        enabled_modules=enabled_modules or {"sparknode": True, "ignitenode": False},
        feature_flags={},
    )
    db.add(tenant)
    db.flush()

    dept = Department(id=DEPT_ID, tenant_id=TENANT_ID, name="HR")
    db.add(dept)
    db.flush()

    user = User(
        id=USER_ID,
        tenant_id=TENANT_ID,
        corporate_email=email,
        password_hash=get_password_hash(PASSWORD),
        first_name="Login",
        last_name="User",
        org_role="tenant_user",
        department_id=DEPT_ID,
        status="ACTIVE",
    )
    db.add(user)
    db.flush()

    wallet = Wallet(tenant_id=TENANT_ID, user_id=USER_ID, balance=0)
    db.add(wallet)
    db.commit()


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


# ─── Login Response Tests ───────────────────────────────────────────────

class TestLoginReturnsModules:

    def test_login_returns_sparknode_modules(self):
        db = TestingSessionLocal()
        _seed(db, enabled_modules={"sparknode": True, "ignitenode": False})
        db.close()

        r = client.post("/api/auth/login", json={
            "email": "user@loginco.com",
            "password": PASSWORD,
        })
        assert r.status_code == 200
        body = r.json()
        user_data = body["user"]
        assert user_data["enabled_modules"]["sparknode"] is True
        assert user_data["enabled_modules"]["ignitenode"] is False

    def test_login_returns_both_modules(self):
        db = TestingSessionLocal()
        _seed(db, enabled_modules={"sparknode": True, "ignitenode": True})
        db.close()

        r = client.post("/api/auth/login", json={
            "email": "user@loginco.com",
            "password": PASSWORD,
        })
        assert r.status_code == 200
        user_data = r.json()["user"]
        assert user_data["enabled_modules"]["sparknode"] is True
        assert user_data["enabled_modules"]["ignitenode"] is True

    def test_login_returns_ignitenode_only(self):
        db = TestingSessionLocal()
        _seed(db, enabled_modules={"sparknode": False, "ignitenode": True})
        db.close()

        r = client.post("/api/auth/login", json={
            "email": "user@loginco.com",
            "password": PASSWORD,
        })
        assert r.status_code == 200
        user_data = r.json()["user"]
        assert user_data["enabled_modules"]["sparknode"] is False
        assert user_data["enabled_modules"]["ignitenode"] is True

    def test_login_returns_access_token(self):
        db = TestingSessionLocal()
        _seed(db)
        db.close()

        r = client.post("/api/auth/login", json={
            "email": "user@loginco.com",
            "password": PASSWORD,
        })
        assert r.status_code == 200
        body = r.json()
        assert body["access_token"]
        assert body["token_type"] == "bearer"

    def test_login_wrong_password(self):
        db = TestingSessionLocal()
        _seed(db)
        db.close()

        r = client.post("/api/auth/login", json={
            "email": "user@loginco.com",
            "password": "wrongpassword",
        })
        assert r.status_code == 401

    def test_login_nonexistent_user(self):
        db = TestingSessionLocal()
        _seed(db)
        db.close()

        r = client.post("/api/auth/login", json={
            "email": "nobody@loginco.com",
            "password": PASSWORD,
        })
        assert r.status_code == 401

    def test_login_with_tenant_slug(self):
        db = TestingSessionLocal()
        _seed(db)
        db.close()

        r = client.post("/api/auth/login", json={
            "email": "user@loginco.com",
            "password": PASSWORD,
            "tenant_slug": "loginco",
        })
        assert r.status_code == 200
        assert r.json()["user"]["tenant_name"] == "LoginCo"

    def test_login_wrong_tenant_slug(self):
        db = TestingSessionLocal()
        _seed(db)
        db.close()

        r = client.post("/api/auth/login", json={
            "email": "user@loginco.com",
            "password": PASSWORD,
            "tenant_slug": "nonexistent",
        })
        assert r.status_code == 404


# ─── /me Endpoint Tests ─────────────────────────────────────────────────

class TestMeReturnsModules:

    def _get_token(self):
        r = client.post("/api/auth/login", json={
            "email": "user@loginco.com",
            "password": PASSWORD,
        })
        return r.json()["access_token"]

    def test_me_returns_enabled_modules(self):
        db = TestingSessionLocal()
        _seed(db, enabled_modules={"sparknode": True, "ignitenode": True})
        db.close()

        token = self._get_token()
        r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        body = r.json()
        assert body["enabled_modules"]["sparknode"] is True
        assert body["enabled_modules"]["ignitenode"] is True

    def test_me_returns_tenant_flags(self):
        db = TestingSessionLocal()
        _seed(db)
        db.close()

        token = self._get_token()
        r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        body = r.json()
        assert "tenant_flags" in body

    def test_me_returns_user_fields(self):
        db = TestingSessionLocal()
        _seed(db)
        db.close()

        token = self._get_token()
        r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        body = r.json()
        assert body["first_name"] == "Login"
        assert body["last_name"] == "User"
        assert body["org_role"] == "tenant_user"
        assert body["status"] == "ACTIVE"

    def test_me_unauthenticated(self):
        r = client.get("/api/auth/me")
        assert r.status_code in (401, 403)
