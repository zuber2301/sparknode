from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta, datetime

from database import get_db
from models import User
from config import settings
from auth.schemas import Token, LoginRequest, LoginResponse, UserResponse, SystemAdminLoginResponse, SystemAdminResponse
from auth.utils import verify_password, create_access_token, get_current_user
from models import SystemAdmin, Tenant
from uuid import UUID

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """Authenticate user and return JWT token"""
    user = db.query(User).filter(
        (User.corporate_email == login_data.email) | (User.email == login_data.email)
    ).first()
    
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if (user.status or '').lower() != 'active':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active"
        )
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "tenant_id": str(user.tenant_id),
            "email": user.corporate_email or user.email,
            "role": user.role,
            "type": "tenant"
        },
        expires_delta=access_token_expires
    )
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            tenant_id=user.tenant_id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            role=user.role,
            phone_number=user.phone_number,
            mobile_number=user.mobile_number,
            corporate_email=user.corporate_email,
            personal_email=user.personal_email,
            department_id=user.department_id,
            avatar_url=user.avatar_url,
            status=user.status
        )
    )


@router.post("/system/login", response_model=SystemAdminLoginResponse)
async def system_login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """Authenticate platform admin and return JWT token"""
    admin = db.query(SystemAdmin).filter(SystemAdmin.email == login_data.email).first()

    if not admin or not verify_password(login_data.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    admin.last_login_at = datetime.utcnow()
    db.commit()

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={
            "sub": str(admin.id),
            "email": admin.email,
            "role": "platform_admin",
            "type": "system"
        },
        expires_delta=access_token_expires
    )

    return SystemAdminLoginResponse(
        access_token=access_token,
        token_type="bearer",
        admin=SystemAdminResponse(
            id=admin.id,
            email=admin.email,
            role="platform_admin",
            is_super_admin=admin.is_super_admin,
            mfa_enabled=admin.mfa_enabled,
            last_login_at=admin.last_login_at
        )
    )


@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """OAuth2 compatible token endpoint"""
    user = db.query(User).filter(
        (User.corporate_email == form_data.username) | (User.email == form_data.username)
    ).first()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if (user.status or '').lower() != 'active':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active"
        )
    
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "tenant_id": str(user.tenant_id),
            "email": user.corporate_email or user.email,
            "role": user.role,
            "type": "tenant"
        },
        expires_delta=access_token_expires
    )
    
    return Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current authenticated user information"""
    return UserResponse(
        id=current_user.id,
        tenant_id=current_user.tenant_id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        role=current_user.role,
        phone_number=current_user.phone_number,
        mobile_number=current_user.mobile_number,
        corporate_email=current_user.corporate_email,
        personal_email=current_user.personal_email,
        department_id=current_user.department_id,
        avatar_url=current_user.avatar_url,
        status=current_user.status
    )


@router.post("/impersonate/{tenant_id}")
async def impersonate_tenant(
    tenant_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Issue a temporary session token for a platform admin to act on behalf of a tenant."""
    if current_user.role != "platform_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Platform admin access required")

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    access_token_expires = timedelta(minutes=min(settings.access_token_expire_minutes, 30))
    access_token = create_access_token(
        data={
            "sub": str(current_user.id),
            "email": current_user.email,
            "role": "platform_admin",
            "type": "system",
            "actual_user_id": str(current_user.id),
            "effective_tenant_id": str(tenant.id)
        },
        expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """Logout user (client should discard the token)"""
    return {"message": "Successfully logged out"}
