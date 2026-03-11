"""
Telegram Bot хендлеры.
"""
import os
import logging
from fastapi import APIRouter, Request
from app.core.database import SessionLocal

logger = logging.getLogger(__name__)
router = APIRouter()

TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")


async def process_telegram_update(update: dict):
    message = update.get("message", {})
    if not message:
        return

    chat_id   = str(message.get("chat", {}).get("id", ""))
    text      = message.get("text", "")
    username  = message.get("from", {}).get("username", "")
    full_name = (
        message.get("from", {}).get("first_name", "") + " " +
        message.get("from", {}).get("last_name", "")
    ).strip()

    if not chat_id:
        return

    db = SessionLocal()
    try:
        from app.models.event import TelegramSubscriber, Event
        from app.services.notifications import send_telegram_message
        from datetime import datetime, timedelta

        subscriber = db.query(TelegramSubscriber).filter(
            TelegramSubscriber.telegram_id == chat_id
        ).first()

        if text == "/start":
            if not subscriber:
                sub = TelegramSubscriber(telegram_id=chat_id, username=username, full_name=full_name, subscribed=True)
                db.add(sub)
                db.commit()
            else:
                subscriber.subscribed = True
                db.commit()
            reply = (
                "🥋 <b>Добро пожаловать в клуб Тайпан г. Павловский Посад!</b>\n\n"
                "Ты подписан на уведомления о событиях клуба.\n"
                "Мы будем напоминать о тренировках, соревнованиях и иных мероприятиях.\n\n"
                "Команды:\n"
                "/start — подписаться\n"
                "/stop — отписаться\n"
                "/events — ближайшее событие\n"
                "/week — события на неделю\n"
                "/month — события на месяц"
            )
            await send_telegram_message(chat_id, reply)

        elif text == "/stop":
            if subscriber:
                subscriber.subscribed = False
                db.commit()
            await send_telegram_message(chat_id, "😔 Ты отписался от уведомлений.\nНапиши /start чтобы подписаться снова.")

        elif text == "/events":
            e = db.query(Event).filter(
                Event.is_active == True,
                Event.event_date > datetime.utcnow()
            ).order_by(Event.event_date).first()
            if not e:
                reply = "📅 Ближайших событий нет."
            else:
                date_str = e.event_date.strftime("%d.%m в %H:%M")
                reply = f"📅 <b>Ближайшее событие:</b>\n\n• {date_str} — {e.title}"
                if e.location:
                    reply += f"\n  📍 {e.location}"
            await send_telegram_message(chat_id, reply)

        elif text == "/week":
            now = datetime.utcnow()
            events = db.query(Event).filter(
                Event.is_active == True,
                Event.event_date >= now,
                Event.event_date <= now + timedelta(days=7)
            ).order_by(Event.event_date).all()
            if not events:
                reply = "📅 На этой неделе событий нет."
            else:
                reply = "📅 <b>События на неделю:</b>\n\n"
                for e in events:
                    date_str = e.event_date.strftime("%d.%m в %H:%M")
                    reply += f"• {date_str} — {e.title}\n"
                    if e.location:
                        reply += f"  📍 {e.location}\n"
            await send_telegram_message(chat_id, reply)

        elif text == "/month":
            now = datetime.utcnow()
            events = db.query(Event).filter(
                Event.is_active == True,
                Event.event_date >= now,
                Event.event_date <= now + timedelta(days=30)
            ).order_by(Event.event_date).all()
            if not events:
                reply = "📅 В ближайший месяц событий нет."
            else:
                reply = "📅 <b>События на месяц:</b>\n\n"
                for e in events:
                    date_str = e.event_date.strftime("%d.%m в %H:%M")
                    reply += f"• {date_str} — {e.title}\n"
                    if e.location:
                        reply += f"  📍 {e.location}\n"
            await send_telegram_message(chat_id, reply)

    finally:
        db.close()


@router.post(f"/webhook/{TELEGRAM_TOKEN}", include_in_schema=False)
async def telegram_webhook(request: Request):
    update = await request.json()
    await process_telegram_update(update)
    return {"ok": True}