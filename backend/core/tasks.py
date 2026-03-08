import asyncio
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from core.celery_app import celery_app
from core.notifications import send_invite_email

logger = logging.getLogger(__name__)


@celery_app.task(name="send_invite_email")
def send_invite_email_task(corporate_email: str, tenant_name: str) -> None:
    asyncio.run(send_invite_email(corporate_email, tenant_name))


@celery_app.task(name="sweep_expired_campaigns")
def sweep_expired_campaigns() -> dict:
    """
    Post-event settlement: runs periodically (e.g. every hour via Celery Beat).

    For every 'active' campaign where end_date + 24 hours has passed:
      1. Return remaining budget_escrow to the tenant master_budget_balance.
      2. Mark campaign status = 'closed'.
      3. Record an audit ledger entry.
    """
    from database import SessionLocal
    from models import MasterBudgetLedger, SalesCampaign, Tenant

    db = SessionLocal()
    swept = []
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

        expired = db.query(SalesCampaign).filter(
            SalesCampaign.status == "active",
            SalesCampaign.end_date <= cutoff,
        ).all()

        for campaign in expired:
            remaining = Decimal(str(campaign.budget_escrow or 0))
            if remaining > 0:
                tenant = (
                    db.query(Tenant)
                    .filter(Tenant.id == campaign.tenant_id)
                    .with_for_update()
                    .first()
                )
                if tenant:
                    tenant.master_budget_balance += remaining

                    db.add(MasterBudgetLedger(
                        tenant_id=tenant.id,
                        transaction_type="credit",
                        source="campaign_sweep",
                        points=remaining,
                        currency="PTS",
                        balance_after=float(tenant.master_budget_balance),
                        reference_type="sales_campaign",
                        reference_id=campaign.id,
                        description=f"Sweep return for campaign: {campaign.title}",
                    ))

            campaign.budget_escrow = Decimal("0")
            campaign.status = "closed"
            campaign.swept_at = datetime.now(timezone.utc)
            campaign.swept_amount = remaining

            swept.append({"campaign_id": str(campaign.id), "returned_points": float(remaining)})
            logger.info("Swept campaign %s — returned %s pts", campaign.id, remaining)

        db.commit()
    except Exception as exc:
        db.rollback()
        logger.exception("sweep_expired_campaigns failed: %s", exc)
        raise
    finally:
        db.close()

    return {"swept": swept, "count": len(swept)}

