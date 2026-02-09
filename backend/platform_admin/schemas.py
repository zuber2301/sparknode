"""
Platform Admin Schemas

Pydantic models for platform-level tenant management.
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from decimal import Decimal


# =====================================================
# TENANT MANAGEMENT SCHEMAS
# =====================================================

class TenantCreateRequest(BaseModel):
    """Request to create a new tenant."""
    name: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = Field(None, max_length=255)
    domain: Optional[str] = Field(None, max_length=255)
    logo_url: Optional[str] = None
    primary_color: Optional[str] = Field(default="#3B82F6", max_length=20)
    branding_config: Optional[Dict[str, Any]] = {}
    
    # Subscription
    subscription_tier: str = Field(default="starter", pattern="^(free|starter|professional|enterprise|basic|premium)$")
    max_users: int = Field(default=50, ge=1)
    master_budget_balance: Optional[Decimal] = Field(default=Decimal("0"), ge=0)
    
    # Multi-Currency Configuration (Mandatory)
    display_currency: str = Field(default="USD", pattern="^(USD|EUR|INR)$")  # Required currency choice
    fx_rate: Optional[Decimal] = Field(default=Decimal("1.0"), gt=0)  # Exchange rate for display currency
    
    # Initial admin
    admin_email: EmailStr
    admin_first_name: str = Field(..., min_length=1, max_length=100)
    admin_last_name: str = Field(..., min_length=1, max_length=100)
    admin_password: str = Field(..., min_length=8)
    
    # Settings
    settings: Optional[Dict[str, Any]] = {}


class TenantUpdateRequest(BaseModel):
    """Request to update tenant details."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = Field(None, max_length=255)
    domain: Optional[str] = Field(None, max_length=255)
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    
    # Theme & Branding
    theme_config: Optional[Dict[str, Any]] = None  # {primary_color, secondary_color, font_family}
    
    # Access & Security
    domain_whitelist: Optional[List[str]] = None  # Email suffixes
    auth_method: Optional[str] = Field(None, pattern="^(PASSWORD_AND_OTP|OTP_ONLY|SSO_SAML)$")
    status: Optional[str] = Field(None, pattern="^(active|inactive|suspended|trial|archived)$")

    # Point Economy
    currency: Optional[str] = None
    markup_percent: Optional[Decimal] = None
    enabled_rewards: Optional[List[str]] = None
    currency_label: Optional[str] = None
    conversion_rate: Optional[Decimal] = None
    auto_refill_threshold: Optional[Decimal] = None
    
    # Multi-Currency Support
    display_currency: Optional[str] = Field(None, pattern="^(USD|EUR|INR)$")  # Display currency for tenant
    fx_rate: Optional[Decimal] = Field(None, gt=0)  # Exchange rate for display currency

    # Recognition Laws
    award_tiers: Optional[Dict[str, int]] = None
    peer_to_peer_enabled: Optional[bool] = None
    expiry_policy: Optional[str] = Field(None, pattern="^(?i)(never|90_days|1_year|custom)$")

    # Financial controls
    redemptions_paused: Optional[bool] = None

    # Branding
    branding_config: Optional[Dict[str, Any]] = None
    
    
    # Subscription
    subscription_tier: Optional[str] = Field(None, pattern="^(free|starter|professional|enterprise|basic|premium)$")
    subscription_status: Optional[str] = Field(None, pattern="^(active|past_due|cancelled)$")
    subscription_ends_at: Optional[datetime] = None
    max_users: Optional[int] = Field(None, ge=1)
    master_budget_balance: Optional[Decimal] = None
    
    # Legacy settings (backwards compatibility)
    branding_config: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None
    feature_flags: Optional[Dict[str, Any]] = None
    catalog_settings: Optional[Dict[str, Any]] = None
    branding: Optional[Dict[str, Any]] = None


class TenantListResponse(BaseModel):
    """Summary tenant response for listing."""
    id: UUID
    name: str
    domain: Optional[str]
    logo_url: Optional[str]
    status: str
    subscription_tier: Optional[str]
    subscription_status: Optional[str]
    max_users: int
    user_count: Optional[int] = 0
    created_at: datetime
    
    class Config:
        from_attributes = True


