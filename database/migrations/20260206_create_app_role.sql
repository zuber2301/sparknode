-- Migration: 2026-02-06 - Create non-superuser DB role for application connections
BEGIN;

-- Create an application role (non-superuser) if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sparknode_app') THEN
        -- NOTE: Update the password after running this migration in production
        CREATE ROLE sparknode_app LOGIN PASSWORD 'change_me_in_production';
    END IF;
END
$$;

-- Grant minimal privileges required for normal application operation
GRANT CONNECT ON DATABASE sparknode TO sparknode_app;
GRANT USAGE ON SCHEMA public TO sparknode_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sparknode_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sparknode_app;

-- Ensure future tables/sequences created in the schema grant privileges to the app role
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sparknode_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO sparknode_app;

COMMIT;
