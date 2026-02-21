"""
Budget Allocation Workflow API Routes

Three-level budget allocation:
1. Platform Admin: allocates to Tenant (shows as Total Allocated Budget)
2. Tenant Manager: distributes to Departments (from total allocated)
3. Department Lead: distributes to Employees (as points)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from decimal import Decimal

from database import get_db
from core import append_impersonation_metadata
from models import (
    Tenant, Department, User, AuditLog, 
    TenantBudgetAllocation, DepartmentBudgetAllocation, 
    EmployeePointsAllocation, BudgetAllocationLedger,
    ActorType, Wallet, WalletLedger
)
from auth.utils import get_current_user
from sqlalchemy import func

from budgets.schemas import (
    TenantBudgetAllocationCreate, TenantBudgetAllocationResponse, TenantBudgetAllocationUpdate,
    DepartmentBudgetAllocationCreate, DepartmentBudgetAllocationResponse, DepartmentBudgetAllocationUpdate,
    EmployeePointsAllocationCreate, EmployeePointsAllocationResponse, EmployeePointsAllocationUpdate,
    BatchDepartmentAllocationRequest, BatchEmployeePointsAllocationRequest,
    BudgetAllocationSummary, DepartmentAllocationSummary
)

router = APIRouter(prefix="/budget-workflow", tags=["budget-workflow"])


def is_platform_admin(current_user: User) -> bool:
    """Check if user is platform admin"""
    return current_user.org_role == "platform_admin"


def is_tenant_manager(current_user: User) -> bool:
    """Check if user is tenant manager or hr admin"""
    return current_user.org_role in ["tenant_manager", "hr_admin"]


def is_dept_lead(current_user: User) -> bool:
    """Check if user is department lead, tenant lead, or manager"""
    return current_user.org_role in ["dept_lead", "tenant_lead", "manager"]


# =====================================================
# LEVEL 1: Platform Admin allocates to Tenant
# =====================================================

@router.post("/tenant-allocation", response_model=TenantBudgetAllocationResponse)
async def allocate_budget_to_tenant(
    tenant_id: UUID,
    allocation_data: TenantBudgetAllocationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Platform Admin allocates budget to a tenant.
    This becomes the 'Total Allocated Budget' for the tenant manager to distribute.
    
    Only platform admins can allocate to tenants.
    """
    # Authorization
    if not is_platform_admin(current_user):
        raise HTTPException(status_code=403, detail="Only platform admins can allocate to tenants")
    
    # Verify tenant exists
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Check if allocation already exists
    existing = db.query(TenantBudgetAllocation).filter(
        TenantBudgetAllocation.tenant_id == tenant_id
    ).first()
    
    if existing:
        # Update existing allocation
        old_balance = existing.total_allocated_budget
        existing.total_allocated_budget = allocation_data.total_allocated_budget
        existing.remaining_balance = allocation_data.total_allocated_budget
        allocation = existing
        
        # Ledger entry
        ledger = BudgetAllocationLedger(
            tenant_id=tenant_id,
            transaction_type="tenant_allocation",
            source_entity_type="tenant",
            source_entity_id=tenant_id,
            amount=allocation_data.total_allocated_budget - old_balance,
            balance_before=old_balance,
            balance_after=allocation_data.total_allocated_budget,
            description=f"Budget allocation updated: {allocation_data.description or ''}",
            actor_id=current_user.id
        )
    else:
        # Create new allocation
        allocation = TenantBudgetAllocation(
            tenant_id=tenant_id,
            total_allocated_budget=allocation_data.total_allocated_budget,
            remaining_balance=allocation_data.total_allocated_budget,
            status='active',
            allocated_by=current_user.id
        )
        db.add(allocation)
        db.flush()
        
        # Ledger entry
        ledger = BudgetAllocationLedger(
            tenant_id=tenant_id,
            transaction_type="tenant_allocation",
            source_entity_type="tenant",
            source_entity_id=tenant_id,
            amount=allocation_data.total_allocated_budget,
            balance_before=Decimal('0'),
            balance_after=allocation_data.total_allocated_budget,
            description=f"Initial budget allocation: {allocation_data.description or ''}",
            actor_id=current_user.id
        )
    
    # Update tenant model
    tenant.master_budget_balance = allocation_data.total_allocated_budget
    tenant.budget_allocated = allocation_data.total_allocated_budget
    tenant.budget_allocation_balance = allocation_data.total_allocated_budget
    
    db.add(ledger)
    
    # Audit log
    audit = AuditLog(
        tenant_id=tenant_id,
        actor_id=current_user.id,
        action="tenant_budget_allocated",
        entity_type="tenant_budget_allocation",
        entity_id=allocation.id,
        new_values=append_impersonation_metadata({
            "total_allocated_budget": str(allocation_data.total_allocated_budget),
            "description": allocation_data.description
        })
    )
    db.add(audit)
    
    db.commit()
    db.refresh(allocation)
    
    return {
        "id": allocation.id,
        "tenant_id": allocation.tenant_id,
        "total_allocated_budget": allocation.total_allocated_budget,
        "remaining_balance": allocation.remaining_balance,
        "status": allocation.status,
        "allocation_date": allocation.allocation_date,
        "allocated_by": allocation.allocated_by,
        "created_at": allocation.created_at,
        "updated_at": allocation.updated_at
    }


