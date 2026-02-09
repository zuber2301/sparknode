"""
Test cases for tenant provisioning (creation and initialization)

Tests cover:
- Successful tenant creation
- Field validation and constraints
- Admin user creation with correct fields
- Wallet initialization
- Master budget setup
- Authorization checks
- Error cases and edge cases
"""

import pytest
import sys
import os
from decimal import Decimal
from uuid import uuid4, UUID
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from main import app
from database import Base, get_db
from models import User, Tenant, Department, Wallet, MasterBudgetLedger, AuditLog
from platform_admin.schemas import TenantCreateRequest
from auth.utils import get_password_hash, verify_password


# In-memory SQLite database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = None

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def db():
    """Create tables and provide a database session for testing"""
    global TestingSessionLocal
    from sqlalchemy.orm import sessionmaker
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    Base.metadata.create_all(bind=engine)
    
    _db = TestingSessionLocal()
    yield _db
    _db.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db):
    """Create a test client with test database"""
    app.dependency_overrides[get_db] = lambda: db
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture
def platform_admin_token(db, client):
    """Create a platform admin user and return their token"""
    # Create root tenant
    root_tenant = Tenant(
        id=UUID("00000000-0000-0000-0000-000000000000"),
        name="Root Tenant",
        slug="root",
        domain=None,
        status="active",
        subscription_tier="enterprise",
        subscription_status="active"
    )
    db.add(root_tenant)
    
    # Create HR department
    hr_dept = Department(
        tenant_id=root_tenant.id,
        name="Human Resources"
    )
    db.add(hr_dept)
    db.flush()
    
    # Create platform admin user
    admin_user = User(
        tenant_id=root_tenant.id,
        corporate_email="admin@sparknode.io",
        password_hash=get_password_hash("admin123"),
        first_name="Platform",
        last_name="Admin",
        org_role="platform_admin",
        department_id=hr_dept.id,
        status="ACTIVE",
        is_super_admin=True
    )
    db.add(admin_user)
    db.commit()
    
    # Get token via login
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@sparknode.io", "password": "admin123"}
    )
    assert response.status_code == 200
    return response.json()["access_token"]


