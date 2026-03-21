#!/usr/bin/env bash
# SparkNode — Local Build Bootstrap
#
# Purpose: Build ALL containers from LOCAL source code and start the stack.
#          No DockerHub pull — your working tree is what gets deployed.
#          Ideal for iterating on backend/frontend changes without triggering
#          CI, pushing to a registry, or rebuilding the production image.
#
# Usage:
#   ./scripts/local_bootstrap_sn.sh
#
# Env flags:
#   NO_CACHE=1        Force a full Docker layer-cache bust (clean build).
#   BACKEND_ONLY=1    Only rebuild backend + celery (skip frontend build).
#   FRONTEND_ONLY=1   Only rebuild frontend (skip backend/celery build).
#   FORCE_SEED=1      Re-run seed.sql even when the database is not empty.
#   SKIP_MIGRATIONS=1 Skip explicit Alembic upgrade (entrypoint still runs it).
#
# Examples:
#   NO_CACHE=1 ./scripts/local_bootstrap_sn.sh   # clean build from scratch
#   BACKEND_ONLY=1 ./scripts/local_bootstrap_sn.sh  # only rebuild backend
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_BASE="-f $ROOT_DIR/docker-compose.yml -f $ROOT_DIR/docker-compose.local.yml"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         SparkNode — LOCAL BUILD Bootstrap                   ║"
echo "║  Building from source — no DockerHub pull required          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo "Working directory: $ROOT_DIR"
echo ""

cd "$ROOT_DIR"

# ─────────────────────────────────────────────────────────────────────────────
# Load .env
# ─────────────────────────────────────────────────────────────────────────────
if [ -f .env ]; then
  set -o allexport
  source .env
  set +o allexport
  echo "Loaded .env"
else
  echo "INFO: No .env file found — using defaults from docker-compose.yml"
fi

PROJECT_NAME="${PROJECT_NAME:-sparknode}"
DB_CONTAINER="${PROJECT_NAME}-db"
BACKEND_CONTAINER="${PROJECT_NAME}-backend"
DB_USER="${POSTGRES_USER:-sparknode}"
DB_NAME="${POSTGRES_DB:-sparknode}"
BACKEND_PORT="${BACKEND_EXTERNAL_PORT:-6100}"
FRONTEND_PORT="${FRONTEND_EXTERNAL_PORT:-6173}"
API_PORT="${BACKEND_EXTERNAL_PORT:-6100}"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: Ensure external Postgres data volume exists
# ─────────────────────────────────────────────────────────────────────────────
VOLUME_NAME="${PROJECT_NAME}_postgres_data"
if ! docker volume inspect "$VOLUME_NAME" > /dev/null 2>&1; then
  echo "External volume '$VOLUME_NAME' not found — creating it now."
  docker volume create "$VOLUME_NAME"
  echo "Volume created."
else
  echo "Volume '$VOLUME_NAME' exists — data will be preserved."
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: Build images from local source
# ─────────────────────────────────────────────────────────────────────────────
BUILD_ARGS=""
if [ "${NO_CACHE:-0}" = "1" ]; then
  BUILD_ARGS="--no-cache"
  echo "NO_CACHE=1 set — Docker layer cache will be bypassed."
fi

if [ "${BACKEND_ONLY:-0}" = "1" ]; then
  echo "=== Building backend + celery images from local source ==="
  # shellcheck disable=SC2086
  docker-compose $COMPOSE_BASE build $BUILD_ARGS backend celery
  echo "Backend/celery build complete."
elif [ "${FRONTEND_ONLY:-0}" = "1" ]; then
  echo "=== Building frontend image from local source ==="
  # shellcheck disable=SC2086
  docker-compose $COMPOSE_BASE build $BUILD_ARGS frontend
  echo "Frontend build complete."
