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
    domain: Optional[str] = None
    logo_url: Optional[str] = None


class TenantCreate(TenantBase):
    pass


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None
    logo_url: Optional[str] = None
    status: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    base_currency: Optional[str] = None
    display_currency: Optional[str] = None
    fx_rate: Optional[Decimal] = None

    @field_validator('base_currency', 'display_currency')
    @classmethod
    def validate_currency(cls, v):
        if v is not None and v not in CurrencyCode.SUPPORTED:
            raise ValueError(f"Currency must be one of: {', '.join(CurrencyCode.SUPPORTED)}")
        return v

    @field_validator('fx_rate')
    @classmethod
    def validate_fx_rate(cls, v):
        if v is not None and v <= 0:
            raise ValueError("FX rate must be greater than 0")
        return v


class TenantResponse(TenantBase):
    id: UUID
    status: str
    base_currency: str
    display_currency: str
    fx_rate: Decimal
    settings: Dict[str, Any]
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
