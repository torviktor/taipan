"""Досылка недоставленных уведомлений тому, кто только что привязался.

ЗАЧЕМ. Уведомление, созданное для родителя без единого мессенджера, получает
статус no_account — доставить было некуда. До сих пор на этом всё и
заканчивалось: родитель привязывался назавтра и про сборы, взнос или
страховку не узнавал никогда.

Сейчас это не редкий случай, а норма: охват нулевой, и родители
привязываются прямо в эти дни. На 23.08.2026 в базе 62 недоставленных
уведомления — анонс сборов, которые состоятся 28 августа. Все они ещё
актуальны, и все пропали бы.

ЧТО СЧИТАЕМ АКТУАЛЬНЫМ

Досылать всю историю подряд нельзя: человек, привязавшийся сегодня, получил
бы стопку сообщений о том, что уже прошло, — и научился бы их не читать
ровно в тот момент, когда мы хотим обратного.

Актуально то, на что ещё можно ПОВЛИЯТЬ:

  сборы, соревнования, аттестации — событие ещё не началось;
  взносы                         — долг ещё не погашен;
  страховка                      — полис так и не продлён;
  всё остальное                  — только совсем свежее, не старше недели.

Событие вчерашнего дня, оплаченный взнос и продлённый полис не досылаются:
сообщать о них поздно и незачем.

ОГРАНИЧЕНИЯ

  * не старше 30 дней — даже актуальное, но месячной давности, лучше
    оставить тренеру, чем вываливать на нового человека;
  * не больше 5 сообщений — первое впечатление от бота не должно быть
    стопкой уведомлений;
  * по одному на связку (тип, объект) — если про те же сборы уведомляли
    дважды, досылаем последнее.
"""

import logging
from datetime import date, datetime, timedelta

logger = logging.getLogger(__name__)

MAX_AGE_DAYS = 30      # глубже не заглядываем
MAX_MESSAGES = 5       # чтобы привязка не заканчивалась лавиной
FRESH_DAYS = 7         # для уведомлений без понятного «срока годности»


def _still_relevant(db, n) -> bool:
    """Можно ли ещё что-то сделать по этому уведомлению."""
    from app.models.camp import Camp
    from app.models.certification import Certification
    from app.models.competition import Competition
    from app.models.fees import MonthlyFee
    from app.models.user import Athlete

    kind = (n.link_type or n.type or "").lower()
    today = date.today()

    if kind.startswith("insurance"):
        a = db.query(Athlete).filter(Athlete.id == n.link_id).first()
        if not a or a.is_archived or not a.insurance_expiry:
            return False
        # Продлён с запасом — повод исчез.
        return (a.insurance_expiry - today).days <= 30

    if kind == "camp":
        c = db.query(Camp).filter(Camp.id == n.link_id).first()
        return bool(c and c.date_start >= today)

    if kind == "competition":
        c = db.query(Competition).filter(Competition.id == n.link_id).first()
        return bool(c and c.date >= today)

    if kind == "certification":
        c = db.query(Certification).filter(Certification.id == n.link_id).first()
        return bool(c and c.date >= today)

    if kind == "fee":
        f = db.query(MonthlyFee).filter(MonthlyFee.id == n.link_id).first()
        if not f or f.is_subsidized:
            return False
        return float(f.amount_paid or 0) < float(f.amount_due or 0)

    # Прочее — только совсем свежее: у него нет срока, по которому можно
    # судить, и через неделю оно почти наверняка уже неинтересно.
    created = n.created_at
    if created is None:
        return False
    if isinstance(created, datetime):
        created = created.date()
    return (today - created).days <= FRESH_DAYS


def catch_up(db, user_id) -> dict:
    """Вернуть в очередь недоставленное и ещё актуальное. Ничего не создаёт.

    Пере-ставим существующие строки в pending, а не плодим новые: у родителя
    в кабинете и так есть эти уведомления, дубликат выглядел бы ошибкой.
    """
    from app.models.certification import Notification

    since = datetime.utcnow() - timedelta(days=MAX_AGE_DAYS)
    rows = (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.tg_status == "no_account",
            Notification.created_at >= since,
        )
        .order_by(Notification.created_at.desc())
        .all()
    )

    stats = {"looked": len(rows), "requeued": 0, "stale": 0}
    seen = set()

    for n in rows:
        if stats["requeued"] >= MAX_MESSAGES:
            break
        key = ((n.link_type or n.type or ""), n.link_id)
        if key in seen:
            continue
        seen.add(key)

        if not _still_relevant(db, n):
            stats["stale"] += 1
            continue

        n.tg_status = "pending"
        n.tg_error = None
        stats["requeued"] += 1

    if stats["requeued"]:
        db.commit()
        from app.services.notifications import enqueue_telegram_delivery
        enqueue_telegram_delivery()
        logger.info("Догонялка: user_id=%s — вернули в очередь %s из %s "
                    "(неактуальных %s)", user_id, stats["requeued"],
                    stats["looked"], stats["stale"])
    return stats
