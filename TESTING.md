# SparkNode Test Suite Documentation

## Overview

This document provides comprehensive guidance on running, maintaining, and expanding the SparkNode test suite. The test suite is organized into **four levels**:

1. **Unit Tests** - Individual functions/modules in isolation
2. **Integration Tests** - API endpoints with real database interactions
3. **Regression Tests** - Specific bug fixes that must never break again
4. **End-to-End Tests** - Complete user workflows from start to finish

---

## Quick Start

### Run All Tests
```bash
cd backend
python -m pytest tests/ -v
```

### Run with Coverage Report
```bash
python -m pytest tests/ --cov=backend --cov-report=html
# Open htmlcov/index.html in browser
```

### Run Specific Test File
```bash
python -m pytest tests/test_utils.py -v
```

### Run Specific Test Class
```bash
python -m pytest tests/test_utils.py::TestPasswordGeneration -v
```

### Run Specific Test
```bash
python -m pytest tests/test_utils.py::TestPasswordGeneration::test_generate_random_password_default_length -v
```

### Run with Debugging
```bash
python -m pytest tests/test_utils.py -v -s  # -s shows print statements
python -m pytest tests/test_utils.py -v --pdb  # Drop into debugger on failure
```

---

## Test Organization

### File Structure
```
backend/tests/
├── conftest.py                          # Shared fixtures and configuration
├── test_utils.py                        # Unit tests for utility functions
├── test_users_integration.py            # Integration tests for users API
├── test_bulk_import_regression.py       # Regression tests for bulk import
├── test_e2e_workflows.py                # End-to-end user workflows
├── test_auth.py                         # Authentication tests
├── test_provisioning_simple.py          # Basic provisioning tests
├── test_wallet_service.py               # Wallet service tests
├── test_audit_service.py                # Audit service tests
└── ...
```

### Test Naming Conventions

**Test Files**: `test_<feature>.py`
- `test_utils.py` - Utility functions
- `test_users_integration.py` - Users API integration
- `test_bulk_import_regression.py` - Bulk import regressions

**Test Classes**: `Test<Feature>`
- `TestPasswordGeneration` - Password generation tests
- `TestMobileCleaning` - Mobile number cleaning tests
- `TestBulkImportRegressions` - Bulk import regression tests

**Test Methods**: `test_<what_should_happen>`
- `test_generate_random_password_default_length` - Test default length
- `test_clean_mobile_with_10_digit_number` - Test 10-digit cleaning
- `test_bulk_upload_creates_staging_records` - Test staging creation

---

## Coverage Goals

### Current Coverage (Last Run)
```
Overall: 58%
Critical gaps:
  - events: 21%
  - recognition: 23%
  - feed: 22%
  - wallets: 23%
  - redemption: 27%
  - users routes: 20%
```

### Target Coverage by Module
- **Core Utils** (auth, core/security): >95%
- **API Routes** (users, recognition, etc): >80%
- **Services** (wallet, audit): >90%
- **Schemas/Models**: >85%
- **Overall**: 80%+

---

## Writing Tests

### Unit Tests (Isolated Functions)

```python
# File: test_utils.py
class TestPasswordGeneration:
    """Test password generation utility"""
    
    def test_generate_random_password_default_length(self):
        """Test default password length is 12"""
        password = generate_random_password()
        assert len(password) == 12
    
    def test_generate_random_password_contains_letters_and_digits(self):
        """Test password contains both letters and digits"""
        passwords = [generate_random_password() for _ in range(10)]
        for password in passwords:
            assert any(c.isalpha() for c in password)
            assert any(c.isdigit() for c in password)
```

**Key Principles:**
- Test one thing per test
- Use clear, descriptive names
- Test both happy path and edge cases
- Test error conditions
- No database dependencies (use mocks if needed)

### Integration Tests (API + Database)

```python
# File: test_users_integration.py
class TestUsersApiIntegration:
    """Integration tests for /users/* endpoints"""
    
    def test_list_users_returns_current_tenant_only(self, client, tenant_admin_token, db_session, tenant):
        """Test listing users returns only current tenant's users"""
        response = client.get(
            "/users",
            headers={"Authorization": f"Bearer {tenant_admin_token}"}
        )
        
        assert response.status_code == 200
        users = response.json()
        
        # All returned users should belong to current tenant
        for user in users:
            db_user = db_session.query(User).filter_by(
                id=user.get('id'),
                tenant_id=tenant.id
            ).first()
            assert db_user is not None
```

**Key Principles:**
- Test complete API request/response cycle
- Verify database state after operations
- Test error cases (403, 404, 422, etc)
- Test cross-tenant isolation
- Use fixtures for setup

### Regression Tests (Bug Fixes)

