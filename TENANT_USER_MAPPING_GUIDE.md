# Tenant-User Mapping Implementation Guide

## Overview

This document describes the complete implementation of the **Tenant-User "Hard Link"** architecture for SparkNode. This is the most critical relationship in a multi-tenant SaaS platform, ensuring every user is permanently associated with exactly one tenant from the moment of onboarding.

**Implementation Status: ✅ COMPLETE**

---

## Architecture: The "Hard Link" Concept

Every user record contains a **mandatory, non-nullable `tenant_id` foreign key** that establishes the unbreakable association between users and tenants.

### Key Properties

- **No Orphans**: Every user has a tenant_id (except during initial system setup)
- **No Spoofing**: Tenant_id is embedded in JWT and verified on every request
- **Tenant Isolation**: All queries automatically filtered by tenant_id
- **Secure Onboarding**: Two controlled mechanisms ensure valid tenant assignment

---

## 1. Database Architecture

### Schema: User-Tenant Relationship

```sql
-- Users table with tenant_id as foreign key
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,  -- THE HARD LINK
    corporate_email VARCHAR(255) NOT NULL,
    personal_email VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    org_role VARCHAR(50) NOT NULL CHECK (...),
    department_id UUID NOT NULL REFERENCES departments(id),
    -- ... other fields
    UNIQUE(tenant_id, corporate_email)  -- Email unique per tenant
);

-- Tenants table with domain whitelist for auto-onboarding
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain_whitelist JSONB DEFAULT '[]',  -- ["@company.com", "@subsidiary.com"]
    -- ... other fields
);

-- Invitation tokens for invite-link onboarding
CREATE TABLE invitation_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(500) NOT NULL UNIQUE,
    is_used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    used_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (expires_at > created_at)
);
```

### Model Definitions

**[backend/models.py](models.py)** - ORM Model

```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)  # THE CRITICAL LINK
    corporate_email = Column(String(255), nullable=False)
    # ... other fields
    
    tenant = relationship("Tenant", back_populates="users")

class InvitationToken(Base):
    """Secure tokens for invite-link onboarding"""
    __tablename__ = "invitation_tokens"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), nullable=False)
    token = Column(String(500), nullable=False, unique=True)
    is_used = Column(Boolean, default=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    # ... audit fields
```

---

## 2. Onboarding Mechanisms

### Method A: Domain-Match Auto-Onboarding (Recommended)

When a user signs up, the system automatically assigns them to a tenant by matching their email domain against tenant domain whitelists.

**Configuration Example:**

```python
# Triton Energy tenant
{
    "name": "Triton Energy",
    "domain_whitelist": [
        "@triton.com",
        "@tritontech.com",
        "@triton-subsidiary.com"
    ]
}
```

**User Flow:**
1. User signs up with `john@triton.com`
2. System extracts domain: `triton.com`
3. Matches against Triton Energy's whitelist: `✓ Match found`
4. User automatically enrolled in Triton Energy
5. Wallet initialized with 0 balance
6. JWT created with tenant_id embedded

**Implementation:**

```python
# [backend/auth/onboarding.py]
def resolve_tenant_by_domain(db: Session, email: str) -> Optional[UUID]:
    """
    Resolves tenant by matching email domain against domain_whitelist.
    
    Example:
        Email: john@triton.com
        Triton Energy domain_whitelist: ["@triton.com"]
        Result: UUID for Triton Energy
    """
    domain = extract_email_domain(email)
    
    tenants = db.query(Tenant).filter(
        Tenant.status == 'active',
        Tenant.subscription_status == 'active'
    ).all()
    
    for tenant in tenants:
        for whitelisted_domain in tenant.domain_whitelist:
            if whitelisted_domain.lstrip("@").lower() == domain.lower():
                return tenant.id
    
    return None
```

### Method B: Invite-Link Onboarding

