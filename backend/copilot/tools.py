"""
SNPilot Read-Only Tools
=======================
Pure SELECT query handlers – never mutate any data.

Each tool returns a dict: {"ok": True, "data": {...}} or {"ok": False, "error": "..."}
Role guards are enforced here; callers do not need to pre-check roles.
"""

from __future__ import annotations
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_

from models import (
    User, Tenant, Department,
    Wallet, WalletLedger,
    Recognition,
    Redemption,
    Budget, DepartmentBudget,
    RewardCatalogMaster, RewardCatalogTenant,
)


# ─── helpers ───────────────────────────────────────────────────────────────

def _is_manager(user: User) -> bool:
    return user.org_role in ("tenant_manager", "hr_admin", "platform_admin")


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ─── tools ─────────────────────────────────────────────────────────────────

def tool_wallet_balance(user: User, db: Session, **_) -> dict:
    """Current points balance + lifetime stats."""
    wallet = db.query(Wallet).filter(Wallet.user_id == user.id).first()
    if not wallet:
        return {"ok": True, "data": {"balance": 0, "lifetime_earned": 0, "lifetime_spent": 0}}
    return {
        "ok": True,
        "data": {
            "balance": float(wallet.balance),
            "lifetime_earned": float(wallet.lifetime_earned),
            "lifetime_spent": float(wallet.lifetime_spent),
        },
    }


def tool_points_expiry(user: User, db: Session, **_) -> dict:
    """Points expiry info based on tenant policy + next expiring credit."""
    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    policy = (tenant.expiry_policy if tenant else "never") or "never"

    policy_labels = {
        "never": "Your points never expire.",
        "90_days": "Points expire 90 days after they are credited.",
        "1_year": "Points expire 1 year after they are credited.",
        "custom": "Your organisation uses a custom expiry schedule – contact your tenant admin.",
    }
    label = policy_labels.get(policy, f"Expiry policy: {policy}")

    # Find next expiry from the user's departmental budget allocation
    now = _now().date()
    dept_budget = (
        db.query(DepartmentBudget)
        .filter(
            DepartmentBudget.department_id == user.department_id,
            DepartmentBudget.expiry_date != None,
            DepartmentBudget.expiry_date >= now,
        )
        .order_by(DepartmentBudget.expiry_date)
        .first()
    )

    next_expiry = None
    if dept_budget and dept_budget.expiry_date:
        remaining = float(dept_budget.allocated_points) - float(dept_budget.spent_points)
        next_expiry = {
            "type": "department_budget",
            "date": str(dept_budget.expiry_date),
            "points_at_risk": max(0.0, remaining),
        }

    return {
        "ok": True,
        "data": {
            "policy": policy,
            "policy_description": label,
            "next_expiry": next_expiry,
        },
    }


def tool_catalog_by_points(user: User, db: Session, max_points: int = 500, **_) -> dict:
    """Catalog items redeemable within a given points budget."""
    rows = (
        db.query(
            RewardCatalogMaster,
            RewardCatalogTenant.custom_min_points,
            RewardCatalogTenant.custom_max_points,
        )
        .join(
            RewardCatalogTenant,
            and_(
                RewardCatalogTenant.master_item_id == RewardCatalogMaster.id,
                RewardCatalogTenant.tenant_id == user.tenant_id,
                RewardCatalogTenant.is_enabled == True,
            ),
        )
        .filter(
            RewardCatalogMaster.is_active_global == True,
            func.coalesce(
                RewardCatalogTenant.custom_min_points, RewardCatalogMaster.min_points
            ) <= max_points,
        )
        .order_by(
            func.coalesce(RewardCatalogTenant.custom_min_points, RewardCatalogMaster.min_points)
        )
        .limit(10)
        .all()
    )

    items = []
    for master, cmin, cmax in rows:
        eff_min = int(cmin or master.min_points)
        eff_max = int(cmax or master.max_points)
        items.append({
            "name": master.name,
            "brand": master.brand,
            "category": master.category,
            "min_points": eff_min,
            "max_points": eff_max,
        })

    return {
        "ok": True,
        "data": {
            "max_points_filter": max_points,
            "items": items,
            "count": len(items),
        },
    }


def tool_recent_redemptions(user: User, db: Session, limit: int = 10, **_) -> dict:
    """Last N redemptions for this user."""
    rows = (
        db.query(Redemption)
        .filter(Redemption.user_id == user.id, Redemption.tenant_id == user.tenant_id)
        .order_by(desc(Redemption.created_at))
        .limit(limit)
        .all()
    )
    items = [
        {
            "status": r.status,
            "points_used": float(r.points_used),
            "reward_type": r.reward_type,
            "created_at": r.created_at.strftime("%d %b %Y") if r.created_at else None,
        }
        for r in rows
    ]
    return {"ok": True, "data": {"redemptions": items, "count": len(items)}}


