#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ──────────────────────────────────────────
TF_DIR="/root/repos_products/sparknode/deployment_sparknode/terraform/modules/gcp"
APP_DIR="/opt/sparknode"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"
VERSION="${APP_VERSION:-latest}"
SKIP_TERRAFORM="${SKIP_TERRAFORM:-false}"

if [ "$SKIP_TERRAFORM" = "true" ]; then
    echo ">>> Bypassing Step 1 (SKIP_TERRAFORM=true)..."
else
    echo ">>> Step 1: Initializing GCP Infrastructure via Terraform..."
    cd "$TF_DIR"
    terraform init > /dev/null
    terraform apply -auto-approve > /dev/null
fi

# ─── Fetch Infrastructure Metadata ──────────────────────────
cd "$TF_DIR"
HOST=$(terraform output -raw public_ip || echo "localhost")
SSH_USER=$(terraform output -raw ssh_user || echo "root")
SSH_KEY="${DEPLOY_SSH_KEY:-~/.ssh/sparknode_gcp.pem}"

echo "═══════════════════════════════════════════════════════════"
echo "  SparkNode Deploy (GCP IMAGE-BASED)"
echo "  Host:     $HOST"
echo "  User:     $SSH_USER"
echo "═══════════════════════════════════════════════════════════"

SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10 $SSH_USER@$HOST"

# ... rest of steps similar to AWS ...
echo ">>> Checking connectivity..."
$SSH_CMD "echo 'SSH OK'" || { echo "ERROR: Cannot reach $HOST"; exit 1; }

echo ">>> Updating APP_VERSION to $VERSION..."
$SSH_CMD "cd $APP_DIR && sed -i 's/^APP_VERSION=.*/APP_VERSION=$VERSION/' $ENV_FILE"

echo ">>> Pulling and Restarting..."
$SSH_CMD "cd $APP_DIR && docker compose -f $COMPOSE_FILE pull && docker compose -f $COMPOSE_FILE up -d"

echo ">>> Running Migrations..."
sleep 10
$SSH_CMD "docker exec $(docker compose -f $APP_DIR/$COMPOSE_FILE ps -q backend) python -m alembic upgrade head"

echo ">>> ✓ Deployment complete! (GCP)"
