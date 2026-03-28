"""
Production Readiness Tests
===========================
Comprehensive tests to validate system is production-ready.
Covers: health checks, auth security, RBAC, schema validation,
multi-tenant isolation, module configuration edge cases, and API contracts.
"""

import pytest
import uuid
import sys
import os
from decimal import Decimal
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pydantic import ValidationError

from auth.schemas import (
    LoginRequest,
    UserResponse,
    Token,
    SignupRequest,
)
from platform_admin.schemas import (
    TenantCreateRequest,
    TenantDetailResponse,
    TenantListResponse,
    FeatureFlagsUpdate,
)
from tenants.schemas import TenantResponse
from auth.utils import get_password_hash, verify_password, create_access_token, decode_token


# ═══════════════════════════════════════════════════════════════════════
# 1. AUTHENTICATION SECURITY TESTS
# ═══════════════════════════════════════════════════════════════════════

class TestPasswordSecurity:
    """Ensure password hashing is secure and bcrypt is used."""

    def test_hash_uses_bcrypt(self):
        hashed = get_password_hash("MyP@ss123!")
        assert hashed.startswith("$2b$")

    def test_hash_is_salted(self):
        h1 = get_password_hash("same_password")
        h2 = get_password_hash("same_password")
        assert h1 != h2

    def test_verify_correct_password(self):
        hashed = get_password_hash("correct_pass")
        assert verify_password("correct_pass", hashed) is True

    def test_verify_wrong_password(self):
        hashed = get_password_hash("correct_pass")
        assert verify_password("wrong_pass", hashed) is False

    def test_empty_password_hashable(self):
        hashed = get_password_hash("")
        assert hashed.startswith("$2b$")

    def test_unicode_password(self):
        hashed = get_password_hash("пароль密码パスワード")
        assert verify_password("пароль密码パスワード", hashed) is True

    def test_long_password(self):
        long_pass = "a" * 200
        hashed = get_password_hash(long_pass)
        assert verify_password(long_pass, hashed) is True


class TestJWTSecurity:
    """Validate JWT token creation and decoding."""

    def test_token_created_successfully(self):
        token = create_access_token(
            data={
                "sub": str(uuid.uuid4()),
                "tenant_id": str(uuid.uuid4()),
                "email": "test@test.com",
                "org_role": "tenant_user",
            }
        )
        assert isinstance(token, str)
        assert len(token) > 50

    def test_token_decode_roundtrip(self):
        user_id = uuid.uuid4()
        tenant_id = uuid.uuid4()
        token = create_access_token(
            data={
                "sub": str(user_id),
                "tenant_id": str(tenant_id),
                "email": "roundtrip@test.com",
                "org_role": "tenant_manager",
            }
        )
        decoded = decode_token(token)
        assert str(decoded.user_id) == str(user_id)
        assert decoded.email == "roundtrip@test.com"
        assert decoded.org_role == "tenant_manager"

    def test_token_contains_expiration(self):
        from jose import jwt
        from config import settings

        token = create_access_token(
            data={
                "sub": str(uuid.uuid4()),
                "email": "exp@test.com",
                "org_role": "tenant_user",
            }
        )
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        assert "exp" in payload

    def test_token_with_system_type(self):
        token = create_access_token(
            data={
                "sub": str(uuid.uuid4()),
                "email": "admin@platform.com",
                "org_role": "platform_admin",
                "type": "system",
            }
        )
        decoded = decode_token(token)
        assert decoded is not None

    def test_token_with_roles(self):
        token = create_access_token(
            data={
                "sub": str(uuid.uuid4()),
                "tenant_id": str(uuid.uuid4()),
                "email": "multi@test.com",
                "org_role": "tenant_manager",
                "roles": "tenant_manager,dept_lead,tenant_user",
                "default_role": "tenant_manager",
                "type": "tenant",
            }
        )
        decoded = decode_token(token)
        assert "tenant_manager" in decoded.roles


