from pydantic import BaseModel, field_validator
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime
from decimal import Decimal


# ── Master catalog schemas (Platform Admin) ──────────────────────────────────

class MasterItemCreate(BaseModel):
    brand: str
    name: str
    category: str
    provider_code: Optional[str] = None
    fulfillment_type: str = "voucher"
    min_points: Decimal
    max_points: Decimal
    step_points: Decimal = Decimal("1")
    image_url: Optional[str] = None
    description: Optional[str] = None
    terms_conditions: Optional[str] = None
    validity_days: int = 365
    country_codes: List[str] = []
    tags: List[str] = []
    is_active_global: bool = True

    @field_validator("max_points")
    @classmethod
    def max_gte_min(cls, v: Decimal, info: Any) -> Decimal:
        if "min_points" in (info.data or {}) and v < info.data["min_points"]:
            raise ValueError("max_points must be >= min_points")
        return v


class MasterItemUpdate(BaseModel):
    brand: Optional[str] = None
    name: Optional[str] = None
    category: Optional[str] = None
    provider_code: Optional[str] = None
    fulfillment_type: Optional[str] = None
    min_points: Optional[Decimal] = None
    max_points: Optional[Decimal] = None
    step_points: Optional[Decimal] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    terms_conditions: Optional[str] = None
    validity_days: Optional[int] = None
    country_codes: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    is_active_global: Optional[bool] = None


class MasterItemResponse(BaseModel):
    id: UUID
    brand: str
    name: str
    category: str
    provider_code: Optional[str] = None
    fulfillment_type: str
    min_points: Decimal
    max_points: Decimal
    step_points: Decimal
    image_url: Optional[str] = None
    description: Optional[str] = None
    terms_conditions: Optional[str] = None
    validity_days: int
    country_codes: List[str] = []
    tags: List[str] = []
    is_active_global: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Tenant catalog schemas (Tenant Manager) ───────────────────────────────────

class TenantCatalogEntryUpsert(BaseModel):
    master_item_id: UUID
    is_enabled: bool = True
    custom_min_points: Optional[Decimal] = None
    custom_max_points: Optional[Decimal] = None
    custom_step_points: Optional[Decimal] = None
    visibility_scope: str = "all"
    sort_order: int = 0


class TenantCatalogEntryResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    master_item_id: UUID
    is_enabled: bool
    custom_min_points: Optional[Decimal] = None
    custom_max_points: Optional[Decimal] = None
    custom_step_points: Optional[Decimal] = None
    visibility_scope: str
    sort_order: int
    # Resolved from master
    brand: str
    name: str
    category: str
    fulfillment_type: str
    effective_min_points: Decimal     # custom or master fallback
    effective_max_points: Decimal
    effective_step_points: Decimal
    image_url: Optional[str] = None
    description: Optional[str] = None
    is_active_global: bool
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Custom catalog schemas (Tenant Manager) ───────────────────────────────────

class CustomItemCreate(BaseModel):
    name: str
    category: str = "custom"
    description: Optional[str] = None
    image_url: Optional[str] = None
    fulfillment_type: str = "custom"
    points_cost: Decimal
    inventory_count: Optional[int] = None
    terms_conditions: Optional[str] = None
    sort_order: int = 0


class CustomItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    fulfillment_type: Optional[str] = None
    points_cost: Optional[Decimal] = None
    inventory_count: Optional[int] = None
    is_active: Optional[bool] = None
    terms_conditions: Optional[str] = None
    sort_order: Optional[int] = None


class CustomItemResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    category: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    fulfillment_type: str
    points_cost: Decimal
    inventory_count: Optional[int] = None
    is_active: bool
    sort_order: int
    terms_conditions: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ── User-facing unified catalog item ─────────────────────────────────────────

class CatalogItemResponse(BaseModel):
    """Single item as seen by an employee on the Redeem page."""
    id: UUID                          # master_item_id or custom item id
    source: str                       # 'master' | 'custom'
    brand: str
    name: str
    category: str
    fulfillment_type: str
    min_points: Decimal
    max_points: Decimal
    step_points: Decimal
    image_url: Optional[str] = None
    description: Optional[str] = None
    terms_conditions: Optional[str] = None
    validity_days: Optional[int] = None
    tags: List[str] = []
    sort_order: int = 0
    # Legacy bridge — set when this item is backed by a vouchers row
    source_voucher_id: Optional[UUID] = None
