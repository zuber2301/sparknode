import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from database import Base, get_db
from models import User, Tenant, Wallet, Badge, Department

# Test database setup
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


@pytest.fixture(autouse=True)
def setup_database():
    """Create all tables before each test and drop after"""
    Base.metadata.create_all(bind=engine)
    
    # Create test data
    db = TestingSessionLocal()
    
    # Create test tenant
    tenant = Tenant(
        id="550e8400-e29b-41d4-a716-446655440000",
        name="Test Corp",
        slug="test-corp",
        status="active"
    )
    db.add(tenant)
    db.commit()
    
    # Create test department
    dept = Department(
        id="660e8400-e29b-41d4-a716-446655440001",
        tenant_id=tenant.id,
        name="Engineering"
    )
    db.add(dept)
    db.commit()
    
    # Create test user with hashed password for 'password123'
    from auth.utils import get_password_hash
    user = User(
        id="770e8400-e29b-41d4-a716-446655440001",
        tenant_id=tenant.id,
        email="test@test.com",
        password_hash=get_password_hash("password123"),
        first_name="Test",
        last_name="User",
        role="tenant_tenant_tenant_manager",
        department_id=dept.id,
        status="active"
    )
    db.add(user)
    
    employee = User(
        id="770e8400-e29b-41d4-a716-446655440002",
        tenant_id=tenant.id,
        email="employee@test.com",
        password_hash=get_password_hash("password123"),
        first_name="Test",
        last_name="Employee",
        role="tenant_user",
        department_id=dept.id,
        status="active"
    )
    db.add(employee)
    db.commit()
    
    # Create wallets
    wallet1 = Wallet(
        tenant_id=tenant.id,
        user_id=user.id,
        balance=1000,
        lifetime_earned=1000,
        lifetime_spent=0
    )
    db.add(wallet1)
    
    wallet2 = Wallet(
        tenant_id=tenant.id,
        user_id=employee.id,
        balance=500,
        lifetime_earned=500,
        lifetime_spent=0
    )
    db.add(wallet2)
    
    # Create test badge
    badge = Badge(
        id="880e8400-e29b-41d4-a716-446655440001",
        name="Star Performer",
        description="Outstanding performance",
        icon_url="/badges/star.svg",
        points_value=100,
        is_system=True
    )
    db.add(badge)
    db.commit()
    db.close()
    
    yield
    
    Base.metadata.drop_all(bind=engine)


