# Core module for multi-tenant architecture
from .tenant import (
    TenantContext,
    get_tenant_context,
    require_tenant,
    TenantScopedQuery,
    get_scoped_db,
)
from .rbac import (
    UserRole,
    Permission,
    RolePermissions,
    require_permission,
    require_role,
    get_platform_owner,
    get_tenant_admin,
    get_tenant_lead,
    get_corporate_user,
)
from .security import (
    generate_qr_token,
    verify_qr_token,
    generate_secure_code,
)

__all__ = [
    "TenantContext",
    "get_tenant_context", 
    "require_tenant",
    "TenantScopedQuery",
    "get_scoped_db",
    "UserRole",
    "Permission",
    "RolePermissions",
    "require_permission",
    "require_role",
    "get_platform_owner",
    "get_tenant_admin",
    "get_tenant_lead",
    "get_corporate_user",
    "generate_qr_token",
    "verify_qr_token",
    "generate_secure_code",
]
