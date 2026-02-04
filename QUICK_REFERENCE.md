# Points Allocation System - Quick Reference Card

## Core Concept: 3-Tier Allocation

```
Platform Admin  →  Allocates Points To  →  Tenant Pool
                                             ↓
                                        Tenant Manager
                                             ↓
                    (Option A)          (Option B)
                    ├─→ Delegate To  →  Lead's Wallet
                    │                        ↓
                    │                      Lead/Manager
                    │                        ↓
                    └─→ Award To  →  Employee's Wallet
```

---

## Key Files Reference

| File | Purpose | Lines |
|------|---------|-------|
| `backend/core/points_service.py` | Core business logic | 410 |
| `backend/platform_admin/allocation_routes.py` | Admin API | 340 |
| `backend/tenants/distribution_routes.py` | Manager API | 300 |
| `database/migrations/20260204_add_points_allocation_system.sql` | Schema | 80 |
| `backend/models.py` | Updated models | +80 |
| `backend/recognition/routes.py` | Updated integration | +40 |

---

## PointsService Methods Quick Guide

### 1. Allocate to Tenant
```python
PointsService.allocateToTenant(
    db, tenant, admin_user,
    amount=50000,
    currency='INR',
    reference_note='Invoice #123'
)
```
**Result:** `tenant.points_allocation_balance += 50000`

### 2. Delegate to Lead
```python
PointsService.delegateToLead(
    db, tenant, from_manager, to_lead,
    amount=10000,
    description='Monthly budget'
)
```
**Result:** 
- `tenant.points_allocation_balance -= 10000`
- `lead.wallet.balance += 10000`

### 3. Award to User
```python
PointsService.awardToUser(
    db, tenant, from_user, to_user,
    amount=1000,
    reference_type='recognition',
    reference_id=recognition_id
)
```
**Result:**
- `tenant.points_allocation_balance -= 1000`
- `employee.wallet.balance += 1000`

### 4. Clawback Points
```python
PointsService.clawback_points(
    db, tenant, admin_user,
    amount=50000,  # null = clawback all
    reason='Subscription cancelled'
)
```
**Result:** `tenant.points_allocation_balance -= 50000`

### 5. Get Statistics
```python
stats = PointsService.get_tenant_allocation_stats(db, tenant)
# Returns: current_balance, allocated_today, total_distributed
```

---

## API Endpoints Quick Reference

### Platform Admin Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/platform/allocations/allocate` | POST | Allocate points to tenant |
| `/api/platform/allocations/clawback` | POST | Clawback points |
| `/api/platform/allocations/history/{id}` | GET | View history |
| `/api/platform/allocations/stats/{id}` | GET | View statistics |
| `/api/platform/allocations/all` | GET | All tenants stats |

### Tenant Manager Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/allocations/pool` | GET | View available pool |
| `/api/allocations/distribute-to-lead` | POST | Delegate to lead |
| `/api/allocations/award-points` | POST | Award to employee |
| `/api/allocations/history` | GET | View own history |
| `/api/allocations/history/tenant` | GET | View all history |

---

## Common Use Cases

### Use Case 1: Quarterly Allocation
```bash
# Platform Admin allocates Q1 budget
curl -X POST http://localhost:8000/api/platform/allocations/allocate \
  -H "Authorization: Bearer {token}" \
  -d '{
    "tenant_id": "550e8400-...",
    "amount": 100000,
    "reference_note": "Q1 2026 Budget"
  }'
```

### Use Case 2: Manager Awards Recognition
```bash
# Manager recognizes employee
curl -X POST http://localhost:8000/api/allocations/award-points \
  -H "Authorization: Bearer {token}" \
  -d '{
    "to_user_id": "770e8400-...",
    "amount": 1000,
    "reference_type": "recognition",
    "description": "Outstanding Q1 performance"
  }'
```

### Use Case 3: Tenant Cancellation
```bash
# Platform Admin claws back points
curl -X POST http://localhost:8000/api/platform/allocations/clawback \
  -H "Authorization: Bearer {token}" \
  -d '{
    "tenant_id": "550e8400-...",
    "reason": "Subscription cancelled"
  }'
```

---

## Database Tables Reference

### allocation_logs
- **Purpose:** Platform admin allocation audit trail
- **Key Fields:** `tenant_id`, `admin_id`, `amount`, `transaction_type`
- **Query:** `SELECT * FROM allocation_logs WHERE tenant_id = ?`

### platform_billing_logs
- **Purpose:** Billing reconciliation
- **Key Fields:** `admin_id`, `tenant_id`, `amount`, `invoice_number`
- **Query:** `SELECT * FROM platform_billing_logs WHERE invoice_number = ?`

### distribution_logs
- **Purpose:** Point distribution tracking
- **Key Fields:** `from_user_id`, `to_user_id`, `amount`, `transaction_type`
- **Query:** `SELECT * FROM distribution_logs WHERE to_user_id = ?`

### tenants (updated)
- **New Column:** `points_allocation_balance`
- **Query:** `SELECT points_allocation_balance FROM tenants WHERE id = ?`

