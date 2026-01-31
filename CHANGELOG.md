# CHANGELOG

All notable changes to the SparkNode codebase will be documented in this file.

## [Unreleased] - 2026-01-31

### 🔧 Code Quality & Stability Improvements

This release focuses on code quality improvements, bug fixes, technical debt reduction, and establishing foundational patterns for maintainability.

---

## Backend Changes

### 🐛 Critical Bug Fixes

#### Fixed: Duplicate `remaining_percentage` property in LeadBudget model
- **File:** [models.py](backend/models.py#L395-L404)
- **Issue:** LeadBudget class had two `remaining_percentage` properties, with the second one referencing non-existent `allocated_points` field
- **Impact:** Would cause runtime AttributeError when accessing remaining_percentage

#### Fixed: User.email reference in OAuth2 token endpoint
- **File:** [auth/routes.py](backend/auth/routes.py#L186-L193)
- **Issue:** Token endpoint queried `User.email` but User model only has `corporate_email` and `personal_email` fields
- **Impact:** OAuth2 login always failed to match personal email

#### Fixed: User.email reference in platform admin audit logs
- **File:** [platform_admin/routes.py](backend/platform_admin/routes.py#L659)
- **Issue:** Audit log actor lookup used `user.email` instead of `user.corporate_email`
- **Impact:** Audit logs showed null for actor email

#### Fixed: Typo `corporate_corporate_email` in auth routes
- **File:** [auth/routes.py](backend/auth/routes.py#L83, L126)
- **Issue:** Duplicate keyword argument `corporate_email` causing syntax errors
- **Impact:** Application would not start

### 🧹 Code Cleanup

#### Removed debug print statements
- **Files affected:**
  - [core/rbac.py](backend/core/rbac.py) - Removed debug prints in `get_current_user_dependency` and `get_platform_admin`
  - [main.py](backend/main.py) - Replaced startup/shutdown prints with `logging.info`
  - [copilot/llm_service.py](backend/copilot/llm_service.py) - Replaced print with `logging.warning`

### ✨ New Services (Refactored Patterns)

#### Added: WalletService ([core/wallet_service.py](backend/core/wallet_service.py))
Centralized service for wallet operations:
- `get_or_create_wallet()` - Get or create user wallet
- `credit_wallet()` - Credit points with ledger entry
- `debit_wallet()` - Debit points with validation
- `log_wallet_action()` - Create audit log for wallet actions
- Convenience functions: `credit_user_wallet()`, `debit_user_wallet()`

#### Added: AuditService ([core/audit_service.py](backend/core/audit_service.py))
Centralized service for audit logging:
- `log_action()` - Create audit log entry
- `log_user_action()` - Convenience method for user actions
- `log_system_action()` - System admin action logging
- `AuditActions` - Constants for common action types
- Convenience function: `log_audit()`

#### Updated core module exports ([core/__init__.py](backend/core/__init__.py))
- Added exports for new services

---

## Frontend Changes

### 🐛 Bug Fixes

#### Fixed: RecognitionModal using incorrect user field names
- **File:** [RecognitionModal.jsx](frontend/src/components/RecognitionModal.jsx)
- **Issue:** Used `user.name` and `user.email` instead of `user.first_name`/`user.last_name` and `user.corporate_email`
- **Impact:** User search and display were broken

#### Fixed: Recognize page using incorrect email field
- **File:** [Recognize.jsx](frontend/src/pages/Recognize.jsx#L110)
- **Issue:** Displayed `searchUser.email` instead of `searchUser.corporate_email`

### 🧹 Code Cleanup

#### Removed debug console.log statements
- **File:** [lib/api.js](frontend/src/lib/api.js)
- Removed DEBUG logging for department requests

### ✨ New Utilities (Refactored Patterns)

#### Added: userUtils.js ([lib/userUtils.js](frontend/src/lib/userUtils.js))
Reusable user display functions:
- `getFullName(user)` - Get full name from first/last name
- `getInitials(user)` - Get two-letter initials
- `getEmail(user)` - Get primary email (corporate_email fallback)
- `filterUsers(users, searchTerm)` - Filter users by name/email
- `getUserDisplayWithEmail(user)` - Format "Name (email)"

#### Added: roleUtils.js ([lib/roleUtils.js](frontend/src/lib/roleUtils.js))
Reusable role display functions:
- `ROLE_CONFIG` - Role display configuration
- `getRoleLabel(role)` - Get human-readable role label
- `getRoleBadgeClasses(role)` - Get Tailwind CSS classes
- `formatRoleString(role)` - Format role to title case
- `isAdminRole(role)` - Check if admin level
- `isLeadOrHigher(role)` - Check if lead level or higher
- `getRoleLevel(role)` - Get hierarchy level (0-4)

#### Added: statusUtils.js ([lib/statusUtils.js](frontend/src/lib/statusUtils.js))
Reusable status display functions:
- `USER_STATUS_CONFIG` - User status configuration
- `TENANT_STATUS_CONFIG` - Tenant status configuration
- `EVENT_STATUS_CONFIG` - Event status configuration
- `NOMINATION_STATUS_CONFIG` - Nomination status configuration
- `getUserStatusClasses(status)` - Get CSS classes
- `getStatusLabel(status, type)` - Get human-readable label
- `getStatusConfig(status, type)` - Get full configuration

---

## Test Coverage Summary

### Current Coverage: 26% overall

| Module | Coverage | Notes |
|--------|----------|-------|
| models.py | 97% | Core models well covered |
| config.py | 97% | Configuration covered |
| auth/schemas.py | 99% | Auth schemas covered |
| budgets/schemas.py | 100% | Budget schemas covered |
| recognition/schemas.py | 100% | Recognition schemas covered |
| wallets/schemas.py | 100% | Wallet schemas covered |
| core/audit_service.py | 84% | New service, needs more tests |
| auth/utils.py | 43% | Needs improvement |
| core/rbac.py | 47% | Needs improvement |
| Route files | 0% | Need integration tests |

### Tests Passed: 18 passed, 1 failed, 1 skipped (unit tests)

---

## Technical Debt Addressed

### High Priority Issues Fixed
1. ✅ Duplicate `remaining_percentage` property - Runtime error potential
2. ✅ `User.email` reference errors - Query failures
3. ✅ `corporate_corporate_email` typo - Syntax error
4. ✅ Debug print statements - Production logging cleanup
5. ✅ Frontend field name mismatches - UI display errors

### New Patterns Established
1. ✅ WalletService for centralized wallet operations
2. ✅ AuditService for consistent audit logging
3. ✅ Frontend utility functions for common UI patterns

### Remaining Technical Debt (Future Work)
1. 🔲 Refactor analytics/routes.py (300+ line function)
2. 🔲 Extract phone validation into reusable function
3. 🔲 Consolidate AllowedDepartment enum (duplicated in models.py and rbac.py)
4. 🔲 Add transaction boundaries to financial operations
5. 🔲 Refactor Users.jsx (939 lines) into smaller components
6. 🔲 Consolidate events API (eventsAPI.js vs api.js)
7. 🔲 Add React error boundaries
8. 🔲 Replace hardcoded mock data in frontend

---

## Breaking Changes

None - All changes maintain backward compatibility.

---

## Migration Notes

No database migrations required. Code changes are non-breaking.

---

## Contributors

- Code Quality Audit performed on 2026-01-31
