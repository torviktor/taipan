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
    "start":       "Подписаться на уведомления",
    "children":    "Мои спортсмены",
    "rating":      "Рейтинг ребёнка",
    "achievements": "Достижения ребёнка",
    "fees":        "Взносы за месяц",
    "attendance":  "Посещаемость за месяц",
    "insurance":   "Страховка ребёнка",
    "competitions": "Соревнования и медали",
    "events":      "Ближайшее событие",
    "week":        "События на неделю",
    "month":       "События на месяц",
    "news":        "Последние новости клуба",
    "link":        "Привязать аккаунт сайта",
    "stop":        "Отписаться от уведомлений",
    "unlink":      "Отвязать аккаунт сайта",
}

# Действия, которым нужен привязанный аккаунт: они про КОНКРЕТНОГО ребёнка.
# Без привязки бот не знает, чей ребёнок, и честнее сказать это, чем показать
# пустоту.
NEEDS_ACCOUNT = ("children", "rating", "achievements", "fees", "attendance",
                 "insurance", "competitions")

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
    "subs":      "Охват подписок",
    "unlinked":  "Кто не привязан",
    "invite":    "Персональная ссылка для одного",
    "insurance_club": "Страховки по клубу",
}

# Внутренние имена: их нельзя набрать текстом, они возникают только из
# вложения с контактом. Поэтому и в ACTIONS, и в COMMAND_ALIASES их нет.
CONTACT_ACTION   = "__contact__"
CONTACT_REJECTED = "__contact_rejected__"

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

_NEED_ACCOUNT = (
    "🔗 Сначала нужно привязать аккаунт сайта — иначе я не знаю, о чьём "
    "ребёнке рассказывать.\n\n"
    "Нажмите /start и кнопку «📱 Поделиться контактом».\n\n"
    "Если номер в мессенджере отличается от того, которым вы регистрировались "
    "на сайте — отправьте нужный вручную: <code>/link</code> и через пробел "
    "ваш номер с сайта."
)




def main_keyboard(sub=None) -> list:
    """Клавиатура основных действий.

    Ряды короткие намеренно: подписи с эмодзи на узком экране переносятся, и
    четыре кнопки в ряд превращаются в кашу. Пределы MAX (7 в ряду, 30 рядов)
    здесь далеко не достигаются.

    Расписание — кнопка-ссылка, а не действие: таблица schedule в базе пуста,
    и команда показывала бы пустоту, тогда как страница сайта работает.
    """
    from app.services.max_bot import callback_button, link_button, request_contact_button

    # Пока человек не привязан, всё остальное для него бесполезно: события он
    # и так видит на сайте, а персональных уведомлений без привязки не будет.
    # Поэтому одна кнопка и никакого выбора — так меньше поводов не дойти.
    if sub is not None and not sub.user_id:
        return [[request_contact_button("📱 Поделиться контактом")]]

    # Порядок: сначала про своего ребёнка, потом про клуб.
    #
    # Второй уровень («Мой ребёнок» → подменю) я взвесил и отклонил. Бот
    # открывают редко, и то, что спрятано за лишним нажатием, родители просто
    # не найдут: половина из них узнает о существовании раздела только увидев
    # кнопку. Плоский список длиннее, но ничего не прячет, а группировку даёт
    # порядок строк — личное сверху, общее снизу.
    rows = [
        [callback_button("🏆 Рейтинг", "rating"),
         callback_button("🎖 Достижения", "achievements")],
        [callback_button("💰 Взносы", "fees"),
         callback_button("📊 Посещаемость", "attendance")],
        [callback_button("🏅 Соревнования", "competitions"),
         callback_button("🛡 Страховка", "insurance")],
        [callback_button("🥋 Мои спортсмены", "children")],

        [callback_button("📅 Ближайшее", "events"),
         callback_button("🗓 Неделя", "week")],
        [callback_button("📆 Месяц", "month"),
         callback_button("📰 Новости", "news")],
        [link_button("🏫 Расписание", f"{SITE_URL}/schedule")],
    ]

    # Служебная кнопка — только тренерам и админам. Родитель её не видит.
    # Это удобство, а не защита: право всё равно проверяется при исполнении,
    # иначе достаточно было бы набрать /subs руками.
    # Набор берётся из ТОЙ ЖЕ карты прав, что и проверка при исполнении:
    # показать кнопку, которую нажать нельзя, — то же враньё, что спрятать
    # доступную. У тренера здесь окажутся только страховки, у админа — всё.
    if sub is not None and _db_of(sub) is not None:
        from app.services.reach import visible_actions
        allowed = visible_actions(_db_of(sub), sub.user_id)

        # Денежное — менеджеру и админу, идёт первым: для менеджера это
        # единственное, зачем он открывает бота.
        money_row = [callback_button(text, act) for act, text in
                     (("debtors", "💰 Должники"),
                      ("collection", "📊 Сбор за месяц"))
                     if act in allowed]
        if money_row:
            rows.append(money_row)

        admin_row = [callback_button(text, act) for act, text in
                     (("subs", "📊 Подписки"), ("unlinked", "📋 Не привязаны"))
                     if act in allowed]
        if admin_row:
            rows.append(admin_row)
        if "insurance_club" in allowed:
            rows.append([callback_button("🛡 Страховки клуба", "insurance_club")])

    return rows


