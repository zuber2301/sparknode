from pydantic import BaseModel, field_validator
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from core.rbac import AllowedDepartment


class CurrencyCode(str):
    """Enum-like class for supported currencies"""
    USD = "USD"
    INR = "INR"
    EUR = "EUR"
    GBP = "GBP"
    JPY = "JPY"
    
    SUPPORTED = ["USD", "INR", "EUR", "GBP", "JPY"]


class TenantBase(BaseModel):
    name: str
    slug: Optional[str] = None
    domain: Optional[str] = None
    logo_url: Optional[str] = None

    @field_validator('slug')
    @classmethod
    def validate_slug(cls, v):
        if v is None:
            return v
        import re
        if not re.match(r'^[a-z0-9\-]+$', v):
            raise ValueError('Slug may only contain lowercase letters, numbers and hyphens')
        return v


class TenantCreate(TenantBase):
    pass


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    domain: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None

    # Governance & Security
    domain_whitelist: Optional[list[str]] = None
    auth_method: Optional[str] = None  # PASSWORD_AND_OTP, OTP_ONLY, SSO_SAML

    # Point Economy
    currency: Optional[str] = None
    markup_percent: Optional[Decimal] = None
    enabled_rewards: Optional[list] = None
    currency_label: Optional[str] = None
    conversion_rate: Optional[Decimal] = None
    auto_refill_threshold: Optional[Decimal] = None

    # Recognition Rules
    award_tiers: Optional[Dict[str, int]] = None
    peer_to_peer_enabled: Optional[bool] = None
    expiry_policy: Optional[str] = None

    # Financial controls
    redemptions_paused: Optional[bool] = None

    # Branding
    branding_config: Optional[Dict[str, Any]] = None

    # Misc
    status: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None

    @field_validator('currency')
    @classmethod
    def validate_currency(cls, v):
        if v is not None and v not in CurrencyCode.SUPPORTED:
            raise ValueError(f"Currency must be one of: {', '.join(CurrencyCode.SUPPORTED)}")
        return v

    @field_validator('markup_percent')
    @classmethod
    def validate_markup(cls, v):
        if v is not None and v < 0:
            raise ValueError('markup_percent must be >= 0')
        return v

    @field_validator('conversion_rate')
    @classmethod
    def validate_conversion_rate(cls, v):
        if v is not None and v <= 0:
            raise ValueError('conversion_rate must be greater than 0')
        return v

    @field_validator('auto_refill_threshold')
    @classmethod
    def validate_auto_refill(cls, v):
        if v is not None and (v < 0 or v > 100):
            raise ValueError('auto_refill_threshold must be between 0 and 100')
        return v

    @field_validator('expiry_policy')
    @classmethod
    def validate_expiry_policy(cls, v):
        if v is not None:
            allowed = ['never', '90_days', '1_year', 'custom']
            if v not in allowed:
                raise ValueError(f"expiry_policy must be one of: {', '.join(allowed)}")
        return v


class TenantResponse(TenantBase):
    id: UUID
    status: str

    # Governance & Security
    domain_whitelist: list[str]
    auth_method: str

    # Point Economy
    currency: str
    markup_percent: Decimal
    enabled_rewards: list
    currency_label: str
    conversion_rate: Decimal
    auto_refill_threshold: Decimal

    # Recognition Rules
    award_tiers: Dict[str, int]
    peer_to_peer_enabled: bool
    expiry_policy: str

    # Financials
    redemptions_paused: bool

    # Branding
    branding_config: Dict[str, Any]

    # Settings
    settings: Dict[str, Any]

    # Budget fields for tenant managers
    budget_allocated: Decimal
    budget_allocation_balance: Decimal

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DepartmentBase(BaseModel):
    name: str
    parent_id: Optional[UUID] = None

    @field_validator('name')
    @classmethod
    def validate_department_name(cls, v):
        allowed_names = [d.value for d in AllowedDepartment]
        if v not in allowed_names:
            raise ValueError(f"Department name must be one of: {', '.join(allowed_names)}")
        return v


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[UUID] = None


class DepartmentResponse(DepartmentBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
