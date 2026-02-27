from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta, datetime

from database import get_db
from models import User, Tenant
from config import settings
from auth.schemas import (
    Token,
    LoginRequest,
    LoginResponse,
    UserResponse,
    SystemAdminLoginResponse,
    SystemAdminResponse,
    EmailOtpRequest,
    EmailOtpVerify,
    SmsOtpRequest,
    SmsOtpVerify,
    OtpResponse,
    SignupRequest,
    SignupResponse,
    InvitationLinkRequest,
    InvitationLinkResponse,
    SwitchRoleRequest,
    SwitchRoleResponse,
    RoleInfo
)
from auth.utils import verify_password, create_access_token, get_current_user, validate_otp_contact, require_tenant_manager_or_platform
from auth.onboarding import resolve_tenant, validate_tenant_for_onboarding, generate_invitation_token
from models import User, Tenant, OtpToken, InvitationToken, Department, Wallet
from core.security import generate_verification_code, hash_token, verify_token_hash
from core.notifications import send_email_otp, send_sms_otp, NotificationError
from uuid import UUID

router = APIRouter()


def get_user_roles(org_role: str):
    """
    Determine the list of roles and default role based on org_role.
    
    Role hierarchy and inheritance:
    - tenant_manager: has tenant_manager + dept_lead + tenant_user
    - dept_lead: has dept_lead + tenant_user  
    - tenant_user: has tenant_user only
    - platform_admin: has platform_admin only
    """
    role_mapping = {
        'platform_admin': {
            'roles': 'platform_admin',
            'default_role': 'platform_admin'
        },
        'tenant_manager': {
            'roles': 'tenant_manager,dept_lead,tenant_user',
            'default_role': 'tenant_manager'
        },
        'dept_lead': {
            'roles': 'dept_lead,tenant_user',
            'default_role': 'dept_lead'
        },
        'tenant_user': {
            'roles': 'tenant_user',
            'default_role': 'tenant_user'
        }
        ,
        'sales_marketing': {
            'roles': 'sales_marketing,tenant_user',
            'default_role': 'sales_marketing'
        },
        'ai_copilot': {
            'roles': 'ai_copilot,tenant_user',
            'default_role': 'ai_copilot'
        }
    }
    
    return role_mapping.get(org_role, {
        'roles': org_role,
        'default_role': org_role
    })


