# Budget Allocation System - Implementation Guide

## Overview

The Budget Allocation System implements a **3-tier hierarchical model** for managing employee recognition budgets in a multi-tenant SaaS platform:

```
┌─────────────────────────────────────────────────────────────────┐
│ Platform Admin (SaaS Provider)                                   │
│ └─> Allocates bulk budget to Tenant's "Company Pool"            │
└─────────────────────────────────────────────────────────────────┘
         │
         │ allocateTenant()
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Tenant (Company)                                                 │
│ ├─> tenants.budget_allocation_balance (Company Distribution Pool) │
│ └─> Tenant Manager distributes from pool                         │
└─────────────────────────────────────────────────────────────────┘
         │
         ├─ distributeToLead() ──→ Distribute to team leads
         │
         └─ awardToUser() ────→ Direct recognition award
         ↓
┌─────────────────────────────────────────────────────────────────┐
│ Employee                                                         │
│ └─> users.wallet.balance (Personal Spendable Budget)           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Database Schema

### New Columns

**tenants table:**
- `budget_allocated` (Decimal) - Total budget allocated by platform admin
  - CHECK constraint: `budget_allocated >= 0`
- `budget_allocation_balance` (Decimal) - Company's distribution pool (available for managers to distribute)
  - CHECK constraint: `budget_allocation_balance >= 0`

**wallets table:**
- `balance` - Already exists, represents personal spendable budget
  - CHECK constraint: `balance >= 0` (added/enforced)

### New Tables

#### `budget_allocation_logs`
Immutable audit trail for Platform Admin budget injections.

```sql
CREATE TABLE budget_allocation_logs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL (FK → tenants),
    admin_id UUID NOT NULL (FK → users),
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    reference_note TEXT,
    transaction_type VARCHAR(50) -- CREDIT_INJECTION, CLAWBACK, ADJUSTMENT
    previous_balance DECIMAL(15,2),
    new_balance DECIMAL(15,2),
    created_at TIMESTAMP WITH TIME ZONE
);
```

#### `platform_budget_billing_logs`
Platform-level billing audit for invoicing reconciliation.

```sql
CREATE TABLE platform_budget_billing_logs (
    id UUID PRIMARY KEY,
    admin_id UUID NOT NULL (FK → users),
    tenant_id UUID NOT NULL (FK → tenants),
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    reference_note TEXT,
    transaction_type VARCHAR(50) -- CREDIT_INJECTION, CLAWBACK, REVERSAL, REFUND
    invoice_number VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE
);
```

#### `budget_distribution_logs`
Tracks budget distribution from tenant pool to employees.

```sql
CREATE TABLE budget_distribution_logs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL (FK → tenants),
    from_user_id UUID NOT NULL (FK → users),
    to_user_id UUID NOT NULL (FK → users),
    amount DECIMAL(15,2) NOT NULL,
    transaction_type VARCHAR(50) -- RECOGNITION, MANUAL_AWARD, EVENT_BONUS
    reference_type VARCHAR(50),
    reference_id UUID,
    description TEXT,
    previous_pool_balance DECIMAL(15,2),
    new_pool_balance DECIMAL(15,2),
    created_at TIMESTAMP WITH TIME ZONE
);
```

---

## 2. Core Service: PointsService

**File:** `backend/core/points_service.py`

The `PointsService` class implements the three-tier allocation logic with proper transaction handling and audit trails.

### Method 1: `allocateToTenant()`

**Purpose:** Platform Admin allocates bulk points to a tenant.

**Signature:**
```python
PointsService.allocateToTenant(
    db: Session,
    tenant: Tenant,
    admin_user: User,
    amount: Decimal,
    currency: str = 'INR',
    reference_note: Optional[str] = None,
    invoice_number: Optional[str] = None
) -> Tuple[Tenant, AllocationLog, PlatformBillingLog]
```

**Flow:**
1. ✅ Verify `admin_user` is platform admin
2. ✅ Validate `amount > 0`
3. 🔄 Update `tenant.points_allocation_balance += amount`
4. 📝 Create `AllocationLog` (tenant-specific audit)
5. 📋 Create `PlatformBillingLog` (platform audit)
6. 🔔 Create `AuditLog` and `Feed` entries
7. 💾 `db.flush()` and return

**Example:**
```python
allocate_success = PointsService.allocateToTenant(
    db=db,
    tenant=triton_tenant,
    admin_user=platform_admin,
    amount=Decimal('50000'),
    currency='INR',
    reference_note='Monthly subscription allocation - Invoice #8842',
    invoice_number='INV-2026-0201-001'
)
# Result: triton_tenant.points_allocation_balance = 50,000
```

### Method 2: `delegateToLead()`

**Purpose:** Tenant Manager delegates points from company pool to a lead/manager.

**Signature:**
```python
PointsService.delegateToLead(
    db: Session,
    tenant: Tenant,
    from_manager: User,
    to_lead: User,
    amount: Decimal,
    description: Optional[str] = None
) -> Tuple[Tenant, Wallet, DistributionLog]
```

**Flow:**
1. ✅ Verify `from_manager` is tenant_manager or hr_admin
2. ✅ Validate `amount > 0`
3. ✅ Check `tenant.points_allocation_balance >= amount`
4. 🔄 Deduct from company pool: `tenant.points_allocation_balance -= amount`
5. 🔄 Credit lead's wallet: `lead_wallet.balance += amount`
6. 📝 Create `DistributionLog`
7. 📝 Create `WalletLedger` entry
8. 🔔 Create audit and feed entries
9. 💾 `db.flush()` and return

**Example:**
```python
wallet, ledger, log = PointsService.delegateToLead(
    db=db,
    tenant=triton_tenant,
    from_manager=manager,
    to_lead=department_head,
    amount=Decimal('10000'),
    description='Monthly budget for departmental recognition'
)
# Result:
# - triton_tenant.points_allocation_balance = 40,000
# - department_head.wallet.balance += 10,000
```

### Method 3: `awardToUser()`

**Purpose:** Award points to an employee's wallet (recognition, event bonus, etc.).

**Signature:**
```python
PointsService.awardToUser(
    db: Session,
    tenant: Tenant,
    from_user: User,
    to_user: User,
    amount: Decimal,
    reference_type: Optional[str] = None,
    reference_id: Optional[UUID] = None,
    description: Optional[str] = None
) -> Tuple[Wallet, WalletLedger, DistributionLog]
```

**Flow:**
1. ✅ Validate `amount > 0`
2. ✅ Check `tenant.points_allocation_balance >= amount`
3. 🔄 Deduct from company pool
4. 🔄 Credit employee's wallet
5. 📝 Create `DistributionLog`
6. 📝 Create `WalletLedger` entry
7. 🔔 Create public feed entry
8. 💾 `db.flush()` and return

**Example:**
```python
wallet, ledger, log = PointsService.awardToUser(
    db=db,
    tenant=triton_tenant,
    from_user=manager,
    to_user=employee,
    amount=Decimal('1000'),
    reference_type='recognition',
    reference_id=recognition_id,
    description='Outstanding performance - Q1 Project'
)
# Result:
# - triton_tenant.points_allocation_balance = 39,000
# - employee.wallet.balance += 1,000
```

### Method 4: `clawback_points()`

**Purpose:** Safety valve - Platform Admin claws back unspent points from tenant.

**Example Use:** Tenant subscription cancelled, prevent distributed points from being redeemed.

---

## 3. API Endpoints

### Platform Admin Routes

**File:** `backend/platform_admin/allocation_routes.py`

#### `POST /api/platform/allocations/allocate`
Allocate points to a tenant.

**Request:**
```json
{
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "amount": 50000,
    "currency": "INR",
    "reference_note": "Monthly subscription - Invoice #8842",
    "invoice_number": "INV-2026-0201-001"
}
```

**Response:**
```json
{
    "tenant_id": "550e8400-...",
    "tenant_name": "Triton Energy",
    "previous_balance": 0,
    "new_balance": 50000,
    "amount_allocated": 50000,
    "currency": "INR",
    "created_at": "2026-02-04T10:30:00Z"
}
```

#### `POST /api/platform/allocations/clawback`
Clawback points from a tenant.

**Request:**
```json
{
    "tenant_id": "550e8400-...",
    "amount": 10000,  // null = clawback entire balance
    "reason": "Subscription cancelled per request"
}
```

#### `GET /api/platform/allocations/history/{tenant_id}`
Get allocation history for a tenant.

#### `GET /api/platform/allocations/stats/{tenant_id}`
Get allocation statistics (balance, distributions, etc.).

#### `GET /api/platform/allocations/all`
Get allocation stats for all active tenants.

---

### Tenant Manager Routes

**File:** `backend/tenants/distribution_routes.py`

#### `GET /api/allocations/pool`
Get current allocation pool status.

**Response:**
```json
{
    "current_balance": 50000,
    "total_allocated_today": 5000,
    "distribution_count": 12,
    "manager_can_distribute": true,
    "message": "You have 50,000 points available to distribute to your team."
}
```

#### `POST /api/allocations/distribute-to-lead`
Delegate points from pool to a lead.

**Request:**
```json
{
    "to_user_id": "770e8400-...",
    "amount": 5000,
    "description": "Monthly recognition budget"
}
```

#### `POST /api/allocations/award-points`
Award points directly to an employee.

**Request:**
```json
{
    "to_user_id": "770e8400-...",
    "amount": 1000,
    "reference_type": "recognition",
    "reference_id": "550e8400-...",
    "description": "Outstanding Q1 performance"
}
```

#### `GET /api/allocations/history`
Get distribution history.

---

## 4. Integration with Recognition System

The recognition system now uses `PointsService.awardToUser()` instead of directly crediting wallets.

**Before:**
```python
# Direct wallet credit (old way)
wallet.balance += points
wallet.lifetime_earned += points
```

**After:**
```python
# Via PointsService (new way)
wallet, ledger, log = PointsService.awardToUser(
    db=db,
    tenant=tenant,
    from_user=manager,
    to_user=employee,
    amount=points,
    reference_type='recognition',
    reference_id=recognition_id
)
```

**Benefits:**
- ✅ Proper tenant pool balance verification
- ✅ Automatic audit trail
- ✅ Feed entries created
- ✅ Distributed log tracking
- ✅ Consistent transaction handling

---

## 5. Safety Mechanisms

### 1. Database Constraints (Hard Safety Net)

```sql
-- Prevent negative balances
ALTER TABLE tenants 
ADD CONSTRAINT positive_allocation_balance CHECK (points_allocation_balance >= 0);

