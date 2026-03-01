#!/usr/bin/env bash
# SparkNode — Control Plane Orchestrator (Docker-Only)
# Purpose: Boots the Management & Infrastructure Orchestration Suite as a isolated container stack.
# NOTE: This script does NOT touch your target infrastructure; it starts the "BRAIN" that manages it.
set -euo pipefail

# Find project root relative to this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROD_DOCKER_DIR="$SCRIPT_DIR/docker"

echo "=== SPARKNODE CONTROL PLANE ORCHESTRATOR ==="
echo "Mode: Deployment Management System"
echo "Orchestration Root: $SCRIPT_DIR"

# 1. Load context and environment
if [ -f "$PROD_DOCKER_DIR/.env" ]; then
  echo "Loading Control Plane environment..."
  set -o allexport
  source "$PROD_DOCKER_DIR/.env"
  set +o allexport
else
  echo "ERROR: Control Plane .env not found at $PROD_DOCKER_DIR/.env"
  echo "Config required for Orchestrator Database and Cloud provider credentials."
  exit 1
fi

# 2. Start the Platform Stack (The "Brain")
echo "=== Starting SparkNode Control Plane (Management UI + Orchestrator) ==="
cd "$PROD_DOCKER_DIR"
docker-compose -f docker-compose.platform.yml up -d --build

# 3. Verify Orchestrator Readiness
echo "Checking Orchestrator status..."
sleep 5

PROJECT_NAME="${PROJECT_NAME:-sparknode}"

if docker ps --format '{{.Names}}' | grep -q "${PROJECT_NAME}-traefik"; then
  echo "✅ Management Router (Traefik) is Active."
fi

if docker ps --format '{{.Names}}' | grep -q "${PROJECT_NAME}-control-plane"; then
  echo "✅ Orchestrator API (Terraform-ready) is Active."
fi

echo "=== CONTROL PLANE ONLINE ==="
echo "Access Management UI: https://${DOMAIN:-localhost}/ui"
echo "Access Orchestrator API: https://${DOMAIN:-localhost}/api/v1"
echo "------------------------------------------------------------"
echo "Next step: Log in to UI to provision Target Infrastructure."