def tool_my_recognitions(user: User, db: Session, limit: int = 10, **_) -> dict:
    """Recent recognitions received AND given by this user."""
    received = (
        db.query(Recognition, User)
        .join(User, User.id == Recognition.from_user_id)
        .filter(Recognition.to_user_id == user.id, Recognition.tenant_id == user.tenant_id)
        .order_by(desc(Recognition.created_at))
        .limit(limit)
        .all()
    )
    given = (
        db.query(Recognition, User)
        .join(User, User.id == Recognition.to_user_id)
        .filter(Recognition.from_user_id == user.id, Recognition.tenant_id == user.tenant_id)
        .order_by(desc(Recognition.created_at))
        .limit(limit)
        .all()
    )

    def _fmt(r: Recognition, other: User) -> dict:
        return {
            "other_name": f"{other.first_name} {other.last_name}",
            "points": float(r.points),
            "message": r.message[:80] + "…" if len(r.message) > 80 else r.message,
            "date": r.created_at.strftime("%d %b %Y") if r.created_at else None,
        }

    return {
        "ok": True,
        "data": {
            "received": [_fmt(r, u) for r, u in received],
            "given": [_fmt(r, u) for r, u in given],
        },
    }


# ── manager / admin tools ──────────────────────────────────────────────────

def tool_department_budgets(user: User, db: Session, top_n: int = 5, **_) -> dict:
    """Top N departments by allocated budget (manager+ only)."""
    if not _is_manager(user):
        return {"ok": False, "error": "Only managers can view department budgets."}

    rows = (
        db.query(Department, DepartmentBudget)
        .join(DepartmentBudget, DepartmentBudget.department_id == Department.id)
        .filter(Department.tenant_id == user.tenant_id)
        .order_by(desc(DepartmentBudget.allocated_points))
        .limit(top_n)
        .all()
    )

    items = [
        {
            "department": dept.name,
            "allocated": float(db_row.allocated_points),
            "spent": float(db_row.spent_points),
            "remaining": float(db_row.allocated_points) - float(db_row.spent_points),
            "utilization_pct": round(
                float(db_row.spent_points) / float(db_row.allocated_points) * 100
                if float(db_row.allocated_points) > 0 else 0, 1
            ),
        }
        for dept, db_row in rows
    ]
    return {"ok": True, "data": {"departments": items, "count": len(items)}}


def tool_under_utilized_budgets(user: User, db: Session, threshold_pct: float = 30.0, **_) -> dict:
    """Departments that have utilised less than threshold% of their budget (manager+ only)."""
    if not _is_manager(user):
        return {"ok": False, "error": "Only managers can view budget utilization."}

    rows = (
        db.query(Department, DepartmentBudget)
        .join(DepartmentBudget, DepartmentBudget.department_id == Department.id)
        .filter(
            Department.tenant_id == user.tenant_id,
            DepartmentBudget.allocated_points > 0,
        )
        .all()
    )

    items = []
    for dept, db_row in rows:
        alloc = float(db_row.allocated_points)
        spent = float(db_row.spent_points)
        pct = round(spent / alloc * 100 if alloc > 0 else 0, 1)
        if pct < threshold_pct:
            items.append({
                "department": dept.name,
                "allocated": alloc,
                "spent": spent,
                "utilization_pct": pct,
                "remaining": alloc - spent,
            })

    items.sort(key=lambda x: x["utilization_pct"])
    return {
        "ok": True,
        "data": {
            "threshold_pct": threshold_pct,
            "departments": items[:10],
            "count": len(items),
        },
    }


def tool_unrecognized_employees(user: User, db: Session, days: int = 60, **_) -> dict:
    """Employees who haven't received any recognition in the last N days (manager+ only)."""
    if not _is_manager(user):
        return {"ok": False, "error": "Only managers can view this."}

    cutoff = _now() - timedelta(days=days)

    # Users in tenant who are not platform admin
    all_employees = (
        db.query(User)
        .filter(
            User.tenant_id == user.tenant_id,
            User.org_role.in_(["tenant_user", "dept_lead", "tenant_lead"]),
            User.status.in_(["ACTIVE", "active"]),
        )
        .all()
    )

    # Users who DID receive recognition recently
    recently_recognised_ids = set(
        row[0]
        for row in db.query(Recognition.to_user_id)
        .filter(
            Recognition.tenant_id == user.tenant_id,
            Recognition.created_at >= cutoff,
            Recognition.status == "active",
        )
        .distinct()
        .all()
    )

    not_recognised = [
        {
            "name": f"{u.first_name} {u.last_name}",
            "department_id": str(u.department_id) if u.department_id else None,
            "role": u.org_role,
        }
        for u in all_employees
        if u.id not in recently_recognised_ids
    ]

    # Resolve dept names for first 15 results
    dept_cache: dict[str, str] = {}
    for item in not_recognised[:15]:
        did = item.get("department_id")
        if did and did not in dept_cache:
            dept = db.query(Department).filter(Department.id == did).first()
            dept_cache[did] = dept.name if dept else did
        item["department"] = dept_cache.get(did or "", "—")

    return {
        "ok": True,
        "data": {
            "days": days,
            "employees": not_recognised[:15],
            "total_count": len(not_recognised),
            "total_employees": len(all_employees),
        },
    }


