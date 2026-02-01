# 🚀 QUICK DEPLOYMENT START

## ⚡ 60-Second Setup (Development)

```bash
# 1. Backup database (2 min)
pg_dump -U sparknode -d sparknode > backup_$(date +%s).sql

# 2. Run migration (1 min)
cd backend && python3 migrate_tenant_user_mapping.py

# 3. Start backend (instantly)
cd backend && uvicorn main:app --reload

# 4. In another terminal: frontend is ready
# dist/ folder already built and ready to deploy
```

Then visit: `http://localhost/signup`

---

## ✅ Before You Start

- [x] All Python files compiled successfully  
- [x] Frontend build complete (1.0 MB)
- [x] Database migration script ready
- [x] All API endpoints implemented
- [x] JWT security validated
- [x] Cross-tenant isolation verified

---

## 🎯 Test These Right Away

1. **Domain-Match Signup**
   - Email: `testuser@company.com` (if company.com in domain_whitelist)
   - Expected: Auto-detects organization ✓

2. **Invite-Link Signup**
   - URL: `http://localhost/signup?token=ABC123&email=newuser@example.com`
   - Expected: User created with tenant from token ✓

3. **Verify JWT**
   - After signup, check: `localStorage.getItem('token')`
   - Should contain: `"tenant_id": "uuid"` ✓

4. **Cross-Tenant Block**
   - Try accessing User B's data with User A's token
   - Expected: 403 Forbidden ✓

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `backend/auth/onboarding.py` | Tenant resolution logic |
| `backend/auth/routes.py` | /auth/signup endpoint |
| `frontend/src/pages/Signup.jsx` | Signup page component |
| `backend/migrate_tenant_user_mapping.py` | Database setup |

---

## 🔗 Full Documentation

- **Immediate Steps**: [DEPLOYMENT_IMMEDIATE_STEPS.md](DEPLOYMENT_IMMEDIATE_STEPS.md)
- **Complete Guide**: [TENANT_USER_MAPPING_GUIDE.md](TENANT_USER_MAPPING_GUIDE.md)
- **API Reference**: [TENANT_USER_MAPPING_QUICK_REFERENCE.md](TENANT_USER_MAPPING_QUICK_REFERENCE.md)
- **Checklist**: [DEPLOYMENT_CHECKLIST_TENANT_MAPPING.md](DEPLOYMENT_CHECKLIST_TENANT_MAPPING.md)

---

## ❓ Common Issues

| Issue | Solution |
|-------|----------|
| Migration fails | Check backup was created and database permissions |
| Signup endpoint 404 | Verify backend is running on port 8000 |
| Domain not detected | Check domain_whitelist in tenants table: `SELECT domain_whitelist FROM tenants;` |
| JWT missing tenant_id | Verify signup endpoint is setting tenant_id in payload |
| Cross-tenant access works (bad!) | Check TenantScopedQuery is applied to session in main.py |

---

## 📞 Getting Help

1. Check [TENANT_USER_MAPPING_QUICK_REFERENCE.md](TENANT_USER_MAPPING_QUICK_REFERENCE.md) for API examples
2. Run migration script with verbose logging
3. Check backend logs for specific error messages
4. Review [DEPLOYMENT_CHECKLIST_TENANT_MAPPING.md](DEPLOYMENT_CHECKLIST_TENANT_MAPPING.md) troubleshooting section

---

**Status**: ✅ Production Ready - Deploy Now
