# Budget Ledger UI Design Guide

## Overview

The Budget Ledger UI system provides three role-based views for tracking budget allocation and distribution across the SparkNode platform. Each view is optimized for its specific user role and use cases.

---

## 1. Architecture Overview

### Components Structure

```
frontend/src/
├── components/
│   └── ledger/
│       └── PointsLedger.jsx          # Main ledger components (3 views)
├── hooks/
│   └── useLedger.js                  # Custom hooks for ledger data
├── routes/
│   └── ledgerRoutes.jsx              # Route configuration
└── pages/
    └── Ledger/
        ├── AdminLedgerPage.jsx       # Admin layout wrapper
        ├── ManagerLedgerPage.jsx     # Manager layout wrapper
        └── EmployeeLedgerPage.jsx    # Employee layout wrapper
```

### Data Flow

```
User Action (Filter/Sort)
         ↓
React State (useState)
         ↓
Custom Hook (useLedger)
         ↓
React Query (Cache & Sync)
         ↓
Backend API Endpoint
         ↓
Database Query
         ↓
Cached Data in React Query
         ↓
Component Re-render
         ↓
UI Update
```

---

## 2. Platform Admin Ledger

**Path:** `/ledger/allocations`  
**Role Required:** `platform_admin`  
**Purpose:** Track bulk budget allocations to tenants and billing reconciliation

### Features

- **Tenant Selection**: Dropdown to view history for specific tenant
- **Filtering**:
  - Transaction Type (All / Credit / Clawback)
  - Date Range (Last 7/30/90 days, All time)
  - Sort By (Recent, Oldest, Amount High/Low)
- **Table Display**:
  - Date, Tenant, Admin, Amount, Type, Reference, Details button
  - Color-coded transaction types (green for allocation, red for clawback)
- **Actions**:
  - View full allocation details in modal
  - Export history as CSV
- **Dashboard Cards**: Summary stats

### API Endpoints Used

```typescript
GET  /api/platform/allocations/history/{tenant_id}?type=...&range=...
POST /api/platform/allocations/allocate
POST /api/platform/allocations/clawback
GET  /api/platform/allocations/stats/{tenant_id}
```

### State Management

```typescript
const [selectedTenant, setSelectedTenant] = useState(null)
const [filterType, setFilterType] = useState('all')
const [dateRange, setDateRange] = useState('30days')
const [sortBy, setSortBy] = useState('recent')

const { data, isLoading } = useAllocationHistory(selectedTenant, { filterType, dateRange, sortBy })
```

### Key Interactions

1. **Select Tenant** → Query updates → History loads
2. **Change Filter** → Query updates → Data re-fetches
3. **Click Details** → Modal opens → Full entry shown
4. **Export CSV** → Browser download triggered

---

## 3. Tenant Manager Ledger

**Path:** `/ledger/distributions`  
**Role Required:** `tenant_manager`  
**Purpose:** View how many points were distributed within the tenant

### Features

- **Employee Filter**: Dropdown to view distributions for specific employee
- **Type Filtering**: All / Delegations / Recognitions
- **Date Filtering**: Last 7/30/90 days, All time
- **Summary Cards**:
  - Total Distributed (sum of all amounts)
  - Transaction Count
  - Average Award per transaction
- **Table Display**:
  - Date, From, To, Points, Type (recognition/delegation), Description
  - Color-coded badges for transaction types
- **Actions**:
  - Export history as CSV
  - Filter by employee

### API Endpoints Used

```typescript
GET /api/allocations/history/tenant?type=...&range=...
GET /api/allocations/pool
```

### State Management

```typescript
const [filterType, setFilterType] = useState('all')
const [selectedEmployee, setSelectedEmployee] = useState(null)
const [dateRange, setDateRange] = useState('30days')

const { data } = useDistributionHistory({ filterType, dateRange })
const filteredData = selectedEmployee 
  ? data?.filter(e => e.to_user_id === selectedEmployee) 
  : data
```

### Key Interactions

1. **Filter by Employee** → Data filters locally
2. **Change Date Range** → Query updates → Data re-fetches
3. **Export CSV** → Download triggered with filtered data
4. **Summary Cards** → Recalculate on data change

---

## 4. Employee Wallet Ledger

**Path:** `/ledger/wallet`  
**Role Required:** All authenticated users  
**Purpose:** View personal points balance and transaction history

### Features

- **Balance Cards** (gradient backgrounds):
  - Current Balance (blue)
  - Lifetime Earned (green)
  - Lifetime Spent (orange)
- **Filters**:
  - Date Range (30 days / 90 days / 1 year / All time)
  - Source (All / Recognition / Redemption / Adjustment / Expiry)
