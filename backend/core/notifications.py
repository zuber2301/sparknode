import asyncio
import smtplib
import ssl
from email.message import EmailMessage
from typing import Optional

import httpx

from config import settings


class NotificationError(Exception):
    pass


async def send_email_otp(to_email: str, code: str) -> None:
    if not settings.smtp_host or not settings.smtp_from:
        raise NotificationError("SMTP not configured")

    subject = "Your SparkNode OTP"
    body = f"Your SparkNode verification code is {code}. It expires in 10 minutes."

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
