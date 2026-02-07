#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BOOTSTART_SCRIPT="$ROOT_DIR/bootstart_persku.sh"

if [[ -f "$BOOTSTART_SCRIPT" ]]; then
  chmod +x "$BOOTSTART_SCRIPT"
  exec "$BOOTSTART_SCRIPT"
fi

cd "$ROOT_DIR"

# Load environment variables if .env exists
if [ -f .env ]; then
  # Use a more robust way to export variables
  set -o allexport
  source .env
  set +o allexport
fi

docker-compose -f "$ROOT_DIR/docker-compose.yml" up -d

# Wait for backend HTTP health endpoint to be available on the host port
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

# Wait for database to be ready and run seed script
echo "Waiting for database to be ready..."
MAX_RETRIES=30
COUNT=0
DB_CONTAINER="${PROJECT_NAME:-sparknode}-db"
DB_USER="${POSTGRES_USER:-sparknode}"
DB_NAME="${POSTGRES_DB:-sparknode}"

until docker exec "$DB_CONTAINER" pg_isready -U "$DB_USER" > /dev/null 2>&1 || [ $COUNT -eq $MAX_RETRIES ]; do
  sleep 2
  ((COUNT++))
done

if [ $COUNT -lt $MAX_RETRIES ]; then
  echo "Database is ready. Running seed script..."
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" < "$ROOT_DIR/database/seed.sql"
  echo "Seeding completed."

  # Ensure schema_migrations table exists and is writable by app role
  echo "Ensuring schema_migrations table exists and granting minimal privileges"
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz DEFAULT now());" || true
  # Grant insert/select on schema_migrations to the app role if it exists
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sparknode_app') THEN GRANT INSERT, SELECT ON schema_migrations TO sparknode_app; END IF; END $$;" || true

  # Apply SQL migrations using backend's migration runner (idempotent)
  BACKEND_CONTAINER="${PROJECT_NAME:-sparknode}-backend"
  echo "Applying SQL migrations via backend container: $BACKEND_CONTAINER"
  if docker ps --format '{{.Names}}' | grep -q "$BACKEND_CONTAINER"; then
    docker exec -i "$BACKEND_CONTAINER" bash -lc "./scripts/apply_migrations.sh" || {
      echo "Warning: apply_migrations failed inside backend container; attempting direct DB apply"
      # Fallback: apply migrations directly from host psql into the DB container and record applied files
      for f in "$ROOT_DIR/database/migrations"/*.sql; do
        fname="$(basename "$f")"
        echo "Applying $f"
        if docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" -f - < "$f"; then
          echo "Recording $fname as applied"
          docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" -c "INSERT INTO schema_migrations (filename) VALUES ('$fname') ON CONFLICT (filename) DO NOTHING;"
        else
          echo "Migration $fname failed (skipped recording)"
        fi
      done
    }
  else
    echo "Backend container not found; applying migrations directly to DB"
    for f in "$ROOT_DIR/database/migrations"/*.sql; do
      fname="$(basename "$f")"
      echo "Applying $f"
      if docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -f - < "$f"; then
        echo "Recording $fname as applied"
        docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "INSERT INTO schema_migrations (filename) VALUES ('$fname') ON CONFLICT (filename) DO NOTHING;"
      else
        echo "Migration $fname failed (skipped recording)"
      fi
    done
  fi

  # Verify required tables exist
  echo "Verifying database tables..."
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT to_regclass('public.departments') AS departments, to_regclass('public.users') AS users, to_regclass('public.schema_migrations') AS schema_migrations;"

  # Health-check: ensure all migrations in the migrations folder were recorded as applied
  echo "Checking pending migrations..."
  MIGRATION_FILES=()
  for f in "$ROOT_DIR/database/migrations"/*.sql; do
    [ -f "$f" ] || continue
    MIGRATION_FILES+=("$(basename "$f")")
  done

  if [ ${#MIGRATION_FILES[@]} -eq 0 ]; then
    echo "No migration files found in $ROOT_DIR/database/migrations"
  else
    files_sql_list=$(printf "'%s', " "${MIGRATION_FILES[@]}")
    files_sql_list=${files_sql_list%, }
    applied_count=$(docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "SELECT count(*) FROM schema_migrations WHERE filename IN ($files_sql_list);" | tr -d '[:space:]')
    total_count=${#MIGRATION_FILES[@]}
    if [ -z "$applied_count" ]; then
      echo "ERROR: Unable to query schema_migrations. Failing bootstrap."
      exit 1
    fi
    if [ "$applied_count" -lt "$total_count" ]; then
      echo "ERROR: $((total_count - applied_count)) pending migration(s) not applied:"
      pending_sql_vals=$(printf "('%s')," "${MIGRATION_FILES[@]}")
      pending_sql_vals=${pending_sql_vals%,}
      pending_list=$(docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -A -c "SELECT filename FROM (VALUES $pending_sql_vals) t(filename) LEFT JOIN schema_migrations sm ON t.filename = sm.filename WHERE sm.filename IS NULL;")
      echo "$pending_list"
      echo "Failing bootstrap due to pending critical migrations."
      exit 1
    else
      echo "All migrations recorded as applied ($applied_count/$total_count)."
    fi
  fi
else
  echo "Database timeout. Seeding skipped."
fi
