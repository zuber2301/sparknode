# Department Lead (dept_lead) Budget Allocation Workflow

## Overview
This document describes the new budget allocation workflow with the renamed `dept_lead` role (formerly `tenant_lead`).

## Role Hierarchy

```
1. Platform Admin (platform_admin)
   ├─ System-wide access
   └─ Can allocate budgets at all levels

2. Tenant Manager (tenant_manager)
   ├─ Company/organization administrator
   └─ Can allocate budgets to their departments and leads

3. Department Lead (dept_lead)
   ├─ Department/team manager
   └─ Can manage team's allocated budget

4. Corporate User (corporate_user)
   └─ Regular employee (no budget allocation)
```

## Budget Allocation Workflow

### Step 1: Platform Admin Creates and Activates Budget
```
Platform Admin
    ↓
Creates Budget (total points)
    ↓
Activates Budget (status = 'active')
```

**Endpoint:** `POST /api/budgets/`
**Response:** Budget object with `status='draft'`

**Endpoint:** `PUT /api/budgets/{budget_id}/activate`
**Response:** Budget activated

### Step 2: Tenant Manager Allocates to Departments
```
Tenant Manager (in their tenant)
    ↓
Allocates points to departments
    ↓
Creates DepartmentBudget records
```

**Endpoint:** `POST /api/budgets/{budget_id}/allocate`
**Request:**
```json
{
  "allocations": [
    {
      "department_id": "uuid",
      "allocated_points": 1000.00,
      "monthly_cap": null
    }
  ]
}
```

**Key Features:**
- Validates total allocation doesn't exceed remaining budget points
- Creates DepartmentBudget records linked to specific departments
- Can allocate to multiple departments in one request
- Can update existing department allocations

### Step 3: Tenant Manager Allocates to Department Leads
```
Tenant Manager (in their department)
    ↓
Allocates to dept_lead users
    ↓
Creates LeadBudget records
    ↓
All users in that department can use the budget
```

**Endpoint:** `POST /api/budgets/leads/allocate`
**Request:**
```json
{
  "user_id": "uuid",
  "total_points": 500.00,
  "description": "Q1 recognition budget"
}
```

**Authorization:**
- `platform_admin`: Can allocate to any dept_lead in any department
- `tenant_manager`: Can only allocate to dept_leads in their own department
- `hr_admin`: Can allocate to any dept_lead in the tenant

**Key Features:**
- Automatically creates DepartmentBudget if it doesn't exist
- Validates dept_lead user is in same tenant
- For tenant_manager: validates dept_lead is in their department
- Prevents over-allocation (sum of all leads ≤ department budget)
- Each dept_lead can have their own budget record

### Step 4: Department Lead and Team Members Use Budget
```
Dept Lead (in their department)
    ├─ Can view their allocated budget
    ├─ Can allocate/distribute to team members
    └─ All team members can give recognition using this budget

Corporate Users (in same department)
    └─ Can give recognition using dept_lead's allocated budget
```

## Database Models

### Budget
- `id`: UUID (primary key)
- `tenant_id`: UUID (organization)
- `name`: String
- `total_points`: Decimal (starting allocation)
- `allocated_points`: Decimal (sum of all department allocations)
- `status`: 'draft' | 'active'
- `fiscal_year`: Integer
- `fiscal_quarter`: Integer (optional)

### DepartmentBudget
- `id`: UUID (primary key)
- `budget_id`: UUID (foreign key → Budget)
- `department_id`: UUID (foreign key → Department)
- `tenant_id`: UUID
- `allocated_points`: Decimal (total for this department)
- `spent_points`: Decimal (sum of recognitions given)
- `monthly_cap`: Decimal (optional monthly limit)

### LeadBudget
- `id`: UUID (primary key)
- `department_budget_id`: UUID (foreign key → DepartmentBudget)
- `user_id`: UUID (foreign key → User with dept_lead role)
- `tenant_id`: UUID
- `total_points`: Decimal (allocated to this lead)
- `spent_points`: Decimal (used in recognitions)
- `status`: 'active' | 'paused' | 'expired'

## API Endpoints Summary