class TestTenantCreationBasic:
    """Test basic tenant creation functionality"""
    
    def test_create_tenant_success(self, client, platform_admin_token, db):
        """Test successful tenant creation with all required fields"""
        payload = {
            "name": "Triton Energy",
            "slug": "triton",
            "domain": "triton.io",
            "admin_email": "alice@triton.io",
            "admin_first_name": "Alice",
            "admin_last_name": "Smith",
            "admin_password": "SecurePassword123!",
            "subscription_tier": "professional",
            "max_users": 100,
            "master_budget_balance": 50000
        }
        
        response = client.post(
            "/api/platform/tenants",
            json=payload,
            headers={"Authorization": f"Bearer {platform_admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Triton Energy"
        assert data["slug"] == "triton"
        assert data["domain"] == "triton.io"
        assert data["status"] == "active"
        assert data["subscription_tier"] == "professional"
        assert data["subscription_status"] == "active"
        assert data["max_users"] == 100
        assert data["user_count"] == 1  # Admin user
    
    def test_create_tenant_minimal_fields(self, client, platform_admin_token, db):
        """Test tenant creation with only required fields"""
        payload = {
            "name": "Minimal Corp",
            "admin_email": "admin@minimal.io",
            "admin_first_name": "John",
            "admin_last_name": "Doe",
            "admin_password": "SecurePass123!"
        }
        
        response = client.post(
            "/api/platform/tenants",
            json=payload,
            headers={"Authorization": f"Bearer {platform_admin_token}"}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Minimal Corp"
        assert data["subscription_tier"] == "starter"  # Default
        assert data["max_users"] == 50  # Default


class TestTenantFieldValidation:
    """Test field validation and constraints"""
    
    def test_create_tenant_duplicate_domain(self, client, platform_admin_token, db):
        """Test that duplicate domain is rejected"""
        # Create first tenant with domain
        payload1 = {
            "name": "First Corp",
            "domain": "first.io",
            "admin_email": "admin1@first.io",
            "admin_first_name": "Admin",
            "admin_last_name": "One",
            "admin_password": "Pass123!"
        }
        
        response1 = client.post(
            "/api/platform/tenants",
            json=payload1,
            headers={"Authorization": f"Bearer {platform_admin_token}"}
        )
        assert response1.status_code == 200
        
        # Try to create second tenant with same domain
        payload2 = {
            "name": "Second Corp",
            "domain": "first.io",  # Duplicate domain
            "admin_email": "admin2@second.io",
            "admin_first_name": "Admin",
            "admin_last_name": "Two",
            "admin_password": "Pass123!"
        }
        
        response2 = client.post(
            "/api/platform/tenants",
            json=payload2,
            headers={"Authorization": f"Bearer {platform_admin_token}"}
        )
        assert response2.status_code == 400
        assert "domain already in use" in response2.json()["detail"].lower()
    
    def test_create_tenant_duplicate_slug(self, client, platform_admin_token, db):
        """Test that duplicate slug is rejected"""
        # Create first tenant with slug
        payload1 = {
            "name": "First Corp",
            "slug": "first",
            "admin_email": "admin1@first.io",
            "admin_first_name": "Admin",
            "admin_last_name": "One",
            "admin_password": "Pass123!"
        }
        
        response1 = client.post(
            "/api/platform/tenants",
            json=payload1,
            headers={"Authorization": f"Bearer {platform_admin_token}"}
        )
        assert response1.status_code == 200
        
        # Try to create second tenant with same slug
        payload2 = {
            "name": "Second Corp",
            "slug": "first",  # Duplicate slug
            "admin_email": "admin2@second.io",
            "admin_first_name": "Admin",
            "admin_last_name": "Two",
            "admin_password": "Pass123!"
        }
        
        response2 = client.post(
            "/api/platform/tenants",
            json=payload2,
            headers={"Authorization": f"Bearer {platform_admin_token}"}
        )
        assert response2.status_code == 400
        assert "slug already in use" in response2.json()["detail"].lower()
    
    def test_create_tenant_invalid_email(self, client, platform_admin_token):
        """Test that invalid email is rejected"""
        payload = {
            "name": "Invalid Email Corp",
            "admin_email": "not-an-email",  # Invalid email
            "admin_first_name": "Admin",
            "admin_last_name": "User",
            "admin_password": "Pass123!"
        }
        
        response = client.post(
            "/api/platform/tenants",
            json=payload,
            headers={"Authorization": f"Bearer {platform_admin_token}"}
        )
        assert response.status_code == 422  # Validation error
    
    def test_create_tenant_missing_required_field(self, client, platform_admin_token):
        """Test that missing required fields are rejected"""
        payload = {
            "name": "Missing Field Corp",
            # Missing admin_email, admin_first_name, admin_last_name, admin_password
        }
        
        response = client.post(
            "/api/platform/tenants",
            json=payload,
            headers={"Authorization": f"Bearer {platform_admin_token}"}
        )
        assert response.status_code == 422  # Validation error
    
    def test_create_tenant_invalid_subscription_tier(self, client, platform_admin_token):
        """Test that invalid subscription tier is rejected"""
        payload = {
            "name": "Invalid Tier Corp",
            "subscription_tier": "invalid_tier",  # Invalid tier
            "admin_email": "admin@invalid.io",
            "admin_first_name": "Admin",
            "admin_last_name": "User",
            "admin_password": "Pass123!"
        }
        
        response = client.post(
            "/api/platform/tenants",
            json=payload,
            headers={"Authorization": f"Bearer {platform_admin_token}"}
        )
        assert response.status_code == 422  # Validation error
    
    def test_create_tenant_negative_max_users(self, client, platform_admin_token):
        """Test that negative max_users is rejected"""
        payload = {
            "name": "Negative Users Corp",
            "max_users": -5,  # Invalid: negative
            "admin_email": "admin@invalid.io",
            "admin_first_name": "Admin",
            "admin_last_name": "User",
            "admin_password": "Pass123!"
        }
        
        response = client.post(
            "/api/platform/tenants",
            json=payload,
            headers={"Authorization": f"Bearer {platform_admin_token}"}
        )
        assert response.status_code == 422


class TestAdminUserCreation:
    """Test that admin user is created correctly during tenant provisioning"""
    
    def test_admin_user_created_with_correct_fields(self, client, platform_admin_token, db):
        """Test that admin user is created with correct corporate_email and org_role"""
        payload = {
            "name": "Admin Test Corp",
            "domain": "admintest.io",
            "admin_email": "alice@admintest.io",
            "admin_first_name": "Alice",
            "admin_last_name": "Johnson",
            "admin_password": "SecurePass123!"
        }
        
        response = client.post(
            "/api/platform/tenants",
            json=payload,
            headers={"Authorization": f"Bearer {platform_admin_token}"}
        )
        assert response.status_code == 200
        
        # Verify admin user was created with correct fields
        admin_user = db.query(User).filter(
            User.corporate_email == "alice@admintest.io"
        ).first()
        
        assert admin_user is not None
        assert admin_user.corporate_email == "alice@admintest.io"  # Not 'email'
        assert admin_user.org_role == "tenant_tenant_tenant_manager"  # Not 'role'
        assert admin_user.first_name == "Alice"
        assert admin_user.last_name == "Johnson"
        assert admin_user.status == "ACTIVE"  # Not 'active'
        assert admin_user.is_super_admin is True
    
    def test_admin_password_hashed(self, client, platform_admin_token, db):
        """Test that admin password is properly hashed"""
        payload = {
            "name": "Password Test Corp",
            "admin_email": "admin@pwtest.io",
            "admin_first_name": "Admin",
            "admin_last_name": "User",
            "admin_password": "MySecurePassword123!"
        }
        
        response = client.post(
            "/api/platform/tenants",
            json=payload,
            headers={"Authorization": f"Bearer {platform_admin_token}"}
        )
        assert response.status_code == 200
        
        # Verify password is hashed
        admin_user = db.query(User).filter(
            User.corporate_email == "admin@pwtest.io"
        ).first()
        
        assert admin_user.password_hash != "MySecurePassword123!"
        assert admin_user.password_hash.startswith("$2b$")  # Bcrypt format
        assert verify_password("MySecurePassword123!", admin_user.password_hash)
    
    def test_admin_user_can_login(self, client, db):
        """Test that created admin user can login with provided password"""
        # First create a tenant as platform admin
        root_tenant = Tenant(
            id=UUID("00000000-0000-0000-0000-000000000000"),
            name="Root",
            slug="root",
            status="active",
            subscription_tier="enterprise"
        )
        db.add(root_tenant)
        
        hr_dept = Department(tenant_id=root_tenant.id, name="HR")
        db.add(hr_dept)
        db.flush()
        
        admin = User(
            tenant_id=root_tenant.id,
            corporate_email="admin@sparknode.io",
            password_hash=get_password_hash("admin123"),
            first_name="Admin",
            last_name="User",
            org_role="platform_admin",
            department_id=hr_dept.id,
            status="ACTIVE",
            is_super_admin=True
        )
        db.add(admin)
        db.commit()
        
        # Get admin token
        login_response = client.post(
            "/api/auth/login",
            json={"email": "admin@sparknode.io", "password": "admin123"}
        )
        assert login_response.status_code == 200
        admin_token = login_response.json()["access_token"]
        
        # Create new tenant
        payload = {
            "name": "Login Test Corp",
            "admin_email": "newadmin@login.io",
            "admin_first_name": "New",
            "admin_last_name": "Admin",
            "admin_password": "NewAdminPass123!"
        }
        
        response = client.post(
            "/api/platform/tenants",
            json=payload,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        
        # Try to login with new admin credentials
        login_response = client.post(
            "/api/auth/login",
            json={"email": "newadmin@login.io", "password": "NewAdminPass123!"}
        )
        assert login_response.status_code == 200
        assert "access_token" in login_response.json()


class TestTenantInitialization:
    """Test that tenant infrastructure is properly initialized"""
    
    def test_tenant_created_with_active_status(self, client, platform_admin_token, db):
        """Test that new tenant is created with ACTIVE status"""
        payload = {
            "name": "Active Status Corp",
            "admin_email": "admin@active.io",
            "admin_first_name": "Admin",
            "admin_last_name": "User",
            "admin_password": "Pass123!"
        }
        
        response = client.post(
            "/api/platform/tenants",
            json=payload,
            headers={"Authorization": f"Bearer {platform_admin_token}"}
        )
        assert response.status_code == 200
        
        tenant = db.query(Tenant).filter(Tenant.name == "Active Status Corp").first()
        assert tenant.status == "active"
        assert tenant.subscription_status == "active"
    
    def test_hr_department_created(self, client, platform_admin_token, db):
        """Test that HR department is created during tenant provisioning"""
        payload = {
            "name": "Department Test Corp",
            "admin_email": "admin@depttest.io",
            "admin_first_name": "Admin",
            "admin_last_name": "User",
            "admin_password": "Pass123!"
        }
        
        response = client.post(
            "/api/platform/tenants",
            json=payload,
            headers={"Authorization": f"Bearer {platform_admin_token}"}
        )
        assert response.status_code == 200
        
        tenant = db.query(Tenant).filter(Tenant.name == "Department Test Corp").first()
        hr_dept = db.query(Department).filter(
            Department.tenant_id == tenant.id,
            Department.name == "Human Resources"
        ).first()
        
        assert hr_dept is not None
    
    def test_admin_wallet_created(self, client, platform_admin_token, db):
        """Test that wallet is created for admin user"""
        payload = {
            "name": "Wallet Test Corp",
            "admin_email": "admin@wallet.io",
            "admin_first_name": "Admin",
            "admin_last_name": "User",
            "admin_password": "Pass123!"
        }
        
        response = client.post(
            "/api/platform/tenants",
            json=payload,
            headers={"Authorization": f"Bearer {platform_admin_token}"}
        )
        assert response.status_code == 200
        
        admin = db.query(User).filter(User.corporate_email == "admin@wallet.io").first()
        wallet = db.query(Wallet).filter(Wallet.user_id == admin.id).first()
        
        assert wallet is not None
        assert wallet.balance == 0
        assert wallet.lifetime_earned == 0
        assert wallet.lifetime_spent == 0
    
    def test_master_budget_initialized(self, client, platform_admin_token, db):
        """Test that master budget ledger is initialized"""
        payload = {
            "name": "Budget Test Corp",
            "admin_email": "admin@budget.io",
            "admin_first_name": "Admin",
            "admin_last_name": "User",
            "admin_password": "Pass123!",
            "master_budget_balance": 75000
        }
        
        response = client.post(
            "/api/platform/tenants",
            json=payload,
            headers={"Authorization": f"Bearer {platform_admin_token}"}
        )
        assert response.status_code == 200
        
        tenant = db.query(Tenant).filter(Tenant.name == "Budget Test Corp").first()
        ledger = db.query(MasterBudgetLedger).filter(
            MasterBudgetLedger.tenant_id == tenant.id
        ).first()
        
        assert ledger is not None
        assert ledger.transaction_type == "credit"
        assert ledger.points == Decimal("75000")
        assert ledger.balance_after == Decimal("75000")
        assert "initial master budget allocation" in ledger.description.lower()


class TestAuthorizationAndSecurity:
    """Test authorization and security aspects of tenant creation"""
    
    def test_create_tenant_requires_authentication(self, client):
        """Test that creating a tenant requires authentication"""
        payload = {
            "name": "Unauth Test",
            "admin_email": "admin@unauth.io",
            "admin_first_name": "Admin",
            "admin_last_name": "User",
            "admin_password": "Pass123!"
        }
        
        # No token provided
        response = client.post(
            "/api/platform/tenants",
            json=payload
        )
        assert response.status_code == 403  # Forbidden
    
    def test_create_tenant_requires_platform_admin(self, client, db):
        """Test that only platform admins can create tenants"""
        # Create a regular tenant admin user
        tenant = Tenant(
            id=uuid4(),
            name="Test Tenant",
            slug="test",
            status="active",
            subscription_tier="starter"
        )
        db.add(tenant)
        
        dept = Department(tenant_id=tenant.id, name="HR")
        db.add(dept)
        db.flush()
        
        regular_admin = User(
            tenant_id=tenant.id,
            corporate_email="regularadmin@test.io",
            password_hash=get_password_hash("pass123"),
            first_name="Regular",
            last_name="Admin",
            org_role="tenant_tenant_tenant_manager",  # Only tenant admin, not platform admin
            department_id=dept.id,
            status="ACTIVE"
        )
        db.add(regular_admin)
        db.commit()
        
        # Login as tenant admin
        login_response = client.post(
            "/api/auth/login",
            json={"email": "regularadmin@test.io", "password": "pass123"}
        )
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        # Try to create a tenant
        payload = {
            "name": "Unauthorized Corp",
            "admin_email": "admin@unauth.io",
            "admin_first_name": "Admin",
            "admin_last_name": "User",
            "admin_password": "Pass123!"
        }
        
        response = client.post(
            "/api/platform/tenants",
            json=payload,
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 403  # Forbidden


class TestTenantAuditLogging:
    """Test that tenant creation is properly audited"""
    
    def test_audit_log_created_for_tenant(self, client, platform_admin_token, db):
        """Test that audit log entry is created when tenant is provisioned"""
        payload = {
            "name": "Audit Test Corp",
            "domain": "audittest.io",
            "admin_email": "admin@audittest.io",
            "admin_first_name": "Admin",
            "admin_last_name": "User",
            "admin_password": "Pass123!"
        }
        
        response = client.post(
            "/api/platform/tenants",
            json=payload,
            headers={"Authorization": f"Bearer {platform_admin_token}"}
        )
        assert response.status_code == 200
        
        tenant = db.query(Tenant).filter(Tenant.name == "Audit Test Corp").first()
        audit = db.query(AuditLog).filter(
            AuditLog.tenant_id == tenant.id,
            AuditLog.action == "tenant_created"
        ).first()
        
        assert audit is not None
        assert audit.entity_type == "tenant"
        assert audit.entity_id == tenant.id
        assert audit.new_values is not None


class TestTenantDataIntegrity:
    """Test data integrity constraints and relationships"""
    
    def test_tenant_id_not_null(self, client, platform_admin_token, db):
        """Test that tenant_id in created admin user is NOT NULL"""
        payload = {
            "name": "Not Null Test Corp",
            "admin_email": "admin@notnull.io",
            "admin_first_name": "Admin",
            "admin_last_name": "User",
            "admin_password": "Pass123!"
        }
        
        response = client.post(
            "/api/platform/tenants",
            json=payload,
            headers={"Authorization": f"Bearer {platform_admin_token}"}
        )
        assert response.status_code == 200
        
        admin = db.query(User).filter(User.corporate_email == "admin@notnull.io").first()
        assert admin.tenant_id is not None
    
    def test_admin_user_belongs_to_correct_tenant(self, client, platform_admin_token, db):
        """Test that admin user is assigned to the correct tenant"""
        payload = {
            "name": "Tenant Link Test Corp",
            "admin_email": "admin@tenantlink.io",
            "admin_first_name": "Admin",
            "admin_last_name": "User",
            "admin_password": "Pass123!"
        }
        
        response = client.post(
            "/api/platform/tenants",
            json=payload,
            headers={"Authorization": f"Bearer {platform_admin_token}"}
        )
        assert response.status_code == 200
        
        tenant = db.query(Tenant).filter(Tenant.name == "Tenant Link Test Corp").first()
        admin = db.query(User).filter(User.corporate_email == "admin@tenantlink.io").first()
        
        assert admin.tenant_id == tenant.id


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
