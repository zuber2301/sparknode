# Role-Based Separation - Testing & Verification Guide

## Pre-Testing Checklist

- [x] Frontend builds successfully (verified)
- [ ] Backend migrations applied to database
- [ ] Docker containers restarted
- [ ] Database migration for `roles` and `default_role` columns executed
- [ ] Test users created with different roles

---

## Test Scenarios

### Scenario 1: Platform Admin Dashboard

**Test Steps:**
1. Clear browser cache and logout if needed
2. Login with platform admin account: `super_user@sparknode.io`
3. Go to `/dashboard`
4. Verify:
   - ✓ PlatformAdminDashboard component loads
   - ✓ Shows "Platform Administration" header
   - ✓ Shows "Total Tenants" and "Active Tenants" cards
   - ✓ Navigation menu shows platform admin options
   - ✓ Cannot access `/departments`, redirects to dashboard
   - ✓ Cannot access `/team-hub`, redirects to dashboard
   - ✓ Can access `/marketplace`, `/ai-settings`, `/templates`, `/billing`

**Expected URL Access:**
```
✓ GET /dashboard              → PlatformAdminDashboard
✓ GET /platform/tenants       → PlatformTenants
✓ GET /ai-settings            → AISettings
✗ GET /departments            → Redirect to /dashboard
✗ GET /team-hub               → Redirect to /dashboard
```

---

### Scenario 2: Tenant Manager Dashboard

**Test Steps:**
1. Clear cache and logout
2. Login with tenant manager: `tenant_manager@company.test`
3. Go to `/dashboard`
4. Verify:
   - ✓ TenantManagerDashboard component loads
   - ✓ Shows "Tenant Dashboard" header
   - ✓ Shows tenant metrics (Users, Budget, Recognitions, Departments)
   - ✓ Can access `/departments`, `/users`, `/budgets`
   - ✓ Cannot access `/platform/tenants`, redirects to dashboard
   - ✓ Cannot access `/ai-settings`, redirects to dashboard
   - ✓ Can access `/team-hub` (manager-level access)

**Expected URL Access:**
```
✓ GET /dashboard              → TenantManagerDashboard
✓ GET /users                  → Users page
✓ GET /departments            → Departments page
✓ GET /budgets                → Budgets page
✓ GET /team-hub               → TeamHub (manager-level)
✗ GET /platform/tenants       → Redirect to /dashboard
✗ GET /ai-settings            → Redirect to /dashboard
```

---

### Scenario 3: Department Lead Dashboard

**Test Steps:**
1. Clear cache and logout
2. Login with department lead: `dept_lead@company.test`
3. Go to `/dashboard`
4. Verify:
   - ✓ DeptLeadDashboard component loads
   - ✓ Shows team-focused metrics (Team Budget, Team Recognitions)
   - ✓ Can access `/team-hub`, `/team/distribute`, `/team/approvals`
   - ✓ Can access `/analytics`
   - ✓ Cannot access `/users`, redirects to dashboard
   - ✓ Cannot access `/departments`, redirects to dashboard
   - ✓ Cannot access `/platform/tenants`, redirects to dashboard

**Expected URL Access:**
```
✓ GET /dashboard              → DeptLeadDashboard
✓ GET /team-hub               → TeamHub
✓ GET /team/distribute        → TeamDistribute
✓ GET /analytics              → Analytics
✗ GET /users                  → Redirect to /dashboard
✗ GET /departments            → Redirect to /dashboard
✗ GET /platform/tenants       → Redirect to /dashboard
```

---

### Scenario 4: Employee Dashboard

**Test Steps:**
1. Clear cache and logout
2. Login with employee: `employee@company.test`
3. Go to `/dashboard`
4. Verify:
   - ✓ EmployeeDashboard component loads
   - ✓ Shows personal stats (Points Balance, Recognitions)
   - ✓ Shows personal wallet
   - ✓ Shows company feed
   - ✓ Can access `/recognize`, `/redeem`, `/wallet`, `/feed`
   - ✓ Cannot access `/team-hub`, redirects to dashboard
   - ✓ Cannot access `/users`, redirects to dashboard
   - ✓ Cannot access `/budgets`, redirects to dashboard

