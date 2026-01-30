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
