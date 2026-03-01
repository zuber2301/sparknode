# Switch Role Feature - Implementation Summary

## Overview

A comprehensive switch role feature has been implemented that allows users with multiple roles to seamlessly switch between them. The system supports a role hierarchy where higher roles include permissions of lower roles.

---

## Role Hierarchy & Structure

### Role Definitions

1. **platform_admin** (Level 100)
   - Full system access across all tenants
   - Can view all platform metrics
   - Can manage tenants, users, and global settings
   - Available roles: `platform_admin`

2. **tenant_manager** (Level 80)
   - Full tenant management access
   - Can manage users, budgets, events, and analytics
   - Inherits all permissions of `dept_lead` and `tenant_user`
   - Available roles: `tenant_manager`, `dept_lead`, `tenant_user`

3. **dept_lead** (Department Lead) (Level 60)
   - Can manage department-specific resources
   - Can approve team recognitions and manage team budgets
   - Can view analytics and reports
   - Inherits all permissions of `tenant_user`
   - Available roles: `dept_lead`, `tenant_user`

4. **tenant_user** (Level 40)
   - Basic user access for employee
   - Can give recognition, redeem rewards
   - Can view limited analytics
   - Available roles: `tenant_user`

---

## Database Changes

### New User Model Fields

```python
# In models.py
roles: String(255)          # Comma-separated list of available roles
                            # Example: "tenant_user,dept_lead,tenant_manager"
default_role: String(50)    # Default/primary role for multi-role users
                            # Example: "tenant_manager"
```

### Migration Applied

File: `database/migrations/20260215_add_multi_role_support.sql`

- Adds `roles` and `default_role` columns to users table
- Populates existing users' `roles` from their current `org_role`
- Sets `default_role` to the user's `org_role`
- Non-destructive: existing data remains intact

---

## Backend Implementation

### API Endpoints

#### 1. GET `/auth/me`
Returns current user information including available roles

**Response:**
```json
{
  "id": "uuid",
  "corp_email": "user@company.com",
  "first_name": "John",
  "last_name": "Doe",
  "org_role": "tenant_manager",
  "roles": "tenant_manager,dept_lead,tenant_user",
  "default_role": "tenant_manager",
  "status": "ACTIVE"
}
```

#### 2. GET `/auth/roles`
Returns available roles for the current user

**Response:**
```json
{
  "available_roles": ["tenant_manager", "dept_lead", "tenant_user"],
  "current_role": "tenant_manager",
  "default_role": "tenant_manager"
}
```

#### 3. POST `/auth/switch-role`
Switch to a different role

**Request:**
```json
{
  "role": "dept_lead"
}
```

**Response:**
```json
{
  "access_token": "new_jwt_token",
  "token_type": "bearer",
  "current_role": "dept_lead",
  "available_roles": ["tenant_manager", "dept_lead", "tenant_user"]
}
```

**Status Codes:**
- `200`: Role switched successfully
- `400`: Requested role not available for user
- `401`: Unauthorized

### JWT Token Structure

The access token now includes:
```json
{
  "sub": "user_id",
  "tenant_id": "tenant_id",
  "email": "user@company.com",
  "org_role": "current_role",      // The currently active role
  "roles": "comma_separated_roles",  // All available roles
  "default_role": "default_role",
  "type": "tenant",
  "exp": 1234567890
}
```

### Helper Function: `get_user_roles()`

Located in `backend/auth/routes.py`, this function determines what roles a user should have based on their org_role:

```python
def get_user_roles(org_role: str):
    """
    Returns roles and default role based on org_role hierarchy.
    
    Examples:
    - "tenant_user" → roles: "tenant_user", default: "tenant_user"
    - "dept_lead" → roles: "dept_lead,tenant_user", default: "dept_lead"
    - "tenant_manager" → roles: "tenant_manager,dept_lead,tenant_user", default: "tenant_manager"
    - "platform_admin" → roles: "platform_admin", default: "platform_admin"
    """
```

---

## Frontend Implementation

### Auth Store Updates (`store/authStore.js`)

New state properties:
```javascript
{
  currentRole: null,           // Current active role
  availableRoles: [],         // List of available roles
}
```

New methods:
```javascript
// Get available roles for current user
getAvailableRoles(): string[]

// Get current active role
getCurrentRole(): string

// Switch to a different role
switchRole(newRole): boolean

// Update JWT token
updateToken(newToken): void
```

### TenantContext Updates

The TenantContext now exposes:
- `availableRoles`: List of roles user can switch to
- `getAvailableRoles()`: Method to get available roles
- `switchRole()`: Method to switch roles
- `getCurrentRole()`: Method to get current role

### UI Components

#### Profile Dropdown - Role Switcher

Location: `components/TopHeader.jsx`

The profile dropdown now includes a "Switch Role" section when a user has multiple roles:

