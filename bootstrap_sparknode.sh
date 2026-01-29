#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BOOTSTART_SCRIPT="$ROOT_DIR/bootstart_persku.sh"

if [[ -f "$BOOTSTART_SCRIPT" ]]; then
  chmod +x "$BOOTSTART_SCRIPT"
  exec "$BOOTSTART_SCRIPT"
fi

cd "$ROOT_DIR"
docker-compose -f "$ROOT_DIR/docker-compose.yml" up -d
