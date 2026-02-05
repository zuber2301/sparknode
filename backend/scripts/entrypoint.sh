#!/usr/bin/env bash
set -euo pipefail

# Apply migrations before starting the app (best-effort)
if [ -x "$(dirname "${BASH_SOURCE[0]}")/apply_migrations.sh" ]; then
  echo "Applying migrations..."
  "$(dirname "${BASH_SOURCE[0]}")/apply_migrations.sh"
fi

# Exec the original command
exec "$@"