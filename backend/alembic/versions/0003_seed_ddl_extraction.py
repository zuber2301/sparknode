"""Extract DDL patches from seed.sql into Alembic.

Moves all CREATE TABLE / ALTER TABLE / constraint manipulation that was
previously embedded in database/seed.sql into a tracked migration.

Every statement is idempotent (IF NOT EXISTS / IF EXISTS / DO $$ … END $$).

Revision ID: 0003_seed_ddl_extraction
Revises: 0002_consolidate_raw_sql
"""
from alembic import op

revision = "0003_seed_ddl_extraction"
down_revision = "0002_consolidate_raw_sql"
branch_labels = None
depends_on = None


_UPGRADE_SQL = r"""
-- ── Columns originally patched inside seed.sql ──────────────
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS branding_config JSONB DEFAULT '{}';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS master_budget_balance DECIMAL(15, 2) NOT NULL DEFAULT 0;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{}';

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS corporate_email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_sent_at TIMESTAMP WITH TIME ZONE;

-- ── Widen user status constraint ────────────────────────────
DO $$
DECLARE
     constraint_record RECORD;
BEGIN
     FOR constraint_record IN
          SELECT conname FROM pg_constraint
          WHERE conrelid = 'users'::regclass AND contype = 'c'
            AND pg_get_constraintdef(oid) ILIKE '%status%'
     LOOP
          EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', constraint_record.conname);
     END LOOP;
     EXECUTE 'ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN (''PENDING_INVITE'', ''ACTIVE'', ''DEACTIVATED'', ''pending_invite'', ''active'', ''deactivated''))';
END $$;

-- ── Tables previously created inside seed.sql ───────────────
-- Drop legacy system_admins if it has the old email column
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='system_admins' AND column_name='email') THEN
        DROP TABLE system_admins CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS system_admins (
     admin_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
     access_level VARCHAR(20) DEFAULT 'PLATFORM_ADMIN',
     mfa_enabled BOOLEAN DEFAULT TRUE,
     last_login_at TIMESTAMP WITH TIME ZONE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE system_admins ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS otp_tokens (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     channel VARCHAR(20) NOT NULL,
     destination VARCHAR(255) NOT NULL,
     token_hash VARCHAR(255) NOT NULL,
     expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
     used_at TIMESTAMP WITH TIME ZONE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_upload_staging (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
     batch_id UUID NOT NULL,
     full_name VARCHAR(255) NOT NULL,
     email VARCHAR(255) NOT NULL,
     department_name VARCHAR(255),
     role VARCHAR(50),
     manager_email VARCHAR(255),
     first_name VARCHAR(100),
     last_name VARCHAR(100),
     department_id UUID,
     manager_id UUID,
     status VARCHAR(50) DEFAULT 'pending',
     errors JSONB DEFAULT '[]'::jsonb,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_upload_staging_batch ON user_upload_staging(batch_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tenant_corporate_email ON users(tenant_id, corporate_email);
"""


def upgrade() -> None:
    op.execute(_UPGRADE_SQL)


def downgrade() -> None:
    # Downgrade is intentionally a no-op.
    # Restore from a database backup to revert.
    pass
