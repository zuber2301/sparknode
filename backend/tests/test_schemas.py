import pytest
from pydantic import ValidationError
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from auth.schemas import LoginRequest, UserResponse, Token
from users.schemas import UserCreate, UserUpdate
from wallets.schemas import PointsAllocationRequest
from recognition.schemas import RecognitionCreate
from budgets.schemas import BudgetCreate


class TestAuthSchemas:
    """Test authentication schemas"""
    
    def test_login_request_valid(self):
        """Test valid login request"""
        data = LoginRequest(email="test@test.com", password="password123")
        assert data.email == "test@test.com"
        assert data.password == "password123"
    
    def test_login_request_invalid_email(self):
        """Test login request with invalid email"""
        with pytest.raises(ValidationError):
            LoginRequest(email="invalid-email", password="password123")
    
    def test_token_schema(self):
        """Test token response schema"""
        data = Token(access_token="abc123", token_type="bearer")
        assert data.access_token == "abc123"
        assert data.token_type == "bearer"


class TestUserSchemas:
    """Test user schemas"""
    
    def test_user_create_valid(self):
        """Test valid user creation schema"""
        data = UserCreate(
            email="newuser@test.com",
            password="password123",
            first_name="New",
            last_name="User",
            org_role="tenant_user"
        )
        assert data.email == "newuser@test.com"
        assert data.org_role == "tenant_user"
    
    def test_user_create_invalid_role(self):
        """Test user creation with invalid role"""
        with pytest.raises(ValidationError):
            UserCreate(
                email="newuser@test.com",
                password="password123",
                first_name="New",
                last_name="User",
                org_role="invalid_role"
            )
    
    def test_user_update_partial(self):
        """Test partial user update"""
        data = UserUpdate(first_name="Updated")
        assert data.first_name == "Updated"
        assert data.last_name is None


class TestWalletSchemas:
    """Test wallet schemas"""
    
    def test_allocate_points_valid(self):
        """Test valid point allocation"""
        data = PointsAllocationRequest(
            user_id="770e8400-e29b-41d4-a716-446655440001",
            points=100,
            description="Bonus allocation"
        )
        assert data.points == 100
    
    def test_allocate_points_zero(self):
        """Test point allocation with zero points"""
        data = PointsAllocationRequest(
            user_id="770e8400-e29b-41d4-a716-446655440001",
            points=0,
            description="No points"
        )
        assert data.points == 0


class TestRecognitionSchemas:
    """Test recognition schemas"""
    
    def test_recognition_create_valid(self):
        """Test valid recognition creation"""
        data = RecognitionCreate(
            to_user_id="770e8400-e29b-41d4-a716-446655440002",
            message="Great work on the project!",
            points=50
        )
        assert data.points == 50
        assert data.message == "Great work on the project!"
    
    def test_recognition_create_with_badge(self):
        """Test recognition creation with badge"""
        data = RecognitionCreate(
            to_user_id="770e8400-e29b-41d4-a716-446655440002",
            message="Outstanding performance!",
            points=100,
            badge_id="880e8400-e29b-41d4-a716-446655440001"
        )
        assert data.badge_id is not None


class TestBudgetSchemas:
    """Test budget schemas"""
    
    def test_budget_create_valid(self):
        """Test valid budget creation"""
        data = BudgetCreate(
            name="Q1 2026 Budget",
            fiscal_year=2026,
            total_points=100000
        )
        assert data.total_points == 100000
        assert data.fiscal_year == 2026


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
