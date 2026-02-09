import requests
import uuid
from sqlalchemy import text
from database import engine

BASE_URL = "http://localhost:7100/api"
TENANT_A = '100e8400-e29b-41d4-a716-446655440000'  # jSpark
TENANT_B = '100e8400-e29b-41d4-a716-446655440010'  # Triton


import pytest


@pytest.fixture
def admin_token():
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": "super_user@sparknode.io", "password": "jspark123"})
    assert resp.status_code == 200, f"Admin login failed: {resp.status_code} {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture
def tenant_tenant_tenant_manager_token():
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": "tenant_tenant_tenant_manager@sparknode.io", "password": "jspark123"})
    assert resp.status_code == 200, f"Tenant tenant_tenant_manager login failed: {resp.status_code} {resp.text}"
    return resp.json()["access_token"]


def create_dept_in_db(tenant_id: str, name: str):
    department_id = str(uuid.uuid4())
    with engine.connect() as conn:
        conn.execute(text(
            "INSERT INTO departments (id, tenant_id, name, budget_balance) VALUES (:id, :tid, :name, 0) ON CONFLICT (tenant_id, name) DO NOTHING"
        ), {"id": department_id, "tid": tenant_id, "name": name})
    return department_id


def test_tenant_tenant_tenant_manager_cannot_access_other_tenant_department(admin_token, tenant_tenant_tenant_manager_token):
    # Create a department for TENANT_B directly in DB
    dept_name = f"CrossTenantDept_{uuid.uuid4().hex[:6]}"
    department_id = create_dept_in_db(TENANT_B, dept_name)

    headers_tm = {"Authorization": f"Bearer {tenant_tenant_tenant_manager_token}"}

    # Tenant tenant_tenant_manager from TENANT_A tries to GET the department by id -> expect 404
    r = requests.get(f"{BASE_URL}/tenants/departments/{department_id}", headers=headers_tm)
    assert r.status_code == 404, f"Expected 404 when tenant tenant_tenant_manager accesses other tenant dept, got {r.status_code} - {r.text}"

    # Tenant tenant_tenant_manager tries to update -> expect 404
    r = requests.put(f"{BASE_URL}/tenants/departments/{department_id}", json={"name":"UpdatedName"}, headers=headers_tm)
    assert r.status_code == 404, f"Expected 404 on update of other tenant dept, got {r.status_code} - {r.text}"

    # Tenant tenant_tenant_manager tries to delete -> expect 404
    r = requests.delete(f"{BASE_URL}/tenants/departments/{department_id}", headers=headers_tm)
    assert r.status_code == 404, f"Expected 404 on delete of other tenant dept, got {r.status_code} - {r.text}"


def test_platform_admin_can_list_other_tenant_departments(admin_token):
    headers_admin = {"Authorization": f"Bearer {admin_token}", "X-Tenant-ID": TENANT_B}

    r = requests.get(f"{BASE_URL}/tenants/departments", headers=headers_admin)
    assert r.status_code == 200, f"Platform admin should be able to list departments for other tenant, got {r.status_code} - {r.text}"
    depts = r.json()
    assert isinstance(depts, list)
    # At least one department exists for TENANT_B (seed data)
    assert len(depts) > 0
