# 🚀 IMMEDIATE NEXT STEPS - TENANT-USER MAPPING DEPLOYMENT

## Pre-Deployment Status
✅ **All code components ready for deployment**
- Backend: Python files compiled successfully
- Frontend: Build successful (1.0 MB dist)
- Database migration script ready

## PHASE 1: DATABASE MIGRATION (Run First!)

### Step 1: Backup Database
```bash
# Create backup
pg_dump -U sparknode -d sparknode > sparknode_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Run Migration Script
```bash
cd /root/repos_products/sparknode/backend
python3 migrate_tenant_user_mapping.py
```

**What it does:**
- Creates `invitation_tokens` table if missing
- Validates all users have `tenant_id` (NOT NULL)
- Fixes any orphaned users
- Verifies foreign key constraints
- Confirms data integrity

**Expected output:**
```
[INFO] Starting database migration...
[INFO] ✓ Invitation tokens table validated
[INFO] ✓ Tenant ID constraint verified
[INFO] ✓ No orphaned users found
[INFO] ✓ Foreign key integrity confirmed
[INFO] Migration complete - System ready for deployment
```

---

## PHASE 2: BACKEND DEPLOYMENT

### Step 1: Update Backend Dependencies
```bash
cd /root/repos_products/sparknode/backend
pip install -q -r requirements.txt
```

### Step 2: Start Backend Service
```bash
# For development:
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# For production (use this):
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000
```

### Step 3: Verify Backend is Running
```bash
curl -s http://localhost:8000/health | jq .
# Should return: {"status": "ok"}
```

---

## PHASE 3: FRONTEND DEPLOYMENT

### Step 1: Deploy Build Artifacts
```bash
# Copy dist folder to your web server
cp -r frontend/dist/* /var/www/html/

# Or for Docker:
# Frontend Dockerfile already configured in frontend/Dockerfile
docker build -t sparknode-frontend frontend/
```

### Step 2: Verify Frontend is Accessible
```bash
# Visit http://localhost or your domain
# Should see SparkNode login page
```

---

## PHASE 4: TEST SIGNUP FLOWS (Critical!)

### Test 1: Domain-Match Auto-Enrollment
```bash
# Create a test tenant with domain whitelist
# Visit: http://localhost/signup

# Test email: testuser@company.com
# Password: TestPass123!
# Name: Test User

# Expected: Auto-detects "company" org, creates user with that tenant
```

### Test 2: Invite-Link Signup
```bash
# 1. Generate invite link via admin
curl -X POST http://localhost:8000/api/auth/invitations/generate \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "tenant_id": "TENANT_UUID_HERE"
  }'

# Response includes invite URL:
# http://localhost/signup?token=ABC123&email=newuser@example.com

# 2. New user visits that URL and signs up
# 3. Verify: User created with correct tenant_id in JWT
```

### Test 3: Verify JWT Contains Tenant ID
```bash
# After signup login, check token:
# In browser console: localStorage.getItem('token')
# Decode at jwt.io
# Should contain: "tenant_id": "UUID"
```

### Test 4: Cross-Tenant Isolation
```bash
# With User A token, try to access User B's data (different tenant)
curl http://localhost:8000/api/users \
  -H "Authorization: Bearer USER_A_TOKEN" \
  -H "X-Tenant-ID: USER_B_TENANT_ID"

# Expected: 403 Forbidden (user cannot access other tenant's data)
```

---

## PHASE 5: PRODUCTION DEPLOYMENT

### Pre-Production Checklist
- [ ] Database backed up
- [ ] Migration script ran successfully
- [ ] All tests passed (domain-match, invite-link, isolation)
- [ ] Backend and frontend running without errors
- [ ] SSL/TLS certificates configured
- [ ] Environment variables set correctly

### Environment Variables to Verify
```bash
# Backend (.env)
DATABASE_URL=postgresql://sparknode:PASSWORD@localhost:5432/sparknode
JWT_SECRET_KEY=your-super-secret-key-change-this
ENVIRONMENT=production

# Frontend (.env)
VITE_API_BASE_URL=https://api.yourdomain.com
```

### Deploy to Production
```bash
# Using docker-compose:
docker-compose -f docker-compose.yml up -d

# Or manual deployment:
# 1. Stop old services
# 2. Deploy new code
# 3. Run migrations (if needed)
# 4. Start services
# 5. Verify health endpoints
```

---

## PHASE 6: POST-DEPLOYMENT MONITORING

### Monitor These Logs
```bash
# Backend logs for signup errors:
tail -f backend.log | grep -i "signup\|tenant\|error"

# Check JWT tokens include tenant_id:
grep "tenant_id" backend.log | head -5

# Monitor database queries:
# Enable query logging in PostgreSQL config
```

### Metrics to Watch (24 hours post-deployment)
- ✓ Signup success rate
- ✓ Error rate (should be < 1%)
- ✓ Database query performance
- ✓ JWT token validation failures
- ✓ Tenant isolation violations (should be 0)

### Health Checks
```bash
# Backend health
curl http://localhost:8000/health

# Database connection
curl http://localhost:8000/api/health/db

# JWT validation
curl -H "Authorization: Bearer TOKEN" http://localhost:8000/api/users
```

---

## 📋 CRITICAL REMINDERS

1. **BACKUP FIRST** - Run database backup before migration
2. **TEST IN STAGING** - Never deploy directly to production
3. **VERIFY JWT TENANT_ID** - Confirm token includes tenant_id field
4. **TEST ISOLATION** - Ensure users can't access other tenants' data
5. **MONITOR LOGS** - Watch for errors in first 24 hours
6. **TRAIN HR TEAM** - HR admins need docs on invite link generation

---

## 🆘 TROUBLESHOOTING

### Migration fails: "tenant_id column is NULL"
```bash
# Fix: Update schema with NOT NULL constraint
# Then re-run: python3 migrate_tenant_user_mapping.py
```

### Signup fails: "Cannot determine tenant"
```bash
# Check: Domain whitelist configured in tenants table
SELECT domain_whitelist FROM tenants;
# Should show: {"company": true, "domain.com": true}
```

### JWT doesn't include tenant_id
```bash
# Check: /backend/auth/routes.py - signup endpoint
# Verify: jwt_payload includes tenant_id before encoding
```

### Users can access other tenant data
```bash
# Check: TenantScopedQuery applied to all queries
# Verify: main.py includes TenantScopedQuery in session_local
```

---

## ✅ COMPLETION CHECKLIST

Once complete, mark these items:
- [ ] Database backed up
- [ ] Migration script ran successfully
- [ ] Backend service started without errors
- [ ] Frontend build deployed
- [ ] Domain-match signup tested
- [ ] Invite-link signup tested  
- [ ] JWT verified with tenant_id
- [ ] Cross-tenant isolation verified
- [ ] No errors in logs after 5 minutes
- [ ] All users redirected to correct tenant UI

**Expected Total Deployment Time: 30-45 minutes**

---

📞 **Need Help?** 
- See: DEPLOYMENT_CHECKLIST_TENANT_MAPPING.md (comprehensive)
- See: TENANT_USER_MAPPING_QUICK_REFERENCE.md (API reference)
- See: TENANT_USER_MAPPING_GUIDE.md (detailed guide)
