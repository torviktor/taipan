"""
Telegram Bot хендлеры.
Пользователь пишет /start боту — подписывается на уведомления.
"""
import os
import logging
from fastapi import APIRouter, Request
from sqlalchemy.orm import Session
from app.core.database import SessionLocal

logger = logging.getLogger(__name__)
router = APIRouter()

TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")


async def process_telegram_update(update: dict):
    """Обрабатываем входящее сообщение от Telegram."""
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
        from app.models.event import TelegramSubscriber
        from app.services.notifications import send_telegram_message

        subscriber = db.query(TelegramSubscriber).filter(
            TelegramSubscriber.telegram_id == chat_id
        ).first()

        if text == "/start":
            if not subscriber:
                # Новый подписчик
                sub = TelegramSubscriber(
                    telegram_id = chat_id,
                    username    = username,
                    full_name   = full_name,
                    subscribed  = True,
                )
                db.add(sub)
                db.commit()
                reply = (
                    f"🥋 <b>Добро пожаловать в Тайпан!</b>\n\n"
                    f"Ты подписан на уведомления о событиях клуба.\n"
                    f"Мы будем напоминать о тренировках и соревнованиях.\n\n"
                    f"Команды:\n"
                    f"/start — подписаться\n"
                    f"/stop — отписаться\n"
                    f"/events — ближайшие события"
                )
            else:
                subscriber.subscribed = True
                db.commit()
                reply = "✅ Ты уже подписан на уведомления!"

            await send_telegram_message(chat_id, reply)

        elif text == "/stop":
            if subscriber:
                subscriber.subscribed = False
                db.commit()
            await send_telegram_message(
                chat_id,
                "😔 Ты отписался от уведомлений.\nНапиши /start чтобы подписаться снова."
            )

        elif text == "/events":
            # Показываем ближайшие события
            from app.models.event import Event
            from datetime import datetime
            events = db.query(Event).filter(
                Event.is_active  == True,
                Event.event_date >  datetime.utcnow()
            ).order_by(Event.event_date).limit(5).all()

            if not events:
                reply = "📅 Ближайших событий нет."
            else:
                reply = "📅 <b>Ближайшие события:</b>\n\n"
                for e in events:
                    date_str = e.event_date.strftime("%d.%m в %H:%M")
                    reply += f"• {date_str} — {e.title}\n"
                    if e.location:
                        reply += f"  📍 {e.location}\n"

            await send_telegram_message(chat_id, reply)

    finally:
        db.close()


# ─── Webhook endpoint для Telegram ───────────────────────────────────────────

@router.post(f"/webhook/{TELEGRAM_TOKEN}", include_in_schema=False)
async def telegram_webhook(request: Request):
    """Telegram отправляет сюда все сообщения боту."""
    update = await request.json()
    await process_telegram_update(update)
    return {"ok": True}


async def set_webhook(base_url: str):
    """Регистрируем webhook в Telegram при запуске приложения."""
    import httpx
    webhook_url = f"{base_url}/api/telegram/webhook/{TELEGRAM_TOKEN}"
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/setWebhook"

    async with httpx.AsyncClient() as client:
        r = await client.post(url, json={"url": webhook_url})
        data = r.json()
        if data.get("ok"):
            logger.info(f"Telegram webhook установлен: {webhook_url}")
        else:
            logger.error(f"Ошибка webhook: {data}")
