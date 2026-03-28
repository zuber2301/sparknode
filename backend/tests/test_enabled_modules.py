"""
Enabled Modules Tests
=====================
Tests for the enabled_modules feature on the Tenant model and related schemas.
Covers all module combinations: SparkNode only, IgniteNode only, both, neither (invalid).
"""

import pytest
import uuid
import sys
import os
from decimal import Decimal
from pydantic import ValidationError

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from platform_admin.schemas import (
    TenantCreateRequest,
    TenantUpdateRequest,
    TenantListResponse,
    TenantDetailResponse,
    FeatureFlagsUpdate,
)
from auth.schemas import UserResponse, LoginRequest
from tenants.schemas import TenantResponse
from datetime import datetime


# ─── Tenant Schema: enabled_modules defaults ───────────────────────────

class TestTenantCreateRequestModules:
    """Validate enabled_modules on TenantCreateRequest."""

    def test_default_modules_sparknode_only(self):
        """Default: sparknode=True, ignitenode=False"""
        req = TenantCreateRequest(
            name="TestCo",
            admin_email="admin@testco.com",
            admin_first_name="Admin",
            admin_last_name="User",
            admin_password="securepass123",
        )
        assert req.enabled_modules == {"sparknode": True, "ignitenode": False}

    def test_both_modules_enabled(self):
        req = TenantCreateRequest(
            name="DualCo",
            admin_email="admin@dualco.com",
            admin_first_name="Admin",
            admin_last_name="User",
            admin_password="securepass123",
            enabled_modules={"sparknode": True, "ignitenode": True},
        )
        assert req.enabled_modules["sparknode"] is True
        assert req.enabled_modules["ignitenode"] is True

    def test_ignitenode_only(self):
        req = TenantCreateRequest(
            name="IgniteCo",
            admin_email="admin@igniteco.com",
            admin_first_name="Admin",
            admin_last_name="User",
            admin_password="securepass123",
            enabled_modules={"sparknode": False, "ignitenode": True},
        )
        assert req.enabled_modules["sparknode"] is False
        assert req.enabled_modules["ignitenode"] is True

    def test_neither_module_allowed_in_schema(self):
        """Schema itself allows both=False; validation is at the endpoint level."""
        req = TenantCreateRequest(
            name="EmptyCo",
            admin_email="admin@empty.com",
            admin_first_name="Admin",
            admin_last_name="User",
            admin_password="securepass123",
            enabled_modules={"sparknode": False, "ignitenode": False},
        )
        # Schema does NOT reject — the endpoint is responsible for validation
        assert req.enabled_modules["sparknode"] is False
        assert req.enabled_modules["ignitenode"] is False

    def test_extra_keys_preserved(self):
        """Extra module keys are passed through for forward compatibility."""
        req = TenantCreateRequest(
            name="FutureCo",
            admin_email="admin@future.com",
            admin_first_name="Admin",
            admin_last_name="User",
            admin_password="securepass123",
            enabled_modules={"sparknode": True, "ignitenode": True, "analyticsnode": True},
        )
        assert req.enabled_modules["analyticsnode"] is True


class TestTenantListResponseModules:

    def test_default_modules_in_list_response(self):
        resp = TenantListResponse(
            id=uuid.uuid4(),
            name="TestCo",
            slug="testco",
            domain=None,
            status="active",
            subscription_tier="starter",
            subscription_status="active",
            max_users=50,
            user_count=5,
            created_at=datetime.utcnow(),
        )
        assert resp.enabled_modules == {"sparknode": True, "ignitenode": False}

    def test_custom_modules_in_list_response(self):
        resp = TenantListResponse(
            id=uuid.uuid4(),
            name="BothCo",
            slug="bothco",
            domain=None,
            status="active",
            subscription_tier="enterprise",
            subscription_status="active",
            max_users=500,
            user_count=100,
            created_at=datetime.utcnow(),
            enabled_modules={"sparknode": True, "ignitenode": True},
        )
        assert resp.enabled_modules["ignitenode"] is True


