from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal


class BudgetBase(BaseModel):
    name: str
    fiscal_year: int
    fiscal_quarter: Optional[int] = None
    total_points: Decimal
    expiry_date: Optional[datetime] = None


class BudgetCreate(BudgetBase):
    pass


class BudgetUpdate(BaseModel):
    name: Optional[str] = None
    total_points: Optional[Decimal] = None
    status: Optional[str] = None
    expiry_date: Optional[datetime] = None


class BudgetResponse(BudgetBase):
    id: UUID
    tenant_id: UUID
    allocated_points: Decimal
    remaining_points: Decimal
    status: str
    created_by: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DepartmentBudgetBase(BaseModel):
    department_id: UUID
    allocated_points: Decimal
    monthly_cap: Optional[Decimal] = None
    expiry_date: Optional[datetime] = None


class DepartmentBudgetCreate(DepartmentBudgetBase):
    pass


class DepartmentBudgetUpdate(BaseModel):
    allocated_points: Optional[Decimal] = None
    monthly_cap: Optional[Decimal] = None
    expiry_date: Optional[datetime] = None


class DepartmentBudgetResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    budget_id: UUID
    department_id: UUID
    allocated_points: Decimal
    spent_points: Decimal
    remaining_points: Decimal
    monthly_cap: Optional[Decimal] = None
    expiry_date: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LeadBudgetBase(BaseModel):
    department_budget_id: UUID
    user_id: UUID
    total_points: Decimal
    expiry_date: Optional[datetime] = None


class LeadBudgetCreate(LeadBudgetBase):
    pass


class LeadBudgetResponse(LeadBudgetBase):
    id: UUID
    tenant_id: UUID
    user_name: Optional[str] = None
    spent_points: Decimal
    remaining_points: Decimal
    usage_percentage: float
    remaining_percentage: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class BudgetAllocationRequest(BaseModel):
    allocations: List[DepartmentBudgetCreate]


class LeadBudgetAllocateRequest(BaseModel):
    user_id: UUID
    total_points: Decimal
    description: Optional[str] = None


# =====================================================
# THREE-LEVEL BUDGET WORKFLOW SCHEMAS
# =====================================================

# LEVEL 1: Platform Admin allocates to Tenant
class TenantBudgetAllocationBase(BaseModel):
    total_allocated_budget: Decimal
    description: Optional[str] = None


class TenantBudgetAllocationCreate(TenantBudgetAllocationBase):
    pass


class TenantBudgetAllocationUpdate(BaseModel):
    total_allocated_budget: Optional[Decimal] = None
    status: Optional[str] = None


class TenantBudgetAllocationResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    total_allocated_budget: Decimal
    remaining_balance: Decimal
    status: str
    allocation_date: datetime
    allocated_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# LEVEL 2: Tenant Manager distributes to Departments
class DepartmentBudgetAllocationBase(BaseModel):
    department_id: UUID
    allocated_budget: Decimal
    description: Optional[str] = None


class DepartmentBudgetAllocationCreate(DepartmentBudgetAllocationBase):
    pass


class DepartmentBudgetAllocationUpdate(BaseModel):
    allocated_budget: Optional[Decimal] = None
    status: Optional[str] = None


class DepartmentBudgetAllocationResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    department_id: UUID
    tenant_budget_allocation_id: UUID
    allocated_budget: Decimal
    distributed_budget: Decimal
    remaining_budget: Decimal
    status: str
    allocation_date: datetime
    allocated_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# LEVEL 3: Department Lead distributes to Employees
class EmployeePointsAllocationBase(BaseModel):
    employee_id: UUID
    allocated_points: Decimal
    description: Optional[str] = None


class EmployeePointsAllocationCreate(EmployeePointsAllocationBase):
    pass


class EmployeePointsAllocationUpdate(BaseModel):
    allocated_points: Optional[Decimal] = None
    status: Optional[str] = None


class EmployeePointsAllocationResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    department_budget_allocation_id: UUID
    employee_id: UUID
    allocated_points: Decimal
    spent_points: Decimal
    remaining_points: Decimal
    status: str
    allocation_date: datetime
    allocated_by: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Batch allocation for multiple departments
class BatchDepartmentAllocationRequest(BaseModel):
    tenant_budget_allocation_id: UUID
    allocations: List[DepartmentBudgetAllocationCreate]


# Batch allocation for multiple employees
class BatchEmployeePointsAllocationRequest(BaseModel):
    department_budget_allocation_id: UUID
    allocations: List[EmployeePointsAllocationCreate]


# Dashboard/Summary responses
class BudgetAllocationSummary(BaseModel):
    """Summary of budget allocation across all levels"""
    tenant_id: UUID
    total_allocated: Decimal
    total_distributed_to_departments: Decimal
    total_distributed_to_employees: Decimal
    remaining_available: Decimal
    percentage_distributed: float
    department_count: int
    employee_count: int


class DepartmentAllocationSummary(BaseModel):
    """Summary of a department's budget allocation"""
    department_id: UUID
    department_name: str
    allocated_budget: Decimal
    distributed_to_employees: Decimal
    remaining_budget: Decimal
    percentage_distributed: float
    employee_allocations_count: int