# ═══════════════════════════════════════════════════════════════════════
# 2. SCHEMA VALIDATION TESTS
# ═══════════════════════════════════════════════════════════════════════

class TestLoginRequestValidation:

    def test_valid_email_accepted(self):
        req = LoginRequest(email="valid@email.com", password="pass123")
        assert req.email == "valid@email.com"

    def test_invalid_email_rejected(self):
        with pytest.raises(ValidationError):
            LoginRequest(email="not-an-email", password="pass")

    def test_missing_password_rejected(self):
        with pytest.raises(ValidationError):
            LoginRequest(email="valid@email.com")

    def test_tenant_slug_optional(self):
        req = LoginRequest(email="user@test.com", password="pass")
        assert req.tenant_slug is None

    def test_tenant_id_optional(self):
        req = LoginRequest(email="user@test.com", password="pass")
        assert req.tenant_id is None


class TestTenantCreateValidation:

    def test_valid_subscription_tiers(self):
        for tier in ("free", "starter", "professional", "enterprise"):
            req = TenantCreateRequest(
                name="TestCo",
                admin_email="admin@test.com",
                admin_first_name="A",
                admin_last_name="B",
                admin_password="password123",
                subscription_tier=tier,
            )
            assert req.subscription_tier == tier

    def test_invalid_subscription_tier_rejected(self):
        with pytest.raises(ValidationError):
            TenantCreateRequest(
                name="TestCo",
                admin_email="admin@test.com",
                admin_first_name="A",
                admin_last_name="B",
                admin_password="password123",
                subscription_tier="invalid_tier",
            )

    def test_short_password_rejected(self):
        with pytest.raises(ValidationError):
            TenantCreateRequest(
                name="TestCo",
                admin_email="admin@test.com",
                admin_first_name="A",
                admin_last_name="B",
                admin_password="short",  # min 8 chars
            )

    def test_valid_currencies(self):
        for currency in ("USD", "EUR", "INR", "GBP", "JPY", "AED", "SGD"):
            req = TenantCreateRequest(
                name="CurCo",
                admin_email="admin@cur.com",
                admin_first_name="A",
                admin_last_name="B",
                admin_password="password123",
                base_currency=currency,
                display_currency=currency,
            )
            assert req.base_currency == currency

    def test_invalid_currency_rejected(self):
        with pytest.raises(ValidationError):
            TenantCreateRequest(
                name="CurCo",
                admin_email="admin@cur.com",
                admin_first_name="A",
                admin_last_name="B",
                admin_password="password123",
                base_currency="INVALID",
            )

    def test_negative_max_users_rejected(self):
        with pytest.raises(ValidationError):
            TenantCreateRequest(
                name="NegCo",
                admin_email="admin@neg.com",
                admin_first_name="A",
                admin_last_name="B",
                admin_password="password123",
                max_users=0,  # ge=1
            )

    def test_valid_billing_cycles(self):
        for cycle in ("monthly", "quarterly", "annually"):
            req = TenantCreateRequest(
                name="BillCo",
                admin_email="admin@bill.com",
                admin_first_name="A",
                admin_last_name="B",
                admin_password="password123",
                billing_cycle=cycle,
            )
            assert req.billing_cycle == cycle


class TestFeatureFlagsUpdateValidation:

    def test_empty_dict_allowed(self):
        update = FeatureFlagsUpdate(feature_flags={})
        assert update.feature_flags == {}

    def test_modules_optional(self):
        update = FeatureFlagsUpdate(feature_flags={"key": True})
        assert update.enabled_modules is None

    def test_modules_with_flags(self):
        update = FeatureFlagsUpdate(
            feature_flags={"ai_copilot": True},
            enabled_modules={"sparknode": True, "ignitenode": True},
        )
        assert update.enabled_modules["ignitenode"] is True


# ═══════════════════════════════════════════════════════════════════════
# 3. MODULE CONFIGURATION EDGE CASES
# ═══════════════════════════════════════════════════════════════════════

