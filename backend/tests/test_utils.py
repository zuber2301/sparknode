"""
Unit Tests for Core Utility Functions
Tests phone validation, password generation, mobile cleaning, and other helpers
"""
import pytest
from users.routes import generate_random_password, clean_mobile, validate_staging_row
from auth.utils import get_password_hash, verify_password
from sqlalchemy.orm import Session
from uuid import uuid4
from models import User, Tenant, Department


class TestPasswordGeneration:
    """Test password generation utility"""
    
    def test_generate_random_password_default_length(self):
        """Test default password length is 12"""
        password = generate_random_password()
        assert len(password) == 12
    
    def test_generate_random_password_custom_length(self):
        """Test custom password length"""
        password = generate_random_password(20)
        assert len(password) == 20
    
    def test_generate_random_password_contains_letters_and_digits(self):
        """Test password contains letters and digits"""
        passwords = [generate_random_password() for _ in range(10)]
        for password in passwords:
            assert any(c.isalpha() for c in password), "Password should contain letters"
            assert any(c.isdigit() for c in password), "Password should contain digits"
    
    def test_generate_random_password_different_each_time(self):
        """Test password generation produces different values"""
        passwords = [generate_random_password() for _ in range(5)]
        assert len(set(passwords)) == 5, "Passwords should be unique"
    
    def test_generate_random_password_minimum_length(self):
        """Test password generation with minimum length"""
        password = generate_random_password(1)
        assert len(password) == 1


class TestMobileCleaning:
    """Test mobile number cleaning utility"""
    
    def test_clean_mobile_with_10_digit_number(self):
        """Test cleaning 10-digit mobile number adds country code"""
        result = clean_mobile("9876543210")
        assert result == "+919876543210"
    
    def test_clean_mobile_with_country_code(self):
        """Test cleaning number that already has country code"""
        result = clean_mobile("+919876543210")
        assert result == "+919876543210"
    
    def test_clean_mobile_removes_spaces(self):
        """Test cleaning removes spaces"""
        result = clean_mobile("98 765 432 10")
        assert result == "+919876543210"
    
    def test_clean_mobile_removes_decimal_point(self):
        """Test cleaning removes .0 from Excel imports"""
        result = clean_mobile("9876543210.0")
        assert result == "+919876543210"
    
    def test_clean_mobile_empty_string(self):
        """Test cleaning empty string returns empty"""
        result = clean_mobile("")
        assert result == ""
    
    def test_clean_mobile_none_value(self):
        """Test cleaning None value returns empty"""
        result = clean_mobile(None)
        assert result == ""
    
    def test_clean_mobile_preserves_plus(self):
        """Test cleaning preserves plus sign"""
        result = clean_mobile("+91 9876 543 210")
        assert result == "+919876543210"
    
    def test_clean_mobile_removes_non_numeric_except_plus(self):
        """Test cleaning removes special characters"""
        result = clean_mobile("9876#543@210")
        assert result == "+919876543210"


class TestPasswordHashing:
    """Test password hashing and verification"""
    
    def test_hash_password_creates_different_hash_each_time(self):
        """Test password hashing produces different hashes"""
        password = "test_password_123"
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)
        assert hash1 != hash2, "Different hashes should be generated"
    
    def test_verify_password_success(self):
        """Test password verification with correct password"""
        password = "test_password_123"
        hashed = get_password_hash(password)
        assert verify_password(password, hashed) is True
    
    def test_verify_password_failure(self):
        """Test password verification with incorrect password"""
        password = "test_password_123"
        hashed = get_password_hash(password)
        assert verify_password("wrong_password", hashed) is False
    
    def test_verify_password_case_sensitive(self):
        """Test password verification is case sensitive"""
        password = "TestPassword123"
        hashed = get_password_hash(password)
        assert verify_password("testpassword123", hashed) is False