@router.post("/login", response_model=LoginResponse)
async def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """Authenticate user and return JWT token.
    
    For multi-tenant SaaS: when tenant_slug or tenant_id is provided,
    the login is scoped to that tenant. Otherwise, the query searches
    across all tenants (backward compatible). If the email exists in
    multiple tenants and no slug/id is provided, returns an error
    asking the user to specify their organization.
    """
    # Build user query with optional tenant scoping
    query = db.query(User).filter(User.corporate_email == login_data.email)
    
    # Scope to tenant if provided
    if login_data.tenant_slug:
        tenant = db.query(Tenant).filter(Tenant.slug == login_data.tenant_slug).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found"
            )
        query = query.filter(User.tenant_id == tenant.id)
    elif login_data.tenant_id:
        query = query.filter(User.tenant_id == login_data.tenant_id)
    
    users = query.all()
    
    # If multiple users found across tenants and no tenant specified, require disambiguation
    if len(users) > 1 and not login_data.tenant_slug and not login_data.tenant_id:
        tenant_slugs = []
        for u in users:
            t = db.query(Tenant).filter(Tenant.id == u.tenant_id).first()
            if t:
                tenant_slugs.append({"slug": t.slug, "name": t.name})
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email exists in multiple organizations. Please specify your organization.",
            headers={"X-Tenants": str(tenant_slugs)}
        )
    
    user = users[0] if users else None
    
    if user:
        # If there's no stored password hash, treat as invalid credentials
        if not user.password_hash or not verify_password(login_data.password, user.password_hash):
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
        
        # If user is a system admin, return system token and role
        if user.system_admin:
            access_token = create_access_token(
                data={
                    "sub": str(user.system_admin.admin_id),
                    "user_id": str(user.id),
                    "email": user.corporate_email,
                    "org_role": "platform_admin",
                    "type": "system"
                },
                expires_delta=access_token_expires
            )
            return LoginResponse(
                access_token=access_token,
                token_type="bearer",
                user=UserResponse(
                    id=user.id,
                    tenant_id=user.tenant_id,
                    corporate_email=user.corporate_email,
                    first_name=user.first_name,
                    last_name=user.last_name,
                    org_role="platform_admin",
                    phone_number=user.phone_number,
                    mobile_number=user.mobile_number,
                    personal_email=user.personal_email,
                    department_id=user.department_id,
                    manager_id=user.manager_id,
                    avatar_url=user.avatar_url,
                    date_of_birth=user.date_of_birth,
                    hire_date=user.hire_date,
                    status=user.status,
                    created_at=user.created_at,
                    is_platform_admin=True
                )
            )

        # Regular tenant user login
        # Get tenant name
        tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
        tenant_name = tenant.name if tenant else None
        
        # Get roles based on org_role
        user_roles_config = get_user_roles(user.org_role)
        roles_str = user.roles or user_roles_config['roles']
        default_role = user.default_role or user_roles_config['default_role']
        
        access_token = create_access_token(
            data={
                "sub": str(user.id),
                "tenant_id": str(user.tenant_id),
                "email": user.corporate_email,
                "org_role": default_role,  # Use default role in token
                "roles": roles_str,  # Include all available roles
                "default_role": default_role,
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
                tenant_name=tenant_name,
                corporate_email=user.corporate_email,
                first_name=user.first_name,
                last_name=user.last_name,
                org_role=user.org_role,
                roles=roles_str,  # Include all available roles
                default_role=default_role,  # Include default role
                phone_number=user.phone_number,
                mobile_number=user.mobile_number,
                personal_email=user.personal_email,
                department_id=user.department_id,
                manager_id=user.manager_id,
                avatar_url=user.avatar_url,
                date_of_birth=user.date_of_birth,
                hire_date=user.hire_date,
                status=user.status,
                created_at=user.created_at,
                is_platform_admin=user.is_platform_admin
            )
        )

    # 3. Not found
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password",
        headers={"WWW-Authenticate": "Bearer"},
    )


@router.post("/system/login", response_model=SystemAdminLoginResponse)
async def system_login(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
):
    """Authenticate platform admin and return JWT token"""
    user = db.query(User).filter(
        (User.corporate_email == login_data.email)
    ).first()

    # Guard missing password_hash to avoid TypeErrors from passlib
    if not user or not user.system_admin or not user.password_hash or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user.system_admin.last_login_at = datetime.utcnow()
    db.commit()

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={
            "sub": str(user.system_admin.admin_id),
            "user_id": str(user.id),
            "email": user.corporate_email,
            "org_role": "platform_admin",
            "type": "system"
        },
        expires_delta=access_token_expires
    )

    return SystemAdminLoginResponse(
        access_token=access_token,
        token_type="bearer",
        admin=SystemAdminResponse.model_validate(user.system_admin)
    )


