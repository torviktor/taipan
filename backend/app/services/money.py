"""Денежные сводки для бота: должники и сбор за месяц.

Роль manager в клубе — это ДЕНЬГИ и только: взносы, должники, начисления,
расчётные периоды. Всё остальное менеджеру недоступно. Admin видит и это, и
всё прочее.

ПРО ВЫБОР ТАБЛИЦЫ — это здесь главное. В базе живут две системы учёта:

  athlete_fee_periods — ею клуб ПОЛЬЗУЕТСЯ. 220 строк, 45 оплачено, 108
                        бюджетных. С ней работает вкладка «Взносы» у тренера
                        (эндпоинты /fees/periods*).
  monthly_fees        — параллельная, её никто не заполняет: 165 строк и НИ
                        ОДНОЙ оплаты, при 247 500 ₽ начислений. Живёт только
                        в родительской вкладке /fees/my.

Первая версия этого модуля читала monthly_fees и показала бы тренеру
«47 должников на 247 500 ₽» — при том, что половина спортсменов на бюджете и
вовсе не платит, а 45 периодов закрыты. Поймано проверкой на живых данных до
того, как это увидел менеджер.

Считаем как кабинет: должен тот, у кого period не бюджетный, не заморожен и
не отмечен оплаченным. Сумма — из FeeConfig, поле debt на строке периода
переопределяет её, если задано.
"""

import logging
from datetime import date

logger = logging.getLogger(__name__)

CABINET_FEES = "https://taipan-tkd.ru/cabinet?tab=fees"

MONTHS = ("январь", "февраль", "март", "апрель", "май", "июнь",
          "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь")

DEFAULT_FEE = 2000


def _label(year: int, month: int) -> str:
    return f"{MONTHS[month - 1]} {year}"


def _fee_amount(db) -> int:
    from app.models.fees import FeeConfig
    cfg = db.query(FeeConfig).first()
    return int(cfg.fee_amount) if cfg and cfg.fee_amount else DEFAULT_FEE


def _period_from(arg: str):
    """(год, месяц) из хвоста команды: «08.2026», «2026-08» или пусто."""
    today = date.today()
    arg = (arg or "").strip()
    if arg:
        for sep in (".", "-", "/"):
            if sep in arg:
                a, b = arg.split(sep, 1)
                try:
                    a, b = int(a), int(b)
                except ValueError:
                    break
                month, year = (a, b) if a <= 12 else (b, a)
                if 1 <= month <= 12 and 2000 <= year <= 2100:
                    return year, month
    return today.year, today.month


def _owes(p) -> bool:
    """Должен ли по этой строке периода.

    Бюджетники не платят вовсе, замороженные исключены намеренно (так тренер
    помечает пропуски по болезни и отъезду), оплаченные закрыты.
    """
    return not p.is_budget and not p.is_frozen and not p.paid


def _amount(p, default: int) -> int:
    """Сколько должен: debt на строке переопределяет общую сумму взноса."""
    return int(p.debt) if p.debt else default


