# Budget Allocation Workflow Implementation

## Overview

A three-level budget allocation system has been implemented in SparkNode, enabling hierarchical budget management from platform admin down to individual employees.

## Architecture

### Three-Level Hierarchy

```
Platform Admin
    ↓ (allocates budget)
Tenant (Total Allocated Budget)
    ↓ (distributes budget)
Department Manager (Department Budget)
    ↓ (distributes points)
Employees (Points)
```

### 1. Platform Admin → Tenant Allocation
- **Actor**: Platform Admin
- **Action**: Allocates budget to a tenant
- **Display**: Shows as "Total Allocated Budget"
- **Endpoint**: `POST /api/budget-workflow/tenant-allocation?tenant_id={tenantId}`
- **Database**: `tenant_budget_allocations` table
- **Model**: `TenantBudgetAllocation`

### 2. Tenant Manager → Department Distribution
- **Actor**: Tenant Manager
- **Action**: Distributes budget from tenant allocation to departments
- **Constraint**: Sum of all department allocations ≤ total allocated budget
- **Endpoint**: `POST /api/budget-workflow/department-allocation`
- **Database**: `department_budget_allocations` table
- **Model**: `DepartmentBudgetAllocation`

### 3. Department Lead → Employee Points Distribution
- **Actor**: Department Lead / Tenant Lead
- **Action**: Distributes points to employees in their department
- **Constraint**: Sum of all employee allocations ≤ department budget
- **Endpoint**: `POST /api/budget-workflow/employee-allocation`
- **Database**: `employee_points_allocations` table
- **Model**: `EmployeePointsAllocation`

## Database Schema

### New Tables

#### `tenant_budget_allocations`
```sql
- id (UUID, PK)
- tenant_id (UUID, FK, UNIQUE)
- total_allocated_budget (DECIMAL)
- remaining_balance (DECIMAL)
- status (VARCHAR: active/inactive/closed)
- allocation_date (TIMESTAMP)
- allocated_by (UUID, FK to users)
- created_at, updated_at
```

#### `department_budget_allocations`
```sql
- id (UUID, PK)
- tenant_id (UUID, FK)
- department_id (UUID, FK)
- tenant_budget_allocation_id (UUID, FK)
- allocated_budget (DECIMAL)
- distributed_budget (DECIMAL)  # Sum of employee points
- remaining_budget (DECIMAL)    # Calculated
- status (VARCHAR)
- allocation_date (TIMESTAMP)
- allocated_by (UUID)
- created_at, updated_at
```

#### `employee_points_allocations`
```sql
- id (UUID, PK)
- tenant_id (UUID, FK)
- department_budget_allocation_id (UUID, FK)
- employee_id (UUID, FK)
- allocated_points (DECIMAL)
- spent_points (DECIMAL)
- remaining_points (DECIMAL)    # Calculated
- status (VARCHAR)
- allocation_date (TIMESTAMP)
- allocated_by (UUID)
- created_at, updated_at
```

#### `budget_allocation_ledger`
```sql
- id (UUID, PK)
- tenant_id (UUID, FK)
- transaction_type (VARCHAR): tenant_allocation/dept_allocation/employee_allocation/allocation_reversal/points_spend
- source_entity_type (VARCHAR): tenant/department/employee
- source_entity_id (UUID)
- target_entity_type (VARCHAR): department/employee
- target_entity_id (UUID)
- amount (DECIMAL)
- balance_before (DECIMAL)
- balance_after (DECIMAL)
- description (TEXT)
- actor_id (UUID, FK)
- created_at (TIMESTAMP)
```

### Updated Tables

#### `tenants`
- Added `total_allocated_budget` (DECIMAL)
- Added `remaining_allocated_budget` (DECIMAL)

#### `departments`
- Added `allocated_budget` (DECIMAL)
- Added `distributed_budget` (DECIMAL)

#### `wallets`
- Added `allocated_points` (DECIMAL)

## API Endpoints

### Level 1: Tenant Allocation (Platform Admin)

#### POST `/api/budget-workflow/tenant-allocation?tenant_id={tenantId}`
Allocate budget to a tenant (creates or updates).

**Request Body**:
```json
{
  "total_allocated_budget": 10000,
  "description": "Q1 2026 Budget Allocation"
}
```

**Response**:
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "total_allocated_budget": 10000,
  "remaining_balance": 10000,
  "status": "active",
  "allocation_date": "2026-02-09T...",
  "allocated_by": "uuid",
  "created_at": "2026-02-09T...",
  "updated_at": "2026-02-09T..."
}
```

#### GET `/api/budget-workflow/tenant-allocation/{tenant_id}`
Get tenant's total allocated budget.

---

### Level 2: Department Allocation (Tenant Manager)

#### POST `/api/budget-workflow/department-allocation`
Allocate budget to a department.

**Request Body**:
```json
{
  "tenant_budget_allocation_id": "uuid",
  "department_id": "uuid",
  "allocated_budget": 2500,
  "description": "Sales Department Q1"
}
```

**Response**:
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "department_id": "uuid",
  "tenant_budget_allocation_id": "uuid",
  "allocated_budget": 2500,
  "distributed_budget": 0,
  "remaining_budget": 2500,
  "status": "active",
  "allocation_date": "2026-02-09T...",
  "allocated_by": "uuid",
  "created_at": "2026-02-09T...",
  "updated_at": "2026-02-09T..."
}
```

#### GET `/api/budget-workflow/department-allocations?tenant_budget_allocation_id={id}`
Get all department allocations for a tenant allocation.

