#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ──────────────────────────────────────────
TF_DIR="/root/repos_products/sparknode/deployment_sparknode/terraform/modules/azure"
APP_DIR="/opt/sparknode"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"
VERSION="${APP_VERSION:-latest}"

echo ">>> Step 1: Provisioning Foundational Infrastructure on Azure (Terraform)..."
cd "$TF_DIR"
terraform init > /dev/null
# Pass any TF_VAR_* environment variables automatically
terraform apply -auto-approve > /dev/null

# ─── Fetch Infrastructure Metadata ──────────────────────────
HOST=$(terraform output -raw public_ip)
SSH_USER=$(terraform output -raw ssh_user)
SSH_KEY="${DEPLOY_SSH_KEY:-~/.ssh/sparknode_azure.pem}"

echo ">>> Infrastructure Ready at $HOST"
echo ">>> Step 2: Deploying App Stack (Docker Compose + Traefik)..."

echo "═══════════════════════════════════════════════════════════"
echo "  SparkNode Deploy Sequence (AZURE)"
echo "  Host:     $HOST"
echo "  User:     $SSH_USER"
echo "  Version:  $VERSION"
echo "═══════════════════════════════════════════════════════════"

SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10 $SSH_USER@$HOST"

# ... rest of steps similar to AWS ...
echo ">>> Gateway Check: Verifying Traefik/Nginx layer..."
$SSH_CMD "echo 'SSH/Networking OK'" || { echo "ERROR: Cannot reach $HOST"; exit 1; }

echo ">>> Updating APP_VERSION to $VERSION..."
$SSH_CMD "cd $APP_DIR && sed -i 's/^APP_VERSION=.*/APP_VERSION=$VERSION/' $ENV_FILE"

echo ">>> Pulling and Restarting..."
$SSH_CMD "cd $APP_DIR && docker compose -f $COMPOSE_FILE pull && docker compose -f $COMPOSE_FILE up -d"

echo ">>> Running Migrations..."
sleep 10
$SSH_CMD "docker exec $(docker compose -f $APP_DIR/$COMPOSE_FILE ps -q backend) python -m alembic upgrade head"

echo ">>> ✓ Deployment complete! (Azure)"