- **Transaction Summary**:
  - Credits (total & count)
  - Debits (total & count)
  - Average credit value
  - Total transactions
- **Ledger Table**:
  - Date, Description, Source, Amount, Balance After
  - Color-coded transaction types
- **Actions**:
  - Download statement as PDF/CSV
  - View by source

### API Endpoints Used

```typescript
GET /api/wallets/me
GET /api/wallets/me/ledger?range=...
```

### State Management

```typescript
const [dateRange, setDateRange] = useState('all')
const [filterSource, setFilterSource] = useState('all')

const { data: balance } = useWalletBalance()
const { data: ledger } = useWalletLedger(dateRange)

const filteredLedger = filterSource === 'all'
  ? ledger
  : ledger?.filter(e => e.source === filterSource)
```

### Key Interactions

1. **Change Date Range** → Query updates → Balance cards update
2. **Filter by Source** → Local filtering applied
3. **Download Statement** → File generation & browser download
4. **View Transaction** → Scroll/pagination navigation

---

## 5. Design System

### Color Palette

```css
/* Transaction Types */
--allocation-green: #10b981  /* Credit/Allocation */
--clawback-red: #ef4444     /* Clawback/Debit */
--recognition-blue: #3b82f6 /* Recognition */
--delegation-purple: #a855f7 /* Delegation */
--redemption-orange: #f97316 /* Redemption */
--neutral-gray: #6b7280     /* Neutral/Adjustment */

/* Backgrounds */
--bg-card: #ffffff
--bg-hover: #f9fafb
--bg-light: #f3f4f6
--border: #e5e7eb
```

### Component Spacing

```css
/* Card/Container */
padding: 1.5rem (24px)
border-radius: 0.5rem (8px)
box-shadow: 0 1px 3px rgba(0,0,0,0.1)

/* Table */
padding: 1.5rem (24px)
header background: #f9fafb
row height: 3.5rem (56px)
border: 1px solid #e5e7eb

/* Filters */
grid: 1 column mobile, 4 columns desktop
gap: 1rem (16px)
input height: 2.5rem (40px)
```

### Typography

```css
/* Headers */
h1: 1.875rem (30px), 700 weight
h2: 1.5rem (24px), 700 weight

/* Body */
.text-sm: 0.875rem (14px)
.text-base: 1rem (16px)

/* Labels */
label: 0.875rem (14px), 500 weight, gray-700
```

### Responsive Design

```
Mobile (< 768px)
├── Single column layout
├── Stacked filters
└── Horizontal scroll table

Tablet (768px - 1024px)
├── 2-column grid
├── 2-column filters
└── Full width table

Desktop (> 1024px)
├── 3-4 column grid
├── 4-column filters
└── Full width table with sidebars
```

---

## 6. Integration Steps

### Step 1: Import Components

```jsx
// In your router file or main layout
import { ledgerRoutes } from './routes/ledgerRoutes'
import { getLedgerNavItems } from './routes/ledgerRoutes'
```

### Step 2: Add Routes

```jsx
// In your router configuration
const router = createBrowserRouter([
  {
    path: 'app',
    element: <ProtectedLayout />,
    children: [
      ...ledgerRoutes,
      // ... other routes
    ]
  }
])
```

### Step 3: Add Navigation Items

```jsx
// In your navigation component
import { getLedgerNavItems } from './routes/ledgerRoutes'

function Navigation({ user }) {
  const ledgerItems = getLedgerNavItems(user.org_role)
  
  return (
    <nav>
      {ledgerItems.map(item => (
        <NavLink
          key={item.id}
          to={item.path}
          icon={item.icon}
          label={item.label}
        />
      ))}
    </nav>
  )
}
```

### Step 4: Hook Integration (Optional)

For custom ledger implementations:

```jsx
import { useAllocationHistory, useWalletBalance } from './hooks/useLedger'

function CustomLedger() {
  const { data, isLoading } = useAllocationHistory(tenantId, {
    filterType: 'credit',
    dateRange: '30days'
  })
  
  return <>{/* render data */}</>
}
```

---

## 7. Performance Optimizations

### Caching Strategy

```typescript
// Fetch options configured in hooks
useQuery({
  queryKey: ['allocations', 'history', tenantId],
  queryFn: () => fetchAllocationHistory(tenantId),
  staleTime: 60000,      // Cache for 1 minute
  cacheTime: 300000,     // Keep in memory for 5 minutes
  refetchOnWindowFocus: true,  // Refresh when window regains focus
})
```

### Lazy Loading