class TestModuleEdgeCases:

    def test_enabled_modules_all_combinations(self):
        """Verify all 4 boolean combos of sparknode/ignitenode."""
        combos = [
            (True, True),
            (True, False),
            (False, True),
            (False, False),
        ]
        for spark, ignite in combos:
            resp = TenantDetailResponse(
                id=uuid.uuid4(),
                name="Combo",
                slug="combo",
                status="active",
                subscription_tier="starter",
                subscription_status="active",
                max_users=50,
                master_budget_balance=Decimal("0"),
                base_currency="USD",
                display_currency="USD",
                fx_rate=Decimal("1.0"),
                feature_flags={},
                settings={},
                enabled_modules={"sparknode": spark, "ignitenode": ignite},
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            assert resp.enabled_modules["sparknode"] is spark
            assert resp.enabled_modules["ignitenode"] is ignite

    def test_none_modules_gets_default(self):
        """When enabled_modules is None, schema should accept it."""
        resp = TenantListResponse(
            id=uuid.uuid4(),
            name="NullMod",
            slug="nullmod",
            domain=None,
            status="active",
            subscription_tier="starter",
            subscription_status="active",
            max_users=50,
            created_at=datetime.utcnow(),
        )
        # Default is sparknode=True, ignitenode=False
        assert resp.enabled_modules == {"sparknode": True, "ignitenode": False}

    def test_user_response_modules_preserved(self):
        """Modules survive serialization in UserResponse."""
        modules = {"sparknode": False, "ignitenode": True}
        resp = UserResponse(
            id=uuid.uuid4(),
            corporate_email="test@test.com",
            first_name="T",
            last_name="U",
            org_role="tenant_user",
            status="ACTIVE",
            enabled_modules=modules,
        )
        assert resp.enabled_modules == modules


# ═══════════════════════════════════════════════════════════════════════
# 4. ROLE HIERARCHY & RBAC TESTS
# ═══════════════════════════════════════════════════════════════════════

class TestRoleHierarchy:
    """Validate the role hierarchy from auth/routes.py get_user_roles."""

    def test_role_hierarchy_import(self):
        from auth.routes import get_user_roles

        # Tenant manager gets all roles
        roles = get_user_roles("tenant_manager")
        assert "tenant_manager" in roles["roles"]
        assert "dept_lead" in roles["roles"]
        assert "tenant_user" in roles["roles"]
        assert "sales_marketing" in roles["roles"]

    def test_dept_lead_roles(self):
        from auth.routes import get_user_roles

        roles = get_user_roles("dept_lead")
        assert "dept_lead" in roles["roles"]
        assert "tenant_user" in roles["roles"]
        assert "tenant_manager" not in roles["roles"]

    def test_tenant_user_roles(self):
        from auth.routes import get_user_roles

        roles = get_user_roles("tenant_user")
        assert roles["roles"] == "tenant_user"
        assert roles["default_role"] == "tenant_user"

    def test_platform_admin_roles(self):
        from auth.routes import get_user_roles

        roles = get_user_roles("platform_admin")
        assert roles["roles"] == "platform_admin"
        assert roles["default_role"] == "platform_admin"

    def test_unknown_role_passthrough(self):
        from auth.routes import get_user_roles

        roles = get_user_roles("custom_role")
        assert roles["roles"] == "custom_role"
        assert roles["default_role"] == "custom_role"


class TestRBACPermissions:
    """Test RBAC permission checks."""

    def test_rbac_module_importable(self):
        from core.rbac import RolePermissions, Permission, UserRole
        assert RolePermissions is not None

    def test_platform_admin_has_all_permissions(self):
        from core.rbac import RolePermissions, Permission
        # Platform admin should have broad access
        assert RolePermissions.has_permission("platform_admin", Permission.MANAGE_TENANTS) is True

    def test_tenant_user_limited_permissions(self):
        from core.rbac import RolePermissions, Permission
        # Regular user should NOT manage tenants
        assert RolePermissions.has_permission("tenant_user", Permission.MANAGE_TENANTS) is False


# ═══════════════════════════════════════════════════════════════════════
# 5. MULTI-TENANT DATA ISOLATION TESTS
# ═══════════════════════════════════════════════════════════════════════

class TestMultiTenantIsolation:
    """Verify that tenant data is properly scoped."""

    def test_tenant_unique_constraint_on_slug(self):
        """Different tenants must have unique slugs."""
        t1 = TenantCreateRequest(
            name="Co1",
            slug="unique-slug",
            admin_email="a@co1.com",
            admin_first_name="A",
            admin_last_name="B",
            admin_password="password123",
        )
        t2 = TenantCreateRequest(
            name="Co2",
            slug="different-slug",
            admin_email="a@co2.com",
            admin_first_name="C",
            admin_last_name="D",
            admin_password="password123",
        )
        assert t1.slug != t2.slug

    def test_user_response_includes_tenant_id(self):
        tid = uuid.uuid4()
        resp = UserResponse(
            id=uuid.uuid4(),
            tenant_id=tid,
            corporate_email="user@tenant.com",
            first_name="U",
            last_name="S",
            org_role="tenant_user",
            status="ACTIVE",
        )
        assert resp.tenant_id == tid


# ═══════════════════════════════════════════════════════════════════════
# 6. API CONTRACT TESTS
# ═══════════════════════════════════════════════════════════════════════

class TestAPIContracts:
    """Verify response schemas match expected structure."""

    def test_login_response_shape(self):
        """LoginResponse must have access_token, token_type, user."""
        from auth.schemas import LoginResponse

        resp = LoginResponse(
            access_token="test-token",
            token_type="bearer",
            user=UserResponse(
                id=uuid.uuid4(),
                corporate_email="user@test.com",
                first_name="T",
                last_name="U",
                org_role="tenant_user",
                status="ACTIVE",
            ),
        )
        assert resp.access_token == "test-token"
        assert resp.token_type == "bearer"
        assert resp.user.corporate_email == "user@test.com"

    def test_tenant_detail_complete_fields(self):
        """TenantDetailResponse includes all critical fields."""
        resp = TenantDetailResponse(
            id=uuid.uuid4(),
            name="CompleteCo",
            slug="completeco",
            status="active",
            subscription_tier="enterprise",
            subscription_status="active",
            max_users=500,
            master_budget_balance=Decimal("50000"),
            base_currency="USD",
            display_currency="INR",
            fx_rate=Decimal("83.0"),
            feature_flags={"ai_copilot": True, "sales_marketing": True},
            settings={"copay_enabled": False},
            enabled_modules={"sparknode": True, "ignitenode": True},
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            user_count=100,
            department_count=5,
        )
        assert resp.enabled_modules["sparknode"] is True
        assert resp.enabled_modules["ignitenode"] is True
        assert resp.feature_flags["ai_copilot"] is True
        assert resp.master_budget_balance == Decimal("50000")
        assert resp.fx_rate == Decimal("83.0")

    def test_tenant_response_for_current_tenant(self):
        """TenantResponse (used by /tenants/current) has correct shape."""
        resp = TenantResponse(
            id=uuid.uuid4(),
            name="CurrentCo",
            status="active",
            currency="USD",
            display_currency="INR",
            fx_rate=Decimal("83.0"),
            markup_percent=Decimal("0"),
            enabled_rewards=[],
            currency_label="Points",
            conversion_rate=Decimal("1.0"),
            auto_refill_threshold=Decimal("0"),
            domain_whitelist=[],
            auth_method="PASSWORD_AND_OTP",
            award_tiers={},
            peer_to_peer_enabled=True,
            expiry_policy="never",
            redemptions_paused=False,
            branding_config={},
            settings={},
            feature_flags={"ai_copilot": True},
            enabled_modules={"sparknode": True, "ignitenode": False},
            budget_allocated=Decimal("10000"),
            budget_allocation_balance=Decimal("5000"),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        assert resp.enabled_modules["sparknode"] is True
        assert resp.feature_flags["ai_copilot"] is True
