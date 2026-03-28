"""
Platform Tenant Provisioning & Feature Flags Tests
====================================================
Tests for tenant CRUD with enabled_modules and feature_flags update endpoint.
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
from core.rbac import get_platform_admin

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
PLATFORM_TENANT_ID = uuid.UUID("550e8400-e29b-41d4-a716-446655440010")
PLATFORM_DEPT_ID = uuid.UUID("660e8400-e29b-41d4-a716-446655440010")
PLATFORM_USER_ID = uuid.UUID("770e8400-e29b-41d4-a716-446655440010")
PLATFORM_ADMIN_ID = uuid.UUID("880e8400-e29b-41d4-a716-446655440010")

# Test tenant for feature flag updates
TEST_TENANT_ID = uuid.UUID("550e8400-e29b-41d4-a716-446655440020")


def _seed_platform_admin(db):
    """Create the platform admin tenant, department, user, and system_admin record."""
    tenant = Tenant(
        id=PLATFORM_TENANT_ID,
        name="Platform",
        slug="platform",
        status="active",
        subscription_tier="enterprise",
        enabled_modules={"sparknode": True, "ignitenode": True},
        feature_flags={},
    )
    db.add(tenant)
    db.flush()

    dept = Department(id=PLATFORM_DEPT_ID, tenant_id=PLATFORM_TENANT_ID, name="Platform Ops")
    db.add(dept)
    db.flush()

    user = User(
        id=PLATFORM_USER_ID,
        tenant_id=PLATFORM_TENANT_ID,
        corporate_email="platform@admin.com",
        password_hash=get_password_hash("platformpass"),
        first_name="Platform",
        last_name="Admin",
        org_role="platform_admin",
        department_id=PLATFORM_DEPT_ID,
        status="ACTIVE",
    )
    db.add(user)
    db.flush()

    sa = SystemAdmin(
        admin_id=PLATFORM_ADMIN_ID,
        user_id=PLATFORM_USER_ID,
        access_level="PLATFORM_ADMIN",
    )
    db.add(sa)
    db.flush()

    wallet = Wallet(tenant_id=PLATFORM_TENANT_ID, user_id=PLATFORM_USER_ID, balance=0)
    db.add(wallet)
    db.commit()

    return user


def _seed_test_tenant(db):
    """Create a second tenant for feature flag update tests."""
    tenant = Tenant(
        id=TEST_TENANT_ID,
        name="TestFlagCo",
        slug="testflagco",
        status="active",
        subscription_tier="starter",
        enabled_modules={"sparknode": True, "ignitenode": False},
        feature_flags={"ai_copilot": False, "tango_card": False},
    )
    db.add(tenant)
    db.commit()
    return tenant


def _platform_headers():
    token = create_access_token(
        data={
            "sub": str(PLATFORM_ADMIN_ID),
            "user_id": str(PLATFORM_USER_ID),
            "email": "platform@admin.com",
            "org_role": "platform_admin",
            "type": "system",
        }
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_platform_admin, None)


# ─── Tenant Provisioning with enabled_modules ──────────────────────────

class TestTenantProvisioning:

    def _override_platform_admin(self):
        """Override the get_platform_admin dependency to return our seeded admin."""
        db = TestingSessionLocal()
        admin = db.query(User).filter(User.id == PLATFORM_USER_ID).first()
        db.close()
        app.dependency_overrides[get_platform_admin] = lambda: admin

    def test_create_tenant_default_modules(self):
        db = TestingSessionLocal()
        _seed_platform_admin(db)
        db.close()
        self._override_platform_admin()

        r = client.post(
            "/api/platform/tenants",
            json={
                "name": "DefaultModCo",
                "slug": "defaultmodco",
                "admin_email": "admin@defaultmod.com",
                "admin_first_name": "Admin",
                "admin_last_name": "Default",
                "admin_password": "securepass123",
            },
            headers=_platform_headers(),
        )
        assert r.status_code == 200, f"Create failed: {r.text}"
        body = r.json()
        assert body["enabled_modules"]["sparknode"] is True
        assert body["enabled_modules"]["ignitenode"] is False

    def test_create_tenant_both_modules(self):
        db = TestingSessionLocal()
        _seed_platform_admin(db)
        db.close()
        self._override_platform_admin()

        r = client.post(
            "/api/platform/tenants",
            json={
                "name": "BothModCo",
                "slug": "bothmodco",
                "admin_email": "admin@bothmod.com",
                "admin_first_name": "Admin",
                "admin_last_name": "Both",
                "admin_password": "securepass123",
                "enabled_modules": {"sparknode": True, "ignitenode": True},
            },
            headers=_platform_headers(),
        )
        assert r.status_code == 200, f"Create failed: {r.text}"
        body = r.json()
        assert body["enabled_modules"]["sparknode"] is True
        assert body["enabled_modules"]["ignitenode"] is True

    def test_create_tenant_ignitenode_only(self):
        db = TestingSessionLocal()
        _seed_platform_admin(db)
        db.close()
        self._override_platform_admin()

        r = client.post(
            "/api/platform/tenants",
            json={
                "name": "IgniteOnlyCo",
                "slug": "igniteonlyco",
                "admin_email": "admin@igniteonly.com",
                "admin_first_name": "Admin",
                "admin_last_name": "Ignite",
                "admin_password": "securepass123",
                "enabled_modules": {"sparknode": False, "ignitenode": True},
            },
            headers=_platform_headers(),
        )
        assert r.status_code == 200, f"Create failed: {r.text}"
        body = r.json()
        assert body["enabled_modules"]["sparknode"] is False
        assert body["enabled_modules"]["ignitenode"] is True

    def test_create_tenant_has_required_fields(self):
        db = TestingSessionLocal()
        _seed_platform_admin(db)
        db.close()
        self._override_platform_admin()

        r = client.post(
            "/api/platform/tenants",
            json={
                "name": "FieldsCo",
                "slug": "fieldsco",
                "admin_email": "admin@fieldsco.com",
                "admin_first_name": "Admin",
                "admin_last_name": "Fields",
                "admin_password": "securepass123",
                "subscription_tier": "professional",
                "display_currency": "INR",
                "fx_rate": "83.0",
            },
            headers=_platform_headers(),
        )
        assert r.status_code == 200, f"Create failed: {r.text}"
        body = r.json()
        assert body["name"] == "FieldsCo"
        assert body["slug"] == "fieldsco"
        assert body["subscription_tier"] == "professional"
        assert body["display_currency"] == "INR"

    def test_create_tenant_duplicate_slug_rejected(self):
        db = TestingSessionLocal()
        _seed_platform_admin(db)
        db.close()
        self._override_platform_admin()

        # Create first tenant
        client.post(
            "/api/platform/tenants",
            json={
                "name": "DupCo1",
                "slug": "dupco",
                "admin_email": "admin1@dupco.com",
                "admin_first_name": "Admin",
                "admin_last_name": "One",
                "admin_password": "securepass123",
            },
            headers=_platform_headers(),
        )
        # Attempt duplicate slug
        r = client.post(
            "/api/platform/tenants",
            json={
                "name": "DupCo2",
                "slug": "dupco",
                "admin_email": "admin2@dupco.com",
                "admin_first_name": "Admin",
                "admin_last_name": "Two",
                "admin_password": "securepass123",
            },
            headers=_platform_headers(),
        )
        assert r.status_code == 400
        assert "Slug already in use" in r.json()["detail"]


# ─── Feature Flags Update with enabled_modules ─────────────────────────

class TestFeatureFlagsUpdate:

    def _override_platform_admin(self):
        db = TestingSessionLocal()
        admin = db.query(User).filter(User.id == PLATFORM_USER_ID).first()
        db.close()
        app.dependency_overrides[get_platform_admin] = lambda: admin

    def test_update_feature_flags_only(self):
        db = TestingSessionLocal()
        _seed_platform_admin(db)
        _seed_test_tenant(db)
        db.close()
        self._override_platform_admin()

        r = client.patch(
            f"/api/platform/tenants/{TEST_TENANT_ID}/feature_flags",
            json={"feature_flags": {"ai_copilot": True, "tango_card": True}},
            headers=_platform_headers(),
        )
        assert r.status_code == 200, f"Update failed: {r.text}"
        body = r.json()
        assert body["feature_flags"]["ai_copilot"] is True
        assert body["feature_flags"]["tango_card"] is True

    def test_update_feature_flags_with_modules(self):
        db = TestingSessionLocal()
        _seed_platform_admin(db)
        _seed_test_tenant(db)
        db.close()
        self._override_platform_admin()

        r = client.patch(
            f"/api/platform/tenants/{TEST_TENANT_ID}/feature_flags",
            json={
                "feature_flags": {"sales_marketing": True},
                "enabled_modules": {"sparknode": True, "ignitenode": True},
            },
            headers=_platform_headers(),
        )
        assert r.status_code == 200, f"Update failed: {r.text}"
        body = r.json()
        assert body["enabled_modules"]["ignitenode"] is True

    def test_update_modules_without_feature_flags_change(self):
        db = TestingSessionLocal()
        _seed_platform_admin(db)
        _seed_test_tenant(db)
        db.close()
        self._override_platform_admin()

        r = client.patch(
            f"/api/platform/tenants/{TEST_TENANT_ID}/feature_flags",
            json={
                "feature_flags": {},
                "enabled_modules": {"sparknode": False, "ignitenode": True},
            },
            headers=_platform_headers(),
        )
        assert r.status_code == 200, f"Update failed: {r.text}"
        body = r.json()
        assert body["enabled_modules"]["sparknode"] is False
        assert body["enabled_modules"]["ignitenode"] is True

    def test_update_nonexistent_tenant_returns_404(self):
        db = TestingSessionLocal()
        _seed_platform_admin(db)
        db.close()
        self._override_platform_admin()

        fake_id = uuid.uuid4()
        r = client.patch(
            f"/api/platform/tenants/{fake_id}/feature_flags",
            json={"feature_flags": {"ai_copilot": True}},
            headers=_platform_headers(),
        )
        assert r.status_code == 404

    def test_get_feature_flags(self):
        db = TestingSessionLocal()
        _seed_platform_admin(db)
        _seed_test_tenant(db)
        db.close()
        self._override_platform_admin()

        r = client.get(
            f"/api/platform/tenants/{TEST_TENANT_ID}/feature_flags",
            headers=_platform_headers(),
        )
        assert r.status_code == 200
        body = r.json()
        assert "feature_flags" in body
        assert body["tenant_id"] == str(TEST_TENANT_ID)


# ─── Tenant List returns enabled_modules ────────────────────────────────

class TestTenantListModules:

    def _override_platform_admin(self):
        db = TestingSessionLocal()
        admin = db.query(User).filter(User.id == PLATFORM_USER_ID).first()
        db.close()
        app.dependency_overrides[get_platform_admin] = lambda: admin

    def test_list_tenants_includes_modules(self):
        db = TestingSessionLocal()
        _seed_platform_admin(db)
        _seed_test_tenant(db)
        db.close()
        self._override_platform_admin()

        r = client.get("/api/platform/tenants", headers=_platform_headers())
        assert r.status_code == 200
        tenants = r.json()
        assert isinstance(tenants, list)
        assert len(tenants) >= 1

        # Find the test tenant
        test_tenant = next((t for t in tenants if t["slug"] == "testflagco"), None)
        if test_tenant:
            assert "enabled_modules" in test_tenant
            assert test_tenant["enabled_modules"]["sparknode"] is True
