"""
Budget Alert Service

Manages budget-related alerts and notifications:
- Low budget warnings
- Alert rule configuration
- Email notifications
- Alert history and tracking
"""

from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from decimal import Decimal
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel
from uuid import UUID
import logging

from models import Tenant, AuditLog
from core.notifications import EmailService

logger = logging.getLogger(__name__)


class AlertLevel(str, Enum):
    """Alert severity levels"""
    WARNING = "warning"  # >= 50%
    CRITICAL = "critical"  # >= 75%
    EMERGENCY = "emergency"  # >= 90%


class BudgetAlertRule(BaseModel):
    """Configuration for budget alert rules"""
    tenant_id: Optional[UUID] = None  # None = applies to all tenants
    alert_level: AlertLevel
    threshold_percent: int  # Alert when budget usage > this percentage
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


class BudgetAlertService:
    """Service for managing budget alerts"""
    
    @staticmethod
    def check_budget_health(db: Session) -> List[BudgetAlertEvent]:
        """
        Check all tenants for low budget conditions.
        
        Returns list of alert events that should be triggered.
        """
        alerts = []
        
        # Get all active tenants
        tenants = db.query(Tenant).filter(
            Tenant.status.in_(['active', 'trial'])
        ).all()
        
        for tenant in tenants:
            # Calculate unallocated budget
            total_allocated = Decimal(tenant.budget_allocated) or Decimal('0')
            balance = Decimal(tenant.budget_allocation_balance) or Decimal('0')
            
            # Query total lead budgets and wallet balances
            from models import Wallet
            
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
            
            # Calculate unallocated percentage
            if total_budget > 0:
                unallocated_percent = float((balance / total_budget) * 100)
            else:
                unallocated_percent = 100.0
            
            # Check alert thresholds
            alert_level = None
            
            if unallocated_percent <= 10:  # Emergency: < 10% remaining
                alert_level = AlertLevel.EMERGENCY
            elif unallocated_percent <= 25:  # Critical: < 25% remaining
                alert_level = AlertLevel.CRITICAL
            elif unallocated_percent <= 50:  # Warning: < 50% remaining
                alert_level = AlertLevel.WARNING
            
            if alert_level:
                message = BudgetAlertService._generate_alert_message(
                    tenant.name,
                    alert_level,
                    balance,
                    unallocated_percent,
                    total_budget
                )
                
                alerts.append(BudgetAlertEvent(
                    tenant_id=tenant.id,
                    tenant_name=tenant.name,
                    alert_level=alert_level,
                    unallocated_budget=balance,
                    unallocated_percent=unallocated_percent,
                    total_budget=total_budget,
                    message=message,
                    triggered_at=datetime.utcnow()
                ))
        
        return alerts
    
    @staticmethod
    def _generate_alert_message(
        tenant_name: str,
        alert_level: AlertLevel,
        unallocated_budget: Decimal,
        unallocated_percent: float,
        total_budget: Decimal
    ) -> str:
        """Generate human-readable alert message"""
        
        if alert_level == AlertLevel.EMERGENCY:
            return (
                f"🚨 EMERGENCY: {tenant_name} has only "
                f"₹{float(unallocated_budget):,.0f} ({unallocated_percent:.1f}%) "
                f"of their ₹{float(total_budget):,.0f} budget remaining. "
                f"Immediate action required to allocate more budget."
            )
        elif alert_level == AlertLevel.CRITICAL:
            return (
                f"⚠️ CRITICAL: {tenant_name} has only "
                f"₹{float(unallocated_budget):,.0f} ({unallocated_percent:.1f}%) "
                f"of their ₹{float(total_budget):,.0f} budget remaining. "
                f"Consider allocating additional budget soon."
            )
        else:  # WARNING
            return (
                f"⚠️ WARNING: {tenant_name} has "
                f"₹{float(unallocated_budget):,.0f} ({unallocated_percent:.1f}%) "
                f"of their ₹{float(total_budget):,.0f} budget remaining. "
                f"Monitor budget utilization."
            )
    
    @staticmethod
    async def send_alert_notifications(
        alert: BudgetAlertEvent,
        recipient_emails: List[str],
        db: Session
    ) -> bool:
        """
        Send alert notifications to specified recipients.
        
        Returns True if notification sent successfully.
        """
        try:
            if not recipient_emails:
                logger.warning(f"No recipients configured for alert {alert.tenant_id}")
                return False
            
            # Prepare email subject and body
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
            
            # Send email (if email service is available)
            email_service = EmailService()
            success = await email_service.send_email(
                to=recipient_emails,
                subject=subject,
                body=body,
                html=BudgetAlertService._generate_html_email(alert)
            )
            
            # Log the alert
            if success:
                logger.info(f"Alert notification sent for tenant {alert.tenant_id}")
            
            return success
        
        except Exception as e:
            logger.error(f"Failed to send alert notification: {str(e)}")
            return False
    
    @staticmethod
    def _generate_html_email(alert: BudgetAlertEvent) -> str:
        """Generate HTML email template for alert"""
        
        colors = {
            AlertLevel.EMERGENCY: "#dc2626",
            AlertLevel.CRITICAL: "#f97316",
            AlertLevel.WARNING: "#eab308"
        }
        
        color = colors.get(alert.alert_level, "#3b82f6")
        emoji = "🚨" if alert.alert_level == AlertLevel.EMERGENCY else "⚠️"
        
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
            <div class="alert-title">{emoji} {alert.alert_level.upper()}: {alert.tenant_name}</div>
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
    
    @staticmethod
    def log_alert(
        db: Session,
        alert: BudgetAlertEvent,
        action: str = "alert_triggered"
    ) -> None:
        """
        Log alert event to audit trail.
        """
        try:
            audit_log = AuditLog(
                entity_type="Tenant",
                entity_id=str(alert.tenant_id),
                action=action,
                old_values={},
                new_values={
                    "alert_level": alert.alert_level,
                    "unallocated_budget": float(alert.unallocated_budget),
                    "unallocated_percent": alert.unallocated_percent,
                    "message": alert.message
                },
                actor_type="SYSTEM_ADMIN",
                actor_id=None,
                details=f"Budget alert triggered: {alert.message}"
            )
            db.add(audit_log)
            db.commit()
            logger.info(f"Alert logged for tenant {alert.tenant_id}")
        except Exception as e:
            logger.error(f"Failed to log alert: {str(e)}")
            db.rollback()
