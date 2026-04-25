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
        # Еженедельный дайджест событий — воскресенье 18:00
        "weekly-digest": {
            "task":     "app.tasks.weekly_digest",
            "schedule": crontab(hour=18, minute=0, day_of_week=0),
        },
        # Уведомление должников — ежедневно в 10:00
        "notify-overdue-fees": {
            "task":     "app.tasks.notify_overdue_fees",
            "schedule": crontab(hour=10, minute=0),
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


@celery_app.task(name="app.tasks.notify_overdue_fees")
def notify_overdue_fees_task():
    from app.core.database import SessionLocal
    from app.routes.fees import notify_overdue
    db = SessionLocal()
    try:
        sent = notify_overdue(db)
        print(f"[fees] Уведомлений должникам отправлено: {sent}")
        return sent
    finally:
        db.close()


@celery_app.task(name="app.tasks.weekly_digest")
def weekly_digest_task():
    from app.core.database import SessionLocal
    from app.models.user import User, Athlete
    from app.models.certification import Notification, NotificationType
    from app.models.attendance import Attendance, TrainingSession
    from app.models.achievement import AthleteAchievement, ACHIEVEMENT_MAP
    from datetime import datetime, timedelta

    db = SessionLocal()
    sent = 0
    try:
        week_ago = datetime.utcnow() - timedelta(days=7)
        parents = db.query(User).filter(User.role == "parent", User.is_active == True).all()

        for parent in parents:
            athletes = db.query(Athlete).filter(
                Athlete.user_id == parent.id,
                Athlete.is_archived == False
            ).all()
            if not athletes:
                continue

            lines = []
            for ath in athletes:
                new_ach = db.query(AthleteAchievement).filter(
                    AthleteAchievement.athlete_id == ath.id,
                    AthleteAchievement.granted_at >= week_ago
                ).all()
                attendances = db.query(Attendance).join(
                    TrainingSession, Attendance.session_id == TrainingSession.id
                ).filter(
                    Attendance.athlete_id == ath.id,
                    Attendance.present == True,
                    TrainingSession.date >= week_ago.date()
                ).count()

                if new_ach or attendances > 0:
                    parts = []
                    if attendances > 0:
                        parts.append(f"тренировок: {attendances}")
                    if new_ach:
                        names = [ACHIEVEMENT_MAP[a.code]["name"] for a in new_ach if a.code in ACHIEVEMENT_MAP]
                        if names:
                            parts.append(f"новые ачивки: {', '.join(names)}")
                    if parts:
                        lines.append(f"{ath.full_name} — {'; '.join(parts)}")

            if not lines:
                continue

            body = "Сводка за неделю:\n" + "\n".join(lines) + "\n\nЗагляните в кабинет — там подробности."
            notif = Notification(
                user_id=parent.id,
                type=NotificationType.general,
                title="Дайджест недели",
                body=body,
            )
            db.add(notif)
            sent += 1

        db.commit()
        print(f"[weekly_digest] Дайджестов отправлено: {sent}")
        return sent
    except Exception as e:
        db.rollback()
        print(f"[weekly_digest] Ошибка: {e}")
        return 0
    finally:
        db.close()