@router.get("/tenant-allocation/{tenant_id}", response_model=TenantBudgetAllocationResponse)
async def get_tenant_budget_allocation(
    tenant_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get tenant budget allocation (Total Allocated Budget)"""
    # Authorization: can view own tenant or platform admin
    if current_user.tenant_id != tenant_id and not is_platform_admin(current_user):
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    allocation = db.query(TenantBudgetAllocation).filter(
        TenantBudgetAllocation.tenant_id == tenant_id
    ).first()
    
    if not allocation:
        raise HTTPException(status_code=404, detail="No budget allocation found for this tenant")
    
    return {
        "id": allocation.id,
        "tenant_id": allocation.tenant_id,
        "total_allocated_budget": allocation.total_allocated_budget,
        "remaining_balance": allocation.remaining_balance,
        "status": allocation.status,
        "allocation_date": allocation.allocation_date,
        "allocated_by": allocation.allocated_by,
        "created_at": allocation.created_at,
        "updated_at": allocation.updated_at
    }


@router.get("/tenant-allocations", response_model=List[TenantBudgetAllocationResponse])
async def get_all_tenant_allocations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all tenant budget allocations (Platform Admin only)"""
    # Authorization: platform admin only
    if not is_platform_admin(current_user):
        raise HTTPException(status_code=403, detail="Only platform admins can view all tenant allocations")
    
    allocations = db.query(TenantBudgetAllocation).order_by(
        TenantBudgetAllocation.created_at.desc()
    ).all()
    
    result = []
    for allocation in allocations:
        result.append({
            "id": allocation.id,
            "tenant_id": allocation.tenant_id,
            "total_allocated_budget": allocation.total_allocated_budget,
            "remaining_balance": allocation.remaining_balance,
            "status": allocation.status,
            "allocation_date": allocation.allocation_date,
            "allocated_by": allocation.allocated_by,
            "created_at": allocation.created_at,
            "updated_at": allocation.updated_at
        })
    
    return result


# =====================================================
# LEVEL 2: Tenant Manager distributes to Departments
# =====================================================

@router.post("/department-allocation", response_model=DepartmentBudgetAllocationResponse)
async def allocate_budget_to_department(
    allocation_data: DepartmentBudgetAllocationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Tenant Manager distributes budget from tenant allocation to a department.
    Sum of all department allocations should not exceed total allocated budget.
    """
    # Authorization: only tenant managers
    if not is_tenant_manager(current_user):
        raise HTTPException(status_code=403, detail="Only tenant managers can allocate to departments")
    
    # Verify tenant budget allocation exists
    tenant_allocation = db.query(TenantBudgetAllocation).filter(
        TenantBudgetAllocation.id == allocation_data.tenant_budget_allocation_id
    ).first()
    
    if not tenant_allocation:
        raise HTTPException(status_code=404, detail="Tenant budget allocation not found")
    
    # Verify department exists and belongs to the same tenant
    department = db.query(Department).filter(
        Department.id == allocation_data.department_id,
        Department.tenant_id == current_user.tenant_id
    ).first()
    
    if not department:
        raise HTTPException(status_code=404, detail="Department not found in your organization")
    
    # Check if allocation already exists for this department
    existing = db.query(DepartmentBudgetAllocation).filter(
        DepartmentBudgetAllocation.tenant_budget_allocation_id == allocation_data.tenant_budget_allocation_id,
        DepartmentBudgetAllocation.department_id == allocation_data.department_id
    ).first()
    
    amount_to_subtract = Decimal('0')
    if existing:
        # Update existing allocation
        old_allocated = existing.allocated_budget
        difference = allocation_data.allocated_budget - old_allocated
        amount_to_subtract = difference
        
        # Check remaining budget
        if difference > tenant_allocation.remaining_balance:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient budget. Remaining: {float(tenant_allocation.remaining_balance)}"
            )
        
        existing.allocated_budget = allocation_data.allocated_budget
        existing.remaining_budget = allocation_data.allocated_budget - existing.distributed_budget
        allocation = existing
        
        # Update tenant remaining balance
        tenant_allocation.remaining_balance -= difference
        
        # Ledger
        ledger = BudgetAllocationLedger(
            tenant_id=current_user.tenant_id,
            transaction_type="dept_allocation",
            source_entity_type="tenant",
            source_entity_id=tenant_allocation.tenant_id,
            target_entity_type="department",
            target_entity_id=allocation_data.department_id,
            amount=difference,
            balance_before=old_allocated,
            balance_after=allocation_data.allocated_budget,
            description=f"Department budget update: {allocation_data.description or ''}",
            actor_id=current_user.id
        )
    else:
        # Create new allocation
        # Check remaining budget
        if allocation_data.allocated_budget > tenant_allocation.remaining_balance:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient budget. Available: {float(tenant_allocation.remaining_balance)}"
            )
        
        amount_to_subtract = allocation_data.allocated_budget
        allocation = DepartmentBudgetAllocation(
            tenant_id=current_user.tenant_id,
            department_id=allocation_data.department_id,
            tenant_budget_allocation_id=allocation_data.tenant_budget_allocation_id,
            allocated_budget=allocation_data.allocated_budget,
            distributed_budget=Decimal('0'),
            remaining_budget=allocation_data.allocated_budget,
            status='active',
            allocated_by=current_user.id
        )
        db.add(allocation)
        db.flush()
        
        # Update tenant remaining balance
        tenant_allocation.remaining_balance -= allocation_data.allocated_budget
        
        # Ledger
        ledger = BudgetAllocationLedger(
            tenant_id=current_user.tenant_id,
            transaction_type="dept_allocation",
            source_entity_type="tenant",
            source_entity_id=tenant_allocation.tenant_id,
            target_entity_type="department",
            target_entity_id=allocation_data.department_id,
            amount=allocation_data.allocated_budget,
            balance_before=Decimal('0'),
            balance_after=allocation_data.allocated_budget,
            description=f"Department budget allocation: {allocation_data.description or ''}",
            actor_id=current_user.id
        )
    
    # Update department model
    department.budget_allocated = allocation_data.allocated_budget
    department.budget_balance = allocation_data.allocated_budget
    
    # Update tenant master pool balance
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if tenant:
        # Subtract the amount from master pool
        tenant.master_budget_balance = Decimal(str(tenant.master_budget_balance)) - amount_to_subtract
        tenant.budget_allocation_balance = Decimal(str(tenant.budget_allocation_balance)) - amount_to_subtract
    
    db.add(ledger)
    
    # Audit
    audit = AuditLog(
        tenant_id=current_user.tenant_id,
        actor_id=current_user.id,
        action="department_budget_allocated",
        entity_type="department_budget_allocation",
        entity_id=allocation.id,
        new_values=append_impersonation_metadata({
            "department_id": str(allocation_data.department_id),
            "allocated_budget": str(allocation_data.allocated_budget),
            "description": allocation_data.description
        })
    )
    db.add(audit)
    
    db.commit()
    db.refresh(allocation)
    
    return {
        "id": allocation.id,
        "tenant_id": allocation.tenant_id,
        "department_id": allocation.department_id,
        "tenant_budget_allocation_id": allocation.tenant_budget_allocation_id,
        "allocated_budget": allocation.allocated_budget,
        "distributed_budget": allocation.distributed_budget,
        "remaining_budget": allocation.remaining_budget,
        "status": allocation.status,
        "allocation_date": allocation.allocation_date,
        "allocated_by": allocation.allocated_by,
        "created_at": allocation.created_at,
        "updated_at": allocation.updated_at
    }


@router.get("/department-allocation/{department_allocation_id}", response_model=DepartmentBudgetAllocationResponse)
async def get_department_budget_allocation(
    department_allocation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a department budget allocation"""
    allocation = db.query(DepartmentBudgetAllocation).filter(
        DepartmentBudgetAllocation.id == department_allocation_id,
        DepartmentBudgetAllocation.tenant_id == current_user.tenant_id
    ).first()
    
    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found")
    
    return {
        "id": allocation.id,
        "tenant_id": allocation.tenant_id,
        "department_id": allocation.department_id,
        "tenant_budget_allocation_id": allocation.tenant_budget_allocation_id,
        "allocated_budget": allocation.allocated_budget,
        "distributed_budget": allocation.distributed_budget,
        "remaining_budget": allocation.remaining_budget,
        "status": allocation.status,
        "allocation_date": allocation.allocation_date,
        "allocated_by": allocation.allocated_by,
        "created_at": allocation.created_at,
        "updated_at": allocation.updated_at
    }


@router.get("/department-allocations", response_model=List[DepartmentBudgetAllocationResponse])
async def get_department_allocations(
    tenant_budget_allocation_id: UUID = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all department budget allocations for current tenant"""
    query = db.query(DepartmentBudgetAllocation).filter(
        DepartmentBudgetAllocation.tenant_id == current_user.tenant_id
    )
    
    if tenant_budget_allocation_id:
        query = query.filter(
            DepartmentBudgetAllocation.tenant_budget_allocation_id == tenant_budget_allocation_id
        )
    
    allocations = query.all()
    
    return [
        {
            "id": a.id,
            "tenant_id": a.tenant_id,
            "department_id": a.department_id,
            "tenant_budget_allocation_id": a.tenant_budget_allocation_id,
            "allocated_budget": a.allocated_budget,
            "distributed_budget": a.distributed_budget,
            "remaining_budget": a.remaining_budget,
            "status": a.status,
            "allocation_date": a.allocation_date,
            "allocated_by": a.allocated_by,
            "created_at": a.created_at,
            "updated_at": a.updated_at
        }
        for a in allocations
    ]


# =====================================================
# LEVEL 3: Department Lead distributes to Employees
# =====================================================

@router.post("/employee-allocation", response_model=EmployeePointsAllocationResponse)
async def allocate_points_to_employee(
    allocation_data: EmployeePointsAllocationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Department Lead distributes points to an employee.
    Can only allocate to employees in their own department.
    Sum of all employee allocations should not exceed department allocation.
    """
    # Authorization: only dept leads
    if not is_dept_lead(current_user):
        raise HTTPException(status_code=403, detail="Only department leads can allocate points to employees")
    
    # Verify department budget allocation exists and belongs to this dept lead
    dept_allocation = db.query(DepartmentBudgetAllocation).filter(
        DepartmentBudgetAllocation.id == allocation_data.department_budget_allocation_id
    ).first()
    
    if not dept_allocation:
        raise HTTPException(status_code=404, detail="Department budget allocation not found")
    
    # Verify department matches dept lead's department
    if dept_allocation.department_id != current_user.department_id:
        raise HTTPException(status_code=403, detail="Can only allocate to your own department")
    
    # Verify employee exists, is in same department
    employee = db.query(User).filter(
        User.id == allocation_data.employee_id,
        User.tenant_id == current_user.tenant_id,
        User.department_id == current_user.department_id
    ).first()
    
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found in your department")
    
    # Check if allocation already exists for this employee
    existing = db.query(EmployeePointsAllocation).filter(
        EmployeePointsAllocation.department_budget_allocation_id == allocation_data.department_budget_allocation_id,
        EmployeePointsAllocation.employee_id == allocation_data.employee_id
    ).first()
    
    if existing:
        # Update existing allocation
        old_allocated = existing.allocated_points
        difference = allocation_data.allocated_points - old_allocated
        
        # Calculate current total allocated to employees
        total_allocated = db.query(func.sum(EmployeePointsAllocation.allocated_points)).filter(
            EmployeePointsAllocation.department_budget_allocation_id == allocation_data.department_budget_allocation_id
        ).scalar() or Decimal('0')
        
        total_allocated -= old_allocated  # Remove old amount
        
        # Check if new allocation exceeds department budget
        if (total_allocated + allocation_data.allocated_points) > dept_allocation.allocated_budget:
            raise HTTPException(
                status_code=400,
                detail=f"Exceeds department budget. Available: {float(dept_allocation.allocated_budget - total_allocated)}"
            )
        
        existing.allocated_points = allocation_data.allocated_points
        allocation = existing
        
        # Update department remaining
        dept_allocation.distributed_budget = total_allocated + allocation_data.allocated_points
        dept_allocation.remaining_budget = dept_allocation.allocated_budget - dept_allocation.distributed_budget
        
        # Ledger
        ledger = BudgetAllocationLedger(
            tenant_id=current_user.tenant_id,
            transaction_type="employee_allocation",
            source_entity_type="department",
            source_entity_id=dept_allocation.department_id,
            target_entity_type="employee",
            target_entity_id=allocation_data.employee_id,
            amount=difference,
            balance_before=old_allocated,
            balance_after=allocation_data.allocated_points,
            description=f"Employee points update: {allocation_data.description or ''}",
            actor_id=current_user.id
        )
    else:
        # Create new allocation
        # Calculate current total allocated
        total_allocated = db.query(func.sum(EmployeePointsAllocation.allocated_points)).filter(
            EmployeePointsAllocation.department_budget_allocation_id == allocation_data.department_budget_allocation_id
        ).scalar() or Decimal('0')
        
        # Check if new allocation exceeds department budget
        if (total_allocated + allocation_data.allocated_points) > dept_allocation.allocated_budget:
            raise HTTPException(
                status_code=400,
                detail=f"Exceeds department budget. Available: {float(dept_allocation.allocated_budget - total_allocated)}"
            )
        
        allocation = EmployeePointsAllocation(
            tenant_id=current_user.tenant_id,
            department_budget_allocation_id=allocation_data.department_budget_allocation_id,
            employee_id=allocation_data.employee_id,
            allocated_points=allocation_data.allocated_points,
            spent_points=Decimal('0'),
            status='active',
            allocated_by=current_user.id
        )
        db.add(allocation)
        db.flush()
        
        # Update department distributed and remaining
        dept_allocation.distributed_budget = total_allocated + allocation_data.allocated_points
        dept_allocation.remaining_budget = dept_allocation.allocated_budget - dept_allocation.distributed_budget
        
        # Ledger
        ledger = BudgetAllocationLedger(
            tenant_id=current_user.tenant_id,
            transaction_type="employee_allocation",
            source_entity_type="department",
            source_entity_id=dept_allocation.department_id,
            target_entity_type="employee",
            target_entity_id=allocation_data.employee_id,
            amount=allocation_data.allocated_points,
            balance_before=Decimal('0'),
            balance_after=allocation_data.allocated_points,
            description=f"Employee points allocation: {allocation_data.description or ''}",
            actor_id=current_user.id
        )
    
    db.add(ledger)

    # Update employee wallet: the allocation gives spendable points to the employee
    wallet = db.query(Wallet).filter(Wallet.user_id == allocation_data.employee_id).first()
    if not wallet:
        wallet = Wallet(
            tenant_id=current_user.tenant_id,
            user_id=allocation_data.employee_id,
            balance=Decimal('0'),
            lifetime_earned=Decimal('0'),
            lifetime_spent=Decimal('0')
        )
        db.add(wallet)
        db.flush()
    
    # Calculate amount to add to wallet (difference if updating, full amount if new)
    amount_to_add = Decimal('0')
    if existing:
        # difference was calculated as allocation_data.allocated_points - old_allocated
        amount_to_add = allocation_data.allocated_points - old_allocated
    else:
        amount_to_add = allocation_data.allocated_points
    
    wallet.balance = Decimal(str(wallet.balance)) + amount_to_add
    wallet.lifetime_earned = Decimal(str(wallet.lifetime_earned)) + amount_to_add
    
    # Wallet Ledger entry
    wallet_ledger = WalletLedger(
        tenant_id=current_user.tenant_id,
        wallet_id=wallet.id,
        transaction_type='credit',
        source='budget_allocation',
        points=amount_to_add,
        balance_after=wallet.balance,
        description=f"Points allocated from department budget: {allocation_data.description or ''}",
        created_by=current_user.id
    )
    db.add(wallet_ledger)
    
    # Audit
    audit = AuditLog(
        tenant_id=current_user.tenant_id,
        actor_id=current_user.id,
        action="employee_points_allocated",
        entity_type="employee_points_allocation",
        entity_id=allocation.id,
        new_values=append_impersonation_metadata({
            "employee_id": str(allocation_data.employee_id),
            "allocated_points": str(allocation_data.allocated_points),
            "description": allocation_data.description
        })
    )
    db.add(audit)
    
    db.commit()
    db.refresh(allocation)
    
    return {
        "id": allocation.id,
        "tenant_id": allocation.tenant_id,
        "department_budget_allocation_id": allocation.department_budget_allocation_id,
        "employee_id": allocation.employee_id,
        "allocated_points": allocation.allocated_points,
        "spent_points": allocation.spent_points,
        "remaining_points": allocation.remaining_points,
        "status": allocation.status,
        "allocation_date": allocation.allocation_date,
        "allocated_by": allocation.allocated_by,
        "created_at": allocation.created_at,
        "updated_at": allocation.updated_at
    }


@router.get("/employee-allocation/{employee_allocation_id}", response_model=EmployeePointsAllocationResponse)
async def get_employee_points_allocation(
    employee_allocation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get an employee's points allocation"""
    allocation = db.query(EmployeePointsAllocation).filter(
        EmployeePointsAllocation.id == employee_allocation_id,
        EmployeePointsAllocation.tenant_id == current_user.tenant_id
    ).first()
    
    if not allocation:
        raise HTTPException(status_code=404, detail="Allocation not found")
    
    return {
        "id": allocation.id,
        "tenant_id": allocation.tenant_id,
        "department_budget_allocation_id": allocation.department_budget_allocation_id,
        "employee_id": allocation.employee_id,
        "allocated_points": allocation.allocated_points,
        "spent_points": allocation.spent_points,
        "remaining_points": allocation.remaining_points,
        "status": allocation.status,
        "allocation_date": allocation.allocation_date,
        "allocated_by": allocation.allocated_by,
        "created_at": allocation.created_at,
        "updated_at": allocation.updated_at
    }


@router.get("/employee-allocations", response_model=List[EmployeePointsAllocationResponse])
async def get_employee_allocations(
    department_budget_allocation_id: UUID = None,
    department_id: UUID = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get employee points allocations (filtered by department_allocation or department)"""
    query = db.query(EmployeePointsAllocation).filter(
        EmployeePointsAllocation.tenant_id == current_user.tenant_id
    )
    
    if department_budget_allocation_id:
        query = query.filter(
            EmployeePointsAllocation.department_budget_allocation_id == department_budget_allocation_id
        )
    
    if department_id:
        # Join through department budget allocation to filter by department
        query = query.join(
            DepartmentBudgetAllocation,
            EmployeePointsAllocation.department_budget_allocation_id == DepartmentBudgetAllocation.id
        ).filter(DepartmentBudgetAllocation.department_id == department_id)
    
    allocations = query.all()
    
    return [
        {
            "id": a.id,
            "tenant_id": a.tenant_id,
            "department_budget_allocation_id": a.department_budget_allocation_id,
            "employee_id": a.employee_id,
            "allocated_points": a.allocated_points,
            "spent_points": a.spent_points,
            "remaining_points": a.remaining_points,
            "status": a.status,
            "allocation_date": a.allocation_date,
            "allocated_by": a.allocated_by,
            "created_at": a.created_at,
            "updated_at": a.updated_at
        }
        for a in allocations
    ]


# =====================================================
# DASHBOARD & SUMMARY ENDPOINTS
# =====================================================

@router.get("/summary/tenant/{tenant_id}", response_model=BudgetAllocationSummary)
async def get_tenant_allocation_summary(
    tenant_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get budget allocation summary for a tenant"""
    # Authorization
    if current_user.tenant_id != tenant_id and not is_platform_admin(current_user):
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    tenant_alloc = db.query(TenantBudgetAllocation).filter(
        TenantBudgetAllocation.tenant_id == tenant_id
    ).first()
    
    if not tenant_alloc:
        raise HTTPException(status_code=404, detail="No budget allocation for this tenant")
    
    # Total distributed to departments
    dept_total = db.query(func.sum(DepartmentBudgetAllocation.allocated_budget)).filter(
        DepartmentBudgetAllocation.tenant_id == tenant_id
    ).scalar() or Decimal('0')
    
    # Total distributed to employees
    emp_total = db.query(func.sum(EmployeePointsAllocation.allocated_points)).filter(
        EmployeePointsAllocation.tenant_id == tenant_id
    ).scalar() or Decimal('0')
    
    total_allocated = Decimal(str(tenant_alloc.total_allocated_budget))
    
    # Department count
    dept_count = db.query(DepartmentBudgetAllocation).filter(
        DepartmentBudgetAllocation.tenant_id == tenant_id
    ).count()
    
    # Employee count
    emp_count = db.query(EmployeePointsAllocation).filter(
        EmployeePointsAllocation.tenant_id == tenant_id
    ).count()
    
    percentage = float((emp_total / total_allocated * 100) if total_allocated > 0 else 0)
    
    return {
        "tenant_id": tenant_id,
        "total_allocated": total_allocated,
        "total_distributed_to_departments": dept_total,
        "total_distributed_to_employees": emp_total,
        "remaining_available": tenant_alloc.remaining_balance,
        "percentage_distributed": percentage,
        "department_count": dept_count,
        "employee_count": emp_count
    }


@router.get("/summary/department/{department_allocation_id}", response_model=DepartmentAllocationSummary)
async def get_department_allocation_summary(
    department_allocation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get budget allocation summary for a department"""
    dept_alloc = db.query(DepartmentBudgetAllocation).filter(
        DepartmentBudgetAllocation.id == department_allocation_id,
        DepartmentBudgetAllocation.tenant_id == current_user.tenant_id
    ).first()
    
    if not dept_alloc:
        raise HTTPException(status_code=404, detail="Allocation not found")
    
    department = db.query(Department).filter(
        Department.id == dept_alloc.department_id
    ).first()
    
    # Employee allocations
    emp_count = db.query(EmployeePointsAllocation).filter(
        EmployeePointsAllocation.department_budget_allocation_id == department_allocation_id
    ).count()
    
    emp_total = db.query(func.sum(EmployeePointsAllocation.allocated_points)).filter(
        EmployeePointsAllocation.department_budget_allocation_id == department_allocation_id
    ).scalar() or Decimal('0')
    
    allocated = Decimal(str(dept_alloc.allocated_budget))
    percentage = float((emp_total / allocated * 100) if allocated > 0 else 0)
    
    return {
        "department_id": dept_alloc.department_id,
        "department_name": department.name if department else "Unknown",
        "allocated_budget": allocated,
        "distributed_to_employees": emp_total,
        "remaining_budget": dept_alloc.remaining_budget,
        "percentage_distributed": percentage,
        "employee_allocations_count": emp_count
    }
