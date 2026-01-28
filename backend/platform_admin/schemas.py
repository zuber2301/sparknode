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
    domain: Optional[str] = Field(None, max_length=255)
    logo_url: Optional[str] = None
    primary_color: Optional[str] = Field(default="#3B82F6", max_length=20)
    
    # Subscription
    subscription_tier: str = Field(default="starter", pattern="^(free|starter|professional|enterprise)$")
    max_users: int = Field(default=50, ge=1)
    
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
    domain: Optional[str] = Field(None, max_length=255)
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    primary_color: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(active|inactive|suspended|trial)$")
    settings: Optional[Dict[str, Any]] = None
    catalog_settings: Optional[Dict[str, Any]] = None
    branding: Optional[Dict[str, Any]] = None


class SubscriptionUpdate(BaseModel):
    """Request to update subscription."""
    subscription_tier: Optional[str] = Field(None, pattern="^(free|starter|professional|enterprise)$")
    subscription_status: Optional[str] = Field(None, pattern="^(active|past_due|cancelled)$")
    subscription_ends_at: Optional[datetime] = None
    max_users: Optional[int] = Field(None, ge=1)


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
    domain: Optional[str]
    logo_url: Optional[str]
    favicon_url: Optional[str]
    primary_color: Optional[str]
    status: str
    
    # Subscription
    subscription_tier: Optional[str]
    subscription_status: Optional[str]
    subscription_started_at: Optional[datetime]
    subscription_ends_at: Optional[datetime]
    max_users: int
    
    # Settings
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
    
    class Config:
        from_attributes = True


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