def _db_of(sub):
    """Сессия, которой принадлежит объект. Нужна, чтобы собрать клавиатуру,
    не таща сессию отдельным параметром через полдюжины вызовов."""
    from sqlalchemy.orm import object_session
    try:
        return object_session(sub)
    except Exception:
        return None


def _extract_contact(attachments: list, sender_id: str):
    """Достать подтверждённый номер из вложения contact. Иначе None.

    ЗАЧЕМ ПРОВЕРКА. Карточку контакта можно ПЕРЕСЛАТЬ. Приняв номер не глядя,
    мы дали бы любому переслать боту карточку соседа и привязать к себе чужой
    аккаунт — чужих детей, взносы и уведомления. Поэтому номер принимается
    только если контакт принадлежит отправителю.

    Доказательств два, и они разной силы:

      1. max_info.user_id == sender.user_id — ОБЯЗАТЕЛЬНО. Именно это ловит
         пересылку: у чужой карточки внутри чужой профиль. Прямой аналог
         телеграмной проверки contact.user_id.

      2. hash = HMAC-SHA256(токен_бота, vcf_info) — платформа подписывает
         данные, и подпись доказывает вдобавок, что номер не подменён по
         дороге. Проверяем и логируем, но кодировку подписи (hex или base64)
         документация не фиксирует, поэтому расхождение НЕ блокирует привязку:
         принадлежность уже доказана пунктом 1, а ложный отказ по кодировке
         оставил бы родителей без уведомлений.
    """
    import hashlib
    import hmac
    import re as _re

    for att in (attachments or []):
        if (att.get("type") or "") != "contact":
            # Фото, стикер, файл — не наше дело, но в лог занесём: иначе
            # непонятно, почему бот промолчал на присланную картинку.
            logger.info("MAX: вложение типа %r пропущено", att.get("type"))
            continue
        payload = att.get("payload") or {}
        vcf = payload.get("vcf_info") or ""
        info = payload.get("max_info") or payload.get("tam_info") or {}

        # Факт получения контакта пишем ВСЕГДА, до любых решений. Без этого
        # успешный путь «вы уже привязаны» не оставлял в логе ничего, и было
        # не отличить «человек нажал кнопку» от «нажатие не дошло».
        logger.info("MAX: получен контакт от user_id=%s, поля payload: %s",
                    sender_id, sorted(payload.keys()))

        owner = str(info.get("user_id") or "")
        if not owner or owner != str(sender_id):
            logger.warning(
                "MAX: контакт отклонён — карточка принадлежит %r, а прислал %r "
                "(похоже на пересланный чужой контакт)", owner or "неизвестно", sender_id)
            return None

        if not _verify_contact_hash(payload.get("hash"), vcf, hmac, hashlib):
            return None

        # Номер лежит в строке вида «TEL;TYPE=cell:79990000000».
        m = _re.search(r"TEL[^:]*:\s*([+\d][\d\s()\-]*)", vcf)
        if m:
            return m.group(1)

        # Запасной вариант, если формат карточки изменится.
        phone = info.get("phone") or payload.get("phone")
        if phone:
            return str(phone)

        logger.warning("MAX: во вложении contact не нашёлся номер")
        return None
    return None


