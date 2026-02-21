"""
Tenant Manager — Company Catalog Configuration
Routes:
  /api/catalog/tenant/* — Tenant Manager only (configure what employees see)
  /api/catalog/browse  — All authenticated users (employee-facing catalog)
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal

from database import get_db
from models import (
    RewardCatalogMaster,
    RewardCatalogTenant,
    RewardCatalogCustom,
    User,
)
from auth.utils import get_current_user, require_tenant_manager_or_platform
from catalog.schemas import (
    TenantCatalogEntryUpsert,
    TenantCatalogEntryResponse,
    CustomItemCreate,
    CustomItemUpdate,
    CustomItemResponse,
    CatalogItemResponse,
)

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resolve_effective(
    master: RewardCatalogMaster,
    entry: Optional[RewardCatalogTenant],
) -> tuple[Decimal, Decimal, Decimal]:
    """Return (min, max, step) using tenant override when set, else master default."""
    mn = entry.custom_min_points if (entry and entry.custom_min_points is not None) else master.min_points
    mx = entry.custom_max_points if (entry and entry.custom_max_points is not None) else master.max_points
    st = entry.custom_step_points if (entry and entry.custom_step_points is not None) else master.step_points
    return mn, mx, st


def _build_entry_response(
    entry: RewardCatalogTenant,
    master: RewardCatalogMaster,
) -> TenantCatalogEntryResponse:
    mn, mx, st = _resolve_effective(master, entry)
    return TenantCatalogEntryResponse(
        id=entry.id,
        tenant_id=entry.tenant_id,
        master_item_id=entry.master_item_id,
        is_enabled=entry.is_enabled,
        custom_min_points=entry.custom_min_points,
        custom_max_points=entry.custom_max_points,
        custom_step_points=entry.custom_step_points,
        visibility_scope=entry.visibility_scope,
        sort_order=entry.sort_order,
        brand=master.brand,
        name=master.name,
        category=master.category,
        fulfillment_type=master.fulfillment_type,
        effective_min_points=mn,
        effective_max_points=mx,
        effective_step_points=st,
        image_url=master.image_url,
        description=master.description,
        is_active_global=master.is_active_global,
        updated_at=entry.updated_at,
    )


# ── Tenant Manager: view all master items with tenant overlay ─────────────────

@router.get("/tenant/items", response_model=List[TenantCatalogEntryResponse])
async def list_tenant_catalog(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    enabled_only: bool = Query(False),
    current_user: User = Depends(require_tenant_manager_or_platform),
    db: Session = Depends(get_db),
):
    """
    Return the full master catalog enriched with this tenant's overrides.
    Unregistered master items (no tenant row) are returned with defaults.
    """
    tid = current_user.tenant_id

    masters = db.query(RewardCatalogMaster).filter(
        RewardCatalogMaster.is_active_global == True
    )
    if category:
        masters = masters.filter(RewardCatalogMaster.category == category)
    if search:
        like = f"%{search}%"
        masters = masters.filter(
            RewardCatalogMaster.name.ilike(like) | RewardCatalogMaster.brand.ilike(like)
        )
    masters = masters.order_by(RewardCatalogMaster.brand, RewardCatalogMaster.name).all()

    # Build a lookup map for tenant entries
    entry_map: dict[UUID, RewardCatalogTenant] = {}
    if masters:
        master_ids = [m.id for m in masters]
        entries = (
            db.query(RewardCatalogTenant)
            .filter(
                RewardCatalogTenant.tenant_id == tid,
                RewardCatalogTenant.master_item_id.in_(master_ids),
            )
            .all()
        )
        entry_map = {e.master_item_id: e for e in entries}

    result = []
    for master in masters:
        entry = entry_map.get(master.id)
        # Synthesise a virtual entry if tenant has never touched this item
        if entry is None:
            virtual = RewardCatalogTenant(
                id=UUID(int=0),
                tenant_id=tid,
                master_item_id=master.id,
                is_enabled=True,
                custom_min_points=None,
                custom_max_points=None,
                custom_step_points=None,
                visibility_scope="all",
                sort_order=0,
                updated_at=master.updated_at,
            )
            entry = virtual

        if enabled_only and not entry.is_enabled:
            continue

        result.append(_build_entry_response(entry, master))

    return result


@router.get("/tenant/categories")
async def tenant_catalog_categories(
    current_user: User = Depends(require_tenant_manager_or_platform),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(RewardCatalogMaster.category)
        .filter(RewardCatalogMaster.is_active_global == True)
        .distinct()
        .order_by(RewardCatalogMaster.category)
        .all()
    )
    return [r[0] for r in rows]


@router.put("/tenant/items/{master_item_id}", response_model=TenantCatalogEntryResponse)
async def upsert_tenant_catalog_entry(
    master_item_id: UUID,
    payload: TenantCatalogEntryUpsert,
    current_user: User = Depends(require_tenant_manager_or_platform),
    db: Session = Depends(get_db),
):
    """Create or update this tenant's settings for a master catalog item."""
    master = db.query(RewardCatalogMaster).filter(
        RewardCatalogMaster.id == master_item_id,
        RewardCatalogMaster.is_active_global == True,
    ).first()
    if not master:
        raise HTTPException(status_code=404, detail="Master catalog item not found or inactive")

    # Validate custom point bands stay within global limits
    if payload.custom_min_points is not None and payload.custom_min_points < master.min_points:
        raise HTTPException(
            status_code=422,
            detail=f"custom_min_points cannot be less than global min {master.min_points}",
        )
    if payload.custom_max_points is not None and payload.custom_max_points > master.max_points:
        raise HTTPException(
            status_code=422,
            detail=f"custom_max_points cannot exceed global max {master.max_points}",
        )

    tid = current_user.tenant_id
    entry = db.query(RewardCatalogTenant).filter(
        RewardCatalogTenant.tenant_id == tid,
        RewardCatalogTenant.master_item_id == master_item_id,
    ).first()

    if entry is None:
        entry = RewardCatalogTenant(
            tenant_id=tid,
            master_item_id=master_item_id,
            created_by=current_user.id,
        )
        db.add(entry)

    entry.is_enabled = payload.is_enabled
    entry.custom_min_points = payload.custom_min_points
    entry.custom_max_points = payload.custom_max_points
    entry.custom_step_points = payload.custom_step_points
    entry.visibility_scope = payload.visibility_scope
    entry.sort_order = payload.sort_order
    entry.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(entry)
    return _build_entry_response(entry, master)


