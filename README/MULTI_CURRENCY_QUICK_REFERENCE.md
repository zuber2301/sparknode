# Multi-Currency Quick Reference

## Quick Start

### Display Currency in Your Component

```jsx
import { useQuery } from '@tanstack/react-query'
import { tenantsAPI } from '@/lib/api'
import { formatCurrency } from '@/lib/currency'

export function MyComponent() {
  const { data: tenant } = useQuery({
    queryKey: ['tenant', 'current'],
    queryFn: () => tenantsAPI.getCurrentTenant()
  })

  const displayCurrency = tenant?.display_currency || 'USD'
  const fxRate = tenant?.fx_rate || 1

  return (
    <div>
      <p>Your balance: {formatCurrency(balance, displayCurrency, fxRate)}</p>
    </div>
  )
}
```

## Common Patterns

### Pattern 1: Inline Formatting
```javascript
// Simple one-liner
{formatCurrency(value, 'INR', 83.12)}
```

### Pattern 2: Helper Function
```javascript
const formatBudgetValue = (value) => {
  return formatCurrency(value, tenant?.display_currency || 'USD', tenant?.fx_rate || 1)
}

// Usage
{formatBudgetValue(1000)}
```

### Pattern 3: Using TenantCurrencyFormatter
```javascript
import { TenantCurrencyFormatter } from '@/lib/currency'

const formatter = new TenantCurrencyFormatter(
  'USD',
  tenant?.display_currency || 'USD',
  tenant?.fx_rate || 1
)

return <p>{formatter.formatBaseValue(100)}</p>
```

## Backend Usage

### Python - Converting Values

```python
from core.currency import TenantCurrencyContext
from decimal import Decimal

# Create context for a tenant
context = TenantCurrencyContext(
    base_currency='USD',
    display_currency='INR',
    fx_rate=Decimal('83.12')
)

# Convert for display
display_value = context.convert_for_display(100)  # Decimal('8312.00')

# Format for output
formatted = context.format_display_value(100)  # "₹8,312.00"
```

### Python - API Response

```python
@router.get("/tenants/current", response_model=TenantResponse)
async def get_current_tenant(current_user: User = Depends(get_current_user)):
    """Currency fields automatically included in response"""
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    return tenant  # Includes display_currency, fx_rate
```

## API Endpoints

### Get Tenant Config
```bash
curl -X GET http://localhost:8000/api/tenants/current \
  -H "Authorization: Bearer $TOKEN"

# Response includes:
{
  "id": "uuid",
  "display_currency": "INR",
  "fx_rate": 83.12,
  "base_currency": "USD"
}
```

### Update Currency Settings
```bash
curl -X PUT http://localhost:8000/api/tenants/current \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "display_currency": "INR",
    "fx_rate": 83.12
  }'
```

## Component Props

### RewardsCatalog
```jsx
<RewardsCatalog
  vouchers={vouchers}
  onRedeem={handleRedeem}
  displayCurrency="INR"  // ✅ NEW
  fxRate={83.12}         // ✅ NEW
/>
```

### WalletBalance
```jsx
<WalletBalance
  wallet={walletData}
  // Fetches currency from tenant config automatically
/>
```

## Key Functions Reference

| Function | Input | Output | Use Case |
|----------|-------|--------|----------|
| `formatCurrency()` | baseValue, currency, fxRate | "₹8,312.00" | ✅ Display values |
| `convertToDisplayCurrency()` | baseValue, fxRate | 8312 | Calculate display amount |
| `convertFromDisplayCurrency()` | displayValue, fxRate | 100 | Convert back to base |
| `formatDisplayValue()` | displayValue, currency | "₹8,312.00" | Format already-converted |
| `getCurrencyInfo()` | currency | {symbol, locale, decimals} | Get currency metadata |
| `getCurrencyOptions()` | none | Array of options | Populate dropdowns |

## Database Fields

```sql
-- In tenants table
base_currency VARCHAR(3) DEFAULT 'USD'
display_currency VARCHAR(3) DEFAULT 'USD'
fx_rate NUMERIC(10, 4) DEFAULT 1.0
```

## Supported Currencies

```
USD - US Dollar ($)
INR - Indian Rupee (₹)
EUR - Euro (€)
GBP - British Pound (£)
JPY - Japanese Yen (¥)
```

## Gotchas ⚠️

1. **Always fetch tenant config** - Don't hardcode currency
   ```jsx
   // ❌ Wrong
   return <p>{formatCurrency(100, 'INR', 83.12)}</p>
   
   // ✅ Correct
   return <p>{formatCurrency(100, tenant?.display_currency, tenant?.fx_rate)}</p>
   ```

2. **JPY has no decimals** - This is handled automatically
   ```javascript
   formatCurrency(100, 'JPY')  // "¥100" not "¥100.00"
   ```

3. **FX rates must be > 0** - Validation happens at multiple levels
   ```python
   # Backend validation
   if fx_rate <= 0:
       raise ValueError("FX rate must be greater than 0")
   ```

4. **Base currency is always USD internally** - Don't change this
   ```python
   # ❌ Don't modify
   base_currency = 'INR'  # Still stored/calculated in USD
   
   # ✅ Use
   display_currency = 'INR'
   ```

## Performance Tips

1. **Cache tenant config**
   ```jsx
   useQuery({
     queryKey: ['tenant', 'current'],
     staleTime: 5 * 60 * 1000  // Cache for 5 minutes
   })
   ```

2. **Avoid repeated queries** - Fetch once in parent, pass props
   ```jsx
   // ✅ Good - fetch once
   const { data: tenant } = useQuery(['tenant', 'current'], ...)
   return (
     <>
       <ComponentA currency={tenant?.display_currency} />
       <ComponentB currency={tenant?.display_currency} />
     </>
   )
   ```

3. **Use formatBudgetValue() helper** - Encapsulates formatting logic
   ```jsx
   // ✅ Good - DRY principle
   const formatValue = (v) => formatCurrency(v, tenant?.display_currency, tenant?.fx_rate)
   return (
     <>
       <p>{formatValue(total)}</p>
       <p>{formatValue(allocated)}</p>
       <p>{formatValue(remaining)}</p>
     </>
   )
   ```

## Examples

### Example 1: Tenant in INR
```
Display Currency: INR
FX Rate: 83.12

100 USD → ₹8,312.00
5000 USD → ₹415,600.00
```

### Example 2: Tenant in EUR
```
Display Currency: EUR
FX Rate: 0.92

100 USD → €92.00
5000 USD → €4,600.00
```

### Example 3: Tenant in JPY
```
Display Currency: JPY
FX Rate: 149.50

100 USD → ¥14,950
5000 USD → ¥747,500
```

---

**For full documentation, see:** [MULTI_CURRENCY_IMPLEMENTATION.md](./MULTI_CURRENCY_IMPLEMENTATION.md)
