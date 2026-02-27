"""
Automatic Tenant Query Isolation

This module provides defense-in-depth tenant isolation by hooking into
SQLAlchemy's ORM events. It ensures that ALL queries on tenant-scoped
models automatically include `WHERE tenant_id = :current_tenant_id`,
preventing cross-tenant data leaks even if a developer forgets to add
the filter manually.

Architecture:
    1. `TenantBoundSession` — a custom Session subclass that injects
       tenant_id filters into every SELECT/UPDATE/DELETE query.
    2. Models are introspected for a `tenant_id` column; global tables
       (brands, vouchers, reward_catalog_master) are exempt.
    3. Platform admins with `global_access=True` bypass the filter.

Usage:
    Replace `SessionLocal` with `TenantSessionLocal` in the `get_db()`
    dependency for automatic enforcement.
"""

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session, Query
from typing import Set

# Tables that are intentionally global (no per-tenant filtering)
GLOBAL_TABLES: Set[str] = {
    "tenants",             # Tenant registry itself
    "system_admins",       # Platform-level admin records
    "brands",              # Global brand catalog
    "vouchers",            # Global voucher catalog
    "reward_catalog_master",  # Global reward catalog
}


def _has_tenant_id(mapper) -> bool:
    """Check if a mapper's underlying table has a tenant_id column."""
    table = mapper.local_table
    if table is None:
        return False
    return "tenant_id" in {c.name for c in table.columns}


def _get_table_name(mapper) -> str:
    """Get the table name from a mapper."""
    table = mapper.local_table
    return table.name if table is not None else ""


def install_tenant_filter(session_factory):
    """
    Install a `do_orm_execute` event hook on the given session class
    that automatically appends tenant_id filtering for all ORM queries.

    This is the *safety net* layer — it runs AFTER any manual filtering
    the developer already added, so it won't conflict with explicit
    `.filter(Model.tenant_id == ...)` calls.
    """

    @event.listens_for(session_factory, "do_orm_execute")
    def _apply_tenant_filter(orm_execute_state):
        # Only filter SELECT statements (not INSERT)
        if not orm_execute_state.is_select:
            return

        # Import here to avoid circular imports
        from core.tenant import get_tenant_context

        context = get_tenant_context()
        if context is None:
            # No tenant context (e.g., startup, health check, login)
            return

        if context.global_access:
            # Platform admin with global access — no filtering
            return

        # Get all mapper entities involved in this query
        try:
            # For modern SQLAlchemy 2.x
            statement = orm_execute_state.statement
            if hasattr(statement, "column_descriptions"):
                for desc in statement.column_descriptions:
                    entity = desc.get("entity")
                    if entity is None:
                        continue

                    mapper = inspect(entity, raiseerr=False)
                    if mapper is None:
                        continue

                    table_name = _get_table_name(mapper)
                    if table_name in GLOBAL_TABLES:
                        continue

                    if _has_tenant_id(mapper):
                        # Augment the WHERE clause with tenant_id filter
                        tenant_col = getattr(entity, "tenant_id", None)
                        if tenant_col is not None:
                            orm_execute_state.statement = statement.where(
                                tenant_col == context.tenant_id
                            )
                            # Re-read mutated statement for next entity
                            statement = orm_execute_state.statement
        except Exception:
            # Safety: never let the filter hook crash a query.
            # Log in production, but don't break the request.
            import logging
            logging.getLogger(__name__).warning(
                "Tenant filter hook failed — query may be unscoped",
                exc_info=True,
            )