def debtors(db) -> str:
    """Кто должен: родитель, телефон, ребёнок, сумма, за какие месяцы.

    СОРТИРОВКА ПО ДАВНОСТИ, а не по сумме. Долг за три месяца по полторы
    тысячи опаснее разового долга в три: он означает, что с семьёй давно не
    говорили, и чем дольше тянуть, тем труднее вернуть. Размер идёт вторым
    ключом при равной давности.
    """
    from app.core.markup import esc
    from app.models.fees import AthleteFeePeriod
    from app.models.user import Athlete, User

    fee = _fee_amount(db)
    rows = (
        db.query(AthleteFeePeriod, Athlete, User)
        .join(Athlete, Athlete.id == AthleteFeePeriod.athlete_id)
        .join(User, User.id == Athlete.user_id)
        .filter(Athlete.is_archived == False, User.is_active == True)
        .all()
    )

    # Копим по РЕБЁНКУ: у родителя может быть двое, и слить их в одну строку
    # значит потерять, за кого именно долг.
    by_athlete = {}
    for p, ath, parent in rows:
        if not _owes(p):
            continue
        rec = by_athlete.setdefault(ath.id, {
            "athlete": ath.full_name, "parent": parent.full_name,
            "phone": parent.phone, "total": 0, "periods": [],
        })
        rec["total"] += _amount(p, fee)
        rec["periods"].append((p.period_year, p.period_month))

    if not by_athlete:
        return ("💰 <b>Должники</b>\n\nДолгов нет — все взносы закрыты.\n\n"
                f"🔗 {CABINET_FEES}")

    today = date.today()
    items = list(by_athlete.values())
    for it in items:
        it["periods"].sort()
        it["oldest"] = it["periods"][0]
    items.sort(key=lambda r: (r["oldest"], -r["total"]))

    total_sum = sum(it["total"] for it in items)
    parents = len({it["parent"] for it in items})

    head = ("💰 <b>Должники</b>\n\n"
            f"Человек: <b>{parents}</b>   ·   "
            f"Всего: <b>{total_sum} ₽</b>\n"
            "Сначала самые застарелые долги.")

    lines = []
    for it in items:
        months = ", ".join(_label(y, m) for y, m in it["periods"])
        y, m = it["oldest"]
        age = (today.year - y) * 12 + (today.month - m)
        tail = f" · тянется {age} мес." if age >= 2 else ""
        lines.append(
            f"• <b>{esc(it['parent'])}</b> — {esc(it['phone'])}\n"
            f"   {esc(it['athlete'])}: <b>{it['total']} ₽</b>{tail}\n"
            f"   за {esc(months)}"
        )

    return (head + "\n\n" + "\n\n".join(lines)
            + f"\n\n🔗 Разбор и отметка оплаты:\n{CABINET_FEES}")


def collection(db, period_arg: str = "") -> str:
    """Сбор за месяц: начислено, оплачено, осталось, процент."""
    from app.models.fees import AthleteFeePeriod
    from app.models.user import Athlete

    year, month = _period_from(period_arg)
    fee = _fee_amount(db)

    rows = (
        db.query(AthleteFeePeriod)
        .join(Athlete, Athlete.id == AthleteFeePeriod.athlete_id)
        .filter(
            AthleteFeePeriod.period_year == year,
            AthleteFeePeriod.period_month == month,
            Athlete.is_archived == False,
        )
        .all()
    )

    if not rows:
        return (f"📊 <b>Сбор за {_label(year, month)}</b>\n\n"
                "За этот месяц начислений нет.\n\n"
                "Другой месяц: <code>/collection 07.2026</code>\n\n"
                f"🔗 {CABINET_FEES}")

    # Бюджетные и замороженные из расчёта исключены: включи их в «начислено» —
    # процент сбора занизится на ровном месте.
    payable = [p for p in rows if not p.is_budget and not p.is_frozen]
    due  = sum(_amount(p, fee) for p in payable)
    paid = sum(_amount(p, fee) for p in payable if p.paid)
    left = max(0, due - paid)
    pct  = round(paid * 100 / due) if due else 100

    closed = sum(1 for p in payable if p.paid)
    open_  = len(payable) - closed
    budget = sum(1 for p in rows if p.is_budget)
    frozen = sum(1 for p in rows if p.is_frozen and not p.is_budget)

    # Полоска: долю видно быстрее числа, а тренер смотрит с телефона.
    filled = round(pct / 10)
    bar = "█" * filled + "░" * (10 - filled)

    out = [
        f"📊 <b>Сбор за {_label(year, month)}</b>",
        "",
        f"{bar}  <b>{pct}%</b>",
        "",
        f"Начислено: <b>{due} ₽</b>",
        f"Оплачено:  <b>{paid} ₽</b>",
        f"Осталось:  <b>{left} ₽</b>",
        "",
        f"Закрыли: {closed}   ·   Должны: {open_}",
    ]
    extra = []
    if budget:
        extra.append(f"бюджетных {budget}")
    if frozen:
        extra.append(f"заморожено {frozen}")
    if extra:
        out.append("В расчёт не входят: " + ", ".join(extra))

    out += ["", "Другой месяц: <code>/collection 07.2026</code>",
            "", f"🔗 Подробно:\n{CABINET_FEES}"]
    return "\n".join(out)
