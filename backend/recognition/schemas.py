from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal


class BadgeResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    icon_url: Optional[str] = None
    points_value: Decimal
    is_system: bool

    class Config:
        from_attributes = True


class RecognitionCreate(BaseModel):
    to_user_id: Optional[UUID] = None
    to_user_ids: Optional[List[UUID]] = None
    badge_id: Optional[UUID] = None
    points: Decimal
    message: str
    recognition_type: str = 'standard'
    ecard_template: Optional[str] = None
    is_equal_split: bool = False
    visibility: str = 'public'


class RecognitionResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    from_user_id: UUID
    to_user_id: UUID
    badge_id: Optional[UUID] = None
    points: Decimal
    message: str
    recognition_type: str
    ecard_template: Optional[str] = None
    is_equal_split: bool
    visibility: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class RecognitionDetailResponse(RecognitionResponse):
    from_user_name: str
    to_user_name: str
    badge_name: Optional[str] = None
    comments_count: int = 0
    reactions_count: int = 0
    user_reacted: bool = False


class RecognitionCommentCreate(BaseModel):
    content: str


class RecognitionCommentResponse(BaseModel):
    id: UUID
    recognition_id: UUID
    user_id: UUID
    user_name: str
    content: str
    created_at: datetime


class RecognitionStats(BaseModel):
    total_given: int
    total_received: int
    points_given: Decimal
    points_received: Decimal
    top_badges: List[dict]
