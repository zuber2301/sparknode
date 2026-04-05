"""
Platform Admin - Budget Alert Routes

Routes for managing budget alerts:
1. CRUD for alert rules (configurable thresholds)
2. Check budget health and get current alerts
3. View / acknowledge / resolve fired alerts
4. Manually trigger check-and-notify
5. View alert history (audit log)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from decimal import Decimal

from database import get_db
from models import (
    Tenant, AuditLog, User,
    BudgetAlertRule as BudgetAlertRuleModel,
    BudgetAlert as BudgetAlertModel,
)
from auth.utils import get_current_user
from core.rbac import get_platform_admin
from core.budget_alert_service import (
    BudgetAlertService,
    BudgetAlertEvent,
    BudgetAlertRule,
    AlertLevel,
)

router = APIRouter(prefix="/api/platform/alerts", tags=["platform-budget-alerts"])


# =====================================================
# SCHEMAS
# =====================================================

class AlertRuleCreateRequest(BaseModel):
    tenant_id: Optional[UUID] = None  # None = global rule
    name: str = Field(..., min_length=1, max_length=200)
    alert_level: str = Field(..., pattern="^(warning|critical|emergency)$")
    threshold_percent: float = Field(..., gt=0, le=100)
    email_recipients: List[str] = []
    notify_in_app: bool = True
    notify_email: bool = True
    hard_limit: bool = False
    cooldown_minutes: int = Field(default=1440, ge=1)
    description: Optional[str] = None


class AlertRuleUpdateRequest(BaseModel):
    name: Optional[str] = None
    alert_level: Optional[str] = Field(None, pattern="^(warning|critical|emergency)$")
    threshold_percent: Optional[float] = Field(None, gt=0, le=100)
    email_recipients: Optional[List[str]] = None
    notify_in_app: Optional[bool] = None
    notify_email: Optional[bool] = None
    hard_limit: Optional[bool] = None
    cooldown_minutes: Optional[int] = Field(None, ge=1)
    is_active: Optional[bool] = None
    description: Optional[str] = None


class AlertRuleResponse(BaseModel):
    id: str
    tenant_id: Optional[str]
    tenant_name: Optional[str] = None
    name: str
    alert_level: str
    threshold_percent: float
    email_recipients: list
    notify_in_app: bool
    notify_email: bool
    hard_limit: bool
    cooldown_minutes: int
    is_active: bool
    description: Optional[str]
    created_at: str


class FiredAlertResponse(BaseModel):
    id: str
    rule_id: Optional[str]
    tenant_id: str
    tenant_name: str
    alert_level: str
    threshold_percent: float
    remaining_percent: float
    remaining_budget: float
    total_budget: float
    message: str
    status: str
    email_sent: bool
    notification_created: bool
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[str] = None
    resolved_at: Optional[str] = None
    triggered_at: str


class AlertResponse(BaseModel):
    """Backward-compatible health-check response"""
    tenant_id: str
    tenant_name: str
    alert_level: str
    unallocated_budget: float
    unallocated_percent: float
    total_budget: float
    message: str
    triggered_at: str


class AlertHistoryResponse(BaseModel):
    id: str
    entity_id: str
    tenant_name: str
    action: str
    alert_level: str
    unallocated_budget: float
    unallocated_percent: float
    created_at: str


# =====================================================
# ALERT RULES CRUD
# =====================================================

@router.post("/rules", response_model=AlertRuleResponse, status_code=201)
async def create_alert_rule(
    rule: AlertRuleCreateRequest,
    current_user=Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """Create a new budget alert rule."""
    # Validate tenant exists if specified
    tenant_name = None
    if rule.tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == rule.tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")
        tenant_name = tenant.name

    db_rule = BudgetAlertRuleModel(
        tenant_id=rule.tenant_id,
        name=rule.name,
        alert_level=rule.alert_level,
        threshold_percent=Decimal(str(rule.threshold_percent)),
        email_recipients=rule.email_recipients,
        notify_in_app=rule.notify_in_app,
        notify_email=rule.notify_email,
        hard_limit=rule.hard_limit,
        cooldown_minutes=rule.cooldown_minutes,
        description=rule.description,
        created_by=current_user.id,
    )
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)

    return _rule_to_response(db_rule, tenant_name)


@router.get("/rules", response_model=List[AlertRuleResponse])
async def list_alert_rules(
    tenant_id: Optional[UUID] = None,
    active_only: bool = False,
    current_user=Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """List all alert rules, optionally filtered by tenant or active status."""
    query = db.query(BudgetAlertRuleModel)
    if tenant_id:
        query = query.filter(BudgetAlertRuleModel.tenant_id == tenant_id)
    if active_only:
        query = query.filter(BudgetAlertRuleModel.is_active == True)
    rules = query.order_by(BudgetAlertRuleModel.threshold_percent.asc()).all()

    # Preload tenant names
    tenant_ids = {r.tenant_id for r in rules if r.tenant_id}
    tenant_map = {}
    if tenant_ids:
        tenants = db.query(Tenant).filter(Tenant.id.in_(tenant_ids)).all()
        tenant_map = {t.id: t.name for t in tenants}

    return [_rule_to_response(r, tenant_map.get(r.tenant_id)) for r in rules]


@router.get("/rules/{rule_id}", response_model=AlertRuleResponse)
async def get_alert_rule(
    rule_id: UUID,
    current_user=Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """Get a single alert rule by ID."""
    rule = db.query(BudgetAlertRuleModel).filter(BudgetAlertRuleModel.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    tenant_name = None
    if rule.tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == rule.tenant_id).first()
        tenant_name = tenant.name if tenant else None
    return _rule_to_response(rule, tenant_name)


@router.patch("/rules/{rule_id}", response_model=AlertRuleResponse)
async def update_alert_rule(
    rule_id: UUID,
    updates: AlertRuleUpdateRequest,
    current_user=Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """Update an existing alert rule."""
    rule = db.query(BudgetAlertRuleModel).filter(BudgetAlertRuleModel.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        if field == "threshold_percent" and value is not None:
            setattr(rule, field, Decimal(str(value)))
        else:
            setattr(rule, field, value)

    db.commit()
    db.refresh(rule)

    tenant_name = None
    if rule.tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == rule.tenant_id).first()
        tenant_name = tenant.name if tenant else None
    return _rule_to_response(rule, tenant_name)


@router.delete("/rules/{rule_id}")
async def delete_alert_rule(
    rule_id: UUID,
    current_user=Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """Delete an alert rule (and its fired alerts)."""
    rule = db.query(BudgetAlertRuleModel).filter(BudgetAlertRuleModel.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    db.delete(rule)
    db.commit()
    return {"status": "success", "message": "Alert rule deleted"}


# =====================================================
# FIRED ALERTS
# =====================================================

@router.get("/fired", response_model=List[FiredAlertResponse])
async def list_fired_alerts(
    tenant_id: Optional[UUID] = None,
    status: Optional[str] = Query(None, pattern="^(active|acknowledged|resolved)$"),
    alert_level: Optional[str] = Query(None, pattern="^(warning|critical|emergency)$"),
    skip: int = 0,
    limit: int = 50,
    current_user=Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """List fired alerts with optional filtering."""
    query = db.query(BudgetAlertModel)
    if tenant_id:
        query = query.filter(BudgetAlertModel.tenant_id == tenant_id)
    if status:
        query = query.filter(BudgetAlertModel.status == status)
    if alert_level:
        query = query.filter(BudgetAlertModel.alert_level == alert_level)

    alerts = query.order_by(desc(BudgetAlertModel.triggered_at)).offset(skip).limit(limit).all()

    tenant_ids = {a.tenant_id for a in alerts}
    tenant_map = {}
    if tenant_ids:
        tenants = db.query(Tenant).filter(Tenant.id.in_(tenant_ids)).all()
        tenant_map = {t.id: t.name for t in tenants}

    return [_alert_to_response(a, tenant_map.get(a.tenant_id, "Unknown")) for a in alerts]


@router.get("/fired/{alert_id}", response_model=FiredAlertResponse)
async def get_fired_alert(
    alert_id: UUID,
    current_user=Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """Get a single fired alert by ID."""
    alert = db.query(BudgetAlertModel).filter(BudgetAlertModel.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    tenant = db.query(Tenant).filter(Tenant.id == alert.tenant_id).first()
    return _alert_to_response(alert, tenant.name if tenant else "Unknown")


@router.post("/fired/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: UUID,
    current_user=Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """Acknowledge an active alert (mark as reviewed)."""
    alert = db.query(BudgetAlertModel).filter(BudgetAlertModel.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if alert.status != "active":
        raise HTTPException(status_code=400, detail=f"Cannot acknowledge alert with status '{alert.status}'")

    alert.status = "acknowledged"
    alert.acknowledged_by = current_user.id
    alert.acknowledged_at = datetime.utcnow()

    # Audit
    audit = AuditLog(
        entity_type="BudgetAlert",
        entity_id=str(alert.id),
        action="alert_acknowledged",
        new_values={
            "alert_level": alert.alert_level,
            "acknowledged_by": str(current_user.id),
        },
        actor_type="PLATFORM_ADMIN",
        actor_id=str(current_user.id),
        details=f"Alert acknowledged by {current_user.corporate_email or current_user.personal_email}",
    )
    db.add(audit)
    db.commit()

    return {"status": "success", "message": "Alert acknowledged", "acknowledged_at": alert.acknowledged_at.isoformat()}


@router.post("/fired/{alert_id}/resolve")
async def resolve_alert(
    alert_id: UUID,
    current_user=Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """Manually resolve an alert."""
    alert = db.query(BudgetAlertModel).filter(BudgetAlertModel.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if alert.status == "resolved":
        raise HTTPException(status_code=400, detail="Alert already resolved")

    alert.status = "resolved"
    alert.resolved_at = datetime.utcnow()
    db.commit()

    return {"status": "success", "message": "Alert resolved", "resolved_at": alert.resolved_at.isoformat()}


@router.get("/fired/summary")
async def get_alert_summary(
    current_user=Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """Get counts of fired alerts by status and level."""
    active = db.query(BudgetAlertModel).filter(BudgetAlertModel.status == "active").count()
    acknowledged = db.query(BudgetAlertModel).filter(BudgetAlertModel.status == "acknowledged").count()
    resolved = db.query(BudgetAlertModel).filter(BudgetAlertModel.status == "resolved").count()

    by_level = {}
    for level in ("warning", "critical", "emergency"):
        by_level[level] = db.query(BudgetAlertModel).filter(
            BudgetAlertModel.alert_level == level,
            BudgetAlertModel.status == "active",
        ).count()

    return {
        "active": active,
        "acknowledged": acknowledged,
        "resolved": resolved,
        "active_by_level": by_level,
        "total_rules": db.query(BudgetAlertRuleModel).filter(BudgetAlertRuleModel.is_active == True).count(),
    }


# =====================================================
# HEALTH CHECK & TRIGGER (backward-compatible)
# =====================================================

@router.get("/health", response_model=List[AlertResponse])
async def check_budget_health(
    current_user=Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """
    Check budget health across all tenants.
    Returns list of current budget alerts (if any).
    """
    alerts = BudgetAlertService.check_budget_health(db)

    return [
        AlertResponse(
            tenant_id=str(alert.tenant_id),
            tenant_name=alert.tenant_name,
            alert_level=alert.alert_level if isinstance(alert.alert_level, str) else alert.alert_level.value,
            unallocated_budget=float(alert.unallocated_budget),
            unallocated_percent=alert.unallocated_percent,
            total_budget=float(alert.total_budget),
            message=alert.message,
            triggered_at=alert.triggered_at.isoformat(),
        )
        for alert in alerts
    ]


@router.post("/check-and-notify")
async def check_and_notify(
    current_user=Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """
    Check budget health and fire alerts (persist + email + in-app).
    Also auto-resolves alerts whose thresholds are no longer breached.
    """
    # Auto-resolve first
    resolved_count = BudgetAlertService.auto_resolve_cleared_alerts(db)

    # Then check & fire new
    events = BudgetAlertService.check_budget_health(db)
    result = {"alerts_found": len(events), "auto_resolved": resolved_count}

    if events:
        fire_result = await BudgetAlertService.fire_alerts(db, events, actor_id=current_user.id)
        result.update(fire_result)
    else:
        result.update({"alerts_created": 0, "emails_sent": 0, "notifications_created": 0})

    result["status"] = "success"
    result["alerts"] = [
        {
            "tenant_id": str(a.tenant_id),
            "tenant_name": a.tenant_name,
            "alert_level": a.alert_level if isinstance(a.alert_level, str) else a.alert_level.value,
            "unallocated_percent": a.unallocated_percent,
        }
        for a in events
    ]
    return result


# =====================================================
# LEGACY: configure-rule (redirects to new CRUD)
# =====================================================

@router.post("/configure-rule")
async def configure_alert_rule(
    rule: AlertRuleCreateRequest,
    current_user=Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """
    Legacy endpoint — creates a new alert rule via the rules CRUD.
    """
    return await create_alert_rule(rule, current_user, db)


# =====================================================
# HISTORY (audit log based — backward compat)
# =====================================================

@router.get("/history", response_model=List[AlertHistoryResponse])
async def get_alert_history(
    tenant_id: Optional[str] = None,
    alert_level: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user=Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """Get alert history from audit log."""
    query = db.query(AuditLog).filter(
        AuditLog.action.in_(["alert_triggered", "alert_acknowledged"])
    ).order_by(AuditLog.created_at.desc())

    if tenant_id:
        query = query.filter(AuditLog.entity_id == tenant_id)
    if alert_level:
        query = query.filter(
            AuditLog.new_values.op("->>")("alert_level") == alert_level
        )

    logs = query.offset(skip).limit(limit).all()

    tenant_map = {}
    for log in logs:
        if log.entity_id and log.entity_id not in tenant_map:
            tenant = db.query(Tenant).filter(Tenant.id == log.entity_id).first()
            tenant_map[log.entity_id] = tenant.name if tenant else "Unknown"

    return [
        AlertHistoryResponse(
            id=str(log.id),
            entity_id=str(log.entity_id) if log.entity_id else "",
            tenant_name=tenant_map.get(log.entity_id, "Unknown") if log.entity_id else "Unknown",
            action=log.action,
            alert_level=(log.new_values.get("alert_level", "unknown") if log.new_values else "unknown"),
            unallocated_budget=(log.new_values.get("unallocated_budget", 0) if log.new_values else 0),
            unallocated_percent=(log.new_values.get("unallocated_percent", 0) if log.new_values else 0),
            created_at=log.created_at.isoformat(),
        )
        for log in logs
    ]


# =====================================================
# SEED defaults
# =====================================================

@router.post("/rules/seed-defaults")
async def seed_default_rules(
    current_user=Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """
    Create the standard set of global alert rules (warning 50%, critical 25%, emergency 10%)
    if no global rules exist yet.
    """
    existing = db.query(BudgetAlertRuleModel).filter(
        BudgetAlertRuleModel.tenant_id.is_(None)
    ).count()
    if existing:
        return {"status": "skipped", "message": f"{existing} global rules already exist"}

    defaults = [
        ("Budget Warning (50%)", "warning", 50),
        ("Budget Critical (25%)", "critical", 25),
        ("Budget Emergency (10%)", "emergency", 10),
    ]
    created = []
    for name, level, threshold in defaults:
        rule = BudgetAlertRuleModel(
            name=name,
            alert_level=level,
            threshold_percent=Decimal(str(threshold)),
            notify_in_app=True,
            notify_email=True,
            cooldown_minutes=1440,
            created_by=current_user.id,
        )
        db.add(rule)
        created.append(name)

    db.commit()
    return {"status": "success", "created": created}


# =====================================================
# HELPERS
# =====================================================

def _rule_to_response(rule: BudgetAlertRuleModel, tenant_name: Optional[str] = None) -> AlertRuleResponse:
    return AlertRuleResponse(
        id=str(rule.id),
        tenant_id=str(rule.tenant_id) if rule.tenant_id else None,
        tenant_name=tenant_name,
        name=rule.name,
        alert_level=rule.alert_level,
        threshold_percent=float(rule.threshold_percent),
        email_recipients=rule.email_recipients or [],
        notify_in_app=rule.notify_in_app,
        notify_email=rule.notify_email,
        hard_limit=rule.hard_limit,
        cooldown_minutes=rule.cooldown_minutes,
        is_active=rule.is_active,
        description=rule.description,
        created_at=rule.created_at.isoformat() if rule.created_at else "",
    )


def _alert_to_response(alert: BudgetAlertModel, tenant_name: str) -> FiredAlertResponse:
    return FiredAlertResponse(
        id=str(alert.id),
        rule_id=str(alert.rule_id) if alert.rule_id else None,
        tenant_id=str(alert.tenant_id),
        tenant_name=tenant_name,
        alert_level=alert.alert_level,
        threshold_percent=float(alert.threshold_percent),
        remaining_percent=float(alert.remaining_percent),
        remaining_budget=float(alert.remaining_budget),
        total_budget=float(alert.total_budget),
        message=alert.message,
        status=alert.status,
        email_sent=alert.email_sent,
        notification_created=alert.notification_created,
        acknowledged_by=str(alert.acknowledged_by) if alert.acknowledged_by else None,
        acknowledged_at=alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
        resolved_at=alert.resolved_at.isoformat() if alert.resolved_at else None,
        triggered_at=alert.triggered_at.isoformat() if alert.triggered_at else "",
    )