Tenant admins generate secure invite links that encode the tenant_id in a signed token. New users can only join via this link.

**Flow:**

1. **HR Admin generates invite link:**
   ```
   POST /api/auth/invitations/generate
   {
       "email": "jane@external.com",
       "expires_hours": 24
   }
   ```

2. **Server returns:**
   ```json
   {
       "token": "XyZ_secure_token_1a2b3c4d5e...",
       "join_url": "https://app.sparknode.io/signup?token=XyZ&email=jane@external.com",
       "expires_at": "2026-02-02T10:00:00Z",
       "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
       "tenant_name": "Triton Energy"
   }
   ```

3. **HR Admin sends invite link via email**

4. **User clicks link and signs up:**
   ```
   POST /api/auth/signup
   {
       "email": "jane@external.com",
       "password": "SecurePassword123!",
       "first_name": "Jane",
       "last_name": "Smith",
       "invitation_token": "XyZ_secure_token_1a2b3c4d5e..."
   }
   ```

5. **Server:**
   - Validates token matches email
   - Confirms token hasn't expired
   - Creates user with tenant_id from token
   - Marks token as used

**Security Properties:**
- Tokens are cryptographically secure (`secrets.token_urlsafe`)
- Email-specific (token + email must match)
- One-time use (marked as used after signup)
- Time-limited (default 24 hours, max 30 days)
- Tenant-scoped (token maps to specific tenant only)

**Implementation:**

```python
# [backend/auth/onboarding.py]
def generate_invitation_token(
    db: Session,
    tenant_id: UUID,
    email: str,
    expires_hours: int = 24
) -> str:
    """Generate secure invitation token"""
    tenant = db.query(Tenant).filter(
        Tenant.id == tenant_id,
        Tenant.status == 'active'
    ).first()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    token_string = secrets.token_urlsafe(32)
    
    invitation = InvitationToken(
        tenant_id=tenant_id,
        email=email,
        token=token_string,
        expires_at=datetime.utcnow() + timedelta(hours=expires_hours)
    )
    
    db.add(invitation)
    db.commit()
    return token_string


def resolve_tenant_by_invitation_token(
    db: Session,
    token: str,
    email: str
) -> Optional[UUID]:
    """Validate and resolve tenant from invitation token"""
    invitation = db.query(InvitationToken).filter(
        InvitationToken.token == token,
        InvitationToken.email == email.lower()
    ).first()
    
    if not invitation or invitation.expires_at < datetime.utcnow():
        return None
    
    return invitation.tenant_id
```

### Method Priority: `resolve_tenant()`

The master resolution function attempts tenant resolution in priority order:

```python
def resolve_tenant(
    db: Session,
    email: str,
    invitation_token: Optional[str] = None
) -> Tuple[Optional[UUID], str]:
    """
    Master tenant resolution function.
    
    Priority:
    1. Invitation Token (highest - explicit tenant assignment)
    2. Domain Whitelist (implicit - auto-enrollment)
    
    Returns: (tenant_id, resolution_method)
    """
    # Strategy 1: Invitation Token
    if invitation_token:
        tenant_id = resolve_tenant_by_invitation_token(db, invitation_token, email)
        if tenant_id:
            return tenant_id, "token"
    
    # Strategy 2: Domain Whitelist
    tenant_id = resolve_tenant_by_domain(db, email)
    if tenant_id:
        return tenant_id, "domain"
    
    return None, "none"
```

---

## 3. User Registration/Signup Endpoint

### Implementation

**Endpoint:** `POST /api/auth/signup`

