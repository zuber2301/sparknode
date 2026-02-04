import requests

# Test tenant manager login and tenant current API
BASE_URL = "http://localhost:8000/api"

def test_tenant_budget():
    # Login as tenant manager
    login_data = {
        "email": "tenant_admin@sparknode.io",
        "password": "jspark123"
    }

    login_response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
    if login_response.status_code != 200:
        print(f"Login failed: {login_response.status_code} - {login_response.text}")
        return

    token = login_response.json()["access_token"]
    print(f"Login successful, token: {token[:50]}...")

    # Get tenant current
    headers = {"Authorization": f"Bearer {token}"}
    tenant_response = requests.get(f"{BASE_URL}/tenants/current", headers=headers)

    if tenant_response.status_code != 200:
        print(f"Tenant API failed: {tenant_response.status_code} - {tenant_response.text}")
        return

    tenant_data = tenant_response.json()
    print("Tenant data:")
    print(f"  Name: {tenant_data['name']}")
    print(f"  Budget Allocated: {tenant_data.get('budget_allocated', 'N/A')}")
    print(f"  Budget Allocation Balance: {tenant_data.get('budget_allocation_balance', 'N/A')}")

if __name__ == "__main__":
    test_tenant_budget()