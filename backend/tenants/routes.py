from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from database import get_db
from models import Tenant, Department, User, AuditLog, ActorType
from auth.utils import get_current_user, get_hr_admin
from tenants.schemas import (
    TenantCreate, TenantUpdate, TenantResponse,
    DepartmentCreate, DepartmentUpdate, DepartmentResponse, DepartmentManagementResponse
)

router = APIRouter()

# Public tenant access router
public_router = APIRouter()


@public_router.get("/{slug}")
async def get_tenant_public(
    slug: str,
    db: Session = Depends(get_db)
):
    """Get tenant by slug (public endpoint - redirects to tenant dashboard)"""
    tenant = db.query(Tenant).filter(
        Tenant.slug == slug,
        Tenant.status == 'active'
    ).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Return tenant info that can be used by frontend
    return {
        "id": tenant.id,
        "name": tenant.name,
        "slug": tenant.slug,
        "domain": tenant.domain,
        "logo_url": tenant.logo_url,
        "theme_config": tenant.theme_config,
        "currency_label": tenant.currency_label,
        "status": tenant.status
    }


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
    if not update_data:
        return tenant

    # Capture old values for audit
    old_values = {k: str(getattr(tenant, k, None)) for k in update_data.keys()}

    for key, value in update_data.items():
        setattr(tenant, key, value)

    # Audit log
    audit = AuditLog(
        tenant_id=tenant.id,
        actor_id=current_user.id,
        actor_type=ActorType.USER,
        action="tenant_updated",
        entity_type="tenant",
        entity_id=tenant.id,
        old_values=old_values,
        new_values={k: str(v) for k, v in update_data.items()}
    )
    db.add(audit)

    db.commit()
    db.refresh(tenant)
    return tenant