def _verify_contact_hash(got, vcf: str, hmac, hashlib) -> bool:
    """Сверить подпись платформы. False — контакт принимать НЕЛЬЗЯ.

    Проверка ОБЯЗАТЕЛЬНАЯ. Формат подтверждён живым нажатием 22.08.2026:
    payload несёт поля hash, max_info, vcf_info, а hash — это
    HMAC-SHA256(токен_бота, vcf_info) в HEX. Последовательности \\r\\n перед
    хешированием превращаются в настоящие переносы строк, как оговаривает
    документация.

    До этого проверка была мягкой: кодировку я не знал и не хотел ложным
    отказом оставить родителей без уведомлений. Теперь знаю — и мягкость стала
    лишней дырой.

    base64 принимается тоже. Это не послабление: обе кодировки — один и тот же
    HMAC на нашем токене, подделать который без токена нельзя, а запас
    страхует от смены формата на стороне платформы.

    Отсутствие подписи — тоже отказ: на живом нажатии она приходит всегда,
    значит её отсутствие означает либо подделку, либо смену протокола. И то,
    и другое разбирать надо, а не пропускать.
    """
    import base64

    if not vcf:
        logger.warning("MAX: контакт отклонён — пустой vcf_info")
        return False
    if not got:
        logger.warning("MAX: контакт отклонён — подписи нет вовсе")
        return False

    token = os.getenv("MAX_BOT_TOKEN", "").encode()
    body = vcf.replace("\\r\\n", "\r\n").encode()
    digest = hmac.new(token, body, hashlib.sha256).digest()

    hex_form = digest.hex()
    b64_form = base64.b64encode(digest).decode()

    # compare_digest, а не ==: сравнение подписей за постоянное время.
    for name, expected in (("hex", hex_form), ("base64", b64_form)):
        if hmac.compare_digest(str(got), expected):
            logger.info("MAX: подпись контакта совпала (%s)", name)
            return True

    logger.warning(
        "MAX: контакт ОТКЛОНЁН — подпись не совпала. Пришло: длина %s, "
        "начало %r. Наш hex: %r, наш base64: %r",
        len(str(got)), str(got)[:12], hex_form[:12], b64_form[:12])
    return False


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
        # Коммит СРАЗУ, а не «когда-нибудь ниже». Сессия создана с
        # autoflush=False, поэтому несохранённый объект НЕ виден последующим
        # запросам в той же сессии: binding.bind_by_phone искал подписчика,
        # не находил и добавлял второго — INSERT падал на уникальности пары
        # (platform, external_id), апдейт обрывался, привязка не происходила.
        # Поймано тестом привязки по контакту 22.08.2026.
        db.commit()
    return sub


def _handle_link(db, sub, user_id_max: str, text: str) -> str:
    """Ручная привязка по номеру. Запасной путь: основной — кнопка контакта.

    Идёт через тот же binding.bind_by_phone, что и кнопка. Раньше здесь была
    своя нормализация номера и своя привязка, которая МОЛЧА перепривязывала
    аккаунт, если его уже занимал другой подписчик той же площадки. Теперь оба
    пути ведут себя одинаково, и «занято» объясняется человеку.
    """
    from app.services import binding

    parts = text.split(maxsplit=1)
    if len(parts) < 2 or not parts[1].strip():
        return LINK_HELP

    raw = parts[1].strip()
    user, reason = binding.bind_by_phone(db, "max", sub.external_id, raw)

    if reason in (binding.OK, binding.REBOUND):
        logger.info("MAX /link: аккаунт %s привязан к user_id=%s", user.id, user_id_max)
        text = binding.success_text(db, user)
        if reason == binding.REBOUND:
            text += ("\n\n⚠️ Раньше этот мессенджер был привязан к другой "
                     "учётной записи — теперь она отвязана.")
        return text
    if reason == binding.NOT_FOUND:
        logger.info("MAX /link: номер не найден (user_id=%s)", user_id_max)
        return binding.BIND_TEXT[binding.NOT_FOUND].format(
            phone=esc(binding.normalize_phone(raw)))
    return binding.BIND_TEXT[reason].format(name=esc(user.full_name))


