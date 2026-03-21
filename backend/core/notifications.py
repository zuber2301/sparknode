import asyncio
import smtplib
import ssl
from email.message import EmailMessage
from typing import Optional

import httpx

from config import settings


class NotificationError(Exception):
    pass


async def send_email_otp(to_email: str, code: str, tenant_name: str = "SparkNode", tenant_slug: str = "") -> None:
    if not settings.smtp_host or not settings.smtp_from:
        raise NotificationError("SMTP not configured")

    portal_url = f"https://{tenant_slug}.sparknode.io" if tenant_slug else "https://app.sparknode.io"

    subject = f"Your {tenant_name} login code is {code}"

    plain_body = (
        f"Hi,\n\n"
        f"Your login code for {tenant_name} is:\n\n"
        f"  {code}\n\n"
        f"It expires in 5 minutes.\n\n"
        f"If you didn't request this, you can safely ignore this email.\n\n"
        f"— SparkNode\n{portal_url}"
    )

    html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#f4f5f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;">
            <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.7);">SparkNode</p>
            <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:#ffffff;">{tenant_name}</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 8px;font-size:15px;color:#374151;">Hi there,</p>
            <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6;">
              Use the code below to sign in to <strong>{tenant_name}</strong>.<br>It expires in <strong>5 minutes</strong>.
            </p>
            <!-- Code box -->
            <div style="background:#f0f1ff;border:1px solid #c7d2fe;border-radius:10px;padding:24px;text-align:center;margin:0 0 28px;">
              <p style="margin:0;font-size:42px;font-weight:800;letter-spacing:10px;color:#4f46e5;font-variant-numeric:tabular-nums;">{code}</p>
            </div>
            <p style="margin:0 0 24px;font-size:13px;color:#9ca3af;text-align:center;">
              If you didn't request this code, you can safely ignore this email.
            </p>
            <div style="text-align:center;">
              <a href="{portal_url}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;">{tenant_slug or 'app'}.sparknode.io →</a>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 40px 24px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;font-size:11px;color:#d1d5db;">Powered by SparkNode · <a href="https://sparknode.io" style="color:#a5b4fc;text-decoration:none;">sparknode.io</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

    def _send():
        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = settings.smtp_from
        message["To"] = to_email
        message.set_content(plain_body)
        message.add_alternative(html_body, subtype="html")

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            if settings.smtp_use_tls:
                server.starttls(context=ssl.create_default_context())
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(message)

    await asyncio.to_thread(_send)


async def send_sms_otp(mobile_number: str, code: str) -> None:
    if not settings.twilio_account_sid or not settings.twilio_auth_token or not settings.twilio_from_number:
        raise NotificationError("Twilio not configured")

    body = f"Your SparkNode verification code is {code}. It expires in 10 minutes."
    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json"

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            url,
            data={
                "To": mobile_number,
                "From": settings.twilio_from_number,
                "Body": body,
            },
            auth=(settings.twilio_account_sid, settings.twilio_auth_token),
        )

    if response.status_code >= 400:
        raise NotificationError("Failed to send SMS")


async def send_invite_email(to_email: str, tenant_name: str) -> None:
    if not settings.smtp_host or not settings.smtp_from:
        raise NotificationError("SMTP not configured")

    subject = f"You're invited to SparkNode ({tenant_name})"
    body = (
        f"Hello,\n\n"
        f"You've been invited to join {tenant_name} on SparkNode. "
        f"Use your corporate email to sign in.\n\n"
        f"If you need help, contact your admin.\n\n"
        f"Thanks,\nSparkNode Team"
    )

    def _send():
        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = settings.smtp_from
        message["To"] = to_email
        message.set_content(body)

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            if settings.smtp_use_tls:
                server.starttls(context=ssl.create_default_context())
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(message)

    await asyncio.to_thread(_send)

class EmailService:
    """Simple email service for sending general emails"""
    
    async def send_email(self, to: str, subject: str, body: str, html: Optional[str] = None) -> bool:
        """Send an email with optional HTML content"""
        if not settings.smtp_host or not settings.smtp_from:
            return False
        
        def _send():
            message = EmailMessage()
            message["Subject"] = subject
            message["From"] = settings.smtp_from
            message["To"] = to
            message.set_content(body)
            if html:
                message.add_alternative(html, subtype='html')
            
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
                if settings.smtp_use_tls:
                    server.starttls(context=ssl.create_default_context())
                if settings.smtp_user and settings.smtp_password:
                    server.login(settings.smtp_user, settings.smtp_password)
                server.send_message(message)
        
        try:
            await asyncio.to_thread(_send)
            return True
        except Exception:
            return False
