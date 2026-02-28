#!/usr/bin/env bash
set -euo pipefail

echo "Cleaning up stale bytecode..."
find . -type d -name "__pycache__" -exec rm -rf {} +
find . -name "*.pyc" -delete
find . -name "*.pyo" -delete
find . -name "*.pyd" -delete

# ─── Database migrations (Alembic — single source of truth) ──
echo "Running Alembic migrations..."
cd /app
python -m alembic upgrade head
echo "Alembic migrations applied."

# Legacy raw-SQL runner (kept as fallback; remove once fully migrated)
# if [ -x "$(dirname "${BASH_SOURCE[0]}")/apply_migrations.sh" ]; then
#   echo "Applying legacy SQL migrations..."
#   "$(dirname "${BASH_SOURCE[0]}")/apply_migrations.sh"
# fi

# Exec the original command
exec "$@"