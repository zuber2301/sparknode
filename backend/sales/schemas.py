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
    # gamification settings
    goal_metric: Optional[str] = None
    goal_value: Optional[int] = None
    reward_points: Optional[int] = None
    total_budget_cap: Optional[int] = None
    dept_id: Optional[UUID] = None
    eligible_dept_ids: Optional[List[UUID]] = []
    eligible_region_ids: Optional[List[str]] = []
    invited_user_ids: Optional[List[UUID]] = []
    invited_dept_ids: Optional[List[UUID]] = []
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
    goal_metric: Optional[str] = None
    goal_value: Optional[int] = None
    reward_points: Optional[int] = None
    total_budget_cap: Optional[int] = None
    dept_id: Optional[UUID] = None
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
    # gamification summary
    goal_metric: Optional[str]
    goal_value: Optional[int]
    reward_points: Optional[int]
    total_budget_cap: Optional[int]
    distributed_so_far: Optional[int]
    eligible_dept_ids: Optional[List[UUID]]
    eligible_region_ids: Optional[List[str]]
    invited_user_ids: Optional[List[UUID]]
    invited_dept_ids: Optional[List[UUID]]

    class Config:
        from_attributes = True

    class Config:
        from_attributes = True


class RegistrationRequest(BaseModel):
    full_name: str
    email: EmailStr
    company: Optional[str] = None
    role: Optional[str] = None
    department_id: Optional[UUID] = None
    region: Optional[str] = None
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


class ProgressUpdateRequest(BaseModel):
    user_id: UUID
    increment: Optional[int] = 1


class LeaderboardRow(BaseModel):
    user_id: UUID
    user_name: Optional[str] = None
    avatar_url: Optional[str] = None
    current_value: int
    is_rewarded: bool
    progress_pct: Optional[float] = None   # 0–100

    class Config:
        from_attributes = True


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

    class Config:
        from_attributes = True
