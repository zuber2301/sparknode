"""
Billing email service — wraps core.notifications.EmailService
to send invoice emails with attached PDF.
"""
import asyncio
import smtplib
import ssl
from email.message import EmailMessage
from pathlib import Path
from typing import Optional
from decimal import Decimal

from config import settings

CURRENCY_SYMBOLS = {"INR": "₹", "USD": "$", "EUR": "€"}


def _fmt(amount, currency: str) -> str:
    sym = CURRENCY_SYMBOLS.get(currency, currency + " ")
    return f"{sym}{float(amount):,.2f}"


def _build_html(
    invoice_number: str,
    tenant_name: str,
    period_start,
    period_end,
    billing_cycle: str,
    total: Decimal,
    currency: str,
    due_date,
) -> str:
    due = str(due_date) if due_date else "Upon receipt"
    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;color:#111827;background:#f9fafb;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
        style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr><td style="background:#4F46E5;padding:28px 36px;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">SparkNode</h1>
          <p style="margin:4px 0 0;color:#C7D2FE;font-size:13px;">Platform Invoice</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px 36px;">
          <p style="margin:0 0 16px;font-size:15px;">Dear <strong>{tenant_name}</strong>,</p>
          <p style="margin:0 0 24px;font-size:14px;color:#374151;">
            Your invoice for the <strong>{billing_cycle}</strong> billing period
            <strong>{period_start} – {period_end}</strong> is ready.
          </p>

          <!-- Summary box -->
          <table width="100%" cellpadding="12" cellspacing="0"
                 style="background:#EEF2FF;border-radius:8px;margin-bottom:24px;">
            <tr>
              <td style="font-size:13px;color:#6366F1;font-weight:600;">Invoice #</td>
              <td style="font-size:13px;text-align:right;font-weight:700;">{invoice_number}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#6366F1;font-weight:600;">Amount Due</td>
              <td style="font-size:18px;text-align:right;font-weight:800;color:#312E81;">{_fmt(total, currency)}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#6366F1;font-weight:600;">Due Date</td>
              <td style="font-size:13px;text-align:right;">{due}</td>
            </tr>
          </table>

          <p style="font-size:13px;color:#6B7280;">
            The full invoice PDF is attached to this email. Please make the payment
            by the due date to avoid service interruption.
          </p>
          <p style="font-size:13px;color:#6B7280;">
            For billing queries, reply to this email or contact
            <a href="mailto:billing@sparknode.io" style="color:#4F46E5;">billing@sparknode.io</a>.
          </p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#F3F4F6;padding:16px 36px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#9CA3AF;">
            © 2026 SparkNode — All rights reserved
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""


async def send_invoice_email(
    to_email: str,
    invoice_number: str,
    tenant_name: str,
    period_start,
    period_end,
    billing_cycle: str,
    total: Decimal,
    currency: str,
    due_date,
    pdf_path: Optional[str] = None,
) -> bool:
    """
    Send invoice email with attached PDF.
    Returns True on success, False when SMTP is not configured (logs a warning).
    """
    if not settings.smtp_host or not settings.smtp_from:
        import logging
        logging.getLogger(__name__).warning(
            "SMTP not configured — skipping invoice email for %s", invoice_number
        )
        return False

    subject = f"SparkNode Invoice {invoice_number} — {_fmt(total, currency)} due"
    html = _build_html(invoice_number, tenant_name, period_start, period_end,
                       billing_cycle, total, currency, due_date)
    plain = (
        f"SparkNode Invoice {invoice_number}\n"
        f"Tenant: {tenant_name}\n"
        f"Period: {period_start} – {period_end}\n"
        f"Amount due: {_fmt(total, currency)}\n"
        f"Due: {due_date or 'Upon receipt'}\n"
        f"Please see attached PDF."
    )

    def _send():
        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from
        msg["To"] = to_email
        msg.set_content(plain)
        msg.add_alternative(html, subtype="html")

        if pdf_path:
            data = Path(pdf_path).read_bytes()
            msg.add_attachment(data, maintype="application", subtype="pdf",
                               filename=f"{invoice_number}.pdf")

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as srv:
            if settings.smtp_use_tls:
                srv.starttls(context=ssl.create_default_context())
            if settings.smtp_user and settings.smtp_password:
                srv.login(settings.smtp_user, settings.smtp_password)
            srv.send_message(msg)

    try:
        await asyncio.to_thread(_send)
        return True
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error("Invoice email failed for %s: %s", invoice_number, exc)
        return False