def tool_recognition_stats(user: User, db: Session, days: int = 30, **_) -> dict:
    """Recognition counts by department for last N days (manager+ only)."""
    if not _is_manager(user):
        return {"ok": False, "error": "Only managers can view org-wide recognition stats."}

    cutoff = _now() - timedelta(days=days)

    # Count recognitions per recipient department
    rows = (
        db.query(Department.name, func.count(Recognition.id).label("count"))
        .join(User, User.id == Recognition.to_user_id)
        .join(Department, Department.id == User.department_id)
        .filter(
            Recognition.tenant_id == user.tenant_id,
            Recognition.created_at >= cutoff,
            Recognition.status == "active",
        )
        .group_by(Department.name)
        .order_by(desc("count"))
        .all()
    )

    total = sum(r.count for r in rows)
    return {
        "ok": True,
        "data": {
            "period_days": days,
            "total_recognitions": total,
            "by_department": [
                {"department": r.name, "count": r.count}
                for r in rows
            ],
        },
    }


# ─── intent detection ──────────────────────────────────────────────────────

_INTENT_MAP = [
    # (pattern, tool_name, param_extractor)
    (r"\bexpir", "points_expiry", {}),
    (r"\bwhen.*point|point.*expir|point.*last|point.*expire",  "points_expiry", {}),
    (r"\bbalance\b|\bhow many points\b|\bmy points\b|\bwhat.*points\b", "wallet_balance", {}),
    (r"\b(buy|redeem|get|afford|purchase|spend).*?(\d[\d,]*)\s*points?",
     "catalog_by_points", {"group": 2, "key": "max_points", "cast": int}),
    (r"(\d[\d,]*)\s*points?.*(buy|redeem|get|afford|purchase|spend)",
     "catalog_by_points", {"group": 1, "key": "max_points", "cast": int}),
    (r"what can i (buy|get|redeem|afford)", "catalog_by_points", {}),
    (r"\bredemption|redeemed|last.*redeem|recent.*redeem|show.*redeem", "recent_redemptions", {}),
    (r"\brecog.*i received|received.*recog|who.*recognised.*me|recogni.*me", "my_recognitions", {}),
    (r"\bi.*recogni|recogni.*i.*gave|sent.*recogni|given.*recogni", "my_recognitions", {}),
    (r"\btop.*dep|dep.*budget|dep.*highest|highest.*dep|dep.*top", "department_budgets", {}),
    (r"\bdep.*utiliz|under.utiliz|unused.*budget|budget.*unused|low.*utiliz", "under_utilized_budgets", {}),
    (r"\bnot.*recogni|without.*recogni|missed.*recogni|no.*recogni.*(\d+).*day", "unrecognized_employees", {}),
    (r"\bunrecogni|haven.t.*recogni|haven't.*recogni|employees.*recogni", "unrecognized_employees", {}),
    (r"\brecog.*stat|how many recog|recog.*count|recog.*last.*month|department.*sent", "recognition_stats", {}),
]


def detect_intent(message: str) -> tuple[str | None, dict]:
    """Return (tool_name, params) or (None, {}) if no tool matched."""
    msg = message.lower()
    for pattern, tool_name, param_spec in _INTENT_MAP:
        m = re.search(pattern, msg)
        if m:
            params: dict[str, Any] = {}
            if "group" in param_spec and "key" in param_spec:
                try:
                    grp = m.group(param_spec["group"])
                    val = re.sub(r"[,\s]", "", grp)
                    params[param_spec["key"]] = param_spec["cast"](val)
                except Exception:
                    pass
            # Extract day count from messages like "last 60 days" / "past 90 days"
            if m2 := re.search(r"(\d+)\s*day", msg):
                days_val = int(m2.group(1))
                if tool_name in ("unrecognized_employees", "recognition_stats"):
                    params["days"] = days_val
            return tool_name, params
    return None, {}