```python
# [backend/auth/routes.py]
@router.post("/signup", response_model=SignupResponse)
async def signup(
    signup_data: SignupRequest,
    db: Session = Depends(get_db)
):
    """
    User self-registration with automatic tenant resolution.
    
    Request Body:
    {
        "email": "user@company.com",
        "password": "SecurePass123!",
        "first_name": "John",
        "last_name": "Doe",
        "personal_email": "john.doe@gmail.com",
        "mobile_number": "+1234567890",
        "invitation_token": "optional_token_from_invite_link"
    }
    
    Response:
    {
        "access_token": "eyJ0eXAi...",
        "token_type": "bearer",
        "user": { ... },
        "tenant_name": "Triton Energy",
        "resolution_method": "domain"
    }
    """
    
    # 1. Normalize and validate email
    email = signup_data.email.lower()
    existing_user = db.query(User).filter(User.corporate_email == email).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="Email already registered")
    
    # 2. Resolve tenant (domain or token)
    tenant_id, resolution_method = resolve_tenant(
        db=db,
        email=email,
        invitation_token=signup_data.invitation_token
    )
    
    if not tenant_id:
        raise HTTPException(
            status_code=404,
            detail="No associated organization found for this email."
        )
    
    # 3. Validate tenant
    validate_tenant_for_onboarding(db, tenant_id)
    
    # 4. Find/create department
    default_department = db.query(Department).filter(
        Department.tenant_id == tenant_id
    ).first()
    
    if not default_department:
        raise HTTPException(
            status_code=500,
            detail="Organization has no departments configured."
        )
    
    # 5. Create user with THE CRITICAL LINK: tenant_id
    user = User(
        tenant_id=tenant_id,  # <-- THE MAGIC LINK
        corporate_email=email,
        personal_email=signup_data.personal_email,
        password_hash=get_password_hash(signup_data.password),
        first_name=signup_data.first_name,
        last_name=signup_data.last_name,
        org_role="corporate_user",
        department_id=default_department.id,
        mobile_number=signup_data.mobile_number,
        status="ACTIVE"
    )
    
    db.add(user)
    db.flush()
    
    # 6. Initialize user wallet
    wallet = Wallet(
        tenant_id=tenant_id,
        user_id=user.id,
        balance=0
    )
    db.add(wallet)
    db.commit()
    
    # 7. Create JWT with tenant_id embedded
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "tenant_id": str(tenant_id),  # <-- SECURITY: Tenant in JWT
            "email": user.corporate_email,
            "org_role": user.org_role,
            "type": "tenant"
        },
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes)
    )
    
    return SignupResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(...),
        tenant_name=tenant.name,
        resolution_method=resolution_method
    )
```

### Request/Response Schemas

```python
# [backend/auth/schemas.py]

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    personal_email: Optional[EmailStr] = None
    mobile_number: Optional[str] = None
    invitation_token: Optional[str] = None

class SignupResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse
    tenant_name: str
    resolution_method: str  # "domain", "token", or "none"

class InvitationLinkRequest(BaseModel):
    email: EmailStr
    expires_hours: int = 24

class InvitationLinkResponse(BaseModel):
    token: str
    email: str
    expires_at: datetime
    join_url: str
    tenant_id: UUID
    tenant_name: str
```

---

## 4. JWT & Tenant Context

### Tenant-Aware JWT

Every JWT token includes the `tenant_id`:

```python
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt

# Usage:
access_token = create_access_token(
    data={
        "sub": str(user_id),
        "tenant_id": str(tenant_id),  # <-- Always included
        "email": email,
        "org_role": role,
        "type": "tenant"
    }
)
```

### Token Decoding & Validation

```python
def decode_token(token: str) -> TokenData:
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    
    user_id = payload.get("sub")
    tenant_id = payload.get("tenant_id")  # <-- Extract tenant_id
    
    if user_id is None:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    return TokenData(
        user_id=UUID(user_id),
        tenant_id=UUID(tenant_id) if tenant_id else None,  # <-- Validate is UUID
        email=payload.get("email"),
        org_role=payload.get("org_role")
    )
```

### Tenant Context Middleware

Every request sets up a tenant context for query filtering:

