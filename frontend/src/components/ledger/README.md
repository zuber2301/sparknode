# Points Ledger UI - Component README

Quick reference guide for using the Points Ledger components in your React application.

## Installation

All files are ready to use. No additional installation required beyond base dependencies.

### Required Dependencies

```bash
npm install @tanstack/react-query@^5.x react-icons@^4.x react-hot-toast@^2.x date-fns@^2.x react-router-dom@^6.x
```

### File Structure

```
frontend/src/
├── components/
│   └── ledger/
│       └── PointsLedger.jsx         # Main components
├── hooks/
│   └── useLedger.js                 # Custom hooks
└── routes/
    └── ledgerRoutes.jsx             # Route configuration
```

## Quick Start

### 1. Add Routes to Your Router

```jsx
// App.jsx or Router.jsx
import { ledgerRoutes } from './routes/ledgerRoutes'
import { createBrowserRouter } from 'react-router-dom'

const router = createBrowserRouter([
  {
    path: 'app',
    element: <ProtectedLayout />,
    children: [
      ...ledgerRoutes,  // ← Add this
      // ... other routes
    ]
  }
])
```

### 2. Add Navigation Menu Items

```jsx
// Sidebar.jsx or Navigation.jsx
import { getLedgerNavItems } from '@/routes/ledgerRoutes'

function Navigation({ user }) {
  const ledgerItems = getLedgerNavItems(user.org_role)
  
  return (
    <nav>
      {ledgerItems.map(item => (
        <NavLink
          key={item.id}
          to={item.path}
          label={item.label}
          icon={item.icon}
        />
      ))}
    </nav>
  )
}
```

### 3. Access the Ledgers

Users can now navigate to:
- `/app/ledger/allocations` - Platform Admin view
- `/app/ledger/distributions` - Tenant Manager view
- `/app/ledger/wallet` - Employee view

## Component Reference

### PlatformAdminLedger

Display allocation history for all tenants.

```jsx
import { PlatformAdminLedger } from '@/components/ledger/PointsLedger'

function AdminPage() {
  return <PlatformAdminLedger />
}
```

**Features:**
- Tenant selection
- Type filtering (allocation/clawback)
- Date range filtering
- CSV export
- Detail modals

### TenantManagerLedger

Display distribution history within a tenant.

```jsx
import { TenantManagerLedger } from '@/components/ledger/PointsLedger'

function ManagerPage() {
  return <TenantManagerLedger />
}
```

**Features:**
- Employee filtering
- Type filtering (recognition/delegation)
- Summary statistics
- CSV export

### EmployeeWalletLedger

Display personal wallet balance and transactions.

```jsx
import { EmployeeWalletLedger } from '@/components/ledger/PointsLedger'

function WalletPage() {
  return <EmployeeWalletLedger />
}
```

**Features:**
- Balance cards (current, earned, spent)
- Transaction ledger
- Date range filtering
- Download statements

## Hook Reference

### Query Hooks

#### useAllocationHistory

Fetch allocation history for a tenant.

```jsx
import { useAllocationHistory } from '@/hooks/useLedger'

function CustomAllocationView() {
  const [tenantId, setTenantId] = useState('tenant-123')
  const { data, isLoading } = useAllocationHistory(tenantId, {
    filterType: 'credit',
    dateRange: '30days',
    sortBy: 'recent'
  })
  
  return (
    <>
      {isLoading ? <Spinner /> : <Table data={data} />}
    </>
  )
}
```

#### useDistributionHistory

Fetch distribution history for current tenant.

```jsx
const { data } = useDistributionHistory({
  filterType: 'recognition',
  dateRange: '90days'
})
```

#### useWalletLedger

Fetch personal wallet transactions.

```jsx
const { data: ledger } = useWalletLedger('30days')
const { data: balance } = useWalletBalance()

const totalSpent = ledger
  ?.filter(e => e.transaction_type === 'debit')
  ?.reduce((sum, e) => sum + e.points, 0) || 0
```

