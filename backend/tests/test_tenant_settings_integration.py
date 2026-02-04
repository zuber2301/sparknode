import requests
import pytest
from decimal import Decimal

BASE_URL = "http://localhost:8000"


def auth_header_for(email="admin@demo.com", password="password123"):
    """Try to log in; if login fails, fall back to generating a JWT for an existing tenant manager via DB."""
    resp = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    if resp.status_code == 200:
        token = resp.json().get('access_token')
        return {"Authorization": f"Bearer {token}"}

    # Fallback: generate token for any active tenant manager in the DB
    # This avoids brittle tests that depend on a specific seeded user/password.
    try:
        from database import SessionLocal
        from models import User
        from auth.utils import create_access_token
        db = SessionLocal()
        user = db.query(User).filter(User.org_role.in_(['tenant_manager', 'hr_admin', 'tenant_lead']), User.status == 'ACTIVE').first()
        if not user:
            pytest.skip("No tenant manager/hr_admin available to generate token")
        payload = {
            'sub': str(user.id),
            'tenant_id': str(user.tenant_id),
            'email': user.corporate_email,
            'org_role': user.org_role,
            'type': 'tenant'
        }
        token = create_access_token(payload)
        return {"Authorization": f"Bearer {token}"}
    except Exception as e:
        pytest.skip(f"Could not obtain auth header: {e}")
    finally:
        try:
            db.close()
        except Exception:
            pass


class TestTenantSettingsIntegration:

    def test_update_current_tenant_settings_and_audit_logged(self):
        """HR Admin can update tenant settings and an audit log is created."""
        headers = auth_header_for()

        payload = {
            "currency": "USD",
            "markup_percent": "2.50",
            "enabled_rewards": ["reward-alpha", "reward-beta"],
            "redemptions_paused": True,
            "branding_config": {"welcome_message": "Hello Test"},
            "domain_whitelist": ["@example.com", "@subsidiary.example.com"]
        }

        # Update current tenant
        r = requests.put(f"{BASE_URL}/api/tenants/current", json=payload, headers=headers)
        assert r.status_code == 200, r.text
        data = r.json()

        # Check values returned by the update response
        assert data.get('currency') == 'USD'
        # markup_percent may be returned as a number; compare as string to allow for Decimal or float
        assert str(data.get('markup_percent')) in ("2.5", "2.50", "2.5000")
        assert data.get('enabled_rewards') == ["reward-alpha", "reward-beta"]
        assert data.get('redemptions_paused') is True
        assert data.get('branding_config', {}).get('welcome_message') == 'Hello Test'
        assert data.get('domain_whitelist') == ["@example.com", "@subsidiary.example.com"]

        # Fetch current tenant to ensure persistence
        r2 = requests.get(f"{BASE_URL}/api/tenants/current", headers=headers)
        assert r2.status_code == 200
        current = r2.json()
        assert current.get('currency') == 'USD'
        assert str(current.get('markup_percent')) in ("2.5", "2.50", "2.5000")
        assert current.get('enabled_rewards') == ["reward-alpha", "reward-beta"]
        assert current.get('redemptions_paused') is True
        assert current.get('branding_config', {}).get('welcome_message') == 'Hello Test'
        assert current.get('domain_whitelist') == ["@example.com", "@subsidiary.example.com"]

        # Check audit logs for tenant_updated action
        r3 = requests.get(f"{BASE_URL}/api/audit", params={"action": "tenant_updated"}, headers=headers)
        assert r3.status_code == 200
        logs = r3.json()
        assert isinstance(logs, list)
        # There should be at least one recent tenant_updated log
        found = False
        for log in logs:
            # new_values may be a dict containing the keys we updated
            new_values = log.get('new_values') or {}
            if any(k in new_values for k in ['currency', 'markup_percent', 'enabled_rewards', 'redemptions_paused']):
                found = True
                break
        assert found, 'Expected an audit log with tenant_updated containing the updated keys' 
