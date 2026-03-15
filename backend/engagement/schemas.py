from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal


class CompanyValueCreate(BaseModel):
    name: str
    emoji: Optional[str] = "⭐"
    description: Optional[str] = None
    sort_order: Optional[int] = 0


class CompanyValueUpdate(BaseModel):
    name: Optional[str] = None
    emoji: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


class CompanyValueResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    emoji: str
    description: Optional[str] = None
    is_active: bool
    sort_order: int
    created_at: datetime

    class Config:
        from_attributes = True


class ChallengeCreate(BaseModel):
    title: str
    description: Optional[str] = None
    challenge_type: Optional[str] = "manual"
    points_reward: Optional[Decimal] = 100
    badge_icon: Optional[str] = "🎯"
    deadline: Optional[datetime] = None


class ChallengeUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    challenge_type: Optional[str] = None
    points_reward: Optional[Decimal] = None
    badge_icon: Optional[str] = None
    is_active: Optional[bool] = None
    deadline: Optional[datetime] = None


class ChallengeResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    title: str
    description: Optional[str] = None
    challenge_type: str
    points_reward: Decimal
    badge_icon: str
    is_active: bool
    deadline: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChallengeWithStatus(ChallengeResponse):
    completed: bool = False
    completions_count: int = 0


class MilestoneItem(BaseModel):
    user_id: UUID
    user_name: str
    milestone_type: str  # birthday | anniversary
    milestone_date: date
    label: str
    years: Optional[int] = None
