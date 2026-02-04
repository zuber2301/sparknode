"""
Platform Admin - Budget Allocation Routes

Routes for Platform Admins to:
1. Allocate budget to tenants
2. View allocation history
3. Clawback budget from tenants
4. View tenant allocation statistics
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

from models import Tenant, User, BudgetAllocationLog, PlatformBudgetBillingLog, BudgetDistributionLog
from database import get_db
from auth import get_current_user
from core.budget_service import BudgetService, BudgetAllocationError
from core.audit_service import AuditService
from core import append_impersonation_metadata


router = APIRouter(prefix="/api/platform/budgets", tags=["platform-admin-budget-allocation"])


# =====================================================
# SCHEMAS
# =====================================================

class AllocateBudgetRequest(BaseModel):
    """Platform Admin allocates budget to a tenant"""
    tenant_id: UUID
    amount: Decimal
    currency: str = "INR"
    reference_note: Optional[str] = None
    invoice_number: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
                "amount": 50000,
                "currency": "INR",
                "reference_note": "Monthly subscription allocation - Invoice #8842",
                "invoice_number": "INV-2026-0201-001"
            }
        }


class ClawbackBudgetRequest(BaseModel):
    """Platform Admin claws back budget from a tenant"""
    tenant_id: UUID
    amount: Optional[Decimal] = None  # If None, claws back entire balance
    reason: str = "Tenant cancellation"
    
    class Config:
        json_schema_extra = {
            "example": {
                "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
                "amount": 10000,
                "reason": "Subscription cancelled per request"
            }
        }


class AllocationResponse(BaseModel):
    """Response after allocation"""
    tenant_id: UUID
    tenant_name: str
    previous_balance: Decimal
    new_balance: Decimal
    amount_allocated: Decimal
    currency: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class BudgetAllocationLogResponse(BaseModel):
    """Budget allocation log entry"""
    id: UUID
    tenant_id: UUID
    admin_id: UUID
    amount: Decimal
    currency: str
    transaction_type: str
    previous_balance: Decimal
    new_balance: Decimal
    reference_note: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class TenantBudgetStats(BaseModel):
    """Statistics for a tenant's budget pool"""
    tenant_id: UUID
    tenant_name: str
    current_balance: Decimal
    allocated_today: Decimal
    total_distributed: Decimal
    distribution_count: int
    last_allocation_at: Optional[datetime]
    
    class Config:
        from_attributes = True


# =====================================================
# HELPER: Verify Platform Admin
# =====================================================

async def get_platform_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Verify user is a platform admin"""
    if not current_user.is_platform_admin:
        raise HTTPException(
            status_code=403,
            detail="Only platform admins can access this endpoint"
        )
    return current_user


# =====================================================
# ENDPOINTS
# =====================================================

@router.post("/allocate", response_model=AllocationResponse)
async def allocate_budget_to_tenant(
    request: AllocateBudgetRequest,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """
    Platform Admin allocates budget to a tenant's distribution pool.
    
    This is the first step in the 3-tier allocation system.
    Budget is added to tenant.budget_allocation_balance for the tenant manager to distribute.
    
    Example Flow:
    1. Admin allocates 50,000 budget to "Triton Energy"
    2. Triton's budget_allocation_balance increases by 50,000
    3. Tenant Manager sees "Available to Distribute: 50,000"
    """
    try:
        # Get tenant
        tenant = db.query(Tenant).filter(Tenant.id == request.tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        # Allocate budget using service
        updated_tenant, allocation_log, platform_log = BudgetService.allocateTenant(
            db=db,
            tenant=tenant,
            admin_user=current_user,
            amount=request.amount,
            currency=request.currency,
            reference_note=request.reference_note,
            invoice_number=request.invoice_number
        )
        
        db.commit()
        
        return AllocationResponse(
            tenant_id=updated_tenant.id,
            tenant_name=updated_tenant.name,
            previous_balance=allocation_log.previous_balance,
            new_balance=allocation_log.new_balance,
            amount_allocated=allocation_log.amount,
            currency=allocation_log.currency,
            created_at=allocation_log.created_at
        )
    
    except BudgetAllocationError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Allocation failed: {str(e)}")


@router.post("/clawback", response_model=AllocationResponse)
async def clawback_budget_from_tenant(
    request: ClawbackBudgetRequest,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """
    Platform Admin claws back budget from a tenant.
    Used when tenant cancels subscription or violates terms.
    
    If amount is not specified, claws back the entire balance.
    This acts as a "safety valve" to prevent stranded budget.
    """
    try:
        # Get tenant
        tenant = db.query(Tenant).filter(Tenant.id == request.tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        
        # Perform clawback
        allocation_log = BudgetService.clawbackBudget(
            db=db,
            tenant=tenant,
            admin_user=current_user,
            amount=request.amount,
            reason=request.reason
        )
        
        db.commit()
        
        return AllocationResponse(
            tenant_id=tenant.id,
            tenant_name=tenant.name,
            previous_balance=allocation_log.previous_balance,
            new_balance=allocation_log.new_balance,
            amount_allocated=-allocation_log.amount,  # Negative for clawback
            currency=allocation_log.currency,
            created_at=allocation_log.created_at
        )
    
    except BudgetAllocationError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Clawback failed: {str(e)}")


@router.get("/history/{tenant_id}", response_model=List[BudgetAllocationLogResponse])
async def get_budget_allocation_history(
    tenant_id: UUID,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """
    Get budget allocation history for a specific tenant.
    Shows all credit injections and clawbacks.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    logs = db.query(BudgetAllocationLog).filter(
        BudgetAllocationLog.tenant_id == tenant_id
    ).order_by(BudgetAllocationLog.created_at.desc()).offset(skip).limit(limit).all()
    
    return logs


