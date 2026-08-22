"""Мультиканальная доставка уведомлений.

Раньше конвейер был одноканальным: задача брала уведомления с
tg_status='pending', звала Telegram и записывала результат в ту же колонку.
С появлением бота в MAX «доставлено» перестало быть одним значением — в
Telegram могло уйти, в MAX упасть.

КАК УСТРОЕНО СЕЙЧАС

  1. Роуты по-прежнему создают Notification с tg_status='pending'. Их около
     десятка, и трогать каждый ради новой схемы значило бы десять шансов
     что-то забыть. Это поле осталось сигналом «поставлено в очередь».

  2. Раскладка (fan_out): по каждому такому уведомлению создаются строки
     notification_deliveries — по одной на КАЖДУЮ площадку, где у получателя
     есть привязка. Если привязок нет ни одной, строк не создаётся, а
     уведомление сразу помечается 'no_account'.

  3. Отправка (deliver_pending): строки берутся по одной с
     FOR UPDATE SKIP LOCKED — параллельный воркер пропустит занятую и не
     отправит её второй раз.

  4. Сведение (recompute_status): по строкам доставки пересчитывается
     notifications.tg_status. Поле оставлено ради кабинета и ежедневной
     сводки монитора; его смысл теперь «итог по всем каналам».

ПРО no_account. Раньше значило «нет привязанного Telegram». Теперь — «нет НИ
ОДНОГО канала». Разница не косметическая: у родителя может не быть Telegram,
но быть MAX, и старая логика пометила бы такое уведомление недоставляемым,
хотя доставить его можно.
"""

import logging
from datetime import datetime

logger = logging.getLogger(__name__)

PLATFORMS = ("telegram", "max")

# Сколько раз пробуем доставить одну строку, прежде чем признать провал.
# Сама отправка внутри уже делает ретраи внутри одной попытки (канал до
# Telegram нестабилен), здесь речь о повторах между запусками задачи.
MAX_ATTEMPTS = 3


def channels_for(db, user_id: int) -> list:
    """Площадки, на которых у пользователя есть живая привязка.

    Фильтр по platform в запросе обязателен по той же причине, что и везде:
    идентификаторы площадок могут совпасть численно.
    """
    from app.models.event import MessengerSubscriber

    rows = (
        db.query(MessengerSubscriber.platform)
        .filter(
            MessengerSubscriber.platform.in_(PLATFORMS),
            MessengerSubscriber.user_id == user_id,
            MessengerSubscriber.subscribed == True,
        )
        .distinct()
        .all()
    )
    return [r[0] for r in rows]


def fan_out(db, notification) -> int:
    """Создать строки доставки под уведомление. Возвращает их количество.

    Идемпотентна: уникальность (notification_id, platform) не даст
    продублировать, а повторный вызов просто ничего не добавит.
    """
    from app.models.certification import NotificationDelivery

    existing = {
        d.platform for d in
        db.query(NotificationDelivery)
        .filter(NotificationDelivery.notification_id == notification.id)
        .all()
    }
    created = 0
    for platform in channels_for(db, notification.user_id):
        if platform in existing:
            continue
        db.add(NotificationDelivery(
            notification_id=notification.id, platform=platform, status="pending"
        ))
        created += 1
    return created + len(existing)


def _send_one(db, delivery) -> tuple:
    """Отправить одну строку. Возвращает (статус, ошибка)."""
    from app.core.markup import esc
    from app.models.certification import Notification
    from app.models.event import MessengerSubscriber

    n = db.query(Notification).filter(Notification.id == delivery.notification_id).first()
    if n is None:
        return "failed", "уведомление исчезло"

    sub = (
        db.query(MessengerSubscriber)
        .filter(
            MessengerSubscriber.platform == delivery.platform,   # обязателен
            MessengerSubscriber.user_id == n.user_id,
            MessengerSubscriber.subscribed == True,
        )
        .first()
    )
    if sub is None:
        # Отписался или отвязался между раскладкой и отправкой.
        return "failed", f"привязка к {delivery.platform} исчезла"

    text = f"🔔 <b>{esc(n.title)}</b>\n\n{esc(n.body)}\n\n<i>taipan-tkd.ru/cabinet</i>"

    if delivery.platform == "max":
        from app.services.max_bot import send_message_result
        return send_message_result(sub.external_id, text)

    from app.services.notifications import send_telegram_sync
    return send_telegram_sync(sub.external_id, text)


