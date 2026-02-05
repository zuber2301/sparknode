# Fix: 403 Forbidden Error on GET /api/tenants/departments

## Issue
Frontend was receiving **403 Forbidden** error when trying to fetch departments:
```
GET http://localhost:7100/api/tenants/departments 403 (Forbidden)
Error: "Tenant access denied: Insufficient permissions to access other tenants' departments"
```

## Root Cause
The frontend API interceptor automatically adds `X-Tenant-ID` header to all tenant-specific API calls. The backend `get_departments` endpoint was incorrectly treating ANY header-provided tenant_id as a cross-tenant access attempt, requiring platform_admin privileges.

### Problem Flow
1. Frontend calls `getDepartments()` without explicit header
2. API interceptor auto-adds `X-Tenant-ID: {user's-tenant-id}`
3. Backend checks: "Is header provided?" → YES
4. Backend checks: "Is user platform_admin?" → NO (user is tenant_manager)
5. Backend rejects with 403

## Solution
Updated authorization logic in `/backend/tenants/routes.py` `get_departments` endpoint to:

**OLD Logic:**
```python
if header_tenant:
    # Only permit overrides for platform-level users
    if not (current_user.is_platform_admin or current_user.is_super_admin):
        raise HTTPException(status_code=403, ...)
```

**NEW Logic:**
```python
if header_tenant:
    # Users can access their own tenant's departments
    # Platform admins can access any tenant's departments
    if tenant_id != current_user.tenant_id:
        if not (current_user.is_platform_admin or current_user.is_super_admin):
            raise HTTPException(status_code=403, ...)
```

### Key Change
- Allow users to access departments for their OWN tenant_id
- Only require platform_admin privilege when accessing OTHER tenants
- This aligns with the automatic header behavior from the frontend

## Affected Endpoints
- ✅ `GET /api/tenants/departments` - Now works for all authenticated users

## Who Can Access
| User Role | Own Tenant | Other Tenants |
|-----------|-----------|---------------|
| corporate_user | ✅ YES | ❌ NO |
| dept_lead | ✅ YES | ❌ NO |
| tenant_manager | ✅ YES | ❌ NO |
| hr_admin | ✅ YES | ❌ NO |
| platform_admin | ✅ YES | ✅ YES |
| super_admin | ✅ YES | ✅ YES |

## Impact
✅ Tenant managers can now allocate budgets to departments
✅ All non-platform users can view their tenant's departments
✅ No breaking changes to authorization model
✅ Maintains tenant isolation for cross-tenant access

## Testing
```bash
# Verify the fix works for tenant_manager
curl -X GET http://localhost:8000/api/tenants/departments \
  -H "Authorization: Bearer {tenant_manager_token}" \
  -H "X-Tenant-ID: {their-tenant-id}"

# Should return 200 with departments list
```

## Files Modified
- `/backend/tenants/routes.py` - Updated authorization check in get_departments endpoint

## Related Workflow
This fix enables the budget allocation workflow where:
1. Tenant manager fetches their departments
2. Allocates budget to their departments
3. Allocates budget to department leads
4. Department leads distribute budget to team

---

**Status:** ✅ FIXED - 403 error resolved, departments endpoint now accessible
