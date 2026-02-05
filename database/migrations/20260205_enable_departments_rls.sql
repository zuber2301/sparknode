-- Migration: 2026-02-05 - Enable Row-Level Security for departments
BEGIN;

-- Enable RLS on departments and create a tenant isolation policy
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- Policy allows access when the session tenant matches department.tenant_id
-- or when the session indicates platform admin access
CREATE POLICY tenant_isolation_departments ON departments
    USING (
        tenant_id = current_setting('app.tenant_id')::uuid
        OR current_setting('app.is_platform_admin', 'false') = 'true'
    );

COMMIT;