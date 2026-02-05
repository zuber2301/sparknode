from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from uuid import UUID, uuid4
import io
import pandas as pd
import secrets
import string
from email_validator import validate_email, EmailNotValidError
from datetime import datetime

import re
from database import get_db
from models import User, Tenant, Department, UserUploadStaging, Wallet
from auth.utils import get_current_user, get_hr_admin, get_password_hash
from users.schemas import (
    UserCreate,
    UserResponse,
    UserListResponse,
    BulkUploadResponse,
    StagingRowResponse,
    BulkConfirmRequest,
    BulkActionRequest,
    BulkResendRequest,
    StagingRowUpdate,
    VALID_ROLES,
    UserPatch
)
from core.tasks import send_invite_email_task

router = APIRouter()

def generate_random_password(length=12):
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def clean_mobile(mobile):
    if not mobile: return ""
    mobile = str(mobile).replace('.0', '').replace(' ', '').strip()
    mobile = "".join(c for c in mobile if c.isdigit() or c == '+')
    if len(mobile) == 10 and mobile.isdigit():
        mobile = f"+91{mobile}"
    return mobile

def validate_staging_row(
    db: Session,
    tenant_id: UUID,
    email: str,
    department_name: str,
    role: str,
    manager_email: str,
    full_name: str = "",
    mobile_number: str = ""
):
    errors = []
    
    if not full_name:
        errors.append("Full Name is required")
    
    if not email:
        errors.append("Work Email is required")
    else:
        try:
            validate_email(email)
        except EmailNotValidError:
            errors.append("Invalid Work Email format")

    # Conflict check
    norm_mobile = clean_mobile(mobile_number)
    existing = db.query(User).filter(
        User.tenant_id == tenant_id,
        (
            (func.lower(User.corporate_email) == email.lower()) |
            ((User.mobile_number == norm_mobile) if norm_mobile else False)
        )
    ).first()
    
    if existing:
        if existing.corporate_email.lower() == email.lower():
            errors.append(f"Email {email} is already in use")
        elif norm_mobile and existing.mobile_number == norm_mobile:
            errors.append(f"Mobile {norm_mobile} is already in use")

    # Department validation
    department = None
    if not department_name or str(department_name).lower() == 'nan':
        errors.append("Department is required")
    else:
        dept_name_clean = str(department_name).strip()
        department = db.query(Department).filter(
            Department.tenant_id == tenant_id,
            func.lower(Department.name) == dept_name_clean.lower()
        ).first()
        if not department:
            errors.append(f"Department '{dept_name_clean}' not found")

    if role and role not in VALID_ROLES:
        errors.append(f"Invalid Role: {role}")

    return {
        "errors": errors,
        "department_id": department.id if department else None,
        "is_valid": len(errors) == 0,
        "cleaned_mobile": norm_mobile
    }

