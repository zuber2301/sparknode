# Quick Reference: dept_lead Migration

## What Changed?

### Role Name
- **Old:** `tenant_lead` (Tenant Leader)
- **New:** `dept_lead` (Department Lead)

### Budget Workflow
- **Old:** Platform Admin → HR Admin allocates to leads (pre-allocated depts)
- **New:** Platform Admin → Tenant Manager allocates to leads (auto-creates depts)

## For Developers

### Using the New Role

#### Backend
```python
from core.rbac import UserRole

# Use the new canonical role name
if current_user.org_role == UserRole.DEPT_LEAD:
    # Department lead logic
    
# Backward compatible - old names still work
if user.org_role in ['dept_lead', 'manager']:
    # All map to department lead
```

#### Frontend
```javascript
import { UserRole } from '@/store/authStore'

// Use the new canonical role
if (user.org_role === UserRole.TENANT_LEAD) {  // maps to 'dept_lead'
    // Department lead UI
}

// Or use role utils
import { isLeadOrHigher } from '@/lib/roleUtils'
if (isLeadOrHigher(user.org_role)) {
    // Show department lead features
}
```

### API Usage

#### Allocate Budget to Department Lead
```bash
curl -X POST http://localhost:8000/api/budgets/leads/allocate \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "uuid-of-dept-lead",
    "total_points": 500,
    "description": "Q1 recognition budget"
  }'
```

**Who Can Call:**
- ✅ Platform Admin (any lead, any dept)
- ✅ Tenant Manager (own dept leads only)
- ✅ HR Admin (any lead)
- ❌ Corporate User
- ❌ Department Lead

**New Feature:** Auto-creates DepartmentBudget if doesn't exist!

## For QA/Testing

### Test Checklist
- [ ] Create user with `dept_lead` role
- [ ] Tenant Manager allocates to dept_lead
- [ ] Verify DepartmentBudget auto-created
- [ ] Give recognition using lead's budget
- [ ] Check points deducted from wallet
- [ ] Verify audit log entries

### Test Data
```bash
# CSV format for bulk upload
email,full_name,department,role
john@company.com,John Doe,Engineering,dept_lead
jane@company.com,Jane Smith,Sales,dept_lead
bob@company.com,Bob Jones,Engineering,corporate_user
```

### Expected Behavior
1. Tenant manager sees "Department Lead" in role dropdown (not "Tenant Leader")
2. Can allocate budget to department leads in their department
3. Department budget is auto-created
4. Department lead can give recognition to team members
5. All points deducted from the allocated budget

## For DevOps/SRE

### Deployment
```bash
# No database migrations needed - string-based role field
# Just deploy code changes

# Verify
psql -c "SELECT DISTINCT org_role FROM users LIMIT 10"
# Should show: dept_lead, tenant_manager, corporate_user
```

### Monitoring
- Monitor audit logs for `lead_budget_allocated` events
- Track DepartmentBudget auto-creation rate
- Check tenant manager allocation success rate

### Rollback
```bash
# If needed, revert files:
git revert <commit-hash>
# No data cleanup needed - both old and new names work
```

## Backward Compatibility

### Old Role Names Still Work
```
tenant_lead → dept_lead ✅
manager → dept_lead ✅
hr_admin → tenant_manager ✅
employee → corporate_user ✅
```

### No Breaking Changes
- ✅ Old CSV imports still work
- ✅ Old API calls still work
- ✅ Old database records still work
- ✅ Old frontend code still works

## Files to Know

### Core System
- `backend/core/rbac.py` - Role definitions and permissions
- `backend/budgets/routes.py` - Budget allocation endpoints
- `frontend/src/store/authStore.js` - Role constants

### Documentation
- `DEPT_LEAD_WORKFLOW.md` - Complete workflow guide
- `IMPLEMENTATION_SUMMARY_DEPT_LEAD.md` - Detailed summary
- `CHANGE_SUMMARY.md` - All changes listed

### Key Endpoints
- `POST /api/budgets/` - Create budget
- `PUT /api/budgets/{id}/activate` - Activate budget
- `POST /api/budgets/{id}/allocate` - Allocate to departments
- `POST /api/budgets/leads/allocate` - Allocate to department leads ← NEW WORKFLOW

## Common Tasks

### Create Department Lead
```
1. Go to Users page
2. Add new user
3. Select role: "Department Lead"
4. Assign to department: Engineering (etc)
5. Save
```

### Allocate Budget
```
1. Tenant Manager logs in
2. Go to Budgets page
3. Create new budget (if needed)
4. Allocate to department leads
5. DepartmentBudget auto-created
6. Department lead and team can give recognition
```

### Check Budget Status
```bash
# Get all budgets
curl http://localhost:8000/api/budgets/

# Get department allocations
curl http://localhost:8000/api/budgets/{id}/departments

# Get lead allocations
curl http://localhost:8000/api/budgets/{id}/leads
```

## Troubleshooting

### "Tenant managers can only allocate to dept_leads in their department"
- **Cause:** Trying to allocate to lead in different department
- **Fix:** Use department lead from your own department

### "Department Lead not found or has no department assigned"
- **Cause:** User doesn't exist or has no department
- **Fix:** Create user with department first

### "Exceeds department budget capacity"
- **Cause:** Too many points allocated to leads in department
- **Fix:** Either increase department allocation or reduce lead allocation

### Department budget not showing
- **Cause:** Auto-create may have failed
- **Fix:** Check audit logs for errors; manually create department budget

## Support

- **Questions:** See `DEPT_LEAD_WORKFLOW.md`
- **Details:** See `IMPLEMENTATION_SUMMARY_DEPT_LEAD.md`
- **Issues:** Check `CHANGE_SUMMARY.md` troubleshooting

---

**TL;DR:** `tenant_lead` → `dept_lead`, new workflow auto-creates department budgets, full backward compatibility ✅
