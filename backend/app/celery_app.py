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
        # Напоминания каждые 10 минут
        "check-reminders": {
            "task":     "app.tasks.send_reminders",
            "schedule": crontab(minute="*/10"),
        },
        # Парсим DSS каждый день в 09:00
        "fetch-dss-news": {
            "task":     "app.tasks.fetch_dss_news",
            "schedule": crontab(hour=9, minute=0),
        },
        # Парсим VK каждый день в 09:30
        "fetch-vk-news": {
            "task":     "app.tasks.fetch_vk_news",
            "schedule": crontab(hour=9, minute=30),
        },
        # Еженедельный анонс соревнований — каждое воскресенье в 10:00
        "weekly-announcement": {
            "task":     "app.tasks.generate_weekly_announcement",
            "schedule": crontab(hour=10, minute=0, day_of_week=0),
        },
        # Генерация взносов — 1-го числа каждого месяца в 09:00
        "generate-monthly-fees": {
            "task":     "app.tasks.generate_monthly_fees",
            "schedule": crontab(day_of_month=1, hour=9, minute=0),
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


@celery_app.task(name="app.tasks.fetch_dss_news")
def fetch_dss_news_task():
    from app.tasks.news_fetcher import run_dss_fetch
    return run_dss_fetch()


@celery_app.task(name="app.tasks.fetch_vk_news")
def fetch_vk_news_task():
    from app.tasks.vk_fetcher import run_vk_fetch
    return run_vk_fetch()


@celery_app.task(name="app.tasks.generate_weekly_announcement")
def generate_weekly_announcement():
    from app.tasks.yandex_gpt import run_weekly_announcement
    return run_weekly_announcement()


@celery_app.task(name="app.tasks.generate_monthly_fees")
def generate_monthly_fees_task():
    from app.core.database import SessionLocal
    from app.routes.fees import generate_monthly_fees
    db = SessionLocal()
    try:
        count = generate_monthly_fees(db, notify=True)
        print(f"[fees] Создано записей взносов: {count}")
        return count
    finally:
        db.close()