@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """OAuth2 compatible token endpoint"""
    user = db.query(User).filter(
        (User.corporate_email == form_data.username) | (User.personal_email == form_data.username)
    ).first()
    
    # Guard for missing password hash and invalid creds
    if not user or not user.password_hash or not verify_password(form_data.password, user.password_hash):
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
            "email": user.corporate_email,
            "org_role": user.org_role,
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
    # Get roles based on org_role and merge with any roles explicitly stored on the user record.
    user_roles_config = get_user_roles(current_user.org_role)
    db_roles = [r.strip() for r in (current_user.roles or '').split(',') if r.strip()]
    config_roles = [r.strip() for r in user_roles_config['roles'].split(',') if r.strip()]
    # Preserve config ordering, but include any extra roles present on the user record.
    if db_roles:
        merged = []
        for r in config_roles + db_roles:
            if r not in merged:
                merged.append(r)
        roles_str = ','.join(merged)
    else:
        roles_str = ','.join(config_roles)
    default_role = current_user.default_role or user_roles_config['default_role']
    
    return UserResponse(
        id=current_user.id,
        tenant_id=current_user.tenant_id,
        email=current_user.corporate_email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        org_role=current_user.org_role,
        roles=roles_str,  # Include all available roles
        default_role=default_role,  # Include default role
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
    if current_user.org_role != "platform_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Platform admin access required")

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    access_token_expires = timedelta(minutes=min(settings.access_token_expire_minutes, 30))
    access_token = create_access_token(
        data={
            "sub": str(current_user.id),
            "email": current_user.corporate_email,
            "org_role": "platform_admin",
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


@router.get("/roles", response_model=RoleInfo)
async def get_available_roles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get available roles for current user"""
    # Get roles based on org_role and merge with any stored user roles
    user_roles_config = get_user_roles(current_user.org_role)
    db_roles = [r.strip() for r in (current_user.roles or '').split(',') if r.strip()]
    config_roles = [r.strip() for r in user_roles_config['roles'].split(',') if r.strip()]
    if db_roles:
        merged = []
        for r in config_roles + db_roles:
            if r not in merged:
                merged.append(r)
        roles_str = ','.join(merged)
    else:
        roles_str = ','.join(config_roles)
    default_role = current_user.default_role or user_roles_config['default_role']

    available_roles = [r.strip() for r in roles_str.split(',') if r.strip()]
    
    # Get current role from JWT (stored in token as org_role, but we can infer it)
    # For now, use default_role as current
    current_role = default_role
    
    return RoleInfo(
        available_roles=available_roles,
        current_role=current_role,
        default_role=default_role
    )


@router.post("/switch-role", response_model=SwitchRoleResponse)
async def switch_role(
    request: SwitchRoleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Switch to a different role (must be one of user's available roles)"""
    # Get roles based on org_role and merge with any stored user roles
    user_roles_config = get_user_roles(current_user.org_role)
    db_roles = [r.strip() for r in (current_user.roles or '').split(',') if r.strip()]
    config_roles = [r.strip() for r in user_roles_config['roles'].split(',') if r.strip()]
    if db_roles:
        merged = []
        for r in config_roles + db_roles:
            if r not in merged:
                merged.append(r)
        roles_str = ','.join(merged)
    else:
        roles_str = ','.join(config_roles)

    available_roles = [r.strip() for r in roles_str.split(',') if r.strip()]
    
    # Check if requested role is available
    if request.role not in available_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role '{request.role}' is not available. Available roles: {', '.join(available_roles)}"
        )
    
    # Update the user's default_role in DB
    current_user.default_role = request.role
    db.commit()
    
    # Create new token with the switched role
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={
            "sub": str(current_user.id),
            "tenant_id": str(current_user.tenant_id),
            "email": current_user.corporate_email,
            "org_role": request.role,  # Use the new role
            "roles": roles_str,
            "default_role": request.role,
            "type": "tenant"
        },
        expires_delta=access_token_expires
    )
    # Build a full SwitchRoleResponse satisfying the response model fields.
    expires_at = datetime.utcnow() + access_token_expires
    # Try to resolve tenant name for the response (may be None for platform admins)
    tenant_name = None
    if current_user.tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
        if tenant:
            tenant_name = tenant.name

    return SwitchRoleResponse(
        access_token=access_token,
        token_type="bearer",
        current_role=request.role,
        available_roles=available_roles,
        expires_at=expires_at,
        join_url="",  # not applicable for role switch, keep empty
        tenant_id=current_user.tenant_id,
        tenant_name=tenant_name or "",
    )
async def request_email_otp(
    payload: EmailOtpRequest,
    db: Session = Depends(get_db)
):
    user = validate_otp_contact(db, email=payload.email, tenant_id=payload.tenant_id)
    code = generate_verification_code()
    try:
        await send_email_otp(payload.email, code)
    except NotificationError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
    token = OtpToken(
        tenant_id=user.tenant_id,
        user_id=user.id,
        channel="email",
        destination=payload.email,
        token_hash=hash_token(code),
        expires_at=datetime.utcnow() + timedelta(minutes=10)
    )
    db.add(token)
    db.commit()
    return OtpResponse(success=True, message="OTP sent to email")


