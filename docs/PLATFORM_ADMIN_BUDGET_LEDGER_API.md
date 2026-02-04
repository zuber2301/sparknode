# Platform Admin Budget Ledger API

## Overview
The Budget Ledger API provides Platform Admins with a comprehensive view of budget allocation across all tenants in the system. It tracks budget flow through four tiers:

1. **Unallocated** - Budget in platform reserve
2. **Allocated** - Budget in tenant pools (ready for manager distribution)
3. **Delegated** - Budget distributed to team leads
4. **Spendable** - Budget in employee wallets

## API Endpoints

### 1. Get Tenants with Budget Data
**GET** `/api/platform/ledger/tenants`

Returns all tenants with their budget allocation breakdown.

**Response:**
```json
[
  {
    "tenant_id": "uuid",
    "tenant_name": "Acme Corp",
    "status": "active",
    "subscription_tier": "professional",
    "budget_allocated": 100000,
    "budget_allocation_balance": 45000,
    "total_lead_budgets": 35000,
    "total_wallet_balance": 20000,
    "total_active": 55000,
    "utilization_percent": 35.5
  }
]
```

### 2. Get Budget Statistics
**GET** `/api/platform/ledger/stats?time_range=all`

Returns platform-wide budget statistics and metrics.

**Query Parameters:**
- `time_range`: "all" (default), "30days", "90days"

**Response:**
```json
{
  "total_platform_budget": 500000,
  "unallocated_budget": 50000,
  "allocated_budget": 200000,
  "delegated_budget": 150000,
  "spendable_budget": 100000,
  "allocated_percent": 40.0,
  "delegated_percent": 30.0,
  "spendable_percent": 20.0,
  "unallocated_percent": 10.0,
  "total_deployed": 250000,
  "deployment_rate": 50.0,
  "active_tenants": 5,
  "total_allocations": 150,
  "total_distributions": 800
}
```

### 3. Get Budget Activity
**GET** `/api/platform/ledger/activity?time_range=all`

Returns breakdown of budget activity (allocations, distributions, awards, clawbacks) for specified period.

**Query Parameters:**
- `time_range`: "all" (default), "30days", "90days"

**Response:**
```json
{
  "period": "all",
  "allocations_count": 150,
  "allocations_total": 500000,
  "distributions_count": 800,
  "distributions_total": 350000,
  "awards_count": 2500,
  "awards_total": 100000,
  "clawbacks_count": 5,
  "clawbacks_total": 10000
}
```

### 4. Get Full Budget Ledger
**GET** `/api/platform/ledger/full-ledger?time_range=all`

Returns complete budget ledger combining statistics, activity, and tenant breakdown. This is the comprehensive view.

**Query Parameters:**
- `time_range`: "all" (default), "30days", "90days"

**Response:**
```json
{
  "summary": {
    // PlatformBudgetStats (see Get Budget Statistics above)
  },
  "activity": {
    // BudgetActivityBreakdown (see Get Budget Activity above)
  },
  "tenants": [
    // TenantBudgetData array (see Get Tenants with Budget Data above)
  ]
}
```

## Frontend Usage

### Setup
```javascript
import { platformAPI } from '../lib/api'

// All platform ledger calls are available via platformAPI:
platformAPI.getTenantsWithBudgets()
platformAPI.getBudgetStats({ time_range: 'all' })
platformAPI.getBudgetActivity({ time_range: '30days' })
platformAPI.getFullBudgetLedger({ time_range: '90days' })
```

### With React Query
```javascript
import { useQuery } from '@tanstack/react-query'
import { platformAPI } from '../lib/api'

function BudgetLedger() {
  const { data: stats } = useQuery({
    queryKey: ['platform', 'ledger', 'stats'],
    queryFn: () => platformAPI.getBudgetStats({ time_range: 'all' }),
  })

  const { data: tenants } = useQuery({
    queryKey: ['platform', 'ledger', 'tenants'],
    queryFn: () => platformAPI.getTenantsWithBudgets(),
  })

  // Use data...
}
```

## Component Integration

The `PlatformAdminBudgetLedger` component automatically handles:
- Fetching all tenant data
- Fetching platform statistics
- Calculating budget tiers (unallocated, allocated, delegated, spendable)
- Displaying waterfall visualization
- Showing summary stats cards
- Rendering sortable tenant breakdown table
- Time range filtering

**Props:** None (component is self-contained)

**Usage:**
```jsx
import PlatformAdminBudgetLedger from '../components/PlatformAdminBudgetLedger'

function AdminDashboard() {
  return <PlatformAdminBudgetLedger />
}
```

## Data Architecture

### Budget Tiers Explained

**Tier 1: Unallocated**
- Budget sitting in platform reserve
- Available for platform admin to allocate to tenants
- Not yet assigned to any tenant

**Tier 2: Allocated**
- `budget_allocated` field in Tenant model
- Pool assigned to tenant by platform admin
- Ready for tenant manager to distribute to team leads
- Calculated as: `budget_allocated`

**Tier 3: Delegated**
- Budget distributed from tenant pool to team leads
- Sitting in lead wallets with wallet_type = 'lead_distribution'
- Ready for leads to award to employees

**Tier 4: Spendable**
- Budget in employee wallets with wallet_type = 'employee'
- Ready to redeem in marketplace
- Final tier before consumption

### Formulas

**Utilization Percent** (per tenant):
```
(total_active / (budget_allocated + total_active)) * 100
```
Where: total_active = delegated + spendable

**Deployment Rate** (platform-wide):
```
(total_deployed / total_platform_budget) * 100
```
Where: total_deployed = allocated + delegated + spendable

## Security

All endpoints require:
- **Authentication**: Valid JWT token (`Authorization` header)
- **Authorization**: Platform Admin role (`get_platform_admin` dependency)
- **No Tenant Isolation**: `X-Skip-Tenant` header automatically added by API client

These are platform-level endpoints and bypass the tenant context middleware.

## Error Handling

All endpoints return proper HTTP status codes:
- `200 OK` - Success
- `401 Unauthorized` - Invalid or missing token
- `403 Forbidden` - User is not platform admin
- `500 Internal Server Error` - Database or calculation error

## Performance Notes

- `getTenantsWithBudgets()` performs aggregation queries on Wallet table
- `getBudgetStats()` performs SUM aggregations across all tenants
- For deployments with 1000+ wallets, consider adding database indexes on:
  - `wallets.tenant_id`
  - `wallets.wallet_type`
  - `budget_allocation_logs.created_at`
  - `budget_distribution_logs.created_at`

## Future Enhancements

1. **Caching**: Implement Redis caching for stats (TTL: 5 minutes)
2. **Pagination**: Add pagination for tenant breakdown when 100+ tenants
3. **Export**: Add CSV/PDF export functionality
4. **Alerts**: Create alert rules (e.g., "Alert when unallocated < 10%")
5. **Forecasting**: Predict budget depletion rates per tenant
6. **Comparison**: Add period-over-period comparison views
