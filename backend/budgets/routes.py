from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from decimal import Decimal

from database import get_db
from core import append_impersonation_metadata, get_tenant_manager
from models import Budget, DepartmentBudget, User, AuditLog, ActorType, Department
from auth.utils import get_current_user, get_hr_admin
from sqlalchemy import func
from budgets.schemas import (
    BudgetCreate, BudgetUpdate, BudgetResponse,
    DepartmentBudgetCreate, DepartmentBudgetUpdate, DepartmentBudgetResponse,
    BudgetAllocationRequest
)

router = APIRouter()


@router.get("/", response_model=List[BudgetResponse])
async def get_budgets(
    fiscal_year: int = None,
    status: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all budgets for current tenant"""
    query = db.query(Budget).filter(Budget.tenant_id == current_user.tenant_id)
    
    if fiscal_year:
        query = query.filter(Budget.fiscal_year == fiscal_year)
    if status:
        query = query.filter(Budget.status == status)
    
    budgets = query.order_by(Budget.fiscal_year.desc(), Budget.created_at.desc()).all()
    
    # Calculate remaining points manually since it's a computed property
    result = []
    for budget in budgets:
        budget_dict = {
            "id": budget.id,
            "tenant_id": budget.tenant_id,
            "name": budget.name,
            "fiscal_year": budget.fiscal_year,
            "fiscal_quarter": budget.fiscal_quarter,
            "total_points": budget.total_points,
            "allocated_points": budget.allocated_points,
            "remaining_points": Decimal(str(budget.total_points)) - Decimal(str(budget.allocated_points)),
            "status": budget.status,
            "expiry_date": budget.expiry_date,
            "created_by": budget.created_by,
            "created_at": budget.created_at
        }
        result.append(budget_dict)
    
    return result


@router.post("/", response_model=BudgetResponse)
async def create_budget(
    budget_data: BudgetCreate,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    """Create a new budget (HR Admin only)"""
    budget = Budget(
        tenant_id=current_user.tenant_id,
        name=budget_data.name,
        fiscal_year=budget_data.fiscal_year,
        fiscal_quarter=budget_data.fiscal_quarter,
        total_points=budget_data.total_points,
        allocated_points=0,
        status='draft',
        expiry_date=budget_data.expiry_date,
        created_by=current_user.id
    )
    db.add(budget)
    
    # Audit log
    audit = AuditLog(
        tenant_id=current_user.tenant_id,
        actor_id=current_user.id,
        action="budget_created",
        entity_type="budget",
        entity_id=budget.id,
        new_values=append_impersonation_metadata({"name": budget.name, "total_points": str(budget.total_points)})
    )
    db.add(audit)
    
    db.commit()
    db.refresh(budget)
    
    return {
        "id": budget.id,
        "tenant_id": budget.tenant_id,
        "name": budget.name,
        "fiscal_year": budget.fiscal_year,
        "fiscal_quarter": budget.fiscal_quarter,
        "total_points": budget.total_points,
        "allocated_points": budget.allocated_points,
        "remaining_points": Decimal(str(budget.total_points)) - Decimal(str(budget.allocated_points)),
        "status": budget.status,
        "created_by": budget.created_by,
        "created_at": budget.created_at
    }


@router.get("/{budget_id}", response_model=BudgetResponse)
async def get_budget(
    budget_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific budget"""
    budget = db.query(Budget).filter(
        Budget.id == budget_id,
        Budget.tenant_id == current_user.tenant_id
    ).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    return {
        "id": budget.id,
        "tenant_id": budget.tenant_id,
        "name": budget.name,
        "fiscal_year": budget.fiscal_year,
        "fiscal_quarter": budget.fiscal_quarter,
        "total_points": budget.total_points,
        "allocated_points": budget.allocated_points,
        "remaining_points": Decimal(str(budget.total_points)) - Decimal(str(budget.allocated_points)),
        "status": budget.status,
        "created_by": budget.created_by,
        "created_at": budget.created_at
    }


@router.put("/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: UUID,
    budget_data: BudgetUpdate,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    """Update a budget (HR Admin only)"""
    budget = db.query(Budget).filter(
        Budget.id == budget_id,
        Budget.tenant_id == current_user.tenant_id
    ).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    old_values = {"name": budget.name, "total_points": str(budget.total_points), "status": budget.status}
    
    update_data = budget_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(budget, key, value)
    
    # Audit log
    audit = AuditLog(
        tenant_id=current_user.tenant_id,
        actor_id=current_user.id,
        action="budget_updated",
        entity_type="budget",
        entity_id=budget.id,
        old_values=old_values,
        new_values=append_impersonation_metadata(update_data)
    )
    db.add(audit)
    
    db.commit()
    db.refresh(budget)
    
    return {
        "id": budget.id,
        "tenant_id": budget.tenant_id,
        "name": budget.name,
        "fiscal_year": budget.fiscal_year,
        "fiscal_quarter": budget.fiscal_quarter,
        "total_points": budget.total_points,
        "allocated_points": budget.allocated_points,
        "remaining_points": Decimal(str(budget.total_points)) - Decimal(str(budget.allocated_points)),
        "status": budget.status,
        "created_by": budget.created_by,
        "created_at": budget.created_at
    }


@router.post("/{budget_id}/allocate")
async def allocate_budget_to_departments(
    budget_id: UUID,
    allocation_data: BudgetAllocationRequest,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    """Allocate budget to departments (HR Admin only)"""
    budget = db.query(Budget).filter(
        Budget.id == budget_id,
        Budget.tenant_id == current_user.tenant_id
    ).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    # Calculate total allocation
    total_allocation = sum(a.allocated_points for a in allocation_data.allocations)
    
    # Check if allocation exceeds budget
    current_allocated = db.query(DepartmentBudget).filter(
        DepartmentBudget.budget_id == budget_id
    ).with_entities(
        db.func.coalesce(db.func.sum(DepartmentBudget.allocated_points), 0)
    ).scalar()
    
    available = Decimal(str(budget.total_points)) - Decimal(str(current_allocated))
    
    if total_allocation > available:
        raise HTTPException(
            status_code=400,
            detail=f"Allocation ({total_allocation}) exceeds available budget ({available})"
        )
    
    # Create department budgets
    created = []
    for allocation in allocation_data.allocations:
        # Check if department budget already exists
        dept = db.query(Department).filter(Department.id == allocation.department_id).first()
        if not dept:
            continue

        existing = db.query(DepartmentBudget).filter(
            DepartmentBudget.budget_id == budget_id,
            DepartmentBudget.department_id == allocation.department_id
        ).first()
        
        if existing:
            existing.allocated_points = Decimal(str(existing.allocated_points)) + allocation.allocated_points
            if allocation.monthly_cap:
                existing.monthly_cap = allocation.monthly_cap
            created.append(existing)
        else:
            dept_budget = DepartmentBudget(
                tenant_id=current_user.tenant_id,
                budget_id=budget_id,
                department_id=allocation.department_id,
                allocated_points=allocation.allocated_points,
                spent_points=0,
                monthly_cap=allocation.monthly_cap
            )
            db.add(dept_budget)
            created.append(dept_budget)
        
        # Update Department master fields
        dept.budget_allocated = Decimal(str(dept.budget_allocated)) + allocation.allocated_points
        dept.budget_balance = Decimal(str(dept.budget_balance)) + allocation.allocated_points
    
    # Update budget allocated points
    budget.allocated_points = Decimal(str(budget.allocated_points)) + total_allocation
    
    # Audit log
    audit = AuditLog(
        tenant_id=current_user.tenant_id,
        actor_id=current_user.id,
        action="budget_allocated",
        entity_type="budget",
        entity_id=budget_id,
        new_values=append_impersonation_metadata({"allocations": [{"department_id": str(a.department_id), "points": str(a.allocated_points)} for a in allocation_data.allocations]})
    )
    db.add(audit)
    
    db.commit()
    
    return {"message": "Budget allocated successfully", "total_allocated": str(total_allocation)}


@router.get("/{budget_id}/departments", response_model=List[DepartmentBudgetResponse])
async def get_department_budgets(
    budget_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all department budgets for a budget"""
    dept_budgets = db.query(DepartmentBudget).filter(
        DepartmentBudget.budget_id == budget_id,
        DepartmentBudget.tenant_id == current_user.tenant_id
    ).all()
    
    result = []
    for db_item in dept_budgets:
        result.append({
            "id": db_item.id,
            "tenant_id": db_item.tenant_id,
            "budget_id": db_item.budget_id,
            "department_id": db_item.department_id,
            "allocated_points": db_item.allocated_points,
            "spent_points": db_item.spent_points,
            "remaining_points": Decimal(str(db_item.allocated_points)) - Decimal(str(db_item.spent_points)),
            "monthly_cap": db_item.monthly_cap,
            "created_at": db_item.created_at
        })
    
    return result


@router.put("/{budget_id}/activate")
async def activate_budget(
    budget_id: UUID,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    """Activate a budget (HR Admin only)"""
    budget = db.query(Budget).filter(
        Budget.id == budget_id,
        Budget.tenant_id == current_user.tenant_id
    ).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    
    if budget.status != 'draft':
        raise HTTPException(status_code=400, detail="Only draft budgets can be activated")
    
    budget.status = 'active'
    
    # Audit log
    audit = AuditLog(
        tenant_id=current_user.tenant_id,
        actor_id=current_user.id,
        action="budget_activated",
        entity_type="budget",
        entity_id=budget_id,
        new_values=append_impersonation_metadata({})
    )
    db.add(audit)
    
    db.commit()
    
    return {"message": "Budget activated successfully"}


