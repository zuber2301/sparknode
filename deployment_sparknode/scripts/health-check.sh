#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# SparkNode — Post-deploy health check
# Validates that all services are running and healthy
#
# Usage:
#   ./health-check.sh                          # auto-detect from TF
#   ./health-check.sh --host 1.2.3.4
#   ./health-check.sh --url https://app.sparknode.io
# ──────────────────────────────────────────────────────────────
set -euo pipefail

HOST="${DEPLOY_HOST:-}"
SSH_KEY="${DEPLOY_SSH_KEY:-~/.ssh/sparknode.pem}"
SSH_USER="${DEPLOY_SSH_USER:-ubuntu}"
URL=""
VERBOSE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --host)    HOST="$2";    shift 2 ;;
    --key)     SSH_KEY="$2"; shift 2 ;;
    --url)     URL="$2";     shift 2 ;;
    --verbose) VERBOSE=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

PASS=0
FAIL=0
WARN=0

check() {
  local name="$1"
  local result="$2"
  local expected="${3:-0}"

  if [ "$result" = "$expected" ]; then
    echo "  ✓ $name"
    ((PASS++))
  else
    echo "  ✗ $name (got: $result, expected: $expected)"
    ((FAIL++))
  fi
}

warn() {
  local name="$1"
  local msg="$2"
  echo "  ⚠ $name: $msg"
  ((WARN++))
}

echo "═══════════════════════════════════════════════════════════"
echo "  SparkNode Health Check"
echo "═══════════════════════════════════════════════════════════"

# ─── External checks (via URL) ───────────────────────────────
if [ -n "$URL" ]; then
  echo ""
  echo "External checks ($URL):"

  # HTTPS available
  HTTP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$URL" 2>/dev/null || echo "000")
  check "Frontend responds" "$HTTP_CODE" "200"

  # API health
  API_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$URL/health" 2>/dev/null || echo "000")
  check "Backend /health" "$API_CODE" "200"

  # TLS certificate
  CERT_DAYS=$(echo | openssl s_client -connect "${URL#https://}:443" -servername "${URL#https://}" 2>/dev/null | \
    openssl x509 -noout -dates 2>/dev/null | \
    grep notAfter | cut -d= -f2 | \
    xargs -I{} bash -c 'echo $(( ($(date -d "{}" +%s) - $(date +%s)) / 86400 ))' 2>/dev/null || echo "0")

  if [ "$CERT_DAYS" -gt 14 ]; then
    check "TLS certificate valid" "0" "0"
    echo "    └─ Expires in ${CERT_DAYS} days"
  elif [ "$CERT_DAYS" -gt 0 ]; then
    warn "TLS certificate" "expires in ${CERT_DAYS} days"
  else
    check "TLS certificate valid" "1" "0"
  fi
fi

# ─── Internal checks (via SSH) ──────────────────────────────
if [ -n "$HOST" ]; then
  echo ""
  echo "Internal checks ($HOST):"

  SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10 $SSH_USER@$HOST"

  # Docker running
  DOCKER_OK=$($SSH_CMD "systemctl is-active docker" 2>/dev/null || echo "inactive")
  check "Docker service" "$DOCKER_OK" "active"

  # Container status
  CONTAINERS=("sparknode-traefik" "sparknode-db" "sparknode-redis" "sparknode-backend" "sparknode-celery" "sparknode-frontend")
  for c in "${CONTAINERS[@]}"; do
    STATUS=$($SSH_CMD "docker inspect -f '{{.State.Status}}' $c 2>/dev/null" || echo "missing")
    check "Container $c" "$STATUS" "running"
  done

  # Disk usage
  DISK_PCT=$($SSH_CMD "df / --output=pcent | tail -1 | tr -d '% '" 2>/dev/null || echo "0")
  if [ "$DISK_PCT" -gt 90 ]; then
    warn "Disk usage" "${DISK_PCT}% — critical"
  elif [ "$DISK_PCT" -gt 80 ]; then
    warn "Disk usage" "${DISK_PCT}% — warning"
  else
    check "Disk usage (${DISK_PCT}%)" "0" "0"
  fi

  # Memory usage
  MEM_PCT=$($SSH_CMD "free | awk '/Mem:/ { printf(\"%.0f\", \$3/\$2*100) }'" 2>/dev/null || echo "0")
  if [ "$MEM_PCT" -gt 90 ]; then
    warn "Memory usage" "${MEM_PCT}% — critical"
  elif [ "$MEM_PCT" -gt 80 ]; then
    warn "Memory usage" "${MEM_PCT}% — warning"
  else
    check "Memory usage (${MEM_PCT}%)" "0" "0"
  fi

  # DB connectivity
  DB_OK=$($SSH_CMD "docker exec sparknode-db pg_isready -U sparknode 2>/dev/null && echo ok || echo fail" || echo "fail")
  check "PostgreSQL ready" "$(echo $DB_OK | grep -c ok)" "1"

  # Redis connectivity
  REDIS_OK=$($SSH_CMD "docker exec sparknode-redis redis-cli ping 2>/dev/null || echo fail")
  check "Redis PONG" "$REDIS_OK" "PONG"

  if [ "$VERBOSE" = true ]; then
    echo ""
    echo "Container resource usage:"
    $SSH_CMD "docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}'" 2>/dev/null || true
  fi
fi

# ─── Summary ─────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed, $WARN warnings"
echo "═══════════════════════════════════════════════════════════"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
