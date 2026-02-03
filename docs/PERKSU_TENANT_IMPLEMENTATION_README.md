# 🏢 Tenant Implementation Details - Concrete Steps

## Table of Contents

1. [Database Architecture](#1-database-architecture)
2. [Tenant Provisioning Flow](#2-tenant-provisioning-flow)
   - 2.1 [Validation Phase](#21-validation-phase)
   - 2.2 [Tenant Creation](#22-tenant-creation)
   - 2.3 [Financial Initialization](#23-financial-initialization)
   - 2.4 [Department Setup](#24-department-setup)
   - 2.5 [Admin User Creation](#25-admin-user-creation)
   - 2.6 [Wallet Initialization](#26-wallet-initialization)
3. [Tenant Management Endpoints](#3-tenant-management-endpoints)
4. [User Onboarding Flow](#4-user-onboarding-flow)
5. [Tenant Context & Isolation](#5-tenant-context--isolation)
6. [Budget Management](#6-budget-management)
7. [Department Management](#7-department-management)
8. [Security & Access Control](#8-security--access-control)
9. [Frontend Integration](#9-frontend-integration)
   - 9.1 [UI Component Architecture](#91-ui-component-architecture)
   - 9.2 [Navigation & Access Control](#92-navigation--access-control)
   - 9.3 [Tenant Provisioning UI](#93-tenant-provisioning-ui)
   - 9.4 [Tenant Management Interface](#94-tenant-management-interface)
   - 9.5 [Tenant Overview Dashboard](#95-tenant-overview-dashboard)
   - 9.6 [Tenant Settings Management](#96-tenant-settings-management)
   - 9.7 [Financial Management UI](#97-financial-management-ui)
   - 9.8 [User Management Interface](#98-user-management-interface)
   - 9.9 [Responsive Design Patterns](#99-responsive-design-patterns)
   - 9.10 [Error Handling & Loading States](#910-error-handling--loading-states)
   - 9.11 [Real-time Updates](#911-real-time-updates)
   - 9.12 [UI/UX Patterns](#912-uiux-patterns)
   - 9.13 [Testing & Quality Assurance](#913-testing--quality-assurance)
   - 9.14 [Performance Optimization](#914-performance-optimization)
10. [Key Implementation Files](#10-key-implementation-files)
11. [Data Flow Architecture](#11-data-flow-architecture)

Based on the codebase analysis, here's the comprehensive implementation of tenant functionality in the Perksu application:

## 1. Database Architecture

**Tenant Model Structure:**
```python
class Tenant(Base):
    # Identity
    id: UUID (Primary Key)
    name: String (255)
    slug: String (255, unique)

    # Branding & Theme
    logo_url, favicon_url, theme_config, branding_config

    # Security & Governance
    domain_whitelist: JSON (email domains)
    auth_method: String (OTP_ONLY/PASSWORD_AND_OTP/SSO_SAML)

    # Point Economy
    currency_label, conversion_rate, auto_refill_threshold

    # Recognition Rules
    award_tiers: JSON, peer_to_peer_enabled, expiry_policy

    # Financials
    subscription_tier, master_budget_balance

    # Status & Timestamps
    status: ACTIVE/SUSPENDED/ARCHIVED
    created_at, updated_at
```

## 2. Tenant Provisioning Flow

**Concrete Steps for Creating a New Tenant:**

### 2.1 Validation Phase
```python
# Check slug uniqueness
existing_tenant = db.query(Tenant).filter(Tenant.slug == slug).first()
if existing_tenant: raise HTTPException(400, "Slug exists")

# Check admin email uniqueness globally
existing_user = db.query(User).filter(User.email == admin_email).first()
if existing_user: raise HTTPException(400, "Email exists")
```

### 2.2 Tenant Creation
```python
tenant = Tenant(
    name=name,
    slug=slug,
    branding_config=branding_config or {},
    subscription_tier=subscription_tier,
    master_budget_balance=initial_balance,
    status="ACTIVE"
)
db.add(tenant)
```

### 2.3 Financial Initialization
```python
# Create master budget ledger entry
ledger_entry = MasterBudgetLedger(
    tenant_id=tenant.id,
    transaction_type="credit",
    amount=initial_balance,
    balance_after=initial_balance,
    description="Initial provisioning balance"
)
```

### 2.4 Department Setup
```python
default_depts = [
    "Human Resource (HR)", "Technology (IT)",
    "Sales & Marketing", "Business Unit-1",
    "Business Unit-2", "Business Unit-3"
]
for dept_name in default_depts:
    dept = Department(tenant_id=tenant.id, name=dept_name)
    db.add(dept)
```

### 2.5 Admin User Creation
```python
admin_user = User(
    tenant_id=tenant.id,
    email=admin_email,
    password_hash=get_password_hash(admin_password),
    first_name=admin_first_name,
    last_name=admin_last_name,
    role="hr_admin",
    org_role="tenant_manager",
    department_id=hr_dept_id,
    is_super_admin=True,
    status="active"
)
```

### 2.6 Wallet Initialization
```python
admin_wallet = Wallet(
    tenant_id=tenant.id,
    user_id=admin_user.id,
    balance=0, lifetime_earned=0, lifetime_spent=0
)
```

## 3. Tenant Management Endpoints

**Core API Endpoints:**

| Method | Endpoint | Purpose | Access |
|--------|----------|---------|---------|
| `GET` | `/api/tenants/current` | Get current tenant info | Tenant Users |
| `PUT` | `/api/tenants/current` | Update tenant settings | HR Admin |
| `POST` | `/api/tenants` | Create new tenant | Platform Admin |
| `GET` | `/api/tenants` | List all tenants | Platform Admin |
| `GET` | `/api/tenants/{id}` | Get tenant details | Platform Admin |
| `PUT` | `/api/tenants/{id}` | Update tenant | Platform Admin |
| `POST` | `/api/tenants/{id}/toggle-status` | Activate/Deactivate | Platform Admin |
| `POST` | `/api/tenants/{id}/inject-points` | Add budget points | Platform Admin |

## 4. User Onboarding Flow

**Invite-Link Method (Concrete Steps):**

### 4.1 Generate Invite Token
```python
invite_token = TenantResolver.create_invite_token(
    tenant_id=tenant_id,
    expires_in_hours=hours
)
```

### 4.2 Construct Invite URL
```python
invite_url = f"{frontend_url}/signup?invite_token={invite_token}"
```

### 4.3 Token Resolution During Signup
```python
# Decode JWT token to extract tenant_id
payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
tenant_id = UUID(payload.get("tenant_id"))

# Verify tenant exists and is active
tenant = db.query(Tenant).filter(
    Tenant.id == tenant_id,
    Tenant.status == "ACTIVE"
).first()
```

## 5. Tenant Context & Isolation

**Request Processing Flow:**

### 5.1 Authentication
```python
token_data = decode_token(token)
if token_data.type == "system":
    # SystemAdmin access
    TenantContext.set(tenant_id=token_data.tenant_id, global_access=True)
else:
    # Regular user
    user = db.query(User).filter(User.id == token_data.user_id).first()
    TenantContext.set(tenant_id=user.tenant_id, global_access=False)
```

### 5.2 Tenant Filtering
```python
@staticmethod
def apply_tenant_filter(query, model_class, user_tenant_id, has_global_access):
    if not has_global_access and hasattr(model_class, "tenant_id"):
        query = query.filter(model_class.tenant_id == user_tenant_id)
    return query
```

## 6. Budget Management

**Master Budget Ledger System:**

```python
class MasterBudgetLedger(Base):
    tenant_id: UUID
    transaction_type: "credit" | "debit"
    amount: Numeric
    balance_after: Numeric
    description: String
    created_at: DateTime
```

**Budget Operations:**
- **Credit:** Adding funds to tenant master budget
- **Debit:** Spending from master budget (user redemptions)
- **Audit Trail:** Complete transaction history

## 7. Department Management

**Department CRUD Operations:**
```python
# Create
department = Department(tenant_id=tenant_id, name=name)

# Read
departments = db.query(Department).filter(
    Department.tenant_id == current_user.tenant_id
).all()

# Update/Delete (HR Admin only)
```

## 8. Security & Access Control

**Role-Based Permissions:**
- **Platform Admin:** Full system access, tenant management
- **HR Admin:** Tenant settings, user management, budgets
- **Manager:** Department management, team recognition
- **Employee:** Basic recognition and redemption

**Tenant Isolation:**
- All data queries filtered by `tenant_id`
- Users can only access their tenant's data
- Platform admins have global access override

## 9. Frontend Integration

**Tenant-Aware Components:**
- Layout shows tenant-specific branding
- User roles determine available features
- Dashboard displays tenant metrics
- Profile shows tenant information

### 9.1 UI Component Architecture

**Main Tenant Management Pages:**
- `Tenants.jsx` - Platform admin tenant listing and provisioning
- `TenantManager.jsx` - Advanced tenant management interface
- `TenantControlPanel.jsx` - Tabbed tenant management interface

**Tenant-Specific Components:**
- `TenantOverviewTab.jsx` - Budget metrics and user statistics
- `TenantSettingsTab.jsx` - Branding and configuration settings
- `TenantFinancialsTab.jsx` - Budget management and transactions
- `TenantUserManagementTab.jsx` - User administration for tenant
- `TenantDangerZoneTab.jsx` - Critical tenant operations

### 9.2 Navigation & Access Control

**Role-Based Navigation:**
```jsx
// Platform Admin Navigation
const adminNavigation = [
  { name: 'Tenants', href: '/tenants', icon: HiOutlineOfficeBuilding, roles: ['platform_admin'] },
  { name: 'Budgets', href: '/budgets', icon: HiOutlineChartBar, roles: ['manager', 'hr_admin', 'platform_admin'] },
  { name: 'Users', href: '/users', icon: HiOutlineUsers, roles: ['hr_admin', 'platform_admin'] },
  { name: 'Audit Log', href: '/audit', icon: HiOutlineClipboardList, roles: ['hr_admin', 'platform_admin'] },
]
```

**Conditional Rendering:**
```jsx
// Only show admin features for authorized roles
{adminNavigation.some(item => canAccess(item.roles)) && (
  <div className="pt-4 pb-2">
    <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
      Admin
    </p>
  </div>
)}
```

### 9.3 Tenant Provisioning UI

**Provisioning Modal Flow:**
```jsx
// Tenants.jsx - Provisioning Form
const [provName, setProvName] = useState('')
const [provSlug, setProvSlug] = useState('')
const [slugTouched, setSlugTouched] = useState(false)

// Auto-generate slug from name
useEffect(() => {
  if (!slugTouched && provName) {
    const slug = provName.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    setProvSlug(slug)
  }
}, [provName, slugTouched])
```

**Form Validation:**
```jsx
// Real-time slug validation
const validateSlug = (slug) => {
  if (!slug) return 'Slug is required'
  if (!/^[a-z0-9-]+$/.test(slug)) return 'Only lowercase letters, numbers, and hyphens allowed'
  if (slug.length < 3) return 'Slug must be at least 3 characters'
  return null
}
```

### 9.4 Tenant Management Interface

**Tabbed Control Panel:**
```jsx
// TenantControlPanel.jsx
const tabs = [
  { id: 'overview', label: '📊 Overview', icon: 'chart' },
  { id: 'settings', label: '⚙️ Settings', icon: 'gear' },
  { id: 'financials', label: '💰 Financials', icon: 'dollar' },
  { id: 'users', label: '👥 User Management', icon: 'users' },
  { id: 'danger', label: '⚠️ Danger Zone', icon: 'alert' },
]
```

**Tab Content Rendering:**
```jsx
const renderTabContent = () => {
  switch (activeTab) {
    case 'overview':
      return <TenantOverviewTab tenant={tenant} onUpdate={handleUpdate} />
    case 'settings':
      return <TenantSettingsTab tenant={tenant} onUpdate={handleUpdate} setMessage={setMessage} />
    case 'financials':
      return <TenantFinancialsTab tenant={tenant} onUpdate={handleUpdate} setMessage={setMessage} />
    case 'users':
      return <TenantUserManagementTab tenant={tenant} onUpdate={handleUpdate} />
    case 'danger':
      return <TenantDangerZoneTab tenant={tenant} onUpdate={handleUpdate} />
  }
}
```

### 9.5 Tenant Overview Dashboard

**Metrics Display:**
```jsx
// TenantOverviewTab.jsx - Key Metrics
const stats = [
  {
    label: 'Total Budget Allocated',
    value: formatCurrency(overview.total_budget_allocated),
    description: 'Lifetime Allocations'
  },
  {
    label: 'Total Spent',
    value: formatCurrency(overview.total_spent),
    description: 'Redeemed / Debited'
  },
  {
    label: 'Budget Remaining',
    value: formatCurrency(overview.budget_remaining),
    description: 'Current Master Balance',
    status: health.status
  }
]
```

**User Breakdown:**
```jsx
// User counts by role
const totalUsers = Object.values(overview.user_counts.by_org_role).reduce((a,b)=>a+b,0)

<div className="user-breakdown">
  <small>Tenant Managers: {overview.user_counts.tenant_manager}</small>
  <small>Leads: {overview.user_counts.lead}</small>
  <small>Employees: {overview.user_counts.employee}</small>
</div>
```

### 9.6 Tenant Settings Management

**Branding Configuration:**
```jsx
// TenantSettingsTab.jsx
const [settings, setSettings] = useState({
  name: tenant.name,
  logo_url: tenant.logo_url || '',
  favicon_url: tenant.favicon_url || '',
  theme_config: tenant.theme_config || {},
  currency_label: tenant.currency_label || 'Points',
  conversion_rate: tenant.conversion_rate || 1.0
})
```

**Domain Whitelist Management:**
```jsx
// TenantSettings.jsx
const [domainWhitelist, setDomainWhitelist] = useState([])
const [newDomain, setNewDomain] = useState('')

const addDomain = () => {
  if (newDomain && !domainWhitelist.includes(newDomain)) {
    setDomainWhitelist([...domainWhitelist, newDomain])
    setNewDomain('')
  }
}
```

### 9.7 Financial Management UI

**Budget Injection:**
```jsx
// TenantFinancialsTab.jsx
const injectPoints = async () => {
  try {
    await api.post(`/tenants/admin/tenants/${tenant.tenant_id}/inject-points`, {
      amount: injectAmount,
      description: injectDescription
    })
    setMessage({ type: 'success', text: 'Points injected successfully' })
    onUpdate()
  } catch (error) {
    setMessage({ type: 'error', text: error.response?.data?.detail || 'Injection failed' })
  }
}
```

**Transaction History:**
```jsx
// Paginated transaction list
const { data: transactions } = useQuery({
  queryKey: ['tenantTransactions', tenant.tenant_id, page],
  queryFn: () => api.get(
    `/tenants/admin/tenants/${tenant.tenant_id}/transactions?skip=${page * pageSize}&limit=${pageSize}`
  )
})
```

### 9.8 User Management Interface

**User Listing and Actions:**
```jsx
// TenantUserManagementTab.jsx
const { data: users } = useQuery({
  queryKey: ['tenantUsers', tenant.tenant_id],
  queryFn: () => api.get(`/tenants/admin/tenants/${tenant.tenant_id}/users`)
})

// Bulk actions for user management
const bulkAction = async (action, userIds) => {
  await api.post('/users/bulk-action', {
    action,
    user_ids: userIds,
    tenant_id: tenant.tenant_id
  })
}
```

### 9.9 Responsive Design Patterns

**Mobile-First Navigation:**
```jsx
// Layout.jsx - Mobile sidebar
{sidebarOpen && (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" />
)}

<aside className={`
  fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out
  lg:translate-x-0
  ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
`}>
```

**Adaptive Tab Layout:**
```jsx
// Topbar navigation - hidden on mobile, flex on desktop
<div className="hidden lg:flex items-center justify-between h-16 px-4 lg:px-8">
  {/* Navigation tabs */}
</div>
```

### 9.10 Error Handling & Loading States

**Loading States:**
```jsx
// TenantControlPanel.jsx
if (loading) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>
  )
}
```

**Error Boundaries:**
```jsx
// Global error handling for tenant operations
const handleError = (error) => {
  const message = error.response?.data?.detail || 'An unexpected error occurred'
  setMessage({ type: 'error', text: message })
}
```

### 9.11 Real-time Updates

**Query Invalidation:**
```jsx
// After tenant updates, refresh all related data
const handleUpdate = () => {
  queryClient.invalidateQueries(['tenants'])
  queryClient.invalidateQueries(['currentTenant'])
  queryClient.invalidateQueries(['tenantUsers', tenant.tenant_id])
}
```

### 9.12 UI/UX Patterns

**Consistent Design Language:**
```css
/* TenantTabs.css - Shared styling */
.nav-link {
  @apply flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors;
}

.nav-link-active {
  @apply bg-blue-50 text-blue-700 border border-blue-200;
}

.nav-link:hover {
  @apply bg-gray-50 text-gray-900;
}
```

**Status Indicators:**
```jsx
// Status badges with color coding
const getStatusBadge = (status) => {
  const statusConfig = {
    ACTIVE: { color: 'bg-green-100 text-green-800', icon: HiOutlineCheckCircle },
    SUSPENDED: { color: 'bg-yellow-100 text-yellow-800', icon: HiOutlineXCircle },
    ARCHIVED: { color: 'bg-gray-100 text-gray-800', icon: HiOutlineArchive }
  }
  
  const config = statusConfig[status] || statusConfig.ARCHIVED
  const Icon = config.icon
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  )
}
```

### 9.13 Testing & Quality Assurance

**Component Testing:**
```jsx
// TenantControlPanel.test.jsx
import { render, screen, fireEvent } from '@testing-library/react'
import TenantControlPanel from './TenantControlPanel'

test('renders tenant tabs correctly', () => {
  render(<TenantControlPanel tenant={mockTenant} />)
  
  expect(screen.getByText('📊 Overview')).toBeInTheDocument()
  expect(screen.getByText('⚙️ Settings')).toBeInTheDocument()
  expect(screen.getByText('💰 Financials')).toBeInTheDocument()
})

test('switches tabs on click', () => {
  render(<TenantControlPanel tenant={mockTenant} />)
  
  fireEvent.click(screen.getByText('⚙️ Settings'))
  expect(screen.getByText('Branding')).toBeInTheDocument()
})
```

**Integration Testing:**
```jsx
// Tenant provisioning flow test
test('complete tenant provisioning flow', async () => {
  // Mock API responses
  mockApi.onPost('/api/tenants').reply(201, mockTenantResponse)
  
  render(<Tenants />)
  
  // Fill provisioning form
  fireEvent.change(screen.getByLabelText('Organization Name'), {
    target: { value: 'Test Corp' }
  })
  
  fireEvent.click(screen.getByText('Provision Tenant'))
  
  await waitFor(() => {
    expect(screen.getByText('Tenant provisioned successfully')).toBeInTheDocument()
  })
})
```

### 9.14 Performance Optimization

**Query Optimization:**
```jsx
// Efficient data fetching with React Query
const { data: tenant, isLoading } = useQuery({
  queryKey: ['tenant', tenantId],
  queryFn: () => tenantsAPI.getById(tenantId),
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 10 * 60 * 1000, // 10 minutes
})
```

**Lazy Loading:**
```jsx
// Lazy load heavy components
const TenantFinancialsTab = lazy(() => import('./TenantFinancialsTab'))

const renderTabContent = () => (
  <Suspense fallback={<div>Loading...</div>}>
    {activeTab === 'financials' && <TenantFinancialsTab />}
  </Suspense>
)
```

**Memoization:**
```jsx
// Prevent unnecessary re-renders
const TenantCard = memo(({ tenant, onSelect }) => (
  <div onClick={() => onSelect(tenant)}>
    {tenant.name}
  </div>
))
```

**Loading and Empty States:**
```jsx
// Skeleton loading for tenant cards
{loading ? (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
  </div>
) : tenants.length === 0 ? (
  <div className="text-center py-12">
    <HiOutlineOfficeBuilding className="w-12 h-12 text-gray-400 mx-auto mb-4" />
    <h3 className="text-lg font-medium text-gray-900 mb-2">No tenants found</h3>
    <p className="text-gray-500">Get started by provisioning your first organization.</p>
  </div>
) : (
  <TenantGrid tenants={tenants} onTenantSelect={handleTenantSelect} />
)}
```

## 10. Key Implementation Files

### Backend Files:
- `backend/models.py` - Tenant model definition
- `backend/tenants/routes.py` - All tenant API endpoints
- `backend/tenants/schemas.py` - Pydantic schemas for validation
- `backend/auth/tenant_utils.py` - Tenant resolution utilities
- `backend/auth/context.py` - Tenant context management

### Frontend Files:
- `frontend/src/components/Layout.jsx` - Tenant-aware navigation and role-based access
- `frontend/src/pages/Dashboard.jsx` - Tenant metrics display with role-based queries
- `frontend/src/pages/Profile.jsx` - Tenant user profile with conditional data loading
- `frontend/src/pages/Tenants.jsx` - Platform admin tenant provisioning interface
- `frontend/src/pages/TenantManager.jsx` - Advanced tenant management dashboard
- `frontend/src/components/TenantControlPanel.jsx` - Tabbed tenant management interface
- `frontend/src/components/TenantOverviewTab.jsx` - Budget metrics and user statistics
- `frontend/src/components/TenantSettingsTab.jsx` - Branding and configuration management
- `frontend/src/components/TenantFinancialsTab.jsx` - Budget injection and transaction history
- `frontend/src/components/TenantUserManagementTab.jsx` - User administration interface
- `frontend/src/components/TenantDangerZoneTab.jsx` - Critical tenant operations
- `frontend/src/components/TenantGrid.jsx` - Tenant selection grid component
- `frontend/src/components/TenantSettings.jsx` - Domain whitelist and tenant settings
- `frontend/src/store/authStore.js` - Authentication state with role management

## 11. Data Flow Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │────│   API Gateway    │────│   Database      │
│   (React)       │    │   (FastAPI)      │    │   (PostgreSQL)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │ JWT Token             │ Tenant Context        │ tenant_id
         │ user.tenant_id        │ global_access         │ filtering
         │                       │                       │
```

This implementation provides a complete multi-tenant SaaS architecture with proper isolation, branding, and management capabilities. Each tenant operates as an independent organization with its own users, budgets, departments, and settings.</content>
<parameter name="filePath">/root/git-all-linux/perksu/doc/TENANT_IMPLEMENTATION_README.md