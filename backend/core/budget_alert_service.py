"""
Budget Alert Service

Manages budget-related alerts and notifications:
- Configurable alert rules (per-tenant or global)
- Threshold-based budget monitoring
- Deduplication via cooldown windows
- In-app notifications + email delivery
- Automatic & on-demand health checks
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from enum import Enum
from typing import Optional, List, Tuple
from pydantic import BaseModel
from uuid import UUID
import logging

from models import (
    Tenant, AuditLog, Notification, User, Wallet,
    BudgetAlertRule as BudgetAlertRuleModel,
    BudgetAlert as BudgetAlertModel,
)
from core.notifications import EmailService

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Enums & DTOs (kept for backward compat with existing route imports)
# ---------------------------------------------------------------------------

class AlertLevel(str, Enum):
    """Alert severity levels"""
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class BudgetAlertRule(BaseModel):
    """Pydantic schema — kept for backward compatibility with existing routes"""
    tenant_id: Optional[UUID] = None
    alert_level: AlertLevel
    threshold_percent: int
    email_recipients: List[str] = []
    is_active: bool = True
    description: str = ""


class BudgetAlertEvent(BaseModel):
    """Alert event data"""
    tenant_id: UUID
    tenant_name: str
    alert_level: AlertLevel
    unallocated_budget: Decimal
    unallocated_percent: float
    total_budget: Decimal
    message: str
    triggered_at: datetime
    rule_id: Optional[UUID] = None

    class Config:
        arbitrary_types_allowed = True


# ---------------------------------------------------------------------------
# Default rules (used when no DB rules exist yet)
# ---------------------------------------------------------------------------

_DEFAULT_THRESHOLDS = [
    (AlertLevel.EMERGENCY, Decimal("10")),   # remaining <= 10%
    (AlertLevel.CRITICAL,  Decimal("25")),   # remaining <= 25%
    (AlertLevel.WARNING,   Decimal("50")),   # remaining <= 50%
]


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class BudgetAlertService:
    """Service for managing budget alerts with DB-backed configurable rules."""

    # ------------------------------------------------------------------
    # Tenant budget snapshot helper
    # ------------------------------------------------------------------

    @staticmethod
    def _get_tenant_budget_snapshot(db: Session, tenant: Tenant) -> Tuple[Decimal, Decimal, float]:
        """
        Return (total_budget, remaining_balance, remaining_percent) for a tenant.
        """
        total_allocated = Decimal(str(tenant.budget_allocated or 0))
        balance = Decimal(str(tenant.budget_allocation_balance or 0))

        total_lead_budgets = db.query(func.sum(Wallet.balance)).filter(
            Wallet.tenant_id == tenant.id,
            Wallet.wallet_type == 'lead_distribution'
        ).scalar() or Decimal('0')

        total_wallet_balance = db.query(func.sum(Wallet.balance)).filter(
            Wallet.tenant_id == tenant.id,
            Wallet.wallet_type == 'employee'
        ).scalar() or Decimal('0')

        total_deployed = total_lead_budgets + total_wallet_balance
        total_budget = total_allocated + total_deployed

        if total_budget > 0:
            remaining_percent = float((balance / total_budget) * 100)
        else:
            remaining_percent = 100.0

        return total_budget, balance, remaining_percent

    # ------------------------------------------------------------------
    # Rule helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _get_rules_for_tenant(db: Session, tenant_id: UUID) -> List[BudgetAlertRuleModel]:
        """
        Get active rules that apply to a specific tenant.
        Returns tenant-specific rules + global rules (tenant_id IS NULL).
        """
        return db.query(BudgetAlertRuleModel).filter(
            BudgetAlertRuleModel.is_active == True,
            or_(
                BudgetAlertRuleModel.tenant_id == tenant_id,
                BudgetAlertRuleModel.tenant_id.is_(None),
            )
        ).order_by(BudgetAlertRuleModel.threshold_percent.asc()).all()

    @staticmethod
    def _is_within_cooldown(db: Session, rule_id: UUID, tenant_id: UUID, cooldown_minutes: int) -> bool:
        """Check if an alert for this rule+tenant was fired within the cooldown window."""
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=cooldown_minutes)
        return db.query(BudgetAlertModel).filter(
            BudgetAlertModel.rule_id == rule_id,
            BudgetAlertModel.tenant_id == tenant_id,
            BudgetAlertModel.triggered_at >= cutoff,
        ).first() is not None

    # ------------------------------------------------------------------
    # Core evaluation
    # ------------------------------------------------------------------

    @staticmethod
    def evaluate_tenant(db: Session, tenant: Tenant) -> List[BudgetAlertEvent]:
        """
        Evaluate a single tenant against all applicable rules.
        Returns list of alert events that should fire (respecting cooldown).
        """
        total_budget, balance, remaining_pct = BudgetAlertService._get_tenant_budget_snapshot(db, tenant)
        rules = BudgetAlertService._get_rules_for_tenant(db, tenant.id)

        # Fall back to hardcoded defaults when no rules are configured
        if not rules:
            return BudgetAlertService._evaluate_with_defaults(
                tenant, total_budget, balance, remaining_pct
            )

        events: List[BudgetAlertEvent] = []
        for rule in rules:
            threshold = float(rule.threshold_percent)
            if remaining_pct <= threshold:
                # Check cooldown
                if BudgetAlertService._is_within_cooldown(
                    db, rule.id, tenant.id, rule.cooldown_minutes
                ):
                    continue

                message = BudgetAlertService._generate_alert_message(
                    tenant.name, rule.alert_level, balance, remaining_pct, total_budget
                )
                events.append(BudgetAlertEvent(
                    tenant_id=tenant.id,
                    tenant_name=tenant.name,
                    alert_level=rule.alert_level,
                    unallocated_budget=balance,
                    unallocated_percent=remaining_pct,
                    total_budget=total_budget,
                    message=message,
                    triggered_at=datetime.now(timezone.utc),
                    rule_id=rule.id,
                ))
        return events

    @staticmethod
    def _evaluate_with_defaults(
        tenant: Tenant,
        total_budget: Decimal,
        balance: Decimal,
        remaining_pct: float,
    ) -> List[BudgetAlertEvent]:
        """Evaluate against hardcoded defaults when no DB rules exist."""
        events: List[BudgetAlertEvent] = []
        for level, threshold in _DEFAULT_THRESHOLDS:
            if remaining_pct <= float(threshold):
                message = BudgetAlertService._generate_alert_message(
                    tenant.name, level, balance, remaining_pct, total_budget
                )
                events.append(BudgetAlertEvent(
                    tenant_id=tenant.id,
                    tenant_name=tenant.name,
                    alert_level=level,
                    unallocated_budget=balance,
                    unallocated_percent=remaining_pct,
                    total_budget=total_budget,
                    message=message,
                    triggered_at=datetime.now(timezone.utc),
                ))
                break  # only fire the most severe matching default
        return events

    # ------------------------------------------------------------------
    # Full health check (all tenants)
    # ------------------------------------------------------------------

    @staticmethod
    def check_budget_health(db: Session) -> List[BudgetAlertEvent]:
        """
        Check all active tenants for low budget conditions.
        Returns list of alert events that should be triggered.
        """
        tenants = db.query(Tenant).filter(
            Tenant.status.in_(['active', 'trial'])
        ).all()

        all_events: List[BudgetAlertEvent] = []
        for tenant in tenants:
            all_events.extend(BudgetAlertService.evaluate_tenant(db, tenant))
        return all_events

    # ------------------------------------------------------------------
    # Fire alerts: persist + notify
    # ------------------------------------------------------------------

    @staticmethod
    async def fire_alerts(
        db: Session,
        events: List[BudgetAlertEvent],
        actor_id: Optional[UUID] = None,
    ) -> dict:
        """
        For each alert event: persist BudgetAlert row, create in-app
        Notification, send email, and log to audit.

        Returns summary dict: {alerts_created, emails_sent, notifications_created}.
        """
        alerts_created = 0
        emails_sent = 0
        notifications_created = 0

        for event in events:
            # 1. Persist BudgetAlert
            alert_row = BudgetAlertModel(
                rule_id=event.rule_id,
                tenant_id=event.tenant_id,
                alert_level=event.alert_level,
                threshold_percent=Decimal(str(event.unallocated_percent)),
                remaining_percent=Decimal(str(event.unallocated_percent)),
                remaining_budget=event.unallocated_budget,
                total_budget=event.total_budget,
                message=event.message,
                status="active",
            )
            db.add(alert_row)
            db.flush()
            alerts_created += 1

            # 2. In-app notification for tenant managers / platform admins
            notif_ok = BudgetAlertService._create_in_app_notifications(
                db, event, alert_row.id
            )
            if notif_ok:
                alert_row.notification_created = True
                notifications_created += notif_ok

            # 3. Email notification
            email_ok = await BudgetAlertService._send_email_for_event(db, event)
            if email_ok:
                alert_row.email_sent = True
                emails_sent += 1

            # 4. Audit log
            BudgetAlertService.log_alert(db, event)

        try:
            db.commit()
        except Exception:
            db.rollback()
            raise

        return {
            "alerts_created": alerts_created,
            "emails_sent": emails_sent,
            "notifications_created": notifications_created,
        }

    # ------------------------------------------------------------------
    # In-app notifications
    # ------------------------------------------------------------------

    @staticmethod
    def _create_in_app_notifications(
        db: Session,
        event: BudgetAlertEvent,
        alert_id: UUID,
    ) -> int:
        """Create Notification rows for relevant users. Returns count created."""
        # Determine if rule requested in-app notification
        if event.rule_id:
            rule = db.query(BudgetAlertRuleModel).get(event.rule_id)
            if rule and not rule.notify_in_app:
                return 0

        # Notify platform admins
        admins = db.query(User).filter(
            User.org_role == "platform_admin",
            User.status == "active",
        ).all()

        # Notify tenant managers of the affected tenant
        managers = db.query(User).filter(
            User.tenant_id == event.tenant_id,
            User.org_role.in_(["tenant_manager", "hr_admin"]),
            User.status == "active",
        ).all()

        recipients = {u.id: u for u in admins}
        for m in managers:
            recipients[m.id] = m

        count = 0
        for user in recipients.values():
            notif = Notification(
                tenant_id=event.tenant_id,
                user_id=user.id,
                type="budget_alert",
                title=f"Budget {event.alert_level.upper()}: {event.tenant_name}",
                message=event.message,
                reference_type="budget_alert",
                reference_id=alert_id,
            )
            db.add(notif)
            count += 1

        return count

    # ------------------------------------------------------------------
    # Email delivery
    # ------------------------------------------------------------------

    @staticmethod
    async def _send_email_for_event(db: Session, event: BudgetAlertEvent) -> bool:
        """Resolve recipients and send the alert email."""
        recipients: List[str] = []

        # From rule config
        if event.rule_id:
            rule = db.query(BudgetAlertRuleModel).get(event.rule_id)
            if rule:
                if not rule.notify_email:
                    return False
                recipients.extend(rule.email_recipients or [])

        # Fallback: platform admin emails
        if not recipients:
            admins = db.query(User).filter(
                User.org_role == "platform_admin",
                User.status == "active",
            ).all()
            recipients = [a.corporate_email or a.personal_email for a in admins if (a.corporate_email or a.personal_email)]

        if not recipients:
            return False

        return await BudgetAlertService.send_alert_notifications(event, recipients, db)

    # ------------------------------------------------------------------
    # Check single tenant (called after budget operations)
    # ------------------------------------------------------------------

    @staticmethod
    async def check_and_fire_for_tenant(db: Session, tenant_id: UUID) -> dict:
        """
        Convenience: evaluate a single tenant and fire any alerts.
        Designed to be called after budget distribution operations.
        """
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            return {"alerts_created": 0, "emails_sent": 0, "notifications_created": 0}

        events = BudgetAlertService.evaluate_tenant(db, tenant)
        if not events:
            return {"alerts_created": 0, "emails_sent": 0, "notifications_created": 0}

        return await BudgetAlertService.fire_alerts(db, events)

    # ------------------------------------------------------------------
    # Auto-resolve alerts that are no longer breaching
    # ------------------------------------------------------------------

    @staticmethod
    def auto_resolve_cleared_alerts(db: Session) -> int:
        """
        For every active alert, check if the tenant has risen above the
        threshold. If so, mark resolved. Returns count resolved.
        """
        active_alerts = db.query(BudgetAlertModel).filter(
            BudgetAlertModel.status == "active"
        ).all()

        resolved = 0
        for alert in active_alerts:
            tenant = db.query(Tenant).filter(Tenant.id == alert.tenant_id).first()
            if not tenant:
                continue
            _, _, remaining_pct = BudgetAlertService._get_tenant_budget_snapshot(db, tenant)
            if remaining_pct > float(alert.threshold_percent):
                alert.status = "resolved"
                alert.resolved_at = datetime.now(timezone.utc)
                resolved += 1

        if resolved:
            db.commit()
        return resolved

    # ------------------------------------------------------------------
    # Message generation (backward compat)
    # ------------------------------------------------------------------

    @staticmethod
    def _generate_alert_message(
        tenant_name: str,
        alert_level: str,
        unallocated_budget: Decimal,
        unallocated_percent: float,
        total_budget: Decimal
    ) -> str:
        level = alert_level if isinstance(alert_level, str) else alert_level.value
        amt = float(unallocated_budget)
        tot = float(total_budget)

        if level == "emergency":
            return (
                f"🚨 EMERGENCY: {tenant_name} has only "
                f"₹{amt:,.0f} ({unallocated_percent:.1f}%) "
                f"of their ₹{tot:,.0f} budget remaining. "
                f"Immediate action required to allocate more budget."
            )
        elif level == "critical":
            return (
                f"⚠️ CRITICAL: {tenant_name} has only "
                f"₹{amt:,.0f} ({unallocated_percent:.1f}%) "
                f"of their ₹{tot:,.0f} budget remaining. "
                f"Consider allocating additional budget soon."
            )
        else:
            return (
                f"⚠️ WARNING: {tenant_name} has "
                f"₹{amt:,.0f} ({unallocated_percent:.1f}%) "
                f"of their ₹{tot:,.0f} budget remaining. "
                f"Monitor budget utilization."
            )

    # ------------------------------------------------------------------
    # Email sending (backward compat public API)
    # ------------------------------------------------------------------

    @staticmethod
    async def send_alert_notifications(
        alert: BudgetAlertEvent,
        recipient_emails: List[str],
        db: Session
    ) -> bool:
        try:
            if not recipient_emails:
                logger.warning(f"No recipients configured for alert {alert.tenant_id}")
                return False

            subject = f"Budget Alert: {alert.alert_level.upper()} - {alert.tenant_name}"

            body = f"""
