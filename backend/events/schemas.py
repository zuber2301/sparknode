"""
Event Management Schemas for SparkNode Events Hub.
Includes request/response models for events, activities, nominations, teams, gifts, and metrics.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


# =====================================================
# EVENT SCHEMAS
# =====================================================

class EventBase(BaseModel):
    """Base event fields."""
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    type: str = Field(..., description="Event type: annual_day, gift_distribution, sports_day, custom")
    
    start_datetime: datetime
    end_datetime: datetime
    
    venue: Optional[str] = None
    location: Optional[str] = None
    format: str = Field(default='onsite', description="onsite, virtual, hybrid")
    
    banner_url: Optional[str] = None
    color_code: Optional[str] = Field(default='#3B82F6')
    
    status: str = Field(default='draft', description="draft, published, ongoing, closed, archived")
    visibility: str = Field(default='all_employees')
    visible_to_departments: List[UUID] = Field(default_factory=list)
    
    nomination_start: Optional[datetime] = None
    nomination_end: Optional[datetime] = None
    who_can_nominate: str = Field(default='all_employees')
    max_activities_per_person: int = Field(default=5)
    
    planned_budget: float = Field(default=0)
    currency: str = Field(default='USD')


class EventCreate(EventBase):
    """Request to create a new event."""
    pass


class EventUpdate(BaseModel):
    """Request to update an event (all fields optional)."""
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    
    venue: Optional[str] = None
    location: Optional[str] = None
    format: Optional[str] = None
    
    banner_url: Optional[str] = None
    color_code: Optional[str] = None
    
    status: Optional[str] = None
    visibility: Optional[str] = None
    visible_to_departments: Optional[List[UUID]] = None
    
    nomination_start: Optional[datetime] = None
    nomination_end: Optional[datetime] = None
    who_can_nominate: Optional[str] = None
    max_activities_per_person: Optional[int] = None
    
    planned_budget: Optional[float] = None
    currency: Optional[str] = None


class EventDetailResponse(EventBase):
    """Full event details including metrics."""
    id: UUID
    tenant_id: UUID
    created_by: Optional[UUID] = None
    
    created_at: datetime
    updated_at: datetime
    
    # Aggregated counts
    activity_count: int = 0
    nomination_count: int = 0
    
    class Config:
        from_attributes = True


class EventListResponse(BaseModel):
    """Condensed event info for lists."""
    id: UUID
    title: str
    type: str
    start_datetime: datetime
    end_datetime: datetime
    status: str
    format: str
    
    activity_count: int = 0
    nomination_count: int = 0
    banner_url: Optional[str] = None
    color_code: Optional[str] = None
    
    class Config:
        from_attributes = True


# =====================================================
# EVENT ACTIVITY SCHEMAS
# =====================================================

class EventActivityBase(BaseModel):
    """Base activity fields."""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category: str = Field(..., description="solo, group, other")
    
    max_participants: Optional[int] = None
    max_teams: Optional[int] = None
    min_team_size: int = Field(default=1)
    max_team_size: Optional[int] = None
    
    nomination_start: Optional[datetime] = None
    nomination_end: Optional[datetime] = None
    activity_start: Optional[datetime] = None
    activity_end: Optional[datetime] = None
    
    requires_approval: bool = Field(default=False)
    allow_multiple_teams: bool = Field(default=False)
    rules_text: Optional[str] = None
    
    sequence: Optional[int] = None


class EventActivityCreate(EventActivityBase):
    """Request to create activity."""
    pass


class EventActivityUpdate(BaseModel):
    """Request to update activity."""
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    
    max_participants: Optional[int] = None
    max_teams: Optional[int] = None
    min_team_size: Optional[int] = None
    max_team_size: Optional[int] = None
    
    nomination_start: Optional[datetime] = None
    nomination_end: Optional[datetime] = None
    activity_start: Optional[datetime] = None
    activity_end: Optional[datetime] = None
    
    requires_approval: Optional[bool] = None
    allow_multiple_teams: Optional[bool] = None
    rules_text: Optional[str] = None
    
    sequence: Optional[int] = None


class EventActivityResponse(EventActivityBase):
    """Activity details with counts."""
    id: UUID
    event_id: UUID
    tenant_id: UUID
    
    created_at: datetime
    updated_at: datetime
    
    nomination_count: int = 0
    approved_count: int = 0
    waitlisted_count: int = 0
    team_count: int = 0
    
    class Config:
        from_attributes = True


# =====================================================
# EVENT NOMINATION SCHEMAS
# =====================================================

class EventNominationBase(BaseModel):
    """Base nomination fields."""
    status: str = Field(default='pending', description="pending, approved, rejected, waitlisted")
    performance_title: Optional[str] = None
    notes: Optional[str] = None
    preferred_slot: Optional[str] = None


class EventNominationCreate(BaseModel):
    """Request to create nomination."""
    activity_id: UUID
    nominee_user_id: UUID
    team_id: Optional[UUID] = None  # For group activities
    
    performance_title: Optional[str] = None
    notes: Optional[str] = None
    preferred_slot: Optional[str] = None


class EventNominationUpdate(BaseModel):
    """Request to update nomination status (admin)."""
    status: Optional[str] = None
    notes: Optional[str] = None


class EventNominationResponse(EventNominationBase):
    """Nomination details."""
    id: UUID
    event_id: UUID
    activity_id: UUID
    tenant_id: UUID
    
    nominee_user_id: UUID
    team_id: Optional[UUID] = None
    
    created_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    
    reviewed_by: Optional[UUID] = None
    reviewed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# =====================================================
# EVENT TEAM SCHEMAS
# =====================================================

class EventTeamBase(BaseModel):
    """Base team fields."""
    team_name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    captain_user_id: UUID
    status: str = Field(default='forming')


class EventTeamCreate(BaseModel):
    """Request to create team."""
    activity_id: UUID
    team_name: str
    description: Optional[str] = None
    captain_user_id: UUID
    member_user_ids: List[UUID] = Field(default_factory=list)  # Initial members


class EventTeamResponse(EventTeamBase):
    """Team details."""
    id: UUID
    activity_id: UUID
    tenant_id: UUID
    
    created_at: datetime
    updated_at: datetime
    
    member_count: int = 0
    
    class Config:
        from_attributes = True


class EventTeamMemberResponse(BaseModel):
    """Team member details."""
    id: UUID
    team_id: UUID
    user_id: UUID
    role: str  # member, captain
    status: str  # active, inactive, left
    
    joined_at: datetime
    
    class Config:
        from_attributes = True


# =====================================================
# EVENT GIFT SCHEMAS
# =====================================================

class EventGiftBatchBase(BaseModel):
    """Base gift batch fields."""
    gift_name: str = Field(..., min_length=1, max_length=255)
    gift_type: str = Field(..., description="hamper, voucher, swag, merchandise, other")
    description: Optional[str] = None
    
    quantity: int = Field(..., gt=0)
    unit_value: float = Field(..., gt=0)
    
    eligible_criteria: Dict[str, Any] = Field(default_factory=dict)
    distribution_start: Optional[datetime] = None
    distribution_end: Optional[datetime] = None
    distribution_locations: List[str] = Field(default_factory=list)


class EventGiftBatchCreate(EventGiftBatchBase):
    """Request to create gift batch."""
    pass


class EventGiftBatchUpdate(BaseModel):
    """Request to update gift batch."""
    gift_name: Optional[str] = None
    gift_type: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[int] = None
    unit_value: Optional[float] = None
    eligible_criteria: Optional[Dict[str, Any]] = None
    distribution_start: Optional[datetime] = None
    distribution_end: Optional[datetime] = None
    distribution_locations: Optional[List[str]] = None


class EventGiftBatchResponse(EventGiftBatchBase):
    """Gift batch details."""
    id: UUID
    event_id: UUID
    tenant_id: UUID
    
    created_at: datetime
    updated_at: datetime
    
    issued_count: int = 0
    redeemed_count: int = 0
    
    class Config:
        from_attributes = True


class EventGiftRedemptionResponse(BaseModel):
    """Gift redemption tracking."""
    id: UUID
    gift_batch_id: UUID
    event_id: UUID
    user_id: UUID
    
    status: str  # not_issued, issued, redeemed, expired
    qr_token_expires_at: Optional[datetime] = None
    
    redeemed_at: Optional[datetime] = None
    redeemed_location: Optional[str] = None
    redeemed_by: Optional[UUID] = None
    
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class GiftRedemptionRequest(BaseModel):
    """Request to redeem a gift (scanner)."""
    qr_token: str = Field(..., description="QR token from employee")
    location: str = Field(..., description="Distribution location")
    staff_user_id: UUID = Field(..., description="Staff scanning the code")


# =====================================================
# EVENT BUDGET SCHEMAS
# =====================================================

class EventBudgetUpdate(BaseModel):
    """Request to update event budget."""
    planned_budget: Optional[float] = None
    actual_spend: Optional[float] = None
    committed_spend: Optional[float] = None
    budget_breakdown: Optional[Dict[str, Any]] = None


class EventBudgetResponse(BaseModel):
    """Budget details."""
    id: UUID
    event_id: UUID
    tenant_id: UUID
    
    planned_budget: float
    actual_spend: float
    committed_spend: float
    
    budget_breakdown: Dict[str, Any]
    
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# =====================================================
# EVENT METRICS SCHEMAS
# =====================================================

class EventMetricsResponse(BaseModel):
    """Event metrics and analytics."""
    id: UUID
    event_id: UUID
    tenant_id: UUID
    
    # Participation
    total_invited: int = 0
    total_registered: int = 0
    total_participated: int = 0
    no_shows: int = 0
    
    # Gift Collection
    gifts_eligible: int = 0
    gifts_issued: int = 0
    gifts_redeemed: int = 0
    
    # Breakdown
    activity_metrics: Dict[str, Any] = {}
    department_metrics: Dict[str, Any] = {}
    
    computed_at: datetime
    
    class Config:
        from_attributes = True


# =====================================================
# TEMPLATE SCHEMAS
# =====================================================

class EventTemplate(BaseModel):
    """Event template for quick creation."""
    id: str  # e.g., "annual_day", "gift_distribution", "sports_day"
    name: str
    description: str
    icon: str  # Icon name or emoji
    preset_activities: List[Dict[str, Any]]  # Activities to pre-populate
    rules: Dict[str, Any]  # Default rules and constraints


class EventTemplateGalleryResponse(BaseModel):
    """List of available templates."""
    templates: List[EventTemplate]


# =====================================================
# BULK OPERATIONS
# =====================================================

class BulkNominationApprovalRequest(BaseModel):
    """Bulk approve/reject nominations."""
    nomination_ids: List[UUID]
    status: str  # approved, rejected, waitlisted
    reason: Optional[str] = None


class GenerateGiftQRCodesRequest(BaseModel):
    """Generate QR codes for gift batch."""
    gift_batch_id: UUID
    eligible_user_ids: Optional[List[UUID]] = None  # If None, auto-determine from criteria