```python
# File: test_bulk_import_regression.py
class TestBulkImportRegressions:
    """Regression tests to ensure bulk import never breaks again"""
    
    def test_bulk_upload_staging_table_has_all_required_columns(self, db_session, tenant):
        """Regression: user_upload_staging must have all required columns"""
        from sqlalchemy import inspect
        from models import UserUploadStaging
        
        columns = {c.name for c in inspect(UserUploadStaging).columns}
        
        required_columns = {
            'id', 'tenant_id', 'batch_id',
            'raw_full_name', 'raw_email', 'raw_department', 'raw_role',
            'is_valid', 'validation_errors'
        }
        
        missing = required_columns - columns
        assert not missing, f"Missing columns: {missing}"
```

**Key Principles:**
- One test per bug fix
- Document why the bug occurred
- Test the exact scenario that triggered the bug
- Include comment explaining the regression

### E2E Tests (Complete Workflows)

```python
# File: test_e2e_workflows.py
class TestE2EUserOnboarding:
    """E2E tests for complete user onboarding workflow"""
    
    def test_e2e_tenant_admin_invites_bulk_users(self, client, tenant_admin_token, db_session, tenant_with_department):
        """
        E2E: Tenant admin uploads CSV → Validates data → Confirms import → Users exist
        """
        csv_content = """email,full_name,department,role
john@example.com,John Doe,Engineering,corporate_user"""
        
        # Step 1: Upload CSV
        files = {'file': ('users.csv', io.BytesIO(csv_content.encode()), 'text/csv')}
        upload_response = client.post(
            "/users/upload",
            files=files,
            headers={"Authorization": f"Bearer {tenant_admin_token}"}
        )
        assert upload_response.status_code in [200, 201]
        batch_id = upload_response.json()['batch_id']
        
        # Step 2: Review staging data
        staging_response = client.get(
            f"/users/staging/{batch_id}",
            headers={"Authorization": f"Bearer {tenant_admin_token}"}
        )
        assert staging_response.status_code == 200
        
        # Step 3: Confirm import
        confirm_response = client.post(
            f"/users/staging/{batch_id}/confirm",
            headers={"Authorization": f"Bearer {tenant_admin_token}"}
        )
        assert confirm_response.status_code in [200, 201]
```

**Key Principles:**
- Multiple steps in sequence
- Clear step comments
- Verify data at each step
- Test user interactions, not internal details
- Full teardown/cleanup

---

## Using Fixtures

### Common Fixtures (conftest.py)

```python
@pytest.fixture
def client():
    """FastAPI test client"""
    from main import app
    return TestClient(app)

@pytest.fixture
def tenant(db_session):
    """Create a test tenant"""
    tenant = Tenant(
        name="Test Tenant",
        slug="test-tenant",
        domain="test.example.com",
        admin_email="admin@example.com",
        status="active"
    )
    db_session.add(tenant)
    db_session.commit()
    return tenant

@pytest.fixture
def tenant_admin_token(db_session, tenant):
    """Create and return admin token for tenant"""
    admin = User(
        tenant_id=tenant.id,
        corporate_email="admin@example.com",
        first_name="Admin",
        last_name="User",
        org_role="tenant_admin",
        password_hash=get_password_hash("password"),
        status="ACTIVE"
    )
    db_session.add(admin)
    db_session.commit()
    
    return create_access_token(user_id=str(admin.id))
```

### Creating Custom Fixtures

```python
@pytest.fixture
def tenant_with_department(db_session):
    """Fixture that depends on other setup"""
    tenant = Tenant(name="Test", slug="test", domain="test.com", admin_email="a@test.com")
    db_session.add(tenant)
    db_session.flush()
    
    dept = Department(tenant_id=tenant.id, name="Engineering")
    db_session.add(dept)
    db_session.commit()
    
    return {"tenant": tenant, "department": dept}
```

---

## Database Testing

### Transaction Isolation
Tests run in transactions that rollback automatically (via `db_session` fixture).

```python
def test_user_creation(db_session, tenant):
    """Database changes are isolated to this test"""
    user = User(tenant_id=tenant.id, corporate_email="test@example.com", ...)
    db_session.add(user)
    db_session.commit()
    
    # Verify
    result = db_session.query(User).filter_by(id=user.id).first()
    assert result is not None
    # Automatically rolled back after test
```

### Querying Committed Data
```python
def test_bulk_upload_persists_data(client, tenant_admin_token, db_session, tenant):
    """Verify data persists through API calls"""
    # Make API call
    response = client.post("/users/upload", ...)
    
    # Query data committed by API
    staging = db_session.query(UserUploadStaging).all()
    assert len(staging) > 0
```

---

## Running Tests in CI/CD

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: sparknode
          POSTGRES_PASSWORD: password
          POSTGRES_DB: sparknode

    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: 3.12
      
      - name: Install dependencies
        run: pip install -r requirements.txt
      
      - name: Run tests
        run: pytest tests/ --cov=backend --cov-report=xml
      
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

---

## Common Test Patterns