else
  echo "=== Building all images from local source ==="
  echo "  backend (../backend/Dockerfile)"
  echo "  celery  (../backend/Dockerfile)"
  echo "  frontend (../frontend/Dockerfile)"
  # shellcheck disable=SC2086
  docker-compose $COMPOSE_BASE build $BUILD_ARGS backend celery frontend
  echo "All images built successfully."
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: Start database and Redis.
#
#   WHY no --force-recreate for postgres/redis:
#   These are stateful services backed by named volumes. Force-recreation is
#   destructive to the connection pool (backend sees broken pipes) and causes
#   a WAL-recovery window on restart during which postgres rejects queries.
#   `up -d` is idempotent: it only restarts if the compose config actually
#   changed (new env var, new mount, etc.). Data in named volumes is always safe.
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== Starting database and Redis ==="
# shellcheck disable=SC2086
docker-compose $COMPOSE_BASE up -d postgres redis

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: Wait for postgres to accept actual queries (not just TCP connections).
#
#   pg_isready returns OK as soon as postgres opens its listen socket, which
#   happens BEFORE WAL recovery completes. We execute a real SELECT 1 so that
#   alembic and the seed UPSERT never run against a recovering database.
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== Waiting for postgres to accept queries ==="
MAX_RETRIES=45
COUNT=0
until docker exec "$DB_CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1 \
  || [ $COUNT -eq $MAX_RETRIES ]; do
  sleep 2
  ((COUNT++)) || true
  printf "."
done
echo ""

if [ $COUNT -ge $MAX_RETRIES ]; then
  echo "ERROR: Database did not become ready. Check: docker logs $DB_CONTAINER"
  exit 1
fi
echo "Database is ready."

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5: Seed (only on empty DB, or when FORCE_SEED=1)
# ─────────────────────────────────────────────────────────────────────────────
USER_COUNT=$(docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  -t -A -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d '[:space:]' || echo "0")

if [ "${USER_COUNT:-0}" = "0" ] || [ "${FORCE_SEED:-0}" = "1" ]; then
  echo "Database is empty (user count: ${USER_COUNT:-0}). Running seed script..."
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$ROOT_DIR/database/seed.sql"
  echo "Seeding completed."
else
  echo "Database already has ${USER_COUNT} user(s) — skipping seed to preserve data."
  echo "  (Run with FORCE_SEED=1 to override, or pipe database/reset_dev_data.sql to drop first.)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6: Ensure Alembic table + app role grants
# ─────────────────────────────────────────────────────────────────────────────
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  -c "CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL, CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num));" > /dev/null 2>&1 || true
docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  -c "DO \$\$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sparknode_app') THEN GRANT INSERT, SELECT, UPDATE, DELETE ON alembic_version TO sparknode_app; END IF; END \$\$;" > /dev/null 2>&1 || true

# ─────────────────────────────────────────────────────────────────────────────
# STEP 7: Run Alembic migrations via a one-shot container (BEFORE the
#         long-lived backend/celery start).
#
#   WHY: Running alembic BEFORE the backend starts eliminates the three-way
#   race condition where backend-entrypoint, celery-entrypoint, and this script
#   all tried to run `alembic upgrade head` simultaneously — competing on the
#   alembic_version row lock and causing spurious failures.
#
#   SKIP_ALEMBIC=1 tells the entrypoint to skip its own alembic call so the
#   one-shot container below is the single source of truth.
# ─────────────────────────────────────────────────────────────────────────────
if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
  echo ""
  echo "=== Applying Alembic migrations (one-shot) ==="
  # --no-deps: don't try to start postgres/redis again (already running)
  # -e SKIP_ALEMBIC=1: entrypoint skips its own alembic call; we pass it directly
  # shellcheck disable=SC2086
  docker-compose $COMPOSE_BASE run --rm --no-deps \
    -e SKIP_ALEMBIC=1 \
    backend python -m alembic upgrade head && \
    echo "Alembic migrations applied." || {
      echo "ERROR: Alembic migration failed."
      exit 1
    }
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 8: Restore canonical seed accounts (idempotent UPSERT).
#
#   WHY BEFORE starting the backend: this guarantees the known-good password
#   hash is in the DB BEFORE the first HTTP request can reach the login endpoint.
#   Previously this ran after the health check, leaving a window where the
#   backend was healthy but credentials might be stale.
#
#   psql --set ON_ERROR_STOP=1 ensures any SQL error fails loudly (psql
#   normally exits 0 even on SQL errors, silently swallowing failures).
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== Restoring canonical seed accounts ==="
docker exec -i "$DB_CONTAINER" \
  psql -U "$DB_USER" -d "$DB_NAME" --set ON_ERROR_STOP=1 << 'SEED_SQL'
DO $$
DECLARE
  seed_hash TEXT := '$2b$12$wUO54KkKhLF1ShGUklxUZ.F7rxZ5Vy.c5psXvulEaukdcvNuiZX3u';
  seed_tenant UUID := '100e8400-e29b-41d4-a716-446655440000';
  platform_tenant UUID := '00000000-0000-0000-0000-000000000000';
  dept_id UUID := '110e8400-e29b-41d4-a716-446655440000';
  platform_dept UUID := '010e8400-e29b-41d4-a716-446655440000';
