"""Хендлеры бота в мессенджере MAX (id5034074017_bot).

Приём апдейтов, команды и кнопки под сообщением.

ПРО ЕДИНСТВО КОМАНД И КНОПОК. Список того, что бот умеет, живёт в одном
месте — ACTIONS. Текстовая команда и нажатие кнопки разрешаются в одно и то
же имя действия и исполняются одной функцией run_action. Развилки «если
кнопка, то одно, если команда — другое» здесь нет намеренно: два пути к
одному результату однажды разъезжаются в поведении.

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


# ─── Действия ────────────────────────────────────────────────────────────────
#
# Единственный список того, что бот умеет. И текстовая команда, и нажатие
# кнопки разрешаются в одно и то же имя действия и выполняются одним кодом —
# иначе кнопка и команда неизбежно разошлись бы в поведении.
#
# Ключ — имя действия, оно же payload кнопки (предел MAX — 1024 символа,
# наши имена короткие). Значение — что показать в меню команд бота.

ACTIONS = {
    "start":    "Подписаться на уведомления",
    "events":   "Ближайшее событие",
    "week":     "События на неделю",
    "month":    "События на месяц",
    "news":     "Последние новости клуба",
    "children": "Мои спортсмены",
    "link":     "Привязать аккаунт сайта",
    "stop":     "Отписаться от уведомлений",
}

# Служебное — отдельно от ACTIONS и намеренно.
#
# Меню команд в карточке бота одно на всех: PATCH /me/commands не умеет
# показывать разным людям разное. Значит, попади «subs» в ACTIONS, родители
# увидели бы её в списке команд бота. Поэтому служебные действия живут своим
# словарём: они исполняются, но нигде не рекламируются.
#
# Само право проверяется в run_action по роли, а не по тому, откуда пришёл
# вызов: спрятанная кнопка — не защита, команду можно набрать руками.
STAFF_ACTIONS = {
    "subs": "Охват подписок",
}

# Команды, которые бот принимает текстом. Отдельная таблица, потому что
# /link умеет ещё и форму «/link НОМЕР», разбираемую особо.
COMMAND_ALIASES = {f"/{name}": name for name in list(ACTIONS) + list(STAFF_ACTIONS)}


# Список для человека собирается из ACTIONS, а не пишется рядом: две
# независимые копии однажды разошлись бы, и бот рассказывал бы о командах,
# которых у него нет.
COMMANDS = "<b>Команды:</b>\n" + "\n".join(
    f"/{name} — {descr}" for name, descr in ACTIONS.items()
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




def main_keyboard(sub=None) -> list:
    """Клавиатура основных действий.

    Ряды короткие намеренно: подписи с эмодзи на узком экране переносятся, и
    четыре кнопки в ряд превращаются в кашу. Пределы MAX (7 в ряду, 30 рядов)
    здесь далеко не достигаются.

    Расписание — кнопка-ссылка, а не действие: таблица schedule в базе пуста,
    и команда показывала бы пустоту, тогда как страница сайта работает.
    """
    from app.services.max_bot import callback_button, link_button

    rows = [
        [callback_button("📅 Ближайшее", "events"),
         callback_button("🗓 Неделя", "week")],
        [callback_button("📆 Месяц", "month"),
         callback_button("📰 Новости", "news")],
        [callback_button("🥋 Мои спортсмены", "children")],
        [link_button("🏫 Расписание", f"{SITE_URL}/schedule")],
    ]

    # Служебная кнопка — только тренерам и админам. Родитель её не видит.
    # Это удобство, а не защита: право всё равно проверяется при исполнении,
    # иначе достаточно было бы набрать /subs руками.
    if sub is not None and _db_of(sub) is not None:
        from app.services.reach import is_staff
        if is_staff(_db_of(sub), sub.user_id):
            rows.append([callback_button("📊 Подписки", "subs")])

    return rows


def _db_of(sub):
    """Сессия, которой принадлежит объект. Нужна, чтобы собрать клавиатуру,
    не таща сессию отдельным параметром через полдюжины вызовов."""
    from sqlalchemy.orm import object_session
    try:
        return object_session(sub)
    except Exception:
        return None


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


def _cmd_children(db, sub) -> str:
    """Спортсмены, привязанные к аккаунту нажавшего."""
    from app.models.user import User, Athlete

    if not sub.user_id:
        return (
            "🔗 Аккаунт сайта пока не привязан.\n\n"
            "Отправьте <code>/link НОМЕР</code> — тот номер телефона, которым "
            f"вы зарегистрированы на {SITE_URL}.\n\n"
            "Пример: <code>/link 79253653597</code>"
        )

    user = db.query(User).filter(User.id == sub.user_id).first()
    athletes = (
        db.query(Athlete)
        .filter(Athlete.user_id == sub.user_id, Athlete.is_archived == False)
        .all()
    )
    if not athletes:
        return (f"👤 {esc(user.full_name) if user else 'Аккаунт'}\n\n"
                "🥋 За вами пока не закреплено ни одного спортсмена.\n"
                "Если это ошибка — скажите тренеру.")

    lines = []
    for a in athletes:
        rank = ""
        if getattr(a, "dan", None):
            rank = f" — {a.dan} дан"
        elif getattr(a, "gup", None):
            rank = f" — {a.gup} гып"
        lines.append(f"• {esc(a.full_name)}{rank}")

    return (f"👤 {esc(user.full_name) if user else 'Ваш аккаунт'}\n\n"
            f"🥋 <b>Ваши спортсмены:</b>\n" + "\n".join(lines))


def _cmd_subs(db) -> str:
    """Охват уведомлений: кого догонять. Текст общий с телеграмным ботом."""
    from app.services.reach import format_report
    return format_report(db)


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

    # Тренерам — только на УСПЕШНУЮ привязку. На /start не шлём: его пишет
    # любой, кто открыл бота, и такие сообщения быстро научили бы тренера их
    # пролистывать. Падение здесь не должно ломать саму привязку, поэтому
    # notify_staff_new_link глушит ошибки внутри себя.
    from app.services.reach import notify_staff_new_link
    notify_staff_new_link(db, user, "max", [a.full_name for a in athletes])

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


def run_action(action: str, db, sub, raw_text: str = "") -> str:
    """Выполнить действие и вернуть текст ответа.

    ЕДИНСТВЕННОЕ место, где действия исполняются. Сюда приходят и текстовые
    команды, и нажатия кнопок: у кнопки payload — это ровно имя действия.
    Развилка «если кнопка, то одно, если команда — другое» отсутствует
    намеренно, иначе поведение двух путей однажды разъедется.

    raw_text нужен единственному действию — /link с номером в той же строке.
    """
    if action == "start":
        sub.subscribed = True
        db.commit()

        # Переход по персональной ссылке: параметр приходит либо в bot_started
        # (тогда raw_text — это он сам), либо текстом «/start lnk_…».
        payload = raw_text
        if payload.startswith("/start "):
            payload = payload.split(maxsplit=1)[1].strip()

        from app.services import link_tokens
        if link_tokens.is_link_payload(payload):
            return link_tokens.redeem_and_reply(db, payload, "max", sub.external_id)

        return WELCOME

    if action == "stop":
        sub.subscribed = False
        db.commit()
        return ("😔 Вы отписались от уведомлений.\n"
                "Напишите /start или нажмите кнопку, чтобы подписаться снова.")

    if action == "link":
        # «/link 79…» — сразу привязка, «/link» и кнопка — подсказка.
        if raw_text.startswith("/link "):
            return _handle_link(db, sub, sub.external_id, raw_text)
        db.commit()
        return LINK_HELP

    db.commit()

    if action == "events":
        return _cmd_events(db)
    if action == "week":
        return _cmd_period(db, 7, "События на неделю:",
                           "📅 На этой неделе событий нет.")
    if action == "month":
        return _cmd_period(db, 30, "События на месяц:",
                           "📅 В ближайший месяц событий нет.")
    if action == "news":
        return _cmd_news(db)
    if action == "children":
        return _cmd_children(db, sub)

    if action == "subs":
        # Родителю отвечаем ровно тем же, чем на любую белиберду: не «у вас нет
        # прав», а «не понимаю команду». Иначе ответ подтверждал бы, что такая
        # команда существует, и приглашал бы её поперебирать.
        from app.services.reach import is_staff
        if not is_staff(db, sub.user_id):
            logger.info("MAX: /subs от непривилегированного user_id=%s", sub.external_id)
            return UNKNOWN
        return _cmd_subs(db)

    return UNKNOWN


def _resolve(kind: str, update: dict):
    """Достать из апдейта отправителя и то, что он хочет.

    Возвращает (external_id, username, full_name, action, raw_text,
    callback_id) либо None, если апдейт нам не адресован.
    """
    if kind == "bot_started":
        who = update.get("user") or {}
        # Переход по персональной ссылке привязки. Параметр лежит на верхнем
        # уровне апдейта (поле payload у BotStarted), а не внутри user.
        payload = (update.get("payload") or "").strip()
        return (str(who.get("user_id") or ""), who.get("username") or "",
                (who.get("name") or "").strip(), "start", payload, None)

    if kind == "message_created":
        message = update.get("message") or {}
        sender  = message.get("sender") or {}
        body    = message.get("body") or {}
        # Адрес ответа — отправитель, а не recipient.chat_id (см. шапку модуля).
        text = (body.get("text") or "").strip()
        # «/link 79…» и «/start lnk_…» доходят до run_action как есть,
        # остальное разрешается по таблице.
        action = COMMAND_ALIASES.get(text.split()[0] if text else "", "")
        return (str(sender.get("user_id") or ""), sender.get("username") or "",
                (sender.get("name") or "").strip(), action, text, None)

    if kind == "message_callback":
        cb = update.get("callback") or {}
        who = cb.get("user") or (update.get("message") or {}).get("sender") or {}
        return (str(who.get("user_id") or ""), who.get("username") or "",
                (who.get("name") or "").strip(),
                (cb.get("payload") or "").strip(), "",
                cb.get("callback_id"))

    return None


def process_max_update(update: dict) -> None:
    """Разобрать один апдейт MAX.

    Обрабатываются три типа:
      * bot_started     — человек открыл диалог с ботом, аналог /start;
      * message_created — обычное сообщение;
      * message_callback — нажата кнопка под сообщением.
    Остальные типы молча игнорируются: MAX присылает и служебные события,
    падать на них нельзя, иначе он сочтёт эндпоинт нерабочим и снимет подписку.
    """
    from app.services.max_bot import send_message_result, answer_callback

    kind = update.get("update_type") or update.get("updateType") or ""
    resolved = _resolve(kind, update)
    if resolved is None:
        logger.debug("MAX: апдейт типа %r пропущен", kind)
        return

    external_id, username, full_name, action, raw_text, callback_id = resolved

    if not external_id:
        logger.warning("MAX: апдейт без user_id отправителя, пропущен: %s", kind)
        return

    # Подтверждаем нажатие сразу, до работы с базой: у нажавшего иначе висит
    # индикатор ожидания всё время, пока мы ходим в БД и собираем ответ.
    if callback_id:
        answer_callback(callback_id)

    db = SessionLocal()
    try:
        sub = _get_or_create(db, external_id, username, full_name)
        reply = run_action(action, db, sub, raw_text)

        # Успешная обработка раньше не оставляла в логе НИЧЕГО: писались только
        # ошибки. Из-за этого по логу нельзя было отличить «нажатие не дошло»
        # от «дошло и отработало» — при разборе первого же нажатия это сразу
        # оказалось неудобно. Строка короткая, на объём лога не влияет.
        logger.info("MAX: %s от user_id=%s -> действие %r",
                    "нажатие" if callback_id else "сообщение",
                    external_id, action or "(неизвестное)")

        # Кнопки показываем под каждым ответом: разговор с ботом идёт с
        # телефона, и набирать «/month» руками там неудобно.
        status, err = send_message_result(external_id, reply,
                                          buttons=main_keyboard(sub))
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