### Mutation Hooks

#### useAllocatePoints

Allocate points to a tenant (admin only).

```jsx
import { useAllocatePoints } from '@/hooks/useLedger'

function AllocateForm() {
  const { mutate, isLoading } = useAllocatePoints()
  
  const handleAllocate = () => {
    mutate({
      tenant_id: 'tenant-123',
      amount: 1000,
      currency: 'USD',
      reference_note: 'Q4 Budget',
      invoice_number: 'INV-2024-001'
    })
  }
  
  return <button onClick={handleAllocate}>Allocate</button>
}
```

#### useAwardPoints

Award points to an employee.

```jsx
const { mutate } = useAwardPoints()

mutate({
  to_user_id: 'user-456',
  amount: 500,
  reference_type: 'recognition',
  reference_id: 'rec-789',
  description: 'Great performance'
})
```

#### useDistributeToLead

Delegate points to a lead.

```jsx
const { mutate } = useDistributeToLead()

mutate({
  to_user_id: 'lead-789',
  amount: 2000,
  description: 'Team budget delegation'
})
```

### Utility Functions

#### formatNumber

Format numbers with locale-specific separators.

```jsx
import { formatNumber } from '@/hooks/useLedger'

formatNumber(1500)  // "1,500"
formatNumber(1500.50)  // "1,500.50"
```

#### getTransactionColor

Get Tailwind color classes for transaction types.

```jsx
const classes = getTransactionColor('CREDIT_INJECTION')
// "text-green-600 bg-green-50"
```

#### getTransactionLabel

Get human-readable labels for transaction types.

```jsx
const label = getTransactionLabel('RECOGNITION')
// "Recognition"
```

## Styling & Customization

### Colors

All components use Tailwind CSS. Customize by updating class names:

```jsx
// Change allocation color from green to blue
className="bg-blue-100 text-blue-800"
```

### Responsive Design

Components are responsive by default using Tailwind breakpoints:

```jsx
// Adjust grid columns for different screen sizes
className="grid-cols-1 md:grid-cols-2 lg:grid-cols-4"
```

### Theme Integration

To match your app's theme, modify the Tailwind color palette in `tailwind.config.js`:

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#your-color',
        success: '#your-color'
      }
    }
  }
}
```

## API Integration

All components automatically handle API calls through custom hooks. The hooks use React Query for caching and synchronization.

### API Endpoints Used

**Admin Endpoints:**
```
GET  /api/platform/allocations/history/{tenant_id}
GET  /api/platform/allocations/stats/{tenant_id}
POST /api/platform/allocations/allocate
POST /api/platform/allocations/clawback
```

**Manager Endpoints:**
```
GET  /api/allocations/pool
GET  /api/allocations/history
GET  /api/allocations/history/tenant
POST /api/allocations/award-points
POST /api/allocations/distribute-to-lead
```

**Employee Endpoints:**
```
GET  /api/wallets/me
GET  /api/wallets/me/ledger
```

All endpoints are implemented in the backend and documented in [POINTS_ALLOCATION_SYSTEM.md](POINTS_ALLOCATION_SYSTEM.md).

## Error Handling

All components include built-in error handling with toast notifications:

```jsx
// Errors automatically show toast messages
const { mutate } = useAwardPoints()

mutate(data)
// On error: toast.error('Failed to award points')
// On success: toast.success('Awarded X points')
```

To customize error messages, modify the toast calls in `useLedger.js`:

```jsx
onError: (error) => {
  toast.error(error.message || 'Custom error message')
}
```

## Performance Tips

### 1. Lazy Load Components

Components are already lazy-loaded in routes. For custom implementations:

```jsx
const PlatformAdminLedger = React.lazy(() =>
  import('@/components/ledger/PointsLedger')
    .then(m => ({ default: m.PlatformAdminLedger }))
)

<Suspense fallback={<Spinner />}>
  <PlatformAdminLedger />