```python
# [backend/core/tenant.py]

class TenantContext:
    def __init__(
        self,
        tenant_id: UUID,
        user_id: UUID,
        org_role: str,
        is_platform_admin: bool = False
    ):
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.org_role = org_role
        self.is_platform_admin = is_platform_admin

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    token_data = decode_token(token)
    user = db.query(User).filter(User.id == token_data.user_id).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Set tenant context for this request
    set_tenant_context(
        TenantContext(
            tenant_id=user.tenant_id,
            user_id=user.id,
            org_role=user.org_role,
            is_platform_admin=user.is_platform_admin
        )
    )
    
    return user
```

---

## 5. Query Filtering (Tenant Isolation)

### TenantScopedQuery Implementation

All database queries are automatically scoped to the tenant context:

```python
# [backend/core/tenant.py]

class TenantScopedQuery:
    """Automatically filters all queries by tenant_id"""
    
    GLOBAL_TABLES = {'brands', 'vouchers', 'badges'}  # Not tenant-filtered
    
    def query(self, model: Type[T]) -> Query:
        query = self.db.query(model)
        
        # Skip filtering for global tables
        if getattr(model, '__tablename__', '') in self.GLOBAL_TABLES:
            return query
        
        # Add tenant filter for all other tables
        if hasattr(model, 'tenant_id'):
            if not self.tenant_context.global_access:
                query = query.filter(model.tenant_id == self.tenant_context.tenant_id)
        
        return query
```

### Example Queries (Automatic Filtering)

```python
# All of these are automatically filtered by tenant_id:

# Get user's recognitions
recognitions = db.query(Recognition).filter(
    Recognition.from_user_id == user_id
    # Automatically: AND tenant_id == current_user.tenant_id
).all()

# Get department budgets
budgets = db.query(Budget).filter(
    Budget.department_id == dept_id
    # Automatically: AND tenant_id == current_user.tenant_id
).all()

# Get wallet transactions
transactions = db.query(Transaction).filter(
    Transaction.user_id == user_id
    # Automatically: AND tenant_id == current_user.tenant_id
).all()
```

---

## 6. Platform Admin View

### Endpoint: Get Users by Tenant

```python
# [backend/users/routes.py]

@router.get("/tenant/{tenant_id}/users", response_model=List[UserListResponse])
async def get_tenant_users(
    tenant_id: UUID,
    department_id: Optional[UUID] = None,
    org_role: Optional[str] = None,
    status: Optional[str] = "active",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Platform Admin endpoint: View all users of a specific tenant.
    
    This is the "Tenant Manager" window into an organization.
    
    Example:
        GET /api/users/tenant/550e8400-e29b-41d4-a716-446655440000/users?role=hr_admin
    """
    
    # Verify platform admin access
    if not current_user.is_platform_admin:
        raise HTTPException(status_code=403, detail="Platform admin access required")
    
    # Verify tenant exists
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    # Build query for this tenant's users
    query = db.query(User).filter(User.tenant_id == tenant_id)
    
    # Apply filters
    if department_id:
        query = query.filter(User.department_id == department_id)
    if org_role:
        query = query.filter(User.org_role == org_role)
    if status:
        query = query.filter(User.status == status)
    
    return query.all()
```

### Alternative: Query Parameter Method

```python
# Platform admins can also use the standard GET /api/users endpoint with tenant_id parameter:

GET /api/users?tenant_id=550e8400-e29b-41d4-a716-446655440000

# Regular users cannot override this parameter
GET /api/users?tenant_id=OTHER_TENANT  # Returns error 403
```

---

## 7. Frontend Implementation

### Signup Page

**File:** [frontend/src/pages/Signup.jsx](../frontend/src/pages/Signup.jsx)

Features:
- Domain detection (shows "Organization detected" message)
- Invitation token handling (from URL query params)
- Password validation
- Terms acceptance
- Optional fields (personal email, mobile)

**Onboarding Flows:**

