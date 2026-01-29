"""
Multi-Tenant Context Management

This module provides the foundation for row-level tenant isolation using
a "Shared Schema, Row-Level Isolation" model. Every database query is
automatically scoped to the current tenant context.

Features:
- Automatic tenant_id injection into all queries
- Context-aware session management
- Resource path scoping for media assets
- Cross-tenant access prevention
"""

from contextvars import ContextVar
from typing import Optional, Type, TypeVar, Any, Generator
from uuid import UUID
from functools import wraps

from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session, Query
from sqlalchemy import event
from sqlalchemy.orm.query import Query as SQLQuery

from database import SessionLocal, Base
from config import settings

# Context variable to store current tenant context
_tenant_context: ContextVar[Optional["TenantContext"]] = ContextVar(
    "tenant_context", default=None
)

T = TypeVar("T", bound=Base)


class TenantContext:
    """
    Stores the current tenant context for request-scoped operations.
    
    This context is used to:
    1. Automatically filter all queries by tenant_id
    2. Scope media asset paths to tenant-specific folders
    3. Enforce cross-tenant access restrictions
    """
    
    def __init__(
        self,
        tenant_id: UUID,
        user_id: UUID,
        role: str,
        is_platform_admin: bool = False,
        global_access: bool = False,
        actual_user_id: Optional[UUID] = None,
        is_impersonating: bool = False
    ):
        self.tenant_id = tenant_id
        self.user_id = user_id
        self.role = role
        self.is_platform_admin = is_platform_admin
        self.global_access = global_access
        self.actual_user_id = actual_user_id
        self.is_impersonating = is_impersonating
    
    @property
    def asset_path_prefix(self) -> str:
        """Get the cloud storage prefix for this tenant's assets"""
        return f"/brand-assets/{self.tenant_id}/"
    
    @property
    def can_access_all_tenants(self) -> bool:
        """Platform admins can access data across all tenants"""
        return self.is_platform_admin or self.global_access
    
    def validate_tenant_access(self, resource_tenant_id: UUID) -> bool:
        """Check if current context can access a resource from another tenant"""
        if self.can_access_all_tenants:
            return True
        return self.tenant_id == resource_tenant_id
    
    def get_asset_url(self, filename: str) -> str:
        """Generate a tenant-scoped asset URL"""
        base_url = getattr(settings, 'asset_base_url', '/assets')
        return f"{base_url}{self.asset_path_prefix}{filename}"


def set_tenant_context(context: TenantContext) -> None:
    """Set the tenant context for the current request"""
    _tenant_context.set(context)


def get_tenant_context() -> Optional[TenantContext]:
    """Get the current tenant context"""
    return _tenant_context.get()


def clear_tenant_context() -> None:
    """Clear the tenant context after request completion"""
    _tenant_context.set(None)


def append_impersonation_metadata(values: Optional[dict]) -> Optional[dict]:
    """Attach impersonation metadata to audit payloads when in ghost mode."""
    context = get_tenant_context()
    if context and context.is_impersonating:
        payload = dict(values or {})
        payload["impersonation"] = {
            "actual_user_id": str(context.actual_user_id) if context.actual_user_id else None,
            "effective_tenant_id": str(context.tenant_id)
        }
        return payload
    return values


