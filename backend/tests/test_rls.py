import pytest
from database import engine
from sqlalchemy import text

# Tenants from seed.sql
TENANT_A = '100e8400-e29b-41d4-a716-446655440000'  # jSpark
TENANT_B = '100e8400-e29b-41d4-a716-446655440010'  # Triton


def test_departments_rls_isolation():
    """Verify that RLS prevents selecting departments from a different tenant when session tenant is set."""
    with engine.connect() as conn:
        # Create a non-superuser role to test RLS enforcement and switch into it
        conn.execute(text("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rls_tester') THEN CREATE ROLE rls_tester; END IF; END $$;"))
        # Grant the role minimal SELECT privileges required for testing
        conn.execute(text("GRANT SELECT ON TABLE departments TO rls_tester"))
        conn.execute(text("SET ROLE rls_tester"))

        # Ensure session is set to TENANT_A and not platform-admin
        conn.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": TENANT_A})
        conn.execute(text("SET LOCAL app.is_platform_admin = 'false'"))

        # Query departments for TENANT_A (should return rows)
        res_a = conn.execute(text("SELECT id, tenant_id FROM departments WHERE tenant_id = :tid"), {"tid": TENANT_A}).fetchall()
        assert len(res_a) > 0, "Expected at least one department for TENANT_A"

        # Query departments for TENANT_B while session tenant is TENANT_A - should return 0 due to RLS
        res_cross = conn.execute(text("SELECT id, tenant_id FROM departments WHERE tenant_id = :tid"), {"tid": TENANT_B}).fetchall()

        # Reset role to prevent leaking the role into other tests
        conn.execute(text("RESET ROLE"))

        assert len(res_cross) == 0, "RLS failed: cross-tenant rows visible when it should not be"


def test_departments_rls_platform_admin():
    """Platform admin session should be able to see departments for any tenant."""
    with engine.connect() as conn:
        conn.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": TENANT_A})
        conn.execute(text("SET LOCAL app.is_platform_admin = 'true'"))

        res = conn.execute(text("SELECT id, tenant_id FROM departments WHERE tenant_id = :tid"), {"tid": TENANT_B}).fetchall()
        # Platform admin should be able to see cross-tenant rows (seed has entries for TENANT_B)
        assert len(res) > 0, "Platform admin should be able to see other tenant's departments"