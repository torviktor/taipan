"""Хендлеры бота в мессенджере MAX (id5034074017_bot).

Сессия 1: приём апдейтов, /start и привязка родителя через /link.
Остальные команды (/stop, /events, /week, /month, /news) — следующим шагом.

ПРО РАЗМЕТКУ. Сообщения уходят с format=html и узким набором тегов —
подробности и границы проверенного в app/services/max_bot.py. Коротко: API
принимает html и markdown, но НАБОР ТЕГОВ не валидирует вовсе, поэтому по
ответу сервера нельзя понять, отображается тег или показывается сырым.
Отсюда осторожность: <b>, <i>, <code> и не больше.

Всё, что приходит из базы — названия событий, места, заголовки новостей,
фамилии, — обязано проходить через esc(). Соревнование с «&» в названии
иначе ломает разбор разметки на стороне мессенджера.

ПРО АДРЕС ОТВЕТА. В личке отвечаем на sender.user_id, а не на
recipient.chat_id: см. подробности в app/services/max_bot.py.
"""
import hashlib
import logging
import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Request

from app.core.database import SessionLocal
from app.services.max_bot import esc

logger = logging.getLogger(__name__)
router = APIRouter()

SITE_URL = os.getenv("SITE_URL", "https://taipan-tkd.ru")


def webhook_secret() -> str:
    """Секретный сегмент пути вебхука.

    Телеграмный роут кладёт в путь сам токен. Для MAX так делать не хочется:
    адрес подписки хранится на стороне платформы и возвращается в открытом
    виде любым GET /subscriptions, то есть токен утёк бы в чужой лог. Поэтому
    берём необратимую производную — угадать её без токена нельзя, а нового
    секрета заводить и хранить не требуется.
    """
    token = os.getenv("MAX_BOT_TOKEN", "")
    return hashlib.sha256(f"max-webhook:{token}".encode()).hexdigest()[:32]


def webhook_url() -> str:
    """Полный адрес вебхука — тот же, что уходит в подписку при старте."""
    return f"{SITE_URL}/api/max/webhook/{webhook_secret()}"


COMMANDS = (
    "<b>Команды:</b>\n"
    "/start — подписаться на уведомления\n"
    "/stop — отписаться\n"
    "/events — ближайшее событие\n"
    "/week — события на неделю\n"
    "/month — события на месяц\n"
    "/news — последние новости\n"
    "/link НОМЕР — привязать аккаунт сайта"
)

WELCOME = (
    "🥋 <b>Добро пожаловать в клуб Тайпан!</b>\n"
    "г. Павловский Посад\n\n"
    "Вы подписаны на уведомления клуба.\n\n"
    f"{COMMANDS}\n\n"
    f"Сайт клуба: {SITE_URL}"
)

LINK_HELP = (
    "📱 Укажите номер телефона, которым вы зарегистрированы на сайте.\n\n"
    "Формат: <code>79998887766</code>\n"
    "(11 цифр, начиная с 7, без пробелов и плюса)\n\n"
    "Пример: <code>/link 79253653597</code>"
)

UNKNOWN = "Не понимаю эту команду.\n\n" + COMMANDS


def _fmt_event(e) -> str:
    """Одна строка события. Название и место — из БД, поэтому экранируются."""
    line = f"• {e.event_date:%d.%m в %H:%M} — {esc(e.title)}"
    if e.location:
        line += f"\n  📍 {esc(e.location)}"
    return line


def _events_between(db, days: int):
    """События от «сейчас» на days вперёд."""
    from app.models.event import Event
    now = datetime.utcnow()
    return (
        db.query(Event)
        .filter(
            Event.is_active == True,
            Event.event_date >= now,
            Event.event_date <= now + timedelta(days=days),
        )
        .order_by(Event.event_date)
        .all()
    )


def _cmd_events(db) -> str:
    from app.models.event import Event
    e = (
        db.query(Event)
        .filter(Event.is_active == True, Event.event_date > datetime.utcnow())
        .order_by(Event.event_date)
        .first()
    )
    if not e:
        return "📅 Ближайших событий нет."
    return "📅 <b>Ближайшее событие:</b>\n\n" + _fmt_event(e)


def _cmd_period(db, days: int, title: str, empty: str) -> str:
    events = _events_between(db, days)
    if not events:
        return empty
    return f"📅 <b>{title}</b>\n\n" + "\n".join(_fmt_event(e) for e in events)


def _cmd_news(db) -> str:
    from app.models.news import News
    items = (
        db.query(News)
        .filter(News.status == "published")
        .order_by(News.published_at.desc())
        .limit(3)
        .all()
    )
    if not items:
        return "📰 Новостей пока нет."
    body = "\n".join(f"• {n.published_at:%d.%m.%Y} — {esc(n.title)}" for n in items)
    return f"📰 <b>Последние новости клуба:</b>\n\n{body}\n\n🔗 Все новости: {SITE_URL}/news"


def _normalize_phone(raw: str) -> str:
    """Привести номер к виду 7XXXXXXXXXX — так же, как это делает Telegram."""
    phone = raw.strip().lstrip("+").lstrip("8")
    if len(phone) == 10 and phone.startswith("9"):
        phone = "7" + phone
    return phone


def _get_or_create(db, external_id: str, username: str, full_name: str):
    """Найти подписчика MAX или завести нового.

    Фильтр по platform обязателен: без него запрос поймал бы телеграмного
    подписчика с тем же числовым идентификатором и привязал бы аккаунт
    постороннему человеку.
    """
    from app.models.event import MessengerSubscriber

    sub = db.query(MessengerSubscriber).filter(
        MessengerSubscriber.platform == "max",
        MessengerSubscriber.external_id == external_id,
    ).first()

    if sub is None:
        sub = MessengerSubscriber(
            platform    = "max",
            external_id = external_id,
            username    = username or None,
            full_name   = full_name or None,
            subscribed  = True,
        )
        db.add(sub)
    return sub


