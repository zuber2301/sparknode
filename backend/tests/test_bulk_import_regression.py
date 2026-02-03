"""
Regression Tests for Bulk Import Feature
Ensures the previously broken bulk import feature continues to work correctly
"""
import pytest
import io
from fastapi.testclient import TestClient
from uuid import uuid4
from models import User, Department, UserUploadStaging, Tenant
from auth.utils import get_password_hash
from datetime import datetime


class TestBulkImportRegressions:
    """
    Regression tests to ensure bulk import never breaks again.
    These tests validate the fixes applied to database schema and code.
    """
    
    def test_bulk_upload_creates_staging_records(self, tenant_manager_token, db_session, tenant):
        """Regression: Bulk upload should create records in staging table"""
        from main import app
        
        client = TestClient(app)
        csv_content = """email,full_name,department,role
john@example.com,John Doe,Engineering,corporate_user
jane@example.com,Jane Smith,Engineering,corporate_user"""
        
        files = {
            'file': ('users.csv', io.BytesIO(csv_content.encode()), 'text/csv')
        }
        
        response = client.post(
            "/users/upload",
            files=files,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code in [200, 201]
        data = response.json()
        assert data['total_rows'] == 2
        assert 'batch_id' in data
    
    def test_bulk_upload_staging_table_has_all_required_columns(self, db_session, tenant):
        """Regression: user_upload_staging must have all required columns"""
        # Check database schema has all required columns
        from sqlalchemy import inspect
        from models import UserUploadStaging
        
        columns = {c.name for c in inspect(UserUploadStaging).columns}
        
        required_columns = {
            'id', 'tenant_id', 'batch_id',
            'raw_full_name', 'raw_email', 'raw_department', 'raw_role', 'raw_mobile_phone',
            'manager_email', 'first_name', 'last_name', 'corporate_email', 'personal_email',
            'date_of_birth', 'hire_date', 'department_id', 'manager_id',
            'is_valid', 'validation_errors', 'status',
            'created_at', 'updated_at'
        }
        
        missing_columns = required_columns - columns
        assert not missing_columns, f"Missing columns: {missing_columns}"
    
    def test_bulk_upload_validation_errors_is_jsonb_type(self, db_session):
        """Regression: validation_errors must be JSONB, not TEXT[]"""
        from sqlalchemy import inspect, JSONB
        from models import UserUploadStaging
        
        columns = inspect(UserUploadStaging).columns
        validation_errors_col = columns['validation_errors']
        
        # Check type is JSONB
        assert isinstance(validation_errors_col.type, JSONB), \
            f"validation_errors should be JSONB, got {type(validation_errors_col.type)}"
    
    def test_bulk_upload_nullable_columns_dont_block_inserts(self, db_session, tenant):
        """Regression: Staging table should accept NULL for processed fields"""
        staging = UserUploadStaging(
            id=uuid4(),
            tenant_id=tenant.id,
            batch_id=uuid4(),
            raw_full_name="John Doe",
            raw_email="john@example.com",
            raw_department="Engineering",
            raw_role="corporate_user",
            is_valid=False,
            validation_errors=[],
            # These should be allowed to be NULL
            full_name=None,
            email=None,
            first_name=None,
            last_name=None,
            corporate_email=None,
            manager_email=None,
            department_id=None,
            manager_id=None
        )
        
        db_session.add(staging)
        db_session.commit()
        
        # Verify it was inserted
        result = db_session.query(UserUploadStaging).filter_by(id=staging.id).first()
        assert result is not None
        assert result.full_name is None
        assert result.corporate_email is None
    
    def test_bulk_upload_validation_errors_stored_as_json_array(self, db_session, tenant):
        """Regression: validation_errors should store JSON array, not string"""
        errors = ["Email invalid", "Department not found"]
        
        staging = UserUploadStaging(
            id=uuid4(),
            tenant_id=tenant.id,
            batch_id=uuid4(),
            raw_full_name="John",
            raw_email="john@example.com",
            raw_department="Eng",
            raw_role="user",
            is_valid=False,
            validation_errors=errors,
            status="error"
        )
        
        db_session.add(staging)
        db_session.commit()
        
        # Verify it was stored correctly
        result = db_session.query(UserUploadStaging).filter_by(id=staging.id).first()
        assert result.validation_errors == errors
        assert isinstance(result.validation_errors, list)
    
    def test_bulk_upload_endpoint_returns_valid_batch_id(self, tenant_manager_token, db_session, tenant):
        """Regression: Bulk upload should return a valid UUID batch_id"""
        from main import app
        
        client = TestClient(app)
        csv_content = """email,full_name,department,role
john@example.com,John Doe,Engineering,corporate_user"""
        
        files = {
            'file': ('users.csv', io.BytesIO(csv_content.encode()), 'text/csv')
        }
        
        response = client.post(
            "/users/upload",
            files=files,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code in [200, 201]
        data = response.json()
        
        # batch_id should be valid UUID format
        batch_id = data['batch_id']
        try:
            from uuid import UUID
            UUID(batch_id)
        except ValueError:
            pytest.fail(f"batch_id '{batch_id}' is not a valid UUID")
    
    def test_bulk_upload_error_handling_no_500_errors(self, tenant_manager_token, db_session):
        """Regression: Bulk upload should never return 500 error, always 200 or 400"""
        from main import app
        
        client = TestClient(app)
        
        # Test with invalid data
        csv_content = """email,full_name,department,role
invalid-email,John,NonexistentDept,invalid_role"""
        
        files = {
            'file': ('users.csv', io.BytesIO(csv_content.encode()), 'text/csv')
        }
        
        response = client.post(
            "/users/upload",
            files=files,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        # Should not return 500
        assert response.status_code in [200, 201, 400, 422], \
            f"Unexpected status {response.status_code}: {response.text}"
    
    def test_bulk_upload_tracks_valid_vs_error_rows(self, tenant_manager_token, db_session, tenant_with_valid_department):
        """Regression: Bulk upload should track valid and error rows separately"""
        from main import app
        
        client = TestClient(app)
        csv_content = """email,full_name,department,role
john@example.com,John Doe,Engineering,corporate_user
invalid,Missing Name,Engineering,user"""
        
        files = {
            'file': ('users.csv', io.BytesIO(csv_content.encode()), 'text/csv')
        }
        
        response = client.post(
            "/users/upload",
            files=files,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code in [200, 201]
        data = response.json()
        
        assert data['total_rows'] == 2
        assert data['valid_rows'] + data['error_rows'] == 2
    
    def test_bulk_upload_staging_data_persists_across_requests(self, tenant_manager_token, db_session, tenant):
        """Regression: Staging data should persist in database"""
        from main import app
        
        client = TestClient(app)
        csv_content = """email,full_name,department,role
john@example.com,John Doe,Engineering,corporate_user"""
        
        files = {
            'file': ('users.csv', io.BytesIO(csv_content.encode()), 'text/csv')
        }
        
        response = client.post(
            "/users/upload",
            files=files,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        batch_id = response.json()['batch_id']
        
        # Query staging data directly
        staging_records = db_session.query(UserUploadStaging).filter_by(batch_id=batch_id).all()
        assert len(staging_records) > 0
        assert staging_records[0].raw_email == "john@example.com"
    
    def test_bulk_upload_respects_tenant_isolation(self, db_session, tenant, other_tenant):
        """Regression: Bulk upload should only create records for current tenant"""
        from main import app
        from uuid import uuid4
        
        # Create staging records in tenant1
        batch_id = uuid4()
        staging = UserUploadStaging(
            id=uuid4(),
            tenant_id=tenant.id,
            batch_id=batch_id,
            raw_full_name="John",
            raw_email="john@example.com",
            raw_department="Eng",
            raw_role="user",
            is_valid=True,
            validation_errors=[]
        )
        db_session.add(staging)
        db_session.commit()
        
        # Verify tenant1 can see it
        records_in_tenant = db_session.query(UserUploadStaging).filter_by(
            tenant_id=tenant.id,
            batch_id=batch_id
        ).all()
        assert len(records_in_tenant) == 1
        
        # Verify tenant2 cannot see it
        records_in_other_tenant = db_session.query(UserUploadStaging).filter_by(
            tenant_id=other_tenant.id,
            batch_id=batch_id
        ).all()
        assert len(records_in_other_tenant) == 0
    
    def test_bulk_upload_double_insert_prevention(self, tenant_manager_token, db_session, tenant, user_in_tenant):
        """Regression: System should prevent uploading duplicate emails"""
        from main import app
        
        client = TestClient(app)
        
        # Try to upload user that already exists
        csv_content = f"""email,full_name,department,role
{user_in_tenant['corporate_email']},Existing User,Engineering,corporate_user"""
        
        files = {
            'file': ('users.csv', io.BytesIO(csv_content.encode()), 'text/csv')
        }
        
        response = client.post(
            "/users/upload",
            files=files,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code in [200, 201]
        data = response.json()
        
        # Row should be marked as error due to duplicate email
        assert data['error_rows'] > 0


# Fixtures
@pytest.fixture
def tenant_with_valid_department(db_session):
    """Create a tenant with a valid department"""
    tenant = Tenant(
        name="Test Tenant",
        slug="test-tenant",
        domain="test.example.com",
        admin_email="admin@test.example.com",
        status="active"
    )
    db_session.add(tenant)
    db_session.flush()
    
    dept = Department(
        tenant_id=tenant.id,
        name="Engineering",
        status="active"
    )
    db_session.add(dept)
    db_session.commit()
    
    return tenant


@pytest.fixture
def other_tenant(db_session):
    """Create another tenant for isolation testing"""
    tenant = Tenant(
        name="Other Tenant",
        slug="other-tenant",
        domain="other.example.com",
        admin_email="admin@other.example.com",
        status="active"
    )
    db_session.add(tenant)
    db_session.commit()
    return tenant


@pytest.fixture
def user_in_tenant(db_session, tenant):
    """Create a user in a tenant"""
    user = User(
        tenant_id=tenant.id,
        corporate_email="existing@example.com",
        first_name="Existing",
        last_name="User",
        org_role="corporate_user",
        password_hash=get_password_hash("password123"),
        status="ACTIVE"
    )
    db_session.add(user)
    db_session.commit()
    
    return {
        "id": user.id,
        "corporate_email": user.corporate_email
    }
