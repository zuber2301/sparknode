"""
Platform Admin - Budget Ledger Routes

Routes for Platform Admins to view the complete budget ledger:
1. Get all tenants with budget data
2. Get platform-wide budget statistics
3. Get detailed budget breakdown by tier
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime, timedelta
from decimal import Decimal
from pydantic import BaseModel
from uuid import UUID

from database import get_db
from models import Tenant, User, Wallet, BudgetDistributionLog, BudgetAllocationLog, PlatformBudgetBillingLog, ActorType
from auth.utils import get_current_user
from core.rbac import get_platform_admin

router = APIRouter(prefix="/api/platform/ledger", tags=["platform-admin-ledger"])


# =====================================================
# SCHEMAS
# =====================================================

class TenantBudgetData(BaseModel):
    """Budget data for a single tenant"""
    tenant_id: UUID
    tenant_name: str
    status: str
    subscription_tier: str
    
    # Budget tiers
    budget_allocated: Decimal  # Total allocated by platform admin
    budget_allocation_balance: Decimal  # Remaining in pool (allocated - distributed)
    total_lead_budgets: Decimal  # Total budget delegated to leads
    total_wallet_balance: Decimal  # Total budget in employee wallets
    
    # Calculated metrics
    total_active: Decimal  # lead_budgets + wallet_balance
    utilization_percent: float  # (active / (allocated + active)) * 100
    

class PlatformBudgetStats(BaseModel):
    """Platform-wide budget statistics"""
    total_platform_budget: Decimal
    unallocated_budget: Decimal  # Reserve in platform
    allocated_budget: Decimal  # In tenant pools (ready to distribute)
    delegated_budget: Decimal  # With leads
    spendable_budget: Decimal  # In employee wallets
    
    # Percentages
    allocated_percent: float
    delegated_percent: float
    spendable_percent: float
    unallocated_percent: float
    
    # Deployment metrics
    total_deployed: Decimal  # allocated + delegated + spendable
    deployment_rate: float  # (deployed / total) * 100
    
    active_tenants: int
    total_allocations: int
    total_distributions: int


class BudgetActivityBreakdown(BaseModel):
    """Breakdown of budget activity by time period"""
    period: str  # "all", "30days", "90days"
    allocations_count: int
    allocations_total: Decimal
    distributions_count: int
    distributions_total: Decimal
    awards_count: int
    awards_total: Decimal
    clawbacks_count: int
    clawbacks_total: Decimal


class PlatformBudgetLedgerResponse(BaseModel):
    """Complete response for platform budget ledger"""
    summary: PlatformBudgetStats
    activity: BudgetActivityBreakdown
    tenants: List[TenantBudgetData]


# =====================================================
# ENDPOINTS
# =====================================================

@router.get("/tenants", response_model=List[TenantBudgetData])
async def get_tenants_with_budgets(
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """
    Get all tenants with their budget allocation data.
    
    Returns:
    - Tenant name, ID, status, subscription tier
    - Budget allocated, balance, and active deployments
    - Utilization metrics
    """
    
    try:
        # Get all active tenants
        tenants = db.query(Tenant).filter(
            Tenant.status.in_(['active', 'trial'])
        ).all()
        
        tenant_budgets = []
        
        for tenant in tenants:
            # Calculate total lead budgets (delegated)
            total_lead_wallets = db.query(func.sum(Wallet.balance)).filter(
                Wallet.tenant_id == tenant.id,
                Wallet.wallet_type == 'lead_distribution'  # Wallets for leads
            ).scalar() or Decimal('0')
            
            # Calculate total employee wallet balances (spendable)
            total_employee_wallets = db.query(func.sum(Wallet.balance)).filter(
                Wallet.tenant_id == tenant.id,
                Wallet.wallet_type == 'employee'  # Employee wallets
            ).scalar() or Decimal('0')
            
            total_active = total_lead_wallets + total_employee_wallets
            allocated = tenant.budget_allocated
            
            # Utilization: how much of allocated budget has been distributed
            if allocated > 0:
                utilization = float((total_active / (allocated + total_active)) * 100)
            else:
                utilization = 0.0
            
            tenant_budgets.append(TenantBudgetData(
                tenant_id=tenant.id,
                tenant_name=tenant.name,
                status=tenant.status,
                subscription_tier=tenant.subscription_tier,
                budget_allocated=allocated,
                budget_allocation_balance=tenant.budget_allocation_balance,
                total_lead_budgets=total_lead_wallets,
                total_wallet_balance=total_employee_wallets,
                total_active=total_active,
                utilization_percent=utilization
            ))
        
        return tenant_budgets
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch tenant budget data: {str(e)}"
        )


@router.get("/stats", response_model=PlatformBudgetStats)
async def get_budget_stats(
    time_range: Optional[str] = Query("all", regex="^(all|30days|90days)$"),
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """
    Get platform-wide budget statistics.
    
    Calculates:
    - Total platform budget
    - Budget in each tier (unallocated, allocated, delegated, spendable)
    - Deployment metrics and percentages
    
    Query Params:
    - time_range: "all" (default), "30days", "90days"
    """
    
    try:
        # Get all active tenants
        tenants = db.query(Tenant).filter(
            Tenant.status.in_(['active', 'trial'])
        ).all()
        
        # Calculate platform totals
        total_allocated = sum(Decimal(t.budget_allocated) for t in tenants) if tenants else Decimal('0')
        total_balance = sum(Decimal(t.budget_allocation_balance) for t in tenants) if tenants else Decimal('0')
        
        # Calculate total lead budgets (delegated) across all tenants
        total_delegated = db.query(func.sum(Wallet.balance)).filter(
            Wallet.wallet_type == 'lead_distribution'
        ).scalar() or Decimal('0')
        
        # Calculate total employee wallet balance (spendable) across all tenants
        total_spendable = db.query(func.sum(Wallet.balance)).filter(
            Wallet.wallet_type == 'employee'
        ).scalar() or Decimal('0')
        
        # Unallocated is conceptual - total allocated - deployed
        total_deployed = total_delegated + total_spendable
        total_in_use = total_balance + total_delegated + total_spendable
        
        # Total platform budget = what we've allocated + what's still in reserve
        total_platform_budget = total_allocated + (total_allocated - (total_balance + total_deployed))
        
        # If we're underestimating, use what's actually deployed
        if total_platform_budget <= Decimal('0'):
            total_platform_budget = total_allocated + total_delegated + total_spendable
        
        unallocated = max(Decimal('0'), total_platform_budget - total_deployed)
        
        # Calculate percentages
        if total_platform_budget > 0:
            allocated_pct = float((total_allocated / total_platform_budget) * 100)
            delegated_pct = float((total_delegated / total_platform_budget) * 100)
            spendable_pct = float((total_spendable / total_platform_budget) * 100)
            unallocated_pct = float((unallocated / total_platform_budget) * 100)
            deployment_rate = float((total_deployed / total_platform_budget) * 100)
        else:
            allocated_pct = delegated_pct = spendable_pct = unallocated_pct = deployment_rate = 0.0
        
        # Count transactions
        allocation_count = db.query(func.count(BudgetAllocationLog.id)).scalar() or 0
        distribution_count = db.query(func.count(BudgetDistributionLog.id)).scalar() or 0
        
        return PlatformBudgetStats(
            total_platform_budget=total_platform_budget,
            unallocated_budget=unallocated,
            allocated_budget=total_allocated,
            delegated_budget=total_delegated,
            spendable_budget=total_spendable,
            allocated_percent=allocated_pct,
            delegated_percent=delegated_pct,
            spendable_percent=spendable_pct,
            unallocated_percent=unallocated_pct,
            total_deployed=total_deployed,
            deployment_rate=deployment_rate,
            active_tenants=len(tenants),
            total_allocations=allocation_count,
            total_distributions=distribution_count
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch budget statistics: {str(e)}"
        )


@router.get("/activity", response_model=BudgetActivityBreakdown)
async def get_budget_activity(
    time_range: Optional[str] = Query("all", regex="^(all|30days|90days)$"),
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """
    Get budget activity breakdown for specified time range.
    
    Query Params:
    - time_range: "all" (default), "30days", "90days"
    """
    
    try:
        # Determine date filter
        date_filter = None
        if time_range == "30days":
            date_filter = datetime.utcnow() - timedelta(days=30)
        elif time_range == "90days":
            date_filter = datetime.utcnow() - timedelta(days=90)
        
        # Build base query filter
        base_filter = []
        if date_filter:
            base_filter = [BudgetAllocationLog.created_at >= date_filter]
        
        # Count allocations
        allocations = db.query(BudgetAllocationLog).filter(*base_filter).all()
        allocations_count = len(allocations)
        allocations_total = sum(
            Decimal(a.amount) for a in allocations if a.amount
        ) if allocations else Decimal('0')
        
        # Count distributions
        distributions = db.query(BudgetDistributionLog).filter(*base_filter).all()
        distributions_count = len(distributions)
        distributions_total = sum(
            Decimal(d.amount) for d in distributions if d.amount
        ) if distributions else Decimal('0')
        
        # Awards are part of distributions but we can count separately
        awards_count = len([d for d in distributions if d.distribution_type == 'award'])
        awards_total = sum(
            Decimal(d.amount) for d in distributions 
            if d.distribution_type == 'award' and d.amount
        ) if distributions else Decimal('0')
        
        # Count clawbacks (in PlatformBudgetBillingLog)
        clawbacks = db.query(PlatformBudgetBillingLog).filter(
            PlatformBudgetBillingLog.transaction_type == 'clawback',
            *base_filter
        ).all()
        clawbacks_count = len(clawbacks)
        clawbacks_total = sum(
            Decimal(c.amount) for c in clawbacks if c.amount
        ) if clawbacks else Decimal('0')
        
        return BudgetActivityBreakdown(
            period=time_range,
            allocations_count=allocations_count,
            allocations_total=allocations_total,
            distributions_count=distributions_count,
            distributions_total=distributions_total,
            awards_count=awards_count,
            awards_total=awards_total,
            clawbacks_count=clawbacks_count,
            clawbacks_total=clawbacks_total
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch budget activity: {str(e)}"
        )


@router.get("/full-ledger", response_model=PlatformBudgetLedgerResponse)
async def get_full_budget_ledger(
    time_range: Optional[str] = Query("all", regex="^(all|30days|90days)$"),
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """
    Get complete platform budget ledger with summary, activity, and tenant breakdown.
    
    This is the comprehensive view combining stats, activity, and all tenant data.
    
    Query Params:
    - time_range: "all" (default), "30days", "90days"
    """
    
    try:
        # Get all components
        stats_response = await get_budget_stats(time_range, current_user, db)
        activity_response = await get_budget_activity(time_range, current_user, db)
        tenants_response = await get_tenants_with_budgets(current_user, db)
        
        return PlatformBudgetLedgerResponse(
            summary=stats_response,
            activity=activity_response,
            tenants=tenants_response
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch complete budget ledger: {str(e)}"
        )
