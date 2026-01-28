"""
Event & Logistics Schemas

Pydantic models for event management, registration, and gift distribution.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from decimal import Decimal


# =====================================================
# EVENT SCHEMAS
# =====================================================

class EventBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    event_type: str = Field(default="mixed", pattern="^(recognition|logistics|mixed)$")
    start_date: datetime
    end_date: datetime
    registration_deadline: Optional[datetime] = None
    location: Optional[str] = None
    is_virtual: bool = False
    virtual_link: Optional[str] = None
    max_participants: Optional[int] = None
    banner_image_url: Optional[str] = None
    theme_color: Optional[str] = None
    settings: Optional[Dict[str, Any]] = {}


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    event_type: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    registration_deadline: Optional[datetime] = None
    location: Optional[str] = None
    is_virtual: Optional[bool] = None
    virtual_link: Optional[str] = None
    max_participants: Optional[int] = None
    status: Optional[str] = None
    banner_image_url: Optional[str] = None
    theme_color: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None


class EventResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    description: Optional[str]
    event_type: str
    start_date: datetime
    end_date: datetime
    registration_deadline: Optional[datetime]
    location: Optional[str]
    is_virtual: bool
    virtual_link: Optional[str]
    max_participants: Optional[int]
    status: str
    banner_image_url: Optional[str]
    theme_color: Optional[str]
    settings: Dict[str, Any]
    created_by: Optional[UUID]
    created_at: datetime
    
    # Computed fields
    participant_count: Optional[int] = 0
    is_registration_open: Optional[bool] = False
    
    class Config:
        from_attributes = True


class EventDetailResponse(EventResponse):
    activities: List["EventActivityResponse"] = []
    event_budget: Optional["EventBudgetResponse"] = None
    creator_name: Optional[str] = None


# =====================================================
# EVENT ACTIVITY SCHEMAS
# =====================================================

class EventActivityBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    activity_type: str = Field(default="general", pattern="^(performance|gifting|workshop|networking|general)$")
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    max_capacity: Optional[int] = None
    location: Optional[str] = None
    participation_points: Decimal = Field(default=Decimal("0"))
    settings: Optional[Dict[str, Any]] = {}


class EventActivityCreate(EventActivityBase):
    pass


class EventActivityUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    activity_type: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    max_capacity: Optional[int] = None
    location: Optional[str] = None
    participation_points: Optional[Decimal] = None
    settings: Optional[Dict[str, Any]] = None


class EventActivityResponse(BaseModel):
    id: UUID
    event_id: UUID
    name: str
    description: Optional[str]
    activity_type: str
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    max_capacity: Optional[int]
    current_count: int
    location: Optional[str]
    participation_points: Decimal
    settings: Dict[str, Any]
    
    # Computed fields
    available_spots: Optional[int] = None
    is_full: bool = False
    
    class Config:
        from_attributes = True


# =====================================================
# EVENT PARTICIPANT SCHEMAS
# =====================================================

class EventRegistrationRequest(BaseModel):
    activity_ids: Optional[List[UUID]] = []
    custom_field_responses: Optional[Dict[str, Any]] = {}


class EventParticipantResponse(BaseModel):
    id: UUID
    event_id: UUID
    user_id: UUID
    status: str
    approved_by: Optional[UUID]
    approved_at: Optional[datetime]
    rejection_reason: Optional[str]
    checked_in_at: Optional[datetime]
    custom_field_responses: Dict[str, Any]
    registered_at: datetime
    
    # User info
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_department: Optional[str] = None
    
    # Activity participations
    activities: List["ActivityParticipantResponse"] = []
    
    class Config:
        from_attributes = True


class ActivityParticipantResponse(BaseModel):
    id: UUID
    activity_id: UUID
    activity_name: Optional[str] = None
    status: str
    checked_in_at: Optional[datetime]
    points_awarded: Decimal
    
    class Config:
        from_attributes = True


class ParticipantApprovalRequest(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")
    rejection_reason: Optional[str] = None


# =====================================================
# EVENT BUDGET SCHEMAS
# =====================================================

class EventBudgetCreate(BaseModel):
    total_budget: Decimal = Field(..., ge=0)
    breakdown: Optional[Dict[str, Decimal]] = {}


class EventBudgetUpdate(BaseModel):
    total_budget: Optional[Decimal] = Field(None, ge=0)
    breakdown: Optional[Dict[str, Decimal]] = None


class EventBudgetResponse(BaseModel):
    id: UUID
    event_id: UUID
    total_budget: Decimal
    allocated_amount: Decimal
    spent_amount: Decimal
    remaining_budget: Decimal
    breakdown: Dict[str, Any]
    created_at: datetime
    
    class Config:
        from_attributes = True


# =====================================================
# GIFT ITEM SCHEMAS
# =====================================================

class GiftItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    image_url: Optional[str] = None
    total_quantity: int = Field(..., ge=0)
    unit_value: Decimal = Field(default=Decimal("0"), ge=0)
    points_value: Decimal = Field(default=Decimal("0"), ge=0)


class GiftItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    image_url: Optional[str] = None
    total_quantity: Optional[int] = Field(None, ge=0)
    unit_value: Optional[Decimal] = None
    points_value: Optional[Decimal] = None


class GiftItemResponse(BaseModel):
    id: UUID
    activity_id: UUID
    name: str
    description: Optional[str]
    image_url: Optional[str]
    total_quantity: int
    allocated_quantity: int
    distributed_quantity: int
    available_quantity: int
    unit_value: Decimal
    points_value: Decimal
    created_at: datetime
    
    class Config:
        from_attributes = True


# =====================================================
# GIFT ALLOCATION SCHEMAS
# =====================================================

class GiftAllocationCreate(BaseModel):
    user_id: UUID
    quantity: int = Field(default=1, ge=1)
    expires_at: Optional[datetime] = None


class GiftAllocationResponse(BaseModel):
    id: UUID
    gift_item_id: UUID
    user_id: UUID
    quantity: int
    status: str
    picked_up_at: Optional[datetime]
    allocated_at: datetime
    expires_at: Optional[datetime]
    
    # Related info
    gift_item_name: Optional[str] = None
    user_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class GiftPickupVerification(BaseModel):
    qr_token: str


class GiftPickupResponse(BaseModel):
    success: bool
    message: str
    allocation_id: Optional[UUID] = None
    user_name: Optional[str] = None
    gift_item_name: Optional[str] = None
    quantity: Optional[int] = None


# =====================================================
# QR CODE SCHEMAS
# =====================================================

class QRCodeRequest(BaseModel):
    event_id: UUID
    activity_id: Optional[UUID] = None


class QRCodeResponse(BaseModel):
    qr_data: str
    expires_at: datetime


class CheckInRequest(BaseModel):
    qr_token: str
    activity_id: Optional[UUID] = None


class CheckInResponse(BaseModel):
    success: bool
    message: str
    user_name: Optional[str] = None
    event_name: Optional[str] = None
    activity_name: Optional[str] = None
    checked_in_at: Optional[datetime] = None


# Update forward references
EventDetailResponse.model_rebuild()
EventParticipantResponse.model_rebuild()