class TestValidateStagingRow:
    """Test staging row validation function"""
    
    def test_validate_staging_row_valid_data(self, db: Session, tenant_with_department):
        """Test validation of completely valid row"""
        tenant_id = tenant_with_department['tenant_id']
        dept_id = tenant_with_department['department_id']
        
        result = validate_staging_row(
            db=db,
            tenant_id=tenant_id,
            email="john@example.com",
            department_name="Engineering",
            role="corporate_user",
            manager_email="",
            full_name="John Doe",
            mobile_number="9876543210"
        )
        
        assert result["is_valid"] is True
        assert result["errors"] == []
        assert result["department_id"] == dept_id
    
    def test_validate_staging_row_missing_full_name(self, db: Session, tenant_with_department):
        """Test validation fails with missing full name"""
        result = validate_staging_row(
            db=db,
            tenant_id=tenant_with_department['tenant_id'],
            email="john@example.com",
            department_name="Engineering",
            role="corporate_user",
            manager_email="",
            full_name="",
            mobile_number=""
        )
        
        assert result["is_valid"] is False
        assert "Full Name is required" in result["errors"]
    
    def test_validate_staging_row_missing_email(self, db: Session, tenant_with_department):
        """Test validation fails with missing email"""
        result = validate_staging_row(
            db=db,
            tenant_id=tenant_with_department['tenant_id'],
            email="",
            department_name="Engineering",
            role="corporate_user",
            manager_email="",
            full_name="John Doe",
            mobile_number=""
        )
        
        assert result["is_valid"] is False
        assert "Work Email is required" in result["errors"]
    
    def test_validate_staging_row_invalid_email_format(self, db: Session, tenant_with_department):
        """Test validation fails with invalid email format"""
        result = validate_staging_row(
            db=db,
            tenant_id=tenant_with_department['tenant_id'],
            email="invalid-email",
            department_name="Engineering",
            role="corporate_user",
            manager_email="",
            full_name="John Doe",
            mobile_number=""
        )
        
        assert result["is_valid"] is False
        assert "Invalid Work Email format" in result["errors"]
    
    def test_validate_staging_row_missing_department(self, db: Session, tenant_with_department):
        """Test validation fails when department not found"""
        result = validate_staging_row(
            db=db,
            tenant_id=tenant_with_department['tenant_id'],
            email="john@example.com",
            department_name="NonexistentDept",
            role="corporate_user",
            manager_email="",
            full_name="John Doe",
            mobile_number=""
        )
        
        assert result["is_valid"] is False
        assert any("not found" in err for err in result["errors"])
    
    def test_validate_staging_row_invalid_role(self, db: Session, tenant_with_department):
        """Test validation fails with invalid role"""
        result = validate_staging_row(
            db=db,
            tenant_id=tenant_with_department['tenant_id'],
            email="john@example.com",
            department_name="Engineering",
            role="invalid_role",
            manager_email="",
            full_name="John Doe",
            mobile_number=""
        )
        
        assert result["is_valid"] is False
        assert any("Invalid Role" in err for err in result["errors"])
    
    def test_validate_staging_row_duplicate_email(self, db: Session, tenant_with_department, user_in_tenant):
        """Test validation fails when email already exists"""
        result = validate_staging_row(
            db=db,
            tenant_id=tenant_with_department['tenant_id'],
            email=user_in_tenant['corporate_email'],
            department_name="Engineering",
            role="corporate_user",
            manager_email="",
            full_name="John Doe",
            mobile_number=""
        )
        
        assert result["is_valid"] is False
        assert any("already in use" in err for err in result["errors"])
    
    def test_validate_staging_row_cleaned_mobile_returned(self, db: Session, tenant_with_department):
        """Test validation returns cleaned mobile number"""
        result = validate_staging_row(
            db=db,
            tenant_id=tenant_with_department['tenant_id'],
            email="john@example.com",
            department_name="Engineering",
            role="corporate_user",
            manager_email="",
            full_name="John Doe",
            mobile_number="9876543210"
        )
        
        assert result["cleaned_mobile"] == "+919876543210"


# Fixtures
@pytest.fixture
def tenant_with_department(db: Session):
    """Create a tenant with a department for testing"""
    tenant = Tenant(
        name="Test Tenant",
        slug="test-tenant",
        domain="test.example.com",
        admin_email="admin@test.example.com",
        currency_label="INR",
        status="active"
    )
    db.add(tenant)
    db.flush()
    
    dept = Department(
        tenant_id=tenant.id,
        name="Engineering",
        status="active"
    )
    db.add(dept)
    db.commit()
    
    return {
        "tenant_id": tenant.id,
        "department_id": dept.id
    }


@pytest.fixture
def user_in_tenant(db: Session, tenant_with_department):
    """Create a user in tenant for testing"""
    user = User(
        tenant_id=tenant_with_department['tenant_id'],
        corporate_email="existing@test.example.com",
        personal_email="personal@test.example.com",
        first_name="Existing",
        last_name="User",
        org_role="corporate_user",
        password_hash=get_password_hash("password123"),
        status="ACTIVE"
    )
    db.add(user)
    db.commit()
    
    return {
        "id": user.id,
        "corporate_email": user.corporate_email
    }