def run_action(action: str, db, sub, raw_text: str = "") -> str:
    """Выполнить действие и вернуть текст ответа.

    ЕДИНСТВЕННОЕ место, где действия исполняются. Сюда приходят и текстовые
    команды, и нажатия кнопок: у кнопки payload — это ровно имя действия.
    Развилка «если кнопка, то одно, если команда — другое» отсутствует
    намеренно, иначе поведение двух путей однажды разъедется.

    raw_text нужен единственному действию — /link с номером в той же строке.
    """
    from app.services import binding

    # ── Контакт ──────────────────────────────────────────────────────────────
    if action == CONTACT_ACTION:
        user, reason = binding.bind_by_phone(db, "max", sub.external_id, raw_text)
        if reason in (binding.OK, binding.REBOUND):
            text = binding.success_text(db, user)
            if reason == binding.REBOUND:
                text += ("\n\n⚠️ Раньше этот мессенджер был привязан к другой "
                         "учётной записи — теперь она отвязана.")
            return text
        if reason == binding.NOT_FOUND:
            return binding.BIND_TEXT[binding.NOT_FOUND].format(
                phone=esc(binding.normalize_phone(raw_text)))
        return binding.BIND_TEXT[reason].format(name=esc(user.full_name))

    if action == CONTACT_REJECTED:
        # Сюда ведут две разные причины: карточка чужая (пересланная) либо не
        # сошлась подпись платформы. Различать их в тексте не нужно и вредно —
        # человеку важно, что делать, а не какая из проверок не прошла.
        # Формулировка нейтральная: контакт мог быть переслан по ошибке, и
        # обвинять за это незачем.
        return (
            "🔗 <b>Не получилось принять этот контакт</b>\n\n"
            "Привязать можно только собственную карточку — ту, что открывается "
            "кнопкой «📱 Поделиться контактом» под сообщением бота. "
            "Пересланный чужой контакт не подойдёт.\n\n"
            "Если кнопка не помогает, отправьте номер вручную: <code>/link</code> "
            "и через пробел ваш номер с сайта клуба."
        )

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

        # Пришёл по общей ссылке. Пока не знаем, кто это — просим контакт.
        if not sub.user_id:
            return binding.ASK_CONTACT
        return WELCOME

    if action == "stop":
        sub.subscribed = False
        db.commit()
        # Про разницу говорим прямо: /stop оставляет связь с учётной записью,
        # и одного /start хватит, чтобы уведомления пошли снова. Человеку,
        # который хотел «отвязаться», это не очевидно.
        return ("😔 Вы отписались от уведомлений.\n"
                "Напишите /start или нажмите кнопку, чтобы подписаться снова.\n\n"
                "Связь с учётной записью при этом сохранена. Чтобы разорвать "
                "её совсем — /unlink")

    if action == "unlink":
        return binding.unlink(db, "max", sub.external_id)

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
    # Всё, что про конкретного ребёнка, требует привязки. Проверка одна на
    # четыре действия: иначе четвёртое однажды забудут ей накрыть.
    if action in NEEDS_ACCOUNT and not sub.user_id:
        return _NEED_ACCOUNT

    if action == "children":
        return _cmd_children(db, sub)

    if action in ("rating", "achievements", "fees", "attendance",
                  "insurance", "competitions"):
        from app.services import parent_info
        return getattr(parent_info, action)(db, sub.user_id)

    if action in STAFF_ACTIONS:
        # Родителю отвечаем ровно тем же, чем на любую белиберду: не «у вас нет
        # прав», а «не понимаю команду». Иначе ответ подтверждал бы, что такая
        # команда существует, и приглашал бы её поперебирать.
        from app.services import reach
        if not reach.can(db, sub.user_id, action):
            logger.info("MAX: /%s недоступно роли %r (user_id=%s)",
                        action, reach.role_of(db, sub.user_id) or "нет привязки",
                        sub.external_id)
            return UNKNOWN

        if action == "subs":
            return reach.format_summary(db)
        if action == "unlinked":
            return reach.format_unlinked(db)
        if action == "invite":
            # «/invite Абрамова» — запрос идёт хвостом команды.
            parts = raw_text.split(maxsplit=1)
            return reach.format_invite(db, parts[1] if len(parts) > 1 else "")
        if action == "insurance_club":
            from app.services.insurance import format_club_summary
            return format_club_summary(db)

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
        external_id = str(sender.get("user_id") or "")
        text = (body.get("text") or "").strip()

        # Нажатие «Поделиться контактом» приходит обычным сообщением с
        # вложением. Номер извлекается только после проверки, что карточка
        # принадлежит отправителю, — иначе _extract_contact вернёт None.
        #
        # ВЛОЖЕНИЯ ЛЕЖАТ В body, А НЕ НА message. Проверено на живом нажатии
        # 22.08.2026: я искал message["attachments"], там всегда пусто, контакт
        # не находился, и бот отвечал «не понимаю эту команду» на нажатие
        # собственной кнопки. Схема MessageBody в официальной библиотеке
        # подтверждает: mid, seq, text, attachments, markup — всё внутри body.
        # Запасной путь по message оставлен на случай, если формат изменится.
        attachments = body.get("attachments") or message.get("attachments") or []
        if attachments:
            phone = _extract_contact(attachments, external_id)
            action = CONTACT_ACTION if phone else CONTACT_REJECTED
            return (external_id, sender.get("username") or "",
                    (sender.get("name") or "").strip(), action, phone or "", None)

        # Сообщение без текста и без понятных вложений: чтобы такой случай
        # больше не превращался в молчаливое «не понимаю команду», пишем в лог
        # его структуру. Ключи, а не содержимое — внутри персональные данные.
        if not text:
            logger.warning("MAX: сообщение без текста и вложений, ключи body: %s, "
                           "ключи message: %s", sorted(body.keys()), sorted(message.keys()))

        # «/link 79…» и «/start lnk_…» доходят до run_action как есть,
        # остальное разрешается по таблице.
        action = COMMAND_ALIASES.get(text.split()[0] if text else "", "")
        return (external_id, sender.get("username") or "",
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
