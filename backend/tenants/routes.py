from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from database import get_db
from models import Tenant, Department, User
from auth.utils import get_current_user, get_hr_admin
from tenants.schemas import (
    TenantCreate, TenantUpdate, TenantResponse,
    DepartmentCreate, DepartmentUpdate, DepartmentResponse
)

router = APIRouter()


@router.get("/current", response_model=TenantResponse)
async def get_current_tenant(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current user's tenant"""
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.put("/current", response_model=TenantResponse)
async def update_current_tenant(
    tenant_data: TenantUpdate,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    """Update current tenant settings (HR Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    update_data = tenant_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(tenant, key, value)
    
    db.commit()
    db.refresh(tenant)
    return tenant


# Department endpoints
@router.get("/departments", response_model=List[DepartmentResponse])
async def get_departments(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all departments for current tenant.

    Platform admins may provide an `X-Tenant-ID` header to fetch departments
    for a specific tenant context (used by the frontend tenant selector).
    """
    # Allow platform admins to override tenant selection via header
    header_tenant = request.headers.get('x-tenant-id')
    tenant_id = None

    if header_tenant:
        try:
            tenant_id = UUID(header_tenant)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid X-Tenant-ID header")

        # Only permit overrides for platform-level users
        if not (current_user.is_platform_admin or current_user.is_super_admin):
            raise HTTPException(status_code=403, detail="Insufficient permissions to access other tenants' departments")

        # If the special "All Tenants" selector is used, detect and return
        # departments across all tenants instead of filtering to a single one.
        tenant_record = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if tenant_record and tenant_record.name == 'All Tenants':
            return db.query(Department).all()

    # Fallback to the current user's tenant
    tenant_id = tenant_id or current_user.tenant_id

    departments = db.query(Department).filter(
        Department.tenant_id == tenant_id
    ).all()
    return departments


@router.post("/departments", response_model=DepartmentResponse)
async def create_department(
    department_data: DepartmentCreate,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    """Create a new department (HR Admin only)"""
    department = Department(
        tenant_id=current_user.tenant_id,
        **department_data.model_dump()
    )
    db.add(department)
    db.commit()
    db.refresh(department)
    return department


@router.get("/departments/{department_id}", response_model=DepartmentResponse)
async def get_department(
    department_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific department"""
    department = db.query(Department).filter(
        Department.id == department_id,
        Department.tenant_id == current_user.tenant_id
    ).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    return department


@router.put("/departments/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: UUID,
    department_data: DepartmentUpdate,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    """Update a department (HR Admin only)"""
    department = db.query(Department).filter(
        Department.id == department_id,
        Department.tenant_id == current_user.tenant_id
    ).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    update_data = department_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(department, key, value)
    
    db.commit()
    db.refresh(department)
    return department


@router.delete("/departments/{department_id}")
async def delete_department(
    department_id: UUID,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    """Delete a department (HR Admin only)"""
    department = db.query(Department).filter(
        Department.id == department_id,
        Department.tenant_id == current_user.tenant_id
    ).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Check if department has users
    users_count = db.query(User).filter(User.department_id == department_id).count()
    if users_count > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete department with active users"
        )
    
    db.delete(department)
    db.commit()
    return {"message": "Department deleted successfully"}
