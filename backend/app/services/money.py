"""Денежные сводки для бота: должники и сбор за месяц.

Роль manager в клубе — это ДЕНЬГИ и только: взносы, должники, начисления,
расчётные периоды. Всё остальное менеджеру недоступно. Admin видит и это, и
всё остальное.

Расчёты повторяют кабинет: сумма долга — amount_due минус amount_paid, но не
меньше нуля; бюджетники (is_subsidized) из долга исключены. Своя формула
здесь означала бы, что бот и сайт назовут тренеру разные суммы, а спорить с
родителем по такой цифре нельзя.
"""

import logging
from datetime import date

logger = logging.getLogger(__name__)

CABINET_FEES = "https://taipan-tkd.ru/cabinet?tab=fees"

MONTHS = ("январь", "февраль", "март", "апрель", "май", "июнь",
          "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь")


def _label(d: date) -> str:
    return f"{MONTHS[d.month - 1]} {d.year}"


def _period_from(arg: str) -> date:
    """Период из хвоста команды: «08.2026», «2026-08» или пусто — текущий."""
    today = date.today()
    arg = (arg or "").strip()
    if not arg:
        return date(today.year, today.month, 1)
    for sep in (".", "-", "/"):
        if sep in arg:
            a, b = arg.split(sep, 1)
            try:
                a, b = int(a), int(b)
            except ValueError:
                break
            # «08.2026» и «2026-08» — обе формы, различаем по величине
            month, year = (a, b) if a <= 12 else (b, a)
            if 1 <= month <= 12 and 2000 <= year <= 2100:
                return date(year, month, 1)
    return date(today.year, today.month, 1)


def _debt_of(f) -> float:
    if f.is_subsidized:
        return 0.0
    return max(0.0, float(f.amount_due or 0) - float(f.amount_paid or 0))


def debtors(db) -> str:
    """Кто должен: родитель, телефон, ребёнок, сумма, за какие месяцы.

    СОРТИРОВКА — ПО ДАВНОСТИ, а не по сумме. Долг за три месяца по полторы
    тысячи опаснее разового долга в три: он означает, что с семьёй давно не
    говорили, и чем дольше тянуть, тем труднее вернуть. Размер долга при
    равной давности идёт вторым ключом.
    """
    from app.core.markup import esc
    from app.models.fees import MonthlyFee
    from app.models.user import Athlete, User

    rows = (
        db.query(MonthlyFee, Athlete, User)
        .join(Athlete, Athlete.id == MonthlyFee.athlete_id)
        .join(User, User.id == Athlete.user_id)
        .filter(Athlete.is_archived == False, User.is_active == True)
        .all()
    )

    # Копим по ребёнку: у родителя может быть двое, и слить их в одну строку
    # значит потерять, за кого именно долг.
    by_athlete = {}
    for fee, ath, parent in rows:
        debt = _debt_of(fee)
        if debt <= 0.5:
            continue
        key = ath.id
        rec = by_athlete.setdefault(key, {
            "athlete": ath.full_name, "parent": parent.full_name,
            "phone": parent.phone, "total": 0.0, "periods": [],
        })
        rec["total"] += debt
        rec["periods"].append(fee.period)

    if not by_athlete:
        return ("💰 <b>Должники</b>\n\nДолгов нет — все взносы закрыты.\n\n"
                f"🔗 {CABINET_FEES}")

    today = date.today()
    items = list(by_athlete.values())
    for it in items:
        it["periods"].sort()
        it["oldest"] = it["periods"][0]
        it["months"] = len(it["periods"])
    # Сначала самые застарелые, при равной давности — самые крупные.
    items.sort(key=lambda r: (r["oldest"], -r["total"]))

    total_sum = sum(it["total"] for it in items)
    parents = len({it["parent"] for it in items})

    head = ("💰 <b>Должники</b>\n\n"
            f"Человек: <b>{parents}</b>   ·   "
            f"Всего: <b>{total_sum:.0f} ₽</b>\n"
            "Сначала самые застарелые долги.")

    lines = []
    for it in items:
        months = ", ".join(_label(p) for p in it["periods"])
        overdue_months = (today.year - it["oldest"].year) * 12 + \
                         (today.month - it["oldest"].month)
        age = f" · тянется {overdue_months} мес." if overdue_months >= 2 else ""
        lines.append(
            f"• <b>{esc(it['parent'])}</b> — {esc(it['phone'])}\n"
            f"   {esc(it['athlete'])}: <b>{it['total']:.0f} ₽</b>{age}\n"
            f"   за {esc(months)}"
        )

    return (head + "\n\n" + "\n\n".join(lines)
            + f"\n\n🔗 Разбор и отметка оплаты:\n{CABINET_FEES}")


def collection(db, period_arg: str = "") -> str:
    """Сбор за месяц: начислено, оплачено, осталось, процент."""
    from app.models.fees import MonthlyFee

    period = _period_from(period_arg)
    fees = (db.query(MonthlyFee)
            .filter(MonthlyFee.period == period)
            .all())

    if not fees:
        return (f"📊 <b>Сбор за {_label(period)}</b>\n\n"
                "За этот месяц начислений нет.\n\n"
                "Другой месяц: <code>/collection 07.2026</code>\n\n"
                f"🔗 {CABINET_FEES}")

    due  = sum(float(f.amount_due or 0) for f in fees if not f.is_subsidized)
    paid = sum(float(f.amount_paid or 0) for f in fees if not f.is_subsidized)
    left = max(0.0, due - paid)
    pct  = round(paid * 100 / due) if due else 100

    subsidized = sum(1 for f in fees if f.is_subsidized)
    closed = sum(1 for f in fees if not f.is_subsidized and _debt_of(f) <= 0.5)
    open_  = sum(1 for f in fees if not f.is_subsidized and _debt_of(f) > 0.5)

    # Полоска: доля видна быстрее числа, а тренер смотрит с телефона.
    filled = round(pct / 10)
    bar = "█" * filled + "░" * (10 - filled)

    out = [
        f"📊 <b>Сбор за {_label(period)}</b>",
        "",
        f"{bar}  <b>{pct}%</b>",
        "",
        f"Начислено: <b>{due:.0f} ₽</b>",
        f"Оплачено:  <b>{paid:.0f} ₽</b>",
        f"Осталось:  <b>{left:.0f} ₽</b>",
        "",
        f"Закрыли: {closed}   ·   Должны: {open_}",
    ]
    if subsidized:
        out.append(f"Бюджетных мест: {subsidized} (в расчёт не входят)")

    out += ["", "Другой месяц: <code>/collection 07.2026</code>",
            "", f"🔗 Подробно:\n{CABINET_FEES}"]
    return "\n".join(out)
