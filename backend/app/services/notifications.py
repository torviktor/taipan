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

from app.core.markup import esc

BOT_USERNAME = "taipan_tkd_bot"

# Канал до api.telegram.org с этого сервера нестабилен: TCP на 443
# устанавливается, а TLS часто рвётся — по замерам 17.08.2026 проходила
# примерно каждая третья попытка. Одна попытка означала, что бот молчит в
# ответ на две команды из трёх: пользователь пишет /start и не получает
# ничего, хотя обработчик отработал и данные в БД записаны.
# Число попыток намеренно небольшое: Telegram ждёт ответ на вебхук не дольше
# минуты, иначе повторит апдейт и пользователь получит дубли.
TELEGRAM_SEND_ATTEMPTS = 3
TELEGRAM_SEND_DELAY    = 2      # база паузы между попытками, секунды
TELEGRAM_SEND_TIMEOUT  = 10

# Для синхронного пути (send_telegram_to_user) бюджет жёстче: он вызывается
# циклом по всем родителям прямо внутри HTTP-обработчика, без BackgroundTasks.
# 3 попытки × 5 с + паузы 1 и 2 с = не больше 18 с на одного получателя.
TELEGRAM_SYNC_TIMEOUT     = 5
TELEGRAM_SYNC_RETRY_DELAY = 1

# Базовый адрес Bot API. По умолчанию — сам Telegram; на проде подменяется на
# Cloudflare Worker, который прозрачно пробрасывает /bot<token>/<method>.
# Прямой канал до api.telegram.org с этого сервера теряет около половины
# запросов (замер 17.08.2026: TCP 8/20, TLS 1/5), тогда как до Cloudflare —
# 20/20 за 14 мс.
#
# ВАЖНО: это адрес ТОЛЬКО для исходящих вызовов. Вебхук (Telegram → наш сервер)
# работает штатно и остаётся на https://taipan-tkd.ru — setWebhook в коде нет
# вовсе, так что подменить его этой настройкой невозможно.
DEFAULT_TELEGRAM_API_BASE = "https://api.telegram.org"


def bot_api_url(method: str) -> str:
    """Единственное место, где собирается URL Bot API.

    Значение читается при каждом вызове, чтобы правка .env подхватывалась
    перезапуском контейнера без пересборки образа.
    """
    base = os.getenv("TELEGRAM_API_BASE", DEFAULT_TELEGRAM_API_BASE).rstrip("/")
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    return f"{base}/bot{token}/{method}"


def bot_api_headers() -> dict:
    """Заголовки для запросов к Bot API — тоже собираются в одном месте.

    Воркер-релей закрыт секретом: без верного x-bridge-auth он в строгом режиме
    отвечает 403. Секрет читается из окружения (TELEGRAM_API_SECRET); если он не
    задан, заголовок не добавляется вовсе — так работает обращение напрямую к
    api.telegram.org и переходный режим воркера.
    """
    secret = os.getenv("TELEGRAM_API_SECRET", "")
    return {"x-bridge-auth": secret} if secret else {}


# ─── Telegram Bot ─────────────────────────────────────────────────────────────

async def send_telegram_message(chat_id: str, text: str, reply_markup: Optional[dict] = None) -> bool:
    """Отправить сообщение в Telegram. С повторами — канал ненадёжен."""
    url = bot_api_url("sendMessage")
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup is not None:
        # Клавиатура под полем ввода. Нужна кнопке «Поделиться
        # контактом»: у Telegram это reply-клавиатура, а не inline.
        payload["reply_markup"] = reply_markup

    last = ""
    for attempt in range(1, TELEGRAM_SEND_ATTEMPTS + 1):
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                r = await client.post(url, json=payload, timeout=TELEGRAM_SEND_TIMEOUT,
                                      headers=bot_api_headers())
            if r.status_code == 200:
                if attempt > 1:
                    logger.info("Telegram: доставлено с попытки %s", attempt)
                return True
            last = f"HTTP {r.status_code}: {r.text[:200]}"
        except Exception as e:
            # Пустой str(e) у httpx.ConnectError раньше давал бесполезное
            # «Telegram error: » — поэтому логируем и тип исключения.
            last = f"{type(e).__name__}: {e}"
        if attempt < TELEGRAM_SEND_ATTEMPTS:
            await asyncio.sleep(TELEGRAM_SEND_DELAY * attempt)

    logger.error("Telegram: не доставлено за %s попыток — %s", TELEGRAM_SEND_ATTEMPTS, last)
    return False


