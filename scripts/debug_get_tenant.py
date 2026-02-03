import sys, os
sys.path.insert(0, os.path.abspath('backend'))
from fastapi.testclient import TestClient
import main as backend_main
from database import SessionLocal, Base, engine
import models
from core.rbac import get_platform_admin

# Create tables if missing
Base.metadata.create_all(bind=engine)

# Create a tenant and platform admin user
db = SessionLocal()
tenant = None
try:
    # Create platform admin user if not exists
    user = db.query(models.User).filter(models.User.corporate_email == 'debug_platform@sparknode.io').first()
    if not user:
        tenant = models.Tenant(name='Debug Tenant', slug='debug-tenant', domain='debug.sparknode.io')
        db.add(tenant)
        db.flush()
        hr = models.Department(tenant_id=tenant.id, name='HR')
        db.add(hr)
        db.flush()
        user = models.User(
            tenant_id=tenant.id,
            corporate_email='debug_platform@sparknode.io',
            password_hash='noop',
            first_name='Debug',
            last_name='Platform',
            org_role='platform_admin',
            department_id=hr.id,
        )
        db.add(user)
        db.commit()
    else:
        tenant = db.query(models.Tenant).filter(models.Tenant.id == user.tenant_id).first()

    # Capture tenant_id while session is active to avoid DetachedInstanceError
    tenant_id = str(tenant.id)
finally:
    db.close()

# Override dependency to authenticate TestClient requests as the debug platform admin
async def _fake_platform_admin(request=None, db=None):
    from database import SessionLocal as _SessionLocal
    s = _SessionLocal()
    try:
        return s.query(models.User).filter(models.User.corporate_email == 'debug_platform@sparknode.io').first()
    finally:
        s.close()

backend_main.app.dependency_overrides[get_platform_admin] = _fake_platform_admin
client = TestClient(backend_main.app)

# tenant_id already obtained from DB session above

# Perform GET /api/platform/tenants/{tenantId}
resp = client.get(f"/api/platform/tenants/{tenant_id}", headers={"Authorization": "Bearer debug"})
print('status', resp.status_code)
print(resp.text)
