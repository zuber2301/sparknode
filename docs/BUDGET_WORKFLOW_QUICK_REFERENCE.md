# Budget Allocation Workflow - Quick Reference

## User Roles & Access

| Role | Can Access | Actions |
|------|-----------|---------|
| Platform Admin | Tenant allocations | Allocate budget to tenant (Total Allocated Budget) |
| Tenant Manager | Department allocations | Distribute from total to departments |
| Department Lead | Employee allocations | Distribute department budget to employees as points |
| Employee | Own allocation | View their points, use for recognition/redemption |

## Key Terms

- **Total Allocated Budget**: Budget allocated by platform admin to tenant
- **Department Budget**: Budget allocated by tenant manager to department
- **Employee Points**: Points allocated by department lead to employee

## Database Tables

| Table | Purpose |
|-------|---------|
| `tenant_budget_allocations` | Platform admin → tenant allocations |
| `department_budget_allocations` | Tenant manager → department allocations |
| `employee_points_allocations` | Department lead → employee allocations |
| `budget_allocation_ledger` | Immutable audit log of all transactions |

## API Routes

### Tenant Allocation (Platform Admin)
```
POST   /api/budget-workflow/tenant-allocation?tenant_id={id}
GET    /api/budget-workflow/tenant-allocation/{tenant_id}
```

### Department Allocation (Tenant Manager)
```
POST   /api/budget-workflow/department-allocation
GET    /api/budget-workflow/department-allocations?tenant_budget_allocation_id={id}
GET    /api/budget-workflow/department-allocation/{id}
```

### Employee Allocation (Department Lead)
```
POST   /api/budget-workflow/employee-allocation
GET    /api/budget-workflow/employee-allocations?department_budget_allocation_id={id}
GET    /api/budget-workflow/employee-allocation/{id}
```

### Dashboard Summaries
```
GET    /api/budget-workflow/summary/tenant/{tenant_id}
GET    /api/budget-workflow/summary/department/{department_allocation_id}
```

## Frontend Routes

```
/budget-workflow     # Main workflow page (role-based views)
```

## Models

### TenantBudgetAllocation
```python
id: UUID
tenant_id: UUID
total_allocated_budget: Decimal
remaining_balance: Decimal
status: str (active/inactive/closed)
allocation_date: DateTime
allocated_by: UUID
created_at, updated_at: DateTime
```

### DepartmentBudgetAllocation
```python
id: UUID
tenant_id: UUID
department_id: UUID
tenant_budget_allocation_id: UUID
allocated_budget: Decimal
distributed_budget: Decimal
remaining_budget: Decimal
status: str
allocation_date: DateTime
allocated_by: UUID
created_at, updated_at: DateTime
```

### EmployeePointsAllocation
```python
id: UUID
tenant_id: UUID
department_budget_allocation_id: UUID
employee_id: UUID
allocated_points: Decimal
spent_points: Decimal
remaining_points: Decimal (calculated)
status: str
allocation_date: DateTime
allocated_by: UUID
created_at, updated_at: DateTime
```

## Validation Rules

1. **Tenant Allocation**
   - Only platform admins can allocate
   - One allocation per tenant
   - Amount ≥ 0

2. **Department Allocation**
   - Only tenant managers can allocate
   - Sum of departments ≤ tenant total
   - Automatic deduction from remaining

3. **Employee Allocation**
   - Only dept leads of that department
   - Cannot allocate outside department
   - Sum of employees ≤ department total

## Common Workflows

### Scenario 1: Complete Budget Flow
1. Platform Admin allocates $100k to Acme Corp
2. Tenant Manager splits:
   - Sales: $40k
   - Engineering: $35k
   - HR: $25k
3. Department Leads split their budgets to employees
4. Employees use points for recognition/redemption

### Scenario 2: Budget Adjustment
1. Platform Admin increases Acme Corp to $120k
2. Remaining balance increases
3. Tenant Manager can allocate additional $20k to departments
4. Department breakdown remains unchanged

### Scenario 3: Mid-quarter Reallocation
1. Sales dept lead realizes they need more
2. Requests additional points from Tenant Manager
3. Tenant Manager reallocates from another dept
4. Department leads re-distribute to their employees

## Ledger Entries

All allocations create ledger entries:

```json
{
  "transaction_type": "employee_allocation",
  "source_entity_type": "department",
  "target_entity_type": "employee",
  "amount": 500,
  "balance_before": 2500,
  "balance_after": 2000,
  "actor_id": "dept_lead_uuid",
  "created_at": "2026-02-09T10:30:00Z"
}
```

## Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Insufficient budget" | Allocation exceeds available | Reduce amount or get more budget |
| "Only platform admins..." | Wrong role | Login as platform admin |
| "Can only allocate to your department" | Cross-department allocation | Only allocate to own department |
| "Department not found" | Invalid department_id | Verify department exists in tenant |
| "No budget allocation for tenant" | Not allocated by platform admin | Ask platform admin to allocate first |

## Performance Considerations

- Remaining balances are calculated (not stored) for consistency
- Ledger is immutable for audit compliance
- Indexes on tenant_id, department_id, employee_id for fast queries
- Consider archiving old allocations monthly

## Testing Endpoints

### Test Tenant Allocation
```bash
curl -X POST "http://localhost:8000/api/budget-workflow/tenant-allocation?tenant_id=UUID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"total_allocated_budget": 10000}'
```

### Test Department Allocation
```bash
curl -X POST "http://localhost:8000/api/budget-workflow/department-allocation" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "tenant_budget_allocation_id": "UUID",
    "department_id": "UUID",
    "allocated_budget": 2500
  }'
```

### Test Employee Allocation
```bash
curl -X POST "http://localhost:8000/api/budget-workflow/employee-allocation" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "department_budget_allocation_id": "UUID",
    "employee_id": "UUID",
    "allocated_points": 500
  }'
```

## Files Modified

### Backend
- `backend/models.py` - Added 4 new models
- `backend/budgets/schemas.py` - Added schemas for workflow
- `backend/budgets/workflow_routes.py` - Main API endpoints
- `backend/main.py` - Registered new router

### Database
- `database/migrations/20260209_implement_budget_workflow.sql` - Schema migration

### Frontend
- `frontend/src/pages/BudgetWorkflow.jsx` - Complete UI
- `frontend/src/App.jsx` - Added route

## Next Steps

1. Run migration: `psql -U sparknode -d sparknode -f database/migrations/20260209_implement_budget_workflow.sql`
2. Test API endpoints with Postman/curl
3. Access UI at `/budget-workflow` (role-based access)
4. Create budget allocations following the workflow
5. Verify audit logs in platform admin section

## Support

For issues or questions, check:
- `BUDGET_WORKFLOW_IMPLEMENTATION.md` - Full documentation
- `budget_allocation_ledger` table - Audit trail
- `audit_log` table - User actions
- API responses for detailed error messages
