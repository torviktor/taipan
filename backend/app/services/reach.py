"""Охват уведомлений: кто из родителей достижим через мессенджеры, а кто нет.

Задача простая по смыслу и коварная по деталям. На 22.08.2026 из 57 активных
родителей аккаунт привязан у одного, то есть уведомления о взносах, сборах и
аттестациях доходят почти до никого. Тренеру нужно видеть, кого догонять.

ГЛАВНОЕ ПРАВИЛО ЭТОГО МОДУЛЯ: каждый запрос к messenger_subscribers несёт
фильтр по platform. Идентификаторы площадок — просто числа, и telegram chat_id
может совпасть с MAX user_id. База защищает только уникальность пары
(platform, external_id); от запроса без фильтра она не спасает, а цена ошибки —
уведомление, ушедшее чужому человеку.

Кого считаем «родителем»: активного пользователя с ролью parent. Неактивные
(is_active = false) исключены — это дубли и ушедшие, в списке «догнать» они
только шумят. Роль athlete (взрослый спортсмен без родителя) в базу охвата не
входит: таких сейчас один, и логика «чьи дети» к нему неприменима.
"""

import logging
from typing import List

logger = logging.getLogger(__name__)

PLATFORMS = ("telegram", "max")

PLATFORM_NAMES = {
    "telegram": "Telegram",
    "max":      "MAX",
}

STAFF_ROLES = ("manager", "admin")


def _role_value(user) -> str:
    """Роль строкой: в модели это Enum, а сравнивать удобнее с текстом."""
    role = getattr(user, "role", None)
    return getattr(role, "value", role) or ""


def is_staff(db, user_id) -> bool:
    """Тренер или администратор?

    Используется как замок на служебных командах бота. Отсутствие привязки —
    это не «нет прав», а «неизвестно кто», и ответ должен быть один и тот же:
    команды не существует.
    """
    if not user_id:
        return False
    from app.models.user import User
    user = db.query(User).filter(User.id == user_id).first()
    return bool(user and user.is_active and _role_value(user) in STAFF_ROLES)


def _parents_query(db):
    from app.models.user import User
    return db.query(User).filter(
        User.role == "parent",
        User.is_active == True,
    )


def _links_by_user(db) -> dict:
    """Привязки вида {user_id: [(площадка, дата), …]}.

    Один запрос вместо запроса на каждого родителя: строк немного, но
    обращение к БД в цикле по 57 людям — привычка, которая потом дорого
    обходится на списках побольше.
    """
    from app.models.event import MessengerSubscriber

    rows = (
        db.query(MessengerSubscriber)
        .filter(
            MessengerSubscriber.platform.in_(PLATFORMS),   # фильтр обязателен
            MessengerSubscriber.subscribed == True,
            MessengerSubscriber.user_id != None,
        )
        .all()
    )
    out = {}
    for r in rows:
        out.setdefault(r.user_id, []).append((r.platform, r.created_at))
    return out


def _active_athletes_by_user(db) -> dict:
    from app.models.user import Athlete
    rows = (
        db.query(Athlete)
        .filter(Athlete.is_archived == False)
        .order_by(Athlete.full_name)
        .all()
    )
    out = {}
    for a in rows:
        out.setdefault(a.user_id, []).append(a.full_name)
    return out


def build_report(db) -> dict:
    """Собрать всё разом: сводку, непривязанных и привязанных.

    Возвращает готовые к показу структуры, без объектов ORM: вызывающему коду
    (боту) нужны только строки, а тащить наружу сессию — способ однажды
    получить DetachedInstanceError в неожиданном месте.
    """
    parents = _parents_query(db).all()
    links   = _links_by_user(db)
    kids    = _active_athletes_by_user(db)

    unlinked, linked = [], []
    per_platform = {p: 0 for p in PLATFORMS}

    for u in parents:
        mine = links.get(u.id) or []
        children = kids.get(u.id) or []
        if mine:
            for platform, _ in mine:
                if platform in per_platform:
                    per_platform[platform] += 1
            linked.append({
                "user_id":   u.id,
                "full_name": u.full_name,
                "platforms": sorted({PLATFORM_NAMES.get(p, p) for p, _ in mine}),
                "linked_at": max((d for _, d in mine if d), default=None),
                "children":  children,
            })
        else:
            unlinked.append({
                "user_id":    u.id,
                "full_name":  u.full_name,
                "phone":      u.phone,
                "created_at": u.created_at,
                "children":   children,
            })

    # Сначала те, у кого дети в текущем составе: именно их отсутствие в
    # рассылке стоит дорого — они не узнают про взносы и сборы.
    unlinked.sort(key=lambda r: (not r["children"], r["full_name"] or ""))
    linked.sort(key=lambda r: r["full_name"] or "")

    total = len(parents)
    return {
        "total":        total,
        "linked_count": len(linked),
        "unlinked_count": len(unlinked),
        "percent":      round(len(linked) * 100 / total) if total else 0,
        "per_platform": per_platform,
        "dangling":     dangling_subscribers(db),
        "unlinked":     unlinked,
        "linked":       linked,
    }


