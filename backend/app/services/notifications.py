"""
Сервис уведомлений:
- Telegram Bot (aiogram) — уведомления подписчикам
- Web Push — уведомления в браузере
- schedule_reminders — планирование задач
"""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional
import os

logger = logging.getLogger(__name__)

TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
CHANNEL_ID     = os.getenv("TELEGRAM_CHANNEL_ID", "")
BOT_USERNAME   = "taipan_tkd_bot"

# ─── Telegram Bot ─────────────────────────────────────────────────────────────

async def send_telegram_message(chat_id: str, text: str) -> bool:
    """Отправить сообщение в Telegram."""
    try:
        import httpx
        url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
        async with httpx.AsyncClient() as client:
            r = await client.post(url, json={
                "chat_id":    chat_id,
                "text":       text,
                "parse_mode": "HTML",
            })
            return r.status_code == 200
    except Exception as e:
        logger.error(f"Telegram error: {e}")
        return False


async def send_telegram_photo(chat_id: str, photo_url: str, caption: str) -> bool:
    """Отправить фото с подписью в Telegram."""
    try:
        import httpx
        url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendPhoto"
        async with httpx.AsyncClient() as client:
            r = await client.post(url, json={
                "chat_id":    chat_id,
                "photo":      photo_url,
                "caption":    caption,
                "parse_mode": "HTML",
            })
            return r.status_code == 200
    except Exception as e:
        logger.error(f"Telegram photo error: {e}")
        return False


async def notify_channel(text: str) -> bool:
    """Отправить сообщение в Telegram-канал клуба."""
    if not CHANNEL_ID:
        return False
    return await send_telegram_message(CHANNEL_ID, text)


async def notify_news_telegram(title: str, body: Optional[str] = None, photo_url: Optional[str] = None):
    """Отправить новость только в канал (без рассылки подписчикам)."""
    print(f"DEBUG notify_news_telegram called: title={title}, photo_url={photo_url}")
    print(f"DEBUG CHANNEL_ID={CHANNEL_ID}, TELEGRAM_TOKEN exists={bool(TELEGRAM_TOKEN)}")

    caption = (
        f"📰 <b>Новость клуба Тайпан</b>\n\n"
        f"<b>{title}</b>\n\n"
        f"{body[:800] if body else ''}\n\n"
        f"🔗 Читать полностью: https://taipan-tkd.ru/news"
    )
    if len(caption) > 1024:
        caption = caption[:1020] + "..."

    print(f"DEBUG caption length={len(caption)}")

    try:
        if photo_url:
            print(f"DEBUG sending photo to channel: {photo_url}")
            result = await send_telegram_photo(CHANNEL_ID, photo_url, caption)
        else:
            print(f"DEBUG sending text to channel: {CHANNEL_ID}")
            result = await send_telegram_message(CHANNEL_ID, caption)
        print(f"DEBUG notify result: {result}")
    except Exception as e:
        print(f"DEBUG notify_news_telegram ERROR: {e}")
        import traceback
        traceback.print_exc()


async def notify_all_subscribers(db, message: str):
    """Отправить личное уведомление подписчикам с привязанным аккаунтом."""
    from app.models.event import TelegramSubscriber
    subscribers = db.query(TelegramSubscriber).filter(
        TelegramSubscriber.subscribed == True,
        TelegramSubscriber.user_id    != None,
    ).all()

    sent = 0
    for sub in subscribers:
        ok = await send_telegram_message(sub.telegram_id, message)
        if ok:
            sent += 1

    logger.info(f"Telegram: отправлено {sent}/{len(subscribers)}")
    return sent


def build_reminder_message(event, days_before: int) -> str:
    """Сформировать текст напоминания."""
    date_str = event.event_date.strftime("%d.%m.%Y в %H:%M")

    if days_before == 0:
        when = "⏰ <b>СЕГОДНЯ</b>"
    elif days_before == 1:
        when = "📅 <b>ЗАВТРА</b>"
    else:
        when = f"📅 Через <b>{days_before} дней</b>"

    text = (
        f"🥋 <b>Тайпан — Напоминание</b>\n\n"
        f"{when}\n"
        f"<b>{event.title}</b>\n\n"
        f"🗓 {date_str}\n"
    )

    if event.location:
        text += f"📍 {event.location}\n"
    if event.description:
        text += f"\n{event.description}\n"

    text += f"\n<a href='https://t.me/{BOT_USERNAME}'>Открыть в боте</a>"
    return text


# ─── Планирование напоминаний ──────────────────────────────────────────────────

def schedule_reminders(event):
    """
    Планируем напоминания для события.
    Используем простой подход: сохраняем в БД,
    Celery воркер проверяет каждые 10 минут.
    """
    logger.info(
        f"Запланированы напоминания для '{event.title}': "
        f"за {event.notify_before_days} дней"
    )


# ─── Celery задача (запускается по расписанию) ────────────────────────────────

def check_and_send_reminders(db):
    """
    Проверяет нужно ли отправить напоминания.
    Запускается каждые 10 минут через Celery Beat.
    """
    from app.models.event import Event, EventReminder

    now    = datetime.utcnow()
    events = db.query(Event).filter(
        Event.is_active   == True,
        Event.event_date  >  now,
    ).all()

    for event in events:
        if not event.notify_before_days:
            continue

        for days in event.notify_before_days:
            # Когда нужно отправить напоминание
            remind_at = event.event_date - timedelta(days=days)

            # Уже отправляли?
            already_sent = db.query(EventReminder).filter(
                EventReminder.event_id    == event.id,
                EventReminder.days_before == days,
            ).first()

            if already_sent:
                continue

            # Пора отправлять? (±10 минут)
            diff = abs((remind_at - now).total_seconds())
            if diff <= 600:
                message = build_reminder_message(event, days)

                # Отправляем в Telegram
                sent_count = asyncio.run(notify_all_subscribers(db, message))

                # Фиксируем что отправили
                reminder = EventReminder(
                    event_id    = event.id,
                    days_before = days,
                    sent_count  = sent_count,
                )
                db.add(reminder)
                db.commit()
                logger.info(f"Напоминание отправлено: {event.title}, за {days} дней")
