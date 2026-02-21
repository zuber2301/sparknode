"""
Tenant Manager - Budget Distribution Routes

Routes for Tenant Managers to:
1. View available allocation pool
2. Distribute budget to leads
3. Award budget to employees via recognition
4. View distribution history
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

from models import Tenant, User, Wallet, WalletLedger, BudgetDistributionLog, Department, Recognition
from database import get_db
from auth.utils import get_current_user, require_tenant_manager_or_platform
from core.budget_service import BudgetService, BudgetAllocationError
from core.audit_service import AuditService


router = APIRouter(prefix="/api/budgets", tags=["tenant-budget-distribution"])


# =====================================================
# SCHEMAS
# =====================================================

class AllocationPoolStats(BaseModel):
    """Current budget pool statistics for tenant manager"""
    current_balance: Decimal
    total_allocated_today: Decimal
    distribution_count: int
    manager_can_distribute: bool  # True if balance > 0
    message: str  # UI message

    class Config:
        json_schema_extra = {
            "example": {
                "current_balance": 50000,
                "total_allocated_today": 5000,
                "distribution_count": 12,
                "manager_can_distribute": True,
                "message": "You have 50,000 budget available to distribute to your team."
            }
        }


class DistributeToLeadRequest(BaseModel):
    """Tenant Manager distributes budget from pool to a lead"""
    to_user_id: UUID
    amount: Decimal
    description: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "to_user_id": "770e8400-e29b-41d4-a716-446655440001",
                "amount": 5000,
                "description": "Monthly recognition budget"
            }
        }


class AwardBudgetRequest(BaseModel):
    """Manager awards budget to employee (used during recognition)"""
    to_user_id: UUID
    amount: Decimal
    reference_type: str  # recognition, event_bonus, etc.
    reference_id: Optional[UUID] = None
    description: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "to_user_id": "770e8400-e29b-41d4-a716-446655440002",
                "amount": 1000,
                "reference_type": "recognition",
                "reference_id": "550e8400-e29b-41d4-a716-446655440003",
                "description": "Outstanding performance on Q1 project"
            }
        }


class DistributionResponse(BaseModel):
    """Response after distribution"""
    from_user_id: UUID
    to_user_id: UUID
    to_user_name: str
    amount: Decimal
    transaction_type: str
    previous_balance: Decimal
    new_balance: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


class BudgetDistributionLogResponse(BaseModel):
    """Budget distribution log entry"""
    id: UUID
    from_user_id: UUID
    to_user_id: UUID
    amount: Decimal
    transaction_type: str
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# =====================================================
# HELPER: Verify Tenant Manager
# =====================================================

async def get_tenant_manager(
    current_user: User = Depends(require_tenant_manager_or_platform),
) -> User:
    """Verify user is a tenant manager or platform admin"""
    return current_user


# =====================================================
# ENDPOINTS
# =====================================================

@router.get("/pool", response_model=AllocationPoolStats)
async def get_budget_pool_status(
    current_user: User = Depends(get_tenant_manager),
    db: Session = Depends(get_db)
):
    """
    Get current budget pool status for tenant manager.
    Shows available budget and distribution history.

    This is displayed in the "Manager Stats" card on the dashboard.
    """
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Get stats
    stats = BudgetService.get_tenant_budget_stats(db, tenant)

    # Get distribution count for today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    distribution_today = db.query(BudgetDistributionLog).filter(
        BudgetDistributionLog.tenant_id == tenant.id,
        BudgetDistributionLog.created_at >= today_start
    ).count()

    current_balance = Decimal(str(stats.get("budget_allocation_balance", 0)))

    return AllocationPoolStats(
        current_balance=current_balance,
        total_allocated_today=Decimal(str(stats.get("distributed_today", 0))),
        distribution_count=distribution_today,
        manager_can_distribute=current_balance > 0,
        message=(
            f"Company Distribution Pool: {current_balance:,.0f} budget available. "
            f"Distribute to your team members to recognize their contributions."
            if current_balance > 0
            else "No budget available in the distribution pool. Contact your administrator."
        )
    )


@router.post("/distribute-to-lead", response_model=DistributionResponse)
async def distribute_to_lead(
    request: DistributeToLeadRequest,
    current_user: User = Depends(get_tenant_manager),
    db: Session = Depends(get_db)
):
    """
    Tenant Manager distributes budget from pool to a Lead.

    The lead can then further distribute to employees or keep for personal awards.
    """
    try:
        tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Get target lead
        lead_user = db.query(User).filter(
            User.id == request.to_user_id,
            User.tenant_id == current_user.tenant_id
        ).first()

        if not lead_user:
            raise HTTPException(status_code=404, detail="Lead user not found")

        if lead_user.org_role not in ['dept_lead', 'manager']:
            raise HTTPException(
                status_code=400,
                detail=f"Can only distribute to leads/managers, not {lead_user.org_role}"
            )

        # Distribute budget
        updated_tenant, updated_wallet, distribution_log = BudgetService.distributeToLead(
            db=db,
            tenant=tenant,
            from_manager=current_user,
            to_lead=lead_user,
            amount=request.amount,
            description=request.description
        )

        db.commit()

        return DistributionResponse(
            from_user_id=current_user.id,
            to_user_id=lead_user.id,
            to_user_name=lead_user.full_name,
            amount=distribution_log.amount,
            transaction_type=distribution_log.transaction_type,
            previous_balance=distribution_log.previous_pool_balance,
            new_balance=distribution_log.new_pool_balance,
            created_at=distribution_log.created_at
        )

    except BudgetAllocationError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Distribution failed: {str(e)}")


@router.post("/award-budget", response_model=DistributionResponse)
async def award_budget_to_user(
    request: AwardBudgetRequest,
    current_user: User = Depends(get_tenant_manager),
    db: Session = Depends(get_db)
):
    """
    Manager awards budget directly to an employee from allocation pool.

    This is used when recognizing an employee or awarding event bonuses.
    Budget is deducted from tenant pool and added to employee's wallet.
    """
    try:
        tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Get target employee
        target_user = db.query(User).filter(
            User.id == request.to_user_id,
            User.tenant_id == current_user.tenant_id
        ).first()

        if not target_user:
            raise HTTPException(status_code=404, detail="Employee not found")

        # Award budget
        updated_wallet, ledger, distribution_log = BudgetService.awardToUser(
            db=db,
            tenant=tenant,
            from_user=current_user,
            to_user=target_user,
            amount=request.amount,
            reference_type=request.reference_type,
            reference_id=request.reference_id,
            description=request.description
        )

        db.commit()

        return DistributionResponse(
            from_user_id=current_user.id,
            to_user_id=target_user.id,
            to_user_name=target_user.full_name,
            amount=distribution_log.amount,
            transaction_type=distribution_log.transaction_type,
            previous_balance=distribution_log.previous_pool_balance,
            new_balance=distribution_log.new_pool_balance,
            created_at=distribution_log.created_at
        )

    except BudgetAllocationError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Award failed: {str(e)}")


@router.get("/history", response_model=List[BudgetDistributionLogResponse])
async def get_distribution_history(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_tenant_manager),
    db: Session = Depends(get_db)
):
    """
    Get distribution history for current tenant manager.
    Shows all budget distributed to team members.
    """
    logs = db.query(BudgetDistributionLog).filter(
        BudgetDistributionLog.tenant_id == current_user.tenant_id,
        BudgetDistributionLog.from_user_id == current_user.id
    ).order_by(BudgetDistributionLog.created_at.desc()).offset(skip).limit(limit).all()

    return logs


@router.get("/history/tenant", response_model=List[BudgetDistributionLogResponse])
async def get_tenant_distribution_history(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_tenant_manager),
    db: Session = Depends(get_db)
):
    """
    Get all distribution history for the entire tenant.
    Shows all budget distributed by any manager to any employee.
    """
    logs = db.query(BudgetDistributionLog).filter(
        BudgetDistributionLog.tenant_id == current_user.tenant_id
    ).order_by(BudgetDistributionLog.created_at.desc()).offset(skip).limit(limit).all()

    return logs


# =====================================================
# NEW WORKFLOW 1: Dept Per-User Distribution
# =====================================================

class DeptPerUserPreviewItem(BaseModel):
    id: str
    name: str
    active_user_count: int
    current_balance: Decimal
    current_allocated: Decimal

class DeptPerUserPreviewResponse(BaseModel):
    departments: List[DeptPerUserPreviewItem]
    tenant_pool_balance: Decimal

class DeptPerUserDistributeRequest(BaseModel):
    department_id: UUID
    points_per_user: Decimal
    description: Optional[str] = None

class DeptPerUserDistributeResponse(BaseModel):
    department_id: str
    department_name: str
    points_per_user: Decimal
    user_count: int
    total_allocated: Decimal
    new_dept_balance: Decimal
    tenant_pool_remaining: Decimal
    message: str


@router.get("/dept-per-user-preview", response_model=DeptPerUserPreviewResponse)
async def get_dept_per_user_preview(
    current_user: User = Depends(require_tenant_manager_or_platform),
    db: Session = Depends(get_db)
):
    """
    Preview all departments with active user counts and current balances.
    Used by tenant manager before executing per-user distribution to a department.
    """
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    departments = db.query(Department).filter(
        Department.tenant_id == current_user.tenant_id
    ).all()

    items = []
    for dept in departments:
        user_count = db.query(User).filter(
            User.department_id == dept.id,
            User.tenant_id == current_user.tenant_id,
            User.status == 'ACTIVE'
        ).count()
        items.append(DeptPerUserPreviewItem(
            id=str(dept.id),
            name=dept.name,
            active_user_count=user_count,
            current_balance=Decimal(str(dept.budget_balance or 0)),
            current_allocated=Decimal(str(dept.budget_allocated or 0)),
        ))

    return DeptPerUserPreviewResponse(
        departments=items,
        tenant_pool_balance=Decimal(str(tenant.budget_allocation_balance or 0)),
    )


@router.post("/distribute-dept-per-user", response_model=DeptPerUserDistributeResponse)
async def distribute_to_dept_per_user(
    request: DeptPerUserDistributeRequest,
    current_user: User = Depends(require_tenant_manager_or_platform),
    db: Session = Depends(get_db)
):
    """
    Allocate budget to a department based on per-user points.

    total = points_per_user × number_of_active_users_in_dept
    Deducted from tenant.budget_allocation_balance.
    Added to department.budget_balance and department.budget_allocated.
    """
    if request.points_per_user <= 0:
        raise HTTPException(status_code=400, detail="points_per_user must be greater than 0")

    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    department = db.query(Department).filter(
        Department.id == request.department_id,
        Department.tenant_id == current_user.tenant_id,
    ).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    # Count active users
    active_users = db.query(User).filter(
        User.department_id == department.id,
        User.tenant_id == current_user.tenant_id,
        User.status == 'ACTIVE'
    ).count()

    if active_users == 0:
        raise HTTPException(status_code=400, detail="Department has no active users")

    total = Decimal(str(request.points_per_user)) * active_users
    pool = Decimal(str(tenant.budget_allocation_balance or 0))

    if pool < total:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient pool balance. Need {total:,.0f}, available {pool:,.0f}."
        )

    # Apply
    tenant.budget_allocation_balance = pool - total
    department.budget_balance = Decimal(str(department.budget_balance or 0)) + total
    department.budget_allocated = Decimal(str(department.budget_allocated or 0)) + total

    db.commit()
    db.refresh(department)
    db.refresh(tenant)

    return DeptPerUserDistributeResponse(
        department_id=str(department.id),
        department_name=department.name,
        points_per_user=request.points_per_user,
        user_count=active_users,
        total_allocated=total,
        new_dept_balance=Decimal(str(department.budget_balance)),
        tenant_pool_remaining=Decimal(str(tenant.budget_allocation_balance)),
        message=(
            f"Allocated {total:,.0f} pts to {department.name} "
            f"({active_users} users × {request.points_per_user:,.0f} pts each)."
        ),
    )


# =====================================================
# NEW WORKFLOW 2: Distribute to ALL users in tenant
# =====================================================

class AllUsersPreviewResponse(BaseModel):
    active_user_count: int
    tenant_pool_balance: Decimal

class AllUsersDistributeRequest(BaseModel):
    points_per_user: Decimal
    description: Optional[str] = None

class AllUsersDistributeResponse(BaseModel):
    users_credited: int
    points_per_user: Decimal
    total_distributed: Decimal
    tenant_pool_remaining: Decimal
    message: str


@router.get("/all-users-preview", response_model=AllUsersPreviewResponse)
async def get_all_users_preview(
    current_user: User = Depends(require_tenant_manager_or_platform),
    db: Session = Depends(get_db)
):
    """
    Preview: count of active users in tenant + current pool balance.
    """
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    count = db.query(User).filter(
        User.tenant_id == current_user.tenant_id,
        User.status == 'ACTIVE'
    ).count()

    return AllUsersPreviewResponse(
        active_user_count=count,
        tenant_pool_balance=Decimal(str(tenant.budget_allocation_balance or 0)),
    )


@router.post("/distribute-all-users", response_model=AllUsersDistributeResponse)
async def distribute_to_all_users(
    request: AllUsersDistributeRequest,
    current_user: User = Depends(require_tenant_manager_or_platform),
    db: Session = Depends(get_db)
):
    """
    Credit points_per_user directly to every active user's wallet.

    Deducts (points_per_user × user_count) from tenant.budget_allocation_balance.
    Creates wallet credit + ledger entry for each user.
    """
    if request.points_per_user <= 0:
        raise HTTPException(status_code=400, detail="points_per_user must be greater than 0")

    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    active_users = db.query(User).filter(
        User.tenant_id == current_user.tenant_id,
        User.status == 'ACTIVE'
    ).all()

    if not active_users:
        raise HTTPException(status_code=400, detail="No active users found in tenant")

    pts = Decimal(str(request.points_per_user))
    total = pts * len(active_users)
    pool = Decimal(str(tenant.budget_allocation_balance or 0))

    if pool < total:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient pool balance. Need {total:,.0f}, available {pool:,.0f}."
        )

    desc = request.description or f"Tenant-wide distribution by manager: {pts:,.0f} pts/user"
    credited = 0

    for u in active_users:
        # Get or create wallet
        wallet = db.query(Wallet).filter(Wallet.user_id == u.id).first()
        if not wallet:
            wallet = Wallet(
                user_id=u.id,
                tenant_id=current_user.tenant_id,
                balance=Decimal('0'),
                lifetime_earned=Decimal('0'),
                lifetime_spent=Decimal('0'),
            )
            db.add(wallet)
            db.flush()

        prev_balance = Decimal(str(wallet.balance or 0))
        wallet.balance = prev_balance + pts
        wallet.lifetime_earned = Decimal(str(wallet.lifetime_earned or 0)) + pts

        ledger = WalletLedger(
            tenant_id=current_user.tenant_id,
            wallet_id=wallet.id,
            transaction_type='credit',
            source='hr_allocation',
            points=pts,
            balance_after=wallet.balance,
            reference_type='tenant_wide_distribution',
            description=desc,
            created_by=current_user.id,
        )
        db.add(ledger)
        db.flush()  # flush each row individually to avoid bulk-insert sentinel mismatch
        credited += 1

    # Deduct from tenant pool
    tenant.budget_allocation_balance = pool - total
    db.commit()
    db.refresh(tenant)

    return AllUsersDistributeResponse(
        users_credited=credited,
        points_per_user=pts,
        total_distributed=total,
        tenant_pool_remaining=Decimal(str(tenant.budget_allocation_balance)),
        message=(
            f"Successfully distributed {pts:,.0f} pts to {credited} users "
            f"(total {total:,.0f} pts deducted from pool)."
        ),
    )
