#!/usr/bin/env bash
# SparkNode — Local Development Bootstrap
# Purpose: Pulls latest images from DockerHub, starts docker-compose stack, and seeds DB.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== SPARKNODE LOCAL DEVELOPMENT BOOTSTRAP ==="
echo "Working directory: $ROOT_DIR"
echo ""
echo "ℹ️  Database Bootstrap Strategy:"
echo "  • docker-compose.yml uses a persistent external volume (sparknode_postgres_data)"
echo "  • docker-compose.override.yml adds init scripts for fresh bootstrap only"
echo "  • For FIRST-TIME SETUP, run:"
echo "    docker volume create sparknode_postgres_data"
echo "    docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d"
echo "  • For subsequent runs, use: docker-compose pull && docker-compose up -d"
echo "  • See DATABASE_BOOTSTRAP_STRATEGY.md for details"
echo ""

# Allow an optional local/override bootstrap script. Common names we accept
# (in order) are: `bootstrap_override.sh`, `bootstrap_local.sh`,
# `bootstart_sparknode.sh` (legacy). The previous name `bootstart_persku.sh`
# appeared to be a typo and caused unexpected behavior.
BOOTSTRAP_CANDIDATES=(
  "$ROOT_DIR/bootstrap_override.sh"
  "$ROOT_DIR/bootstrap_local.sh"
  "$ROOT_DIR/bootstart_sparknode.sh"
)

for candidate in "${BOOTSTRAP_CANDIDATES[@]}"; do
  if [[ -f "$candidate" ]]; then
    chmod +x "$candidate" || true
    echo "Found local bootstrap override: $(basename "$candidate"). Executing it."
    exec "$candidate"
  fi
done

# No override script found; continue with standard bootstrap flow

cd "$ROOT_DIR"

# Load environment variables if .env exists
if [ -f .env ]; then
  set -o allexport
  source .env
  set +o allexport
fi

# ======================================================================
# STEP 1: Pull latest Docker images from DockerHub
# Set SKIP_PULL=1 to bypass pulling and use locally cached images.
# ======================================================================
if [ "${SKIP_PULL:-0}" = "1" ]; then
  echo "SKIP_PULL=1 set — skipping image pull (using cached images)."
else
  echo "=== Pulling latest images from DockerHub ==="
  docker-compose -f "$ROOT_DIR/docker-compose.yml" pull backend celery frontend
  echo "Images pulled successfully."
fi

# ======================================================================
# STEP 2: Ensure the external Postgres data volume exists.
# If this is a first-time setup on a new machine the named volume will
# not exist yet; docker-compose will refuse to start until it does.
# ======================================================================
VOLUME_NAME="${PROJECT_NAME:-sparknode}_postgres_data"
if ! docker volume inspect "$VOLUME_NAME" > /dev/null 2>&1; then
  echo "External volume '$VOLUME_NAME' not found — creating it now."
  docker volume create "$VOLUME_NAME"
  echo "Volume created."
else
  echo "Volume '$VOLUME_NAME' exists — data will be preserved."
fi

# ======================================================================
# STEP 3: Start all services.
# Postgres is brought up WITHOUT --force-recreate so its container is
# only replaced when the image tag changes — not on every bootstrap run.
# App containers (backend, celery, frontend) are force-recreated so they
# always pick up the freshly pulled image.
# ======================================================================
echo "=== Starting database ==="
docker-compose -f "$ROOT_DIR/docker-compose.yml" up -d postgres redis

echo "=== Starting app services (force-recreate) ==="
docker-compose -f "$ROOT_DIR/docker-compose.yml" up -d --force-recreate backend celery frontend

