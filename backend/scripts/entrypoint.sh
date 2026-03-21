#!/usr/bin/env bash
set -euo pipefail

echo "Cleaning up stale bytecode..."
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find . -name "*.pyc" -delete 2>/dev/null || true
find . -name "*.pyo" -delete 2>/dev/null || true
find . -name "*.pyd" -delete 2>/dev/null || true

# ─── Wait for postgres to accept queries ─────────────────────────────────────
# pg_isready only checks TCP connectivity, not whether postgres can actually
# serve queries (it accepts connections before WAL recovery finishes).
# We retry with an actual query so alembic never runs against a recovering DB.
echo "Waiting for postgres to accept queries..."
DB_URL="${DATABASE_URL:-${APP_DATABASE_URL:-}}"
MAX_DB_RETRIES=30
DB_COUNT=0
until python - <<'PYEOF' 2>/dev/null
import os, sys, psycopg2
url = os.environ.get("DATABASE_URL") or os.environ.get("APP_DATABASE_URL", "")
try:
    conn = psycopg2.connect(url, connect_timeout=3)
    conn.cursor().execute("SELECT 1")
    conn.close()
    sys.exit(0)
except Exception:
    sys.exit(1)
PYEOF
do
    if [ "$DB_COUNT" -ge "$MAX_DB_RETRIES" ]; then
        echo "ERROR: Postgres did not become query-ready after ${MAX_DB_RETRIES} attempts. Aborting."
        exit 1
    fi
    printf "."
    sleep 2
    DB_COUNT=$((DB_COUNT + 1))
done
echo ""
echo "Postgres is ready."

# ─── Database migrations (Alembic — single source of truth) ──────────────────
# SKIP_ALEMBIC=1 lets the local bootstrap script run the migration itself
# (via docker-compose run --rm) before starting the long-lived containers,
# preventing three concurrent alembic processes racing on alembic_version.
if [ "${SKIP_ALEMBIC:-0}" != "1" ]; then
    echo "Running Alembic migrations..."
    cd /app
    python -m alembic upgrade head
    echo "Alembic migrations applied."
else
    echo "SKIP_ALEMBIC=1 — migrations handled externally, skipping."
fi

# Exec the original command
exec "$@"