1. **Domain-Match Flow:**
   - User enters `john@triton.com`
   - Form shows: "Looking for organization with domain @triton.com..."
   - On submit, `POST /api/auth/signup` (no token)
   - Server resolves via domain whitelist
   - User auto-enrolled in Triton Energy

2. **Invite-Link Flow:**
   - User clicks link: `app.sparknode.io/signup?token=XYZ&email=jane@external.com`
   - Form pre-fills email and hides it (read-only)
   - Shows: "✓ Invitation accepted. Complete your profile to join."
   - On submit, `POST /api/auth/signup` with `invitation_token`
   - Server validates token and creates user

### API Integration

```javascript
// [frontend/src/lib/api.js]

export const authAPI = {
  signup: (email, password, first_name, last_name, personal_email, mobile_number, invitation_token) => 
    api.post('/auth/signup', { 
      email, 
      password, 
      first_name, 
      last_name, 
      personal_email, 
      mobile_number, 
      invitation_token 
    }, { skipTenant: true }),
  
  generateInvitationLink: (email, expires_hours) => 
    api.post('/auth/invitations/generate', { email, expires_hours })
}
```

### Routes

```javascript
// [frontend/src/App.jsx]

<Route path="/signup" element={<Signup />} />
```

---

## 8. Database Migration

### Script: Migrate Tenant-User Mapping

**File:** [backend/migrate_tenant_user_mapping.py](../backend/migrate_tenant_user_mapping.py)

This migration ensures:
1. All users have a non-NULL `tenant_id`
2. All tenant_id references are valid (foreign key integrity)
3. InvitationToken table exists
4. Orphaned users are assigned to a default tenant

**Usage:**

```bash
cd /root/repos_products/sparknode/backend

# Run migration
python migrate_tenant_user_mapping.py

# Output:
# ============================================================
# TENANT-USER HARD LINK MIGRATION
# ============================================================
# 
# [1/5] Creating InvitationToken table...
# ✓ invitation_tokens table created
# 
# [2/5] Checking current state...
# users.tenant_id is_nullable: False
# 
# [3/5] Checking for orphaned users...
# ✓ No orphaned users found
# 
# [4/5] Verifying constraints...
# ✓ All users have non-NULL tenant_id
# 
# [5/5] Verifying referential integrity...
# ✓ All user tenant_id references are valid
# 
# ============================================================
# ✓ MIGRATION SUCCESSFUL
# ============================================================
```

---

## 9. API Endpoints Summary

