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
    Tenant, User, Department, Budget, Recognition, Redemption, Wallet, AuditLog, MasterBudgetLedger,
    ActorType, SystemAdmin
)
from auth.utils import get_password_hash
from core import append_impersonation_metadata
from core.rbac import get_platform_admin
from platform_admin.schemas import (
    TenantCreateRequest, TenantUpdateRequest,
    TenantListResponse, TenantDetailResponse,
    SubscriptionTiersResponse, SUBSCRIPTION_TIERS,
    PlatformHealthResponse, SystemHealthCheck,
    PlatformAuditEntry, PlatformAuditResponse, FeatureFlagsUpdate, BudgetActivityResponse,
    MasterBudgetAdjustRequest, RecallMasterBudgetRequest
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
            func.lower(User.status) == 'active'
        ).count()
        
        result.append(TenantListResponse(
            id=tenant.id,
            name=tenant.name,
            slug=tenant.slug,
            domain=tenant.domain,
            logo_url=tenant.logo_url,
            status=tenant.status,
            subscription_tier=tenant.subscription_tier,
            subscription_status=tenant.subscription_status,
            max_users=tenant.max_users or 50,
            user_count=user_count,
            created_at=tenant.created_at,
            master_budget_balance=Decimal(str(tenant.master_budget_balance or 0)),
            budget_allocated=Decimal(str(tenant.budget_allocated or 0)),
            display_currency=tenant.display_currency or 'INR',
            feature_flags=tenant.feature_flags or {},
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
        # Create tenant with correct field names and structure
        tenant = Tenant(
            name=tenant_data.name,
            slug=tenant_data.slug,
            domain=tenant_data.domain,
            logo_url=tenant_data.logo_url,
            theme_config={
                "primary_color": "#3B82F6",
                "secondary_color": "#8B5CF6",
                "font_family": "Inter"
            },
            status='active',
            subscription_tier=tenant_data.subscription_tier,
            subscription_status='active',
            subscription_started_at=datetime.utcnow(),
            max_users=tenant_data.max_users,
            master_budget_balance=starting_balance,
            # Multi-currency configuration
            base_currency='USD',  # Always USD as base
            display_currency=tenant_data.display_currency,  # User-selected currency (USD, EUR, INR)
            fx_rate=tenant_data.fx_rate or Decimal("1.0"),  # Exchange rate
            settings=tenant_data.settings or {
                "copay_enabled": False,
                "points_to_currency_ratio": 0.10,
                "peer_to_peer_recognition": True,
                "social_feed_enabled": True,
                "events_module_enabled": True
            },
            feature_flags=tenant_data.feature_flags or {},
            catalog_settings={},
            branding={}
        )
        db.add(tenant)
        db.flush()
        
        # Create default HR department with proper name from constraint
        hr_dept = Department(
            tenant_id=tenant.id,
            name="Human Resource (HR)"  # Must match constraint
        )
        db.add(hr_dept)
        db.flush()
        
        # Determine admin org_role based on selected modules/feature flags
        admin_org_role = 'tenant_manager'  # default
        
        feature_flags = tenant_data.feature_flags or {}
        if feature_flags.get('sales_marketing') or feature_flags.get('sales_marketting_enabled'):
            admin_org_role = 'sales_marketing'
        elif feature_flags.get('ai_copilot') or feature_flags.get('ai_module_enabled'):
            admin_org_role = 'ai_copilot'
        
        # Create admin user with correct field names (corporate_email, org_role)
        admin_user = User(
            tenant_id=tenant.id,
            corporate_email=tenant_data.admin_email,
            password_hash=get_password_hash(tenant_data.admin_password),
            first_name=tenant_data.admin_first_name,
            last_name=tenant_data.admin_last_name,
            org_role=admin_org_role,
            department_id=hr_dept.id,
            status='ACTIVE',
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
        db.flush()

        # Initialize master budget ledger
        ledger_entry = MasterBudgetLedger(
            tenant_id=tenant.id,
            transaction_type="credit",
            source="provisioning",
            points=starting_balance,
            balance_after=starting_balance,
            description="Initial master budget allocation",
            created_by=current_user.id,
            created_by_type=ActorType.SYSTEM_ADMIN
        )
        db.add(ledger_entry)
        
        # Audit log
        audit = AuditLog(
            tenant_id=tenant.id,
            actor_id=current_user.id,
            actor_type=ActorType.SYSTEM_ADMIN,
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
        theme_config=tenant.theme_config or {},
        branding_config=tenant.branding_config or {},
        domain_whitelist=tenant.domain_whitelist or [],
        auth_method=tenant.auth_method or 'OTP_ONLY',
        status=tenant.status,
        currency=tenant.currency or 'INR',
        markup_percent=tenant.markup_percent or Decimal('0.0'),
        enabled_rewards=tenant.enabled_rewards or [],
        currency_label=tenant.currency_label or 'Points',
        conversion_rate=tenant.conversion_rate or Decimal('1.0'),
        auto_refill_threshold=tenant.auto_refill_threshold or Decimal('20.0'),
        base_currency=tenant.base_currency or 'USD',
        display_currency=tenant.display_currency or 'USD',
        fx_rate=tenant.fx_rate or Decimal('1.0'),
        award_tiers=tenant.award_tiers or {},
        peer_to_peer_enabled=tenant.peer_to_peer_enabled or True,
        expiry_policy=tenant.expiry_policy or 'never',
        redemptions_paused=tenant.redemptions_paused or False,
        subscription_tier=tenant.subscription_tier,
        subscription_status=tenant.subscription_status,
        subscription_started_at=tenant.subscription_started_at,
        subscription_ends_at=tenant.subscription_ends_at,
        max_users=tenant.max_users or 50,
        master_budget_balance=Decimal(str(tenant.master_budget_balance or 0)),
        feature_flags=tenant.feature_flags or {},
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
        func.lower(User.status) == 'active'
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

    # Financial aggregates from master budget ledger
    total_allocated = db.query(func.sum(MasterBudgetLedger.points)).filter(
        MasterBudgetLedger.tenant_id == tenant_id,
        func.lower(MasterBudgetLedger.transaction_type) == 'credit'
    ).scalar() or 0

    total_spent = db.query(func.sum(MasterBudgetLedger.points)).filter(
        MasterBudgetLedger.tenant_id == tenant_id,
        func.lower(MasterBudgetLedger.transaction_type) == 'debit'
    ).scalar() or 0

    return TenantDetailResponse(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        domain=tenant.domain,
        logo_url=tenant.logo_url,
        favicon_url=tenant.favicon_url,
        theme_config=tenant.theme_config or {},
        branding_config=tenant.branding_config or {},
        domain_whitelist=tenant.domain_whitelist or [],
        auth_method=tenant.auth_method or 'OTP_ONLY',
        status=tenant.status,
        currency=tenant.currency or 'INR',
        markup_percent=tenant.markup_percent or Decimal('0.0'),
        enabled_rewards=tenant.enabled_rewards or [],
        currency_label=tenant.currency_label or 'Points',
        conversion_rate=tenant.conversion_rate or Decimal('1.0'),
        auto_refill_threshold=tenant.auto_refill_threshold or Decimal('20.0'),
        base_currency=tenant.base_currency or 'USD',
        display_currency=tenant.display_currency or 'USD',
        fx_rate=tenant.fx_rate or Decimal('1.0'),
        award_tiers=tenant.award_tiers or {},
        peer_to_peer_enabled=tenant.peer_to_peer_enabled or True,
        expiry_policy=tenant.expiry_policy or 'never',
        redemptions_paused=tenant.redemptions_paused or False,
        subscription_tier=tenant.subscription_tier,
        subscription_status=tenant.subscription_status,
        subscription_started_at=tenant.subscription_started_at,
        subscription_ends_at=tenant.subscription_ends_at,
        max_users=tenant.max_users or 50,
        master_budget_balance=Decimal(str(tenant.master_budget_balance or 0)),
        feature_flags=tenant.feature_flags or {},
        settings=tenant.settings or {},
        catalog_settings=tenant.catalog_settings or {},
        branding=tenant.branding or {},
        created_at=tenant.created_at,
        updated_at=tenant.updated_at,
        user_count=user_count,
        active_user_count=active_user_count,
        department_count=department_count,
        total_recognitions=total_recognitions,
        total_points_distributed=Decimal(str(total_points)),
        total_allocated=Decimal(str(total_allocated)),
        total_spent=Decimal(str(total_spent))
    )


@router.get("/tenants/{tenant_id}/budget-activity", response_model=BudgetActivityResponse)
async def get_budget_activity(
    tenant_id: UUID,
    period: str = Query('monthly', regex='^(monthly|quarterly)$'),
    intervals: int = Query(6, ge=1, le=24),
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """Return budget activity aggregated by month or quarter for the last `intervals` periods."""
    from sqlalchemy import case

    now = datetime.utcnow()

    if period == 'monthly':
        # start from first day of month N-1 months ago
        def add_months(dt, months):
            y = dt.year + (dt.month - 1 + months) // 12
            m = (dt.month - 1 + months) % 12 + 1
            return dt.replace(year=y, month=m, day=1, hour=0, minute=0, second=0, microsecond=0)

        start = add_months(now, -intervals + 1)
        period_trunc = func.date_trunc('month', MasterBudgetLedger.created_at).label('period')
        rows = db.query(
            period_trunc,
            func.sum(case([(func.lower(MasterBudgetLedger.transaction_type) == 'credit', MasterBudgetLedger.points)], else_=0)).label('credits'),
            func.sum(case([(func.lower(MasterBudgetLedger.transaction_type) == 'debit', MasterBudgetLedger.points)], else_=0)).label('debits')
        ).filter(
            MasterBudgetLedger.tenant_id == tenant_id,
            MasterBudgetLedger.created_at >= start
        ).group_by(period_trunc).order_by(period_trunc).all()

        # Build a map for quick lookup
        data_map = {r.period.strftime('%Y-%m'): {'credits': float(r.credits or 0), 'debits': float(r.debits or 0)} for r in rows}
        results = []
        for i in range(intervals):
            period_dt = add_months(start, i)
            label = period_dt.strftime('%b %Y')
            key = period_dt.strftime('%Y-%m')
            credits = data_map.get(key, {}).get('credits', 0)
            debits = data_map.get(key, {}).get('debits', 0)
            results.append({'period': label, 'credits': Decimal(str(credits)), 'debits': Decimal(str(debits)), 'net': Decimal(str(credits - debits))})

    else:  # quarterly
        # quarters are 3-month groups
        def start_of_quarter(dt):
            q = ((dt.month - 1) // 3) + 1
            m = (q - 1) * 3 + 1
            return dt.replace(month=m, day=1, hour=0, minute=0, second=0, microsecond=0)

        def add_quarters(dt, quarters):
            return add_months(dt, quarters * 3)

        # reuse add_months
        def add_months(dt, months):
            y = dt.year + (dt.month - 1 + months) // 12
            m = (dt.month - 1 + months) % 12 + 1
            return dt.replace(year=y, month=m, day=1, hour=0, minute=0, second=0, microsecond=0)

        start = start_of_quarter(add_months(now, -3 * (intervals - 1)))
        period_trunc = func.date_trunc('quarter', MasterBudgetLedger.created_at).label('period')
        rows = db.query(
            period_trunc,
            func.sum(case([(func.lower(MasterBudgetLedger.transaction_type) == 'credit', MasterBudgetLedger.points)], else_=0)).label('credits'),
            func.sum(case([(func.lower(MasterBudgetLedger.transaction_type) == 'debit', MasterBudgetLedger.points)], else_=0)).label('debits')
        ).filter(
            MasterBudgetLedger.tenant_id == tenant_id,
            MasterBudgetLedger.created_at >= start
        ).group_by(period_trunc).order_by(period_trunc).all()

        data_map = {r.period.strftime('%Y-%m'): {'credits': float(r.credits or 0), 'debits': float(r.debits or 0)} for r in rows}
        results = []
        for i in range(intervals):
            period_dt = add_months(start, i * 3)
            q = ((period_dt.month - 1) // 3) + 1
            label = f"Q{q} {period_dt.year}"
            key = period_dt.strftime('%Y-%m')
            credits = data_map.get(key, {}).get('credits', 0)
            debits = data_map.get(key, {}).get('debits', 0)
            results.append({'period': label, 'credits': Decimal(str(credits)), 'debits': Decimal(str(debits)), 'net': Decimal(str(credits - debits))})

    return BudgetActivityResponse(data=results)


@router.post("/tenants/{tenant_id}/recall-budget")
async def recall_master_budget(
    tenant_id: UUID,
    payload: RecallMasterBudgetRequest,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """Recall budget from tenant's unallocated master pool back to platform (Platform Admin only)."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    remaining = Decimal(str(tenant.master_budget_balance or 0))
    amount = Decimal(str(payload.amount))

    if amount > remaining:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot recall {amount} — only {remaining} is available in the unallocated pool"
        )

    new_balance = remaining - amount

    ledger_entry = MasterBudgetLedger(
        tenant_id=tenant.id,
        transaction_type='debit',
        source='recall',
        points=amount,
        balance_after=new_balance,
        description=f"Platform recall: {payload.justification}",
        created_by=current_user.id,
        created_by_type=ActorType.SYSTEM_ADMIN
    )
    db.add(ledger_entry)

    tenant.master_budget_balance = new_balance

    audit = AuditLog(
        tenant_id=tenant.id,
        actor_id=current_user.id,
        actor_type=ActorType.SYSTEM_ADMIN,
        action='master_budget_recalled',
        entity_type='tenant',
        entity_id=tenant.id,
        new_values=append_impersonation_metadata({
            'recalled_amount': str(amount),
            'balance_after': str(new_balance),
            'justification': payload.justification
        })
    )
    db.add(audit)

    db.commit()
    db.refresh(tenant)

    return {
        "message": f"Successfully recalled {amount} points from {tenant.name}",
        "recalled_amount": str(amount),
        "new_balance": str(new_balance),
        "tenant_name": tenant.name
    }


@router.post("/tenants/{tenant_id}/master-budget", response_model=TenantDetailResponse)
async def adjust_master_budget(
    tenant_id: UUID,
    payload: MasterBudgetAdjustRequest,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """Adjust the tenant's master budget by creating a MasterBudgetLedger entry (credit)."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    points = Decimal(str(payload.points))
    if points <= 0:
        raise HTTPException(status_code=400, detail="Points must be positive")

    new_balance = Decimal(str(tenant.master_budget_balance or 0)) + points

    ledger_entry = MasterBudgetLedger(
        tenant_id=tenant.id,
        transaction_type='credit',
        source='provisioning',
        points=points,
        balance_after=new_balance,
        description=payload.description or 'Provisioned budget',
        created_by=current_user.id,
        created_by_type=ActorType.SYSTEM_ADMIN
    )
    db.add(ledger_entry)

    tenant.master_budget_balance = new_balance

    audit = AuditLog(
        tenant_id=tenant.id,
        actor_id=current_user.id,
        actor_type=ActorType.SYSTEM_ADMIN,
        action='master_budget_provisioned',
        entity_type='tenant',
        entity_id=tenant.id,
        new_values=append_impersonation_metadata({
            'points': str(points),
            'balance_after': str(new_balance)
        })
    )
    db.add(audit)

    db.commit()
    db.refresh(tenant)

    # Return updated tenant detail
    user_count = db.query(User).filter(
        User.tenant_id == tenant_id,
        func.lower(User.status) == 'active'
    ).count()

    return TenantDetailResponse(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        domain=tenant.domain,
        logo_url=tenant.logo_url,
        favicon_url=tenant.favicon_url,
        theme_config=tenant.theme_config or {},
        branding_config=tenant.branding_config or {},
        domain_whitelist=tenant.domain_whitelist or [],
        auth_method=tenant.auth_method or 'OTP_ONLY',
        status=tenant.status,
        currency=tenant.currency or 'INR',
        markup_percent=tenant.markup_percent or Decimal('0.0'),
        enabled_rewards=tenant.enabled_rewards or [],
        currency_label=tenant.currency_label or 'Points',
        conversion_rate=tenant.conversion_rate or Decimal('1.0'),
        auto_refill_threshold=tenant.auto_refill_threshold or Decimal('20.0'),
        base_currency=tenant.base_currency or 'USD',
        display_currency=tenant.display_currency or 'USD',
        fx_rate=tenant.fx_rate or Decimal('1.0'),
        award_tiers=tenant.award_tiers or {},
        peer_to_peer_enabled=tenant.peer_to_peer_enabled or True,
        expiry_policy=tenant.expiry_policy or 'never',
        redemptions_paused=tenant.redemptions_paused or False,
        subscription_tier=tenant.subscription_tier,
        subscription_status=tenant.subscription_status,
        subscription_started_at=tenant.subscription_started_at,
        subscription_ends_at=tenant.subscription_ends_at,
        max_users=tenant.max_users or 50,
        master_budget_balance=Decimal(str(tenant.master_budget_balance or 0)),
        feature_flags=tenant.feature_flags or {},
        settings=tenant.settings or {},
        catalog_settings=tenant.catalog_settings or {},
        branding=tenant.branding or {},
        created_at=tenant.created_at,
        updated_at=tenant.updated_at,
        user_count=user_count
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
        actor_type=ActorType.SYSTEM_ADMIN,
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
        func.lower(User.status) == 'active'
    ).count()
    
    return TenantDetailResponse(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        domain=tenant.domain,
        logo_url=tenant.logo_url,
        favicon_url=tenant.favicon_url,
        theme_config=tenant.theme_config or {},
        branding_config=tenant.branding_config or {},
        domain_whitelist=tenant.domain_whitelist or [],
        auth_method=tenant.auth_method or 'OTP_ONLY',
        status=tenant.status,
        currency=tenant.currency or 'INR',
        markup_percent=tenant.markup_percent or Decimal('0.0'),
        enabled_rewards=tenant.enabled_rewards or [],
        currency_label=tenant.currency_label or 'Points',
        conversion_rate=tenant.conversion_rate or Decimal('1.0'),
        auto_refill_threshold=tenant.auto_refill_threshold or Decimal('20.0'),
        base_currency=tenant.base_currency or 'USD',
        display_currency=tenant.display_currency or 'USD',
        fx_rate=tenant.fx_rate or Decimal('1.0'),
        award_tiers=tenant.award_tiers or {},
        peer_to_peer_enabled=tenant.peer_to_peer_enabled or True,
        expiry_policy=tenant.expiry_policy or 'never',
        redemptions_paused=tenant.redemptions_paused or False,
        subscription_tier=tenant.subscription_tier,
        subscription_status=tenant.subscription_status,
        subscription_started_at=tenant.subscription_started_at,
        subscription_ends_at=tenant.subscription_ends_at,
        max_users=tenant.max_users or 50,
        master_budget_balance=Decimal(str(tenant.master_budget_balance or 0)),
        feature_flags=tenant.feature_flags or {},
        settings=tenant.settings or {},
        catalog_settings=tenant.catalog_settings or {},
        branding=tenant.branding or {},
        created_at=tenant.created_at,
        updated_at=tenant.updated_at,
        user_count=user_count
    )


@router.patch("/tenants/{tenant_id}", response_model=TenantDetailResponse)
async def patch_tenant(
    tenant_id: UUID,
    tenant_data: TenantUpdateRequest,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """Patch tenant details (Platform Admin only) - partial updates allowed."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    update_data = tenant_data.model_dump(exclude_unset=True)
    old_values = {k: str(getattr(tenant, k)) for k in update_data.keys()}

    for key, value in update_data.items():
        setattr(tenant, key, value)

    audit = AuditLog(
        tenant_id=tenant.id,
        actor_id=current_user.id,
        actor_type=ActorType.SYSTEM_ADMIN,
        action="tenant_patched",
        entity_type="tenant",
        entity_id=tenant.id,
        old_values=old_values,
        new_values=append_impersonation_metadata({k: str(v) for k, v in update_data.items()})
    )
    db.add(audit)
    db.commit()
    db.refresh(tenant)

    user_count = db.query(User).filter(
        User.tenant_id == tenant_id,
        func.lower(User.status) == 'active'
    ).count()

    return TenantDetailResponse(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        domain=tenant.domain,
        logo_url=tenant.logo_url,
        favicon_url=tenant.favicon_url,
        theme_config=tenant.theme_config or {},
        branding_config=tenant.branding_config or {},
        domain_whitelist=tenant.domain_whitelist or [],
        auth_method=tenant.auth_method or 'OTP_ONLY',
        status=tenant.status,
        currency=tenant.currency or 'INR',
        markup_percent=tenant.markup_percent or Decimal('0.0'),
        enabled_rewards=tenant.enabled_rewards or [],
        currency_label=tenant.currency_label or 'Points',
        conversion_rate=tenant.conversion_rate or Decimal('1.0'),
        auto_refill_threshold=tenant.auto_refill_threshold or Decimal('20.0'),
        base_currency=tenant.base_currency or 'USD',
        display_currency=tenant.display_currency or 'USD',
        fx_rate=tenant.fx_rate or Decimal('1.0'),
        award_tiers=tenant.award_tiers or {},
        peer_to_peer_enabled=tenant.peer_to_peer_enabled or True,
        expiry_policy=tenant.expiry_policy or 'never',
        redemptions_paused=tenant.redemptions_paused or False,
        subscription_tier=tenant.subscription_tier,
        subscription_status=tenant.subscription_status,
        subscription_started_at=tenant.subscription_started_at,
        subscription_ends_at=tenant.subscription_ends_at,
        max_users=tenant.max_users or 50,
        master_budget_balance=Decimal(str(tenant.master_budget_balance or 0)),
        feature_flags=tenant.feature_flags or {},
        settings=tenant.settings or {},
        catalog_settings=tenant.catalog_settings or {},
        branding=tenant.branding or {},
        created_at=tenant.created_at,
        updated_at=tenant.updated_at,
        user_count=user_count
    )


@router.post("/tenants/{tenant_id}/recalculate-balances")
async def recalculate_balances(
    tenant_id: UUID,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """Trigger a balances recalculation for the tenant. This is a safe operation that
    ensures numeric fields are normalized and clears nulls that may render as NaN in the UI.
    """
    wallets = db.query(Wallet).filter(Wallet.tenant_id == tenant_id).all()
    updated = 0
    for w in wallets:
        # Normalise None values to zero to avoid NaN UI issues
        changed = False
        if w.balance is None:
            w.balance = 0
            changed = True
        if w.lifetime_earned is None:
            w.lifetime_earned = 0
            changed = True
        if w.lifetime_spent is None:
            w.lifetime_spent = 0
            changed = True
        if changed:
            db.add(w)
            updated += 1

    db.commit()

    # Audit
    audit = AuditLog(
        tenant_id=tenant_id,
        actor_id=current_user.id,
        actor_type=ActorType.SYSTEM_ADMIN,
        action="recalculate_balances",
        entity_type="tenant",
        entity_id=tenant_id,
        new_values={"wallets_normalized": updated}
    )
    db.add(audit)
    db.commit()

    return {"updated_wallets": updated}


@router.put("/tenants/{tenant_id}/subscription", response_model=TenantDetailResponse)
async def update_subscription(
    tenant_id: UUID,
    subscription: TenantUpdateRequest,
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
        actor_type=ActorType.SYSTEM_ADMIN,
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
        func.lower(User.status) == 'active'
    ).count()
    
    return TenantDetailResponse(
        id=tenant.id,
        name=tenant.name,
        slug=tenant.slug,
        domain=tenant.domain,
        logo_url=tenant.logo_url,
        favicon_url=tenant.favicon_url,
        theme_config=tenant.theme_config or {},
        branding_config=tenant.branding_config or {},
        domain_whitelist=tenant.domain_whitelist or [],
        auth_method=tenant.auth_method or 'OTP_ONLY',
        status=tenant.status,
        currency=tenant.currency or 'INR',
        markup_percent=tenant.markup_percent or Decimal('0.0'),
        enabled_rewards=tenant.enabled_rewards or [],
        currency_label=tenant.currency_label or 'Points',
        conversion_rate=tenant.conversion_rate or Decimal('1.0'),
        auto_refill_threshold=tenant.auto_refill_threshold or Decimal('20.0'),
        base_currency=tenant.base_currency or 'USD',
        display_currency=tenant.display_currency or 'USD',
        fx_rate=tenant.fx_rate or Decimal('1.0'),
        award_tiers=tenant.award_tiers or {},
        peer_to_peer_enabled=tenant.peer_to_peer_enabled or True,
        expiry_policy=tenant.expiry_policy or 'never',
        redemptions_paused=tenant.redemptions_paused or False,
        subscription_tier=tenant.subscription_tier,
        subscription_status=tenant.subscription_status,
        subscription_started_at=tenant.subscription_started_at,
        subscription_ends_at=tenant.subscription_ends_at,
        max_users=tenant.max_users or 50,
        master_budget_balance=Decimal(str(tenant.master_budget_balance or 0)),
        feature_flags=tenant.feature_flags or {},
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
        actor_type=ActorType.SYSTEM_ADMIN,
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
        actor_type=ActorType.SYSTEM_ADMIN,
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
        actor_type=ActorType.SYSTEM_ADMIN,
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
        actor_email = None
        if log.actor_id:
            if log.actor_type == ActorType.SYSTEM_ADMIN:
                admin = db.query(SystemAdmin).filter(SystemAdmin.id == log.actor_id).first()
                actor_email = admin.email if admin else "system"
            else:
                user = db.query(User).filter(User.id == log.actor_id).first()
                actor_email = user.corporate_email if user else None
        
        tenant = db.query(Tenant).filter(Tenant.id == log.tenant_id).first() if log.tenant_id else None
        
        entries.append(PlatformAuditEntry(
            id=log.id,
            actor_id=log.actor_id,
            actor_type=log.actor_type.value if hasattr(log.actor_type, 'value') else str(log.actor_type),
            actor_email=actor_email,
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