class TenantScopedQuery:
    """
    A wrapper around SQLAlchemy queries that automatically applies
    tenant_id filtering to all queries.
    
    Usage:
        with TenantScopedQuery(db, current_user) as scoped:
            users = scoped.query(User).all()  # Automatically filtered by tenant_id
    """
    
    # Tables that should not be filtered by tenant_id
    GLOBAL_TABLES = {'brands', 'vouchers', 'badges'}
    
    # Tables where tenant_id filtering is optional (system records)
    OPTIONAL_TENANT_TABLES = {'badges'}  # System badges have no tenant_id
    
    def __init__(self, db: Session, tenant_context: TenantContext):
        self.db = db
        self.tenant_context = tenant_context
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass
    
    def query(self, model: Type[T], *entities) -> Query:
        """
        Create a tenant-scoped query for the given model.
        
        Automatically adds WHERE tenant_id = :current_tenant
        unless the table is in GLOBAL_TABLES.
        """
        query = self.db.query(model, *entities) if entities else self.db.query(model)
        
        # Check if model has tenant_id attribute and should be filtered
        table_name = getattr(model, '__tablename__', '')
        
        if table_name in self.GLOBAL_TABLES:
            return query
        
        if hasattr(model, 'tenant_id'):
            if self.tenant_context.global_access:
                return query
            if table_name in self.OPTIONAL_TENANT_TABLES:
                # For optional tables, include both tenant-specific and global records
                query = query.filter(
                    (model.tenant_id == self.tenant_context.tenant_id) |
                    (model.tenant_id.is_(None))
                )
            else:
                # Standard tenant filtering
                query = query.filter(model.tenant_id == self.tenant_context.tenant_id)
        
        return query
    
    def add(self, instance: T) -> T:
        """
        Add a new instance with automatic tenant_id assignment.
        """
        if hasattr(instance, 'tenant_id') and instance.tenant_id is None:
            instance.tenant_id = self.tenant_context.tenant_id
        self.db.add(instance)
        return instance
    
    def get_by_id(self, model: Type[T], id: UUID) -> Optional[T]:
        """
        Get a record by ID with tenant scoping.
        Raises HTTPException if record belongs to another tenant.
        """
        instance = self.db.query(model).filter(model.id == id).first()
        
        if instance is None:
            return None
        
        # Validate tenant access
        if hasattr(instance, 'tenant_id') and instance.tenant_id:
            if not self.tenant_context.validate_tenant_access(instance.tenant_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Resource belongs to another tenant"
                )
        
        return instance
    
    def validate_and_get(self, model: Type[T], id: UUID) -> T:
        """
        Get a record by ID, raising 404 if not found or 403 if wrong tenant.
        """
        instance = self.get_by_id(model, id)
        if instance is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{model.__name__} not found"
            )
        return instance


def get_scoped_db(
    db: Session = Depends(lambda: next(get_db_session())),
    tenant_context: TenantContext = Depends(lambda: get_tenant_context())
) -> Generator[TenantScopedQuery, None, None]:
    """
    Dependency that provides a tenant-scoped database query interface.
    
    Usage in routes:
        @router.get("/users")
        async def get_users(scoped: TenantScopedQuery = Depends(get_scoped_db)):
            return scoped.query(User).all()
    """
    if tenant_context is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tenant context not established"
        )
    
    yield TenantScopedQuery(db, tenant_context)


def get_db_session() -> Generator[Session, None, None]:
    """Get a database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_tenant(func):
    """
    Decorator that ensures a valid tenant context exists before
    executing the route handler.
    
    Usage:
        @router.get("/data")
        @require_tenant
        async def get_data():
            ...
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        context = get_tenant_context()
        if context is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        return await func(*args, **kwargs)
    return wrapper


def require_same_tenant(resource_tenant_id: UUID):
    """
    Validate that the current tenant context matches the resource's tenant.
    
    Usage:
        require_same_tenant(user.tenant_id)
    """
    context = get_tenant_context()
    if context is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    if not context.validate_tenant_access(resource_tenant_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Resource belongs to another tenant"
        )


class TenantMiddleware:
    """
    Middleware that establishes tenant context from the authenticated user.
    
    This middleware:
    1. Extracts tenant_id from the JWT token
    2. Creates a TenantContext for the request
    3. Clears the context after request completion
    """
    
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            # Context is established via the get_current_user dependency
            # This middleware just ensures cleanup
            try:
                await self.app(scope, receive, send)
            finally:
                clear_tenant_context()
        else:
            await self.app(scope, receive, send)
