"""
Module Switching E2E Workflow Tests
====================================
End-to-end tests for the complete SparkNode/IgniteNode module switching flow:
  1. Provision tenant with modules
  2. Login obtains enabled_modules
  3. /experiences returns correct experiences
  4. Feature flags update changes modules
  5. Re-querying /experiences reflects the change
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
PLATFORM_TENANT_ID = uuid.UUID("550e8400-e29b-41d4-a716-446655440050")
PLATFORM_DEPT_ID = uuid.UUID("660e8400-e29b-41d4-a716-446655440050")
PLATFORM_USER_ID = uuid.UUID("770e8400-e29b-41d4-a716-446655440050")
PLATFORM_ADMIN_ID = uuid.UUID("880e8400-e29b-41d4-a716-446655440050")

TENANT_ID = uuid.UUID("550e8400-e29b-41d4-a716-446655440060")
DEPT_ID = uuid.UUID("660e8400-e29b-41d4-a716-446655440060")
USER_ID = uuid.UUID("770e8400-e29b-41d4-a716-446655440060")
PASSWORD = "password123"


def _seed_all(db, tenant_modules=None):
    """Seed platform admin + test tenant + test user."""
    # Platform Admin tenant
    plat = Tenant(
        id=PLATFORM_TENANT_ID,
        name="Platform",
        slug="platform-e2e",
        status="active",
        subscription_tier="enterprise",
        enabled_modules={"sparknode": True, "ignitenode": True},
        feature_flags={},
    )
    db.add(plat)
    db.flush()

    plat_dept = Department(id=PLATFORM_DEPT_ID, tenant_id=PLATFORM_TENANT_ID, name="Ops")
    db.add(plat_dept)
    db.flush()

    plat_user = User(
        id=PLATFORM_USER_ID,
        tenant_id=PLATFORM_TENANT_ID,
        corporate_email="platform@e2e.com",
        password_hash=get_password_hash("platformpass"),
        first_name="Plat",
        last_name="Admin",
        org_role="platform_admin",
        department_id=PLATFORM_DEPT_ID,
        status="ACTIVE",
    )
    db.add(plat_user)
    db.flush()

    sa = SystemAdmin(admin_id=PLATFORM_ADMIN_ID, user_id=PLATFORM_USER_ID, access_level="PLATFORM_ADMIN")
    db.add(sa)

    plat_wallet = Wallet(tenant_id=PLATFORM_TENANT_ID, user_id=PLATFORM_USER_ID, balance=0)
    db.add(plat_wallet)
    db.flush()

    # Test tenant
    tenant = Tenant(
        id=TENANT_ID,
        name="E2ECo",
        slug="e2eco",
        status="active",
        subscription_tier="professional",
        enabled_modules=tenant_modules or {"sparknode": True, "ignitenode": False},
        feature_flags={},
    )
    db.add(tenant)
    db.flush()

    dept = Department(id=DEPT_ID, tenant_id=TENANT_ID, name="Engineering")
    db.add(dept)
    db.flush()

    user = User(
        id=USER_ID,
        tenant_id=TENANT_ID,
        corporate_email="user@e2eco.com",
        password_hash=get_password_hash(PASSWORD),
        first_name="E2E",
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


def _platform_headers():
    return {
        "Authorization": f"Bearer {create_access_token(data={'sub': str(PLATFORM_ADMIN_ID), 'user_id': str(PLATFORM_USER_ID), 'email': 'platform@e2e.com', 'org_role': 'platform_admin', 'type': 'system'})}"
    }


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.pop(get_platform_admin, None)


# ═══════════════════════════════════════════════════════════════════════
# E2E WORKFLOW: SparkNode only → enable IgniteNode → both → IgniteNode only
# ═══════════════════════════════════════════════════════════════════════

class TestModuleSwitchingWorkflow:
    """Full lifecycle: provision → login → check experiences → update → re-check."""

    def _override_admin(self):
        db = TestingSessionLocal()
        admin = db.query(User).filter(User.id == PLATFORM_USER_ID).first()
        db.close()
        app.dependency_overrides[get_platform_admin] = lambda: admin

    def _login(self):
        r = client.post("/api/auth/login", json={
            "email": "user@e2eco.com",
            "password": PASSWORD,
        })
        assert r.status_code == 200
        return r.json()

    def _get_experiences(self, token):
        r = client.get(
            "/api/auth/experiences",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r.status_code == 200
        return r.json()

    def test_step1_sparknode_only_login(self):
        """Login with SparkNode-only tenant returns correct modules."""
        db = TestingSessionLocal()
        _seed_all(db, {"sparknode": True, "ignitenode": False})
        db.close()

        login_data = self._login()
        assert login_data["user"]["enabled_modules"]["sparknode"] is True
        assert login_data["user"]["enabled_modules"]["ignitenode"] is False

    def test_step2_sparknode_only_experiences(self):
        """SparkNode-only tenant sees engagement only."""
        db = TestingSessionLocal()
        _seed_all(db, {"sparknode": True, "ignitenode": False})
        db.close()

        login_data = self._login()
        exp = self._get_experiences(login_data["access_token"])
        assert exp["experiences"] == ["engagement"]
        assert exp["spark_access"] is True
        assert exp["ignite_access"] is False

    def test_step3_enable_ignitenode_via_flags(self):
        """Platform admin enables IgniteNode, /experiences reflects it."""
        db = TestingSessionLocal()
        _seed_all(db, {"sparknode": True, "ignitenode": False})
        db.close()
        self._override_admin()

        # Login first
        login_data = self._login()
        token = login_data["access_token"]

        # Verify starts SparkNode-only
        exp = self._get_experiences(token)
        assert exp["experiences"] == ["engagement"]

        # Platform admin enables IgniteNode
        r = client.patch(
            f"/api/platform/tenants/{TENANT_ID}/feature_flags",
            json={
                "feature_flags": {},
                "enabled_modules": {"sparknode": True, "ignitenode": True},
            },
            headers=_platform_headers(),
        )
        assert r.status_code == 200

        # Now experiences should include both
        exp2 = self._get_experiences(token)
        assert "engagement" in exp2["experiences"]
        assert "growth" in exp2["experiences"]
        assert exp2["spark_access"] is True
        assert exp2["ignite_access"] is True

    def test_step4_switch_to_ignitenode_only(self):
        """Disable SparkNode, only IgniteNode remains."""
        db = TestingSessionLocal()
        _seed_all(db, {"sparknode": True, "ignitenode": True})
        db.close()
        self._override_admin()

        login_data = self._login()
        token = login_data["access_token"]

        # Both modules initially
        exp = self._get_experiences(token)
        assert "engagement" in exp["experiences"]
        assert "growth" in exp["experiences"]

        # Disable SparkNode
        r = client.patch(
            f"/api/platform/tenants/{TENANT_ID}/feature_flags",
            json={
                "feature_flags": {},
                "enabled_modules": {"sparknode": False, "ignitenode": True},
            },
            headers=_platform_headers(),
        )
        assert r.status_code == 200

        # Now only growth
        exp2 = self._get_experiences(token)
        assert exp2["experiences"] == ["growth"]
        assert exp2["spark_access"] is False
        assert exp2["ignite_access"] is True

    def test_step5_both_modules_full_access(self):
        """Both modules enabled — user sees engagement + growth."""
        db = TestingSessionLocal()
        _seed_all(db, {"sparknode": True, "ignitenode": True})
        db.close()

        login_data = self._login()
        exp = self._get_experiences(login_data["access_token"])
        assert set(exp["experiences"]) == {"engagement", "growth"}

    def test_step6_login_includes_roles(self):
        """Login response includes role information."""
        db = TestingSessionLocal()
        _seed_all(db)
        db.close()

        login_data = self._login()
        user = login_data["user"]
        assert user["org_role"] == "tenant_user"
        assert "tenant_user" in (user.get("roles") or user["org_role"])

    def test_step7_me_reflects_module_changes(self):
        """After module update, /me still works and returns current modules."""
        db = TestingSessionLocal()
        _seed_all(db, {"sparknode": True, "ignitenode": False})
        db.close()
        self._override_admin()

        login_data = self._login()
        token = login_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # /me initially
        me = client.get("/api/auth/me", headers=headers).json()
        assert me["enabled_modules"]["ignitenode"] is False

        # Enable IgniteNode
        client.patch(
            f"/api/platform/tenants/{TENANT_ID}/feature_flags",
            json={
                "feature_flags": {},
                "enabled_modules": {"sparknode": True, "ignitenode": True},
            },
            headers=_platform_headers(),
        )

        # /me now reflects change
        me2 = client.get("/api/auth/me", headers=headers).json()
        assert me2["enabled_modules"]["ignitenode"] is True


# ═══════════════════════════════════════════════════════════════════════
# LEGACY COMPATIBILITY WORKFLOW
# ═══════════════════════════════════════════════════════════════════════

class TestLegacyTenantWorkflow:
    """Tenants without enabled_modules should still work through legacy flags."""

    def test_legacy_tenant_defaults_to_spark(self):
        """Tenant with no enabled_modules and no sales flags → SparkNode only."""
        db = TestingSessionLocal()
        _seed_all(db, None)  # enabled_modules will be None
        # Override to actually be None (not default dict)
        tenant = db.query(Tenant).filter(Tenant.id == TENANT_ID).first()
        tenant.enabled_modules = None
        db.commit()
        db.close()

        login_data = client.post(
            "/api/auth/login",
            json={"email": "user@e2eco.com", "password": PASSWORD},
        ).json()
        token = login_data["access_token"]

        exp = client.get(
            "/api/auth/experiences",
            headers={"Authorization": f"Bearer {token}"},
        ).json()
        assert "engagement" in exp["experiences"]
        assert exp["spark_access"] is True

    def test_legacy_sales_flag_enables_ignite(self):
        """Tenant with sales_marketing flag → IgniteNode via legacy path."""
        db = TestingSessionLocal()
        _seed_all(db, None)
        tenant = db.query(Tenant).filter(Tenant.id == TENANT_ID).first()
        tenant.enabled_modules = None
        tenant.feature_flags = {"sales_marketing": True}
        db.commit()
        db.close()

        login_data = client.post(
            "/api/auth/login",
            json={"email": "user@e2eco.com", "password": PASSWORD},
        ).json()
        token = login_data["access_token"]

        exp = client.get(
            "/api/auth/experiences",
            headers={"Authorization": f"Bearer {token}"},
        ).json()
        assert exp["ignite_access"] is True
        assert "growth" in exp["experiences"]