Hello,

{alert.message}

Tenant: {alert.tenant_name}
Alert Level: {alert.alert_level.upper()}
Unallocated Budget: ₹{float(alert.unallocated_budget):,.2f}
Remaining Percentage: {alert.unallocated_percent:.1f}%
Total Budget: ₹{float(alert.total_budget):,.2f}
Time: {alert.triggered_at.strftime('%Y-%m-%d %H:%M:%S')}

Action Required:
1. Review the tenant's current budget allocation
2. Consider allocating additional budget if needed
3. Check the Budget Ledger for detailed breakdown

Visit the Platform Admin Budget Ledger for more details:
/platform/budget-ledger

Best regards,
SparkNode System
"""
            email_service = EmailService()
            for email in recipient_emails:
                await email_service.send_email(
                    to=email,
                    subject=subject,
                    body=body,
                    html=BudgetAlertService._generate_html_email(alert)
                )

            logger.info(f"Alert notification sent for tenant {alert.tenant_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to send alert notification: {str(e)}")
            return False

    # ------------------------------------------------------------------
    # HTML email template
    # ------------------------------------------------------------------

    @staticmethod
    def _generate_html_email(alert: BudgetAlertEvent) -> str:
        colors = {
            "emergency": "#dc2626",
            "critical": "#f97316",
            "warning": "#eab308",
        }
        level = alert.alert_level if isinstance(alert.alert_level, str) else alert.alert_level.value
        color = colors.get(level, "#3b82f6")
        emoji = "🚨" if level == "emergency" else "⚠️"

        return f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .alert-box {{
            border-left: 4px solid {color};
            background-color: #f8f8f8;
            padding: 20px;
            border-radius: 4px;
            margin-bottom: 20px;
        }}
        .alert-title {{
            font-size: 18px;
            font-weight: bold;
            color: {color};
            margin-bottom: 10px;
        }}
        .metric {{
            display: inline-block;
            margin: 10px 20px 10px 0;
            font-size: 14px;
        }}
        .metric-label {{ color: #666; }}
        .metric-value {{ font-weight: bold; }}
        .button {{
            display: inline-block;
            padding: 12px 24px;
            background-color: {color};
            color: white;
            text-decoration: none;
            border-radius: 4px;
            margin-top: 20px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h2>Budget Alert Notification</h2>

        <div class="alert-box">
            <div class="alert-title">{emoji} {level.upper()}: {alert.tenant_name}</div>
            <p>{alert.message}</p>

            <div>
                <div class="metric">
                    <div class="metric-label">Unallocated Budget</div>
                    <div class="metric-value">₹{float(alert.unallocated_budget):,.2f}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Remaining %</div>
                    <div class="metric-value">{alert.unallocated_percent:.1f}%</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Total Budget</div>
                    <div class="metric-value">₹{float(alert.total_budget):,.2f}</div>
                </div>
            </div>
        </div>

        <p>Please review the Budget Ledger for detailed information and take necessary action.</p>

        <a href="https://app.sparknode.com/platform/budget-ledger" class="button">View Budget Ledger</a>

        <p style="color: #999; font-size: 12px; margin-top: 40px;">
            This is an automated alert from SparkNode.
            Time: {alert.triggered_at.strftime('%Y-%m-%d %H:%M:%S UTC')}
        </p>
    </div>
</body>
</html>
"""

    # ------------------------------------------------------------------
    # Audit logging
    # ------------------------------------------------------------------

    @staticmethod
    def log_alert(
        db: Session,
        alert: BudgetAlertEvent,
        action: str = "alert_triggered"
    ) -> None:
        try:
            audit_log = AuditLog(
                tenant_id=alert.tenant_id,
                entity_type="Tenant",
                entity_id=alert.tenant_id,
                action=action,
                old_values={},
                new_values={
                    "alert_level": alert.alert_level if isinstance(alert.alert_level, str) else alert.alert_level.value,
                    "unallocated_budget": float(alert.unallocated_budget),
                    "unallocated_percent": alert.unallocated_percent,
                    "message": alert.message,
                    "rule_id": str(alert.rule_id) if alert.rule_id else None,
                },
                actor_type="SYSTEM_ADMIN",
                actor_id=None,
                details=f"Budget alert triggered: {alert.message}"
            )
            db.add(audit_log)
            # Don't commit here — let the caller manage the transaction
            logger.info(f"Alert logged for tenant {alert.tenant_id}")
        except Exception as e:
            logger.error(f"Failed to log alert: {str(e)}")
