from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from database import get_db
from models import User, Wallet
from auth.utils import get_current_user, get_hr_admin, get_password_hash, verify_password
from users.schemas import UserCreate, UserUpdate, UserResponse, UserListResponse, PasswordChange

router = APIRouter()


@router.get("/", response_model=List[UserListResponse])
async def get_users(
    department_id: Optional[UUID] = None,
    role: Optional[str] = None,
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
    if role:
        query = query.filter(User.role == role)
    if status:
        query = query.filter(User.status == status)
    
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
        role=user_data.role,
        phone_number=user_data.phone_number or user_data.mobile_number,
        mobile_number=user_data.mobile_number or user_data.phone_number,
        department_id=user_data.department_id,
        manager_id=user_data.manager_id
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
        User.status == 'active',
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
        User.status == 'active'
    ).all()
    return reports