# ======================================================================
# STEP 3.5: Sync Python packages in the backend container with the
# local requirements.txt.
#
# The DockerHub image may be behind the local requirements.txt — e.g.
# when new packages were added but the CI pipeline hasn't yet built and
# pushed a new image. Without this step, "--force-recreate" recreates
# from the stale image and the backend crashes with ModuleNotFoundError,
# making login impossible until the image is rebuilt.
# ======================================================================
BACKEND_CONTAINER="${PROJECT_NAME:-sparknode}-backend"
echo "=== Syncing backend Python packages ==="
sleep 3  # give the entrypoint a moment to reach the pip phase
if docker ps --format '{{.Names}}' | grep -q "$BACKEND_CONTAINER"; then
  echo "Installing/verifying packages from requirements.txt inside container..."
  docker exec "$BACKEND_CONTAINER" pip install -r /app/requirements.txt -q 2>&1 \
    | grep -vE '^[[:space:]]*$' || true
  echo "Package sync complete. Restarting backend and celery to apply..."
  docker restart "$BACKEND_CONTAINER" > /dev/null
  docker restart "${PROJECT_NAME:-sparknode}-celery" > /dev/null 2>&1 || true
  echo "Containers restarted."
else
  echo "WARNING: Backend container not running yet — skipping package sync."
fi

# (moved) STEP 4: backend health check will run later after migrations.
# The original health wait block was relocated below to avoid timing out
# while the container executes its own migrations during startup.

# ======================================================================
# STEP 5: Wait for database and run seed
# ======================================================================
echo "=== Waiting for database ==="
MAX_RETRIES=30
COUNT=0
DB_CONTAINER="${PROJECT_NAME:-sparknode}-db"
DB_USER="${POSTGRES_USER:-sparknode}"
DB_NAME="${POSTGRES_DB:-sparknode}"

until docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" > /dev/null 2>&1 || [ $COUNT -eq $MAX_RETRIES ]; do
  sleep 2
  ((COUNT++)) || true
done

if [ $COUNT -ge $MAX_RETRIES ]; then
  echo "ERROR: Database did not become ready after timeout. Exiting."
  exit 1
fi

# Determine whether this is a fresh (empty) database by checking user count.
# Seed is only applied when no runtime users exist to avoid wiping live data.
USER_COUNT=$(docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  -t -A -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d '[:space:]' || echo "0")

if [ "${USER_COUNT:-0}" = "0" ] || [ "${FORCE_SEED:-0}" = "1" ]; then
  echo "Database is empty (user count: ${USER_COUNT}). Running seed script..."
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$ROOT_DIR/database/seed.sql"
  echo "Seeding completed."
else
  echo "Database already has ${USER_COUNT} user(s) — skipping seed to preserve runtime data."
  echo "  (Run with FORCE_SEED=1 to override, or use database/reset_dev_data.sql to wipe first.)"
fi

# ======================================================================
# STEP 6: Ensure Alembic version table and app role grants
# ======================================================================
echo "Ensuring Alembic version table exists..."
# Alembic creates its own tracking table (alembic_version) automatically
# on first run. We just grant privileges to the app role if it exists.
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  -c "CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL, CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num));" || true
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  -c "DO \$\$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sparknode_app') THEN GRANT INSERT, SELECT, UPDATE, DELETE ON alembic_version TO sparknode_app; END IF; END \$\$;" || true

# ======================================================================
# STEP 7: Apply Alembic migrations (idempotent)
# The backend entrypoint also runs alembic upgrade head, but we run it
# explicitly here to surface errors early during bootstrap.
# ======================================================================
BACKEND_CONTAINER="${PROJECT_NAME:-sparknode}-backend"
echo "=== Applying Alembic migrations ==="
if docker ps --format '{{.Names}}' | grep -q "$BACKEND_CONTAINER"; then
  docker exec -i "$BACKEND_CONTAINER" python -m alembic upgrade head && \
    echo "Alembic migrations applied successfully." || {
    echo "ERROR: Alembic migrations failed inside backend container."
    echo "Check logs: docker logs $BACKEND_CONTAINER"
    exit 1
  }
else
  echo "WARNING: Backend container ($BACKEND_CONTAINER) is not running."
  echo "Alembic migrations will run when the backend starts (via entrypoint)."
fi
echo "Migrations step complete."

# ======================================================================
# STEP 8: Wait again for backend HTTP health endpoint (post-migrations)
# ======================================================================
BACKEND_PORT="${BACKEND_EXTERNAL_PORT:-6100}"
echo "Waiting for backend HTTP health on http://localhost:$BACKEND_PORT/health..."
COUNT=0
MAX_RETRIES=60
until curl -sSf "http://localhost:$BACKEND_PORT/health" > /dev/null 2>&1 || [ $COUNT -eq $MAX_RETRIES ]; do
  sleep 1
  ((COUNT++)) || true
