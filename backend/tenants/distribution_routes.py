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

from models import Tenant, User, Wallet, BudgetDistributionLog, Recognition
from database import get_db
from auth import get_current_user
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
    current_user: User = Depends(get_current_user),
) -> User:
    """Verify user is a tenant manager"""
    if current_user.org_role not in ['tenant_manager', 'hr_admin']:
        raise HTTPException(
            status_code=403,
            detail="Only tenant managers can access this endpoint"
        )
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
    from datetime import datetime
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    distribution_today = db.query(BudgetDistributionLog).filter(
        BudgetDistributionLog.tenant_id == tenant.id,
        BudgetDistributionLog.created_at >= today_start
    ).count()
    
    current_balance = Decimal(str(stats["budget_allocation_balance"]))
    
    return AllocationPoolStats(
        current_balance=current_balance,
        total_allocated_today=Decimal(str(stats["distributed_today"])),
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
