"""
Auth Experiences Endpoint Tests
================================
Tests for GET /auth/experiences with all enabled_modules combinations.
Uses in-memory SQLite with FastAPI TestClient.
"""

import pytest
import uuid
import sys
import os
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB as PG_JSONB

from main import app
from database import Base, get_db
from models import User, Tenant, Department, Wallet, SystemAdmin
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
TENANT_ID = uuid.UUID("550e8400-e29b-41d4-a716-446655440001")
DEPT_ID = uuid.UUID("660e8400-e29b-41d4-a716-446655440001")
USER_ID = uuid.UUID("770e8400-e29b-41d4-a716-446655440001")


# ── Helpers ─────────────────────────────────────────────────────────────
def _make_token(user_id=USER_ID, tenant_id=TENANT_ID, role="tenant_user"):
    return create_access_token(
        data={
            "sub": str(user_id),
            "tenant_id": str(tenant_id),
            "email": "user@testco.com",
            "org_role": role,
            "type": "tenant",
        }
    )


def _seed(db, enabled_modules=None, feature_flags=None, tier="starter"):
    tenant = Tenant(
        id=TENANT_ID,
        name="TestCo",
        slug="testco",
        status="active",
        subscription_tier=tier,
        enabled_modules=enabled_modules,
        feature_flags=feature_flags or {},
    )
    db.add(tenant)
    db.flush()

    dept = Department(id=DEPT_ID, tenant_id=TENANT_ID, name="Engineering")
    db.add(dept)
    db.flush()

    user = User(
        id=USER_ID,
        tenant_id=TENANT_ID,
        corporate_email="user@testco.com",
        password_hash=get_password_hash("password123"),
        first_name="Test",
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


# ─── Tests: /auth/experiences ───────────────────────────────────────────

class TestExperiencesSparkNodeOnly:
    """Tenant with only SparkNode enabled."""

    def test_sparknode_only_returns_engagement(self):
        db = TestingSessionLocal()
        _seed(db, enabled_modules={"sparknode": True, "ignitenode": False})
        db.close()

        headers = {"Authorization": f"Bearer {_make_token()}"}
        r = client.get("/api/auth/experiences", headers=headers)
        assert r.status_code == 200
        body = r.json()
        assert body["experiences"] == ["engagement"]
        assert body["spark_access"] is True
        assert body["ignite_access"] is False

    def test_sparknode_only_modules_returned(self):
        db = TestingSessionLocal()
        _seed(db, enabled_modules={"sparknode": True, "ignitenode": False})
        db.close()

        headers = {"Authorization": f"Bearer {_make_token()}"}
        r = client.get("/api/auth/experiences", headers=headers)
        body = r.json()
        assert body["enabled_modules"]["sparknode"] is True
        assert body["enabled_modules"]["ignitenode"] is False


class TestExperiencesIgniteNodeOnly:
    """Tenant with only IgniteNode enabled."""

    def test_ignitenode_only_returns_growth(self):
        db = TestingSessionLocal()
        _seed(db, enabled_modules={"sparknode": False, "ignitenode": True})
        db.close()

        headers = {"Authorization": f"Bearer {_make_token()}"}
        r = client.get("/api/auth/experiences", headers=headers)
        assert r.status_code == 200
        body = r.json()
        assert body["experiences"] == ["growth"]
        assert body["spark_access"] is False
        assert body["ignite_access"] is True


class TestExperiencesBothModules:
    """Tenant with both modules enabled."""

    def test_both_modules_returns_both_experiences(self):
        db = TestingSessionLocal()
        _seed(db, enabled_modules={"sparknode": True, "ignitenode": True})
        db.close()

        headers = {"Authorization": f"Bearer {_make_token()}"}
        r = client.get("/api/auth/experiences", headers=headers)
        assert r.status_code == 200
        body = r.json()
        assert "engagement" in body["experiences"]
        assert "growth" in body["experiences"]
        assert body["spark_access"] is True
        assert body["ignite_access"] is True


class TestExperiencesLegacyFallback:
    """Tenant without enabled_modules — uses feature_flags/tier fallback."""

    def test_legacy_no_modules_defaults_to_sparknode(self):
        db = TestingSessionLocal()
        _seed(db, enabled_modules=None, feature_flags={})
        db.close()

        headers = {"Authorization": f"Bearer {_make_token()}"}
        r = client.get("/api/auth/experiences", headers=headers)
        body = r.json()
        assert "engagement" in body["experiences"]
        assert body["spark_access"] is True

    def test_legacy_sales_flag_enables_ignite(self):
        db = TestingSessionLocal()
        _seed(db, enabled_modules=None, feature_flags={"sales_marketing": True})
        db.close()

        headers = {"Authorization": f"Bearer {_make_token()}"}
        r = client.get("/api/auth/experiences", headers=headers)
        body = r.json()
        assert "growth" in body["experiences"]
        assert body["ignite_access"] is True

    def test_legacy_typo_flag_enables_ignite(self):
        """Backward-compat: tolerate the historical 'sales_marketting_enabled' typo."""
        db = TestingSessionLocal()
        _seed(db, enabled_modules=None, feature_flags={"sales_marketting_enabled": True})
        db.close()

        headers = {"Authorization": f"Bearer {_make_token()}"}
        r = client.get("/api/auth/experiences", headers=headers)
        body = r.json()
        assert body["ignite_access"] is True

    def test_legacy_enterprise_tier_enables_ignite(self):
        db = TestingSessionLocal()
        _seed(db, enabled_modules=None, feature_flags={}, tier="enterprise")
        db.close()

        headers = {"Authorization": f"Bearer {_make_token()}"}
        r = client.get("/api/auth/experiences", headers=headers)
        body = r.json()
        assert body["ignite_access"] is True

    def test_legacy_starter_tier_no_ignite(self):
        db = TestingSessionLocal()
        _seed(db, enabled_modules=None, feature_flags={}, tier="starter")
        db.close()

        headers = {"Authorization": f"Bearer {_make_token()}"}
        r = client.get("/api/auth/experiences", headers=headers)
        body = r.json()
        assert body["ignite_access"] is False


class TestExperiencesSafetyFallback:
    """Edge case: both modules false -> safety fallback to engagement."""

    def test_neither_module_falls_back_to_engagement(self):
        db = TestingSessionLocal()
        _seed(db, enabled_modules={"sparknode": False, "ignitenode": False})
        db.close()

        headers = {"Authorization": f"Bearer {_make_token()}"}
        r = client.get("/api/auth/experiences", headers=headers)
        body = r.json()
        # Safety fallback: at least engagement
        assert "engagement" in body["experiences"]
        assert body["spark_access"] is True


class TestExperiencesUnauthenticated:
    """Unauthenticated requests should be rejected."""

    def test_no_token_returns_401_or_403(self):
        r = client.get("/api/auth/experiences")
        assert r.status_code in (401, 403)

    def test_invalid_token_returns_401_or_403(self):
        headers = {"Authorization": "Bearer invalidtoken123"}
        r = client.get("/api/auth/experiences", headers=headers)
        assert r.status_code in (401, 403)
