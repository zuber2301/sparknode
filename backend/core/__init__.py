# Core module for multi-tenant architecture
from .tenant import (
    TenantContext,
    get_tenant_context,
    require_tenant,
    TenantScopedQuery,
    get_scoped_db,
    append_impersonation_metadata,
)
from .rbac import (
    UserRole,
    AllowedDepartment,
    Permission,
    RolePermissions,
    require_permission,
    require_role,
    get_platform_admin,
    get_tenant_manager,
    get_dept_lead,
    get_tenant_user,
)
from .security import (
    generate_qr_token,
    verify_qr_token,
    generate_secure_code,
)
from .wallet_service import (
    WalletService,
    credit_user_wallet,
    debit_user_wallet,
)
from .audit_service import (
    AuditService,
    AuditActions,
    log_audit,
)

__all__ = [
    "TenantContext",
    "get_tenant_context", 
    "require_tenant",
    "TenantScopedQuery",
    "get_scoped_db",
    "append_impersonation_metadata",
    "UserRole",
    "AllowedDepartment",
    "Permission",
    "RolePermissions",
    "require_permission",
    "require_role",
    "get_platform_admin",
    "get_tenant_manager",
    "get_dept_lead",
    "get_tenant_user",
    "generate_qr_token",
    "verify_qr_token",
    "generate_secure_code",
    "WalletService",
    "credit_user_wallet",
    "debit_user_wallet",
    "AuditService",
    "AuditActions",
    "log_audit",
]