**Expected URL Access:**
```
✓ GET /dashboard              → EmployeeDashboard
✓ GET /recognize              → Recognize
✓ GET /wallet                 → Wallet
✓ GET /feed                   → Feed
✗ GET /team-hub               → Redirect to /dashboard
✗ GET /users                  → Redirect to /dashboard
✗ GET /budgets                → Redirect to /dashboard
```

---

### Scenario 5: Multi-Role User - Switch Role

**Prerequisites:**
- User must have multiple roles assigned
- Both roles must be stored in `users.roles` field (from database)
- JWT token must include `roles` field

**Test Steps:**
1. Login with multi-role user (e.g., user with tenant_manager + dept_lead roles)
2. Open profile dropdown (top-right)
3. Verify:
   - ✓ "Switch Role" option appears when 2+ roles available
   - ✓ Available roles shown as selectable options
4. Click on "Department Lead" role
5. Verify:
   - ✓ Component shows loading state
   - ✓ JWT token updated with new role
   - ✓ localStorage updated with new currentRole
   - ✓ Page refreshes to show DeptLeadDashboard
   - ✓ Navigation menu changes for dept_lead
6. Try accessing `/departments` → Should redirect (dept_lead doesn't have access)
7. Switch back to "Tenant Manager" role
8. Verify:
   - ✓ TenantManagerDashboard loads
   - ✓ `/departments` is now accessible

**Expected Sequence:**
```
POST /auth/switch-role { "role": "dept_lead" }
←  JWT with new role
←  Update authStore.currentRole
←  Update localStorage
←  Dashboard re-renders
→  Correct dashboard component loads
→  Navigation updates
```

---

## Verification Checklist

### Backend Verification

**Database Migration:**
```sql
-- Check migration was applied
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('roles', 'default_role');
-- Expected: Returns 'roles' and 'default_role'

-- Check data was populated
SELECT id, corporate_email, org_role, roles, default_role 
FROM users LIMIT 5;
-- Expected: roles contains comma-separated role list, default_role = org_role
```

**API Endpoints:**
```bash
# Get available roles
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/auth/roles
# Expected: { "roles": ["tenant_manager", "dept_lead", "tenant_user"] }

# Switch role
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "role": "dept_lead" }' \
  http://localhost:8000/auth/switch-role
# Expected: { "access_token": "new_jwt", "token_type": "bearer" }
```

### Frontend Verification

**Component Loading:**
```javascript
// In browser console
// Should show correct dashboard component
document.querySelector('[class*="dashboard"]')

// Check currentRole in authStore
window.authStore?.getState?.()?.currentRole
// Expected: Should match current role (tenant_manager, dept_lead, etc.)

// Check available roles
window.authStore?.getState?.()?.availableRoles
// Expected: Array of available roles
```

**Route Protection:**
```javascript
// Try navigating to protected route as wrong role
// Example: Go to /users as employee
window.location.href = '/users'
// Expected: Should redirect to /dashboard

// Check localStorage for JWT
localStorage.getItem('token')
// Expected: JWT should include 'roles' and 'default_role' fields
```

---

## Common Issues & Solutions

### Issue 1: Switch Role Not Showing

**Symptoms:** Profile dropdown doesn't show "Switch Role" option

**Root Cause:** User doesn't have multiple roles in database

**Solution:**
```sql
-- Add department_lead role to user
UPDATE users 
SET roles = 'tenant_user,dept_lead,tenant_manager'
WHERE corporate_email = 'user@company.test';

-- Verify
SELECT roles FROM users WHERE corporate_email = 'user@company.test';
-- Should show: tenant_user,dept_lead,tenant_manager
```

### Issue 2: Wrong Dashboard Loads

**Symptoms:** Employee sees TenantManagerDashboard

**Root Cause:** JWT token has incorrect org_role or effectiveRole() logic is wrong

**Solution:**
```javascript
// Check JWT contains correct role
const token = localStorage.getItem('token')
const decoded = JSON.parse(atob(token.split('.')[1]))
console.log(decoded.org_role)
// Should match expected role

// Force logout/login to refresh JWT
localStorage.clear()
window.location.href = '/login'
```

### Issue 3: Route Guards Not Working

**Symptoms:** Can access routes you shouldn't (e.g., employee accessing /users)

**Root Cause:** App.jsx route guards not properly checking role

**Solution:**
```jsx
// Verify route guard in App.jsx
<Route path="/users" element={
  <AdminRoute>
    <Users />
  </AdminRoute>
} />

// Check AdminRoute component
const AdminRoute = ({ children }) => {
  const effectiveRole = getEffectiveRole()
  return ['tenant_manager', 'platform_admin'].includes(effectiveRole)
    ? children
    : <Navigate to="/dashboard" />
}
```

### Issue 4: Dashboard Router Shows Wrong Component

**Symptoms:** DashboardRouter component but still showing old Dashboard

**Root Cause:** Component still has old name or import path

**Solution:**
```jsx
// In App.jsx, ensure correct import
import Dashboard from './pages/DashboardRouter'

// Check DashboardRouter component returns correct dashboard
export default function Dashboard() {
  const { getEffectiveRole } = useAuthStore()
  const role = getEffectiveRole()
  
  if (role === 'platform_admin') return <PlatformAdminDashboard />
  if (role === 'tenant_manager') return <TenantManagerDashboard />
  if (role === 'dept_lead') return <DeptLeadDashboard />
  return <EmployeeDashboard />
}
```

---

## Testing Execution Plan

### Phase 1: Setup (30 min)
- [ ] Ensure backend migrations are applied
- [ ] Restart Docker containers (both frontend and backend)
- [ ] Verify database updated with role fields
- [ ] Check test users exist with different roles

### Phase 2: Role Access Testing (1 hour)
- [ ] Test Platform Admin access (Scenario 1)
- [ ] Test Tenant Manager access (Scenario 2)
- [ ] Test Department Lead access (Scenario 3)
- [ ] Test Employee access (Scenario 4)

### Phase 3: Multi-Role Testing (30 min)
- [ ] Create or assign multi-role user
- [ ] Test Switch Role UI appears
- [ ] Test role switching functionality (Scenario 5)

### Phase 4: Integration Testing (30 min)
- [ ] Test route protection across all roles
- [ ] Verify no component bleeding (wrong role UI visible)
- [ ] Test localStorage persistence
- [ ] Test JWT token updates

### Phase 5: Edge Cases (30 min)
- [ ] Test logout/login flow
- [ ] Test browser refresh maintains role
- [ ] Test back button after role switch
- [ ] Test accessing old URLs after role switch

---

## Test Data Requirements

Create these test users before testing:

```sql
-- Platform Admin
INSERT INTO users (corporate_email, org_role, roles, default_role, password_hash, status)
VALUES ('super_user_test@sparknode.io', 'PLATFORM_ADMIN', 'platform_admin', 'platform_admin', '[hash]', 'ACTIVE');

-- Tenant Manager
INSERT INTO users (corporate_email, org_role, roles, default_role, password_hash, status)
VALUES ('manager_test@company.test', 'TENANT_MANAGER', 'tenant_user,dept_lead,tenant_manager', 'tenant_manager', '[hash]', 'ACTIVE');

-- Department Lead
INSERT INTO users (corporate_email, org_role, roles, default_role, password_hash, status)
VALUES ('lead_test@company.test', 'DEPARTMENT_LEAD', 'tenant_user,dept_lead', 'dept_lead', '[hash]', 'ACTIVE');

-- Employee
INSERT INTO users (corporate_email, org_role, roles, default_role, password_hash, status)
VALUES ('employee_test@company.test', 'EMPLOYEE', 'tenant_user', 'tenant_user', '[hash]', 'ACTIVE');

-- Multi-role user (for switch role testing)
INSERT INTO users (corporate_email, org_role, roles, default_role, password_hash, status)
VALUES ('multi_test@company.test', 'TENANT_MANAGER', 'tenant_user,dept_lead,tenant_manager', 'tenant_manager', '[hash]', 'ACTIVE');
```

---

## Success Criteria

✅ All tests pass:
- Each role sees correct dashboard
- Route guards properly restrict access
- Switch role functionality works
- No component bleeding between roles
- JWT tokens correctly updated
- localStorage properly managed
- Navigation menu updates per role

❌ Any failed test must be investigated and documented before moving to production.

---

## Post-Testing Cleanup

```sql
-- Remove test users
DELETE FROM users WHERE corporate_email LIKE '%_test@%';

-- Verify production users still have correct roles
SELECT COUNT(*) FROM users WHERE roles IS NOT NULL;
```