def recompute_status(db, notification_id) -> str:
    """Свести статусы доставок в notifications.tg_status.

    Правило простое и объяснимое родителю: если сообщение дошло хоть куда-то,
    считаем доставленным. Человек читает его один раз, а не по разу на канал.
    """
    from app.models.certification import Notification, NotificationDelivery

    n = db.query(Notification).filter(Notification.id == notification_id).first()
    if n is None:
        return ""

    rows = (
        db.query(NotificationDelivery)
        .filter(NotificationDelivery.notification_id == notification_id)
        .all()
    )
    if not rows:
        status, err = "no_account", "у пользователя нет ни одного мессенджера"
    else:
        statuses = {r.status for r in rows}
        if "sent" in statuses:
            status, err = "sent", None
        elif "pending" in statuses:
            status, err = "pending", None
        else:
            status = "failed"
            # В ошибку кладём причины по каналам: без этого при двух каналах
            # непонятно, который именно отказал.
            err = "; ".join(f"{r.platform}: {r.error or 'без причины'}" for r in rows)

    n.tg_status = status
    n.tg_error = err
    return status


def deliver_pending(db, limit: int = 500) -> dict:
    """Разложить и разослать всё, что ждёт. Возвращает счётчики.

    Порядок важен: сначала раскладка (иначе новые уведомления не получат
    строк доставки), потом отправка.
    """
    from app.models.certification import Notification, NotificationDelivery

    stats = {"fanned": 0, "sent": 0, "failed": 0, "no_account": 0}

    # ── Раскладка ────────────────────────────────────────────────────────────
    pending_notifs = (
        db.query(Notification)
        .filter(Notification.tg_status == "pending")
        .order_by(Notification.id)
        .limit(limit)
        .all()
    )
    for n in pending_notifs:
        made = fan_out(db, n)
        if made == 0:
            # Каналов нет вовсе — доставлять некуда, и это не ошибка.
            n.tg_status = "no_account"
            n.tg_error = "у пользователя нет ни одного мессенджера"
            stats["no_account"] += 1
        else:
            stats["fanned"] += made
        db.commit()

    # ── Отправка ─────────────────────────────────────────────────────────────
    touched = set()
    for _ in range(limit):
        d = (
            db.query(NotificationDelivery)
            .filter(
                NotificationDelivery.status == "pending",
                NotificationDelivery.attempts < MAX_ATTEMPTS,
            )
            .order_by(NotificationDelivery.id)
            .limit(1)
            .with_for_update(skip_locked=True)
            .first()
        )
        if not d:
            break

        status, err = _send_one(db, d)
        d.attempts += 1
        d.updated_at = datetime.utcnow()

        if status == "sent":
            d.status = "sent"
            d.error = None
            d.sent_at = datetime.utcnow()
            stats["sent"] += 1
        elif d.attempts >= MAX_ATTEMPTS:
            d.status = "failed"
            d.error = err
            stats["failed"] += 1
        else:
            # Оставляем pending: следующий запуск попробует снова.
            d.error = err

        touched.add(d.notification_id)
        db.commit()   # снимает блокировку строки

    for nid in touched:
        recompute_status(db, nid)
    if touched:
        db.commit()

    return stats


def stats_24h(db) -> dict:
    """Доставка за сутки по площадкам — для отчёта тренеру.

    Возвращает {'telegram': {'sent': 3, 'failed': 1}, 'max': {...}}.
    Границу считаем в Python, а не интервалом в SQL: так запрос остаётся
    переносимым и читаемым, а точность до секунды здесь не нужна.
    """
    from datetime import timedelta, timezone
    from sqlalchemy import func as sa_func
    from app.models.certification import NotificationDelivery

    since = datetime.now(timezone.utc) - timedelta(hours=24)
    rows = (
        db.query(NotificationDelivery.platform,
                 NotificationDelivery.status,
                 sa_func.count())
        .filter(NotificationDelivery.created_at >= since)
        .group_by(NotificationDelivery.platform, NotificationDelivery.status)
        .all()
    )
    out = {}
    for platform, status, cnt in rows:
        out.setdefault(platform, {})[status] = cnt
    return out
