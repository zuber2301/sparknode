import asyncio

from core.celery_app import celery_app
from core.notifications import send_invite_email


@celery_app.task(name="send_invite_email")
def send_invite_email_task(email: str, tenant_name: str) -> None:
    asyncio.run(send_invite_email(email, tenant_name))
