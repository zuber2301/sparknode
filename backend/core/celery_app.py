from celery import Celery
from config import settings


def make_celery() -> Celery:
    broker_url = getattr(settings, "celery_broker_url", None) or "redis://redis:6379/0"
    backend_url = getattr(settings, "celery_result_backend", None) or broker_url
    celery_app = Celery(
        "sparknode",
        broker=broker_url,
        backend=backend_url,
        include=["core.tasks"],
    )
    celery_app.conf.update(
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        task_acks_late=True,
        task_reject_on_worker_lost=True,
        beat_schedule={
            "sweep-expired-campaigns": {
                "task": "sweep_expired_campaigns",
                "schedule": 3600.0,  # every hour
            },
            "milestone-daily-check": {
                "task": "check_milestones_daily",
                "schedule": 86400.0,  # every 24 hours
            },
        },
    )
    return celery_app


celery_app = make_celery()
