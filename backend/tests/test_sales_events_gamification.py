"""
Tests for the new gamified sales event functionality:
- creation with goal and reward fields
- progress increments, caps, and automated payout
- leaderboard ordering
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4
from fastapi.testclient import TestClient

# add path for imports
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from auth.utils import create_access_token
from models import SalesEvent, EventProgress, User, DepartmentBudget, Notification
from database import get_db

# fixtures from existing test suite can be reused if available

client = TestClient(app)

TENANT_ID = str(uuid4())
ADMIN_USER_ID = str(uuid4())
SALES_USER_ID = str(uuid4())
DEPT_ID = str(uuid4())

@pytest.fixture(autouse=True)
def setup(db):
    # create tables
    Base.metadata.create_all(bind=engine)
    d = db()
    # create tenant, dept, users
    t = Tenant(id=TENANT_ID, name="Test", slug="test", status="active")
    d.add(t)
    d.commit()
    dept = Department(id=DEPT_ID, tenant_id=TENANT_ID, name="Sales Dept")
    d.add(dept); d.commit()
    admin = User(id=ADMIN_USER_ID, tenant_id=TENANT_ID, corporate_email="admin@test.com", password_hash=get_password_hash("pass"), org_role="tenant_manager", department_id=DEPT_ID, status="ACTIVE")
    sales = User(id=SALES_USER_ID, tenant_id=TENANT_ID, corporate_email="sales@test.com", password_hash=get_password_hash("pass"), org_role="tenant_user", department_id=DEPT_ID, status="ACTIVE")
    d.add_all([admin, sales])
    # dept budget for reward payout
    dbudget = DepartmentBudget(dept_id=DEPT_ID, balance=10000)
    d.add(dbudget)
    d.commit()
    yield d
    Base.metadata.drop_all(bind=engine)


def token_for(user_id, email, org_role="tenant_manager"):
    data={"sub":user_id,"tenant_id":TENANT_ID,"email":email,"org_role":org_role,"type":"tenant"}
    return create_access_token(data)

class TestGamifiedSales:
    def test_create_gamified_event(self):
        token = token_for(ADMIN_USER_ID, "admin@test.com")
        payload={
            "name":"Deal Race",
            "event_type":"sales",
            "start_at":(datetime.utcnow()+timedelta(days=1)).isoformat(),
            "goal_metric":"deals_closed",
            "goal_value":5,
            "reward_points":100,
            "total_budget_cap":1000,
            "dept_id":DEPT_ID,
            "eligible_region_ids":["north"]
        }
        resp = client.post("/api/sales-events/", json=payload, headers={"Authorization":f"Bearer {token}"})
        assert resp.status_code == 200
        ev = resp.json()
        assert ev["goal_metric"] == "deals_closed"
        assert isinstance(ev.get("eligible_dept_ids"), list)
        assert DEPT_ID in ev.get("eligible_dept_ids")
        assert isinstance(ev.get("eligible_region_ids"), list)
        assert "north" in ev.get("eligible_region_ids")
        # invited lists empty by default
        assert ev.get("invited_user_ids") == []
        assert ev.get("invited_dept_ids") == []

    def test_invites_are_stored(self):
        token = token_for(ADMIN_USER_ID, "admin@test.com")
        payload={
            "name":"Invite Test",
            "event_type":"sales",
            "start_at":(datetime.utcnow()+timedelta(days=1)).isoformat(),
            "goal_metric":"deals_closed",
            "goal_value":2,
            "reward_points":20,
            "total_budget_cap":200,
            "dept_id":DEPT_ID,
            "eligible_region_ids":["north"],
            "invited_user_ids":[SALES_USER_ID],
            "invited_dept_ids":[DEPT_ID]
        }
        resp = client.post("/api/sales-events/", json=payload, headers={"Authorization":f"Bearer {token}"})
        assert resp.status_code == 200
        ev = resp.json()
        assert SALES_USER_ID in ev.get("invited_user_ids")
        assert DEPT_ID in ev.get("invited_dept_ids")

    def test_progress_and_leaderboard(self):
        # create event via ORM directly for speed
        d = get_db()
        ev = SalesEvent(
            id=str(uuid4()), tenant_id=TENANT_ID, dept_id=DEPT_ID,
            name="Race", event_type="sales", start_at=datetime.utcnow(),
            goal_metric="deals_closed", goal_value=3, reward_points=50,
            total_budget_cap=500, status="active",
            eligible_region_ids=['north'],
        )
        d.add(ev)
        d.commit()
        event_id=str(ev.id)
        token = token_for(ADMIN_USER_ID, "admin@test.com")
        # ensure eligible dept set on event and user region for eligibility
        ev.eligible_dept_ids = [DEPT_ID]
        d.commit()
        sales.region = 'north'
        d.commit()
        # registration with wrong department should fail
        resp = client.post(f"/api/sales-events/public/{event_id}/register", json={
            "full_name":"Joe", "email":"joe@test.com", "department_id":str(uuid4())
        })
        assert resp.status_code == 403
        # same department but wrong region should fail
        resp = client.post(f"/api/sales-events/public/{event_id}/register", json={
            "full_name":"Penny", "email":"penny@test.com", "department_id":DEPT_ID, "region":"south"
        })
        assert resp.status_code == 403
        # registration with correct department and region should succeed
        resp = client.post(f"/api/sales-events/public/{event_id}/register", json={
            "full_name":"Jane", "email":"jane@test.com", "department_id":DEPT_ID, "region":"north"
        })
        assert resp.status_code == 200

        # increment progress for user (eligible)
        resp = client.post(f"/api/sales-events/{event_id}/progress", json={"user_id":SALES_USER_ID,"increment":1}, headers={"Authorization":f"Bearer {token}"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["current_value"] == 1
        assert not data["rewarded"]
        # check notification when hitting 80%
        # after one more increment (total 3/5 -> 60%) no notification yet
        resp = client.post(f"/api/sales-events/{event_id}/progress", json={"user_id":SALES_USER_ID,"increment":1}, headers={"Authorization":f"Bearer {token}"})
        # add two more to cross 80%
        resp = client.post(f"/api/sales-events/{event_id}/progress", json={"user_id":SALES_USER_ID,"increment":2}, headers={"Authorization":f"Bearer {token}"})
        # check notif exists
        db_notif = d.query(Notification).filter(Notification.user_id==SALES_USER_ID, Notification.type=='progress_warning').first()
        assert db_notif is not None

        # negative: user from another department should be blocked
        other_user = User(id=str(uuid4()), tenant_id=TENANT_ID, corporate_email="other@test.com", password_hash=get_password_hash("pass"), org_role="tenant_user", department_id=str(uuid4()), status="ACTIVE")
        d.add(other_user)
        d.commit()
        resp = client.post(f"/api/sales-events/{event_id}/progress", json={"user_id":other_user.id,"increment":1}, headers={"Authorization":f"Bearer {token}"})
        assert resp.status_code == 403
        # assign same department but wrong region
        other_user.department_id = DEPT_ID
        other_user.region = "south"  # assume region field exists, add if not
        d.commit()
        resp = client.post(f"/api/sales-events/{event_id}/progress", json={"user_id":other_user.id,"increment":1}, headers={"Authorization":f"Bearer {token}"})
        assert resp.status_code == 403

        # now bring to goal
        resp = client.post(f"/api/sales-events/{event_id}/progress", json={"user_id":SALES_USER_ID,"increment":1}, headers={"Authorization":f"Bearer {token}"})
        assert resp.json()["rewarded"]
        # verify dept budget reduced and user wallet credited
        user = d.query(User).filter(User.id==SALES_USER_ID).first()
        assert user.wallet_balance >= 50
        dbal = d.query(DepartmentBudget).filter(DepartmentBudget.dept_id==DEPT_ID).first()
        assert dbal.balance <= 9950

        # leaderboard should list user at top
        resp = client.get(f"/api/sales-events/{event_id}/leaderboard", headers={"Authorization":f"Bearer {token}"})
        lb = resp.json()
        assert lb[0]["user_id"] == SALES_USER_ID
        assert lb[0]["current_value"] == 5
        assert "user_name" in lb[0]
        assert "avatar_url" in lb[0]
        d.close()