BEGIN
  INSERT INTO users (id, tenant_id, corporate_email, password_hash, first_name, last_name,
                     org_role, roles, default_role, department_id, status, is_super_admin)
  VALUES ('220e8400-e29b-41d4-a716-446655440000', platform_tenant,
          'super_user@sparknode.io', seed_hash, 'Platform', 'Admin',
          'platform_admin', 'platform_admin', 'platform_admin', platform_dept, 'ACTIVE', TRUE)
  ON CONFLICT (tenant_id, corporate_email) DO UPDATE
    SET password_hash = seed_hash, status = 'ACTIVE',
        roles = EXCLUDED.roles, default_role = EXCLUDED.default_role;

  INSERT INTO users (id, tenant_id, corporate_email, password_hash, first_name, last_name,
                     org_role, roles, default_role, department_id, status, is_super_admin)
  VALUES ('220e8400-e29b-41d4-a716-446655440001', seed_tenant,
          'tenant_manager@sparknode.io', seed_hash, 'Tenant', 'Admin',
          'tenant_manager', 'tenant_manager,dept_lead,tenant_user,sales_marketing', 'tenant_manager',
          dept_id, 'ACTIVE', FALSE)
  ON CONFLICT (tenant_id, corporate_email) DO UPDATE
    SET password_hash = seed_hash, status = 'ACTIVE',
        roles = EXCLUDED.roles, default_role = EXCLUDED.default_role;

  -- Fix email drift on dept_lead before the upsert, then upsert by email.
  UPDATE users SET corporate_email = 'dept_lead@sparknode.io'
  WHERE id = '220e8400-e29b-41d4-a716-446655440002'
    AND corporate_email <> 'dept_lead@sparknode.io';

  INSERT INTO users (id, tenant_id, corporate_email, password_hash, first_name, last_name,
                     org_role, roles, default_role, department_id, status, is_super_admin)
  VALUES ('220e8400-e29b-41d4-a716-446655440002', seed_tenant,
          'dept_lead@sparknode.io', seed_hash, 'Tenant', 'Lead',
          'dept_lead', 'dept_lead,tenant_user', 'dept_lead', dept_id, 'ACTIVE', FALSE)
  ON CONFLICT (tenant_id, corporate_email) DO UPDATE
    SET password_hash = seed_hash, status = 'ACTIVE',
        roles = EXCLUDED.roles, default_role = EXCLUDED.default_role;

  INSERT INTO users (id, tenant_id, corporate_email, password_hash, first_name, last_name,
                     org_role, roles, default_role, department_id, status, is_super_admin)
  VALUES ('220e8400-e29b-41d4-a716-446655440003', seed_tenant,
          'user@sparknode.io', seed_hash, 'Tenant', 'User',
          'tenant_user', 'tenant_user', 'tenant_user', dept_id, 'ACTIVE', FALSE)
  ON CONFLICT (tenant_id, corporate_email) DO UPDATE
    SET password_hash = seed_hash, status = 'ACTIVE',
        roles = EXCLUDED.roles, default_role = EXCLUDED.default_role;

  INSERT INTO wallets (id, tenant_id, user_id, balance, lifetime_earned, lifetime_spent)
  VALUES
    (gen_random_uuid(), platform_tenant, '220e8400-e29b-41d4-a716-446655440000', 0, 0, 0),
    (gen_random_uuid(), seed_tenant,     '220e8400-e29b-41d4-a716-446655440001', 0, 0, 0),
    (gen_random_uuid(), seed_tenant,     '220e8400-e29b-41d4-a716-446655440002', 0, 0, 0),
    (gen_random_uuid(), seed_tenant,     '220e8400-e29b-41d4-a716-446655440003', 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO system_admins (user_id, access_level, mfa_enabled)
  VALUES ('220e8400-e29b-41d4-a716-446655440000', 'PLATFORM_ADMIN', TRUE)
  ON CONFLICT (user_id) DO NOTHING;
END $$;
SEED_SQL
echo "Canonical accounts restored."

# ─────────────────────────────────────────────────────────────────────────────
# STEP 9: Start app containers with --force-recreate (picks up new builds).
#         postgres and redis are intentionally excluded — they need no restart.
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== Starting app services with fresh local build ==="
if [ "${BACKEND_ONLY:-0}" = "1" ]; then
  # shellcheck disable=SC2086
  docker-compose $COMPOSE_BASE up -d --force-recreate backend celery
elif [ "${FRONTEND_ONLY:-0}" = "1" ]; then
  # shellcheck disable=SC2086
  docker-compose $COMPOSE_BASE up -d --force-recreate frontend
else
  # shellcheck disable=SC2086
  docker-compose $COMPOSE_BASE up -d --force-recreate backend celery frontend
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 10: Wait for backend HTTP health
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "Waiting for backend HTTP health on http://localhost:${BACKEND_PORT}/health..."
COUNT=0
MAX_RETRIES=90
until curl -sSf "http://localhost:${BACKEND_PORT}/health" > /dev/null 2>&1 || [ $COUNT -eq $MAX_RETRIES ]; do
  sleep 1
  ((COUNT++)) || true
  printf "."
done
echo ""

if [ $COUNT -ge $MAX_RETRIES ]; then
  echo "ERROR: Backend health endpoint did not respond on port ${BACKEND_PORT}."
  # shellcheck disable=SC2086
  docker-compose $COMPOSE_BASE logs backend --tail 50
  exit 1
fi
echo "Backend is healthy."

# ─────────────────────────────────────────────────────────────────────────────
# STEP 11: Detect orphaned tenants (tenant with no manager user).
# These arise when create_tenant API runs but its user row is missing (e.g.
# after a partial DB restore or a selective data wipe).
# ─────────────────────────────────────────────────────────────────────────────
ORPHANED=$(docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "
  SELECT t.name || ' (' || t.id || ')'
  FROM tenants t
  WHERE t.id NOT IN (
    '00000000-0000-0000-0000-000000000000',
    '100e8400-e29b-41d4-a716-446655440000',
    '100e8400-e29b-41d4-a716-446655440001',
    '100e8400-e29b-41d4-a716-446655440010',
    '100e8400-e29b-41d4-a716-446655440011',
    '100e8400-e29b-41d4-a716-446655440012',
    '550e8400-e29b-41d4-a716-446655440000'
  )
  AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.tenant_id = t.id AND u.org_role = 'tenant_manager'
  );
" 2>/dev/null || true)

if [ -n "$ORPHANED" ]; then
  echo ""
  echo "WARNING: The following API-provisioned tenants have NO tenant_manager user:"
  echo "$ORPHANED" | while IFS= read -r line; do echo "  • $line"; done
  echo "  Their manager credentials were recorded in the audit_log at creation time."
  echo "  To recover, query: SELECT new_values->>'admin_email' FROM audit_log WHERE action='tenant_created';"
  echo "  Then re-create the manager via the Platform Admin UI or API."
fi

# Alembic status (informational only)
if docker ps --format '{{.Names}}' | grep -q "^${BACKEND_CONTAINER}$"; then
  CURRENT_REV=$(docker exec -i "$BACKEND_CONTAINER" python -m alembic current 2>&1 \
    | grep -oP '[a-z0-9_]+\s+\(head\)' | awk '{print $1}' || true)
  if [ -n "$CURRENT_REV" ]; then
    echo "Alembic at head: $CURRENT_REV"
  else
    echo "WARNING: Alembic not at head. Run: docker exec $BACKEND_CONTAINER python -m alembic upgrade head"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║       SparkNode LOCAL BUILD — Ready ✓                       ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Frontend:       http://localhost:${FRONTEND_PORT}                  ║"
echo "║  API / Swagger:  http://localhost:${API_PORT}/docs             ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Backend hot-reload is ON  (saves → auto-restart)           ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Default Credentials  (password: jspark123)                 ║"
echo "║  ──────────────────────────────────────────────────────────  ║"
echo "║  Platform Admin:  super_user@sparknode.io                   ║"
echo "║  Tenant Manager:  tenant_manager@sparknode.io               ║"
echo "║  Dept Lead:       dept_lead@sparknode.io                    ║"
echo "║  Tenant User:     user@sparknode.io                         ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Useful commands:                                           ║"
echo "║    docker logs -f ${PROJECT_NAME}-backend                   ║"
echo "║    BACKEND_ONLY=1 ./scripts/local_bootstrap_sn.sh          ║"
echo "║    NO_CACHE=1     ./scripts/local_bootstrap_sn.sh          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