| Method | Endpoint | Role Required | Purpose |
|--------|----------|---------------|---------|
| POST | /api/budgets/ | hr_admin | Create budget |
| GET | /api/budgets/ | any | List budgets for tenant |
| GET | /api/budgets/{id} | any | Get budget details |
| PUT | /api/budgets/{id} | hr_admin | Update budget |
| PUT | /api/budgets/{id}/activate | hr_admin | Activate budget |
| POST | /api/budgets/{id}/allocate | hr_admin | Allocate to departments |
| GET | /api/budgets/{id}/departments | any | List department allocations |
| POST | /api/budgets/leads/allocate | tenant_manager, hr_admin | Allocate to dept_leads |
| GET | /api/budgets/{id}/leads | any | List lead allocations |

## Role Mapping (Legacy Support)

For backward compatibility, the system supports these legacy role mappings:

| Old Role | New Role | Notes |
|----------|----------|-------|
| `dept_lead` | `dept_lead` | Renamed to clarify role scope |
| `manager` | `dept_lead` | Legacy alias |
| `hr_admin` | `tenant_manager` | Legacy alias |
| `employee` | `corporate_user` | Legacy alias |

## Validation Rules

### Budget Creation
- Only HR Admin can create budgets
- Requires fiscal_year and total_points
- Status starts as 'draft'

### Department Allocation
- Total allocation cannot exceed budget.total_points
- Prevents double-counting with existing allocations
- Creates audit log entry for each allocation

### Lead Allocation
- Tenant Managers can only allocate to their own department's leads
- Platform Admin can allocate across all departments
- Sum of all leads in a department ≤ department budget
- Automatically creates department budget if missing

## Audit Logging

All budget operations are logged:
- `budget_created`: New budget created
- `budget_updated`: Budget modified
- `budget_allocated`: Budget allocated to departments
- `budget_activated`: Budget status changed to active
- `lead_budget_allocated`: Points allocated to department lead

## Examples

### Example 1: Complete Workflow

```
1. Platform Admin creates budget
   POST /api/budgets/
   { "name": "Q1 Recognition", "fiscal_year": 2026, "total_points": 10000 }

2. Platform Admin activates budget
   PUT /api/budgets/{budget_id}/activate

3. Tenant Manager allocates to 3 departments
   POST /api/budgets/{budget_id}/allocate
   {
     "allocations": [
       { "department_id": "eng-dept-id", "allocated_points": 4000 },
       { "department_id": "sales-dept-id", "allocated_points": 3000 },
       { "department_id": "hr-dept-id", "allocated_points": 3000 }
     ]
   }

4. Engineering Manager allocates to their leads
   POST /api/budgets/leads/allocate
   {
     "user_id": "john-lead-id",
     "total_points": 2000,
     "description": "Senior engineer lead allocation"
   }

5. John (dept_lead) and team members give recognition
   - John can give 2000 points to team members
   - Each team member can receive/give using this pool
   - All tracked in LeadBudget and WalletLedger
```

### Example 2: Tenant Manager Only Access

A Tenant Manager in Engineering Department:
- Can allocate to dept_leads **only in Engineering**
- Cannot allocate to Sales or HR department leads
- Cannot create or activate budgets
- Can view allocations for all departments

## Migration Notes

### From `tenant_lead` to `dept_lead`

1. **Database**: The `org_role` field values are now stored as `'dept_lead'`
2. **Code**: `UserRole.DEPT_LEAD` is the canonical constant
3. **Backward Compatibility**: Old `'tenant_lead'` values map to `'dept_lead'`
4. **API**: Both old and new role names are accepted in requests
5. **UI**: Updated labels show "Department Lead" instead of "Tenant Leader"

### Updating Bulk Upload

When importing users via CSV, use:
- Role value: `dept_lead` (instead of `tenant_lead`)
- Display name: "Department Lead"

## Error Handling

| Status | Error | Cause |
|--------|-------|-------|
| 400 | "Allocation exceeds available budget" | Total allocation > remaining points |
| 403 | "Cannot allocate to users outside your organization" | Wrong tenant |
| 403 | "Tenant managers can only allocate to dept_leads in their department" | Wrong department |
| 404 | "Department Lead not found or has no department assigned" | Invalid user_id or user has no dept |
| 404 | "Budget not found" | Invalid budget_id |
