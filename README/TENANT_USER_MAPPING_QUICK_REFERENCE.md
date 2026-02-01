# Tenant-User Mapping: Quick Reference

## Overview
Every user has a **mandatory `tenant_id`** that establishes the critical link to their organization. This ensures complete tenant isolation and prevents cross-tenant access.

---

## Key Files

| File | Changes |
|------|---------|
| `backend/models.py` | Added `InvitationToken` model |
| `backend/auth/onboarding.py` | NEW - Tenant resolution logic |
| `backend/auth/routes.py` | Added `POST /auth/signup`, `POST /auth/invitations/generate` |
| `backend/auth/schemas.py` | Added signup request/response schemas |
| `backend/users/routes.py` | Updated GET users with tenant filtering, added platform admin endpoint |
| `backend/migrate_tenant_user_mapping.py` | NEW - Database migration script |
| `database/init.sql` | Already has `invitation_tokens` table definition |
| `frontend/src/pages/Signup.jsx` | NEW - User signup page |
| `frontend/src/lib/api.js` | Added signup and invitation endpoints |
| `frontend/src/App.jsx` | Added `/signup` route |

---

## API Endpoints

### Authentication

```bash
# User Signup (with automatic tenant resolution)
POST /api/auth/signup
{
  "email": "user@company.com",
  "password": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe",
  "personal_email": "optional@personal.com",
  "mobile_number": "+1234567890",
  "invitation_token": "optional_token"
}

# Generate Invitation Link (HR Admin only)
POST /api/auth/invitations/generate
{
  "email": "newuser@external.com",
  "expires_hours": 24
}
```

### Users (Tenant-Aware)

```bash
# List users (current tenant)
GET /api/users

# List users (Platform Admin - specific tenant)
GET /api/users?tenant_id=550e8400-e29b-41d4-a716-446655440000

# Platform Admin endpoint
GET /api/users/tenant/550e8400-e29b-41d4-a716-446655440000/users
```

---

## Onboarding Methods

### 1. Domain-Match Auto-Onboarding

**Setup:**
```python
# Configure tenant's domain whitelist in database
tenant.domain_whitelist = ["@company.com", "@subsidiary.com"]
```

**User Flow:**
1. User signs up with `john@company.com`
2. System matches domain: `company.com`
3. Finds matching tenant
4. Auto-enrolls user
5. Creates wallet with 0 balance

**Frontend:**
- Navigate to `/signup`
- Enter work email
- System shows "Organization detected"
- Fill remaining fields and submit

### 2. Invite-Link Method

**Setup:**
```python
# HR Admin generates invite link
POST /api/auth/invitations/generate
{
  "email": "jane@external.com",
  "expires_hours": 24
}
# Returns: join_url = "https://app.sparknode.io/signup?token=ABC123&email=jane@external.com"
```

**User Flow:**
1. HR Admin sends invite link via email
2. User clicks link
3. Signup form pre-fills email (read-only)
4. Shows "Invitation accepted" message
5. User completes profile and submits
6. Token is validated and marked as used
7. User auto-enrolled in tenant

**Frontend:**
- User clicks email link
- Auto-navigates to `/signup?token=ABC123&email=jane@external.com`
- Email field pre-filled and disabled
- User fills remaining fields
- System validates token on submit

---

## Database Migration

**Before deploying, run:**

```bash
cd backend
python migrate_tenant_user_mapping.py
```

**What it does:**
1. Creates `invitation_tokens` table
2. Verifies all users have non-NULL `tenant_id`
3. Checks foreign key integrity
4. Assigns orphaned users to default tenant (if any)
5. Validates system state

**Output shows:**
```
✓ All users have non-NULL tenant_id
✓ All user tenant_id references are valid
✓ InvitationToken table ready
✓ MIGRATION SUCCESSFUL
```

---

## Security

### The "Hard Link"

```python
# User MUST have tenant_id
class User(Base):
    tenant_id = Column(UUID, ForeignKey("tenants.id"), nullable=False)  # ← NOT NULL!
```

### Tenant in JWT

