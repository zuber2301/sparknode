# Switch Role Feature - Quick Reference

## What Was Built

Complete role-based component separation with role switching capability for multi-role users.

## Key Components

### Backend (Ready)
- ✅ New API endpoints: `GET /auth/roles`, `POST /auth/switch-role`
- ✅ Database fields: `users.roles`, `users.default_role`
- ✅ Migration file: `20260215_add_multi_role_support.sql`

### Frontend (Ready)
- ✅ 4 Role dashboards: `PlatformAdminDashboard`, `TenantManagerDashboard`, `DeptLeadDashboard`, `EmployeeDashboard`
- ✅ Dashboard router: `DashboardRouter` (intelligent dispatcher)
- ✅ Route guards: New `TenantManagerRoute`, `ManagerRoute`, `PlatformAdminRoute`
- ✅ Role switching UI: Profile dropdown with role selector

## How It Works

```
User Login
    ↓
JWT includes: org_role, roles[], default_role
    ↓
AuthStore loads roles and currentRole
    ↓
User navigates to /dashboard
    ↓
DashboardRouter checks currentRole
    ↓
Loads correct dashboard component (PlatformAdminDashboard, etc.)
    ↓
Navigation menu shows role-appropriate options
    
When user switches role:
    ↓
Click "Switch Role" in profile dropdown
    ↓
POST /auth/switch-role { "role": "dept_lead" }
    ↓
Receive new JWT with updated role
    ↓
AuthStore updates currentRole
    ↓
Dashboard automatically refreshes to show new dashboard
```

## What Each Role Sees

### Platform Admin
- Dashboard: System-wide metrics, tenant list
- Can Access: `/platform/tenants`, `/ai-settings`, `/templates`, `/billing`
- Cannot Access: Team management, department management

### Tenant Manager
- Dashboard: Tenant metrics, user overview, budget summary
- Can Access: `/users`, `/departments`, `/budgets`, `/team-hub`
- Cannot Access: `/platform/tenants`, `/ai-settings`, `/marketplace`

### Department Lead
- Dashboard: Team budget, team recognitions
- Can Access: `/team-hub`, `/team/distribute`, `/team/analytics`
- Cannot Access: `/users`, `/departments`, `/platform/*`

### Employee
- Dashboard: Personal stats, wallet, company feed
- Can Access: `/recognize`, `/wallet`, `/feed`, `/redeem`
- Cannot Access: All admin routes

## Testing Quick Steps

```bash
# 1. Deploy migration
psql -h localhost -U sparknode -d sparknode -f backend/database/migrations/20260215_add_multi_role_support.sql

# 2. Restart containers
docker-compose down && docker-compose up -d

# 3. Login as different roles and verify:
#    - Correct dashboard loads
#    - Correct menu items show
#    - Cannot access unauthorized routes

# 4. For multi-role users:
#    - Open profile dropdown
#    - Click "Switch Role"
#    - Verify dashboard changes
```

## File Checklist

### New Files
✅ `frontend/src/pages/dashboards/PlatformAdminDashboard.jsx`
✅ `frontend/src/pages/dashboards/TenantManagerDashboard.jsx`
✅ `frontend/src/pages/dashboards/DeptLeadDashboard.jsx`
✅ `frontend/src/pages/dashboards/EmployeeDashboard.jsx`
✅ `frontend/src/pages/DashboardRouter.jsx`

### Modified Files
✅ `frontend/src/App.jsx` (major refactor - new route guards)
✅ `frontend/src/store/authStore.js` (role management)
✅ `frontend/src/components/TopHeader.jsx` (switch role UI)
✅ `frontend/src/lib/api.js` (new role endpoints)
✅ `backend/models.py` (new user fields)
✅ `backend/auth/routes.py` (role endpoints)
✅ `backend/auth/schemas.py` (role schemas)

### Documentation
✅ `ROLE_BASED_SEPARATION.md` (detailed architecture)
✅ `TESTING_VERIFICATION.md` (comprehensive tests)
✅ `DEPLOYMENT_CHECKLIST.md` (deployment steps)
✅ `QUICK_REFERENCE.md` (this file)

## Common Commands

```bash
# Check if migration was run
psql -h localhost -U sparknode -d sparknode -c \
  "SELECT roles, default_role FROM users LIMIT 1;"

# Test new endpoints
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:8000/auth/roles

curl -X POST -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"dept_lead"}' \
  http://localhost:8000/auth/switch-role

# Frontend build
cd frontend && npm run build

# Backend verification
cd backend && python3 -m py_compile models.py auth/routes.py
```

## Build Status

| Component | Status | Notes |
|-----------|--------|-------|
| Backend Python | ✅ | All files compile without errors |
| Frontend Build | ✅ | 1597 modules, 9.84s, successful |
| Database Migration | ✅ | Created, ready to deploy |
| Documentation | ✅ | Complete |
| Testing | ⏳ | Ready to execute |

## Key Decisions Made

1. **Complete Component Separation** - Each role loads ONLY its own dashboard (not shared with role filtering)
2. **Routing-Level Enforcement** - Role checks happen at route level before component loads
3. **JWT-Driven State** - currentRole stored in JWT and localStorage
4. **Profile Dropdown Integration** - Role switching accessible without page navigation
5. **Backward Compatible** - Old JWT tokens still work (users re-login to get role data)

## Potential Issues & Solutions

| Issue | Solution |
|-------|----------|
| "Switch Role" not showing | User needs multiple roles in `users.roles` field |
| Wrong dashboard loading | Check JWT has correct `org_role` |
| Can access unauthorized routes | Verify App.jsx route guards are in place |
| After role switch, old dashboard shows | Browser cache - clear localStorage and refresh |
| New API endpoints 404 | Backend migration not run or containers not restarted |

## Success Criteria (After Deployment)

- [ ] Platform admin sees platform dashboard only
- [ ] Tenant manager sees tenant dashboard only  
- [ ] Department lead sees department dashboard only
- [ ] Employee sees employee dashboard only
- [ ] Multi-role users can switch roles and see different dashboards
- [ ] Route guards prevent unauthorized access
- [ ] No component code from other roles appears in browser
- [ ] JWT token updates after role switch
- [ ] localStorage reflects current role

## Next Steps

1. Run database migration
2. Restart Docker containers
3. Execute test scenarios from TESTING_VERIFICATION.md
4. Monitor for errors in browser console and backend logs
5. Confirm all role-specific dashboards and routes work correctly

---

**Status: Implementation Complete ✅ → Ready for Deployment**

