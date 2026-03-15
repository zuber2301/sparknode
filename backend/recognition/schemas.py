from pydantic import BaseModel
from typing import Optional, List, Dict
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
    core_value_tag: Optional[str] = None  # EEE: core value alignment


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
    core_value_tag: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RecognitionDetailResponse(RecognitionResponse):
    from_user_name: str
    to_user_name: str
    badge_name: Optional[str] = None
    comments_count: int = 0
    reactions_count: int = 0
    reactions_breakdown: Dict[str, int] = {}  # e.g. {"like": 2, "fire": 1}
    user_reacted: bool = False
    user_reaction_type: Optional[str] = None
    addon_points_total: int = 0


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


class AddOnCreate(BaseModel):
    points: int = 5  # 5, 10, or 25
    message: Optional[str] = None


class AddOnResponse(BaseModel):
    id: UUID
    recognition_id: UUID
    from_user_id: UUID
    from_user_name: str
    points: Decimal
    message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