```python
# Every JWT includes tenant_id
{
  "sub": "user-uuid",
  "tenant_id": "tenant-uuid",     # ← Cannot spoof
  "email": "user@company.com",
  "org_role": "corporate_user",
  "exp": 1234567890
}
```

### Automatic Query Filtering

```python
# All queries automatically scoped to tenant:
users = db.query(User).filter(User.department_id == dept_id).all()
# → Implicitly: SELECT * FROM users WHERE department_id = ? AND tenant_id = current_user.tenant_id
```

### Platform Admin Access Control

```python
# Platform admins can view any tenant's users
if current_user.is_platform_admin:
    users = db.query(User).filter(User.tenant_id == requested_tenant_id).all()  # ✓ Allowed
else:
    if requested_tenant_id != current_user.tenant_id:
        raise HTTPException(403, "Forbidden")  # ✓ Blocked
```

---

## Testing

### Domain-Match Signup

```bash
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@triton.com",
    "password": "SecurePass123!",
    "first_name": "John",
    "last_name": "Doe"
  }'

# Response:
# {
#   "access_token": "eyJ0eXAi...",
#   "tenant_name": "Triton Energy",
#   "resolution_method": "domain"
# }
```

### Invite-Link Signup

```bash
# Step 1: Generate invite
curl -X POST http://localhost:8000/api/auth/invitations/generate \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane@external.com",
    "expires_hours": 24
  }'

# Response:
# {
#   "token": "XyZ_secure_token...",
#   "join_url": "https://app.sparknode.io/signup?token=XyZ&email=jane@external.com",
#   "expires_at": "2026-02-02T10:00:00Z"
# }

# Step 2: User clicks join_url, then signs up with token
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane@external.com",
    "password": "SecurePass456!",
    "first_name": "Jane",
    "last_name": "Smith",
    "invitation_token": "XyZ_secure_token..."
  }'

# Response:
# {
#   "access_token": "eyJ0eXAi...",
#   "tenant_name": "Triton Energy",
#   "resolution_method": "token"
# }
```

### Platform Admin View

```bash
# Get all users in a tenant
curl -X GET "http://localhost:8000/api/users/tenant/550e8400-e29b-41d4-a716-446655440000/users" \
  -H "Authorization: Bearer PLATFORM_ADMIN_TOKEN"

# With filters
curl -X GET "http://localhost:8000/api/users/tenant/550e8400-e29b-41d4-a716-446655440000/users?role=hr_admin&status=ACTIVE" \
  -H "Authorization: Bearer PLATFORM_ADMIN_TOKEN"
```

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "No associated organization found" | Check tenant's `domain_whitelist` or provide invitation token |
| "Organization subscription not active" | Contact billing or reactivate tenant in admin |
| "User limit exceeded" | Upgrade subscription or remove deactivated users |
| Signup creates user but no wallet | Run migration script - ensures wallet initialization |
| JWT doesn't include tenant_id | Verify using `jwt.decode(token)` - if missing, redeploy |
| Cross-tenant access not blocked | Check `TenantScopedQuery` is active in all routes |

---

## Configuration

### Tenant Domain Whitelist

```python
# Set via database or admin panel:
tenant.domain_whitelist = [
    "@main-company.com",
    "@subsidiary-a.com",
    "@subsidiary-b.com"
]

# Users with emails matching any domain auto-enroll
# john@main-company.com  ✓ Enrolled
# jane@subsidiary-a.com  ✓ Enrolled
# bob@external.com       ✗ Not enrolled (needs invite)
```

### Invitation Token Expiration

```python
# Default: 24 hours
token = generate_invitation_token(db, tenant_id, email)

# Custom: 72 hours
token = generate_invitation_token(db, tenant_id, email, expires_hours=72)

# Max: 30 days (720 hours)
token = generate_invitation_token(db, tenant_id, email, expires_hours=720)
```

---

## Deployment Steps

1. **Backup Database**
   ```bash
   pg_dump sparknode > backup.sql
   ```

2. **Run Migration**
   ```bash
   python backend/migrate_tenant_user_mapping.py
   ```

3. **Deploy Backend**
   - Restart FastAPI server
   - Verify new endpoints are available