class TestHealthEndpoint:
    """Test health check endpoint"""
    
    def test_health_check(self):
        """Test that health endpoint returns healthy status"""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_login_success(self):
        """Test successful login returns token"""
        response = client.post(
            "/api/auth/login",
            json={"email": "test@test.com", "password": "password123"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "test@test.com"
    
    def test_login_wrong_password(self):
        """Test login with wrong password fails"""
        response = client.post(
            "/api/auth/login",
            json={"email": "test@test.com", "password": "wrongpassword"}
        )
        assert response.status_code == 401
        assert "Incorrect email or password" in response.json()["detail"]
    
    def test_login_nonexistent_user(self):
        """Test login with non-existent user fails"""
        response = client.post(
            "/api/auth/login",
            json={"email": "nobody@test.com", "password": "password123"}
        )
        assert response.status_code == 401
    
    def test_protected_route_without_token(self):
        """Test that protected routes require authentication"""
        response = client.get("/api/auth/me")
        assert response.status_code == 401
    
    def test_protected_route_with_token(self):
        """Test that protected routes work with valid token"""
        # First login
        login_response = client.post(
            "/api/auth/login",
            json={"email": "test@test.com", "password": "password123"}
        )
        token = login_response.json()["access_token"]
        
        # Access protected route
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert response.json()["email"] == "test@test.com"


class TestUsers:
    """Test user management endpoints"""
    
    def get_auth_header(self):
        """Helper to get auth header"""
        response = client.post(
            "/api/auth/login",
            json={"email": "test@test.com", "password": "password123"}
        )
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_list_users(self):
        """Test listing users"""
        response = client.get("/api/users", headers=self.get_auth_header())
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2
    
    def test_get_user_by_id(self):
        """Test getting a specific user"""
        response = client.get(
            "/api/users/770e8400-e29b-41d4-a716-446655440001",
            headers=self.get_auth_header()
        )
        assert response.status_code == 200
        assert response.json()["email"] == "test@test.com"


class TestWallets:
    """Test wallet endpoints"""
    
    def get_auth_header(self):
        """Helper to get auth header"""
        response = client.post(
            "/api/auth/login",
            json={"email": "test@test.com", "password": "password123"}
        )
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_my_wallet(self):
        """Test getting current user's wallet"""
        response = client.get("/api/wallets/me", headers=self.get_auth_header())
        assert response.status_code == 200
        data = response.json()
        assert "balance" in data
        assert "lifetime_earned" in data
        assert "lifetime_spent" in data
    
    def test_get_wallet_ledger(self):
        """Test getting wallet transaction history"""
        response = client.get("/api/wallets/me/ledger", headers=self.get_auth_header())
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestRecognition:
    """Test recognition endpoints"""
    
    def get_auth_header(self):
        """Helper to get auth header"""
        response = client.post(
            "/api/auth/login",
            json={"email": "test@test.com", "password": "password123"}
        )
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_badges(self):
        """Test getting available badges"""
        response = client.get("/api/recognitions/badges", headers=self.get_auth_header())
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["name"] == "Star Performer"
    
    def test_list_recognitions(self):
        """Test listing recognitions"""
        response = client.get("/api/recognitions", headers=self.get_auth_header())
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestFeed:
    """Test social feed endpoints"""
    
    def get_auth_header(self):
        """Helper to get auth header"""
        response = client.post(
            "/api/auth/login",
            json={"email": "test@test.com", "password": "password123"}
        )
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_feed(self):
        """Test getting social feed"""
        response = client.get("/api/feed", headers=self.get_auth_header())
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestNotifications:
    """Test notification endpoints"""
    
    def get_auth_header(self):
        """Helper to get auth header"""
        response = client.post(
            "/api/auth/login",
            json={"email": "test@test.com", "password": "password123"}
        )
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_notifications(self):
        """Test getting notifications"""
        response = client.get("/api/notifications", headers=self.get_auth_header())
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_get_notification_count(self):
        """Test getting unread notification count"""
        response = client.get("/api/notifications/count", headers=self.get_auth_header())
        assert response.status_code == 200
        data = response.json()
        assert "count" in data


class TestBudgets:
    """Test budget management endpoints"""
    
    def get_auth_header(self):
        """Helper to get auth header"""
        response = client.post(
            "/api/auth/login",
            json={"email": "test@test.com", "password": "password123"}
        )
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_list_budgets(self):
        """Test listing budgets"""
        response = client.get("/api/budgets", headers=self.get_auth_header())
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestRedemption:
    """Test redemption/voucher endpoints"""
    
    def get_auth_header(self):
        """Helper to get auth header"""
        response = client.post(
            "/api/auth/login",
            json={"email": "test@test.com", "password": "password123"}
        )
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_vouchers(self):
        """Test getting available vouchers"""
        response = client.get("/api/redemptions/vouchers", headers=self.get_auth_header())
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_get_my_redemptions(self):
        """Test getting user's redemption history"""
        response = client.get("/api/redemptions", headers=self.get_auth_header())
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestAudit:
    """Test audit log endpoints"""
    
    def get_auth_header(self):
        """Helper to get auth header for HR admin"""
        response = client.post(
            "/api/auth/login",
            json={"email": "test@test.com", "password": "password123"}
        )
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_audit_logs(self):
        """Test getting audit logs (HR admin only)"""
        response = client.get("/api/audit", headers=self.get_auth_header())
        assert response.status_code == 200
        assert isinstance(response.json(), list)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
