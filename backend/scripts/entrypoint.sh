#!/usr/bin/env bash
set -euo pipefail

echo "Cleaning up stale bytecode..."
find . -type d -name "__pycache__" -exec rm -rf {} +
find . -name "*.pyc" -delete
find . -name "*.pyo" -delete
find . -name "*.pyd" -delete

# Apply migrations before starting the app (best-effort)
if [ -x "$(dirname "${BASH_SOURCE[0]}")/apply_migrations.sh" ]; then
  echo "Applying migrations..."
  "$(dirname "${BASH_SOURCE[0]}")/apply_migrations.sh"
fi

# Exec the original command
exec "$@"