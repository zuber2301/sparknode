"""
SNPilot Intent API — Structured Read-Only Endpoints
====================================================
11 endpoints across 3 personas: admin, manager, employee (me).

All endpoints are GET, read-only, and role-gated.
Prefix: /api/snpilot   (registered in main.py)

Persona guard helpers:
  _require_admin   → tenant_manager | platform_admin
  _require_manager → dept_lead | tenant_manager | platform_admin
  (me endpoints)   → any authenticated user
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta, date
from typing import List, Optional
from calendar import monthrange

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, and_

from auth.utils import get_current_user
from database import get_db
from models import (
    User, Department, Wallet, WalletLedger,
    Recognition, Redemption,
    Budget, DepartmentBudget,
    RewardCatalogMaster, RewardCatalogTenant,
    Voucher,
)

router = APIRouter(prefix="/snpilot", tags=["SNPilot Intents"])


# ─── helpers ───────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _period_range(period: str) -> tuple[datetime, datetime]:
    """Convert a period label into (start, end) UTC datetimes."""
    now = _now()
    if period == "month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_day = monthrange(now.year, now.month)[1]
        end = now.replace(day=last_day, hour=23, minute=59, second=59, microsecond=999999)
    elif period == "quarter":
        q_start_month = ((now.month - 1) // 3) * 3 + 1
        start = now.replace(month=q_start_month, day=1, hour=0, minute=0, second=0, microsecond=0)
        q_end_month = q_start_month + 2
        last_day = monthrange(now.year, q_end_month)[1]
        end = now.replace(month=q_end_month, day=last_day, hour=23, minute=59, second=59, microsecond=999999)
    elif period == "year":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end = now.replace(month=12, day=31, hour=23, minute=59, second=59, microsecond=999999)
    else:
        # default to month
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_day = monthrange(now.year, now.month)[1]
        end = now.replace(day=last_day, hour=23, minute=59, second=59, microsecond=999999)
    return start, end


def _period_label(period: str) -> str:
    now = _now()
    if period == "month":
        return now.strftime("%Y-%m")
    if period == "quarter":
        q = ((now.month - 1) // 3) + 1
        return f"{now.year}-Q{q}"
    if period == "year":
        return str(now.year)
    return now.strftime("%Y-%m")


def _require_admin(user: User) -> None:
    if user.org_role not in ("tenant_manager", "hr_admin", "platform_admin"):
        raise HTTPException(status_code=403, detail="Tenant admin access required.")


def _require_manager(user: User) -> None:
    if user.org_role not in ("dept_lead", "tenant_lead", "tenant_manager", "hr_admin", "platform_admin"):
        raise HTTPException(status_code=403, detail="Manager access required.")


# ══════════════════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS  (tenant_manager / platform_admin)
# ══════════════════════════════════════════════════════════════════════════

@router.get("/admin/budgets/top-departments")
def top_departments_by_utilization(
    period: str = Query("quarter", description="month | quarter | year"),
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Intent: "Show top departments by budget utilization this quarter."
    Returns departments ranked by % of allocated budget spent.
    """
    _require_admin(current_user)
    period_start, period_end = _period_range(period)

    rows = (
        db.query(Department, DepartmentBudget)
        .join(DepartmentBudget, DepartmentBudget.department_id == Department.id)
        .filter(
            Department.tenant_id == current_user.tenant_id,
            DepartmentBudget.allocated_points > 0,
        )
        .all()
    )

    results = []
    for dept, db_row in rows:
        alloc = float(db_row.allocated_points)
        spent = float(db_row.spent_points)
        utilization_pct = round(spent / alloc * 100, 1) if alloc > 0 else 0.0
        results.append({
            "department": dept.name,
            "budget_points": alloc,
            "used_points": spent,
            "remaining_points": round(alloc - spent, 2),
            "utilization_pct": utilization_pct,
        })

    results.sort(key=lambda x: x["utilization_pct"], reverse=True)
    return {
        "period": _period_label(period),
        "period_range": {"start": period_start.isoformat(), "end": period_end.isoformat()},
        "departments": results[:limit],
        "count": len(results[:limit]),
    }