class TestTenantDetailResponseModules:

    def _make_detail(self, **overrides):
        defaults = dict(
            id=uuid.uuid4(),
            name="DetailCo",
            slug="detailco",
            domain=None,
            status="active",
            subscription_tier="starter",
            subscription_status="active",
            max_users=50,
            master_budget_balance=Decimal("1000"),
            base_currency="USD",
            display_currency="USD",
            fx_rate=Decimal("1.0"),
            feature_flags={},
            settings={},
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        defaults.update(overrides)
        return TenantDetailResponse(**defaults)

    def test_detail_default_modules(self):
        resp = self._make_detail()
        assert resp.enabled_modules == {"sparknode": True, "ignitenode": False}

    def test_detail_both_modules(self):
        resp = self._make_detail(enabled_modules={"sparknode": True, "ignitenode": True})
        assert resp.enabled_modules["ignitenode"] is True

    def test_detail_ignitenode_only(self):
        resp = self._make_detail(enabled_modules={"sparknode": False, "ignitenode": True})
        assert resp.enabled_modules["sparknode"] is False
        assert resp.enabled_modules["ignitenode"] is True


# ─── FeatureFlagsUpdate schema ──────────────────────────────────────────

class TestFeatureFlagsUpdateSchema:

    def test_feature_flags_only(self):
        update = FeatureFlagsUpdate(feature_flags={"ai_copilot": True})
        assert update.enabled_modules is None

    def test_feature_flags_with_modules(self):
        update = FeatureFlagsUpdate(
            feature_flags={"ai_copilot": True},
            enabled_modules={"sparknode": True, "ignitenode": True},
        )
        assert update.enabled_modules["ignitenode"] is True

    def test_empty_feature_flags_allowed(self):
        update = FeatureFlagsUpdate(feature_flags={})
        assert update.feature_flags == {}


# ─── Auth UserResponse with enabled_modules ─────────────────────────────

class TestUserResponseModules:

    def test_user_response_with_modules(self):
        resp = UserResponse(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            corporate_email="user@test.com",
            first_name="Test",
            last_name="User",
            org_role="tenant_user",
            status="ACTIVE",
            is_platform_admin=False,
            enabled_modules={"sparknode": True, "ignitenode": True},
        )
        assert resp.enabled_modules["sparknode"] is True
        assert resp.enabled_modules["ignitenode"] is True

    def test_user_response_without_modules(self):
        resp = UserResponse(
            id=uuid.uuid4(),
            corporate_email="user@test.com",
            first_name="Test",
            last_name="User",
            org_role="tenant_user",
            status="ACTIVE",
        )
        assert resp.enabled_modules is None

    def test_user_response_sparknode_only(self):
        resp = UserResponse(
            id=uuid.uuid4(),
            corporate_email="user@test.com",
            first_name="Test",
            last_name="User",
            org_role="tenant_user",
            status="ACTIVE",
            enabled_modules={"sparknode": True, "ignitenode": False},
        )
        assert resp.enabled_modules["sparknode"] is True
        assert resp.enabled_modules["ignitenode"] is False


# ─── Tenants/TenantResponse with enabled_modules ────────────────────────

def _tenant_response_kwargs(**overrides):
    """Build a valid TenantResponse kwargs dict with all required fields."""
    defaults = dict(
        id=uuid.uuid4(),
        name="TenantRespCo",
        status="active",
        currency="USD",
        display_currency="USD",
        fx_rate=Decimal("1.0"),
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
        feature_flags={},
        budget_allocated=Decimal("0"),
        budget_allocation_balance=Decimal("0"),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    defaults.update(overrides)
    return defaults


class TestTenantResponseModules:

    def test_tenant_response_default_modules(self):
        resp = TenantResponse(**_tenant_response_kwargs())
        assert resp.enabled_modules == {"sparknode": True, "ignitenode": False}

    def test_tenant_response_ignitenode_enabled(self):
        resp = TenantResponse(**_tenant_response_kwargs(
            name="IgniteCo",
            display_currency="INR",
            fx_rate=Decimal("83.0"),
            feature_flags={"sales_marketing": True},
            enabled_modules={"sparknode": True, "ignitenode": True},
        ))
        assert resp.enabled_modules["ignitenode"] is True


# ─── LoginRequest (no module changes but verifying compatibility) ────────

class TestLoginRequestSchema:

    def test_login_with_tenant_slug(self):
        req = LoginRequest(email="user@test.com", password="pass", tenant_slug="testco")
        assert req.tenant_slug == "testco"

    def test_login_with_tenant_id(self):
        tid = uuid.uuid4()
        req = LoginRequest(email="user@test.com", password="pass", tenant_id=tid)
        assert req.tenant_id == tid

    def test_login_without_tenant(self):
        req = LoginRequest(email="user@test.com", password="pass")
        assert req.tenant_slug is None
        assert req.tenant_id is None

    def test_login_invalid_email_rejected(self):
        with pytest.raises(ValidationError):
            LoginRequest(email="not-an-email", password="pass")
