"""
Integration Tests for Users API
Tests API endpoints with real database, service interactions, and error handling
"""
import pytest
import io
from fastapi.testclient import TestClient
from uuid import uuid4
from models import User, Tenant, Department, UserUploadStaging
from auth.utils import get_password_hash


class TestUsersApiIntegration:
    """Integration tests for /users/* endpoints"""
    
    def test_list_users_returns_current_tenant_only(self, client, tenant_manager_token, db_session, tenant):
        """Test listing users returns only current tenant's users"""
        response = client.get(
            "/users",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 200
        users = response.json()
        
        # All returned users should belong to current tenant
        for user in users:
            # Verify in database
            db_user = db_session.query(User).filter_by(
                id=user.get('id'),
                tenant_id=tenant.id
            ).first()
            assert db_user is not None, "User should belong to current tenant"
    
    def test_get_user_profile_returns_current_user(self, client, tenant_manager_token, admin_user):
        """Test profile endpoint returns current authenticated user"""
        response = client.get(
            "/users/profile",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 200
        profile = response.json()
        
        assert profile['corporate_email'] == admin_user.corporate_email
        assert profile['id'] == str(admin_user.id)
    
    def test_get_user_by_id_returns_full_details(self, client, tenant_manager_token, user_in_tenant, tenant):
        """Test get user by ID returns complete user details"""
        response = client.get(
            f"/users/{user_in_tenant['id']}",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 200
        user = response.json()
        
        assert user['corporate_email'] == user_in_tenant['corporate_email']
        assert user['first_name'] == user_in_tenant['first_name']
    
    def test_get_user_cross_tenant_forbidden(self, client, tenant_manager_token, other_tenant, db_session):
        """Test getting user from different tenant returns 403"""
        # Create user in other tenant
        other_user = User(
            tenant_id=other_tenant.id,
            corporate_email="other@example.com",
            first_name="Other",
            last_name="User",
            org_role="corporate_user",
            password_hash=get_password_hash("password"),
            status="ACTIVE"
        )
        db_session.add(other_user)
        db_session.commit()
        
        response = client.get(
            f"/users/{other_user.id}",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 403
    
    def test_create_user_successful(self, client, tenant_manager_token, tenant):
        """Test creating a new user via API"""
        user_data = {
            "corporate_email": "newuser@example.com",
            "first_name": "New",
            "last_name": "User",
            "org_role": "corporate_user",
            "password": "SecurePass123!",
            "personal_email": "new.personal@example.com"
        }
        
        response = client.post(
            "/users",
            json=user_data,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code in [200, 201]
        created_user = response.json()
        
        assert created_user['corporate_email'] == user_data['corporate_email']
        assert created_user['first_name'] == user_data['first_name']
    
    def test_create_duplicate_user_fails(self, client, tenant_manager_token, user_in_tenant):
        """Test creating user with duplicate email fails"""
        user_data = {
            "corporate_email": user_in_tenant['corporate_email'],
            "first_name": "Duplicate",
            "last_name": "User",
            "org_role": "corporate_user",
            "password": "SecurePass123!"
        }
        
        response = client.post(
            "/users",
            json=user_data,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 400
    
    def test_update_user_fields(self, client, tenant_manager_token, user_in_tenant):
        """Test updating user fields"""
        update_data = {
            "first_name": "Updated",
            "last_name": "Name"
        }
        
        response = client.patch(
            f"/users/{user_in_tenant['id']}",
            json=update_data,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 200
        updated_user = response.json()
        
        assert updated_user['first_name'] == "Updated"
        assert updated_user['last_name'] == "Name"
    
    def test_delete_user_removes_from_database(self, client, tenant_manager_token, user_in_tenant, db_session):
        """Test deleting user removes from database"""
        user_id = user_in_tenant['id']
        
        response = client.delete(
            f"/users/{user_id}",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 200
        
        # Verify user is removed
        deleted_user = db_session.query(User).filter_by(id=user_id).first()
        assert deleted_user is None or deleted_user.status == "DELETED"


class TestBulkUploadIntegration:
    """Integration tests for bulk upload feature"""
    
    def test_bulk_upload_csv_file(self, client, tenant_manager_token, tenant_with_department):
        """Test uploading a CSV file for bulk user import"""
        csv_content = """email,full_name,department,role
john@example.com,John Doe,Engineering,corporate_user
jane@example.com,Jane Smith,Engineering,dept_lead"""
        
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
    
    def test_bulk_upload_xlsx_file(self, client, tenant_manager_token, tenant_with_department):
        """Test uploading an XLSX file for bulk user import"""
        import openpyxl
        from io import BytesIO
        
        # Create XLSX file
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(['email', 'full_name', 'department', 'role'])
        ws.append(['john@example.com', 'John Doe', 'Engineering', 'corporate_user'])
        ws.append(['jane@example.com', 'Jane Smith', 'Engineering', 'dept_lead'])
        
        excel_buffer = BytesIO()
        wb.save(excel_buffer)
        excel_buffer.seek(0)
        
        files = {
            'file': ('users.xlsx', excel_buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        }
        
        response = client.post(
            "/users/upload",
            files=files,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code in [200, 201]
        data = response.json()
        assert data['total_rows'] == 2
    
    def test_bulk_upload_retrieves_staging_data(self, client, tenant_manager_token, db_session, tenant_with_department):
        """Test retrieving staged data after upload"""
        csv_content = """email,full_name,department,role
john@example.com,John Doe,Engineering,corporate_user"""
        
        # Upload
        files = {
            'file': ('users.csv', io.BytesIO(csv_content.encode()), 'text/csv')
        }
        
        upload_response = client.post(
            "/users/upload",
            files=files,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        batch_id = upload_response.json()['batch_id']
        
        # Retrieve staging data
        response = client.get(
            f"/users/staging/{batch_id}",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 200
        staging_rows = response.json()
        
        assert len(staging_rows) == 1
        assert staging_rows[0]['raw_email'] == "john@example.com"
    
    def test_bulk_upload_confirm_creates_users(self, client, tenant_manager_token, db_session, tenant_with_department):
        """Test confirming bulk upload creates users"""
        csv_content = """email,full_name,department,role
john@example.com,John Doe,Engineering,corporate_user"""
        
        # Upload
        files = {
            'file': ('users.csv', io.BytesIO(csv_content.encode()), 'text/csv')
        }
        
        upload_response = client.post(
            "/users/upload",
            files=files,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        batch_id = upload_response.json()['batch_id']
        
        # Confirm upload
        confirm_response = client.post(
            f"/users/staging/{batch_id}/confirm",
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert confirm_response.status_code in [200, 201]
        
        # Verify users were created
        new_user = db_session.query(User).filter_by(
            corporate_email="john@example.com",
            tenant_id=tenant_with_department.id
        ).first()
        
        assert new_user is not None
    
    def test_bulk_upload_error_rows_dont_create_users(self, client, tenant_manager_token, db_session, tenant_with_department):
        """Test error rows in bulk upload don't create users"""
        csv_content = """email,full_name,department,role
invalid-email,John Doe,NonexistentDept,invalid_role"""
        
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
        
        # All rows should be errors
        assert data['error_rows'] > 0
        assert data['valid_rows'] == 0
    
    def test_bulk_upload_permission_check(self, client, corporate_user_token):
        """Test non-admin users cannot upload bulk users"""
        csv_content = """email,full_name,department,role
john@example.com,John Doe,Engineering,corporate_user"""
        
        files = {
            'file': ('users.csv', io.BytesIO(csv_content.encode()), 'text/csv')
        }
        
        response = client.post(
            "/users/upload",
            files=files,
            headers={"Authorization": f"Bearer {corporate_user_token}"}
        )
        
        assert response.status_code == 403


class TestUsersValidation:
    """Integration tests for user validation"""
    
    def test_invalid_email_rejected(self, client, tenant_manager_token):
        """Test invalid email format is rejected"""
        user_data = {
            "corporate_email": "not-an-email",
            "first_name": "Test",
            "last_name": "User",
            "org_role": "corporate_user",
            "password": "SecurePass123!"
        }
        
        response = client.post(
            "/users",
            json=user_data,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 422  # Validation error
    
    def test_missing_required_field_rejected(self, client, tenant_manager_token):
        """Test missing required fields are rejected"""
        user_data = {
            "corporate_email": "test@example.com",
            # Missing first_name
            "last_name": "User",
            "org_role": "corporate_user",
            "password": "SecurePass123!"
        }
        
        response = client.post(
            "/users",
            json=user_data,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 422
    
    def test_invalid_role_rejected(self, client, tenant_manager_token):
        """Test invalid role is rejected"""
        user_data = {
            "corporate_email": "test@example.com",
            "first_name": "Test",
            "last_name": "User",
            "org_role": "invalid_role",
            "password": "SecurePass123!"
        }
        
        response = client.post(
            "/users",
            json=user_data,
            headers={"Authorization": f"Bearer {tenant_manager_token}"}
        )
        
        assert response.status_code == 422
