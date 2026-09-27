"""Celery worker configuration and task definitions."""

from celery import Celery
from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "smarter_tasks",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "app.orchestration.tasks.ai_tasks.*": {"queue": "heavy_ai"},
    },
)

@celery_app.task(name="app.orchestration.tasks.process_heavy_task")
def process_heavy_task(task_type: str, data: dict):
    # Example heavy task
    return f"Processed {task_type}"