### Testing Validation Errors
```python
def test_invalid_email_rejected(self, client, tenant_admin_token):
    """Test invalid email format is rejected"""
    user_data = {
        "corporate_email": "not-an-email",
        "first_name": "Test",
        "org_role": "corporate_user",
        "password": "Pass123!"
    }
    
    response = client.post("/users", json=user_data, ...)
    assert response.status_code == 422  # Validation error
    assert "email" in response.json()['detail'][0]['loc']
```

### Testing Authorization
```python
def test_non_admin_cannot_upload_bulk_users(self, client, corporate_user_token):
    """Test non-admin users cannot upload bulk users"""
    files = {'file': ('users.csv', ...)}
    response = client.post("/users/upload", files=files, 
                          headers={"Authorization": f"Bearer {corporate_user_token}"})
    assert response.status_code == 403
```

### Testing Pagination
```python
def test_list_users_pagination(self, client, tenant_admin_token):
    """Test pagination works correctly"""
    response = client.get("/users?skip=0&limit=10", ...)
    assert response.status_code == 200
    data = response.json()
    assert len(data) <= 10
```

### Testing Soft Deletes
```python
def test_delete_user_soft_deletes(self, client, tenant_admin_token, user_in_tenant, db_session):
    """Test user deletion is soft delete"""
    response = client.delete(f"/users/{user_in_tenant['id']}", ...)
    assert response.status_code == 200
    
    # User still in DB, but marked deleted
    deleted_user = db_session.query(User).filter_by(id=user_in_tenant['id']).first()
    assert deleted_user.status == "DELETED"
```

---

## Debugging Tests

### Print Debugging
```python
def test_something(self):
    result = some_function()
    print(f"DEBUG: result={result}")  # Use -s flag to see output
    assert result == expected
```

Run with: `pytest test_file.py -s`

### Interactive Debugging (pdb)
```python
def test_something(self):
    result = some_function()
    import pdb; pdb.set_trace()  # Drops into debugger
    assert result == expected
```

Run with: `pytest test_file.py --pdb`

### Verbose Output
```bash
pytest tests/ -vv  # Very verbose
pytest tests/ --tb=long  # Long traceback
pytest tests/ --tb=short  # Short traceback (default)
```

---

## Test Maintenance

### When to Add Tests

1. **Bug Fixes**: Always add regression test
   ```python
   # test_bulk_import_regression.py
   def test_bulk_upload_validation_errors_is_jsonb_type(self):
       """Regression: validation_errors must be JSONB, not TEXT[]"""
   ```

2. **New Features**: Add unit + integration + E2E tests
3. **API Changes**: Update existing tests
4. **Dependencies Updated**: Run full test suite

### When to Update Tests

- API response structure changes → Update integration tests
- Database schema changes → Update related tests
- Business logic changes → Update both unit and integration tests
- Performance improvements → May need to relax time constraints

### Failing Tests

```bash
# Run only failing tests
pytest tests/ --lf

# Run last failed + newly added
pytest tests/ --ff

# Stop on first failure
pytest tests/ -x

# Show which tests are slowest
pytest tests/ --durations=10
```

---

## Best Practices

### ✅ Do

- Write clear test names describing what should happen
- Test one thing per test
- Use fixtures for common setup
- Test both happy path and error cases
- Include comments explaining complex test logic
- Mock external dependencies (email, SMS, etc)
- Use transactions for database isolation
- Name variables clearly

### ❌ Don't

- Don't test implementation details, test behavior
- Don't create test data in random locations
- Don't mix multiple assertions without clear separation
- Don't create interdependent tests
- Don't use hardcoded IDs or timestamps
- Don't test framework code (FastAPI, SQLAlchemy)
- Don't skip cleanup

---

## Coverage Report

### Viewing Coverage
```bash
# Generate HTML report
pytest tests/ --cov=backend --cov-report=html

# Open in browser
open htmlcov/index.html
```

### Interpreting Report
- **Green**: Well covered (>80%)
- **Yellow**: Moderate coverage (50-80%)
- **Red**: Poor coverage (<50%)

Click line numbers to see exact uncovered lines.

### Coverage Goals per Module

| Module | Current | Target |
|--------|---------|--------|
| core/security.py | 50% | 95% |
| users/routes.py | 20% | 85% |
| recognition/routes.py | 23% | 85% |
| wallets/routes.py | 23% | 85% |
| events/routes.py | 21% | 85% |

---

## Continuous Improvement

### Monthly Tasks

1. Review coverage report
2. Add tests for lowest coverage modules
3. Review failed tests and update
4. Refactor flaky tests
5. Profile test execution time

### Yearly Goals

- Reach 80%+ overall coverage
- Achieve sub-second test execution
- Zero flaky tests
- Comprehensive documentation
- CI/CD pipeline with coverage gates

---

## Questions?

For test-related questions:
1. Check this documentation
2. Review existing similar tests
3. Run `pytest --help` for CLI options
4. Check [pytest documentation](https://docs.pytest.org)
