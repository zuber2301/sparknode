"""
Core billing service — invoice lifecycle management.

Responsibilities:
 - generate_monthly_invoices()   called by the scheduler on the 1st of every month
 - create_invoice_for_tenant()   creates a single invoice and optionally sends it
 - send_invoice()                (re)sends an existing invoice email+pdf
 - get_or_generate_pdf()         returns the pdf path, regenerating if missing
"""
import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from calendar import monthrange
from typing import Optional

from sqlalchemy.orm import Session

from models import Tenant, User
from billing.models import Invoice

logger = logging.getLogger(__name__)

BILLING_DEFAULTS = {"INR": Decimal("200000"), "USD": Decimal("2500"), "EUR": Decimal("2500")}


def _invoice_number(tenant_id, period_start: date) -> str:
    short = str(tenant_id).replace("-", "")[:8].upper()
    return f"INV-{short}-{period_start.strftime('%Y%m')}"


def _period_for_month(year: int, month: int):
    """Return (period_start, period_end, due_date) for a given year/month."""
    last_day = monthrange(year, month)[1]
    start = date(year, month, 1)
    end   = date(year, month, last_day)
    # Due date = 15th of next month
    if month == 12:
        due = date(year + 1, 1, 15)
    else:
        due = date(year, month + 1, 15)
    return start, end, due


def _resolve_billing_contact(tenant: Tenant, db: Session) -> str:
    """Return the best available billing email for the tenant."""
    if tenant.billing_contact_email:
        return tenant.billing_contact_email
    # Fall back to the first tenant_manager user
    mgr = (
        db.query(User)
        .filter(User.tenant_id == tenant.id, User.org_role == "tenant_manager")
        .order_by(User.created_at)
        .first()
    )
    return mgr.corporate_email if mgr else "billing@sparknode.io"


def _build_line_items(tenant: Tenant) -> list:
    currency = tenant.billing_currency or "INR"
    amount = (
        tenant.billing_final_amount
        or tenant.billing_amount
        or BILLING_DEFAULTS.get(currency)
    )
    cycle = (tenant.billing_cycle or 'monthly').capitalize()
    return [
        {
            "description": f"SparkNode Platform Subscription ({cycle})",
            "unit_price": float(amount),
            "qty": 1,
            "amount": float(amount),
        }
    ]


def create_invoice_for_tenant(
    tenant: Tenant,
    db: Session,
    period_start: Optional[date] = None,
    period_end: Optional[date] = None,
    send_email: bool = True,
    notes: Optional[str] = None,
    created_by: Optional[object] = None,
) -> Invoice:
    """
    Create (or return existing) an invoice for the given tenant + period.
    If send_email=True, dispatches the email in the background.
    """
    from billing.models import Invoice as Inv

    today = date.today()
    if period_start is None:
        period_start, period_end, due_date = _period_for_month(today.year, today.month)
    else:
        if period_end is None:
            last_day = monthrange(period_start.year, period_start.month)[1]
            period_end = date(period_start.year, period_start.month, last_day)
        m = period_start.month
        y = period_start.year
        due_date = date(y + 1, 1, 15) if m == 12 else date(y, m + 1, 15)

    inv_num = _invoice_number(tenant.id, period_start)

    # Idempotent — return existing if already created
    existing = db.query(Inv).filter(Inv.invoice_number == inv_num).first()
    if existing:
        return existing

    currency   = tenant.billing_currency or tenant.display_currency or "INR"
    subtotal   = Decimal(str(
        tenant.billing_amount or BILLING_DEFAULTS.get(currency, Decimal("2500"))
    ))
    disc_pct   = Decimal(str(tenant.billing_discount_pct or 0))
    disc_amt   = (subtotal * disc_pct / 100).quantize(Decimal("0.01"))
    total      = subtotal - disc_amt
    line_items = _build_line_items(tenant)

    invoice = Inv(
        tenant_id      = tenant.id,
        invoice_number = inv_num,
        period_start   = period_start,
        period_end     = period_end,
        billing_cycle  = tenant.billing_cycle or "monthly",
        subtotal       = subtotal,
        discount_pct   = disc_pct,
        discount_amount= disc_amt,
        total          = total,
        currency       = currency,
        status         = "pending",
        due_date       = due_date,
        line_items     = line_items,
        notes          = notes,
        created_by     = created_by.id if created_by else None,
    )
    db.add(invoice)
    db.flush()

    # Generate PDF
    try:
        from billing.pdf_generator import generate_invoice_pdf
        contact = _resolve_billing_contact(tenant, db)
        pdf_path = generate_invoice_pdf(
            invoice_number       = inv_num,
            tenant_name          = tenant.name,
            billing_contact_email= contact,
            period_start         = period_start,
            period_end           = period_end,
            billing_cycle        = invoice.billing_cycle,
            subtotal             = subtotal,
            discount_pct         = disc_pct,
            discount_amount      = disc_amt,
            total                = total,
            currency             = currency,
            due_date             = due_date,
            line_items           = line_items,
            notes                = notes,
        )
        invoice.pdf_path = pdf_path
    except Exception as exc:
        logger.error("PDF generation failed for %s: %s", inv_num, exc)

    db.commit()
    db.refresh(invoice)

    if send_email:
        import asyncio
        from billing.email_service import send_invoice_email
        contact = _resolve_billing_contact(tenant, db)

        async def _send():
            invoice.status  = "sent"
            invoice.sent_at = datetime.now(timezone.utc)
            db.commit()
            ok = await send_invoice_email(
                to_email       = contact,
                invoice_number = inv_num,
                tenant_name    = tenant.name,
                period_start   = period_start,
                period_end     = period_end,
                billing_cycle  = invoice.billing_cycle,
                total          = total,
                currency       = currency,
                due_date       = due_date,
                pdf_path       = invoice.pdf_path,
            )
            if not ok:
                # SMTP not configured — revert to pending so UI shows it
                invoice.status  = "pending"
                invoice.sent_at = None
                db.commit()

        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.ensure_future(_send())
            else:
                loop.run_until_complete(_send())
        except RuntimeError:
            asyncio.run(_send())

    return invoice


