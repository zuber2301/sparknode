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
else
  echo "Database timeout. Seeding skipped."
fi
