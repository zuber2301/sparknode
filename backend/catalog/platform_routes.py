"""
Platform Admin — Global Reward Catalog Management
Routes: /api/catalog/admin/*
Access: platform_admin only
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from database import get_db
from models import RewardCatalogMaster, RewardCatalogTenant, User
from auth.utils import get_current_user
from core.rbac import get_platform_admin
from catalog.schemas import (
    MasterItemCreate,
    MasterItemUpdate,
    MasterItemResponse,
    TenantCatalogEntryResponse,
)

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _item_or_404(db: Session, item_id: UUID) -> RewardCatalogMaster:
    item = db.query(RewardCatalogMaster).filter(RewardCatalogMaster.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Catalog item not found")
    return item


# ── Master Catalog CRUD ───────────────────────────────────────────────────────

@router.get("/items", response_model=List[MasterItemResponse])
async def list_master_items(
    category: Optional[str] = Query(None),
    active_only: bool = Query(False),
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """List all master catalog items (Platform Admin)."""
    q = db.query(RewardCatalogMaster)
    if active_only:
        q = q.filter(RewardCatalogMaster.is_active_global == True)
    if category:
        q = q.filter(RewardCatalogMaster.category == category)
    if search:
        like = f"%{search}%"
        q = q.filter(
            RewardCatalogMaster.name.ilike(like)
            | RewardCatalogMaster.brand.ilike(like)
        )
    return q.order_by(RewardCatalogMaster.brand, RewardCatalogMaster.name).all()


@router.post("/items", response_model=MasterItemResponse, status_code=status.HTTP_201_CREATED)
async def create_master_item(
    payload: MasterItemCreate,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """Add a new item to the global master catalog."""
    item = RewardCatalogMaster(
        **payload.model_dump(),
        created_by=current_user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/items/{item_id}", response_model=MasterItemResponse)
async def get_master_item(
    item_id: UUID,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    return _item_or_404(db, item_id)


@router.patch("/items/{item_id}", response_model=MasterItemResponse)
async def update_master_item(
    item_id: UUID,
    payload: MasterItemUpdate,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """Update fields on a master catalog item."""
    item = _item_or_404(db, item_id)
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(item, k, v)
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return item


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_master_item(
    item_id: UUID,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """Permanently remove a master catalog item (also removes all tenant entries)."""
    item = _item_or_404(db, item_id)
    db.delete(item)
    db.commit()


@router.patch("/items/{item_id}/toggle", response_model=MasterItemResponse)
async def toggle_master_item(
    item_id: UUID,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """Flip is_active_global on a master catalog item."""
    item = _item_or_404(db, item_id)
    item.is_active_global = not item.is_active_global
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return item


# ── Category list ─────────────────────────────────────────────────────────────

@router.get("/categories")
async def list_categories(
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(RewardCatalogMaster.category)
        .distinct()
        .order_by(RewardCatalogMaster.category)
        .all()
    )
    return [r[0] for r in rows]


# ── Tenant adoption stats ─────────────────────────────────────────────────────

@router.get("/items/{item_id}/tenants")
async def item_tenant_coverage(
    item_id: UUID,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """How many tenants have this item enabled/disabled."""
    _item_or_404(db, item_id)
    entries = (
        db.query(RewardCatalogTenant)
        .filter(RewardCatalogTenant.master_item_id == item_id)
        .all()
    )
    return {
        "total_tenants": len(entries),
        "enabled": sum(1 for e in entries if e.is_enabled),
        "disabled": sum(1 for e in entries if not e.is_enabled),
    }
