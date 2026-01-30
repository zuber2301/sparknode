from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from uuid import UUID, uuid4
import io
import pandas as pd
from email_validator import validate_email, EmailNotValidError
from datetime import datetime

def try_parse_date(date_str):
    if not date_str or str(date_str).lower() in ('nan', 'none', ''):
        return None
    
    # Handle direct date objects (from pandas if it already parsed it)
    if isinstance(date_str, (datetime, date)):
        return date_str.date() if isinstance(date_str, datetime) else date_str

    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%d-%m-%Y', '%Y/%m/%d'):
        try:
            return datetime.strptime(str(date_str).strip(), fmt).date()
        except (ValueError, TypeError):
            pass
    return None

from database import get_db
from models import User, Wallet, WalletLedger, AuditLog, Department, Tenant, UserUploadStaging
from auth.utils import get_current_user, get_hr_admin, get_password_hash, verify_password
from users.schemas import (
    UserCreate,
    UserUpdate,
    UserPatch,
    UserResponse,
    UserListResponse,
    PasswordChange,
    BulkUploadResponse,
    StagingRowResponse,
    BulkConfirmRequest,
    BulkActionRequest,
    BulkResendRequest,
    StagingRowUpdate,
    VALID_ROLES
)
from core.tasks import send_invite_email_task
from core import append_impersonation_metadata

router = APIRouter()


def get_allowed_roles(tenant: Tenant) -> List[str]:
    return tenant.settings.get("allowed_roles", VALID_ROLES)


def validate_staging_row(
    db: Session,
    tenant_id: UUID,
    allowed_roles: set,
    email: str,
    department_name: str,
    role: str,
    manager_email: str,
    full_name: str = "",
    first_name: str = "",
    last_name: str = "",
    mobile_number: str = "",
    phone_number: str = "",
    personal_email: str = ""
):
    errors = []
    import re

    if not first_name and not last_name and not full_name:
        errors.append("First Name/Last Name are required")
    
    # Work Email Validation
    if not email:
        errors.append("Email is required")
    else:
        try:
            validate_email(email)
        except EmailNotValidError:
            errors.append("Invalid Email Format")

    # Personal Email Validation
    if personal_email:
        try:
            validate_email(personal_email)
        except EmailNotValidError:
            errors.append("Invalid Personal Email Format")

    if not department_name or not str(department_name).strip():
        errors.append("Department is required")

    if role and role not in allowed_roles:
        errors.append(f"Invalid Role: {role}")

    # Mobile validation matching screenshot requirement
    if mobile_number:
        # Normalize: remove .0 from excel floats, remove spaces
        norm_mobile = str(mobile_number).replace(".0", "").replace(" ", "").strip()
        if not re.match(r"^\+91[6-9]\d{9}$", norm_mobile):
            # Try to auto-fix if it's 10 digits
            if re.match(r"^[6-9]\d{9}$", norm_mobile):
                norm_mobile = f"+91{norm_mobile}"
            elif re.match(r"^91[6-9]\d{9}$", norm_mobile):
                norm_mobile = f"+{norm_mobile}"
            else:
                errors.append("Mobile must follow +91XXXXXXXXXX format")
        mobile_number = norm_mobile

    department = None
    if department_name:
        department = db.query(Department).filter(
            Department.tenant_id == tenant_id,
            func.lower(Department.name) == department_name.lower()
        ).first()
        if not department:
            errors.append(f"Department '{department_name}' not found")

    manager = None
    if manager_email:
        manager = db.query(User).filter(
            User.tenant_id == tenant_id,
            (func.lower(User.corporate_email) == manager_email.lower()) | 
            (func.lower(User.email) == manager_email.lower())
        ).first()
        if not manager:
            errors.append(f"Manager Email '{manager_email}' not found")

    # Conflict Detection: Work Email or Mobile Number already registered
    # Phase 2 Implementation as per requirements
    existing_user = db.query(User).filter(
        User.tenant_id == tenant_id,
        (
            (func.lower(User.corporate_email) == email.lower()) | 
            (func.lower(User.email) == email.lower()) |
            ((User.mobile_number == mobile_number) if mobile_number else False)
        )
    ).first()

    if existing_user:
        if email and (existing_user.email.lower() == email.lower() or (existing_user.corporate_email and existing_user.corporate_email.lower() == email.lower())):
            errors.append(f"Work email {email} already exists")
        elif mobile_number and existing_user.mobile_number == mobile_number:
            errors.append(f"Mobile number {mobile_number} already exists")

    if not first_name or not last_name:
        name_parts = str(full_name).split()
        if not first_name:
            first_name = name_parts[0] if name_parts else ""
        if not last_name:
            last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

    return {
        "errors": errors,
        "department_id": department.id if department else None,
        "manager_id": manager.id if manager else None,
        "first_name": first_name,
        "last_name": last_name,
        "mobile_number": mobile_number
    }