@router.get("/", response_model=List[UserListResponse])
async def get_users(
    tenant_id: Optional[UUID] = Query(None),
    department_id: Optional[UUID] = None,
    org_role: Optional[str] = Query(None, alias="role"),
    status: Optional[str] = Query(default="active"),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get users with tenant-aware filtering.
    
    Platform Admin Features:
    - Can query any tenant's users by providing tenant_id parameter
    - Can filter users within a specific tenant
    - Returns all users for a given tenant_id context
    
    Regular Users:
    - Can only see users from their own tenant
    - tenant_id parameter is ignored (replaced with their own tenant)
    
    This implements the "Platform Admin View" from the architecture:
    "In your Tenant Manager section, when you click on a tenant, your UI 
    should call: GET /users?tenant_id=XYZ"
    
    Example (Platform Admin viewing Triton Energy employees):
        GET /api/users?tenant_id=550e8400-e29b-41d4-a716-446655440000
    """
    # Determine the effective tenant_id to query
    query_tenant_id = current_user.tenant_id
    
    # Platform admins can override tenant context via query parameter
    if tenant_id:
        if current_user.is_platform_admin:
            query_tenant_id = tenant_id
        else:
            # Non-admin users cannot query other tenants
            if tenant_id != current_user.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only view users from your own organization"
                )
            query_tenant_id = tenant_id
    
    # Build the query with tenant isolation
    query = db.query(User).filter(User.tenant_id == query_tenant_id)
    
    if department_id:
        query = query.filter(User.department_id == department_id)
    
    if org_role:
        query = query.filter(User.org_role == org_role)
    
    if status:
        query = query.filter(func.lower(User.status) == status.lower())
    
    users = query.offset(skip).limit(limit).all()
    return users

@router.post("/", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    existing = db.query(User).filter(
        User.tenant_id == current_user.tenant_id,
        (User.corporate_email == user_data.corporate_email)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        tenant_id=current_user.tenant_id,
        corporate_email=user_data.corporate_email,
        personal_email=user_data.personal_email,
        password_hash=get_password_hash(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        org_role=user_data.org_role,
        mobile_number=clean_mobile(user_data.mobile_number),
        department_id=user_data.department_id,
        manager_id=user_data.manager_id,
        date_of_birth=user_data.date_of_birth,
        hire_date=user_data.hire_date
    )
    db.add(user)
    db.flush()
    
    wallet = Wallet(tenant_id=current_user.tenant_id, user_id=user.id, balance=0)
    db.add(wallet)
    db.commit()
    db.refresh(user)
    return user

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific user by ID (within same tenant)"""
    from core.rbac import get_effective_role

    effective_role = get_effective_role(current_user, db)

    # Platform admins can view any user
    if effective_role == "platform_admin":
        user = db.query(User).filter(User.id == user_id).first()
    else:
        # Regular users can only view users in their tenant
        user = db.query(User).filter(
            User.id == user_id,
            User.tenant_id == current_user.tenant_id
        ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get department name
    department_name = None
    if user.department_id:
        department = db.query(Department).filter(Department.id == user.department_id).first()
        department_name = department.name if department else None

    # Return user with department name
    user_dict = user.__dict__.copy()
    user_dict['department_name'] = department_name
    return UserResponse(**user_dict)

@router.patch("/{user_id}", response_model=UserResponse)
async def patch_user(
    user_id: UUID,
    user_data: UserPatch,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id, User.tenant_id == current_user.tenant_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_data.model_dump(exclude_unset=True)
    if "mobile_number" in update_data:
        update_data["mobile_number"] = clean_mobile(update_data["mobile_number"])

    if "role" in update_data:
        user.org_role = update_data.pop("role")

    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}/direct-reports", response_model=List[UserListResponse])
async def get_direct_reports(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get direct reports for a given user (manager)."""
    # Ensure the user exists and belongs to the same tenant
    manager = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == current_user.tenant_id
    ).first()
    if not manager:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get all users who report to this manager
    direct_reports = db.query(User).filter(
        User.manager_id == user_id,
        User.tenant_id == current_user.tenant_id,
        User.status == 'active'
    ).all()
    
    return direct_reports


@router.get("/bulk/template")
async def download_bulk_template():
    headers = "Full Name,Email,Role,Department,Manager Email,Mobile Number,Personal Email,Date of Birth,Hire Date\n"
    return Response(
        content=headers,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sparknode_user_template.csv"}
    )

# --- Enhanced Bulk Upload Endpoints ---

@router.post("/upload", response_model=BulkUploadResponse)
async def upload_bulk_users(
    file: UploadFile = File(...),
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    try:
        content = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
        
        if df.empty:
            raise HTTPException(status_code=400, detail="File is empty")
        
        # Normalization
        df.columns = [str(c).strip().lower().replace(' ', '_') for c in df.columns]
        
        batch_id = uuid4()
        valid_rows = 0
        
        for _, row in df.iterrows():
            raw_email = str(row.get('email', '')).strip()
            raw_full_name = str(row.get('full_name', row.get('name', ''))).strip()
            raw_dept = str(row.get('department', '')).strip()
            raw_role = str(row.get('role', 'corporate_user')).strip()
            raw_manager = str(row.get('manager_email', '')).strip()
            raw_mobile = str(row.get('mobile_number', row.get('mobile', row.get('phone', '')))).strip()
            personal_email = str(row.get('personal_email', '')).strip()
            
            validation = validate_staging_row(
                db, current_user.tenant_id, raw_email, raw_dept, raw_role, raw_manager,
                full_name=raw_full_name, mobile_number=raw_mobile
            )
            
            if validation["is_valid"]:
                valid_rows += 1
                
            staging = UserUploadStaging(
                tenant_id=current_user.tenant_id,
                batch_id=batch_id,
                raw_full_name=raw_full_name,
                raw_email=raw_email,
                raw_department=raw_dept,
                raw_role=raw_role,
                raw_mobile_phone=validation["cleaned_mobile"],
                manager_email=raw_manager,
                personal_email=personal_email,
                department_id=validation["department_id"],
                is_valid=validation["is_valid"],
                validation_errors=validation["errors"],
                status="valid" if validation["is_valid"] else "error"
            )
            db.add(staging)
            db.flush() 
        
        db.commit()
        return BulkUploadResponse(batch_id=batch_id, total_rows=len(df), valid_rows=valid_rows, error_rows=len(df)-valid_rows)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/staging/{batch_id}", response_model=List[StagingRowResponse])
async def get_staging(batch_id: UUID, current_user: User = Depends(get_hr_admin), db: Session = Depends(get_db)):
    return db.query(UserUploadStaging).filter(
        UserUploadStaging.tenant_id == current_user.tenant_id,
        UserUploadStaging.batch_id == batch_id
    ).all()

@router.patch("/staging/row/{row_id}", response_model=StagingRowResponse)
async def update_staging_row(row_id: UUID, payload: StagingRowUpdate, current_user: User = Depends(get_hr_admin), db: Session = Depends(get_db)):
    row = db.query(UserUploadStaging).filter(UserUploadStaging.id == row_id, UserUploadStaging.tenant_id == current_user.tenant_id).first()
    if not row: raise HTTPException(status_code=404, detail="Row not found")
    
    update_data = payload.model_dump(exclude_unset=True)
    for k, v in update_data.items(): setattr(row, k, v)
    
    val = validate_staging_row(
        db, current_user.tenant_id, row.raw_email, row.raw_department, row.raw_role, row.manager_email,
        full_name=row.raw_full_name, mobile_number=row.raw_mobile_phone
    )
    row.is_valid = val["is_valid"]
    row.status = "valid" if val["is_valid"] else "error"
    row.validation_errors = val["errors" ]
    row.department_id = val["department_id"]
    row.raw_mobile_phone = val["cleaned_mobile"]
    
    db.commit()
    db.refresh(row)
    return row

@router.post("/staging/{batch_id}/confirm")
async def confirm_bulk_upload(
    batch_id: UUID, 
    payload: BulkConfirmRequest, 
    current_user: User = Depends(get_hr_admin), 
    db: Session = Depends(get_db)
):
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    rows = db.query(UserUploadStaging).filter(
        UserUploadStaging.batch_id == batch_id,
        UserUploadStaging.tenant_id == current_user.tenant_id,
        UserUploadStaging.is_valid == True
    ).all()
    
    users_by_email = {}
    
    for row in rows:
        temp_pwd = generate_random_password()
        # Parse first/last name from raw_full_name
        name_parts = row.raw_full_name.split(' ', 1)
        f_name = name_parts[0]
        l_name = name_parts[1] if len(name_parts) > 1 else ""
        
        user = User(
            tenant_id=current_user.tenant_id,
            corporate_email=row.raw_email,
            personal_email=row.personal_email,
            password_hash=get_password_hash(temp_pwd),
            first_name=f_name,
            last_name=l_name,
            org_role=row.raw_role or "corporate_user",
            department_id=row.department_id,
            mobile_number=row.raw_mobile_phone,
            status="PENDING_INVITE"
        )
        db.add(user)
        db.flush()
        
        from models import Wallet
        wallet = Wallet(tenant_id=current_user.tenant_id, user_id=user.id, balance=0)
        db.add(wallet)
        
        users_by_email[user.corporate_email.lower()] = user
        
        if payload.send_invites:
            send_invite_email_task.delay(user.corporate_email, tenant.name)
            
    for row in rows:
        user = users_by_email.get(row.raw_email.lower())
        if not user or not row.manager_email:
            continue
            
        manager = db.query(User).filter(
            User.tenant_id == current_user.tenant_id,
            (func.lower(User.corporate_email) == row.manager_email.lower()) | (func.lower(User.corporate_email) == row.manager_email.lower())
        ).first()
        
        if not manager:
            manager = users_by_email.get(row.manager_email.lower())
            
        if manager:
            user.manager_id = manager.id
            
    db.commit()
    return {"status": "success", "created": len(rows)}

@router.post("/bulk/deactivate")
async def bulk_deactivate_users(payload: BulkActionRequest, current_user: User = Depends(get_hr_admin), db: Session = Depends(get_db)):
    db.query(User).filter(User.id.in_(payload.user_ids), User.tenant_id == current_user.tenant_id).update({"status": "DEACTIVATED"}, synchronize_session=False)
    db.commit()
    return {"status": "success"}

@router.post("/bulk/resend-invites")
async def bulk_resend_invites(payload: BulkResendRequest, current_user: User = Depends(get_hr_admin), db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    users = db.query(User).filter(User.id.in_(payload.user_ids), User.tenant_id == current_user.tenant_id).all()
    for u in users:
        send_invite_email_task.delay(u.corporate_email, tenant.name)
    return {"status": "success"}

# =====================================================
# PLATFORM ADMIN: TENANT-SPECIFIC USER MANAGEMENT
# =====================================================

@router.get("/tenant/{tenant_id}/users", response_model=List[UserListResponse])
async def get_tenant_users(
    tenant_id: UUID,
    department_id: Optional[UUID] = None,
    org_role: Optional[str] = Query(None, alias="role"),
    status: Optional[str] = Query(default="active"),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Platform Admin endpoint to view all users of a specific tenant.
    
    This implements the "Platform Admin View" from the architecture:
    "When you click on a tenant in the Tenant Manager, your UI should call:
    GET /users/tenant/{tenant_id}/users"
    
    Allows platform admins to:
    - See all employees in a specific organization
    - Filter by department, role, or status
    - Manage users across the entire platform
    
    Access Control:
    - Platform admins only
    - Raises 403 if current_user is not a platform admin
    
    Example:
        GET /api/users/tenant/550e8400-e29b-41d4-a716-446655440000/users
        GET /api/users/tenant/550e8400-e29b-41d4-a716-446655440000/users?role=hr_admin
        GET /api/users/tenant/550e8400-e29b-41d4-a716-446655440000/users?department_id=XXX&status=ACTIVE
    """
    # Verify platform admin access
    if not current_user.is_platform_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform admin access required"
        )
    
    # Verify tenant exists
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Build query for this tenant's users
    query = db.query(User).filter(User.tenant_id == tenant_id)
    
    if department_id:
        query = query.filter(User.department_id == department_id)
    
    if org_role:
        query = query.filter(User.org_role == org_role)
    
    if status:
        query = query.filter(func.lower(User.status) == status.lower())
    
    users = query.offset(skip).limit(limit).all()
    return users
