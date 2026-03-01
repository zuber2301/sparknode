#!/usr/bin/env bash
# SparkNode — Local Development Bootstrap
# Purpose: Builds frontend, starts dev docker-compose stack, and seeds DB.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== SPARKNODE LOCAL DEVELOPMENT BOOTSTRAP ==="
echo "Working directory: $ROOT_DIR"

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
# STEP 1: Build frontend (React/Vite)
# Set SKIP_FRONTEND_BUILD=1 to skip if dist/ is already up to date.
# ======================================================================
FRONTEND_DIR="$ROOT_DIR/frontend"
if [ "${SKIP_FRONTEND_BUILD:-0}" = "1" ]; then
  echo "SKIP_FRONTEND_BUILD=1 set — skipping frontend build."
elif [ -d "$FRONTEND_DIR" ]; then
  echo "=== Building frontend ==="
  if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "Installing frontend dependencies..."
    (cd "$FRONTEND_DIR" && npm ci --prefer-offline 2>/dev/null || npm install)
  fi
  echo "Running npm run build..."
  (cd "$FRONTEND_DIR" && npm run build)
  echo "Frontend build complete."
else
  echo "WARNING: frontend directory not found at $FRONTEND_DIR — skipping build."
fi

# ======================================================================
# STEP 2: Build backend Docker image
# Set SKIP_BACKEND_BUILD=1 to skip rebuild (uses cached image).
# The backend is rebuilt by default so that code changes (e.g. Python
# dependency updates, entrypoint changes) are picked up automatically.
# ======================================================================
if [ "${SKIP_BACKEND_BUILD:-0}" = "1" ]; then
  echo "SKIP_BACKEND_BUILD=1 set — skipping backend Docker build."
else
  echo "=== Building backend Docker image ==="
  docker-compose -f "$ROOT_DIR/docker-compose.yml" build backend
  echo "Backend image built."
fi

# ======================================================================
# STEP 3: Start all services
# ======================================================================
echo "=== Starting services ==="
docker-compose -f "$ROOT_DIR/docker-compose.yml" up -d

# ======================================================================
# STEP 4: Wait for backend HTTP health endpoint
# ======================================================================
BACKEND_PORT="${BACKEND_EXTERNAL_PORT:-6100}"
echo "Waiting for backend HTTP health on http://localhost:$BACKEND_PORT/health..."
COUNT=0
MAX_RETRIES=60
until curl -sSf "http://localhost:$BACKEND_PORT/health" > /dev/null 2>&1 || [ $COUNT -eq $MAX_RETRIES ]; do
  sleep 1
  ((COUNT++))
done
if [ $COUNT -ge $MAX_RETRIES ]; then
  echo "ERROR: Backend HTTP health did not become available on port $BACKEND_PORT"
  docker-compose -f "$ROOT_DIR/docker-compose.yml" logs backend --tail 50
  exit 1
fi
echo "Backend HTTP health is available."

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
  ((COUNT++))
done

if [ $COUNT -ge $MAX_RETRIES ]; then
  echo "ERROR: Database did not become ready after timeout. Exiting."
  exit 1
fi

echo "Database is ready. Running seed script..."
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$ROOT_DIR/database/seed.sql"
echo "Seeding completed."

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
echo "║    SKIP_FRONTEND_BUILD=1  Skip npm build (use existing dist) ║"
echo "║    SKIP_BACKEND_BUILD=1   Skip docker build backend          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
