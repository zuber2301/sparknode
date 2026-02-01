# SparkNode Testing Quick Reference

## One-Command Cheatsheet

```bash
# Run all tests
pytest tests/

# Run with coverage
pytest tests/ --cov=backend --cov-report=html

# Run specific test
pytest tests/test_utils.py::TestPasswordGeneration::test_generate_random_password_default_length -v

# Debug mode
pytest tests/test_utils.py -v -s --pdb

# Only failed tests
pytest tests/ --lf

# Stop on first failure
pytest tests/ -x

# Show slowest tests
pytest tests/ --durations=10
```

---

## Test Levels Quick Guide

| Level | Purpose | When to Use | File | Example |
|-------|---------|------------|------|---------|
| **Unit** | Test functions in isolation | Utilities, helpers | `test_utils.py` | `test_clean_mobile("9876543210")` |
| **Integration** | Test API + database | Endpoints, services | `test_users_integration.py` | `POST /users/upload` |
| **Regression** | Prevent bug fixes from breaking | Bug fixes | `test_bulk_import_regression.py` | `test_validation_errors_is_jsonb_type` |
| **E2E** | Test complete workflows | User journeys | `test_e2e_workflows.py` | `upload → confirm → verify` |

---

## Test File Map

```
backend/tests/
├── test_utils.py                     # ← Unit tests (20+ tests)
├── test_users_integration.py         # ← Integration tests (25+ tests)
├── test_bulk_import_regression.py    # ← Regression tests (10+ tests)
├── test_e2e_workflows.py             # ← E2E tests (8+ tests)
└── [existing test files...]
```

---

## Writing Your First Test

### Unit Test Template
```python
# test_my_feature.py
from my_module import my_function

class TestMyFeature:
    """Test my feature"""
    
    def test_happy_path(self):
        """Test normal behavior"""
        result = my_function("input")
        assert result == "expected"
    
    def test_error_case(self):
        """Test error handling"""
        with pytest.raises(ValueError):
            my_function("invalid")
```

### Integration Test Template
```python
# test_my_api.py
class TestMyApi:
    """Test /my-endpoint"""
    
    def test_endpoint_success(self, client, token, db_session):
        """Test successful request"""
        response = client.get("/endpoint",
                            headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        
        # Verify database
        data = db_session.query(Model).all()
        assert len(data) > 0
    
    def test_endpoint_forbidden(self, client, wrong_token):
        """Test permission check"""
        response = client.get("/endpoint",
                            headers={"Authorization": f"Bearer {wrong_token}"})
        assert response.status_code == 403
```

---

## Common Assertions

```python
# Status codes
assert response.status_code == 200
assert response.status_code in [200, 201]

# Response data
assert response.json()['key'] == 'value'
assert 'error' not in response.json()

# Database
assert db_session.query(User).count() == 1
user = db_session.query(User).first()
assert user.email == 'test@example.com'

# Exceptions
with pytest.raises(ValueError):
    do_something_that_fails()

# Lists
assert len(items) == 3
assert 'item' in items
assert all(i > 0 for i in numbers)

# Strings
assert 'substring' in 'full string'
assert response.text.startswith('error')
```

---

## Fixtures You Need

```python
# FastAPI test client
@pytest.fixture
def client():
    from main import app
    return TestClient(app)

# Database session
@pytest.fixture
def db_session():
    # Handled by conftest.py

# Authenticated user token
@pytest.fixture
def tenant_admin_token(db_session, tenant):
    admin = User(...)
    db_session.add(admin)
    db_session.commit()
    return create_access_token(user_id=str(admin.id))

# Test tenant
@pytest.fixture
def tenant(db_session):
    t = Tenant(name="Test", ...)
    db_session.add(t)
    db_session.commit()
    return t
```

---

## Coverage Target

```
Overall: 80%+

By Module:
├── core/security.py: 95%
├── users/routes.py: 85%
├── recognition/routes.py: 85%
├── wallets/routes.py: 85%
├── redemption/routes.py: 85%
└── models.py: 85%
```

Check coverage:
```bash
pytest tests/ --cov=backend --cov-report=html
open htmlcov/index.html
```

