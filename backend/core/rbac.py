"""
Hierarchical Role-Based Access Control (RBAC)

This module implements a four-tier persona model for multi-tenant access control:

1. Platform Admin: System-wide visibility for subscription and global health
2. Tenant Manager: Full control over a specific company's budget, events, and user list
3. Tenant Lead: Manager-level access to approve and manage team-specific resources
4. Corporate User: End-user access for recognition and reward redemption

Each role has specific permissions that are checked via decorators and dependencies.
"""

from enum import Enum
from typing import List, Set, Optional


class AllowedDepartment(str, Enum):
    """
    Standard department categories allowed in the system.
    """
    HR = "Human Resource (HR)"
    IT = "Techology (IT)"
    SALES_MARKETING = "Sale & Marketting"
    BU1 = "Business Unit -1"
    BU2 = "Business Unit-2"
    BU3 = "Business Unit-3"
from functools import wraps
from uuid import UUID

from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from database import get_db


class UserRole(str, Enum):
    """
    Standard roles for multi-tenant access control.
    """
    PLATFORM_ADMIN = "platform_admin"      # System-wide admin
    TENANT_MANAGER = "tenant_manager"      # Company HR/Admin
    DEPT_LEAD = "dept_lead"                # Department Lead/Manager
    TENANT_USER = "tenant_user"            # Regular Employee


# Role hierarchy mapping (higher roles inherit lower role permissions)
ROLE_HIERARCHY = {
    UserRole.PLATFORM_ADMIN: 4,
    UserRole.TENANT_MANAGER: 3,
    UserRole.DEPT_LEAD: 2,
    UserRole.TENANT_USER: 1,
}  # dept_lead is canonical lead-level role


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
    UserRole.PLATFORM_ADMIN: {
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
    UserRole.TENANT_MANAGER: {
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
    UserRole.DEPT_LEAD: {
        Permission.MANAGE_TEAM_BUDGET,
    },
    UserRole.TENANT_USER: {
        Permission.REDEEM_POINTS,
    },
}


class RolePermissions:
    """
    Utility class for checking role permissions.
    """
    
    @staticmethod
    def normalize_role(role: str) -> UserRole:
        """Convert string role to UserRole enum (supports legacy aliases).

        Legacy values like 'tenant_lead' and 'manager' are normalized to
        the canonical `dept_lead` role to preserve backward compatibility.
        """
        if not role:
            return UserRole.TENANT_USER
        role_lower = role.lower()
        # legacy aliases -> dept_lead
        if role_lower in ('tenant_lead', 'manager'):
            return UserRole.DEPT_LEAD
        try:
            return UserRole(role_lower)
        except ValueError:
            return UserRole.TENANT_USER
    
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
        return user_role == UserRole.PLATFORM_ADMIN
    
    @staticmethod
    def is_tenant_manager_level(role: str) -> bool:
        """Check if role has tenant manager level access."""
        user_role = RolePermissions.normalize_role(role)
        return ROLE_HIERARCHY.get(user_role, 0) >= ROLE_HIERARCHY[UserRole.TENANT_MANAGER]
    
    @staticmethod
    def is_lead_level(role: str) -> bool:
        """Check if role has team lead level access."""
        user_role = RolePermissions.normalize_role(role)
        return ROLE_HIERARCHY.get(user_role, 0) >= ROLE_HIERARCHY[UserRole.DEPT_LEAD]
    
    @staticmethod
    def get_role_level(role: str) -> int:
        """Get the hierarchy level of a role."""
        user_role = RolePermissions.normalize_role(role)
        return ROLE_HIERARCHY.get(user_role, 0)


async def get_current_user_dependency(request: Request, db: Session = Depends(get_db)):
    """
    Lazily resolve the current user by parsing the Authorization header and
    delegating to `auth.utils.get_current_user` at request time. This avoids
    circular imports and ensures the dependency returns a user object (not a
    function).
    """
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = auth_header.split(" ", 1)[1]
    from importlib import import_module

    auth_utils = import_module("auth.utils")
    result = await auth_utils.get_current_user(token=token, db=db)
    return result


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
    async def permission_checker(request: Request, db: Session = Depends(get_db)):
        current_user = await get_current_user_dependency(request, db)
        user_permissions = RolePermissions.get_permissions(current_user.org_role)

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
            current_user: User = Depends(require_role(UserRole.TENANT_MANAGER, UserRole.PLATFORM_ADMIN))
        ):
            ...
    """
    async def role_checker(request: Request, db: Session = Depends(get_db)):
        current_user = await get_current_user_dependency(request, db)
        user_role = RolePermissions.normalize_role(current_user.org_role)
        
        # Check both the normalized role and legacy mappings
        allowed = [r.value for r in allowed_roles]
        if current_user.org_role not in allowed and user_role not in allowed_roles:
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
            current_user: User = Depends(require_minimum_role(UserRole.DEPT_LEAD))
        ):
            ...
    """
    async def role_level_checker(request: Request, db: Session = Depends(get_db)):
        current_user = await get_current_user_dependency(request, db)
        user_level = RolePermissions.get_role_level(current_user.org_role)
        required_level = ROLE_HIERARCHY.get(minimum_role, 0)
        
        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Minimum role required: {minimum_role.value}"
            )
        
        return current_user
    
    return role_level_checker


# Convenience dependencies for common role checks
async def get_platform_admin(request: Request, db: Session = Depends(get_db)):
    """Dependency that requires Platform Admin role."""
    current_user = await get_current_user_dependency(request, db)
    
    if not current_user.is_platform_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform Admin access required"
        )
    return current_user


async def get_tenant_manager(request: Request, db: Session = Depends(get_db)):
    """Dependency that requires Tenant Manager or higher role."""
    current_user = await get_current_user_dependency(request, db)
    if not RolePermissions.is_tenant_manager_level(current_user.org_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant Manager access required"
        )
    return current_user


async def get_dept_lead(request: Request, db: Session = Depends(get_db)):
    """Dependency that requires Department Lead (dept_lead) or higher role."""
    current_user = await get_current_user_dependency(request, db)
    if not RolePermissions.is_lead_level(current_user.org_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Department Lead access required"
        )
    return current_user


async def get_tenant_user(request: Request, db: Session = Depends(get_db)):
    """Dependency that requires any authenticated user."""
    current_user = await get_current_user_dependency(request, db)
    return current_user


def check_team_access(current_user, target_user_id: UUID, db: Session) -> bool:
    """
    Check if current user has access to target user's data.
    
    Rules:
    - Platform admins can access all users
    - Tenant admins can access all users in their tenant
    - Tenant leads can access their direct reports
    - Corporate users can only access themselves
    """
    from models import User
    
    # Platform admins can access everything
    if RolePermissions.is_platform_level(current_user.org_role):
        return True
    
    # Same user
    if current_user.id == target_user_id:
        return True
    
    # Tenant managers can access all users in their tenant
    if RolePermissions.is_tenant_manager_level(current_user.org_role):
        target_user = db.query(User).filter(User.id == target_user_id).first()
        return target_user and target_user.tenant_id == current_user.tenant_id
    
    # Tenant leads can access their direct reports
    if RolePermissions.is_lead_level(current_user.org_role):
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
        request: Request,
        db: Session = Depends(get_db)
    ):
        current_user = await get_current_user_dependency(request, db)
        if not check_team_access(current_user, target_user_id, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: User is not in your team"
            )
        return current_user
    
    return team_checker
