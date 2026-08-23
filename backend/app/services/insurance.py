"""Упреждающие уведомления о страховке.

ЗАЧЕМ. Без действующей страховки ребёнка не допускают к соревнованиям, а
дату истечения родители не помнят — она не привязана ни к какому событию.
Узнать о просрочке в день турнира означает не поехать на турнир.

КОГДА ШЛЁМ. За 30 дней, за 7 дней и в день истечения. Три точки, а не
ежедневное напоминание: последнее превращается в шум, который перестают
читать, и тогда не сработает ни одно.

ПОЧЕМУ РОДИТЕЛЯМ НЕ ШЛЁМ «ДАННЫХ НЕТ». На 23.08.2026 у 41 спортсмена из 55
дата страховки не заполнена вовсе. Это пробел в данных КЛУБА, а не
забывчивость родителя: полис у большинства наверняка есть, просто дату никто
не внёс. Рассылка «у вас не заполнено» сорока одному человеку переложила бы
работу тренера на родителей и получила бы сорок один встречный вопрос.

Поэтому незаполненные идут ОДНОЙ СВОДКОЙ ТРЕНЕРУ — списком, с которым можно
сесть и собрать данные. Сводка повторяется раз в неделю, пока список не
пуст, и замолкает сама, когда данные внесены: напоминание, которое
прекращается по факту выполнения, а не по расписанию.
"""

import logging
from datetime import date, timedelta

logger = logging.getLogger(__name__)

# Пороги в днях до истечения. День истечения — 0.
THRESHOLDS = (30, 7, 0)

# Чтобы повторный запуск задачи в тот же день не прислал второе сообщение.
DEDUP_DAYS = 3

LINK_TYPE = "insurance"


def _athlete_users(db):
    """Активные спортсмены с датой страховки и их родители."""
    from app.models.user import Athlete, User

    return (
        db.query(Athlete, User)
        .join(User, User.id == Athlete.user_id)
        .filter(
            Athlete.is_archived == False,
            Athlete.insurance_expiry != None,
            User.is_active == True,
        )
        .all()
    )


def _already_notified(db, athlete_id: int) -> bool:
    """Не слали ли уже про этого спортсмена на днях.

    Пороги разнесены на 23 и 7 дней, поэтому окна в трое суток достаточно,
    чтобы не задвоить при повторном запуске и не проглотить следующий порог.
    """
    from app.models.certification import Notification

    since = date.today() - timedelta(days=DEDUP_DAYS)
    return db.query(Notification).filter(
        Notification.link_type == LINK_TYPE,
        Notification.link_id == athlete_id,
        Notification.created_at >= since,
    ).first() is not None


def _text_for(athlete, days_left: int):
    """(заголовок, тело) для родителя. Пол согласован."""
    from app.services.parent_info import _is_female

    exp = athlete.insurance_expiry
    who = athlete.full_name
    ends = "заканчивается" if days_left > 0 else "закончилась"

    if days_left > 0:
        title = f"Страховка {ends} через {days_left} дн."
        body = (f"У {who} страховка действует до {exp:%d.%m.%Y} — "
                f"осталось {days_left} дн.\n\n"
                "Без действующей страховки к соревнованиям не допускают. "
                "Если полис уже продлён, покажите его тренеру, чтобы обновить "
                "дату.")
    else:
        allowed = "допущена" if _is_female(athlete) else "допущен"
        title = "Страховка закончилась"
        body = (f"У {who} страховка закончилась {exp:%d.%m.%Y}.\n\n"
                f"К соревнованиям без неё ребёнок не будет {allowed}. "
                "Продлите полис и покажите его тренеру.")
    return title, body


def run_reminders(db) -> dict:
    """Разослать напоминания родителям. Возвращает счётчики.

    Уведомления кладутся в общий конвейер (tg_status='pending'), а не шлются
    напрямую: тогда они уходят во все каналы родителя разом и попадают в
    статистику доставки наравне с остальными.
    """
    from app.models.certification import Notification

    today = date.today()
    stats = {t: 0 for t in THRESHOLDS}
    stats["skipped"] = 0

    for athlete, user in _athlete_users(db):
        left = (athlete.insurance_expiry - today).days
        if left not in THRESHOLDS:
            continue
        if _already_notified(db, athlete.id):
            stats["skipped"] += 1
            continue

        title, body = _text_for(athlete, left)
        db.add(Notification(
            user_id=user.id,
            type="general",
            title=title,
            body=body,
            link_type=LINK_TYPE,
            link_id=athlete.id,
            tg_status="pending",
        ))
        stats[left] += 1

    if any(stats[t] for t in THRESHOLDS):
        db.commit()
        from app.services.notifications import enqueue_telegram_delivery
        enqueue_telegram_delivery()
    else:
        db.rollback()

    return stats


# ─── Сводка тренеру ──────────────────────────────────────────────────────────

def club_summary(db) -> dict:
    """Состояние страховок по клубу: просрочены, истекают, не заполнены."""
    from app.models.user import Athlete

    today = date.today()
    rows = (db.query(Athlete)
            .filter(Athlete.is_archived == False)
            .order_by(Athlete.full_name)
            .all())

    out = {"expired": [], "soon": [], "missing": [], "ok": 0}
    for a in rows:
        exp = a.insurance_expiry
        if exp is None:
            out["missing"].append(a)
        elif (exp - today).days < 0:
            out["expired"].append(a)
        elif (exp - today).days <= 30:
            out["soon"].append(a)
        else:
            out["ok"] += 1
    return out


def format_club_summary(db) -> str:
    """Текст сводки для тренера — и для команды, и для еженедельной рассылки."""
    from app.core.markup import esc

    s = club_summary(db)
    today = date.today()

    def block(title, items, fmt):
        if not items:
            return ""
        return f"\n\n{title}\n" + "\n".join(fmt(a) for a in items)

    out = (f"🛡 <b>Страховки по клубу</b>\n\n"
           f"В порядке: {s['ok']}   ·   Истекают: {len(s['soon'])}   ·   "
           f"Просрочены: {len(s['expired'])}   ·   Без данных: {len(s['missing'])}")

    out += block(
        f"🔴 <b>Просрочены — {len(s['expired'])}</b>",
        s["expired"],
        lambda a: f"• {esc(a.full_name)} — до {a.insurance_expiry:%d.%m.%Y}")
    out += block(
        f"🟠 <b>Истекают в 30 дней — {len(s['soon'])}</b>",
        s["soon"],
        lambda a: (f"• {esc(a.full_name)} — до {a.insurance_expiry:%d.%m.%Y} "
                   f"({(a.insurance_expiry - today).days} дн.)"))

    if s["missing"]:
        # Родителям про это не пишем — см. шапку модуля. Список нужен тренеру,
        # чтобы собрать данные, поэтому он полный, а не «и ещё 35».
        out += block(
            f"⚪ <b>Дата не заполнена — {len(s['missing'])}</b>\n"
            "Родителям об этом не сообщаем: скорее всего полис есть, "
            "просто дату не внесли. Собрать проще самим.",
            s["missing"],
            lambda a: f"• {esc(a.full_name)}")

    return out