```jsx
// Components lazy loaded to reduce initial bundle size
const PlatformAdminLedger = React.lazy(() =>
  import('./components/ledger/PointsLedger').then(m => ({ 
    default: m.PlatformAdminLedger 
  }))
)

<Suspense fallback={<LedgerLoading />}>
  <PlatformAdminLedger />
</Suspense>
```

### Pagination (For Future Enhancement)

```jsx
// Add to table views when data exceeds 100 rows
const [page, setPage] = useState(1)
const pageSize = 50

const paginatedData = data?.slice(
  (page - 1) * pageSize, 
  page * pageSize
)
```

---

## 8. Error Handling

### API Error Responses

```typescript
try {
  const res = await fetch('/api/allocations/history')
  if (!res.ok) {
    const error = await res.json()
    toast.error(error.detail || 'Failed to load history')
  }
} catch (err) {
  toast.error('Network error. Please try again.')
}
```

### Fallback UI States

```jsx
{isLoading && <LoadingSpinner />}
{error && <ErrorMessage error={error} />}
{data?.length === 0 && <EmptyState />}
{data?.length > 0 && <Table data={data} />}
```

---

## 9. Testing Checklist

### Unit Tests
- [ ] Filter state changes correctly
- [ ] CSV export generates valid CSV
- [ ] Date formatting works for all locales
- [ ] Transaction type badges display correctly

### Integration Tests
- [ ] Ledger loads with correct API data
- [ ] Filtering triggers API refetch
- [ ] Pagination works correctly
- [ ] Export includes filtered data

### E2E Tests
- [ ] Admin can view allocation history
- [ ] Manager can filter distributions by employee
- [ ] Employee can view wallet balance
- [ ] All filters work independently
- [ ] CSV download works in Chrome, Firefox, Safari

---

## 10. Known Limitations & Future Enhancements

### Current Limitations

1. **No Real-time Updates**: Ledger updates on manual refresh only
   - Fix: Add WebSocket subscription for live updates

2. **No Pagination**: Table shows all results at once
   - Fix: Implement pagination for tables with 100+ rows

3. **No Advanced Filters**: No date range picker, only presets
   - Fix: Add DatePicker component for custom ranges

4. **Single-tenant View Only**: Admin must select one tenant
   - Fix: Add multi-select for bulk operations

### Planned Enhancements

- [ ] Real-time ledger updates via WebSocket
- [ ] Advanced filtering with date picker
- [ ] Bulk operations for platform admins
- [ ] PDF statement generation
- [ ] Analytics charts (spending trends, distribution patterns)
- [ ] Approval workflows for large allocations
- [ ] Ledger audit trail with change history
- [ ] Points forecast modeling

---

## 11. API Contract

### Platform Admin Routes

```
GET  /api/platform/allocations/history/{tenant_id}
     Params: type, range, sort
     Returns: { allocations: [], billing: [] }

GET  /api/platform/allocations/stats/{tenant_id}
     Returns: { current_balance, allocated_today, total_distributed }

POST /api/platform/allocations/allocate
     Body: { tenant_id, amount, currency, reference_note, invoice_number }
     Returns: AllocationResponse

POST /api/platform/allocations/clawback
     Body: { tenant_id, amount, reason }
     Returns: ClawbackResponse
```

### Tenant Manager Routes

```
GET  /api/allocations/pool
     Returns: AllocationPoolStats

GET  /api/allocations/history
     Returns: DistributionLogResponse[]

GET  /api/allocations/history/tenant
     Params: type, range
     Returns: DistributionLogResponse[]

POST /api/budget allocation
     Body: { to_user_id, amount, description }
     Returns: DistributionResponse

POST /api/allocations/distribute-to-lead
     Body: { to_user_id, amount, description }
     Returns: DistributionResponse
```

### Employee Routes

```
GET  /api/wallets/me
     Returns: { balance, lifetime_earned, lifetime_spent }

GET  /api/wallets/me/ledger
     Params: range
     Returns: WalletLedgerEntry[]
```

---

## 12. Support & Troubleshooting

### Common Issues

**Problem**: Ledger shows no data
- Check user has correct role
- Verify API endpoints are live
- Check browser console for errors

**Problem**: Export CSV is blank
- Ensure data is loaded before export
- Check for JavaScript errors
- Verify CSV generation function

**Problem**: Filters not working
- Clear browser cache
- Check React Query DevTools
- Verify query keys match API expectations

### Contact & Documentation

- **API Documentation**: See [POINTS_ALLOCATION_SYSTEM.md](../POINTS_ALLOCATION_SYSTEM.md)
- **Backend Routes**: [backend/platform_admin/allocation_routes.py](../../backend/platform_admin/allocation_routes.py)
- **Database Schema**: [database/migrations/20260204_add_points_budget allocation_allocation_system.sql)
