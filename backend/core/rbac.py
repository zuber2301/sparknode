"""
Hierarchical Role-Based Access Control (RBAC)

This module implements a four-tier persona model for multi-tenant access control:

1. Platform Owner: System-wide visibility for subscription and global health
2. Tenant Admin: Full control over a specific company's budget, events, and user list
3. Tenant Lead: Manager-level access to approve and manage team-specific resources
4. Corporate User: End-user access for recognition and reward redemption

Each role has specific permissions that are checked via decorators and dependencies.
"""

from enum import Enum
from typing import List, Set, Optional
from functools import wraps
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db


class UserRole(str, Enum):
    """
    Four-tier role hierarchy for multi-tenant access control.
    """
    PLATFORM_OWNER = "platform_owner"      # System-wide admin
    TENANT_ADMIN = "tenant_admin"          # Company HR/Admin
    TENANT_LEAD = "tenant_lead"            # Manager/Team Lead
    CORPORATE_USER = "corporate_user"      # Regular Employee
    
    # Legacy role mappings for backward compatibility
    PLATFORM_ADMIN = "platform_admin"      # Maps to PLATFORM_OWNER
    HR_ADMIN = "hr_admin"                  # Maps to TENANT_ADMIN
    MANAGER = "manager"                    # Maps to TENANT_LEAD
    EMPLOYEE = "employee"                  # Maps to CORPORATE_USER


# Role hierarchy mapping (higher roles inherit lower role permissions)
ROLE_HIERARCHY = {
    UserRole.PLATFORM_OWNER: 4,
    UserRole.PLATFORM_ADMIN: 4,  # Legacy
    UserRole.TENANT_ADMIN: 3,
    UserRole.HR_ADMIN: 3,  # Legacy
    UserRole.TENANT_LEAD: 2,
    UserRole.MANAGER: 2,  # Legacy
    UserRole.CORPORATE_USER: 1,
    UserRole.EMPLOYEE: 1,  # Legacy
}


class Permission(str, Enum):
    """
    Granular permissions for fine-grained access control.
    """
    # Platform-level permissions
    MANAGE_TENANTS = "manage_tenants"
    VIEW_ALL_TENANTS = "view_all_tenants"
    MANAGE_SUBSCRIPTIONS = "manage_subscriptions"
    VIEW_PLATFORM_ANALYTICS = "view_platform_analytics"
    MANAGE_GLOBAL_CATALOG = "manage_global_catalog"
    
    # Tenant-level permissions
    MANAGE_TENANT_SETTINGS = "manage_tenant_settings"
    MANAGE_USERS = "manage_users"
    MANAGE_DEPARTMENTS = "manage_departments"
    MANAGE_BUDGETS = "manage_budgets"
    ALLOCATE_POINTS = "allocate_points"
    MANAGE_EVENTS = "manage_events"
    VIEW_TENANT_ANALYTICS = "view_tenant_analytics"
    MANAGE_VOUCHER_CATALOG = "manage_voucher_catalog"
    VIEW_ALL_WALLETS = "view_all_wallets"
    MANAGE_AUDIT_LOGS = "manage_audit_logs"
    
    # Team-level permissions
    APPROVE_PARTICIPATION = "approve_participation"
    MANAGE_TEAM_BUDGET = "manage_team_budget"
    VIEW_TEAM_WALLETS = "view_team_wallets"
    GIVE_RECOGNITION_WITH_POINTS = "give_recognition_with_points"
    MANAGE_TEAM_EVENTS = "manage_team_events"
    
    # User-level permissions
    GIVE_RECOGNITION = "give_recognition"
    REDEEM_POINTS = "redeem_points"
    VIEW_OWN_WALLET = "view_own_wallet"
    VIEW_FEED = "view_feed"
    PARTICIPATE_EVENTS = "participate_events"
    UPDATE_PROFILE = "update_profile"