done
if [ $COUNT -ge $MAX_RETRIES ]; then
  echo "ERROR: Backend HTTP health did not become available on port $BACKEND_PORT (after migrations)"
  docker-compose -f "$ROOT_DIR/docker-compose.yml" logs backend --tail 50
  exit 1
fi
echo "Backend HTTP health is available."

# ======================================================================
# STEP 8: Restore canonical seeded accounts (idempotent UPSERT)
#
# This ensures the 4 demo accounts always exist with the correct password
# and roles, even after manual DB edits or accidental user deletion.
#
#   Password for all 4 accounts: jspark123
#   Hash: $2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u
# ======================================================================
echo "=== Restoring canonical seeded accounts ==="
# Note: single-quoted heredoc prevents shell expansion of $$ and variable
# substitution inside the SQL — all values are literal.
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" << 'SEED_SQL'
DO $$
DECLARE
  seed_hash TEXT := '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u';
  seed_tenant UUID := '100e8400-e29b-41d4-a716-446655440000';
  platform_tenant UUID := '00000000-0000-0000-0000-000000000000';
  dept_id UUID := '110e8400-e29b-41d4-a716-446655440000';
  platform_dept UUID := '010e8400-e29b-41d4-a716-446655440000';
BEGIN
  -- Platform Admin
  INSERT INTO users (id, tenant_id, corporate_email, password_hash, first_name, last_name,
                     org_role, roles, default_role, department_id, status, is_super_admin)
  VALUES ('220e8400-e29b-41d4-a716-446655440000', platform_tenant,
          'super_user@sparknode.io', seed_hash, 'Platform', 'Admin',
          'platform_admin', 'platform_admin', 'platform_admin', platform_dept, 'ACTIVE', TRUE)
  ON CONFLICT (tenant_id, corporate_email) DO UPDATE
    SET password_hash = seed_hash, status = 'ACTIVE',
        roles = EXCLUDED.roles, default_role = EXCLUDED.default_role;

  -- Tenant Manager
  INSERT INTO users (id, tenant_id, corporate_email, password_hash, first_name, last_name,
                     org_role, roles, default_role, department_id, status, is_super_admin)
  VALUES ('220e8400-e29b-41d4-a716-446655440001', seed_tenant,
          'tenant_manager@sparknode.io', seed_hash, 'Tenant', 'Admin',
          'tenant_manager', 'tenant_manager,dept_lead,tenant_user', 'tenant_manager',
          dept_id, 'ACTIVE', FALSE)
  ON CONFLICT (tenant_id, corporate_email) DO UPDATE
    SET password_hash = seed_hash, status = 'ACTIVE',
        roles = EXCLUDED.roles, default_role = EXCLUDED.default_role;

  -- Dept Lead
  -- Note: if the canonical ID is taken by a renamed user, update the email first
  IF EXISTS (SELECT 1 FROM users WHERE id = '220e8400-e29b-41d4-a716-446655440002'
             AND corporate_email <> 'dept_lead@sparknode.io') THEN
    UPDATE users SET corporate_email = 'dept_lead@sparknode.io'
    WHERE id = '220e8400-e29b-41d4-a716-446655440002';
  END IF;
  INSERT INTO users (id, tenant_id, corporate_email, password_hash, first_name, last_name,
                     org_role, roles, default_role, department_id, status, is_super_admin)
  VALUES ('220e8400-e29b-41d4-a716-446655440002', seed_tenant,
          'dept_lead@sparknode.io', seed_hash, 'Tenant', 'Lead',
          'dept_lead', 'dept_lead,tenant_user', 'dept_lead', dept_id, 'ACTIVE', FALSE)
  ON CONFLICT (tenant_id, corporate_email) DO UPDATE
    SET password_hash = seed_hash, status = 'ACTIVE',
        roles = EXCLUDED.roles, default_role = EXCLUDED.default_role;

  -- Tenant User
  INSERT INTO users (id, tenant_id, corporate_email, password_hash, first_name, last_name,
                     org_role, roles, default_role, department_id, status, is_super_admin)
  VALUES ('220e8400-e29b-41d4-a716-446655440003', seed_tenant,
          'user@sparknode.io', seed_hash, 'Tenant', 'User',
          'tenant_user', 'tenant_user', 'tenant_user', dept_id, 'ACTIVE', FALSE)
  ON CONFLICT (tenant_id, corporate_email) DO UPDATE
    SET password_hash = seed_hash, status = 'ACTIVE',
        roles = EXCLUDED.roles, default_role = EXCLUDED.default_role;

  -- Ensure wallets exist for all 4 seeded users
  INSERT INTO wallets (id, tenant_id, user_id, balance, lifetime_earned, lifetime_spent)
  VALUES
    (uuid_generate_v4(), platform_tenant, '220e8400-e29b-41d4-a716-446655440000', 0, 0, 0),
    (uuid_generate_v4(), seed_tenant,     '220e8400-e29b-41d4-a716-446655440001', 0, 0, 0),
    (uuid_generate_v4(), seed_tenant,     '220e8400-e29b-41d4-a716-446655440002', 0, 0, 0),
    (uuid_generate_v4(), seed_tenant,     '220e8400-e29b-41d4-a716-446655440003', 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Ensure platform admin is in system_admins
  INSERT INTO system_admins (user_id, access_level, mfa_enabled)
  VALUES ('220e8400-e29b-41d4-a716-446655440000', 'PLATFORM_ADMIN', TRUE)
  ON CONFLICT (user_id) DO NOTHING;
END $$;
SEED_SQL
echo "Canonical accounts restored."

# ======================================================================
# STEP 9: Verify required tables exist
# ======================================================================
echo "=== Verifying database tables ==="
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  -c "SELECT to_regclass('public.departments') AS departments, to_regclass('public.users') AS users, to_regclass('public.alembic_version') AS alembic_version;"

# ======================================================================
# STEP 10: Migration completeness check (Alembic head)
# ======================================================================
echo "Checking Alembic migration status..."
if docker ps --format '{{.Names}}' | grep -q "$BACKEND_CONTAINER"; then
  CURRENT_REV=$(docker exec -i "$BACKEND_CONTAINER" python -m alembic current 2>&1 | grep -oP '[a-z0-9_]+\s+\(head\)' | awk '{print $1}' || true)
  if [ -n "$CURRENT_REV" ]; then
    echo "Alembic is at head: $CURRENT_REV"
  else
    echo "WARNING: Alembic is not at head. Run: docker exec $BACKEND_CONTAINER python -m alembic upgrade head"
  fi
else
  CURRENT_REV=$(docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
    -t -A -c "SELECT version_num FROM alembic_version LIMIT 1;" 2>/dev/null | tr -d '[:space:]' || true)
  if [ -n "$CURRENT_REV" ]; then
    echo "Alembic version recorded in DB: $CURRENT_REV"
  else
    echo "WARNING: No Alembic version found in database. Migrations may not have run."
  fi
fi

# ======================================================================
# STEP 11: Print credentials summary
# ======================================================================
FRONTEND_PORT="${FRONTEND_EXTERNAL_PORT:-6173}"
API_PORT="${BACKEND_EXTERNAL_PORT:-6100}"
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║            SparkNode Bootstrap Complete ✓                   ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Frontend:       http://localhost:${FRONTEND_PORT}                  ║"
echo "║  API / Swagger:  http://localhost:${API_PORT}/docs             ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Default Credentials  (password: jspark123)                 ║"
echo "║  ──────────────────────────────────────────────────────────  ║"
echo "║  Platform Admin:  super_user@sparknode.io                   ║"
echo "║  Tenant Manager:  tenant_manager@sparknode.io               ║"
echo "║  Dept Lead:       dept_lead@sparknode.io                    ║"
echo "║  Tenant User:     user@sparknode.io                         ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Env flags:                                                  ║"
echo "║    SKIP_PULL=1            Skip docker pull (use cached imgs) ║"
echo "╚══════════════════════════════════════════════════════════════╝"