```jsx
{/* Switch Role Option - Only show if user has multiple roles */}
{getAvailableRoles && getAvailableRoles().length > 1 && (
  <div className="border-t border-gray-100 my-1 pt-1">
    <div className="px-3 py-2">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Switch Role</p>
      <div className="space-y-1">
        {getAvailableRoles().map((role) => (
          <button
            key={role}
            onClick={() => handleSwitchRole(role)}
            className={`w-full text-left px-2 py-1.5 rounded text-sm ${
              getCurrentRole() === role
                ? 'bg-sparknode-purple/10 text-sparknode-purple font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            {renderRoleDisplay(role)}
          </button>
        ))}
      </div>
    </div>
  </div>
)}
```

#### Role Display

Roles are displayed with helpful emojis and labels:
- 👤 User (tenant_user)
- 👥 Department Lead (dept_lead)
- ⚙️ Tenant Manager (tenant_manager)
- 🔐 Platform Admin (platform_admin)

### Role Switching Flow

1. **User clicks role in profile dropdown**
2. **Frontend calls** `authAPI.switchRole(newRole)`
3. **Backend validates** role is available for user
4. **Backend returns** new JWT token with new role
5. **Frontend updates**:
   - Stores new token
   - Updates auth store with new currentRole
   - Shows success toast
   - Reloads page to reflect navigation changes
6. **Navigation automatically updates** based on new effectiveRole
7. **UI components re-render** to show only features available in the new role

---

## UI Navigation - What Each Role Sees

### Platform Admin

**Navigation Items:**
- Dashboard
- Tenants (with tenants list)
- Users
- Budgets
- Redeem
- Event Management
- Marketplace
- Controls (submenu):
  - AI Settings
  - Templates
  - Billing
  - Audit Log

**Special Features:**
- Can impersonate other tenants
- Access to all platform metrics
- Platform-wide configuration access

### Tenant Manager

**Navigation Items:**
- Dashboard
- Event Management
- Redeem
- Departments
- User Management
- Marketplace & Rewards
- Analytics & Reports
- Settings
- Admin Dropdown:
  - Budgets
  - Users
  - Audit

**Special Features:**
- Full tenant control
- Can manage all users and budgets
- Access to all analytics
- Can delegate to departments

### Department Lead

**Navigation Items:**
- Dashboard
- Event Management (browse)
- Recognize
- Redeem
- Wallet
- Analytics & Reports

**Special Features:**
- Can approve team recognitions
- Can manage team budgets
- Limited to department scope
- Cannot access user management

### Tenant User

**Navigation Items:**
- Dashboard
- Event Management (browse)
- Feed
- Recognize
- Redeem
- Wallet

**Special Features:**
- Employee data access
- Can give recognition
- Can redeem rewards
- Limited analytics

---

## How to Use

### For Users with Multiple Roles

1. **After login**, the default role is set based on the `default_role` field
2. **Click on profile avatar** in the top-right corner
3. **Find "Switch Role" section** (only visible if you have 2+ roles)
4. **Click on desired role** to switch
5. **Page reloads automatically** with the new role
6. **Navigation and features update** based on new role

### For Developers

To check user's effective role in code:
```javascript
import { useAuthStore } from '@/store/authStore'

export function MyComponent() {
  const { getEffectiveRole, getCurrentRole, getAvailableRoles } = useAuthStore()
  
  const currentRole = getCurrentRole()      // Get current role
  const allRoles = getAvailableRoles()      // Get available roles
  const effectiveRole = getEffectiveRole()  // Get effective role (for permission checks)
  
  return (
    <>
      {effectiveRole === 'tenant_manager' && <TenantManagerView />}
      {effectiveRole === 'dept_lead' && <DeptLeadView />}
      {effectiveRole === 'tenant_user' && <UserView />}
    </>
  )
}
```

---

## Default Role Assignment Logic

When a user has multiple roles, the system automatically selects the highest available role as default:

```
tenant_manager (highest)
    ↓
dept_lead
    ↓
tenant_user (lowest)
```

**Examples:**
- User created as `tenant_user` → default: `tenant_user`
- User promoted to `dept_lead` → default: `dept_lead` (can also use `tenant_user`)
- User promoted to `tenant_manager` → default: `tenant_manager` (can also use `dept_lead` or `tenant_user`)

---

## Backward Compatibility

✅ **Fully backward compatible**

- Existing users with single role continue to work
- `org_role` field still populated and functional
- Single-role users don't see the "Switch Role" option
- Migration populates new fields from existing data

---

## Files Modified

### Backend
- `backend/models.py` - Added `roles` and `default_role` fields
- `backend/auth/schemas.py` - Added role-related fields to responses
- `backend/auth/utils.py` - Updated token decoding
- `backend/auth/routes.py` - Added `/auth/roles` and `/auth/switch-role` endpoints
- `database/migrations/20260215_add_multi_role_support.sql` - Migration

### Frontend
- `frontend/src/store/authStore.js` - Multi-role support
- `frontend/src/context/TenantContext.jsx` - Exposed role methods
- `frontend/src/components/TopHeader.jsx` - Added role switcher UI
- `frontend/src/lib/api.js` - Added role switch API methods

---

## Testing Checklist

- [ ] User with single role (no switch option visible)
- [ ] User with 2 roles (switch option visible)
- [ ] User with 3 roles (tenant_manager) (all roles switchable)
- [ ] Switch to lower role and verify navigation updates
- [ ] Switch back to higher role
- [ ] Navigation panel shows correct items for current role
- [ ] Feature access follows role permissions
- [ ] Page refresh maintains role selection
- [ ] API errors handled gracefully
- [ ] Toast notifications appear on switch
- [ ] Mobile navigation adapts to role changes

---

## Future Enhancements

1. **Persistent role preference** - Remember user's preferred role
2. **Role-specific dashboards** - Custom dashboard per role
3. **Role notification** - Highlight active role in navbar
4. **Role expiration** - Time-limited role assignments
5. **Audit trail** - Log all role switches
6. **Role hierarchies config** - Customizable role inheritance