# Role-Permission mapping
ROLE_PERMISSIONS: dict[UserRole, Set[Permission]] = {
    UserRole.PLATFORM_OWNER: {
        # All permissions
        Permission.MANAGE_TENANTS,
        Permission.VIEW_ALL_TENANTS,
        Permission.MANAGE_SUBSCRIPTIONS,
        Permission.VIEW_PLATFORM_ANALYTICS,
        Permission.MANAGE_GLOBAL_CATALOG,
        Permission.MANAGE_TENANT_SETTINGS,
        Permission.MANAGE_USERS,
        Permission.MANAGE_DEPARTMENTS,
        Permission.MANAGE_BUDGETS,
        Permission.ALLOCATE_POINTS,
        Permission.MANAGE_EVENTS,
        Permission.VIEW_TENANT_ANALYTICS,
        Permission.MANAGE_VOUCHER_CATALOG,
        Permission.VIEW_ALL_WALLETS,
        Permission.MANAGE_AUDIT_LOGS,
        Permission.APPROVE_PARTICIPATION,
        Permission.MANAGE_TEAM_BUDGET,
        Permission.VIEW_TEAM_WALLETS,
        Permission.GIVE_RECOGNITION_WITH_POINTS,
        Permission.MANAGE_TEAM_EVENTS,
        Permission.GIVE_RECOGNITION,
        Permission.REDEEM_POINTS,
        Permission.VIEW_OWN_WALLET,
        Permission.VIEW_FEED,
        Permission.PARTICIPATE_EVENTS,
        Permission.UPDATE_PROFILE,
    },
    UserRole.TENANT_ADMIN: {
        Permission.MANAGE_TENANT_SETTINGS,
        Permission.MANAGE_USERS,
        Permission.MANAGE_DEPARTMENTS,
        Permission.MANAGE_BUDGETS,
        Permission.ALLOCATE_POINTS,
        Permission.MANAGE_EVENTS,
        Permission.VIEW_TENANT_ANALYTICS,
        Permission.MANAGE_VOUCHER_CATALOG,
        Permission.VIEW_ALL_WALLETS,
        Permission.MANAGE_AUDIT_LOGS,
        Permission.APPROVE_PARTICIPATION,
        Permission.MANAGE_TEAM_BUDGET,
        Permission.VIEW_TEAM_WALLETS,
        Permission.GIVE_RECOGNITION_WITH_POINTS,
        Permission.MANAGE_TEAM_EVENTS,
        Permission.GIVE_RECOGNITION,
        Permission.REDEEM_POINTS,
        Permission.VIEW_OWN_WALLET,
        Permission.VIEW_FEED,
        Permission.PARTICIPATE_EVENTS,
        Permission.UPDATE_PROFILE,
    },
    UserRole.TENANT_LEAD: {
        Permission.APPROVE_PARTICIPATION,
        Permission.MANAGE_TEAM_BUDGET,
        Permission.VIEW_TEAM_WALLETS,
        Permission.GIVE_RECOGNITION_WITH_POINTS,
        Permission.MANAGE_TEAM_EVENTS,
        Permission.GIVE_RECOGNITION,
        Permission.REDEEM_POINTS,
        Permission.VIEW_OWN_WALLET,
        Permission.VIEW_FEED,
        Permission.PARTICIPATE_EVENTS,
        Permission.UPDATE_PROFILE,
    },
    UserRole.CORPORATE_USER: {
        Permission.GIVE_RECOGNITION,
        Permission.REDEEM_POINTS,
        Permission.VIEW_OWN_WALLET,
        Permission.VIEW_FEED,
        Permission.PARTICIPATE_EVENTS,
        Permission.UPDATE_PROFILE,
    },
}

# Legacy role mapping
LEGACY_ROLE_PERMISSIONS = {
    UserRole.PLATFORM_ADMIN: ROLE_PERMISSIONS[UserRole.PLATFORM_OWNER],
    UserRole.HR_ADMIN: ROLE_PERMISSIONS[UserRole.TENANT_ADMIN],
    UserRole.MANAGER: ROLE_PERMISSIONS[UserRole.TENANT_LEAD],
    UserRole.EMPLOYEE: ROLE_PERMISSIONS[UserRole.CORPORATE_USER],
}

# Combine for complete mapping
ROLE_PERMISSIONS.update(LEGACY_ROLE_PERMISSIONS)


class RolePermissions:
    """
    Utility class for checking role permissions.
    """
    
    @staticmethod
    def normalize_role(role: str) -> UserRole:
        """Convert string role to UserRole enum, handling legacy roles."""
        try:
            return UserRole(role)
        except ValueError:
            # Default to corporate user for unknown roles
            return UserRole.CORPORATE_USER
    
    @staticmethod
    def has_permission(role: str, permission: Permission) -> bool:
        """Check if a role has a specific permission."""
        user_role = RolePermissions.normalize_role(role)
        role_perms = ROLE_PERMISSIONS.get(user_role, set())
        return permission in role_perms
    
    @staticmethod
    def get_permissions(role: str) -> Set[Permission]:
        """Get all permissions for a role."""
        user_role = RolePermissions.normalize_role(role)
        return ROLE_PERMISSIONS.get(user_role, set())
    
    @staticmethod
    def is_platform_level(role: str) -> bool:
        """Check if role has platform-level access."""
        user_role = RolePermissions.normalize_role(role)
        return user_role in [UserRole.PLATFORM_OWNER, UserRole.PLATFORM_ADMIN]
    
    @staticmethod
    def is_tenant_admin_level(role: str) -> bool:
        """Check if role has tenant admin level access."""
        user_role = RolePermissions.normalize_role(role)
        return ROLE_HIERARCHY.get(user_role, 0) >= ROLE_HIERARCHY[UserRole.TENANT_ADMIN]
    
    @staticmethod
    def is_lead_level(role: str) -> bool:
        """Check if role has team lead level access."""
        user_role = RolePermissions.normalize_role(role)
        return ROLE_HIERARCHY.get(user_role, 0) >= ROLE_HIERARCHY[UserRole.TENANT_LEAD]
    
    @staticmethod
    def get_role_level(role: str) -> int:
        """Get the hierarchy level of a role."""
        user_role = RolePermissions.normalize_role(role)
        return ROLE_HIERARCHY.get(user_role, 0)