4. **Deploy Frontend**
   - Build and deploy React app
   - Verify `/signup` page loads

5. **Configure Tenants**
   - Set `domain_whitelist` for each tenant
   - Test domain-match signup

6. **Test Signup Flows**
   - Domain-match: Sign up with company email
   - Invite-link: Generate and test invite links

7. **Train Team**
   - HR admins: How to generate invite links
   - Managers: How to view team members

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                    User Signup Flow                  │
└─────────────────────────────────────────────────────┘

        ┌──────────────────┐
        │  User navigates  │
        │  to /signup      │
        └────────┬─────────┘
                 │
        ┌────────▼──────────┐
        │  Enters email &   │
        │  password         │
        └────────┬──────────┘
                 │
    ┌────────────┴────────────┐
    │                         │
    ▼                         ▼
┌──────────────┐     ┌──────────────┐
│   Domain     │     │  Invitation  │
│   Match      │     │   Token      │
│   Check      │     │   (from URL) │
└──────┬───────┘     └──────┬───────┘
       │                    │
       ▼                    ▼
  ┌─────────────────────────────┐
  │  POST /api/auth/signup      │
  │  with/without token         │
  └──────────┬──────────────────┘
             │
             ▼
  ┌─────────────────────────────┐
  │  resolve_tenant()           │
  │  1. Try token (if provided) │
  │  2. Try domain (if present) │
  └──────────┬──────────────────┘
             │
             ▼
  ┌─────────────────────────────┐
  │  Validate tenant:           │
  │  - Status = active          │
  │  - Subscription = active    │
  │  - Not over user limit      │
  └──────────┬──────────────────┘
             │
             ▼
  ┌─────────────────────────────┐
  │  Create User:               │
  │  - Set tenant_id (CRITICAL) │
  │  - Set department           │
  │  - Hash password            │
  │  - Create wallet (0 balance)│
  └──────────┬──────────────────┘
             │
             ▼
  ┌─────────────────────────────┐
  │  Generate JWT:              │
  │  - Include tenant_id        │
  │  - Include user_id          │
  │  - Sign with secret_key     │
  └──────────┬──────────────────┘
             │
             ▼
  ┌─────────────────────────────┐
  │  Return SignupResponse:     │
  │  - access_token             │
  │  - user info                │
  │  - tenant_name              │
  │  - resolution_method        │
  └──────────┬──────────────────┘
             │
             ▼
        ┌────────────┐
        │ User logged│
        │ in & ready │
        └────────────┘
```

---

## Monitoring

### Queries to Check System Health

```sql
-- All users have tenant_id?
SELECT COUNT(*) FROM users WHERE tenant_id IS NULL;  -- Should be 0

-- Foreign key integrity?
SELECT COUNT(*) FROM users u 
LEFT JOIN tenants t ON u.tenant_id = t.id 
WHERE u.tenant_id IS NOT NULL AND t.id IS NULL;  -- Should be 0

-- Expired invitation tokens?
SELECT COUNT(*) FROM invitation_tokens 
WHERE is_used = FALSE AND expires_at < NOW();

-- Users per tenant?
SELECT tenant_id, COUNT(*) as user_count 
FROM users 
GROUP BY tenant_id 
ORDER BY user_count DESC;

-- Active subscription tenants?
SELECT COUNT(*) FROM tenants 
WHERE status = 'active' AND subscription_status = 'active';
```

---

## Additional Resources

- **Full Documentation:** [TENANT_USER_MAPPING_GUIDE.md](./TENANT_USER_MAPPING_GUIDE.md)
- **Architecture Details:** [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- **API Reference:** Backend routes in `backend/auth/routes.py`, `backend/users/routes.py`
- **Frontend Components:** `frontend/src/pages/Signup.jsx`
- **Database Schema:** `database/init.sql`

---

## Support

For questions or issues:
1. Check inline code comments in [backend/auth/onboarding.py](./backend/auth/onboarding.py)
2. Review test cases in [backend/tests/](./backend/tests/)
3. Check API response codes and error messages
4. Run migration validation script
5. Contact the platform engineering team