async def send_telegram_photo(chat_id: str, photo_url: str, caption: str) -> bool:
    """Отправить фото с подписью в Telegram. С повторами — канал ненадёжен."""
    url = bot_api_url("sendPhoto")
    payload = {
        "chat_id":    chat_id,
        "photo":      photo_url,
        "caption":    caption,
        "parse_mode": "HTML",
    }

    last = ""
    for attempt in range(1, TELEGRAM_SEND_ATTEMPTS + 1):
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                r = await client.post(url, json=payload, timeout=TELEGRAM_SEND_TIMEOUT,
                                      headers=bot_api_headers())
            if r.status_code == 200:
                if attempt > 1:
                    logger.info("Telegram photo: доставлено с попытки %s", attempt)
                return True
            last = f"HTTP {r.status_code}: {r.text[:200]}"
        except Exception as e:
            last = f"{type(e).__name__}: {e}"
        if attempt < TELEGRAM_SEND_ATTEMPTS:
            await asyncio.sleep(TELEGRAM_SEND_DELAY * attempt)

    logger.error("Telegram photo: не доставлено за %s попыток — %s", TELEGRAM_SEND_ATTEMPTS, last)
    return False


async def notify_channel(text: str) -> bool:
    """Отправить сообщение в Telegram-канал клуба."""
    channel_id = os.getenv("TELEGRAM_CHANNEL_ID", "")
    if not channel_id:
        print("DEBUG notify_channel: TELEGRAM_CHANNEL_ID not set")
        return False
    return await send_telegram_message(channel_id, text)


async def notify_news_telegram(title: str, body: Optional[str] = None, photo_url: Optional[str] = None):
    """Отправить новость только в канал (без рассылки подписчикам)."""
    channel_id = os.getenv("TELEGRAM_CHANNEL_ID", "")
    print(f"DEBUG notify_news_telegram: CHANNEL_ID={channel_id}, TOKEN={bool(os.getenv('TELEGRAM_BOT_TOKEN'))}")

    caption = (
        f"📰 <b>Новость клуба Тайпан</b>\n\n"
        f"<b>{esc(title)}</b>\n\n"
        f"{esc(body[:800]) if body else ''}\n\n"
        f"🔗 Читать полностью: https://taipan-tkd.ru/news"
    )
    if len(caption) > 1024:
        caption = caption[:1020] + "..."

    try:
        if photo_url:
            result = await send_telegram_photo(channel_id, photo_url, caption)
        else:
            result = await send_telegram_message(channel_id, caption)
        print(f"DEBUG notify_news_telegram result: {result}")
    except Exception as e:
        print(f"DEBUG notify_news_telegram ERROR: {e}")
        import traceback
        traceback.print_exc()


def enqueue_telegram_delivery() -> bool:
    """Поставить фоновую задачу на рассылку уведомлений с tg_status='pending'.

    Вызывается роутами вместо синхронного цикла отправок. Ошибку постановки
    намеренно проглатываем: HTTP-обработчик не должен падать из-за недоступного
    Redis, а beat всё равно подберёт зависшие pending раз в 10 минут.

    Имя осталось телеграмным, хотя задача давно мультиканальная: его зовут из
    одиннадцати мест, и переименование ради точности стоило бы одиннадцати
    правок с одиннадцатью шансами промахнуться. Переименуем, когда рядом
    появится другая причина трогать эти файлы.
    """
    try:
        from app.celery_app import deliver_notifications_task
        deliver_notifications_task.delay()
        return True
    except Exception as e:
        logger.warning(
            "не удалось поставить задачу рассылки (%s: %s); подберёт периодическая",
            type(e).__name__, e,
        )
        return False


def send_telegram_sync(chat_id: str, text: str, reply_markup: Optional[dict] = None):
    """Синхронно отправить готовый HTML-текст в конкретный чат.

    Вынесено из send_telegram_to_user_result, чтобы тем же путём могли ходить
    служебные сообщения тренерам: адресат у них известен напрямую, искать его
    по user_id не нужно.

    Возвращает (статус, текст ошибки), статусы совпадают с notifications.tg_status.
    Текст ДОЛЖЕН быть уже экранирован вызывающим — здесь он уходит как есть.
    """
    if not os.getenv("TELEGRAM_BOT_TOKEN", ""):
        return "failed", "TELEGRAM_BOT_TOKEN не задан"

    import httpx
    import time
    url = bot_api_url("sendMessage")
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup

    # Раньше здесь была одна попытка, а результат вообще не проверялся:
    # return True стоял после httpx.post безусловно, поэтому функция
    # рапортовала об успехе даже когда Telegram отвечал ошибкой или запрос
    # падал по таймауту. При потерях канала это скрывало недоставленные
    # уведомления родителям — о взносах, сборах, аттестациях.
    last = ""
    for attempt in range(1, TELEGRAM_SEND_ATTEMPTS + 1):
        try:
            r = httpx.post(url, json=payload, timeout=TELEGRAM_SYNC_TIMEOUT,
                           headers=bot_api_headers())
            if r.status_code == 200:
                if attempt > 1:
                    logger.info("Telegram: chat_id=%s доставлено с попытки %s", chat_id, attempt)
                return "sent", ""
            last = f"HTTP {r.status_code}: {r.text[:200]}"
        except Exception as e:
            last = f"{type(e).__name__}: {e}"
        if attempt < TELEGRAM_SEND_ATTEMPTS:
            time.sleep(TELEGRAM_SYNC_RETRY_DELAY * attempt)

    logger.error("Telegram: chat_id=%s НЕ доставлено за %s попыток — %s",
                 chat_id, TELEGRAM_SEND_ATTEMPTS, last)
    return "failed", last


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