#### GET `/api/budget-workflow/department-allocation/{department_allocation_id}`
Get a specific department allocation.

---

### Level 3: Employee Points Allocation (Department Lead)

#### POST `/api/budget-workflow/employee-allocation`
Allocate points to an employee.

**Request Body**:
```json
{
  "department_budget_allocation_id": "uuid",
  "employee_id": "uuid",
  "allocated_points": 500,
  "description": "Performance Bonus"
}
```

**Response**:
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "department_budget_allocation_id": "uuid",
  "employee_id": "uuid",
  "allocated_points": 500,
  "spent_points": 0,
  "remaining_points": 500,
  "status": "active",
  "allocation_date": "2026-02-09T...",
  "allocated_by": "uuid",
  "created_at": "2026-02-09T...",
  "updated_at": "2026-02-09T..."
}
```

#### GET `/api/budget-workflow/employee-allocation/{employee_allocation_id}`
Get a specific employee allocation.

#### GET `/api/budget-workflow/employee-allocations?department_budget_allocation_id={id}&department_id={id}`
Get employee allocations (filter by department allocation or department).

---

### Dashboard Endpoints

#### GET `/api/budget-workflow/summary/tenant/{tenant_id}`
Get budget allocation summary for a tenant.

**Response**:
```json
{
  "tenant_id": "uuid",
  "total_allocated": 10000,
  "total_distributed_to_departments": 7500,
  "total_distributed_to_employees": 5000,
  "remaining_available": 2500,
  "percentage_distributed": 50.0,
  "department_count": 3,
  "employee_count": 15
}
```

#### GET `/api/budget-workflow/summary/department/{department_allocation_id}`
Get budget allocation summary for a department.

**Response**:
```json
{
  "department_id": "uuid",
  "department_name": "Sales",
  "allocated_budget": 2500,
  "distributed_to_employees": 2000,
  "remaining_budget": 500,
  "percentage_distributed": 80.0,
  "employee_allocations_count": 5
}
```

---

## Validations & Constraints

### Tenant Allocation
- Only platform admins can allocate to tenants
- Creates or updates (single allocation per tenant)

### Department Allocation
- Only tenant managers can allocate
- Sum of all departments ≤ total tenant allocation
- Automatic deduction from remaining balance
- Can be updated to adjust amounts

### Employee Points Allocation
- Only department leads can allocate to their own department
- Cannot allocate to employees outside their department
- Sum of all employees ≤ department allocation
- Can be updated to adjust amounts

## Audit & Compliance

All transactions are logged in `budget_allocation_ledger`:

```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "transaction_type": "employee_allocation",
  "source_entity_type": "department",
  "source_entity_id": "uuid",
  "target_entity_type": "employee",
  "target_entity_id": "uuid",
  "amount": 500,
  "balance_before": 2500,
  "balance_after": 2000,
  "description": "Employee points allocation",
  "actor_id": "uuid",
  "created_at": "2026-02-09T..."
}
```

Audit logs are also created in the `audit_log` table for all allocation actions.

## Frontend Components

### BudgetWorkflow.jsx

Located at `/frontend/src/pages/BudgetWorkflow.jsx`

#### Components:
1. **PlatformAdminView** - Allocate to tenants
2. **TenantManagerView** - Distribute to departments
3. **DepartmentLeadView** - Distribute to employees

#### Features:
- Role-based views
- Real-time budget calculations
- Budget constraints validation
- Modal forms for allocations
- Dashboard cards showing budget status
- Allocation history tables
- Progress bars for utilization

#### Key Props:
- `tenantAllocation` - Current tenant's allocation
- `deptAllocations` - Department allocations
- `employeeAllocations` - Employee allocations
- `departments` - Available departments
- `deptUsers` - Employees in department

## Workflow Example

1. **Platform Admin**:
   - Navigates to Budget Allocation
   - Allocates $100,000 to "Acme Corp" tenant
   - Total Allocated Budget: $100,000

2. **Tenant Manager (Acme Corp)**:
   - Navigates to Budget Distribution
   - Sees Total Allocated Budget: $100,000
   - Allocates $40,000 to Sales department
   - Allocates $35,000 to Engineering department
   - Allocates $25,000 to HR department
   - Remaining: $0 (full allocation)

3. **Department Lead (Sales)**:
   - Navigates to Points Distribution
   - Sees Department Budget: $40,000
   - Allocates 1000 points to John ($500)
   - Allocates 1200 points to Sarah ($600)
   - Allocates 800 points to Mike ($400)
   - Remaining: $37,500

4. **Employee (John)**:
   - Receives 1000 points in wallet
   - Can use points for recognition or redemption
   - Points deducted when spent

## Migration

Run the migration to create new tables:

```bash
# The migration file is located at:
# database/migrations/20260209_implement_budget_workflow.sql

# Apply manually or via your migration tool
psql -U sparknode -d sparknode -f database/migrations/20260209_implement_budget_workflow.sql
```

## Error Handling

- **Insufficient Budget**: Returns 400 with message if allocation exceeds available
- **Unauthorized**: Returns 403 if user lacks required role
- **Not Found**: Returns 404 if entity not found
- **Validation Error**: Returns 400 with detailed validation message

## Future Enhancements

1. **Budget Scheduling**: Schedule budget releases over time
2. **Budget Rollover**: Handle unused budget carryover
3. **Budget Approval Workflow**: Multi-level approvals
4. **Budget Forecasting**: Predict spend based on historical data
5. **Real-time Alerts**: Notify when utilization thresholds reached
6. **Budget Analytics**: Advanced reporting and visualization
7. **Budget Templates**: Reusable budget patterns
