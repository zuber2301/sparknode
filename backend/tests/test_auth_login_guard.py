from fastapi.testclient import TestClient
from main import app

# Fake DB session to simulate a user record without password_hash
class FakeQuery:
    def __init__(self, result):
        self._result = result
    def filter(self, *args, **kwargs):
        return self
    def first(self):
        return self._result

class FakeDB:
    def __init__(self, result):
        self._result = result
    def query(self, *args, **kwargs):
        return FakeQuery(self._result)


class FakeUser:
    def __init__(self):
        self.id = "00000000-0000-0000-0000-000000000000"
        self.tenant_id = None
        self.corporate_email = "user@example.com"
        self.first_name = "Test"
        self.last_name = "User"
        self.org_role = "tenant_user"
        self.phone_number = None
        self.mobile_number = None
        self.personal_email = None
        self.department_id = None
        self.tenant_tenant_manager_id = None
        self.avatar_url = None
        self.date_of_birth = None
        self.hire_date = None
        self.status = "active"
        self.created_at = None
        self.is_platform_admin = False
        self.password_hash = None  # Missing password


client = TestClient(app)


def test_login_missing_password_hash_returns_401(monkeypatch):
    fake_user = FakeUser()
    fake_db = FakeDB(fake_user)

    # Override the get_db dependency
    from auth import utils as auth_utils
    from database import get_db

    app.dependency_overrides[get_db] = lambda: fake_db

    payload = {"email": "user@example.com", "password": "secret"}
    r = client.post("/api/auth/login", json=payload)

    assert r.status_code == 401
    assert r.json().get("detail") == "Incorrect email or password"

    # Clean up override
    app.dependency_overrides.clear()