def _handle_link(db, sub, user_id_max: str, text: str) -> str:
    """Привязка аккаунта сайта. Возвращает текст ответа."""
    from app.models.user import User, Athlete

    parts = text.split(maxsplit=1)
    if len(parts) < 2 or not parts[1].strip():
        return "Укажите номер телефона: /link 79998887766"

    phone = _normalize_phone(parts[1])

    user = (
        db.query(User).filter(User.phone == phone).first()
        or db.query(User).filter(User.phone == "7" + phone).first()
        or db.query(User).filter(User.phone == "8" + phone).first()
    )

    if not user:
        logger.info("MAX /link: пользователь с номером не найден (user_id=%s)", user_id_max)
        return (
            f"❌ Пользователь с номером <code>{esc(phone)}</code> не найден.\n\n"
            f"Проверьте номер — он должен совпадать с тем, которым вы "
            f"зарегистрированы на сайте {SITE_URL}"
        )

    # Строки подписчика может не быть: человек мог начать сразу с /link, минуя
    # /start. В телеграмной версии это когда-то приводило к молчаливому
    # пропуску привязки при внешне успешном ответе — здесь подписчик создаётся.
    sub.user_id = user.id
    sub.subscribed = True
    db.commit()

    athletes = db.query(Athlete).filter(
        Athlete.user_id == user.id,
        Athlete.is_archived == False,
    ).all()

    logger.info("MAX /link: аккаунт %s привязан к user_id=%s", user.id, user_id_max)

    if athletes:
        lst = "\n".join(f"• {esc(a.full_name)}" for a in athletes)
        return (
            f"✅ <b>Аккаунт успешно привязан!</b>\n\n"
            f"👤 {esc(user.full_name)}\n\n"
            f"🥋 Ваши спортсмены:\n{lst}\n\n"
            f"Теперь вы будете получать персональные уведомления "
            f"о соревнованиях, сборах и аттестациях."
        )
    return (
        f"✅ <b>Аккаунт успешно привязан!</b>\n\n"
        f"👤 {esc(user.full_name)}\n\n"
        f"Теперь вы будете получать персональные уведомления."
    )


def process_max_update(update: dict) -> None:
    """Разобрать один апдейт MAX.

    Обрабатываются два типа:
      * bot_started    — человек открыл диалог с ботом, аналог /start;
      * message_created — обычное сообщение.
    Остальные типы молча игнорируются: MAX присылает и служебные события,
    падать на них нельзя, иначе он сочтёт эндпоинт нерабочим и снимет подписку.
    """
    from app.services.max_bot import send_message_result

    kind = update.get("update_type") or update.get("updateType") or ""

    if kind == "bot_started":
        who = update.get("user") or {}
        external_id = str(who.get("user_id") or "")
        username    = who.get("username") or ""
        full_name   = (who.get("name") or "").strip()
        text        = "/start"
    elif kind == "message_created":
        message = update.get("message") or {}
        sender  = message.get("sender") or {}
        body    = message.get("body") or {}
        # Адрес ответа — отправитель, а не recipient.chat_id (см. шапку модуля).
        external_id = str(sender.get("user_id") or "")
        username    = sender.get("username") or ""
        full_name   = (sender.get("name") or "").strip()
        text        = (body.get("text") or "").strip()
    else:
        logger.debug("MAX: апдейт типа %r пропущен", kind)
        return

    if not external_id:
        logger.warning("MAX: апдейт без user_id отправителя, пропущен: %s", kind)
        return

    db = SessionLocal()
    try:
        sub = _get_or_create(db, external_id, username, full_name)

        if text == "/start":
            sub.subscribed = True
            db.commit()
            reply = WELCOME
        elif text == "/stop":
            sub.subscribed = False
            db.commit()
            reply = ("😔 Вы отписались от уведомлений.\n"
                     "Напишите /start, чтобы подписаться снова.")
        elif text == "/link":
            db.commit()
            reply = LINK_HELP
        elif text.startswith("/link "):
            reply = _handle_link(db, sub, external_id, text)
        else:
            db.commit()
            if text == "/events":
                reply = _cmd_events(db)
            elif text == "/week":
                reply = _cmd_period(db, 7, "События на неделю:",
                                    "📅 На этой неделе событий нет.")
            elif text == "/month":
                reply = _cmd_period(db, 30, "События на месяц:",
                                    "📅 В ближайший месяц событий нет.")
            elif text == "/news":
                reply = _cmd_news(db)
            else:
                reply = UNKNOWN

        status, err = send_message_result(external_id, reply)
        if status != "sent":
            logger.error("MAX: ответ не доставлен user_id=%s — %s", external_id, err)
    except Exception:
        db.rollback()
        logger.exception("MAX: обработка апдейта упала")
    finally:
        db.close()


@router.post("/webhook/{secret}", include_in_schema=False)
async def max_webhook(secret: str, request: Request):
    """Приём апдейтов от MAX.

    Отвечаем 200 всегда, когда секрет верен, — даже если разбор упал внутри.
    Платформа снимает подписку после 8 часов без успешных ответов, и потерять
    канал из-за одного кривого апдейта нельзя. Ошибки видны в логе.
    """
    if secret != webhook_secret():
        logger.warning("MAX: вебхук с неверным секретом, отклонён")
        return {"ok": False}

    try:
        update = await request.json()
    except Exception:
        logger.warning("MAX: тело вебхука не разобралось как JSON")
        return {"ok": True}

    process_max_update(update)
    return {"ok": True}
