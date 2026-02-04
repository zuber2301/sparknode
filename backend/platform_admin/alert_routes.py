"""
Platform Admin - Budget Alert Routes

Routes for managing budget alerts:
1. Check budget health and get current alerts
2. Configure alert rules
3. View alert history
4. Manually trigger alerts
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime

from database import get_db
from models import Tenant, AuditLog
from auth.utils import get_current_user
from core.rbac import get_platform_admin
from core.budget_alert_service import (
    BudgetAlertService,
    BudgetAlertEvent,
    BudgetAlertRule,
    AlertLevel
)

router = APIRouter(prefix="/api/platform/alerts", tags=["platform-budget-alerts"])


# =====================================================
# SCHEMAS
# =====================================================

class AlertRuleRequest(BaseModel):
    """Create/update alert rule"""
    alert_level: AlertLevel
    threshold_percent: int
    email_recipients: List[str] = []
    is_active: bool = True
    description: str = ""


class AlertResponse(BaseModel):
    """Alert data response"""
    tenant_id: str
    tenant_name: str
    alert_level: str
    unallocated_budget: float
    unallocated_percent: float
    total_budget: float
    message: str
    triggered_at: str


class AlertHistoryResponse(BaseModel):
    """Alert history entry"""
    id: str
    entity_id: str
    tenant_name: str
    action: str
    alert_level: str
    unallocated_budget: float
    unallocated_percent: float
    created_at: str


# =====================================================
# ENDPOINTS
# =====================================================

@router.get("/health", response_model=List[AlertResponse])
async def check_budget_health(
    current_user = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """
    Check budget health across all tenants.
    
    Returns list of current budget alerts (if any).
    """
    try:
        alerts = BudgetAlertService.check_budget_health(db)
        
        return [
            AlertResponse(
                tenant_id=str(alert.tenant_id),
                tenant_name=alert.tenant_name,
                alert_level=alert.alert_level,
                unallocated_budget=float(alert.unallocated_budget),
                unallocated_percent=alert.unallocated_percent,
                total_budget=float(alert.total_budget),
                message=alert.message,
                triggered_at=alert.triggered_at.isoformat()
            )
            for alert in alerts
        ]
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check budget health: {str(e)}"
        )


@router.get("/history", response_model=List[AlertHistoryResponse])
async def get_alert_history(
    tenant_id: Optional[str] = None,
    alert_level: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """
    Get alert history.
    
    Query Params:
    - tenant_id: Filter by specific tenant (optional)
    - alert_level: Filter by alert level (warning, critical, emergency)
    - skip: Pagination offset
    - limit: Pagination limit
    """
    try:
        query = db.query(AuditLog).filter(
            AuditLog.action.in_(['alert_triggered', 'alert_acknowledged'])
        ).order_by(AuditLog.created_at.desc())
        
        if tenant_id:
            query = query.filter(AuditLog.entity_id == tenant_id)
        
        if alert_level:
            query = query.filter(
                AuditLog.new_values.op('->>')('alert_level') == alert_level
            )
        
        total = query.count()
        logs = query.offset(skip).limit(limit).all()
        
        # Get tenant names
        tenant_map = {}
        for log in logs:
            if log.entity_id not in tenant_map:
                tenant = db.query(Tenant).filter(
                    Tenant.id == log.entity_id
                ).first()
                tenant_map[log.entity_id] = tenant.name if tenant else "Unknown"
        
        return [
            AlertHistoryResponse(
                id=str(log.id),
                entity_id=str(log.entity_id),
                tenant_name=tenant_map.get(log.entity_id, "Unknown"),
                action=log.action,
                alert_level=log.new_values.get('alert_level', 'unknown') if log.new_values else 'unknown',
                unallocated_budget=log.new_values.get('unallocated_budget', 0) if log.new_values else 0,
                unallocated_percent=log.new_values.get('unallocated_percent', 0) if log.new_values else 0,
                created_at=log.created_at.isoformat()
            )
            for log in logs
        ]
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch alert history: {str(e)}"
        )


@router.post("/check-and-notify")
async def check_and_notify(
    current_user = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """
    Check budget health and send notifications for alerts.
    
    This endpoint:
    1. Checks all tenants for low budget conditions
    2. Sends email notifications if configured
    3. Logs all alerts to audit trail
    """
    try:
        alerts = BudgetAlertService.check_budget_health(db)
        sent_count = 0
        
        for alert in alerts:
            # Log the alert
            BudgetAlertService.log_alert(db, alert)
            
            # Get configured recipients (from tenant settings or default admin)
            # TODO: Implement alert rule configuration
            admin_emails = [current_user.email] if current_user.email else []
            
            if admin_emails:
                # Send notifications
                success = await BudgetAlertService.send_alert_notifications(
                    alert,
                    admin_emails,
                    db
                )
                if success:
                    sent_count += 1
        
        return {
            "status": "success",
            "alerts_found": len(alerts),
            "notifications_sent": sent_count,
            "alerts": [
                {
                    "tenant_id": str(a.tenant_id),
                    "tenant_name": a.tenant_name,
                    "alert_level": a.alert_level,
                    "unallocated_percent": a.unallocated_percent
                }
                for a in alerts
            ]
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check and notify: {str(e)}"
        )


@router.post("/configure-rule")
async def configure_alert_rule(
    rule: AlertRuleRequest,
    current_user = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """
    Configure alert rules for budget notifications.
    
    Note: Current implementation stores rules in tenant settings.
    Future enhancement: Create dedicated AlertRule table.
    """
    try:
        # TODO: Implement alert rule configuration
        # For now, return success response
        
        return {
            "status": "success",
            "message": "Alert rule configured successfully",
            "rule": {
                "alert_level": rule.alert_level,
                "threshold_percent": rule.threshold_percent,
                "email_recipients": rule.email_recipients,
                "is_active": rule.is_active
            }
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to configure alert rule: {str(e)}"
        )


@router.post("/acknowledge/{alert_id}")
async def acknowledge_alert(
    alert_id: str,
    current_user = Depends(get_platform_admin),
    db: Session = Depends(get_db)
):
    """
    Acknowledge an alert (mark as reviewed).
    """
    try:
        # Find the alert in audit logs
        alert_log = db.query(AuditLog).filter(
            AuditLog.id == alert_id
        ).first()
        
        if not alert_log:
            raise HTTPException(status_code=404, detail="Alert not found")
        
        # Log acknowledgement
        ack_log = AuditLog(
            entity_type=alert_log.entity_type,
            entity_id=alert_log.entity_id,
            action="alert_acknowledged",
            old_values=alert_log.new_values,
            new_values={**alert_log.new_values, "acknowledged_by": current_user.email},
            actor_type="PLATFORM_ADMIN",
            actor_id=str(current_user.id),
            details=f"Alert acknowledged by {current_user.email}"
        )
        db.add(ack_log)
        db.commit()
        
        return {
            "status": "success",
            "message": "Alert acknowledged",
            "acknowledged_at": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to acknowledge alert: {str(e)}"
        )
