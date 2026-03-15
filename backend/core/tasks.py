import asyncio
import logging
from datetime import datetime, timedelta, timezone, date
from decimal import Decimal

from core.celery_app import celery_app
from core.notifications import send_invite_email

logger = logging.getLogger(__name__)


@celery_app.task(name="send_invite_email")
def send_invite_email_task(corporate_email: str, tenant_name: str) -> None:
    asyncio.run(send_invite_email(corporate_email, tenant_name))


@celery_app.task(name="sweep_expired_campaigns")
def sweep_expired_campaigns() -> dict:
    """Post-event settlement: runs periodically via Celery Beat."""
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
                    db.query(Tenant).filter(Tenant.id == campaign.tenant_id)
                    .with_for_update().first()
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


@celery_app.task(name="check_milestones_daily")
def check_milestones_daily() -> dict:
    """
    Daily milestone automation. Checks today's birthdays and work anniversaries
    across all tenants and posts Feed events + sends wallet credits as configured.

    Award rules (auto, per standard EEE practice):
      - Birthday         → +50 pts  + Feed event
      - 1-year anniv.   → +100 pts + Feed event
      - 5-year anniv.   → +500 pts + Feed event  (Service Award)
      - 10-year anniv.  → +1000 pts + Feed event (Decade Award)
    """
    from database import SessionLocal
    from models import User, Wallet, WalletLedger, Feed

    db = SessionLocal()
    today = date.today()
    processed = {"birthdays": 0, "anniversaries": 0}

    try:
        users = db.query(User).filter(
            User.status.in_(["ACTIVE", "active", "PENDING_INVITE"])
        ).all()

        for u in users:
            # ── Birthday ──────────────────────────────────────────────────────
            if u.date_of_birth:
                try:
                    bday = u.date_of_birth if isinstance(u.date_of_birth, date) else u.date_of_birth
                    if bday.month == today.month and bday.day == today.day:
                        # Avoid duplicates: check for existing feed event today
                        existing = db.query(Feed).filter(
                            Feed.tenant_id == u.tenant_id,
                            Feed.target_id == u.id,
                            Feed.event_type == 'birthday',
                        ).filter(
                            Feed.created_at >= datetime.combine(today, datetime.min.time())
                        ).first()

                        if not existing:
                            _credit_milestone(db, u, 50, "Birthday celebration 🎂", "birthday")
                            db.add(Feed(
                                tenant_id=u.tenant_id,
                                event_type='birthday',
                                reference_type='milestone',
                                actor_id=u.id,
                                target_id=u.id,
                                visibility='public',
                                event_metadata={
                                    "milestone_type": "birthday",
                                    "user_name": f"{u.first_name} {u.last_name}",
                                    "points": "50",
                                    "message": f"🎂 Happy Birthday, {u.first_name}! Wishing you a wonderful day!",
                                }
                            ))
                            processed["birthdays"] += 1
                except Exception as e:
                    logger.warning("Birthday check failed for user %s: %s", u.id, e)

            # ── Work Anniversary ──────────────────────────────────────────────
            if u.hire_date:
                try:
                    hday = u.hire_date if isinstance(u.hire_date, date) else u.hire_date
                    if hday.month == today.month and hday.day == today.day:
                        years = today.year - hday.year
                        if years <= 0:
                            continue
                        award_map = {1: 100, 5: 500, 10: 1000}
                        pts = award_map.get(years, 50 if years > 0 else 0)
                        label = f"{years}-Year Work Anniversary 🎉"
                        if years in (5, 10):
                            label = f"{'⭐ Service Award' if years == 5 else '🏆 Decade Award'} — {years} Years!"

                        existing = db.query(Feed).filter(
                            Feed.tenant_id == u.tenant_id,
                            Feed.target_id == u.id,
                            Feed.event_type == 'anniversary',
                        ).filter(
                            Feed.created_at >= datetime.combine(today, datetime.min.time())
                        ).first()

                        if not existing:
                            _credit_milestone(db, u, pts, label, "anniversary")
                            db.add(Feed(
                                tenant_id=u.tenant_id,
                                event_type='anniversary',
                                reference_type='milestone',
                                actor_id=u.id,
                                target_id=u.id,
                                visibility='public',
                                event_metadata={
                                    "milestone_type": "anniversary",
                                    "user_name": f"{u.first_name} {u.last_name}",
                                    "years": years,
                                    "points": str(pts),
                                    "label": label,
                                    "message": f"🎉 Congratulations {u.first_name} on your {years}-year anniversary at the company!",
                                }
                            ))
                            processed["anniversaries"] += 1
                except Exception as e:
                    logger.warning("Anniversary check failed for user %s: %s", u.id, e)

        db.commit()
        logger.info("Milestone daily check complete: %s", processed)
    except Exception as exc:
        db.rollback()
        logger.exception("check_milestones_daily failed: %s", exc)
        raise
    finally:
        db.close()

    return processed


def _credit_milestone(db, user, points: int, description: str, ref_type: str):
    """Helper: credit a user's wallet for a milestone."""
    from models import Wallet, WalletLedger
    wallet = db.query(Wallet).filter(
        Wallet.user_id == user.id,
        Wallet.tenant_id == user.tenant_id
    ).first()
    if wallet and points > 0:
        wallet.balance = float(wallet.balance) + points
        db.add(WalletLedger(
            wallet_id=wallet.id,
            tenant_id=user.tenant_id,
            transaction_type='credit',
            amount=points,
            description=description,
            reference_type=ref_type,
        ))



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

