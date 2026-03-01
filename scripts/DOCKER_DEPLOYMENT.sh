#!/bin/bash

# DOCKER DEPLOYMENT STEPS for Tenant-User Mapping
# Run this in the /root/repos_products/sparknode directory

set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
WORKSPACE="/root/repos_products/sparknode"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  TENANT-USER MAPPING - DOCKER DEPLOYMENT                  ║"
echo "║  Timestamp: $TIMESTAMP                               ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# STEP 1: VERIFY DOCKER SETUP
# ============================================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1: VERIFY DOCKER ENVIRONMENT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "✓ Docker installed:"
docker --version

echo "✓ Docker Compose installed:"
docker-compose --version

echo "✓ Checking docker-compose configuration..."
if [ ! -f "$WORKSPACE/docker-compose.yml" ]; then
    echo "❌ docker-compose.yml not found in $WORKSPACE"
    exit 1
fi
echo "✓ docker-compose.yml found"
echo ""

# ============================================================================
# STEP 2: START DOCKER SERVICES
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2: START DOCKER SERVICES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Starting PostgreSQL, Redis, Backend, and Frontend..."
echo ""

read -p "Press Enter to start Docker services: " -r

cd "$WORKSPACE"
docker-compose up -d --build

echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check services
echo "✓ Checking service status..."
docker-compose ps

echo ""
echo "✅ Docker services started"
echo ""

# ============================================================================
# STEP 3: DATABASE BACKUP
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 3: DATABASE BACKUP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Creating PostgreSQL backup..."
echo ""

mkdir -p "$WORKSPACE/backups"
BACKUP_FILE="$WORKSPACE/backups/sparknode_backup_$TIMESTAMP.sql"

echo "📦 Creating backup: $BACKUP_FILE"
docker-compose exec -T postgres pg_dump -U sparknode sparknode > "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "✅ Backup created: $BACKUP_SIZE"
echo ""

# ============================================================================
# STEP 4: RUN DATABASE MIGRATION
# ============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 4: RUN DATABASE MIGRATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Running migration script inside backend container..."
echo ""

read -p "Press Enter to run database migration: " -r

docker-compose exec backend python3 migrate_tenant_user_mapping.py

if [ $? -eq 0 ]; then
    echo "✅ Database migration completed successfully"
else
    echo "❌ Database migration failed!"
    echo "⚠️  Database backed up to: $BACKUP_FILE"
    exit 1
fi
echo ""

# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ DEPLOYMENT COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Services are running at:"
echo "  • Backend API: http://localhost:6100"
echo "  • Frontend: http://localhost:6173"
echo "  • PostgreSQL: localhost:6432 (user: sparknode)"
echo ""
echo "Database backup: $BACKUP_FILE ($BACKUP_SIZE)"
echo ""
echo ""
echo "🎯 NEXT STEPS - TEST SIGNUP FLOWS"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "1. Open Frontend:"
echo "   → http://localhost:6173"
echo ""
echo "2. Test Domain-Match Signup:"
echo "   • Click signup"
echo "   • Enter: testuser@company.com (if company.com in domain_whitelist)"
echo "   • Should auto-detect organization"
echo ""
echo "3. Test Invite-Link:"
echo "   • Generate invite via API:"
echo "     curl -X POST http://localhost:6100/api/auth/invitations/generate \\"
echo "       -H 'Authorization: Bearer <ADMIN_TOKEN>' \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"email\": \"newuser@example.com\", \"tenant_id\": \"<TENANT_ID>\"}'"
echo ""
echo "   • Use returned invite URL to signup"
echo ""
echo "4. Verify JWT Token:"
echo "   • In browser console: localStorage.getItem('token')"
echo "   • Decode at: https://jwt.io"
echo "   • Should contain: \"tenant_id\": \"<UUID>\""
echo ""
echo "5. Test Cross-Tenant Isolation:"
echo "   • Try accessing another tenant's data"
echo "   • Expected: 403 Forbidden or filtered results"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📚 Documentation:"
echo "   • Quick Reference: TENANT_USER_MAPPING_QUICK_REFERENCE.md"
echo "   • Full Guide: TENANT_USER_MAPPING_GUIDE.md"
echo "   • Checklist: DEPLOYMENT_CHECKLIST_TENANT_MAPPING.md"
echo ""
echo "⚙️ Manage Services:"
echo "   • View logs: docker-compose logs -f backend"
echo "   • Stop: docker-compose down"
echo "   • Restart: docker-compose restart"
echo ""
echo "✅ System is running and ready for testing!"
echo ""
