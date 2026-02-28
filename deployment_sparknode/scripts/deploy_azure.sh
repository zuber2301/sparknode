#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ──────────────────────────────────────────
TF_DIR="/root/repos_products/sparknode/deployment_sparknode/terraform/modules/azure"
APP_DIR="/opt/sparknode"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"
VERSION="${APP_VERSION:-latest}"
SKIP_TERRAFORM="${SKIP_TERRAFORM:-false}"

if [ "$SKIP_TERRAFORM" = "true" ]; then
    echo ">>> Bypassing Step 1 (SKIP_TERRAFORM=true)..."
else
    echo ">>> Step 1: Provisioning Foundational Infrastructure on Azure (Terraform)..."
    cd "$TF_DIR"
    
    # Unified State Management (Issue #10)
    ENV_TYPE="${ENVIRONMENT:-dev}"
    STATE_PATH="../../tfstate/azure/$ENV_TYPE/terraform.tfstate"
    
    echo ">>> Initializing with state: $STATE_PATH"
    terraform init -reconfigure -backend-config="path=$STATE_PATH" > /dev/null

    # Check for VM-only targeting
    TF_TARGET=""
    if [ "${TF_TARGET_VM_ONLY:-false}" = "true" ]; then
        echo ">>> TARGETING: azurerm_linux_virtual_machine ONLY"
        TF_TARGET="-target=azurerm_linux_virtual_machine.sparknode"
    fi

    # Pass any TF_VAR_* environment variables automatically
    terraform apply $TF_TARGET -auto-approve > /dev/null
fi

# ─── Fetch Infrastructure Metadata ──────────────────────────
# We still need metadata from TF to know where to deploy the containers
cd "$TF_DIR"
HOST=$(terraform output -raw public_ip || echo "localhost")
SSH_USER=$(terraform output -raw ssh_user || echo "root")
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