@router.patch("/tenant/items/{master_item_id}/toggle", response_model=TenantCatalogEntryResponse)
async def toggle_tenant_catalog_item(
    master_item_id: UUID,
    current_user: User = Depends(require_tenant_manager_or_platform),
    db: Session = Depends(get_db),
):
    """Quick-toggle a single master item on/off for this tenant."""
    master = db.query(RewardCatalogMaster).filter(
        RewardCatalogMaster.id == master_item_id
    ).first()
    if not master:
        raise HTTPException(status_code=404, detail="Master catalog item not found")

    tid = current_user.tenant_id
    entry = db.query(RewardCatalogTenant).filter(
        RewardCatalogTenant.tenant_id == tid,
        RewardCatalogTenant.master_item_id == master_item_id,
    ).first()

    if entry is None:
        # First time toggling: create a disabled row
        entry = RewardCatalogTenant(
            tenant_id=tid,
            master_item_id=master_item_id,
            is_enabled=False,
            created_by=current_user.id,
            updated_at=datetime.utcnow(),
        )
        db.add(entry)
    else:
        entry.is_enabled = not entry.is_enabled
        entry.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(entry)
    return _build_entry_response(entry, master)


# ── Tenant Manager: Custom Items ──────────────────────────────────────────────

@router.get("/tenant/custom", response_model=List[CustomItemResponse])
async def list_custom_items(
    current_user: User = Depends(require_tenant_manager_or_platform),
    db: Session = Depends(get_db),
):
    return (
        db.query(RewardCatalogCustom)
        .filter(RewardCatalogCustom.tenant_id == current_user.tenant_id)
        .order_by(RewardCatalogCustom.sort_order, RewardCatalogCustom.name)
        .all()
    )


