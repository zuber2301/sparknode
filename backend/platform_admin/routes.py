"""
Platform Admin Routes

Platform Admin endpoints for:
- Tenant management (create, update, suspend)
- Subscription management
- Platform-wide health monitoring
- Cross-tenant operations
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timedelta
from decimal import Decimal

from database import get_db
from models import (
    Tenant, User, Department, Budget, Recognition, Redemption, Wallet, AuditLog, MasterBudgetLedger
)
from auth.utils import get_password_hash
from core import append_impersonation_metadata
from core.rbac import get_platform_admin
from platform_admin.schemas import (
    TenantCreateRequest, TenantUpdateRequest, SubscriptionUpdate,
    TenantListResponse, TenantDetailResponse,
    SubscriptionTiersResponse, SUBSCRIPTION_TIERS,
    PlatformHealthResponse, SystemHealthCheck,
    PlatformAuditEntry, PlatformAuditResponse, FeatureFlagsUpdate
)

router = APIRouter()


# =====================================================
# TENANT MANAGEMENT ENDPOINTS
# =====================================================

@router.get("/tenants", response_model=List[TenantListResponse])
async def list_tenants(
    status: Optional[str] = None,
    subscription_tier: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """List all tenants (Platform Admin only)"""
    query = db.query(Tenant)
    
    if status:
        query = query.filter(Tenant.status == status)
    if subscription_tier:
        query = query.filter(Tenant.subscription_tier == subscription_tier)
    if search:
        query = query.filter(
            Tenant.name.ilike(f"%{search}%") |
            Tenant.domain.ilike(f"%{search}%")
        )
    
    tenants = query.order_by(Tenant.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for tenant in tenants:
        user_count = db.query(User).filter(
            User.tenant_id == tenant.id,
            User.status == 'active'
        ).count()
        
        result.append(TenantListResponse(
            id=tenant.id,
            name=tenant.name,
            domain=tenant.domain,
            logo_url=tenant.logo_url,
            status=tenant.status,
            subscription_tier=tenant.subscription_tier,
            subscription_status=tenant.subscription_status,
            max_users=tenant.max_users or 50,
            user_count=user_count,
            created_at=tenant.created_at
        ))
    
    return result


@router.post("/tenants", response_model=TenantDetailResponse)
async def create_tenant(
    tenant_data: TenantCreateRequest,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """Create a new tenant (Platform Admin only)"""
    # Check domain/slug uniqueness
    if tenant_data.domain:
        existing = db.query(Tenant).filter(Tenant.domain == tenant_data.domain).first()
        if existing:
            raise HTTPException(status_code=400, detail="Domain already in use")
    if tenant_data.slug:
        existing = db.query(Tenant).filter(Tenant.slug == tenant_data.slug).first()
        if existing:
            raise HTTPException(status_code=400, detail="Slug already in use")

    starting_balance = tenant_data.master_budget_balance or Decimal("0")
    
    try:
        # Create tenant
        tenant = Tenant(
            name=tenant_data.name,
            slug=tenant_data.slug,
            domain=tenant_data.domain,
            logo_url=tenant_data.logo_url,
            primary_color=tenant_data.primary_color,
            branding_config=tenant_data.branding_config or {},
            status='active',
            subscription_tier=tenant_data.subscription_tier,
            subscription_status='active',
            subscription_started_at=datetime.utcnow(),
            max_users=tenant_data.max_users,
            master_budget_balance=starting_balance,
            settings=tenant_data.settings or {
                "copay_enabled": False,
                "points_to_currency_ratio": 0.10,
                "peer_to_peer_recognition": True,
                "social_feed_enabled": True,
                "events_module_enabled": True
            },
            feature_flags={},
            catalog_settings={},
            branding={}
        )
        db.add(tenant)
        db.flush()
        
        # Initialize master budget ledger
        ledger_entry = MasterBudgetLedger(
            tenant_id=tenant.id,
            transaction_type="credit",
            source="provisioning",
            points=starting_balance,
            balance_after=starting_balance,
            description="Initial master budget allocation",
            created_by=current_user.id
        )
        db.add(ledger_entry)
        
        # Create default HR department
        hr_dept = Department(
            tenant_id=tenant.id,
            name="Human Resources"
        )
        db.add(hr_dept)
        db.flush()
        
        # Create admin user
        admin_user = User(
            tenant_id=tenant.id,
            email=tenant_data.admin_email,
            password_hash=get_password_hash(tenant_data.admin_password),
            first_name=tenant_data.admin_first_name,
            last_name=tenant_data.admin_last_name,
            role='tenant_admin',
            department_id=hr_dept.id,
            status='active',
            is_super_admin=True
        )
        db.add(admin_user)
        db.flush()
        
        # Create wallet for admin
        wallet = Wallet(
            tenant_id=tenant.id,
            user_id=admin_user.id,
            balance=0,
            lifetime_earned=0,
            lifetime_spent=0
        )
        db.add(wallet)
        
        # Audit log
        audit = AuditLog(
            tenant_id=tenant.id,
            actor_id=current_user.id,
            action="tenant_created",
            entity_type="tenant",
            entity_id=tenant.id,
            new_values=append_impersonation_metadata({
                "name": tenant.name,
                "slug": tenant.slug,
                "domain": tenant.domain,
                "subscription_tier": tenant.subscription_tier,
                "admin_email": tenant_data.admin_email,
                "master_budget_balance": str(starting_balance)
            })
        )
        db.add(audit)
        
        db.commit()
        db.refresh(tenant)
    except Exception:
        db.rollback()
        raise
    
    return TenantDetailResponse(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        domain=tenant.domain,
        logo_url=tenant.logo_url,
        favicon_url=tenant.favicon_url,
        primary_color=tenant.primary_color,
        branding_config=tenant.branding_config or {},
        feature_flags=tenant.feature_flags or {},
        status=tenant.status,
        subscription_tier=tenant.subscription_tier,
        subscription_status=tenant.subscription_status,
        subscription_started_at=tenant.subscription_started_at,
        subscription_ends_at=tenant.subscription_ends_at,
        max_users=tenant.max_users or 50,
        master_budget_balance=Decimal(str(tenant.master_budget_balance or 0)),
        settings=tenant.settings or {},
        catalog_settings=tenant.catalog_settings or {},
        branding=tenant.branding or {},
        created_at=tenant.created_at,
        updated_at=tenant.updated_at,
        user_count=1,
        active_user_count=1,
        department_count=1
    )


@router.get("/tenants/{tenant_id}", response_model=TenantDetailResponse)
async def get_tenant(
    tenant_id: UUID,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """Get tenant details (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Get counts
    user_count = db.query(User).filter(
        User.tenant_id == tenant_id,
        User.status == 'active'
    ).count()
    
    active_user_count = db.query(func.count(func.distinct(Recognition.from_user_id))).filter(
        Recognition.tenant_id == tenant_id,
        Recognition.created_at >= datetime.utcnow() - timedelta(days=30)
    ).scalar() or 0
    
    department_count = db.query(Department).filter(
        Department.tenant_id == tenant_id
    ).count()
    
    total_recognitions = db.query(Recognition).filter(
        Recognition.tenant_id == tenant_id,
        Recognition.status == 'active'
    ).count()
    
    total_points = db.query(func.sum(Recognition.points)).filter(
        Recognition.tenant_id == tenant_id,
        Recognition.status == 'active'
    ).scalar() or 0
    
    return TenantDetailResponse(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        domain=tenant.domain,
        logo_url=tenant.logo_url,
        favicon_url=tenant.favicon_url,
        primary_color=tenant.primary_color,
        branding_config=tenant.branding_config or {},
        status=tenant.status,
        subscription_tier=tenant.subscription_tier,
        subscription_status=tenant.subscription_status,
        subscription_started_at=tenant.subscription_started_at,
        subscription_ends_at=tenant.subscription_ends_at,
        max_users=tenant.max_users or 50,
        master_budget_balance=Decimal(str(tenant.master_budget_balance or 0)),
        settings=tenant.settings or {},
        catalog_settings=tenant.catalog_settings or {},
        branding=tenant.branding or {},
        created_at=tenant.created_at,
        updated_at=tenant.updated_at,
        user_count=user_count,
        active_user_count=active_user_count,
        department_count=department_count,
        total_recognitions=total_recognitions,
        total_points_distributed=Decimal(str(total_points))
    )


@router.put("/tenants/{tenant_id}", response_model=TenantDetailResponse)
async def update_tenant(
    tenant_id: UUID,
    tenant_data: TenantUpdateRequest,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """Update tenant details (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Check domain uniqueness if changing
    if tenant_data.domain and tenant_data.domain != tenant.domain:
        existing = db.query(Tenant).filter(
            Tenant.domain == tenant_data.domain,
            Tenant.id != tenant_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Domain already in use")
    if tenant_data.slug and tenant_data.slug != tenant.slug:
        existing = db.query(Tenant).filter(
            Tenant.slug == tenant_data.slug,
            Tenant.id != tenant_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Slug already in use")
    
    update_data = tenant_data.model_dump(exclude_unset=True)
    old_values = {k: str(getattr(tenant, k)) for k in update_data.keys()}
    
    for key, value in update_data.items():
        setattr(tenant, key, value)
    
    # Audit log
    audit = AuditLog(
        tenant_id=tenant.id,
        actor_id=current_user.id,
        action="tenant_updated",
        entity_type="tenant",
        entity_id=tenant.id,
        old_values=old_values,
        new_values=append_impersonation_metadata({k: str(v) for k, v in update_data.items()})
    )
    db.add(audit)
    
    db.commit()
    db.refresh(tenant)
    
    # Get counts
    user_count = db.query(User).filter(
        User.tenant_id == tenant_id,
        User.status == 'active'
    ).count()
    
    return TenantDetailResponse(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        domain=tenant.domain,
        logo_url=tenant.logo_url,
        favicon_url=tenant.favicon_url,
        primary_color=tenant.primary_color,
        branding_config=tenant.branding_config or {},
        status=tenant.status,
        subscription_tier=tenant.subscription_tier,
        subscription_status=tenant.subscription_status,
        subscription_started_at=tenant.subscription_started_at,
        subscription_ends_at=tenant.subscription_ends_at,
        max_users=tenant.max_users or 50,
        master_budget_balance=Decimal(str(tenant.master_budget_balance or 0)),
        settings=tenant.settings or {},
        catalog_settings=tenant.catalog_settings or {},
        branding=tenant.branding or {},
        created_at=tenant.created_at,
        updated_at=tenant.updated_at,
        user_count=user_count
    )


@router.put("/tenants/{tenant_id}/subscription", response_model=TenantDetailResponse)
async def update_subscription(
    tenant_id: UUID,
    subscription: SubscriptionUpdate,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """Update tenant subscription (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    old_tier = tenant.subscription_tier
    
    update_data = subscription.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(tenant, key, value)
    
    # Audit log
    audit = AuditLog(
        tenant_id=tenant.id,
        actor_id=current_user.id,
        action="subscription_updated",
        entity_type="tenant",
        entity_id=tenant.id,
        old_values={"subscription_tier": old_tier},
        new_values=append_impersonation_metadata(update_data)
    )
    db.add(audit)
    
    db.commit()
    db.refresh(tenant)
    
    user_count = db.query(User).filter(
        User.tenant_id == tenant_id,
        User.status == 'active'
    ).count()
    
    return TenantDetailResponse(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        domain=tenant.domain,
        logo_url=tenant.logo_url,
        favicon_url=tenant.favicon_url,
        primary_color=tenant.primary_color,
        branding_config=tenant.branding_config or {},
        feature_flags=tenant.feature_flags or {},
        status=tenant.status,
        subscription_tier=tenant.subscription_tier,
        subscription_status=tenant.subscription_status,
        subscription_started_at=tenant.subscription_started_at,
        subscription_ends_at=tenant.subscription_ends_at,
        max_users=tenant.max_users or 50,
        master_budget_balance=Decimal(str(tenant.master_budget_balance or 0)),
        settings=tenant.settings or {},
        catalog_settings=tenant.catalog_settings or {},
        branding=tenant.branding or {},
        created_at=tenant.created_at,
        updated_at=tenant.updated_at,
        user_count=user_count
    )


@router.post("/tenants/{tenant_id}/suspend")
async def suspend_tenant(
    tenant_id: UUID,
    reason: str = Query(..., min_length=1),
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """Suspend a tenant (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    tenant.status = 'suspended'
    
    # Audit log
    audit = AuditLog(
        tenant_id=tenant.id,
        actor_id=current_user.id,
        action="tenant_suspended",
        entity_type="tenant",
        entity_id=tenant.id,
        new_values=append_impersonation_metadata({"reason": reason})
    )
    db.add(audit)
    
    db.commit()
    
    return {"message": f"Tenant {tenant.name} has been suspended", "reason": reason}


@router.post("/tenants/{tenant_id}/activate")
async def activate_tenant(
    tenant_id: UUID,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """Activate a suspended tenant (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    tenant.status = 'active'
    
    # Audit log
    audit = AuditLog(
        tenant_id=tenant.id,
        actor_id=current_user.id,
        action="tenant_activated",
        entity_type="tenant",
        entity_id=tenant.id,
        new_values=append_impersonation_metadata({})
    )
    db.add(audit)
    
    db.commit()
    
    return {"message": f"Tenant {tenant.name} has been activated"}


@router.get("/tenants/{tenant_id}/feature_flags")
async def get_tenant_feature_flags(
    tenant_id: UUID,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """Get tenant feature flags (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return {"tenant_id": tenant.id, "feature_flags": tenant.feature_flags or {}}


@router.patch("/tenants/{tenant_id}/feature_flags")
async def update_tenant_feature_flags(
    tenant_id: UUID,
    payload: FeatureFlagsUpdate,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """Update tenant feature flags (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant.feature_flags = payload.feature_flags or {}

    audit = AuditLog(
        tenant_id=tenant.id,
        actor_id=current_user.id,
        action="tenant_feature_flags_updated",
        entity_type="tenant",
        entity_id=tenant.id,
        new_values=append_impersonation_metadata({"feature_flags": tenant.feature_flags})
    )
    db.add(audit)

    db.commit()
    return {"message": "Feature flags updated", "feature_flags": tenant.feature_flags}


# =====================================================
# SUBSCRIPTION TIERS ENDPOINT
# =====================================================

@router.get("/subscription-tiers", response_model=SubscriptionTiersResponse)
async def get_subscription_tiers(
    current_user: User = Depends(get_platform_admin)
):
    """Get available subscription tiers"""
    return SubscriptionTiersResponse(tiers=SUBSCRIPTION_TIERS)


# =====================================================
# PLATFORM HEALTH ENDPOINT
# =====================================================

@router.get("/health", response_model=PlatformHealthResponse)
async def get_platform_health(
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """Get platform health status (Platform Admin only)"""
    components = []
    
    # Database check
    try:
        db.execute("SELECT 1")
        components.append(SystemHealthCheck(
            component="database",
            status="healthy",
            message="PostgreSQL connection OK"
        ))
    except Exception as e:
        components.append(SystemHealthCheck(
            component="database",
            status="down",
            message=str(e)
        ))
    
    # Overall status
    overall_status = "healthy"
    if any(c.status == "down" for c in components):
        overall_status = "down"
    elif any(c.status == "degraded" for c in components):
        overall_status = "degraded"
    
    return PlatformHealthResponse(
        status=overall_status,
        version="1.0.0",
        uptime_seconds=0,  # Would need to track actual uptime
        components=components,
        checked_at=datetime.utcnow()
    )


# =====================================================
# PLATFORM AUDIT LOG ENDPOINT
# =====================================================

@router.get("/audit-logs", response_model=PlatformAuditResponse)
async def get_platform_audit_logs(
    tenant_id: Optional[UUID] = None,
    action: Optional[str] = None,
    actor_id: Optional[UUID] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = 1,
    page_size: int = 50,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """Get platform-wide audit logs (Platform Admin only)"""
    query = db.query(AuditLog)
    
    if tenant_id:
        query = query.filter(AuditLog.tenant_id == tenant_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if actor_id:
        query = query.filter(AuditLog.actor_id == actor_id)
    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)
    
    total = query.count()
    
    logs = query.order_by(AuditLog.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    entries = []
    for log in logs:
        actor = db.query(User).filter(User.id == log.actor_id).first() if log.actor_id else None
        tenant = db.query(Tenant).filter(Tenant.id == log.tenant_id).first() if log.tenant_id else None
        
        entries.append(PlatformAuditEntry(
            id=log.id,
            actor_id=log.actor_id,
            actor_email=actor.email if actor else None,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            tenant_id=log.tenant_id,
            tenant_name=tenant.name if tenant else None,
            details={
                "old_values": log.old_values,
                "new_values": log.new_values
            },
            ip_address=log.ip_address,
            created_at=log.created_at
        ))
    
    return PlatformAuditResponse(
        entries=entries,
        total=total,
        page=page,
        page_size=page_size
    )
