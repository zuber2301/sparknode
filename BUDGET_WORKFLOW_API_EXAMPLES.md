# Budget Allocation Workflow - API Examples

## Complete Example Flow

This document shows a complete example of the three-level budget allocation workflow.

## Scenario: Q1 2026 Budget Allocation for TechCorp

### Step 1: Platform Admin Allocates to Tenant

**Request**:
```bash
curl -X POST "http://localhost:8000/api/budget-workflow/tenant-allocation?tenant_id=550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer platform_admin_token" \
  -d '{
    "total_allocated_budget": 250000,
    "description": "Q1 2026 Budget Allocation for TechCorp"
  }'
```

**Response** (201 Created):
```json
{
  "id": "3b82f680-b3d4-4a17-9d1e-8b5cf6c9a2f1",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "total_allocated_budget": 250000,
  "remaining_balance": 250000,
  "status": "active",
  "allocation_date": "2026-02-09T10:15:00Z",
  "allocated_by": "platform_admin_user_id",
  "created_at": "2026-02-09T10:15:00Z",
  "updated_at": "2026-02-09T10:15:00Z"
}
```

**Audit Log Entry**:
```json
{
  "action": "tenant_budget_allocated",
  "entity_type": "tenant_budget_allocation",
  "entity_id": "3b82f680-b3d4-4a17-9d1e-8b5cf6c9a2f1",
  "actor_id": "platform_admin_user_id",
  "new_values": {
    "total_allocated_budget": "250000",
    "description": "Q1 2026 Budget Allocation for TechCorp"
  },
  "created_at": "2026-02-09T10:15:00Z"
}
```

**Ledger Entry**:
```json
{
  "id": "ledger_entry_1",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "transaction_type": "tenant_allocation",
  "source_entity_type": "tenant",
  "source_entity_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 250000,
  "balance_before": 0,
  "balance_after": 250000,
  "description": "Initial budget allocation: Q1 2026 Budget Allocation for TechCorp",
  "actor_id": "platform_admin_user_id",
  "created_at": "2026-02-09T10:15:00Z"
}
```

### Step 2: Tenant Manager Allocates to Departments

First, get the tenant's available departments:

**Request**:
```bash
curl -X GET "http://localhost:8000/api/tenants/departments" \
  -H "Authorization: Bearer tenant_manager_token"
```

**Response**:
```json
[
  {
    "id": "dept_001_sales",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Sales",
    "parent_id": null,
    "budget_balance": 0,
    "created_at": "2026-02-01T00:00:00Z"
  },
  {
    "id": "dept_002_engineering",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Engineering",
    "parent_id": null,
    "budget_balance": 0,
    "created_at": "2026-02-01T00:00:00Z"
  },
  {
    "id": "dept_003_marketing",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Marketing",
    "parent_id": null,
    "budget_balance": 0,
    "created_at": "2026-02-01T00:00:00Z"
  }
]
```

#### Allocation 2A: Sales Department

**Request**:
```bash
curl -X POST "http://localhost:8000/api/budget-workflow/department-allocation" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tenant_manager_token" \
  -d '{
    "tenant_budget_allocation_id": "3b82f680-b3d4-4a17-9d1e-8b5cf6c9a2f1",
    "department_id": "dept_001_sales",
    "allocated_budget": 100000,
    "description": "Sales Q1 Budget"
  }'
```

**Response** (201 Created):
```json
{
  "id": "3b82f680-b3d4-4a17-9d1e-sales001",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "department_id": "dept_001_sales",
  "tenant_budget_allocation_id": "3b82f680-b3d4-4a17-9d1e-8b5cf6c9a2f1",
  "allocated_budget": 100000,
  "distributed_budget": 0,
  "remaining_budget": 100000,
  "status": "active",
  "allocation_date": "2026-02-09T10:30:00Z",
  "allocated_by": "tenant_manager_user_id",
  "created_at": "2026-02-09T10:30:00Z",
  "updated_at": "2026-02-09T10:30:00Z"
}
```

#### Allocation 2B: Engineering Department

**Request**:
```bash
curl -X POST "http://localhost:8000/api/budget-workflow/department-allocation" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tenant_manager_token" \
  -d '{
    "tenant_budget_allocation_id": "3b82f680-b3d4-4a17-9d1e-8b5cf6c9a2f1",
    "department_id": "dept_002_engineering",
    "allocated_budget": 120000,
    "description": "Engineering Q1 Budget"
  }'
```