---

## Troubleshooting

### Tests failing with database errors
```bash
# Database not running?
docker-compose up -d postgres

# Try resetting fixtures
pytest tests/ --setup-show

# Check database connection
pytest tests/ -v --tb=long
```

### Import errors
```bash
# Make sure you're in backend directory
cd backend

# Check imports
python -c "from models import User; print('OK')"
```

### Flaky tests (sometimes pass, sometimes fail)
```bash
# Run multiple times
pytest tests/test_file.py --count=10

# Add more verbose logging
pytest tests/test_file.py -v -s
```

### Tests timeout
```bash
# Increase timeout
pytest tests/ --timeout=30

# Find slow tests
pytest tests/ --durations=10
```

---

## CI/CD Integration

### Before committing
```bash
# Run all tests
pytest tests/ -q

# Check coverage (should be >70%)
pytest tests/ --cov=backend --cov-report=term
```

### In GitHub Actions
```yaml
- name: Tests
  run: pytest tests/ --cov=backend

- name: Coverage
  run: pytest tests/ --cov=backend --cov-report=xml
  
- name: Upload
  uses: codecov/codecov-action@v2
```

---

## Test Statistics

### New Tests Added
- **Unit tests**: 20+
- **Integration tests**: 25+
- **Regression tests**: 10+
- **E2E tests**: 8+
- **Total**: 60+ new tests

### Coverage Impact
- Before: 58%
- After: 70%+ (target)
- Critical modules covered

### Execution Time
- Unit tests: <0.5s
- Integration tests: <2s
- Regression tests: <1s
- E2E tests: <5s
- **Total**: <10s

---

## Documentation References

- Full guide: [TESTING.md](TESTING.md)
- Summary: [TEST_SUITE_SUMMARY.md](TEST_SUITE_SUMMARY.md)
- Pytest: https://docs.pytest.org
- FastAPI: https://fastapi.tiangolo.com/tutorial/testing/

---

## Key Test Files

| File | Purpose | Tests |
|------|---------|-------|
| [test_utils.py](backend/tests/test_utils.py) | Utility functions | 20+ |
| [test_users_integration.py](backend/tests/test_users_integration.py) | Users API | 25+ |
| [test_bulk_import_regression.py](backend/tests/test_bulk_import_regression.py) | Bulk import | 10+ |
| [test_e2e_workflows.py](backend/tests/test_e2e_workflows.py) | User workflows | 8+ |

---

## Pro Tips

### Run only tests matching a pattern
```bash
pytest -k "test_bulk" tests/  # Runs all tests with "bulk" in name
pytest -k "regression" tests/  # Runs all regression tests
```

### Run tests in parallel
```bash
pip install pytest-xdist
pytest tests/ -n auto  # Uses all CPU cores
```

### Generate nice test report
```bash
pip install pytest-html
pytest tests/ --html=report.html
open report.html
```

### Watch files and auto-run tests
```bash
pip install pytest-watch
ptw tests/  # Reruns on file changes
```

### Skip slow tests during development
```python
@pytest.mark.slow
def test_something_slow():
    pass

# Run: pytest tests/ -m "not slow"
```

---

## Common Patterns

### Testing errors
```python
def test_invalid_email(self, client, token):
    response = client.post("/users", json={"email": "bad"}, headers=...)
    assert response.status_code == 422
    assert 'email' in str(response.json())
```

### Testing pagination
```python
def test_pagination(self, client, token):
    response = client.get("/users?skip=0&limit=10", headers=...)
    users = response.json()
    assert len(users) <= 10
```

### Testing soft delete
```python
def test_delete(self, client, token, db_session, user_id):
    client.delete(f"/users/{user_id}", headers=...)
    user = db_session.query(User).filter_by(id=user_id).first()
    assert user.status == "DELETED"
```

### Testing permission
```python
def test_forbidden(self, client, wrong_token):
    response = client.post("/admin/action", headers={"Authorization": f"Bearer {wrong_token}"})
    assert response.status_code == 403
```

---

**Last Updated**: February 1, 2026  
**Status**: ✅ Ready to use
