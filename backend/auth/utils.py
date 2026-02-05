from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from uuid import UUID

from config import settings
from database import get_db
from models import User, SystemAdmin, Tenant
from auth.schemas import TokenData
from core.tenant import set_tenant_context, TenantContext
from core.rbac import RolePermissions

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# Correct OAuth2 token URL - token endpoint is implemented at /api/auth/token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def decode_token(token: str) -> TokenData:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str = payload.get("sub")
        tenant_id: str = payload.get("tenant_id")
        email: str = payload.get("email")
        org_role: str = payload.get("org_role") or payload.get("role")
        department_id: str = payload.get("department_id")
        token_type: str = payload.get("type", "tenant")
        actual_user_id: str = payload.get("actual_user_id")
        effective_tenant_id: str = payload.get("effective_tenant_id")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return TokenData(
            user_id=UUID(user_id),
            tenant_id=UUID(tenant_id) if tenant_id else None,
            email=email,
            org_role=org_role,
            token_type=token_type,
            actual_user_id=UUID(actual_user_id) if actual_user_id else None,
            effective_tenant_id=UUID(effective_tenant_id) if effective_tenant_id else None
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    token_data = decode_token(token)
    
    # Platform Admins now link to a global User record
    if token_data.token_type == "system":
        admin_id = token_data.user_id
        # First check if this is a SystemAdmin record
        admin = db.query(SystemAdmin).filter(SystemAdmin.admin_id == admin_id).first()
        if not admin:
            # Maybe the sub was the user_id
            admin = db.query(SystemAdmin).filter(SystemAdmin.user_id == admin_id).first()
            
        if admin is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="System admin not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user = admin.user
        effective_tenant_id = token_data.effective_tenant_id
        
        # If no effective tenant, they are in "Global Mode" (God mode)
        if effective_tenant_id is None:
            set_tenant_context(
                TenantContext(
                    tenant_id=UUID(int=0),
                    user_id=user.id,
                    org_role="platform_admin",
                    is_platform_admin=True,
                    global_access=True,
                    actual_user_id=user.id,
                    is_impersonating=False
                )
            )
            return user

        # Impersonation mode
        tenant = db.query(Tenant).filter(Tenant.id == effective_tenant_id).first()
        if tenant is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )

        set_tenant_context(
            TenantContext(
                tenant_id=effective_tenant_id,
                user_id=user.id,
                org_role="platform_admin",
                is_platform_admin=True,
                global_access=False,
                actual_user_id=user.id,
                is_impersonating=True
            )
        )
        return user

    user = db.query(User).filter(User.id == token_data.user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if this user is a platform admin even if they didn't log in via platform portal
    is_platform = user.is_platform_admin
    
    set_tenant_context(
        TenantContext(
            tenant_id=user.tenant_id,
            user_id=user.id,
            org_role=user.org_role,
            is_platform_admin=is_platform,
            global_access=is_platform and user.tenant_id == UUID(int=0),
            actual_user_id=user.id,
            is_impersonating=False
        )
    )

    if (user.status or '').lower() != 'active':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active"
        )

    tenant_id = token_data.tenant_id or user.tenant_id
    is_platform_user = RolePermissions.is_platform_level(user.org_role)
    set_tenant_context(
        TenantContext(
            tenant_id=tenant_id,
            user_id=user.id,
            org_role=user.org_role,
            is_platform_admin=is_platform_user,
            global_access=is_platform_user,
            actual_user_id=user.id,
            is_impersonating=False
        )
    )

    return user


def require_role(*allowed_roles):
    """Dependency to check if user has required role"""
    async def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.org_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker


# Role-based dependencies for convenience
async def get_hr_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.org_role not in ['tenant_manager', 'platform_admin', 'hr_admin']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="HR Admin access required"
        )
    return current_user


async def get_manager_or_above(current_user: User = Depends(get_current_user)) -> User:
    if current_user.org_role not in ['dept_lead', 'tenant_manager', 'platform_admin', 'manager', 'hr_admin', 'tenant_lead']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager access required"
        )
    return current_user


def validate_otp_contact(
    db: Session,
    email: Optional[str] = None,
    mobile_number: Optional[str] = None,
    tenant_id: Optional[UUID] = None
) -> User:
    """
    Validate a user's email/mobile before generating OTP codes.

    Email is matched against corporate or personal email fields.
    Mobile is matched against mobile_number or legacy phone_number.
    """
    if not email and not mobile_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or mobile number is required for OTP validation"
        )

    query = db.query(User)
    if tenant_id:
        query = query.filter(User.tenant_id == tenant_id)

    if email:
        query = query.filter(
            (User.corporate_email == email) |
            (User.personal_email == email)
        )

    user = query.first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found for OTP validation"
        )

    if mobile_number:
        if user.mobile_number != mobile_number and user.phone_number != mobile_number:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mobile number does not match the user"
            )

    if (user.status or '').lower() != 'active':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active"
        )

    return user