</Suspense>
```

### 2. Optimize Queries

Adjust cache times based on your needs:

```jsx
// useLedger.js
useQuery({
  queryKey: ['allocations', tenantId],
  queryFn: () => fetchAllocations(tenantId),
  staleTime: 60000,      // Cache for 1 minute
  cacheTime: 300000,     // Keep for 5 minutes
  refetchOnWindowFocus: true  // Refresh when tab regains focus
})
```

### 3. Pagination (for future use)

For tables with 100+ rows, implement pagination:

```jsx
const [page, setPage] = useState(1)
const pageSize = 50
const paginatedData = data?.slice(
  (page - 1) * pageSize,
  page * pageSize
)
```

## Testing

### Unit Test Example

```jsx
import { render, screen } from '@testing-library/react'
import { PlatformAdminLedger } from '@/components/ledger/PointsLedger'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

test('renders allocation ledger', () => {
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <PlatformAdminLedger />
    </QueryClientProvider>
  )
  
  expect(screen.getByText('Points Allocation Ledger')).toBeInTheDocument()
})
```

### E2E Test Example

```jsx
// cypress/e2e/ledger.cy.js
describe('Points Ledger', () => {
  it('admin can view allocation history', () => {
    cy.login('admin')
    cy.visit('/app/ledger/allocations')
    cy.contains('Points Allocation Ledger').should('be.visible')
    cy.get('select').first().select('Acme Corp')
    cy.contains('Feb 04').should('be.visible')
  })
})
```

## Troubleshooting

### Components Not Rendering

**Problem:** "Cannot find module 'PointsLedger'"

**Solution:** Check import paths match your directory structure:

```jsx
// Correct
import { PlatformAdminLedger } from '@/components/ledger/PointsLedger'

// Wrong  
import { PlatformAdminLedger } from '../../../components/PointsLedger'
```

### API Errors

**Problem:** 404 errors on API endpoints

**Solution:** Verify backend routes are implemented. Check:
- Backend main.py includes router imports
- Endpoints are prefixed correctly
- User has required role

### Styling Issues

**Problem:** Components appear unstyled

**Solution:** Ensure:
- Tailwind CSS is installed: `npm list tailwindcss`
- CSS is imported in your main.css or App.jsx
- `tailwind.config.js` includes src directory

### Permission Denied

**Problem:** User sees "No access" error

**Solution:** Verify:
- User has correct `org_role` (admin, manager, employee)
- Backend role checks are consistent
- User is logged in with valid token

## FAQ

**Q: Can I use these components without React Router?**  
A: Yes, just import components directly. Routes are optional.

**Q: Can I customize the colors?**  
A: Yes, modify Tailwind classes in component JSX.

**Q: How do I add more filters?**  
A: Add state, filter UI, and update query key in hooks.

**Q: Can I export to PDF instead of CSV?**  
A: Yes, replace CSV generation with PDFKit integration.

**Q: How do I add real-time updates?**  
A: Integrate WebSocket in hooks using subscriptions.

## Documentation

For detailed information, refer to:

- [POINTS_LEDGER_UI_IMPLEMENTATION.md](../docs/POINTS_LEDGER_UI_IMPLEMENTATION.md) - Complete integration guide
- [POINTS_LEDGER_UI_DESIGN.md](../docs/POINTS_LEDGER_UI_DESIGN.md) - Architecture & design
- [POINTS_LEDGER_UI_VISUAL_GUIDE.md](../docs/POINTS_LEDGER_UI_VISUAL_GUIDE.md) - Visual layouts

## Support

For issues:

1. Check [Troubleshooting](../docs/POINTS_LEDGER_UI_DESIGN.md#12-support--troubleshooting)
2. Review [API Contract](../docs/POINTS_ALLOCATION_SYSTEM.md)
3. Check console for errors
4. Verify backend endpoints are live

---

**Last Updated:** February 4, 2025  
**Component Version:** 1.0  
**Status:** Production Ready