@router.post("/tenant/custom", response_model=CustomItemResponse, status_code=201)
async def create_custom_item(
    payload: CustomItemCreate,
    current_user: User = Depends(require_tenant_manager_or_platform),
    db: Session = Depends(get_db),
):
    item = RewardCatalogCustom(
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        **payload.model_dump(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/tenant/custom/{item_id}", response_model=CustomItemResponse)
async def update_custom_item(
    item_id: UUID,
    payload: CustomItemUpdate,
    current_user: User = Depends(require_tenant_manager_or_platform),
    db: Session = Depends(get_db),
):
    item = db.query(RewardCatalogCustom).filter(
        RewardCatalogCustom.id == item_id,
        RewardCatalogCustom.tenant_id == current_user.tenant_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Custom item not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return item


@router.delete("/tenant/custom/{item_id}", status_code=204)
async def delete_custom_item(
    item_id: UUID,
    current_user: User = Depends(require_tenant_manager_or_platform),
    db: Session = Depends(get_db),
):
    item = db.query(RewardCatalogCustom).filter(
        RewardCatalogCustom.id == item_id,
        RewardCatalogCustom.tenant_id == current_user.tenant_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Custom item not found")
    db.delete(item)
    db.commit()


# ── Employee-facing unified catalog browse ────────────────────────────────────

@router.get("/browse", response_model=List[CatalogItemResponse])
async def browse_catalog(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Unified employee catalog:
    - Enabled master items (respecting tenant overrides)
    - Active custom items for this tenant
    Sorted by (sort_order, brand/name).
    """
    tid = current_user.tenant_id
    items: List[CatalogItemResponse] = []

    # 1. Active master items that are enabled for this tenant
    #    Items with no tenant row are treated as enabled by default.
    masters = (
        db.query(RewardCatalogMaster)
        .filter(RewardCatalogMaster.is_active_global == True)
    )
    if category:
        masters = masters.filter(RewardCatalogMaster.category == category)
    if search:
        like = f"%{search}%"
        masters = masters.filter(
            RewardCatalogMaster.name.ilike(like) | RewardCatalogMaster.brand.ilike(like)
        )
    masters = masters.all()

    if masters:
        master_ids = [m.id for m in masters]
        entry_map: dict = {
            e.master_item_id: e
            for e in db.query(RewardCatalogTenant).filter(
                RewardCatalogTenant.tenant_id == tid,
                RewardCatalogTenant.master_item_id.in_(master_ids),
            ).all()
        }

        for master in masters:
            entry = entry_map.get(master.id)
            # Default: enabled unless an explicit disabled row exists
            if entry is not None and not entry.is_enabled:
                continue
            mn, mx, st = _resolve_effective(master, entry)
            sort_ord = entry.sort_order if entry else 0
            items.append(CatalogItemResponse(
                id=master.id,
                source="master",
                brand=master.brand,
                name=master.name,
                category=master.category,
                fulfillment_type=master.fulfillment_type,
                min_points=mn,
                max_points=mx,
                step_points=st,
                image_url=master.image_url,
                description=master.description,
                terms_conditions=master.terms_conditions,
                validity_days=master.validity_days,
                tags=list(master.tags) if master.tags else [],
                sort_order=sort_ord,
                source_voucher_id=master.source_voucher_id,
            ))

    # 2. Tenant custom items
    custom_q = db.query(RewardCatalogCustom).filter(
        RewardCatalogCustom.tenant_id == tid,
        RewardCatalogCustom.is_active == True,
    )
    if category:
        custom_q = custom_q.filter(RewardCatalogCustom.category == category)
    if search:
        like = f"%{search}%"
        custom_q = custom_q.filter(RewardCatalogCustom.name.ilike(like))

    for ci in custom_q.all():
        items.append(CatalogItemResponse(
            id=ci.id,
            source="custom",
            brand="Internal",
            name=ci.name,
            category=ci.category,
            fulfillment_type=ci.fulfillment_type,
            min_points=ci.points_cost,
            max_points=ci.points_cost,
            step_points=Decimal("1"),
            image_url=ci.image_url,
            description=ci.description,
            terms_conditions=ci.terms_conditions,
            validity_days=None,
            tags=[],
            sort_order=ci.sort_order,
        ))

    # Sort: sort_order ASC, then brand/name
    items.sort(key=lambda x: (x.sort_order, x.brand, x.name))
    return items


@router.get("/browse/categories")
async def browse_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Categories available to this user's tenant."""
    tid = current_user.tenant_id
    rows = (
        db.query(RewardCatalogMaster.category)
        .filter(RewardCatalogMaster.is_active_global == True)
        .distinct()
        .order_by(RewardCatalogMaster.category)
        .all()
    )
    cats = [r[0] for r in rows]
    # Also include custom categories
    custom_cats = (
        db.query(RewardCatalogCustom.category)
        .filter(
            RewardCatalogCustom.tenant_id == tid,
            RewardCatalogCustom.is_active == True,
        )
        .distinct()
        .all()
    )
    for r in custom_cats:
        if r[0] not in cats:
            cats.append(r[0])
    return sorted(cats)
