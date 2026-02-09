import io
import csv
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB
import sys
import os
import uuid

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from database import Base, get_db
from models import User, Tenant, Department

# In-memory SQLite for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

# Ensure PostgreSQL UUID columns render on SQLite test DB by compiling PG UUID to VARCHAR
@compiles(PG_UUID, 'sqlite')
def compile_uuid_sqlite(type_, compiler, **kw):
    return "VARCHAR(36)"


@compiles(PG_JSONB, 'sqlite')
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "TEXT"


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Create a tenant and HR admin/employee (similar to other tests)
    tenant = Tenant(
        id=uuid.UUID("550e8400-e29b-41d4-a716-446655441000"),
        name="OrgTest",
        slug="orgtest",
        status="active"
    )
    db.add(tenant)
    db.commit()

    dept = Department(
        id=uuid.UUID("660e8400-e29b-41d4-a716-446655441000"),
        tenant_id=tenant.id,
        name="Engineering"
    )
    db.add(dept)
    db.commit()

    from auth.utils import get_password_hash
    hr = User(
        id=uuid.UUID("770e8400-e29b-41d4-a716-446655441000"),
        tenant_id=tenant.id,
        email="hr@orgtest.com",
        password_hash=get_password_hash("password123"),
        first_name="HR",
        last_name="Admin",
        role="tenant_tenant_tenant_manager",
        department_id=dept.id,
        status="active"
    )
    db.add(hr)

    employee = User(
        id=uuid.UUID("770e8400-e29b-41d4-a716-446655441001"),
        tenant_id=tenant.id,
        email="employee@orgtest.com",
        password_hash=get_password_hash("password123"),
        first_name="Employee",
        last_name="One",
        role="tenant_user",
        department_id=dept.id,
        status="active"
    )
    db.add(employee)
    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=engine)


def auth_header_for(email, password="password123"):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestTenantAndUserManagement:
    def test_create_tenant_as_platform_admin(self):
        # Create a platform admin user in DB directly
        from auth.utils import get_password_hash
        db = TestingSessionLocal()
        platform = User(
            id=uuid.UUID("990e8400-e29b-41d4-a716-446655441000"),
                tenant_id=uuid.UUID("550e8400-e29b-41d4-a716-446655441000"),
            email="platform@admin.com",
            password_hash=get_password_hash("platpass123"),
            first_name="Platform",
            last_name="Admin",
            role="platform_admin",
            status="active"
        )
        db.add(platform)
        db.commit()
        db.close()

        # Override platform admin dependency to avoid nested dependency resolution issues in tests
        from core.rbac import get_platform_admin
        db2 = TestingSessionLocal()
        platform_user = db2.query(User).filter(User.email == "platform@admin.com").first()
        db2.close()
        app.dependency_overrides[get_platform_admin] = lambda: platform_user

        headers = auth_header_for("platform@admin.com", "platpass123")

        payload = {
            "name": "NewTenantCo",
            "slug": "newtenantco",
            "admin_email": "newadmin@tenantco.com",
            "admin_first_name": "New",
            "admin_last_name": "Admin",
            "admin_password": "newadminpass",
            "subscription_tier": "starter"
        }

        r = client.post("/api/platform/tenants", json=payload, headers=headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["name"] == "NewTenantCo"

        # Ensure newly created admin can login
        login = client.post("/api/auth/login", json={"email": "newadmin@tenantco.com", "password": "newadminpass"})
        assert login.status_code == 200

    def test_create_user(self):
        # HR admin creates a new user
        headers = auth_header_for("hr@orgtest.com")
        # Need department id from setup
        department_id = "660e8400-e29b-41d4-a716-446655441000"
        payload = {
            "email": "newuser@orgtest.com",
            "first_name": "New",
            "last_name": "User",
            "role": "tenant_user",
            "password": "userpass123",
            "department_id": department_id
        }
        r = client.post("/api/users", json=payload, headers=headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["email"] == "newuser@orgtest.com"

    def test_bulk_upload_and_confirm(self):
        headers = auth_header_for("hr@orgtest.com")

        # Create CSV in memory with required headers
        csv_content = io.StringIO()
        writer = csv.writer(csv_content)
        writer.writerow(["Full Name", "Email", "Role", "Department"])
        writer.writerow(["Bulk One", "bulk1@orgtest.com", "tenant_user", "Engineering"])
        writer.writerow(["Bulk Two", "bulk2@orgtest.com", "tenant_user", "Engineering"])
        csv_bytes = csv_content.getvalue().encode()

        files = {"file": ("users.csv", io.BytesIO(csv_bytes), "text/csv")}
        r = client.post("/api/users/bulk/upload", files=files, headers=headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["total_rows"] == 2
        assert body["valid_rows"] == 2

        batch_id = body["batch_id"]
        confirm_payload = {"batch_id": batch_id, "send_invites": False}
        r2 = client.post("/api/users/bulk/confirm", json=confirm_payload, headers=headers)
        assert r2.status_code == 200, r2.text
        created = r2.json().get("created")
        assert created == 2

        # Verify the users now exist (they are created with status PENDING_INVITE)
        list_r = client.get("/api/users?status=pending_invite", headers=headers)
        emails = [u["email"] for u in list_r.json()]
        assert "bulk1@orgtest.com" in emails
        assert "bulk2@orgtest.com" in emails

    def test_modify_user_attributes(self):
        headers = auth_header_for("hr@orgtest.com")

        user_id = "770e8400-e29b-41d4-a716-446655441001"  # employee created in setup
        # Update email and mobile
        patch_payload = {"corporate_email": "employee.new@orgtest.com", "mobile_number": "9123456789"}
        r = client.patch(f"/api/users/{user_id}", json=patch_payload, headers=headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["corporate_email"] == "employee.new@orgtest.com"
        assert body["mobile_number"] == "9123456789"