def reminder_audience(db, event):
    """Кому адресовано напоминание о событии из календаря.

    ПОЧЕМУ НЕ «ВСЕМ ПОДПИСЧИКАМ», КАК БЫЛО. Прежняя рассылка читала
    TelegramSubscriber напрямую и слала всем, у кого есть привязка. Это давало
    две беды сразу: родители с одним только MAX не получали ничего вовсе, а
    те, чьи дети давно ушли из клуба, продолжали получать напоминания о
    тренировках.

    ПОЧЕМУ НЕ ПО КОНКРЕТНЫМ СПОРТСМЕНАМ. У Event нет списка участников — это
    календарь клуба, а не мероприятие с отбором. События, которые касаются
    конкретных детей, живут отдельными сущностями (Camp, Competition,
    Certification), у них есть списки участников, и они УЖЕ уведомляют
    родителей поимённо. Разделение верное, ломать его незачем.

    Поэтому аудитория здесь — те, кого календарь клуба вообще касается:
    активные родители, у которых есть хоть один неархивный спортсмен, плюс
    тренеры и админы.
    """
    from app.models.user import Athlete, User

    parents = (
        db.query(User)
        .join(Athlete, Athlete.user_id == User.id)
        .filter(
            User.is_active == True,
            User.role == "parent",
            Athlete.is_archived == False,
        )
        .distinct()
        .all()
    )
    staff = (
        db.query(User)
        .filter(User.is_active == True, User.role.in_(("manager", "admin")))
        .all()
    )
    # dict, а не set: у одного человека роль одна, но подстраховаться дешевле,
    # чем однажды прислать напоминание дважды.
    return list({u.id: u for u in parents + staff}.values())


def check_and_send_reminders(db):
    """Напоминания о событиях календаря. Запускается раз в 10 минут.

    ЧЕРЕЗ ОБЩИЙ КОНВЕЙЕР. Раньше здесь был прямой широковещательный вызов в
    Telegram, минуя Notification: родители с одним только MAX не получали
    напоминаний вовсе, статусы доставки не писались, в статистику ничего не
    попадало. Теперь создаются обычные Notification, и дальше работает та же
    цепочка, что для взносов, сборов и страховки.

    Насколько это было сломано, видно по данным: у всех двенадцати
    отправленных до сих пор напоминаний sent_count = 0. То есть за всё время
    ни одно не дошло ни до кого.
    """
    from app.models.certification import Notification
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
            remind_at = event.event_date - timedelta(days=days)

            already_sent = db.query(EventReminder).filter(
                EventReminder.event_id    == event.id,
                EventReminder.days_before == days,
            ).first()
            if already_sent:
                continue

            # Пора отправлять? (±10 минут — задача просыпается раз в 10 минут)
            diff = abs((remind_at - now).total_seconds())
            if diff > 600:
                continue

            # notify_everyone=False читаем буквально: «не уведомлять всех».
            # Другой аудитории у Event нет — списка участников в нём не
            # предусмотрено, — поэтому не выдумываем её, а пропускаем и
            # оставляем след в логе.
            if not event.notify_everyone:
                logger.info("Напоминание пропущено: у события %s снят флаг "
                            "notify_everyone, а другой аудитории у календаря нет",
                            event.id)
                db.add(EventReminder(event_id=event.id, days_before=days,
                                     sent_count=0))
                db.commit()
                continue

            title, body = build_reminder_notification(event, days)
            audience = reminder_audience(db, event)

            for user in audience:
                db.add(Notification(
                    user_id   = user.id,
                    type      = "general",
                    title     = title,
                    body      = body,
                    link_type = "event",
                    link_id   = event.id,
                    tg_status = "pending",
                ))

            db.add(EventReminder(
                event_id    = event.id,
                days_before = days,
                sent_count  = len(audience),
            ))
            db.commit()

            enqueue_telegram_delivery()
            logger.info("Напоминание поставлено в очередь: %s, за %s дней, "
                        "получателей %s", event.title, days, len(audience))


def build_reminder_notification(event, days_before: int):
    """(заголовок, тело) напоминания.

    У уведомления есть свой заголовок, а разметку добавляет конвейер
    доставки. Дублировать «🥋 Тайпан — Напоминание» в теле незачем — это и
    так видно по отправителю.
    """
    when = ("СЕГОДНЯ" if days_before == 0
            else "ЗАВТРА" if days_before == 1
            else f"через {days_before} дн.")

    title = f"{event.title} — {when}"

    body = f"{when}, {event.event_date:%d.%m.%Y} в {event.event_date:%H:%M}"
    if event.location:
        body += f"\nМесто: {event.location}"
    if event.description:
        body += f"\n\n{event.description}"
    # Экранирование делает конвейер доставки (delivery._send_one),
    # поэтому здесь чистый текст без разметки.
    return title, body