def get_str_val(row, key, default=""):
    val = row.get(key)
    if val is None or str(val).lower() in ('nan', 'none', ''):
        return default
    return str(val).strip()


async def read_upload_to_dataframe(file: UploadFile) -> pd.DataFrame:
    content = await file.read()
    filename = (file.filename or "").lower()
    if filename.endswith(".xlsx") or filename.endswith(".xls"):
        return pd.read_excel(io.BytesIO(content))
    return pd.read_csv(io.BytesIO(content))


def normalize_headers(df: pd.DataFrame) -> pd.DataFrame:
    """Phase 1: Normalize headers to snake_case"""
    df.columns = [
        str(col).strip().lower().replace(" ", "_").replace("-", "_") 
        for col in df.columns
    ]
    return df


@router.get("/", response_model=List[UserListResponse])
async def get_users(
    department_id: Optional[UUID] = None,
    org_role: Optional[str] = Query(None, alias="role"),
    status: Optional[str] = Query(default="active"),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all users for current tenant with optional filters"""
    query = db.query(User).filter(User.tenant_id == current_user.tenant_id)
    
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
    """Create a new user (HR Admin only)"""
    # Check if email already exists in tenant
    email_to_check = user_data.corporate_email or user_data.email
    existing_user = db.query(User).filter(
        User.tenant_id == current_user.tenant_id,
        ((User.email == user_data.email) | (User.corporate_email == email_to_check))
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        tenant_id=current_user.tenant_id,
        email=user_data.email,
        corporate_email=user_data.corporate_email or user_data.email,
        personal_email=user_data.personal_email,
        password_hash=get_password_hash(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        org_role=user_data.org_role,
        phone_number=user_data.phone_number or user_data.mobile_number,
        mobile_number=user_data.mobile_number or user_data.phone_number,
        department_id=user_data.department_id,
        manager_id=user_data.manager_id,
        date_of_birth=user_data.date_of_birth,
        hire_date=user_data.hire_date
    )
    db.add(user)
    db.flush()
    
    # Create wallet for user
    wallet = Wallet(
        tenant_id=current_user.tenant_id,
        user_id=user.id,
        balance=0,
        lifetime_earned=0,
        lifetime_spent=0
    )
    db.add(wallet)
    
    db.commit()
    db.refresh(user)
    return user


@router.get("/search", response_model=List[UserListResponse])
async def search_users(
    q: str = Query(..., min_length=2),
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search users by name or email"""
    search_term = f"%{q}%"
    users = db.query(User).filter(
        User.tenant_id == current_user.tenant_id,
        func.lower(User.status) == 'active',
        (User.first_name.ilike(search_term) | 
         User.last_name.ilike(search_term) | 
         User.email.ilike(search_term))
    ).limit(limit).all()
    return users


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific user"""
    user = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == current_user.tenant_id
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    """Update a user (HR Admin only)"""
    user = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == current_user.tenant_id
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = user_data.model_dump(exclude_unset=True)
    if "mobile_number" in update_data and "phone_number" not in update_data:
        update_data["phone_number"] = update_data.get("mobile_number")
    if "phone_number" in update_data and "mobile_number" not in update_data:
        update_data["mobile_number"] = update_data.get("phone_number")
    for key, value in update_data.items():
        setattr(user, key, value)
    
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserResponse)
async def patch_user(
    user_id: UUID,
    user_data: UserPatch,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == current_user.tenant_id
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_data.model_dump(exclude_unset=True)
    if "mobile_number" in update_data and "phone_number" not in update_data:
        update_data["phone_number"] = update_data.get("mobile_number")
    if "phone_number" in update_data and "mobile_number" not in update_data:
        update_data["mobile_number"] = update_data.get("phone_number")

    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user


@router.put("/me/password")
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change current user's password"""
    if not verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    current_user.password_hash = get_password_hash(password_data.new_password)
    db.commit()
    return {"message": "Password changed successfully"}


@router.get("/{user_id}/direct-reports", response_model=List[UserListResponse])
async def get_direct_reports(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get direct reports for a user"""
    reports = db.query(User).filter(
        User.tenant_id == current_user.tenant_id,
        User.manager_id == user_id,
        func.lower(User.status) == 'active'
    ).all()
    return reports


@router.get("/bulk/template")
async def download_bulk_template():
    headers = "First Name,Last Name,Email,Corporate Email,Personal Email,Role,Department,Manager Email,Phone Number,Mobile Number,Date of Birth,Hire Date\n"
    return Response(
        content=headers,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=sparknode_user_template.csv"}
    )


@router.post("/bulk/upload", response_model=BulkUploadResponse)
async def upload_bulk_users(
    file: UploadFile = File(...),
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    df = await read_upload_to_dataframe(file)
    if df.empty:
        raise HTTPException(status_code=400, detail="The uploaded file is empty")
    
    df = normalize_headers(df)

    # Phase 1: snake_case requirement
    required_cols = {"email", "role", "department"}
    columns = set(df.columns)
    
    # Check if first_name/last_name exists in snake_case
    if not ("full_name" in columns or ("first_name" in columns and "last_name" in columns)):
        # Fallback check for "full name" just in case normalization missed something, but it shouldn't
        if not ("full name" in columns or ("first name" in columns and "last name" in columns)):
            raise HTTPException(status_code=400, detail="Template must have 'Full Name' or 'First Name' and 'Last Name'")
    
    if not required_cols.issubset(columns):
        raise HTTPException(status_code=400, detail=f"Missing required columns: {required_cols - columns}")

    batch_id = uuid4()
    allowed_roles = set(get_allowed_roles(tenant))

    total_rows = 0
    valid_rows = 0
    error_rows = 0

    for _, row in df.iterrows():
        total_rows += 1
        errors = []

        first_name = get_str_val(row, "first_name", get_str_val(row, "first name"))
        last_name = get_str_val(row, "last_name", get_str_val(row, "last name"))
        full_name = get_str_val(row, "full_name", get_str_val(row, "full name"))
        email = get_str_val(row, "email").lower()
        corporate_email = get_str_val(row, "corporate_email", get_str_val(row, "corporate email")).lower()
        personal_email = get_str_val(row, "personal_email", get_str_val(row, "personal email")).lower()
        department_name = get_str_val(row, "department")
        role = get_str_val(row, "role")
        manager_email = get_str_val(row, "manager_email", get_str_val(row, "manager email")).lower()
        phone_number = get_str_val(row, "phone_number", get_str_val(row, "phone number"))
        mobile_number = get_str_val(row, "mobile_number", get_str_val(row, "mobile number"))
        date_of_birth = get_str_val(row, "date_of_birth", get_str_val(row, "date of birth"))
        hire_date = get_str_val(row, "hire_date", get_str_val(row, "hire date"))

        validation = validate_staging_row(
            db,
            current_user.tenant_id,
            allowed_roles,
            email,
            department_name,
            role,
            manager_email,
            full_name=full_name,
            first_name=first_name,
            last_name=last_name,
            mobile_number=mobile_number,
            phone_number=phone_number,
            personal_email=personal_email
        )

        errors = validation["errors"]

        status_value = "valid" if not errors else "error"
        if errors:
            error_rows += 1
        else:
            valid_rows += 1

        staging = UserUploadStaging(
            tenant_id=current_user.tenant_id,
            batch_id=batch_id,
            full_name=f"{validation['first_name']} {validation['last_name']}".strip() or full_name,
            first_name=validation["first_name"],
            last_name=validation["last_name"],
            email=email,
            corporate_email=corporate_email or email,
            personal_email=personal_email,
            department_name=department_name,
            role=role,
            manager_email=manager_email,
            phone_number=phone_number,
            mobile_number=validation["mobile_number"],
            date_of_birth=date_of_birth,
            hire_date=hire_date,
            department_id=validation["department_id"],
            manager_id=validation["manager_id"],
            status=status_value,
            errors=errors
        )
        db.add(staging)

    db.commit()

    return BulkUploadResponse(
        batch_id=batch_id,
        total_rows=total_rows,
        valid_rows=valid_rows,
        error_rows=error_rows
    )


@router.get("/bulk/staging", response_model=List[StagingRowResponse])
async def get_staging_rows(
    batch_id: UUID,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    rows = db.query(UserUploadStaging).filter(
        UserUploadStaging.tenant_id == current_user.tenant_id,
        UserUploadStaging.batch_id == batch_id
    ).all()
    return rows


@router.patch("/bulk/staging/{row_id}", response_model=StagingRowResponse)
async def update_staging_row(
    row_id: UUID,
    payload: StagingRowUpdate,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    row = db.query(UserUploadStaging).filter(
        UserUploadStaging.id == row_id,
        UserUploadStaging.tenant_id == current_user.tenant_id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Staging row not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(row, key, value)

    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    allowed_roles = set(get_allowed_roles(tenant))

    validation = validate_staging_row(
        db,
        current_user.tenant_id,
        allowed_roles,
        row.email,
        row.department_name or "",
        row.org_role or "",
        row.manager_email or "",
        full_name=row.full_name,
        first_name=row.first_name,
        last_name=row.last_name
    )

    row.first_name = validation["first_name"]
    row.last_name = validation["last_name"]
    row.mobile_number = validation["mobile_number"]
    row.department_id = validation["department_id"]
    row.manager_id = validation["manager_id"]
    row.errors = validation["errors"]
    row.status = "error" if validation["errors"] else "valid"

    db.commit()
    db.refresh(row)
    return row


@router.post("/bulk/confirm")
async def confirm_bulk_upload(
    payload: BulkConfirmRequest,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    rows = db.query(UserUploadStaging).filter(
        UserUploadStaging.tenant_id == current_user.tenant_id,
        UserUploadStaging.batch_id == payload.batch_id,
        UserUploadStaging.status == "valid"
    ).all()

    created = 0
    for row in rows:
        user = User(
            tenant_id=current_user.tenant_id,
            email=row.email,
            corporate_email=row.corporate_email or row.email,
            personal_email=row.personal_email,
            password_hash=get_password_hash("password123"), # Temporary, will be changed on invite
            first_name=row.first_name,
            last_name=row.last_name,
            org_role=row.org_role or "corporate_user",
            department_id=row.department_id,
            manager_id=row.manager_id,
            phone_number=row.phone_number,
            mobile_number=row.mobile_number or row.phone_number,
            date_of_birth=try_parse_date(row.date_of_birth),
            hire_date=try_parse_date(row.hire_date),
            status="PENDING_INVITE",
            invitation_sent_at=func.now()
        )
        db.add(user)
        db.flush()

        wallet = Wallet(
            tenant_id=current_user.tenant_id,
            user_id=user.id,
            balance=0,
            lifetime_earned=0,
            lifetime_spent=0
        )
        db.add(wallet)
        created += 1

        if payload.send_invites:
            send_invite_email_task.delay(user.corporate_email or user.email, tenant.name)

    db.commit()
    return {"created": created, "batch_id": str(payload.batch_id)}


@router.post("/bulk/deactivate")
async def bulk_deactivate_users(
    payload: BulkActionRequest,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    results = []
    for user_id in payload.user_ids:
        user = db.query(User).filter(
            User.id == user_id,
            User.tenant_id == current_user.tenant_id
        ).first()
        if not user:
            results.append({"user_id": str(user_id), "status": "failed", "error": "User not found"})
            continue

        user.status = "DEACTIVATED"

        wallet = db.query(Wallet).filter(
            Wallet.user_id == user.id,
            Wallet.tenant_id == current_user.tenant_id
        ).first()
        if wallet and wallet.balance > 0:
            old_balance = wallet.balance
            wallet.balance = 0
            wallet.lifetime_spent = wallet.lifetime_spent + old_balance
            ledger_entry = WalletLedger(
                tenant_id=current_user.tenant_id,
                wallet_id=wallet.id,
                transaction_type='debit',
                source='expiry',
                points=old_balance,
                balance_after=wallet.balance,
                description="Balance frozen on deactivation",
                created_by=current_user.id
            )
            db.add(ledger_entry)
            audit = AuditLog(
                tenant_id=current_user.tenant_id,
                actor_id=current_user.id,
                action="user_deactivated",
                entity_type="user",
                entity_id=user.id,
                old_values={"balance": str(old_balance)},
                new_values=append_impersonation_metadata({"balance": str(wallet.balance)})
            )
            db.add(audit)

        results.append({"user_id": str(user_id), "status": "success"})

    db.commit()
    return {"results": results}


@router.post("/bulk/reactivate")
async def bulk_reactivate_users(
    payload: BulkActionRequest,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    results = []
    for user_id in payload.user_ids:
        user = db.query(User).filter(
            User.id == user_id,
            User.tenant_id == current_user.tenant_id
        ).first()
        if not user:
            results.append({"user_id": str(user_id), "status": "failed", "error": "User not found"})
            continue
        user.status = "ACTIVE"
        results.append({"user_id": str(user_id), "status": "success"})

    db.commit()
    return {"results": results}


@router.post("/bulk/resend-invites")
async def bulk_resend_invites(
    payload: BulkResendRequest,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    results = []
    for user_id in payload.user_ids:
        user = db.query(User).filter(
            User.id == user_id,
            User.tenant_id == current_user.tenant_id
        ).first()
        if not user:
            results.append({"user_id": str(user_id), "status": "failed", "error": "User not found"})
            continue
        if user.status not in ["PENDING_INVITE", "pending_invite", "ACTIVE", "active"]:
            results.append({"user_id": str(user_id), "status": "skipped"})
            continue
        send_invite_email_task.delay(user.corporate_email or user.email, tenant.name)
        results.append({"user_id": str(user_id), "status": "sent"})

    db.commit()
    return {"results": results}
