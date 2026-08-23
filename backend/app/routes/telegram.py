"""
Telegram Bot хендлеры.
"""
import os
import logging
from fastapi import APIRouter, Request
from app.core.database import SessionLocal
from app.core.markup import esc

logger = logging.getLogger(__name__)
router = APIRouter()

TELEGRAM_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")


CONTACT_KEYBOARD = {
    "keyboard": [[{"text": "📱 Поделиться контактом", "request_contact": True}]],
    "resize_keyboard": True,
    "one_time_keyboard": True,
}

# Убирает клавиатуру после привязки: кнопка «поделиться контактом» больше не
# нужна и только мешала бы полю ввода.
HIDE_KEYBOARD = {"remove_keyboard": True}

# Служебные команды тренера. Как и в MAX, они нигде не публикуются:
# в /start родителю о них не сказано, а право проверяется по роли.
STAFF_COMMANDS = ("/subs", "/unlinked", "/invite")


async def _handle_contact(db, message: dict, chat_id: str) -> bool:
    """Обработать вложенный контакт. True — сообщение было контактом.

    ПРОВЕРКА ПРИНАДЛЕЖНОСТИ ОБЯЗАТЕЛЬНА. Контакт можно переслать: без сверки
    любой переслал бы боту карточку соседа и привязал к себе чужой аккаунт —
    чужих детей, взносы и уведомления. Telegram кладёт в contact.user_id
    идентификатор владельца карточки; у собственного контакта он равен id
    отправителя, у пересланного — нет либо отсутствует вовсе.
    """
    contact = message.get("contact")
    if not contact:
        return False

    from app.services import binding
    from app.services.notifications import send_telegram_message

    sender_id = str((message.get("from") or {}).get("id") or "")
    owner_id  = str(contact.get("user_id") or "")

    # Факт получения пишем ВСЕГДА, до решений: иначе успешный путь «вы уже
    # привязаны» не оставляет в логе ничего, и не отличить нажатие кнопки от
    # его отсутствия.
    logger.info("Telegram: получен контакт от chat_id=%s (владелец карточки %s)",
                chat_id, owner_id or "не указан")

    if not owner_id or owner_id != sender_id:
        logger.warning(
            "Telegram: контакт отклонён — карточка принадлежит %r, прислал %r "
            "(похоже на пересланный чужой контакт)", owner_id or "неизвестно", sender_id)
        await send_telegram_message(chat_id, (
            "🔗 Этот контакт не ваш.\n\n"
            "Привязать можно только собственный номер — нажмите кнопку "
            "«Поделиться контактом» под полем ввода.\n\n"
            "Если номер в мессенджере не тот, которым вы регистрировались на "
            "сайте, отправьте нужный вручную: <code>/link 79998887766</code>"
        ))
        return True

    phone = contact.get("phone_number") or ""
    user, reason = binding.bind_by_phone(db, "telegram", chat_id, phone)

    if reason in (binding.OK, binding.REBOUND):
        text = binding.success_text(db, user)
        if reason == binding.REBOUND:
            text += ("\n\n⚠️ Раньше этот мессенджер был привязан к другой "
                     "учётной записи — теперь она отвязана.")
        await send_telegram_message(chat_id, text, reply_markup=HIDE_KEYBOARD)
    elif reason == binding.NOT_FOUND:
        await send_telegram_message(chat_id, binding.BIND_TEXT[binding.NOT_FOUND].format(
            phone=esc(binding.normalize_phone(phone))))
    else:
        await send_telegram_message(chat_id, binding.BIND_TEXT[reason].format(
            name=esc(user.full_name)), reply_markup=HIDE_KEYBOARD)
    return True


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

    # Первое слово сообщения: по нему разбираются команды с хвостом,
    # например «/invite Абрамова».
    cmd = text.split()[0] if text else ""

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

        # Нажатие «Поделиться контактом» приходит без текста, поэтому
        # разбирается раньше команд.
        if await _handle_contact(db, message, chat_id):
            return

        if text.startswith("/start"):
            if not subscriber:
                subscriber = TelegramSubscriber(telegram_id=chat_id, username=username,
                                                full_name=full_name, subscribed=True)
                db.add(subscriber)
                db.commit()
            else:
                subscriber.subscribed = True
                db.commit()

            # Переход по персональной ссылке t.me/бот?start=lnk_ТОКЕН приходит
            # обычным сообщением «/start lnk_ТОКЕН». Ручной /link с номером
            # остаётся запасным путём и ниже не меняется.
            parts = text.split(maxsplit=1)
            payload = parts[1].strip() if len(parts) > 1 else ""
            from app.services import link_tokens
            if link_tokens.is_link_payload(payload):
                await send_telegram_message(
                    chat_id,
                    link_tokens.redeem_and_reply(db, payload, "telegram", chat_id),
                )
                return

            # Пришёл по общей ссылке и ещё не привязан — просим контакт.
            # Список команд ему сейчас бесполезен: без привязки персональных
            # уведомлений не будет, а события видны и на сайте.
            if not subscriber.user_id:
                from app.services.binding import ASK_CONTACT
                await send_telegram_message(chat_id, ASK_CONTACT,
                                            reply_markup=CONTACT_KEYBOARD)
                return

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
                "/link НОМЕР — привязать аккаунт сайта\n"
                "/unlink — отвязать аккаунт\n\n"
                "📢 Наш канал: t.me/taipan_tkd"
            )
            await send_telegram_message(chat_id, reply)

        elif text == "/stop":
            if subscriber:
                subscriber.subscribed = False
                db.commit()
            # Разницу называем прямо: /stop оставляет связь с учётной записью,
            # и одного /start хватит, чтобы уведомления пошли снова.
            await send_telegram_message(chat_id,
                "😔 Ты отписался от уведомлений.\n"
                "Напиши /start чтобы подписаться снова.\n\n"
                "Связь с учётной записью при этом сохранена. Чтобы разорвать "
                "её совсем — /unlink")

        elif text == "/unlink":
            from app.services import binding
            await send_telegram_message(chat_id,
                                        binding.unlink(db, "telegram", chat_id),
                                        reply_markup=HIDE_KEYBOARD)

        elif text == "/events":
            e = db.query(Event).filter(
                Event.is_active == True,
                Event.event_date > datetime.utcnow()
            ).order_by(Event.event_date).first()
            if not e:
                reply = "📅 Ближайших событий нет."
            else:
                date_str = e.event_date.strftime("%d.%m в %H:%M")
                reply = f"📅 <b>Ближайшее событие:</b>\n\n• {date_str} — {esc(e.title)}"
                if e.location:
                    reply += f"\n  📍 {esc(e.location)}"
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
                    reply += f"• {date_str} — {esc(e.title)}\n"
                    if e.location:
                        reply += f"  📍 {esc(e.location)}\n"
            await send_telegram_message(chat_id, reply)

        elif text == "/news":
            from app.models.news import News
            news_list = db.query(News).filter(
                News.status == 'published'
            ).order_by(News.published_at.desc()).limit(3).all()
            if not news_list:
                reply = "📰 Новостей пока нет."
            else:
                reply = "📰 <b>Последние новости клуба:</b>\n\n"
                for n in news_list:
                    date_str = n.published_at.strftime("%d.%m.%Y")
                    reply += f"• {date_str} — {esc(n.title)}\n"
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
            # Запасной путь: основной — кнопка «Поделиться контактом».
            # Идёт через тот же binding.bind_by_phone, что и кнопка, и что бот
            # в MAX. Раньше здесь была своя нормализация номера, свой поиск
            # тремя вариантами написания и молчаливая перепривязка, если
            # аккаунт уже занят другим подписчиком.
            from app.services import binding

            if not subscriber:
                subscriber = TelegramSubscriber(
                    telegram_id=chat_id, username=username,
                    full_name=full_name, subscribed=True,
                )
                db.add(subscriber)
                db.commit()

            raw = text.split(maxsplit=1)[1].strip()
            user, reason = binding.bind_by_phone(db, "telegram", chat_id, raw)

            if reason == binding.OK:
                await send_telegram_message(chat_id, binding.success_text(db, user),
                                            reply_markup=HIDE_KEYBOARD)
            elif reason == binding.NOT_FOUND:
                await send_telegram_message(chat_id, binding.BIND_TEXT[binding.NOT_FOUND].format(
                    phone=esc(binding.normalize_phone(raw))))
            else:
                await send_telegram_message(chat_id, binding.BIND_TEXT[reason].format(
                    name=esc(user.full_name)), reply_markup=HIDE_KEYBOARD)

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
                    reply += f"• {date_str} — {esc(e.title)}\n"
                    if e.location:
                        reply += f"  📍 {esc(e.location)}\n"
            await send_telegram_message(chat_id, reply)

        elif cmd in STAFF_COMMANDS:
            # Служебные. Право проверяется по РОЛИ, а не по площадке. Родителю
            # отвечаем ровно тем же, чем на любую другую неизвестную команду —
            # молчанием: иначе ответ подтверждал бы, что команда существует.
            from app.services import reach
            from app.services.max_bot import split_text

            if not (subscriber and reach.is_staff(db, subscriber.user_id)):
                logger.info("Telegram: %s от непривилегированного chat_id=%s",
                            cmd, chat_id)
                return

            if cmd == "/subs":
                reply = reach.format_summary(db)
            elif cmd == "/unlinked":
                reply = reach.format_unlinked(db)
            else:
                parts = text.split(maxsplit=1)
                reply = reach.format_invite(db, parts[1] if len(parts) > 1 else "")

            # Список непривязанных может перерасти лимит Telegram (4096),
            # поэтому режем тем же split_text — по границам строк.
            for part in split_text(reply, 4000):
                await send_telegram_message(chat_id, part)

    finally:
        db.close()


@router.post(f"/webhook/{TELEGRAM_TOKEN}", include_in_schema=False)
async def telegram_webhook(request: Request):
    update = await request.json()
    await process_telegram_update(update)
    return {"ok": True}