@router.post("/otp/email/verify", response_model=OtpResponse)
async def verify_email_otp(
    payload: EmailOtpVerify,
    db: Session = Depends(get_db)
):
    user = validate_otp_contact(db, email=payload.email, tenant_id=payload.tenant_id)
    token = db.query(OtpToken).filter(
        OtpToken.user_id == user.id,
        OtpToken.channel == "email",
        OtpToken.destination == payload.email,
        OtpToken.used_at.is_(None),
        OtpToken.expires_at > datetime.utcnow()
    ).order_by(OtpToken.created_at.desc()).first()

    if not token or not verify_token_hash(payload.code, token.token_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP")

    token.used_at = datetime.utcnow()
    db.commit()
    return OtpResponse(success=True, message="OTP verified")


@router.post("/otp/sms/request", response_model=OtpResponse)
async def request_sms_otp(
    payload: SmsOtpRequest,
    db: Session = Depends(get_db)
):
    user = validate_otp_contact(db, mobile_number=payload.mobile_number, tenant_id=payload.tenant_id)
    code = generate_verification_code()
    try:
        await send_sms_otp(payload.mobile_number, code)
    except NotificationError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
    token = OtpToken(
        tenant_id=user.tenant_id,
        user_id=user.id,
        channel="sms",
        destination=payload.mobile_number,
        token_hash=hash_token(code),
        expires_at=datetime.utcnow() + timedelta(minutes=10)
    )
    db.add(token)
    db.commit()
    return OtpResponse(success=True, message="OTP sent to mobile")


@router.post("/otp/sms/verify", response_model=OtpResponse)
async def verify_sms_otp(
    payload: SmsOtpVerify,
    db: Session = Depends(get_db)
):
    user = validate_otp_contact(db, mobile_number=payload.mobile_number, tenant_id=payload.tenant_id)
    token = db.query(OtpToken).filter(
        OtpToken.user_id == user.id,
        OtpToken.channel == "sms",
        OtpToken.destination == payload.mobile_number,
        OtpToken.used_at.is_(None),
        OtpToken.expires_at > datetime.utcnow()
    ).order_by(OtpToken.created_at.desc()).first()

    if not token or not verify_token_hash(payload.code, token.token_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired OTP")

    token.used_at = datetime.utcnow()
    db.commit()
    return OtpResponse(success=True, message="OTP verified")

# =====================================================
# TENANT-USER MAPPING: ONBOARDING ENDPOINTS
# =====================================================

@router.post("/signup", response_model=SignupResponse)
async def signup(
    signup_data: SignupRequest,
    db: Session = Depends(get_db)
):
    """
    User self-registration with automatic tenant resolution.
    
    Implements the "Hard Link" concept from the architecture spec:
    1. Resolve tenant via domain-match or invitation token
    2. Validate tenant eligibility
    3. Create user with mandatory tenant_id
    4. Initialize user wallet
    5. Return JWT with tenant_id embedded
    
    Onboarding Methods:
    - Domain-Match: Email domain automatically matched to tenant whitelist
    - Invite-Link: Email validated against secure invitation token
    
    Request Examples:
    
    Domain-Match Registration:
        POST /api/auth/signup
        {
            "email": "john@triton.com",
            "password": "SecurePassword123!",
            "first_name": "John",
            "last_name": "Doe",
            "mobile_number": "+1234567890"
        }
    
    Invite-Link Registration:
        POST /api/auth/signup
        {
            "email": "jane@example.com",
            "password": "SecurePassword456!",
            "first_name": "Jane",
            "last_name": "Smith",
            "invitation_token": "secure_token_from_join_link"
        }
    """
    # Normalize email
    email = signup_data.email.lower()
    
    # Check if user already exists
    existing_user = db.query(User).filter(User.corporate_email == email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )
    
    # Step 1: Resolve tenant using one of the two methods
    try:
        tenant_id, resolution_method = resolve_tenant(
            db=db,
            email=email,
            invitation_token=signup_data.invitation_token
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    # If no tenant could be resolved
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No associated organization found for this email. Please request an invitation from your organization or contact support."
        )
    
    # Step 2: Validate tenant for onboarding
    try:
        validate_tenant_for_onboarding(db, tenant_id)
    except HTTPException as e:
        raise e
    
    # Fetch tenant details
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    
    # Step 3: Find or create default department
    # For new users via signup, assign to a default department
    # (Usually determined by the tenant's HR admin or defaults to first available)
    default_department = db.query(Department).filter(
        Department.tenant_id == tenant_id
    ).first()
    
    if not default_department:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Organization has no departments configured. Contact your administrator."
        )
    
    # Step 4: Create user with tenant_id (the "Magic Link")
    from auth.utils import get_password_hash
    
    user = User(
        tenant_id=tenant_id,  # THE CRITICAL LINK
        corporate_email=email,
        personal_email=signup_data.personal_email or None,
        password_hash=get_password_hash(signup_data.password),
        first_name=signup_data.first_name,
        last_name=signup_data.last_name,
        org_role="tenant_user",  # Default role for self-registered users
        department_id=default_department.id,
        mobile_number=signup_data.mobile_number or None,
        status="ACTIVE",  # Auto-approve signups
        invitation_sent_at=None  # Not invited, self-registered
    )
    
    db.add(user)
    db.flush()  # Generate user ID without committing
    
    # Step 5: Initialize user wallet with 0 balance
    wallet = Wallet(
        tenant_id=tenant_id,
        user_id=user.id,
        balance=0
    )
    db.add(wallet)
    db.commit()
    db.refresh(user)
    
    # Mark invitation token as used if one was provided
    if signup_data.invitation_token and resolution_method == "token":
        invitation = db.query(InvitationToken).filter(
            InvitationToken.token == signup_data.invitation_token,
            InvitationToken.email == email
        ).first()
        if invitation:
            invitation.is_used = True
            invitation.used_at = datetime.utcnow()
            invitation.used_by_user_id = user.id
            db.commit()
    
    # Step 6: Generate JWT with tenant_id included (Security)
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "tenant_id": str(tenant_id),  # Embed tenant_id in JWT
            "email": user.corporate_email,
            "org_role": user.org_role,
            "type": "tenant"
        },
        expires_delta=access_token_expires
    )
    
    return SignupResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            tenant_id=user.tenant_id,
            corporate_email=user.corporate_email,
            personal_email=user.personal_email,
            first_name=user.first_name,
            last_name=user.last_name,
            org_role=user.org_role,
            mobile_number=user.mobile_number,
            department_id=user.department_id,
            status=user.status,
            created_at=user.created_at,
            is_platform_admin=False
        ),
        tenant_name=tenant.name,
        resolution_method=resolution_method
    )


