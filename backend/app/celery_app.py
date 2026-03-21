# backend/app/celery_app.py

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
        # Парсим Telegram ГТФ России каждый день в 09:00
        "fetch-telegram-gtf": {
            "task":     "app.tasks.fetch_telegram_news",
            "schedule": crontab(hour=9, minute=0),
        },
        # Парсим новости дворца спорта каждый день в 09:30
        "fetch-dss-news": {
            "task":     "app.tasks.fetch_dss_news",
            "schedule": crontab(hour=9, minute=30),
        },
    },
)


@celery_app.task(name="app.tasks.send_reminders")
def send_reminders():
    from app.core.database import SessionLocal
    from app.services.notifications import check_and_send_reminders
    db = SessionLocal()
    try:
        check_and_send_reminders(db)
    finally:
        db.close()


@celery_app.task(name="app.tasks.fetch_telegram_news")
def fetch_telegram_news():
    from app.tasks.news_fetcher import run_telegram_fetch
    return run_telegram_fetch()


@celery_app.task(name="app.tasks.fetch_dss_news")
def fetch_dss_news_task():
    from app.tasks.news_fetcher import run_dss_fetch
    return run_dss_fetch()
