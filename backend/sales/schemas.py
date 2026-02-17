from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from decimal import Decimal


class SalesEventCreateRequest(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = None
    event_type: str = Field(..., max_length=50)
    start_at: datetime
    end_at: Optional[datetime] = None
    location: Optional[str] = None
    owner_user_id: Optional[UUID] = None
    marketing_owner_id: Optional[UUID] = None
    target_registrations: Optional[int] = None
    target_pipeline: Optional[Decimal] = None
    target_revenue: Optional[Decimal] = None


class SalesEventUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    location: Optional[str] = None
    status: Optional[str] = None
    target_registrations: Optional[int] = None
    target_pipeline: Optional[Decimal] = None
    target_revenue: Optional[Decimal] = None


class SalesEventListItem(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    event_type: str
    start_at: datetime
    end_at: Optional[datetime]
    status: str

    class Config:
        from_attributes = True


class RegistrationRequest(BaseModel):
    full_name: str
    email: EmailStr
    company: Optional[str] = None
    role: Optional[str] = None
    source_channel: Optional[str] = None
    utm_source: Optional[str] = None
    utm_campaign: Optional[str] = None


class RegistrationResponse(BaseModel):
    id: UUID
    event_id: UUID
    email: EmailStr
    full_name: str
    status: str
    registered_at: datetime

    class Config:
        from_attributes = True


class LeadResponse(BaseModel):
    id: UUID
    event_id: UUID
    registration_id: Optional[UUID]
    owner_user_id: Optional[UUID]
    lead_status: str
    qualification_fit: Optional[str]
    qualification_timing: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class LeadUpdateRequest(BaseModel):
    owner_user_id: Optional[UUID]
    lead_status: Optional[str]
    qualification_fit: Optional[str]
    qualification_timing: Optional[str]
    notes: Optional[str]


class MetricsResponse(BaseModel):
    event_id: UUID
    registrations: int
    attendees: int
    meetings_booked: int
    opportunities: int
    pipeline_value: Decimal
    revenue_closed: Decimal

    class Config:
        from_attributes = True