@router.get("/stats/{tenant_id}", response_model=TenantBudgetStats)
async def get_tenant_budget_stats(
    tenant_id: UUID,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """
    Get budget statistics for a tenant.
    Shows current balance, daily allocation, and distribution history.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Get stats
    stats = BudgetService.get_tenant_budget_stats(db, tenant)
    
    # Get distribution count
    distribution_count = db.query(BudgetDistributionLog).filter(
        BudgetDistributionLog.tenant_id == tenant_id
    ).count()
    
    # Get last allocation
    last_allocation = db.query(BudgetAllocationLog).filter(
        BudgetAllocationLog.tenant_id == tenant_id,
        BudgetAllocationLog.transaction_type == 'CREDIT_INJECTION'
    ).order_by(BudgetAllocationLog.created_at.desc()).first()
    
    return TenantBudgetStats(
        tenant_id=tenant.id,
        tenant_name=tenant.name,
        current_balance=Decimal(str(stats["current_balance"])),
        allocated_today=Decimal(str(stats["allocated_today"])),
        total_distributed=Decimal(str(stats["total_distributed"])),
        distribution_count=distribution_count,
        last_allocation_at=last_allocation.created_at if last_allocation else None
    )


@router.get("/all", response_model=List[TenantBudgetStats])
async def get_all_tenant_budgets(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """
    Get budget statistics for all active tenants.
    Useful for platform admin dashboard.
    """
    tenants = db.query(Tenant).filter(
        Tenant.status == 'active',
        Tenant.subscription_status == 'active'
    ).offset(skip).limit(limit).all()
    
    results = []
    for tenant in tenants:
        stats = BudgetService.get_tenant_budget_stats(db, tenant)
        
        distribution_count = db.query(BudgetDistributionLog).filter(
            BudgetDistributionLog.tenant_id == tenant.id
        ).count()
        
        last_allocation = db.query(BudgetAllocationLog).filter(
            BudgetAllocationLog.tenant_id == tenant.id,
            BudgetAllocationLog.transaction_type == 'CREDIT_INJECTION'
        ).order_by(BudgetAllocationLog.created_at.desc()).first()
        
        results.append(TenantBudgetStats(
            tenant_id=tenant.id,
            tenant_name=tenant.name,
            current_balance=Decimal(str(stats["current_balance"])),
            allocated_today=Decimal(str(stats["allocated_today"])),
            total_distributed=Decimal(str(stats["total_distributed"])),
            distribution_count=distribution_count,
            last_allocation_at=last_allocation.created_at if last_allocation else None
        ))
    
    return results