def send_invoice(invoice: Invoice, tenant: Tenant, db: Session) -> bool:
    """
    (Re)send an existing invoice by email.
    Regenerates PDF if missing.
    Returns True on success.
    """
    import asyncio
    from billing.email_service import send_invoice_email

    # Ensure PDF exists
    if not invoice.pdf_path or not __import__("os").path.exists(invoice.pdf_path):
        try:
            from billing.pdf_generator import generate_invoice_pdf
            contact = _resolve_billing_contact(tenant, db)
            invoice.pdf_path = generate_invoice_pdf(
                invoice_number        = invoice.invoice_number,
                tenant_name           = tenant.name,
                billing_contact_email = contact,
                period_start          = invoice.period_start,
                period_end            = invoice.period_end,
                billing_cycle         = invoice.billing_cycle,
                subtotal              = invoice.subtotal,
                discount_pct          = invoice.discount_pct,
                discount_amount       = invoice.discount_amount,
                total                 = invoice.total,
                currency              = invoice.currency,
                due_date              = invoice.due_date,
                line_items            = invoice.line_items,
                notes                 = invoice.notes,
            )
            db.commit()
        except Exception as exc:
            logger.error("PDF regen failed for %s: %s", invoice.invoice_number, exc)

    contact = _resolve_billing_contact(tenant, db)

    result_holder = [False]

    async def _do():
        ok = await send_invoice_email(
            to_email       = contact,
            invoice_number = invoice.invoice_number,
            tenant_name    = tenant.name,
            period_start   = invoice.period_start,
            period_end     = invoice.period_end,
            billing_cycle  = invoice.billing_cycle,
            total          = invoice.total,
            currency       = invoice.currency,
            due_date       = invoice.due_date,
            pdf_path       = invoice.pdf_path,
        )
        result_holder[0] = ok
        if ok:
            invoice.status  = "sent"
            invoice.sent_at = datetime.now(timezone.utc)
            db.commit()

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            future = asyncio.ensure_future(_do())
            # For API calls inside async context, fire and return True optimistically
            invoice.status  = "sent"
            invoice.sent_at = datetime.now(timezone.utc)
            db.commit()
            return True
        else:
            loop.run_until_complete(_do())
    except RuntimeError:
        asyncio.run(_do())

    return result_holder[0]


def get_or_generate_pdf(invoice: Invoice, tenant: Tenant, db: Session) -> Optional[str]:
    """Return or regenerate the invoice PDF path."""
    if invoice.pdf_path and __import__("os").path.exists(invoice.pdf_path):
        return invoice.pdf_path
    try:
        from billing.pdf_generator import generate_invoice_pdf
        from billing.service import _resolve_billing_contact
        contact = _resolve_billing_contact(tenant, db)
        path = generate_invoice_pdf(
            invoice_number        = invoice.invoice_number,
            tenant_name           = tenant.name,
            billing_contact_email = contact,
            period_start          = invoice.period_start,
            period_end            = invoice.period_end,
            billing_cycle         = invoice.billing_cycle,
            subtotal              = invoice.subtotal,
            discount_pct          = invoice.discount_pct,
            discount_amount       = invoice.discount_amount,
            total                 = invoice.total,
            currency              = invoice.currency,
            due_date              = invoice.due_date,
            line_items            = invoice.line_items,
            notes                 = invoice.notes,
        )
        invoice.pdf_path = path
        db.commit()
        return path
    except Exception as exc:
        logger.error("PDF generation error: %s", exc)
        return None


def generate_monthly_invoices(db: Session) -> int:
    """
    Called by the APScheduler job on the 1st of every month at 00:05 UTC.
    Creates invoices for all active tenants that have billing configured.
    Returns the count of invoices generated.
    """
    today = date.today()
    period_start, period_end, _ = _period_for_month(today.year, today.month)
    logger.info("Monthly billing run for %s – %s", period_start, period_end)

    tenants = (
        db.query(Tenant)
        .filter(
            Tenant.status == "active",
            Tenant.subscription_status == "active",
        )
        .all()
    )

    count = 0
    for tenant in tenants:
        try:
            create_invoice_for_tenant(
                tenant       = tenant,
                db           = db,
                period_start = period_start,
                period_end   = period_end,
                send_email   = True,
            )
            count += 1
        except Exception as exc:
            logger.error("Billing failed for tenant %s: %s", tenant.id, exc)

    logger.info("Monthly billing complete — %d invoices generated", count)
    return count