**Response** (201 Created):
```json
{
  "id": "3b82f680-b3d4-4a17-9d1e-engr001",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "department_id": "dept_002_engineering",
  "tenant_budget_allocation_id": "3b82f680-b3d4-4a17-9d1e-8b5cf6c9a2f1",
  "allocated_budget": 120000,
  "distributed_budget": 0,
  "remaining_budget": 120000,
  "status": "active",
  "allocation_date": "2026-02-09T10:35:00Z",
  "allocated_by": "tenant_manager_user_id",
  "created_at": "2026-02-09T10:35:00Z",
  "updated_at": "2026-02-09T10:35:00Z"
}
```

#### Allocation 2C: Marketing Department

**Request**:
```bash
curl -X POST "http://localhost:8000/api/budget-workflow/department-allocation" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tenant_manager_token" \
  -d '{
    "tenant_budget_allocation_id": "3b82f680-b3d4-4a17-9d1e-8b5cf6c9a2f1",
    "department_id": "dept_003_marketing",
    "allocated_budget": 30000,
    "description": "Marketing Q1 Budget"
  }'
```

**Response** (201 Created):
```json
{
  "id": "3b82f680-b3d4-4a17-9d1e-mktg001",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "department_id": "dept_003_marketing",
  "tenant_budget_allocation_id": "3b82f680-b3d4-4a17-9d1e-8b5cf6c9a2f1",
  "allocated_budget": 30000,
  "distributed_budget": 0,
  "remaining_budget": 30000,
  "status": "active",
  "allocation_date": "2026-02-09T10:40:00Z",
  "allocated_by": "tenant_manager_user_id",
  "created_at": "2026-02-09T10:40:00Z",
  "updated_at": "2026-02-09T10:40:00Z"
}
```

### Step 3: Department Lead Allocates to Employees

#### Sales Manager allocates to Sales Team

First, get employees in the Sales department:

**Request**:
```bash
curl -X GET "http://localhost:8000/api/users?department_id=dept_001_sales" \
  -H "Authorization: Bearer dept_lead_token"
```

**Response**:
```json
[
  {
    "id": "emp_001_john",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "first_name": "John",
    "last_name": "Smith",
    "corporate_email": "john.smith@techcorp.com",
    "department_id": "dept_001_sales",
    "org_role": "tenant_user"
  },
  {
    "id": "emp_002_sarah",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "first_name": "Sarah",
    "last_name": "Johnson",
    "corporate_email": "sarah.johnson@techcorp.com",
    "department_id": "dept_001_sales",
    "org_role": "tenant_user"
  },
  {
    "id": "emp_003_mike",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "first_name": "Mike",
    "last_name": "Williams",
    "corporate_email": "mike.williams@techcorp.com",
    "department_id": "dept_001_sales",
    "org_role": "tenant_user"
  }
]
```

#### Allocation 3A: Points to John

**Request**:
```bash
curl -X POST "http://localhost:8000/api/budget-workflow/employee-allocation" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dept_lead_token" \
  -d '{
    "department_budget_allocation_id": "3b82f680-b3d4-4a17-9d1e-sales001",
    "employee_id": "emp_001_john",
    "allocated_points": 25000,
    "description": "Q1 Performance Budget"
  }'
```

**Response** (201 Created):
```json
{
  "id": "3b82f680-b3d4-4a17-9d1e-emp001",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "department_budget_allocation_id": "3b82f680-b3d4-4a17-9d1e-sales001",
  "employee_id": "emp_001_john",
  "allocated_points": 25000,
  "spent_points": 0,
  "remaining_points": 25000,
  "status": "active",
  "allocation_date": "2026-02-09T11:00:00Z",
  "allocated_by": "dept_lead_user_id",
  "created_at": "2026-02-09T11:00:00Z",
  "updated_at": "2026-02-09T11:00:00Z"
}
```

#### Allocation 3B: Points to Sarah

**Request**:
```bash
curl -X POST "http://localhost:8000/api/budget-workflow/employee-allocation" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dept_lead_token" \
  -d '{
    "department_budget_allocation_id": "3b82f680-b3d4-4a17-9d1e-sales001",
    "employee_id": "emp_002_sarah",
    "allocated_points": 30000,
    "description": "Q1 Performance Budget"
  }'
```

**Response** (201 Created):
```json
{
  "id": "3b82f680-b3d4-4a17-9d1e-emp002",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "department_budget_allocation_id": "3b82f680-b3d4-4a17-9d1e-sales001",
  "employee_id": "emp_002_sarah",
  "allocated_points": 30000,
  "spent_points": 0,
  "remaining_points": 30000,
  "status": "active",
  "allocation_date": "2026-02-09T11:05:00Z",
  "allocated_by": "dept_lead_user_id",
  "created_at": "2026-02-09T11:05:00Z",
  "updated_at": "2026-02-09T11:05:00Z"
}
```