def get_current_user_dependency():
    """
    Placeholder for the actual get_current_user dependency.
    This is imported from auth.utils at runtime to avoid circular imports.
    """
    from auth.utils import get_current_user
    return get_current_user


def require_permission(*permissions: Permission):
    """
    Dependency factory that checks if the user has required permissions.
    
    Usage:
        @router.get("/admin/users")
        async def get_users(
            current_user: User = Depends(require_permission(Permission.MANAGE_USERS))
        ):
            ...
    """
    async def permission_checker(current_user = Depends(get_current_user_dependency)):
        user_permissions = RolePermissions.get_permissions(current_user.role)
        
        for perm in permissions:
            if perm not in user_permissions:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Permission denied: {perm.value} required"
                )
        
        return current_user
    
    return permission_checker


def require_role(*allowed_roles: UserRole):
    """
    Dependency factory that checks if user has one of the allowed roles.
    
    Usage:
        @router.get("/admin/settings")
        async def get_settings(
            current_user: User = Depends(require_role(UserRole.TENANT_ADMIN, UserRole.PLATFORM_OWNER))
        ):
            ...
    """
    async def role_checker(current_user = Depends(get_current_user_dependency)):
        user_role = RolePermissions.normalize_role(current_user.role)
        
        # Check both the normalized role and legacy mappings
        allowed = [r.value for r in allowed_roles]
        if current_user.role not in allowed and user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(allowed)}"
            )
        
        return current_user
    
    return role_checker


def require_minimum_role(minimum_role: UserRole):
    """
    Dependency that checks if user meets minimum role level.
    
    Usage:
        @router.get("/reports")
        async def get_reports(
            current_user: User = Depends(require_minimum_role(UserRole.TENANT_LEAD))
        ):
            ...
    """
    async def role_level_checker(current_user = Depends(get_current_user_dependency)):
        user_level = RolePermissions.get_role_level(current_user.role)
        required_level = ROLE_HIERARCHY.get(minimum_role, 0)
        
        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Minimum role required: {minimum_role.value}"
            )
        
        return current_user
    
    return role_level_checker


# Convenience dependencies for common role checks
async def get_platform_owner(current_user = Depends(get_current_user_dependency)):
    """Dependency that requires Platform Owner role."""
    if not RolePermissions.is_platform_level(current_user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform Owner access required"
        )
    return current_user


async def get_tenant_admin(current_user = Depends(get_current_user_dependency)):
    """Dependency that requires Tenant Admin or higher role."""
    if not RolePermissions.is_tenant_admin_level(current_user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant Admin access required"
        )
    return current_user


async def get_tenant_lead(current_user = Depends(get_current_user_dependency)):
    """Dependency that requires Tenant Lead or higher role."""
    if not RolePermissions.is_lead_level(current_user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Team Lead access required"
        )
    return current_user


async def get_corporate_user(current_user = Depends(get_current_user_dependency)):
    """Dependency that requires any authenticated user."""
    return current_user


def check_team_access(current_user, target_user_id: UUID, db: Session) -> bool:
    """
    Check if current user has access to target user's data.
    
    Rules:
    - Platform owners can access all users
    - Tenant admins can access all users in their tenant
    - Tenant leads can access their direct reports
    - Corporate users can only access themselves
    """
    from models import User
    
    # Platform owners can access everything
    if RolePermissions.is_platform_level(current_user.role):
        return True
    
    # Same user
    if current_user.id == target_user_id:
        return True
    
    # Tenant admins can access all users in their tenant
    if RolePermissions.is_tenant_admin_level(current_user.role):
        target_user = db.query(User).filter(User.id == target_user_id).first()
        return target_user and target_user.tenant_id == current_user.tenant_id
    
    # Tenant leads can access their direct reports
    if RolePermissions.is_lead_level(current_user.role):
        target_user = db.query(User).filter(User.id == target_user_id).first()
        if target_user and target_user.manager_id == current_user.id:
            return True
        # Also check nested reports (reports of reports)
        reports = db.query(User.id).filter(User.manager_id == current_user.id).all()
        report_ids = [r[0] for r in reports]
        nested_reports = db.query(User.id).filter(User.manager_id.in_(report_ids)).all()
        nested_report_ids = [r[0] for r in nested_reports]
        return target_user_id in report_ids or target_user_id in nested_report_ids
    
    return False


def require_team_access(target_user_id: UUID):
    """
    Dependency that validates team-based access to user data.
    
    Usage:
        @router.get("/users/{user_id}/wallet")
        async def get_user_wallet(
            user_id: UUID,
            current_user: User = Depends(require_team_access(user_id))
        ):
            ...
    """
    async def team_checker(
        current_user = Depends(get_current_user_dependency),
        db: Session = Depends(get_db)
    ):
        if not check_team_access(current_user, target_user_id, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: User is not in your team"
            )
        return current_user
    
    return team_checker
