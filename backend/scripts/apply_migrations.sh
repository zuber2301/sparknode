#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Support running from backend container (migrations live in repo root/database)
if [ -d "$ROOT_DIR/database/migrations" ]; then
  MIGRATIONS_DIR="$ROOT_DIR/database/migrations"
elif [ -d "$ROOT_DIR/../database/migrations" ]; then
  MIGRATIONS_DIR="$ROOT_DIR/../database/migrations"
else
  echo "ERROR: migrations directory not found"
  exit 1
fi

DB_URL="${APP_DATABASE_URL:-${DATABASE_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "ERROR: APP_DATABASE_URL or DATABASE_URL must be set"
  exit 2
fi

export PGPASSWORD="$(echo "$DB_URL" | sed -nE 's/.*:(.*)@.*/\1/p' | sed 's/\/.*//')" || true

PSQL_CMD=(psql "$DB_URL" -v ON_ERROR_STOP=1 -q)

# Ensure schema_migrations table exists -- only check for existence (creation requires superuser)
exists=$("${PSQL_CMD[@]}" -tAc "SELECT 1 FROM pg_tables WHERE tablename = 'schema_migrations'") || true
if [ "$exists" != "1" ]; then
  echo "NOTICE: schema_migrations table does not exist or cannot be created by this role. Ensure a superuser created it before running this script."
else
  echo "schema_migrations table present."
fi

for f in $(ls -1 "$MIGRATIONS_DIR"/*.sql | sort); do
  fname="$(basename "$f")"
  echo "Checking migration: $fname"
  exists=$("${PSQL_CMD[@]}" -tAc "SELECT 1 FROM schema_migrations WHERE filename = '$fname';") || true
  if [ "$exists" = "1" ]; then
    echo "  -> already applied"
    continue
  fi

  echo "  -> applying $fname"
  "${PSQL_CMD[@]}" -f "$f"
  "${PSQL_CMD[@]}" -c "INSERT INTO schema_migrations (filename) VALUES ('$fname');"
  echo "  -> applied"
done

echo "All migrations applied (if any were pending)"