class TenantDetailResponse(BaseModel):
    """Detailed tenant response."""
    id: UUID
    name: str
    slug: Optional[str]
    domain: Optional[str]
    logo_url: Optional[str]
    favicon_url: Optional[str]
    
    # Theme & Branding
    theme_config: Dict[str, Any]
    branding_config: Dict[str, Any]
    
    # Access & Security
    domain_whitelist: List[str]
    auth_method: str
    status: str
    
    # Point Economy
    currency: str
    markup_percent: Decimal
    enabled_rewards: List[str]
    currency_label: str
    conversion_rate: Decimal
    auto_refill_threshold: Decimal
    
    # Multi-Currency Support
    base_currency: str = "USD"  # Internal base currency
    display_currency: str  # Currency for tenant display (USD, INR, EUR)
    fx_rate: Decimal  # Exchange rate for display currency
    
    # Recognition Laws
    award_tiers: Dict[str, int]
    peer_to_peer_enabled: bool
    expiry_policy: str
    
    # Financial controls
    redemptions_paused: bool

    # Subscription
    subscription_tier: Optional[str]
    subscription_status: Optional[str]
    subscription_started_at: Optional[datetime]
    subscription_ends_at: Optional[datetime]
    max_users: int
    master_budget_balance: Decimal
    
    # Settings
    feature_flags: Dict[str, Any]
    settings: Dict[str, Any]
    catalog_settings: Dict[str, Any]
    branding: Dict[str, Any]
    
    # Timestamps
    created_at: datetime
    updated_at: datetime
    
    # Computed fields
    user_count: Optional[int] = 0
    active_user_count: Optional[int] = 0
    department_count: Optional[int] = 0
    total_recognitions: Optional[int] = 0
    total_points_distributed: Optional[Decimal] = Decimal("0")
    # Financial aggregates
    total_allocated: Optional[Decimal] = Decimal("0")
    total_spent: Optional[Decimal] = Decimal("0")
    
    class Config:
        from_attributes = True


class BudgetActivityPoint(BaseModel):
    period: str
    credits: Decimal
    debits: Decimal
    net: Decimal


class BudgetActivityResponse(BaseModel):
    data: List[BudgetActivityPoint]


class MasterBudgetAdjustRequest(BaseModel):
    points: Decimal
    description: Optional[str] = ''

    class Config:
        schema_extra = {
            'example': {
                'points': '1000.00',
                'description': 'Provisioned extra budget'
            }
        }


# =====================================================
# SUBSCRIPTION & BILLING SCHEMAS
# =====================================================

class SubscriptionTier(BaseModel):
    """Subscription tier details."""
    tier: str
    name: str
    price_monthly: Decimal
    price_yearly: Decimal
    max_users: int
    features: List[str]


SUBSCRIPTION_TIERS = [
    SubscriptionTier(
        tier="free",
        name="Free",
        price_monthly=Decimal("0"),
        price_yearly=Decimal("0"),
        max_users=10,
        features=[
            "Up to 10 users",
            "Basic recognition",
            "Standard badges",
            "Basic analytics"
        ]
    ),
    SubscriptionTier(
        tier="starter",
        name="Starter",
        price_monthly=Decimal("99"),
        price_yearly=Decimal("990"),
        max_users=50,
        features=[
            "Up to 50 users",
            "Full recognition features",
            "Custom badges",
            "Department budgets",
            "Advanced analytics",
            "Email support"
        ]
    ),
    SubscriptionTier(
        tier="professional",
        name="Professional",
        price_monthly=Decimal("299"),
        price_yearly=Decimal("2990"),
        max_users=200,
        features=[
            "Up to 200 users",
            "Everything in Starter",
            "Events module",
            "Custom branding",
            "API access",
            "Priority support"
        ]
    ),
    SubscriptionTier(
        tier="enterprise",
        name="Enterprise",
        price_monthly=Decimal("0"),  # Custom pricing
        price_yearly=Decimal("0"),
        max_users=999999,
        features=[
            "Unlimited users",
            "Everything in Professional",
            "SSO/SAML integration",
            "Dedicated account manager",
            "Custom integrations",
            "SLA guarantee"
        ]
    )
]


class SubscriptionTiersResponse(BaseModel):
    """List of available subscription tiers."""
    tiers: List[SubscriptionTier]


class FeatureFlagsUpdate(BaseModel):
    """Request to update tenant feature flags."""
    feature_flags: Dict[str, Any]


# =====================================================
# PLATFORM HEALTH SCHEMAS
# =====================================================

class SystemHealthCheck(BaseModel):
    """System health status."""
    component: str
    status: str  # healthy, degraded, down
    latency_ms: Optional[float] = None
    message: Optional[str] = None


class PlatformHealthResponse(BaseModel):
    """Platform health status."""
    status: str  # healthy, degraded, down
    version: str
    uptime_seconds: int
    components: List[SystemHealthCheck]
    checked_at: datetime


# =====================================================
# AUDIT & COMPLIANCE SCHEMAS
# =====================================================

class PlatformAuditEntry(BaseModel):
    """Platform-level audit log entry."""
    id: UUID
    actor_id: Optional[UUID]
    actor_type: Optional[str] = "user"
    actor_email: Optional[str]
    action: str
    entity_type: Optional[str]
    entity_id: Optional[UUID]
    tenant_id: Optional[UUID]
    tenant_name: Optional[str]
    details: Dict[str, Any]
    ip_address: Optional[str]
    created_at: datetime


class PlatformAuditResponse(BaseModel):
    """Platform audit log response."""
    entries: List[PlatformAuditEntry]
    total: int
    page: int
    page_size: int