@router.put("/current/domain-whitelist", response_model=TenantResponse)
async def update_tenant_domain_whitelist(
    domain_data: dict,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    """Update domain whitelist for the current tenant (HR Admin only).

    Expected payload: {"domains": ["@company.com", "@subsidiary.company"]}
    """
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    domains = domain_data.get('domains') or domain_data.get('domain_whitelist')
    if domains is None or not isinstance(domains, list):
        raise HTTPException(status_code=400, detail="Invalid payload: expected 'domains' list")

    # Basic validation: each domain should start with '@' and contain at least one dot
    cleaned = []
    for d in domains:
        if not isinstance(d, str) or not d.startswith('@') or '.' not in d:
            raise HTTPException(status_code=400, detail=f"Invalid domain format: {d}")
        cleaned.append(d)

    old_values = {'domain_whitelist': str(tenant.domain_whitelist)}
    tenant.domain_whitelist = cleaned

    audit = AuditLog(
        tenant_id=tenant.id,
        actor_id=current_user.id,
        actor_type=ActorType.USER,
        action="tenant_domain_whitelist_updated",
        entity_type="tenant",
        entity_id=tenant.id,
        old_values=old_values,
        new_values={'domain_whitelist': str(cleaned)}
    )
    db.add(audit)

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
    Tenant managers, tenant leads, and admins can access their own tenant's departments.
    """
    # Allow platform admins and users to access tenant via header
    header_tenant = request.headers.get('x-tenant-id')
    tenant_id = None

    if header_tenant:
        try:
            tenant_id = UUID(header_tenant)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid X-Tenant-ID header")

        # Users can access their own tenant's departments
        # Platform admins can access any tenant's departments
        if tenant_id != current_user.tenant_id:
            if not (current_user.is_platform_admin or current_user.is_super_admin):
                raise HTTPException(status_code=403, detail="Insufficient permissions to access other tenants' departments")

        # If the special "All Tenants" selector is used, detect and return
        # departments across all tenants instead of filtering to a single one.
        tenant_record = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if tenant_record and tenant_record.name == 'All Tenants':
            return db.query(Department).all()

    # Fallback to the current user's tenant
    # Tenant managers, tenant leads, and HR admins can access their own tenant's departments
    tenant_id = tenant_id or current_user.tenant_id

    departments = db.query(Department).filter(
        Department.tenant_id == tenant_id
    ).all()
    return departments


@router.get("/departments/management", response_model=List[DepartmentManagementResponse])
async def get_department_management_data(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get department management data for tenant managers.
    
    Returns department data with budget balances, user wallet sums, and department leads.
    """
    # Allow platform admins and users to access tenant via header
    header_tenant = request.headers.get('x-tenant-id')
    tenant_id = None

    if header_tenant:
        try:
            tenant_id = UUID(header_tenant)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid X-Tenant-ID header")

        # Users can access their own tenant's departments
        # Platform admins can access any tenant's departments
        if tenant_id != current_user.tenant_id:
            if not (current_user.is_platform_admin or current_user.is_super_admin):
                raise HTTPException(status_code=403, detail="Insufficient permissions to access other tenants' departments")

    # Fallback to the current user's tenant
    tenant_id = tenant_id or current_user.tenant_id

    # Get departments with management data using raw SQL for efficiency
    from sqlalchemy import text
    
    query = text("""
        SELECT 
            d.id,
            d.name,
            d.budget_balance as unallocated_budget,
            (SELECT CONCAT(u.first_name, ' ', u.last_name) 
             FROM users u 
             WHERE u.dept_id = d.id AND u.org_role = 'dept_lead' 
             LIMIT 1) as dept_lead_name,
            COALESCE(SUM(w.balance), 0) as user_wallet_sum,
            (d.budget_balance + COALESCE(SUM(w.balance), 0)) as total_liability,
            COUNT(u.id) as employee_count
        FROM departments d
        LEFT JOIN users u ON d.id = u.dept_id
        LEFT JOIN wallets w ON u.id = w.user_id
        WHERE d.tenant_id = :tenant_id
        GROUP BY d.id, d.name, d.budget_balance
        ORDER BY d.name
    """)
    
    result = db.execute(query, {"tenant_id": tenant_id})
    departments = result.fetchall()
    
    return [DepartmentManagementResponse(**dict(row)) for row in departments]


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


@router.post("/departments/{department_id}/allocate-budget")
async def allocate_budget_to_department(
    department_id: UUID,
    amount: float,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Allocate points from tenant master pool to department budget (Tenant Manager only)"""
    # Check permissions - only tenant managers can allocate to departments
    if current_user.org_role != 'tenant_manager':
        raise HTTPException(status_code=403, detail="Only tenant managers can allocate budget to departments")
    
    # Get tenant and check master pool balance
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    if tenant.master_budget_balance < amount:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient master pool balance. Available: {tenant.master_budget_balance}"
        )
    
    # Get department
    department = db.query(Department).filter(
        Department.id == department_id,
        Department.tenant_id == current_user.tenant_id
    ).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Update balances
    tenant.master_budget_balance -= amount
    department.budget_balance += amount
    
    db.commit()
    
    return {
        "message": f"Successfully allocated {amount} points to {department.name}",
        "new_master_balance": tenant.master_budget_balance,
        "new_dept_balance": department.budget_balance
    }


@router.post("/departments/{department_id}/assign-lead")
async def assign_department_lead(
    department_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Assign a user as department lead (Tenant Manager only)"""
    # Check permissions - only tenant managers can assign leads
    if current_user.org_role != 'tenant_manager':
        raise HTTPException(status_code=403, detail="Only tenant managers can assign department leads")
    
    # Get department
    department = db.query(Department).filter(
        Department.id == department_id,
        Department.tenant_id == current_user.tenant_id
    ).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Get user
    user = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == current_user.tenant_id,
        User.dept_id == department_id
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found in this department")
    
    # Remove existing dept_lead role from anyone in this department
    db.query(User).filter(
        User.dept_id == department_id,
        User.org_role == 'dept_lead'
    ).update({"org_role": "corporate_user"})
    
    # Assign new dept_lead
    user.org_role = 'dept_lead'
    db.commit()
    
    return {
        "message": f"Successfully assigned {user.first_name} {user.last_name} as department lead for {department.name}"
    }


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
