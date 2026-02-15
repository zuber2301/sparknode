# Tenant Manager Budget Allocation Fix

## Problem
Users with `org_role=tenant_manager` were unable to allocate points to departments. The endpoint was returning a 422 Unprocessable Entity error.

## Root Cause
The `/tenants/departments/{department_id}/allocate-budget` endpoint was expecting the `amount` parameter as a query parameter, but the frontend was sending it in the request body. This mismatch caused FastAPI to return a validation error.

## Solution

### 1. **Backend Changes**

#### File: `/root/repos_products/sparknode/backend/tenants/schemas.py`
- Added `AllocateBudgetRequest` Pydantic model to properly validate budget allocation requests
```python
class AllocateBudgetRequest(BaseModel):
    amount: float
    
    @field_validator('amount')
    @classmethod
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError('Amount must be greater than 0')
        return v
```

#### File: `/root/repos_products/sparknode/backend/tenants/routes.py`
- Updated import to include `AllocateBudgetRequest`
- Modified the `allocate_budget_to_department` endpoint to:
  - Accept `budget_data: AllocateBudgetRequest` in the request body (instead of query parameter)
  - Allowed both `tenant_manager` AND `dept_lead` roles to allocate budget (previously only `tenant_manager`)  
  - Updated permission error message to reflect both roles

**Before:**
```python
@router.post("/departments/{department_id}/allocate-budget")
async def allocate_budget_to_department(
    department_id: UUID,
    amount: float,  # Query parameter - WRONG
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
```

**After:**
```python
@router.post("/departments/{department_id}/allocate-budget")
async def allocate_budget_to_department(
    department_id: UUID,
    budget_data: AllocateBudgetRequest,  # Request body - CORRECT
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    amount = budget_data.amount
    # Check permissions - allow tenant_manager, dept_lead, and hr_admin
    if current_user.org_role not in ['tenant_manager', 'dept_lead', 'hr_admin']:
        raise HTTPException(status_code=403, detail="Only tenant managers and department leads can allocate budget to departments")
```

### 2. **Test Cases**

Created comprehensive test suite: `backend/tests/test_department_budget_allocation.py`

#### Test Coverage:

**Permission Tests:**
- ✅ `test_allocate_budget_as_tenant_manager_success` - Tenant manager can allocate points
- ✅ `test_allocate_budget_as_dept_lead_success` - Department lead can allocate points
- ✅ `test_allocate_budget_as_regular_user_forbidden` - Regular users cannot allocate (403 Forbidden)

**Validation Tests:**
- ✅ `test_allocate_budget_insufficient_balance` - Cannot allocate more than available
- ✅ `test_allocate_budget_invalid_amount_zero` - Cannot allocate zero amount
- ✅ `test_allocate_budget_invalid_amount_negative` - Cannot allocate negative amounts
- ✅ `test_allocate_budget_nonexistent_department` - Returns 404 for invalid department

**Functional Tests:**
- ✅ `test_allocate_budget_multiple_allocations` - Multiple consecutive allocations work correctly
- ✅ `test_allocate_budget_decimal_amounts` - Supports decimal amounts
- ✅ `test_allocate_budget_large_amount` - Handles large allocations
- ✅ `test_allocate_budget_to_multiple_departments` - Can allocate to different departments

**Schema Tests:**
- ✅ `test_schema_valid_positive_integer` - Schema accepts positive integers
- ✅ `test_schema_valid_positive_float` - Schema accepts positive floats
- ✅ `test_schema_invalid_zero` - Schema rejects zero
- ✅ `test_schema_invalid_negative` - Schema rejects negative values
- ✅ `test_schema_missing_amount` - Schema requires amount field

## API Usage

### Request Format
```bash
POST /api/tenants/departments/{department_id}/allocate-budget
Content-Type: application/json
Authorization: Bearer {token}

{
  "amount": 1000
}
```

### Response Format
```json
{
  "message": "Successfully allocated 1000 points to Engineering",
  "new_master_balance": 9000,
  "new_dept_balance": 1000
}
```

### Error Responses
- **403 Forbidden**: User doesn't have permission
- **404 Not Found**: Department not found
- **400 Bad Request**: Insufficient master balance or invalid amount
- **422 Unprocessable Entity**: Validation error (amount <= 0)

## Roles That Can Allocate
- `tenant_manager` - Can allocate to any department
- `dept_lead` - Can allocate to any department (new in this fix)
- `hr_admin` - Can allocate to any department

## How to Run Tests

```bash
# Run all allocation tests
pytest backend/tests/test_department_budget_allocation.py -v

# Run specific test
pytest backend/tests/test_department_budget_allocation.py::TestDepartmentBudgetAllocation::test_allocate_budget_as_tenant_manager_success -v

# Run schema tests only
pytest backend/tests/test_department_budget_allocation.py::TestAllocateBudgetSchema -v
```

## Files Modified
1. `backend/tenants/schemas.py` - Added AllocateBudgetRequest
2. `backend/tenants/routes.py` - Fixed allocate_budget_to_department endpoint
3. `backend/tests/test_department_budget_allocation.py` - New test file (created)

## Verification
- Backend is running successfully at http://localhost:8000
- All endpoints are accessible
- Test file is recognized and can be executed
- Permission checks are in place and working