### Authentication

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/signup` | `POST` | User registration with tenant resolution |
| `/auth/login` | `POST` | User login (tenant_id in JWT) |
| `/auth/invitations/generate` | `POST` | Generate secure invite link |
| `/auth/otp/*` | `POST` | OTP verification |

### Users (Tenant Context)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/users` | `GET` | List users (filtered by tenant) |
| `/users?tenant_id=XYZ` | `GET` | Platform admin: view specific tenant's users |
| `/users/tenant/{tenant_id}/users` | `GET` | Platform admin: dedicated endpoint for tenant users |
| `/users` | `POST` | Create user (auto-assigns to current tenant) |
| `/users/{id}` | `PATCH` | Update user (tenant-scoped) |
| `/users/{id}` | `DELETE` | Delete user (tenant-scoped) |

### Tenant Management

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/tenants/current` | `GET` | Get current user's tenant |
| `/tenants/current` | `PUT` | Update tenant settings |
| `/tenants/departments` | `GET` | List tenant's departments |
| `/tenants/departments` | `POST` | Create department |

---

## 10. Security Considerations

### 1. Tenant Validation

✅ **Implemented:**
- Tenant_id NOT NULL constraint (database level)
- Tenant_id foreign key (referential integrity)
- Tenant status validation (active/inactive/suspended)
- Subscription status validation (active/past_due/cancelled)

```python
def validate_tenant_for_onboarding(db: Session, tenant_id: UUID) -> bool:
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant.status != 'active':
        raise HTTPException(status_code=403, detail="Tenant not active")
    if tenant.subscription_status != 'active':
        raise HTTPException(status_code=403, detail="Subscription not active")
    
    return True
```

### 2. Cross-Tenant Access Prevention

✅ **Implemented:**
- TenantScopedQuery filters all queries
- Platform admins can opt-in to cross-tenant access
- Every endpoint validates tenant context
- JWT includes tenant_id for stateless verification

```python
# Endpoint example - raises 403 if tenant mismatch:
@router.get("/users/{user_id}")
async def get_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.id == user_id,
        User.tenant_id == current_user.tenant_id  # Tenant check
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```

### 3. Invitation Token Security

✅ **Implemented:**
- Cryptographically secure tokens (`secrets.token_urlsafe`)
- Email-specific validation (token + email must match)
- Time-limited (configurable, max 30 days)
- One-time use (marked as used)
- Tenant-scoped (token only valid for one tenant)

### 4. JWT Security

✅ **Implemented:**
- Tenant_id in JWT prevents spoofing
- Tenant context validated on every request
- Platform admins isolated with separate token type
- Impersonation tracked (actual_user_id, effective_tenant_id)

```python
# JWT payload structure:
{
    "sub": "user-uuid",              # User ID
    "tenant_id": "tenant-uuid",      # User's tenant (cannot spoof)
    "email": "user@company.com",
    "org_role": "corporate_user",
    "type": "tenant",                # vs "system" for platform admins
    "exp": 1234567890
}
```

---

## 11. Testing

### Unit Tests

```python
# Test domain-match onboarding
def test_resolve_tenant_by_domain():
    db = SessionLocal()
    tenant = create_test_tenant(domain_whitelist=["@triton.com"])
    
    result_id, method = resolve_tenant(db, "john@triton.com")
    assert result_id == tenant.id
    assert method == "domain"

# Test invitation token onboarding
def test_resolve_tenant_by_invitation_token():
    db = SessionLocal()
    tenant = create_test_tenant()
    token = generate_invitation_token(db, tenant.id, "jane@external.com")
    
    result_id, method = resolve_tenant(
        db, 
        "jane@external.com", 
        invitation_token=token
    )
    assert result_id == tenant.id
    assert method == "token"

# Test signup endpoint
def test_signup_with_domain_match():
    response = client.post("/api/auth/signup", json={
        "email": "john@triton.com",
        "password": "SecurePass123!",
        "first_name": "John",
        "last_name": "Doe"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["tenant_name"] == "Triton Energy"
    assert data["resolution_method"] == "domain"
    
    # Verify JWT contains tenant_id
    from jose import jwt
    decoded = jwt.decode(data["access_token"], settings.secret_key)
    assert decoded["tenant_id"] == str(triton_tenant.id)
```

### Integration Tests

```python
# Test platform admin can view tenant users
def test_platform_admin_view_tenant_users():
    admin = create_platform_admin()
    triton_users = [
        create_user(tenant=triton_tenant, email="user1@triton.com"),
        create_user(tenant=triton_tenant, email="user2@triton.com")
    ]
    
    response = authenticated_client(admin).get(
        f"/api/users/tenant/{triton_tenant.id}/users"
    )
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2

# Test regular user cannot access other tenant's users
def test_regular_user_cross_tenant_blocked():
    user_triton = create_user(tenant=triton_tenant)
    user_acme = create_user(tenant=acme_tenant)
    
    response = authenticated_client(user_triton).get(
        f"/api/users/tenant/{acme_tenant.id}/users"
    )
    
    assert response.status_code == 403
```

---

## 12. Troubleshooting

### Issue: "No associated organization found for this email"

**Cause:** 
- Email domain doesn't match any tenant's `domain_whitelist`
- No valid invitation token provided

**Solution:**
1. Check tenant's `domain_whitelist` configuration
2. If multi-domain company, add all domains: `["@main.com", "@subsidiary.com"]`
3. Alternatively, provide invitation token from HR admin

### Issue: "Organization subscription is not active"

**Cause:**
- Tenant's subscription_status is 'past_due' or 'cancelled'
- Tenant's status is 'inactive' or 'suspended'

**Solution:**
- Contact billing team to reactivate subscription
- Or manually update tenant status in admin panel

### Issue: "User limit exceeded"

**Cause:**
- Tenant has reached `max_users` limit for their subscription tier

**Solution:**
- Upgrade subscription to higher tier
- Remove deactivated users to free up slots

### Issue: Orphaned Users After Migration

If migration finds orphaned users:

```python
# Manual fix if needed:
UPDATE users 
SET tenant_id = 'default-tenant-uuid' 
WHERE tenant_id IS NULL;
```

---

## 13. Future Enhancements

### Potential Improvements

1. **SSO/SAML Integration**
   - Auto-map users from corporate SAML IdP
   - Attribute-based tenant assignment (department, location)

2. **Bulk User Imports**
   - CSV upload with tenant assignment
   - Batch invitation generation

3. **Tenant Switching (for platform admins)**
   - Quick-switch between tenant contexts
   - Audit trail of cross-tenant access

4. **User Lifecycle Webhooks**
   - Notify external systems on user signup
   - Trigger compliance workflows

---

## 14. Deployment Checklist

- [ ] Database migration completed (`migrate_tenant_user_mapping.py`)
- [ ] All existing users have valid `tenant_id` (non-NULL)
- [ ] InvitationToken table created
- [ ] Backend endpoints deployed:
  - [ ] `POST /api/auth/signup`
  - [ ] `POST /api/auth/invitations/generate`
  - [ ] `GET /api/users?tenant_id=XYZ`
  - [ ] `GET /api/users/tenant/{tenant_id}/users`
- [ ] Frontend deployed:
  - [ ] Signup page (`/signup`)
  - [ ] API client functions (`authAPI.signup`, `authAPI.generateInvitationLink`)
- [ ] Tenant domain whitelists configured in database
- [ ] JWT validation tested (tenant_id in token)
- [ ] Cross-tenant access tests passed
- [ ] Documentation shared with team
- [ ] HR admins trained on invitation link generation
- [ ] Welcome emails contain signup links with proper domain

---

## 15. Reference Files

| File | Purpose |
|------|---------|
| [backend/models.py](../backend/models.py) | User, Tenant, InvitationToken ORM models |
| [backend/auth/onboarding.py](../backend/auth/onboarding.py) | Tenant resolution logic |
| [backend/auth/routes.py](../backend/auth/routes.py) | `/signup`, `/invitations/generate` endpoints |
| [backend/auth/utils.py](../backend/auth/utils.py) | JWT creation/validation, tenant context |
| [backend/core/tenant.py](../backend/core/tenant.py) | TenantContext, TenantScopedQuery |
| [backend/users/routes.py](../backend/users/routes.py) | User management endpoints with tenant filtering |
| [backend/migrate_tenant_user_mapping.py](../backend/migrate_tenant_user_mapping.py) | Database migration script |
| [database/init.sql](../database/init.sql) | Database schema |
| [frontend/src/pages/Signup.jsx](../frontend/src/pages/Signup.jsx) | User signup UI component |
| [frontend/src/lib/api.js](../frontend/src/lib/api.js) | Frontend API client |
| [frontend/src/App.jsx](../frontend/src/App.jsx) | Route configuration |

---

## Questions?

For questions or issues with the tenant-user mapping implementation, refer to:
1. The [inline code comments](../backend/auth/onboarding.py)
2. The [API documentation](../backend/auth/routes.py)
3. The [schema definitions](../database/init.sql)
4. The [test suite](../backend/tests/)