@router.get("/admin/budgets/underutilized")
def underutilized_departments(
    period: str = Query("quarter", description="month | quarter | year"),
    threshold_pct: float = Query(40.0, ge=0, le=100, description="Utilization % ceiling"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Intent: "Which departments are using less than 40% of their budget this quarter?"
    """
    _require_admin(current_user)

    rows = (
        db.query(Department, DepartmentBudget)
        .join(DepartmentBudget, DepartmentBudget.department_id == Department.id)
        .filter(
            Department.tenant_id == current_user.tenant_id,
            DepartmentBudget.allocated_points > 0,
        )
        .all()
    )

    results = []
    for dept, db_row in rows:
        alloc = float(db_row.allocated_points)
        spent = float(db_row.spent_points)
        pct = round(spent / alloc * 100, 1) if alloc > 0 else 0.0
        if pct < threshold_pct:
            results.append({
                "department": dept.name,
                "budget_points": alloc,
                "used_points": spent,
                "remaining_points": round(alloc - spent, 2),
                "utilization_pct": pct,
            })

    results.sort(key=lambda x: x["utilization_pct"])
    return {
        "period": _period_label(period),
        "threshold_pct": threshold_pct,
        "departments": results,
        "count": len(results),
    }


@router.get("/admin/recognition/gaps")
def recognition_gaps_admin(
    days: int = Query(60, ge=1, le=365, description="Look-back window in days"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Intent: "Show employees who haven't been recognised in the last 60 days."
    """
    _require_admin(current_user)
    cutoff = _now() - timedelta(days=days)

    # All active non-platform employees in this tenant
    employees = (
        db.query(User)
        .filter(
            User.tenant_id == current_user.tenant_id,
            User.org_role.in_(["tenant_user", "dept_lead", "tenant_lead"]),
            User.status.in_(["ACTIVE", "active"]),
        )
        .all()
    )

    # Latest recognition timestamp per recipient
    latest_map: dict = {
        row[0]: row[1]
        for row in db.query(Recognition.to_user_id, func.max(Recognition.created_at))
        .filter(
            Recognition.tenant_id == current_user.tenant_id,
            Recognition.status == "active",
        )
        .group_by(Recognition.to_user_id)
        .all()
    }

    # Build department id → name cache lazily
    dept_cache: dict = {}

    def _dept_name(dept_id) -> str:
        if dept_id is None:
            return "—"
        key = str(dept_id)
        if key not in dept_cache:
            d = db.query(Department).filter(Department.id == dept_id).first()
            dept_cache[key] = d.name if d else "—"
        return dept_cache[key]

    results = []
    for u in employees:
        last_rec = latest_map.get(u.id)
        if last_rec is None or last_rec < cutoff:
            results.append({
                "employee_id": str(u.id),
                "name": f"{u.first_name} {u.last_name}",
                "department": _dept_name(u.department_id),
                "last_recognized_at": last_rec.isoformat() if last_rec else None,
            })

    return {
        "days": days,
        "cutoff": cutoff.isoformat(),
        "employees": results,
        "count": len(results),
        "total_active_employees": len(employees),
    }


@router.get("/admin/catalog/summary")
def catalog_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Intent: "What reward options are enabled for my company?"
    """
    _require_admin(current_user)

    # Enabled tenant catalog items joined to master
    enabled_rows = (
        db.query(RewardCatalogMaster)
        .join(
            RewardCatalogTenant,
            and_(
                RewardCatalogTenant.master_item_id == RewardCatalogMaster.id,
                RewardCatalogTenant.tenant_id == current_user.tenant_id,
                RewardCatalogTenant.is_enabled == True,
            ),
        )
        .filter(RewardCatalogMaster.is_active_global == True)
        .all()
    )

    by_category: dict[str, int] = {}
    brand_counts: dict[str, int] = {}

    for item in enabled_rows:
        cat = item.category or "Other"
        by_category[cat] = by_category.get(cat, 0) + 1
        brand_counts[item.brand] = brand_counts.get(item.brand, 0) + 1

    top_brands = sorted(brand_counts, key=lambda b: brand_counts[b], reverse=True)[:5]
    category_list = sorted(
        [{"category": k, "count": v} for k, v in by_category.items()],
        key=lambda x: x["count"],
        reverse=True,
    )

    return {
        "enabled_items_count": len(enabled_rows),
        "by_category": category_list,
        "top_brands": top_brands,
    }


# ══════════════════════════════════════════════════════════════════════════
# MANAGER ENDPOINTS  (dept_lead / tenant_manager / platform_admin)
# ══════════════════════════════════════════════════════════════════════════

@router.get("/manager/team-budget")
def team_budget(
    period: str = Query("month", description="month | quarter | year"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Intent: "What's my team budget and how much is left this month?"
    Returns the dept budget for the manager's own department.
    """
    _require_manager(current_user)

    dept_budget = (
        db.query(DepartmentBudget)
        .filter(DepartmentBudget.department_id == current_user.department_id)
        .order_by(desc(DepartmentBudget.created_at))
        .first()
    )

    if not dept_budget:
        return {
            "period": _period_label(period),
            "total_points": 0,
            "used_points": 0,
            "remaining_points": 0,
            "utilization_pct": 0.0,
        }

    total = float(dept_budget.allocated_points)
    used = float(dept_budget.spent_points)
    remaining = total - used
    utilization_pct = round(used / total * 100, 1) if total > 0 else 0.0

    return {
        "period": _period_label(period),
        "total_points": total,
        "used_points": used,
        "remaining_points": remaining,
        "utilization_pct": utilization_pct,
    }


@router.get("/manager/team-recognition")
def team_recognition_summary(
    period: str = Query("quarter", description="month | quarter | year"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Intent: "How many recognitions has my team given and received this quarter?"
    """
    _require_manager(current_user)
    period_start, period_end = _period_range(period)

    # Teammates in the same department
    team_members = (
        db.query(User)
        .filter(
            User.tenant_id == current_user.tenant_id,
            User.department_id == current_user.department_id,
            User.status.in_(["ACTIVE", "active"]),
        )
        .all()
    )
    team_ids = {u.id for u in team_members}

    # Recognitions given by team in period
    given_rows = (
        db.query(Recognition)
        .filter(
            Recognition.tenant_id == current_user.tenant_id,
            Recognition.from_user_id.in_(team_ids),
            Recognition.created_at >= period_start,
            Recognition.created_at <= period_end,
            Recognition.status == "active",
        )
        .all()
    )

    # Recognitions received by team in period
    received_rows = (
        db.query(Recognition)
        .filter(
            Recognition.tenant_id == current_user.tenant_id,
            Recognition.to_user_id.in_(team_ids),
            Recognition.created_at >= period_start,
            Recognition.created_at <= period_end,
            Recognition.status == "active",
        )
        .all()
    )

    # Per-member breakdown
    given_by_user: dict = {uid: 0 for uid in team_ids}
    for r in given_rows:
        given_by_user[r.from_user_id] = given_by_user.get(r.from_user_id, 0) + 1

    received_by_user: dict = {uid: 0 for uid in team_ids}
    for r in received_rows:
        received_by_user[r.to_user_id] = received_by_user.get(r.to_user_id, 0) + 1

    by_member = [
        {
            "user_id": str(u.id),
            "name": f"{u.first_name} {u.last_name}",
            "given": given_by_user.get(u.id, 0),
            "received": received_by_user.get(u.id, 0),
        }
        for u in team_members
    ]
    by_member.sort(key=lambda x: x["given"] + x["received"], reverse=True)

    return {
        "period": _period_label(period),
        "given_count": len(given_rows),
        "received_count": len(received_rows),
        "by_member": by_member,
    }


@router.get("/manager/recognition-gaps")
def team_recognition_gaps(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Intent: "Who on my team hasn't been recognised in the last 30 days?"
    """
    _require_manager(current_user)
    cutoff = _now() - timedelta(days=days)

    team_members = (
        db.query(User)
        .filter(
            User.tenant_id == current_user.tenant_id,
            User.department_id == current_user.department_id,
            User.status.in_(["ACTIVE", "active"]),
        )
        .all()
    )

    latest_map: dict = {
        row[0]: row[1]
        for row in db.query(Recognition.to_user_id, func.max(Recognition.created_at))
        .filter(
            Recognition.tenant_id == current_user.tenant_id,
            Recognition.to_user_id.in_({u.id for u in team_members}),
            Recognition.status == "active",
        )
        .group_by(Recognition.to_user_id)
        .all()
    }

    results = []
    for u in team_members:
        last_rec = latest_map.get(u.id)
        if last_rec is None or last_rec < cutoff:
            since_days = (
                (_now() - last_rec).days if last_rec else None
            )
            results.append({
                "user_id": str(u.id),
                "name": f"{u.first_name} {u.last_name}",
                "days_since_last": since_days,
                "last_recognized_at": last_rec.isoformat() if last_rec else None,
            })

    results.sort(key=lambda x: (x["days_since_last"] is None, -(x["days_since_last"] or 0)))
    return {
        "days": days,
        "gaps": results,
        "count": len(results),
    }


# ══════════════════════════════════════════════════════════════════════════
# EMPLOYEE (ME) ENDPOINTS  — any authenticated user
# ══════════════════════════════════════════════════════════════════════════

@router.get("/me/wallet-expiry")
def my_wallet_expiry(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Intent: "When are my points expiring?"
    """
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).first()
    balance = float(wallet.balance) if wallet else 0.0

    # Collect upcoming expiry blocks from dept budgets linked to the user's dept
    today = _now().date()
    dept_budgets = (
        db.query(DepartmentBudget)
        .filter(
            DepartmentBudget.department_id == current_user.department_id,
            DepartmentBudget.expiry_date != None,
            DepartmentBudget.expiry_date >= today,
        )
        .order_by(DepartmentBudget.expiry_date)
        .all()
    )

    expiring_blocks = []
    for db_row in dept_budgets:
        remaining = max(0.0, float(db_row.allocated_points) - float(db_row.spent_points))
        if remaining > 0:
            expiring_blocks.append({
                "points": remaining,
                "expires_on": str(db_row.expiry_date),
            })

    return {
        "balance_points": balance,
        "expiring_blocks": expiring_blocks,
    }


@router.get("/me/catalog-options")
def my_catalog_options(
    points: int = Query(500, ge=1, description="Maximum points budget"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Intent: "What can I buy with 500 points?"
    """
    rows = (
        db.query(RewardCatalogMaster, RewardCatalogTenant)
        .join(
            RewardCatalogTenant,
            and_(
                RewardCatalogTenant.master_item_id == RewardCatalogMaster.id,
                RewardCatalogTenant.tenant_id == current_user.tenant_id,
                RewardCatalogTenant.is_enabled == True,
            ),
        )
        .filter(
            RewardCatalogMaster.is_active_global == True,
            func.coalesce(
                RewardCatalogTenant.custom_min_points,
                RewardCatalogMaster.min_points,
            ) <= points,
        )
        .order_by(
            func.coalesce(
                RewardCatalogTenant.custom_min_points,
                RewardCatalogMaster.min_points,
            )
        )
        .limit(20)
        .all()
    )

    items = []
    for master, tenant_row in rows:
        eff_min = int(tenant_row.custom_min_points or master.min_points)
        items.append({
            "id": str(master.id),
            "brand": master.brand,
            "name": master.name,
            "min_points": eff_min,
            "category": master.category,
        })

    return {
        "points": points,
        "items": items,
        "count": len(items),
    }


@router.get("/me/recognitions")
def my_recognitions(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Intent: "Show my last 10 recognitions."
    """
    # Received
    received_rows = (
        db.query(Recognition, User)
        .join(User, User.id == Recognition.from_user_id)
        .filter(
            Recognition.to_user_id == current_user.id,
            Recognition.tenant_id == current_user.tenant_id,
            Recognition.status == "active",
        )
        .order_by(desc(Recognition.created_at))
        .limit(limit)
        .all()
    )

    # Given
    given_rows = (
        db.query(Recognition, User)
        .join(User, User.id == Recognition.to_user_id)
        .filter(
            Recognition.from_user_id == current_user.id,
            Recognition.tenant_id == current_user.tenant_id,
            Recognition.status == "active",
        )
        .order_by(desc(Recognition.created_at))
        .limit(limit)
        .all()
    )

    return {
        "received": [
            {
                "id": str(r.id),
                "from": f"{u.first_name} {u.last_name}",
                "type": r.recognition_type or "standard",
                "points": float(r.points),
                "message": r.message[:120] if r.message else "",
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r, u in received_rows
        ],
        "given": [
            {
                "id": str(r.id),
                "to": f"{u.first_name} {u.last_name}",
                "type": r.recognition_type or "standard",
                "points": float(r.points),
                "message": r.message[:120] if r.message else "",
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r, u in given_rows
        ],
    }


@router.get("/me/redemptions")
def my_redemptions(
    months: int = Query(6, ge=1, le=24, description="Look-back window in months"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Intent: "Show what I redeemed in the last 6 months."
    """
    cutoff = _now() - timedelta(days=months * 30)

    rows = (
        db.query(Redemption, Voucher)
        .join(Voucher, Voucher.id == Redemption.voucher_id)
        .filter(
            Redemption.user_id == current_user.id,
            Redemption.tenant_id == current_user.tenant_id,
            Redemption.created_at >= cutoff,
        )
        .order_by(desc(Redemption.created_at))
        .all()
    )

    return [
        {
            "id": str(r.id),
            "brand": v.brand.name if v.brand else "—",
            "item": v.name,
            "points_spent": float(r.points_used),
            "status": r.status,
            "redeemed_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r, v in rows
    ]