def dangling_subscribers(db) -> dict:
    """Кто написал боту, но так и не привязал аккаунт.

    Отдельная и самая полезная категория: человек уже нашёл бота и нажал
    «Начать», ему остаётся отправить одну команду. Догонять его несравнимо
    легче, чем того, кто про бота не слышал. На 22.08.2026 таких девять —
    больше, чем привязанных.

    Имён здесь нет намеренно: пока привязки нет, мы не знаем, кто это, а
    показывать тренеру ник из мессенджера — значит выдавать за факт догадку.
    """
    from app.models.event import MessengerSubscriber

    out = {}
    for platform in PLATFORMS:
        out[platform] = (
            db.query(MessengerSubscriber)
            .filter(
                MessengerSubscriber.platform == platform,   # фильтр обязателен
                MessengerSubscriber.subscribed == True,
                MessengerSubscriber.user_id == None,
            )
            .count()
        )
    return out


def staff_recipients(db) -> List[dict]:
    """Тренеры и админы с их привязками — кому слать служебные сообщения.

    Возвращает [{user_id, full_name, platform, external_id}, …] по одной
    записи на площадку: у одного человека может быть и Telegram, и MAX, и
    сообщение должно прийти в оба, чтобы не зависеть от того, каким он
    пользуется сегодня.
    """
    from app.models.user import User
    from app.models.event import MessengerSubscriber

    staff = db.query(User).filter(
        User.role.in_(STAFF_ROLES),
        User.is_active == True,
    ).all()
    if not staff:
        return []

    ids = [u.id for u in staff]
    names = {u.id: u.full_name for u in staff}

    rows = (
        db.query(MessengerSubscriber)
        .filter(
            MessengerSubscriber.platform.in_(PLATFORMS),   # фильтр обязателен
            MessengerSubscriber.user_id.in_(ids),
            MessengerSubscriber.subscribed == True,
        )
        .all()
    )
    return [
        {"user_id": r.user_id, "full_name": names.get(r.user_id, ""),
         "platform": r.platform, "external_id": r.external_id}
        for r in rows
    ]


def notify_staff_new_link(db, user, platform: str, children: List[str]) -> None:
    """Сообщить тренерам, что родитель привязал аккаунт.

    Шлётся ТОЛЬКО на успешную привязку, а не на каждый /start: /start пишет
    любой, кто открыл бота, и такие сообщения быстро научили бы тренера их
    игнорировать.

    Ошибка доставки здесь не должна ломать привязку: родитель своё сообщение
    уже получил, и падение на служебном уведомлении откатило бы транзакцию.
    """
    from app.core.markup import esc

    kids = "\n".join(f"• {esc(c)}" for c in children) if children else "• (нет активных)"
    text = (
        "🔗 <b>Новая привязка к боту</b>\n\n"
        f"👤 {esc(user.full_name)}\n"
        f"💬 {esc(PLATFORM_NAMES.get(platform, platform))}\n"
        f"📞 {esc(user.phone)}\n\n"
        f"🥋 Спортсмены:\n{kids}"
    )

    for who in staff_recipients(db):
        # Себе же уведомление о собственной привязке не шлём.
        if who["user_id"] == user.id:
            continue
        try:
            if who["platform"] == "max":
                from app.services.max_bot import send_message_result
                status, err = send_message_result(who["external_id"], text)
            else:
                from app.services.notifications import send_telegram_sync
                status, err = send_telegram_sync(who["external_id"], text)
            if status != "sent":
                logger.warning("Охват: тренеру %s в %s не доставлено — %s",
                               who["full_name"], who["platform"], err)
        except Exception:
            logger.exception("Охват: уведомление тренеру %s упало", who["full_name"])