ALTER TABLE wallets 
ADD CONSTRAINT positive_balance CHECK (balance >= 0);
```

**Why:** If code has a bug and tries to deduct more points than available, the database will reject the transaction. This is the final safety net.

### 2. Service-Level Validation

```python
# PointsService always checks balance before deducting
if Decimal(str(tenant.points_allocation_balance)) < Decimal(str(amount)):
    raise PointsAllocationError(
        f"Insufficient balance. Available: {tenant.points_allocation_balance}, "
        f"Requested: {amount}"
    )
```

### 3. API-Level Validation

```python
# Routes validate user roles and permissions
if not admin_user.is_platform_admin:
    raise HTTPException(status_code=403, detail="Only platform admins...")
```

### 4. Audit Trails

Every transaction creates:
- ✅ `AllocationLog` - For billing reconciliation
- ✅ `DistributionLog` - For tracking point flow
- ✅ `WalletLedger` - For wallet history
- ✅ `AuditLog` - For compliance
- ✅ `Feed` - For social visibility

---

## 6. Data Flow Examples

### Scenario: Quarterly Allocation & Distribution

**Step 1: Platform Admin allocates Q1 budget**
```
POST /api/platform/allocations/allocate
├─ Admin: allocates 100,000 points to Triton Energy
├─ Action: tenants[Triton].points_allocation_balance = 100,000
├─ Logs: AllocationLog, PlatformBillingLog, AuditLog
└─ Result: ✅ Triton has 100,000 points in distribution pool
```

**Step 2: Triton Manager allocates to Department Lead**
```
POST /api/allocations/distribute-to-lead
├─ Manager: delegates 30,000 to HR Lead
├─ Action: 
│   ├─ tenants[Triton].points_allocation_balance = 70,000
│   └─ users[HR_Lead].wallet.balance = 30,000
├─ Logs: DistributionLog, WalletLedger, AuditLog
└─ Result: ✅ HR Lead has 30,000 in personal wallet
```

**Step 3: HR Lead recognizes Employee A**
```
POST /api/recognitions
├─ Lead: awards 1,000 points to Employee A
├─ Action:
│   ├─ tenants[Triton].points_allocation_balance = 69,000
│   ├─ users[Employee_A].wallet.balance = 1,000
│   └─ users[HR_Lead].wallet.balance = 29,000 (unchanged in this flow)
├─ Logs: DistributionLog, WalletLedger, Feed, AuditLog
└─ Result: ✅ Employee A can redeem 1,000 points
```

**Accounting Summary:**
```
Initial Tenant Pool:           100,000
After delegation to Lead:     - 30,000 (went to HR Lead's wallet)
Available in Pool:              70,000

After recognition to Emp A:   - 1,000  (went to Employee's wallet)
Available in Pool:              69,000

Distributed to Employees:       1,000
Held by Lead:                  30,000
Floating in Pool:              69,000
─────────────────────────────────────
Total:                        100,000 ✅
```

---

## 7. Deployment Checklist

- [ ] Run migration: `20260204_add_points_allocation_system.sql`
- [ ] Verify database schema updates
- [ ] Deploy backend changes
- [ ] Update API documentation
- [ ] Create frontend components:
  - [ ] Platform Admin → Allocate Points form
  - [ ] Tenant Manager → Distribution Pool card
  - [ ] Recognition → Pool balance check
- [ ] Test end-to-end allocation flow
- [ ] Monitor audit logs for data consistency
- [ ] Train admins on allocation system

---

## 8. API Summary Table

| Endpoint | Method | Actor | Purpose |
|----------|--------|-------|---------|
| `/platform/allocations/allocate` | POST | Platform Admin | Allocate to tenant |
| `/platform/allocations/clawback` | POST | Platform Admin | Clawback from tenant |
| `/platform/allocations/history/{tenant_id}` | GET | Platform Admin | View allocation history |
| `/platform/allocations/stats/{tenant_id}` | GET | Platform Admin | View allocation stats |
| `/allocations/pool` | GET | Tenant Manager | View available pool |
| `/allocations/distribute-to-lead` | POST | Tenant Manager | Delegate to lead |
| `/allocations/award-points` | POST | Tenant Manager | Award to employee |
| `/allocations/history` | GET | Tenant Manager | View distribution history |

---

## 9. Troubleshooting

### Q: "Insufficient balance" error when awarding points

**Cause:** Tenant's `points_allocation_balance` is zero or less than requested amount.

**Solution:** Platform Admin must allocate points first via `/api/platform/allocations/allocate`

### Q: Points missing from expected location

**Solution:** Check audit logs and distribution logs:
```sql
SELECT * FROM distribution_logs WHERE tenant_id = ? ORDER BY created_at DESC;
SELECT * FROM allocation_logs WHERE tenant_id = ? ORDER BY created_at DESC;
```

### Q: Tenant locked out from distributing points

**Cause:** All allocation balance exhausted.

**Solution:** Platform Admin allocates more points.

---

## 10. Future Enhancements

1. **Expiry Policies:** Automatic expiry of unused points
2. **Recurring Allocations:** Monthly/quarterly auto-refill
3. **Budget Limits:** Cap points per manager per month
4. **Approval Workflows:** Require platform approval for large awards
5. **Pools by Department:** Track pool balance per department
6. **Real-time Notifications:** Alert when pool running low
