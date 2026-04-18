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
                "🥋 <b>Добро пожаловать в клуб Тайпан!</b>\n"
                "г. Павловский Посад\n\n"
                "Вы подписаны на уведомления клуба.\n\n"
                "<b>Команды:</b>\n"
                "/start — подписаться на уведомления\n"
                "/stop — отписаться\n"
                "/events — ближайшее событие\n"
                "/week — события на неделю\n"
                "/month — события на месяц\n"
                "/news — последние новости\n"
                "/link НОМЕР — привязать аккаунт сайта\n\n"
                "📢 Наш канал: t.me/taipan_tkd"
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

        elif text == "/news":
            from app.models.news import News
            news_list = db.query(News).filter(
                News.is_published == True
            ).order_by(News.published_at.desc()).limit(3).all()
            if not news_list:
                reply = "📰 Новостей пока нет."
            else:
                reply = "📰 <b>Последние новости клуба:</b>\n\n"
                for n in news_list:
                    date_str = n.published_at.strftime("%d.%m.%Y")
                    reply += f"• {date_str} — {n.title}\n"
                reply += "\n🔗 Все новости: https://taipan-tkd.ru/news"
            await send_telegram_message(chat_id, reply)

        elif text == "/link":
            await send_telegram_message(chat_id,
                "📱 Введите номер телефона которым зарегистрированы на сайте.\n\n"
                "Формат: <code>79998887766</code>\n"
                "(11 цифр, начиная с 7, без пробелов и плюса)\n\n"
                "Пример: <code>/link 79253653597</code>"
            )

        elif text.startswith("/link "):
            parts = text.split(maxsplit=1)
            if len(parts) < 2:
                await send_telegram_message(chat_id,
                    "Укажите номер телефона: /link 79998887766")
            else:
                phone = parts[1].strip().lstrip('+').lstrip('8')
                if len(phone) == 10 and phone.startswith('9'):
                    phone = '7' + phone

                print(f"DEBUG /link: searching phone={phone}")

                from app.models.user import User, Athlete
                user = (
                    db.query(User).filter(User.phone == phone).first() or
                    db.query(User).filter(User.phone == '7' + phone).first() or
                    db.query(User).filter(User.phone == '8' + phone).first()
                )

                print(f"DEBUG /link: user found={user is not None}, phone tried={phone}")

                if not user:
                    await send_telegram_message(chat_id,
                        f"❌ Пользователь с номером <code>{phone}</code> не найден.\n\n"
                        f"Проверьте номер — он должен совпадать с тем, "
                        f"которым вы зарегистрированы на сайте taipan-tkd.ru"
                    )
                else:
                    if subscriber:
                        subscriber.user_id = user.id
                        db.commit()

                    athletes = db.query(Athlete).filter(
                        Athlete.user_id == user.id,
                        Athlete.is_archived == False
                    ).all()

                    if athletes:
                        athletes_text = "\n".join([f"• {a.full_name}" for a in athletes])
                        reply = (
                            f"✅ Аккаунт успешно привязан!\n\n"
                            f"👤 {user.full_name}\n\n"
                            f"🥋 Ваши спортсмены:\n{athletes_text}\n\n"
                            f"Теперь вы будете получать персональные уведомления "
                            f"о соревнованиях, сборах и аттестациях."
                        )
                    else:
                        reply = (
                            f"✅ Аккаунт успешно привязан!\n\n"
                            f"👤 {user.full_name}\n\n"
                            f"Теперь вы будете получать персональные уведомления."
                        )

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