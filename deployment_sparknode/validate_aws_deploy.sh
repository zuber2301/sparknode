#!/bin/bash
set -e

# SparkNode AWS Infrastructure Validation Script
# This script runs basic connectivity and health checks 
# to ensure the stack is correctly deployed on AWS.

LOG_FILE="/tmp/sparknode_aws_test_$(date +%Y%m%d_%H%M%S).log"

log() {
    echo -e "$(date +'%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

check_http() {
    local url=$1
    local expected=$2
    log ">>> Checking $url..."
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    if [ "$status" -eq "$expected" ]; then
        log "[PASS] $url responded with $status"
    else
        log "[FAIL] $url responded with $status (expected $expected)"
    fi
}

check_container() {
    local name=$1
    log ">>> Checking container $name..."
    if docker ps --format '{{.Names}}' | grep -q "$name"; then
        log "[PASS] $name is running"
    else
        log "[FAIL] $name is NOT running"
    fi
}

# --- 1. Infrastructure Checks ---
log ">>> CORE SERVICES <<<"
check_container "sparknode-traefik"
check_container "sparknode-backend"
check_container "sparknode-db"
check_container "sparknode-redis"

log ">>> MONITORING STACK <<<"
check_container "sparknode-prometheus"
check_container "sparknode-grafana"
check_container "sparknode-postgres-exporter"

# --- 2. Networking & Health Checks ---
log ">>> NETWORK ACCESSIBILITY <<<"
# Replace with your actual DOMAIN from .env if running on host
DOMAIN=$(grep DOMAIN .env | cut -d '=' -f2)

if [ -n "$DOMAIN" ]; then
    # Frontend/Traefik Landing
    check_http "https://$DOMAIN" 200
    # Backend Health
    check_http "https://$DOMAIN/api/v1/health" 200
    # Grafana (Internal only or secured)
    check_http "https://grafana.$DOMAIN/login" 200
else
    log "[SKIP] DOMAIN not found in .env, skipping external link checks."
fi

# --- 3. Backup State ---
log ">>> BACKUP INTEGRITY <<<"
if docker exec sparknode-db wal-g backup-list > /dev/null 2>&1; then
    log "[PASS] WAL-G backup-list successful (S3 connected)"
else
    log "[FAIL] WAL-G backup-list failed (Check S3 credentials/connectivity)"
fi

# --- 4. Logging ---
log ">>> CLOUDWATCH LOG DRIVER <<<"
if docker inspect sparknode-backend --format '{{.HostConfig.LogConfig.Type}}' | grep -q "awslogs"; then
    log "[PASS] awslogs driver configured for backend"
else
    log "[WARN] awslogs driver NOT configured for backend (check .env/compose)"
fi

log ">>> VALIDATION COMPLETE. Results saved to $LOG_FILE"