---

## Validation Rules

### Before Allocation
- ✓ Admin must be `is_platform_admin = true`
- ✓ Amount must be > 0
- ✓ Tenant must exist and be `status = 'active'`

### Before Distribution
- ✓ Manager must be `tenant_manager` or `hr_admin`
- ✓ Tenant pool balance >= requested amount
- ✓ Amount must be > 0

### Database Constraints
- ✓ `tenants.points_allocation_balance >= 0`
- ✓ `wallets.balance >= 0`
- Both enforced with CHECK constraints

---

## Accounting Formula

```
Total Points Allocated = 
    Tenant Pool Balance + 
    All Employee Wallet Balances
```

**Example:**
```
Initial Allocation:      100,000
After distribution:       50,000 (in pool) + 50,000 (in wallets) = 100,000 ✓
```

---

## Error Handling

| Error | Status | Cause | Solution |
|-------|--------|-------|----------|
| "Insufficient balance" | 400 | Pool < amount | Admin allocates more |
| "Only platform admins" | 403 | Wrong role | Use admin account |
| "Tenant not found" | 404 | Bad tenant_id | Check tenant ID |
| "Check constraint failed" | 500 | Negative balance | Bug in code (DB prevents) |

---

## Performance Tips

1. **Use indexes for queries:**
   - `allocation_logs(tenant_id, created_at DESC)`
   - `distribution_logs(to_user_id, created_at DESC)`

2. **Batch allocations:**
   - Allocate once per month, not daily

3. **Monitor table growth:**
   - `allocation_logs` grows O(1) per allocation
   - `distribution_logs` grows O(1) per award
   - `wallet_ledger` grows O(1) per transaction

---

## Monitoring Queries

### Current Pool Status
```sql
SELECT name, points_allocation_balance 
FROM tenants 
WHERE status = 'active';
```

### Daily Distribution Report
```sql
SELECT DATE(created_at), COUNT(*), SUM(amount)
FROM distribution_logs
WHERE created_at >= NOW() - INTERVAL 1 day
GROUP BY DATE(created_at);
```

### Employee Balance Report
```sql
SELECT u.first_name, u.last_name, w.balance
FROM wallets w
JOIN users u ON w.user_id = u.id
ORDER BY w.balance DESC
LIMIT 10;
```

---

## Troubleshooting Flowchart

```
Problem: Manager can't award points
  ├─ Check: Is tenant.points_allocation_balance > 0?
  │   ├─ No → Admin allocates more
  │   └─ Yes → Continue
  ├─ Check: Is amount <= pool balance?
  │   ├─ No → Request less
  │   └─ Yes → Continue
  ├─ Check: Is manager.org_role in [tenant_manager, hr_admin]?
  │   ├─ No → Use correct role
  │   └─ Yes → Check audit log for error details
  └─ Contact: Check audit_log for exact error

Problem: Points missing from accounting
  ├─ Check: SELECT SUM from all sources
  ├─ Run: Accounting check query
  ├─ Review: distribution_logs for recent changes
  └─ Contact: Restore from point-in-time backup if needed
```

---

## Role Matrix

| Role | Can Allocate | Can Delegate | Can Award | Limits |
|------|--------------|--------------|-----------|--------|
| Platform Admin | ✓ All tenants | ✗ | ✗ | None |
| Tenant Manager | ✗ | ✓ To leads | ✓ To team | Pool balance |
| Lead/Manager | ✗ | ✗ | ✓ To reports | Wallet balance |
| Employee | ✗ | ✗ | ✗ (peer-to-peer) | Own wallet |

---

## Quick Health Check

Run these queries to verify system health:

```sql
-- 1. Check schema exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'tenants' AND column_name = 'points_allocation_balance';

-- 2. Check constraints exist
SELECT constraint_name FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%positive%';

-- 3. Check recent allocations
SELECT COUNT(*) FROM allocation_logs WHERE created_at > NOW() - INTERVAL 1 day;

-- 4. Check accounting
SELECT 
    (SELECT SUM(points_allocation_balance) FROM tenants) as pool,
    (SELECT SUM(balance) FROM wallets) as wallets,
    (SELECT SUM(points_allocation_balance) + SUM(balance) FROM tenants, wallets) as total;
```

---

## Documentation References

| Document | Purpose |
|----------|---------|
| `docs/POINTS_ALLOCATION_SYSTEM.md` | Complete API guide |
| `POINTS_ALLOCATION_IMPLEMENTATION.md` | Implementation details |
| `SQL_TESTING_GUIDE.md` | SQL testing queries |
| `IMPLEMENTATION_SUMMARY.md` | File-by-file summary |
| This file | Quick reference |

---

## Version Info

- **Version:** 1.0
- **Release Date:** February 4, 2026
- **Status:** Production Ready
- **Python Version:** 3.8+
- **Database:** PostgreSQL 12+

---

**For detailed documentation, see:** `docs/POINTS_ALLOCATION_SYSTEM.md`