@router.post("/invitations/generate", response_model=InvitationLinkResponse)
async def generate_invitation_link(
    invitation_data: InvitationLinkRequest,
    current_user: User = Depends(require_tenant_manager_or_platform),
    db: Session = Depends(get_db)
):
    """
    Generate a secure invitation link for inviting new users to the organization.
    
    Accessible by: Tenant Manager or Platform Admin (when impersonating)
    
    The generated link should be sent to the invitee's email. When they visit
    the link and sign up, the system will automatically assign them to your organization.
    
    Response:
        - token: Secure token to embed in join URL
        - join_url: Full URL for email invitation (e.g., app.sparknode.io/signup?token=XXX&email=YYY)
        - expires_at: When the token expires
        - tenant_id: Tenant ID for validation
    
    Note: The token is email-specific and one-time use only.
    """
    # Access controlled by dependency (tenant_manager or platform_admin)
    
    # Validate expiration hours
    if invitation_data.expires_hours < 1 or invitation_data.expires_hours > 720:  # Max 30 days
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Expiration must be between 1 and 720 hours"
        )
    
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found"
        )
    
    # Check if email is already registered
    existing_user = db.query(User).filter(
        User.corporate_email == invitation_data.email.lower()
    ).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email is already registered"
        )
    
    # Generate invitation token
    try:
        token = generate_invitation_token(
            db=db,
            tenant_id=current_user.tenant_id,
            email=invitation_data.email.lower(),
            expires_hours=invitation_data.expires_hours
        )
    except HTTPException as e:
        raise e
    
    # Get expiration time
    invitation = db.query(InvitationToken).filter(
        InvitationToken.token == token
    ).first()
    
    # Construct join URL
    base_url = getattr(settings, "frontend_url", None) or "http://localhost:5173"
    join_url = f"{base_url}/signup?token={token}&email={invitation_data.email}"
    
    return InvitationLinkResponse(
        token=token,
        email=invitation_data.email,
        expires_at=invitation.expires_at,
        join_url=join_url,
        tenant_id=current_user.tenant_id,
        tenant_name=tenant.name
    )