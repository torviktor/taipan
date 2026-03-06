"""
Celery — планировщик фоновых задач.
Каждые 10 минут проверяет нужно ли отправить напоминания.
"""
from celery import Celery
from celery.schedules import crontab
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

celery_app = Celery(
    "taipan",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

celery_app.conf.update(
    timezone="Europe/Moscow",
    beat_schedule={
        # Проверяем напоминания каждые 10 минут
        "check-reminders": {
            "task":     "app.tasks.send_reminders",
            "schedule": crontab(minute="*/10"),
        },
    },
)


@celery_app.task(name="app.tasks.send_reminders")
def send_reminders():
    """Фоновая задача: проверить и отправить напоминания."""
    from app.core.database import SessionLocal
    from app.services.notifications import check_and_send_reminders

    db = SessionLocal()
    try:
        check_and_send_reminders(db)
    finally:
        db.close()
