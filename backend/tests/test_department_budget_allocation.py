"""
Test cases for department budget allocation functionality.
Tests for adding points to departments by tenant_manager and tenant_lead roles.
"""

import pytest
from decimal import Decimal
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from main import app
from database import SessionLocal
from models import Tenant, User, Department
from auth.utils import create_access_token

client = TestClient(app)


@pytest.fixture
def db():
    """Get database session for tests"""
    db = SessionLocal()
    yield db
    db.close()


@pytest.fixture
def test_tenant(db):
    """Create a test tenant with initial master budget"""
    tenant = Tenant(
        name="Test Company",
        slug="test-company",
        master_budget_balance=10000,
        status="active"
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


@pytest.fixture
def test_department(db, test_tenant):
    """Create a test department"""
    department = Department(
        tenant_id=test_tenant.id,
        name="Engineering",
        budget_balance=0
    )
    db.add(department)
    db.commit()
    db.refresh(department)
    return department


@pytest.fixture
def tenant_manager_user(db, test_tenant):
    """Create a tenant_manager user"""
    user = User(
        tenant_id=test_tenant.id,
        corporate_email="manager@test.com",
        first_name="John",
        last_name="Manager",
        org_role="tenant_manager",
        department_id=uuid4(),
        password_hash="hashed_password",
        status="ACTIVE"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def tenant_lead_user(db, test_tenant, test_department):
    """Create a tenant_lead user"""
    user = User(
        tenant_id=test_tenant.id,
        corporate_email="lead@test.com",
        first_name="Jane",
        last_name="Lead",
        org_role="tenant_lead",
        department_id=test_department.id,
        password_hash="hashed_password",
        status="ACTIVE"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def regular_user(db, test_tenant, test_department):
    """Create a regular tenant_user"""
    user = User(
        tenant_id=test_tenant.id,
        corporate_email="user@test.com",
        first_name="Bob",
        last_name="User",
        org_role="tenant_user",
        department_id=test_department.id,
        password_hash="hashed_password",
        status="ACTIVE"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


class TestDepartmentBudgetAllocation:
    """Test suite for department budget allocation"""

    def test_allocate_budget_as_tenant_manager_success(self, db, test_tenant, test_department, tenant_manager_user):
        """Test that tenant_manager can allocate points to a department"""
        # Create access token for tenant_manager
        token = create_access_token(str(tenant_manager_user.id))
        
        # Initial values
        initial_master_balance = test_tenant.master_budget_balance
        initial_dept_balance = test_department.budget_balance
        allocation_amount = 1000
        
        # Make request
        response = client.post(
            f"/api/tenants/departments/{test_department.id}/allocate-budget",
            headers={"Authorization": f"Bearer {token}"},
            json={"amount": allocation_amount}
        )
        
        # Assert response
        assert response.status_code == 200
        data = response.json()
        assert "Successfully allocated" in data["message"]
        assert data["new_master_balance"] == initial_master_balance - allocation_amount
        assert data["new_dept_balance"] == initial_dept_balance + allocation_amount
        
        # Verify database changes
        db.refresh(test_tenant)
        db.refresh(test_department)
        assert test_tenant.master_budget_balance == initial_master_balance - allocation_amount
        assert test_department.budget_balance == initial_dept_balance + allocation_amount

    def test_allocate_budget_as_tenant_lead_success(self, db, test_tenant, test_department, tenant_lead_user):
        """Test that tenant_lead can allocate points to their department"""
        # Create access token for tenant_lead
        token = create_access_token(str(tenant_lead_user.id))
        
        # Initial values
        initial_master_balance = test_tenant.master_budget_balance
        initial_dept_balance = test_department.budget_balance
        allocation_amount = 500
        
        # Make request
        response = client.post(
            f"/api/tenants/departments/{test_department.id}/allocate-budget",
            headers={"Authorization": f"Bearer {token}"},
            json={"amount": allocation_amount}
        )
        
        # Assert response
        assert response.status_code == 200
        data = response.json()
        assert "Successfully allocated" in data["message"]
        assert data["new_master_balance"] == initial_master_balance - allocation_amount
        assert data["new_dept_balance"] == initial_dept_balance + allocation_amount
        
        # Verify database changes
        db.refresh(test_tenant)
        db.refresh(test_department)
        assert test_tenant.master_budget_balance == initial_master_balance - allocation_amount
        assert test_department.budget_balance == initial_dept_balance + allocation_amount

    def test_allocate_budget_as_regular_user_forbidden(self, db, test_department, regular_user):
        """Test that regular tenant_user cannot allocate budget"""
        # Create access token for regular_user
        token = create_access_token(str(regular_user.id))
        
        # Make request
        response = client.post(
            f"/api/tenants/departments/{test_department.id}/allocate-budget",
            headers={"Authorization": f"Bearer {token}"},
            json={"amount": 100}
        )
        
        # Assert 403 Forbidden
        assert response.status_code == 403
        data = response.json()
        assert "Only tenant managers and leads" in data["detail"]

    def test_allocate_budget_insufficient_balance(self, db, test_tenant, test_department, tenant_manager_user):
        """Test that allocation fails when master balance is insufficient"""
        # Create access token for tenant_manager
        token = create_access_token(str(tenant_manager_user.id))
        
        # Try to allocate more than available
        allocation_amount = test_tenant.master_budget_balance + 1000
        
        # Make request
        response = client.post(
            f"/api/tenants/departments/{test_department.id}/allocate-budget",
            headers={"Authorization": f"Bearer {token}"},
            json={"amount": allocation_amount}
        )
        
        # Assert 400 Bad Request
        assert response.status_code == 400
        data = response.json()
        assert "Insufficient master pool balance" in data["detail"]

    def test_allocate_budget_invalid_amount_zero(self, db, test_department, tenant_manager_user):
        """Test that allocation fails with zero amount"""
        # Create access token for tenant_manager
        token = create_access_token(str(tenant_manager_user.id))
        
        # Make request with zero amount
        response = client.post(
            f"/api/tenants/departments/{test_department.id}/allocate-budget",
            headers={"Authorization": f"Bearer {token}"},
            json={"amount": 0}
        )
        
        # Assert validation error
        assert response.status_code == 422
        data = response.json()
        assert "validation error" in data.get("detail", [{}])[0].get("type", "").lower()

    def test_allocate_budget_invalid_amount_negative(self, db, test_department, tenant_manager_user):
        """Test that allocation fails with negative amount"""
        # Create access token for tenant_manager
        token = create_access_token(str(tenant_manager_user.id))
        
        # Make request with negative amount
        response = client.post(
            f"/api/tenants/departments/{test_department.id}/allocate-budget",
            headers={"Authorization": f"Bearer {token}"},
            json={"amount": -500}
        )
        
        # Assert validation error
        assert response.status_code == 422
        data = response.json()
        assert "validation error" in data.get("detail", [{}])[0].get("type", "").lower()

    def test_allocate_budget_nonexistent_department(self, db, test_tenant, tenant_manager_user):
        """Test that allocation fails for non-existent department"""
        # Create access token for tenant_manager
        token = create_access_token(str(tenant_manager_user.id))
        
        # Use a non-existent department ID
        fake_dept_id = uuid4()
        
        # Make request
        response = client.post(
            f"/api/tenants/departments/{fake_dept_id}/allocate-budget",
            headers={"Authorization": f"Bearer {token}"},
            json={"amount": 100}
        )
        
        # Assert 404 Not Found
        assert response.status_code == 404
        data = response.json()
        assert "Department not found" in data["detail"]

    def test_allocate_budget_multiple_allocations(self, db, test_tenant, test_department, tenant_manager_user):
        """Test multiple consecutive allocations"""
        # Create access token for tenant_manager
        token = create_access_token(str(tenant_manager_user.id))
        
        initial_master_balance = test_tenant.master_budget_balance
        allocation1 = 500
        allocation2 = 300
        allocation3 = 200
        
        # First allocation
        response1 = client.post(
            f"/api/tenants/departments/{test_department.id}/allocate-budget",
            headers={"Authorization": f"Bearer {token}"},
            json={"amount": allocation1}
        )
        assert response1.status_code == 200
        
        # Second allocation
        response2 = client.post(
            f"/api/tenants/departments/{test_department.id}/allocate-budget",
            headers={"Authorization": f"Bearer {token}"},
            json={"amount": allocation2}
        )
        assert response2.status_code == 200
        
        # Third allocation
        response3 = client.post(
            f"/api/tenants/departments/{test_department.id}/allocate-budget",
            headers={"Authorization": f"Bearer {token}"},
            json={"amount": allocation3}
        )
        assert response3.status_code == 200
        
        # Verify final state
        db.refresh(test_tenant)
        db.refresh(test_department)
        total_allocated = allocation1 + allocation2 + allocation3
        assert test_tenant.master_budget_balance == initial_master_balance - total_allocated
        assert test_department.budget_balance == total_allocated

    def test_allocate_budget_decimal_amounts(self, db, test_tenant, test_department, tenant_manager_user):
        """Test allocation with decimal amounts"""
        # Create access token for tenant_manager
        token = create_access_token(str(tenant_manager_user.id))
        
        # Initial values
        initial_master_balance = float(test_tenant.master_budget_balance)
        allocation_amount = 123.45
        
        # Make request with decimal amount
        response = client.post(
            f"/api/tenants/departments/{test_department.id}/allocate-budget",
            headers={"Authorization": f"Bearer {token}"},
            json={"amount": allocation_amount}
        )
        
        # Assert response
        assert response.status_code == 200
        data = response.json()
        assert data["new_master_balance"] == initial_master_balance - allocation_amount
        assert data["new_dept_balance"] == allocation_amount

    def test_allocate_budget_large_amount(self, db, test_tenant, test_department, tenant_manager_user):
        """Test allocation with large amounts"""
        # Update tenant master balance to a large amount
        test_tenant.master_budget_balance = 1000000
        db.commit()
        
        # Create access token for tenant_manager
        token = create_access_token(str(tenant_manager_user.id))
        
        large_allocation = 999999
        
        # Make request
        response = client.post(
            f"/api/tenants/departments/{test_department.id}/allocate-budget",
            headers={"Authorization": f"Bearer {token}"},
            json={"amount": large_allocation}
        )
        
        # Assert response
        assert response.status_code == 200
        data = response.json()
        assert data["new_master_balance"] == 1
        assert data["new_dept_balance"] == large_allocation

    def test_allocate_budget_to_multiple_departments(self, db, test_tenant, tenant_manager_user):
        """Test allocating to multiple different departments"""
        # Create additional departments
        dept1 = Department(tenant_id=test_tenant.id, name="Engineering", budget_balance=0)
        dept2 = Department(tenant_id=test_tenant.id, name="Sales", budget_balance=0)
        db.add(dept1)
        db.add(dept2)
        db.commit()
        db.refresh(dept1)
        db.refresh(dept2)
        
        token = create_access_token(str(tenant_manager_user.id))
        initial_balance = test_tenant.master_budget_balance
        
        # Allocate to dept1
        response1 = client.post(
            f"/api/tenants/departments/{dept1.id}/allocate-budget",
            headers={"Authorization": f"Bearer {token}"},
            json={"amount": 2000}
        )
        assert response1.status_code == 200
        
        # Allocate to dept2
        response2 = client.post(
            f"/api/tenants/departments/{dept2.id}/allocate-budget",
            headers={"Authorization": f"Bearer {token}"},
            json={"amount": 3000}
        )
        assert response2.status_code == 200
        
        # Verify both departments received allocations
        db.refresh(dept1)
        db.refresh(dept2)
        db.refresh(test_tenant)
        
        assert dept1.budget_balance == 2000
        assert dept2.budget_balance == 3000
        assert test_tenant.master_budget_balance == initial_balance - 5000


class TestAllocateBudgetSchema:
    """Test suite for AllocateBudgetRequest schema validation"""

    def test_schema_valid_positive_integer(self):
        """Test schema accepts positive integers"""
        from tenants.schemas import AllocateBudgetRequest
        
        request = AllocateBudgetRequest(amount=100)
        assert request.amount == 100

    def test_schema_valid_positive_float(self):
        """Test schema accepts positive floats"""
        from tenants.schemas import AllocateBudgetRequest
        
        request = AllocateBudgetRequest(amount=99.99)
        assert request.amount == 99.99

    def test_schema_invalid_zero(self):
        """Test schema rejects zero"""
        from tenants.schemas import AllocateBudgetRequest
        from pydantic import ValidationError
        
        with pytest.raises(ValidationError) as exc_info:
            AllocateBudgetRequest(amount=0)
        
        assert "Amount must be greater than 0" in str(exc_info.value)

    def test_schema_invalid_negative(self):
        """Test schema rejects negative amounts"""
        from tenants.schemas import AllocateBudgetRequest
        from pydantic import ValidationError
        
        with pytest.raises(ValidationError) as exc_info:
            AllocateBudgetRequest(amount=-100)
        
        assert "Amount must be greater than 0" in str(exc_info.value)

    def test_schema_missing_amount(self):
        """Test schema requires amount field"""
        from tenants.schemas import AllocateBudgetRequest
        from pydantic import ValidationError
        
        with pytest.raises(ValidationError) as exc_info:
            AllocateBudgetRequest()
        
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("amount",) for e in errors)