#### Allocation 3C: Points to Mike

**Request**:
```bash
curl -X POST "http://localhost:8000/api/budget-workflow/employee-allocation" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dept_lead_token" \
  -d '{
    "department_budget_allocation_id": "3b82f680-b3d4-4a17-9d1e-sales001",
    "employee_id": "emp_003_mike",
    "allocated_points": 20000,
    "description": "Q1 Performance Budget"
  }'
```

**Response** (201 Created):
```json
{
  "id": "3b82f680-b3d4-4a17-9d1e-emp003",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "department_budget_allocation_id": "3b82f680-b3d4-4a17-9d1e-sales001",
  "employee_id": "emp_003_mike",
  "allocated_points": 20000,
  "spent_points": 0,
  "remaining_points": 20000,
  "status": "active",
  "allocation_date": "2026-02-09T11:10:00Z",
  "allocated_by": "dept_lead_user_id",
  "created_at": "2026-02-09T11:10:00Z",
  "updated_at": "2026-02-09T11:10:00Z"
}
```

### Step 4: View Budget Allocations

#### Get Tenant Summary

**Request**:
```bash
curl -X GET "http://localhost:8000/api/budget-workflow/summary/tenant/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer token"
```

**Response**:
```json
{
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "total_allocated": 250000,
  "total_distributed_to_departments": 250000,
  "total_distributed_to_employees": 75000,
  "remaining_available": 0,
  "percentage_distributed": 30.0,
  "department_count": 3,
  "employee_count": 3
}
```

#### Get Department Summary (Sales)

**Request**:
```bash
curl -X GET "http://localhost:8000/api/budget-workflow/summary/department/3b82f680-b3d4-4a17-9d1e-sales001" \
  -H "Authorization: Bearer token"
```

**Response**:
```json
{
  "department_id": "dept_001_sales",
  "department_name": "Sales",
  "allocated_budget": 100000,
  "distributed_to_employees": 75000,
  "remaining_budget": 25000,
  "percentage_distributed": 75.0,
  "employee_allocations_count": 3
}
```

## Error Examples

### Error: Insufficient Budget

**Request** (Trying to allocate more than available):
```bash
curl -X POST "http://localhost:8000/api/budget-workflow/department-allocation" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tenant_manager_token" \
  -d '{
    "tenant_budget_allocation_id": "3b82f680-b3d4-4a17-9d1e-8b5cf6c9a2f1",
    "department_id": "dept_001_sales",
    "allocated_budget": 300000
  }'
```

**Response** (400 Bad Request):
```json
{
  "detail": "Insufficient budget. Remaining: 250000"
}
```

### Error: Unauthorized

**Request** (Non-manager trying to allocate):
```bash
curl -X POST "http://localhost:8000/api/budget-workflow/department-allocation" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer regular_user_token" \
  -d '{
    "tenant_budget_allocation_id": "3b82f680-b3d4-4a17-9d1e-8b5cf6c9a2f1",
    "department_id": "dept_001_sales",
    "allocated_budget": 50000
  }'
```

**Response** (403 Forbidden):
```json
{
  "detail": "Only tenant managers can allocate to departments"
}
```

### Error: Cross-Department Allocation

**Request** (Dept lead trying to allocate outside their department):
```bash
curl -X POST "http://localhost:8000/api/budget-workflow/employee-allocation" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sales_dept_lead_token" \
  -d '{
    "department_budget_allocation_id": "3b82f680-b3d4-4a17-9d1e-engr001",
    "employee_id": "emp_from_engineering",
    "allocated_points": 5000
  }'
```

**Response** (403 Forbidden):
```json
{
  "detail": "Can only allocate to your own department"
}
```

## Ledger Entries Created During Workflow

The budget_allocation_ledger captures all transactions:

```sql
SELECT * FROM budget_allocation_ledger ORDER BY created_at;
```

Output:
```
1. Tenant allocation: 250000 (0 → 250000)
2. Department Sales: 100000 (250000 → 150000)
3. Department Engineering: 120000 (150000 → 30000)
4. Department Marketing: 30000 (30000 → 0)
5. Employee John: 25000 (100000 → 75000)
6. Employee Sarah: 30000 (75000 → 45000)
7. Employee Mike: 20000 (45000 → 25000)
```

## Audit Log Entries

```sql
SELECT action, entity_type, actor_id, created_at FROM audit_log 
WHERE action LIKE '%budget%' 
ORDER BY created_at;
```

Output shows all allocation actions with actors and timestamps.

---

**This example demonstrates the complete three-level budget allocation workflow.**
