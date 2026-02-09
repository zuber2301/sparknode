from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal


class BrandResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    category: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class VoucherResponse(BaseModel):
    id: UUID
    brand_id: UUID
    brand_name: str
    brand_logo: Optional[str] = None
    name: str
    description: Optional[str] = None
    denomination: Decimal
    points_required: Decimal
    copay_amount: Decimal
    image_url: Optional[str] = None
    terms_conditions: Optional[str] = None
    validity_days: int
    is_active: bool

    class Config:
        from_attributes = True


class RedemptionCreate(BaseModel):
    voucher_id: UUID


class RedemptionVerifyOTPRequest(BaseModel):
    redemption_id: UUID
    otp: str


class RedemptionDeliveryDetailsRequest(BaseModel):
    redemption_id: UUID
    full_name: str
    phone: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    postal_code: str
    country: str


class RedemptionResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    user_id: UUID
    voucher_id: UUID
    points_used: Decimal
    copay_amount: Decimal
    voucher_code: Optional[str] = None
    voucher_pin: Optional[str] = None
    status: str
    reward_type: Optional[str] = None
    delivery_details: Optional[dict] = None
    provider_reference: Optional[str] = None
    fulfilled_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RedemptionDetailResponse(RedemptionResponse):
    voucher_name: str
    brand_name: str
    denomination: Decimal
