#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/database/migrations"

DB_URL="${APP_DATABASE_URL:-${DATABASE_URL:-}}"
if [ -z "$DB_URL" ]; then
  echo "ERROR: APP_DATABASE_URL or DATABASE_URL must be set"
  exit 2
fi

PSQL_CMD=(psql "$DB_URL" -v ON_ERROR_STOP=1 -q)

# Ensure migration history exists
"${PSQL_CMD[@]}" -c "CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz DEFAULT now());"

pending=0
for f in $(ls -1 "$MIGRATIONS_DIR"/*.sql | sort); do
  fname="$(basename "$f")"
  exists=$("${PSQL_CMD[@]}" -tAc "SELECT 1 FROM schema_migrations WHERE filename = '$fname';") || true
  if [ "$exists" != "1" ]; then
    echo "PENDING MIGRATION: $fname"
    pending=1
  fi
done

if [ "$pending" -ne 0 ]; then
  echo "ERROR: There are pending migrations. Apply migrations before starting the app."
  exit 1
fi

echo "No pending migrations."