_TOOL_REGISTRY = {
    "wallet_balance": tool_wallet_balance,
    "points_expiry": tool_points_expiry,
    "catalog_by_points": tool_catalog_by_points,
    "recent_redemptions": tool_recent_redemptions,
    "my_recognitions": tool_my_recognitions,
    "department_budgets": tool_department_budgets,
    "under_utilized_budgets": tool_under_utilized_budgets,
    "unrecognized_employees": tool_unrecognized_employees,
    "recognition_stats": tool_recognition_stats,
}


def dispatch_tool(tool_name: str, params: dict, user: User, db: Session) -> dict:
    fn = _TOOL_REGISTRY.get(tool_name)
    if not fn:
        return {"ok": False, "error": f"Unknown tool: {tool_name}"}
    try:
        return fn(user=user, db=db, **params)
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def format_tool_result_as_text(tool_name: str, result: dict, user: User) -> str:
    """Fallback formatter — used when no LLM is configured."""
    if not result.get("ok"):
        return f"Sorry, I couldn't retrieve that data: {result.get('error', 'unknown error')}"

    d = result["data"]

    if tool_name == "wallet_balance":
        return (
            f"Your current points balance is **{d['balance']:,.0f} pts**.\n"
            f"Lifetime earned: {d['lifetime_earned']:,.0f} | Lifetime spent: {d['lifetime_spent']:,.0f}"
        )

    if tool_name == "points_expiry":
        base = d["policy_description"]
        if d.get("next_expiry"):
            ne = d["next_expiry"]
            base += f"\n\nNext expiry: **{ne['date']}** — {ne['points_at_risk']:,.0f} pts at risk."
        return base

    if tool_name == "catalog_by_points":
        if not d["items"]:
            return f"Sorry, I didn't find any catalogue items available for {d['max_points_filter']:,} points."
        lines = [f"Here's what you can get with up to **{d['max_points_filter']:,} pts**:\n"]
        for item in d["items"]:
            lines.append(f"• **{item['brand']} – {item['name']}** ({item['category']}) from {item['min_points']:,} pts")
        return "\n".join(lines)

    if tool_name == "recent_redemptions":
        if not d["redemptions"]:
            return "You haven't made any redemptions yet."
        lines = [f"Your last {d['count']} redemptions:\n"]
        for r in d["redemptions"]:
            lines.append(f"• {r['created_at']} — {r['reward_type']}, {r['points_used']:,.0f} pts ({r['status']})")
        return "\n".join(lines)

    if tool_name == "my_recognitions":
        lines = []
        if d["received"]:
            lines.append(f"**Recognitions you've received (last {len(d['received'])}):**")
            for r in d["received"]:
                msg = r['message']
                lines.append(
                    f"• From {r['other_name']} on {r['date']}"
                    f" — {r['points']:,.0f} pts: \"{msg}\""
                )
        if d["given"]:
            lines.append(f"\n**Recognitions you've given (last {len(d['given'])}):**")
            for r in d["given"]:
                lines.append(f"• To {r['other_name']} on {r['date']} — {r['points']:,.0f} pts")
        return "\n".join(lines) if lines else "No recognitions found."

    if tool_name == "department_budgets":
        if not d["departments"]:
            return "No department budget data found."
        lines = [f"Top {d['count']} departments by allocated budget:\n"]
        for i, dept in enumerate(d["departments"], 1):
            lines.append(
                f"{i}. **{dept['department']}** — {dept['allocated']:,.0f} allocated, "
                f"{dept['spent']:,.0f} spent ({dept['utilization_pct']}% used)"
            )
        return "\n".join(lines)

    if tool_name == "under_utilized_budgets":
        if not d["departments"]:
            return f"All departments have utilised more than {d['threshold_pct']}% of their budget. Great adoption!"
        lines = [f"Departments using less than {d['threshold_pct']}% of budget ({d['count']} found):\n"]
        for dept in d["departments"]:
            lines.append(
                f"• **{dept['department']}** — {dept['utilization_pct']}% used, "
                f"{dept['remaining']:,.0f} pts remaining"
            )
        return "\n".join(lines)

    if tool_name == "unrecognized_employees":
        total = d["total_count"]
        if total == 0:
            return f"Great news! Everyone has been recognised in the last {d['days']} days."
        lines = [
            f"**{total} out of {d['total_employees']} employees** haven't been recognised in the last {d['days']} days.\n",
            "Sample (first 15):",
        ]
        for emp in d["employees"]:
            lines.append(f"• {emp['name']} ({emp.get('department', '—')})")
        return "\n".join(lines)

    if tool_name == "recognition_stats":
        total = d["total_recognitions"]
        lines = [f"**{total} recognitions** in the last {d['period_days']} days:\n"]
        for dept in d["by_department"][:10]:
            lines.append(f"• {dept['department']}: {dept['count']} recognitions")
        return "\n".join(lines)

    return str(d)
