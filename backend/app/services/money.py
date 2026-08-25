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

КАК СКЛАДЫВАЕТСЯ ДОЛГ — проверено на живых данных, а не выведено из имён
полей. При создании нового месяца предыдущий замораживается, а неоплаченные
замороженные пересчитываются в поле debt нового периода:

    debt = (число неоплаченных замороженных) * fee_amount

То есть debt — это ПЕРЕНОС С ПРОШЛЫХ месяцев, собственный взнос текущего в
него НЕ входит. Богатырёв: май/июнь/июль не оплачены, август debt=4500, и
сверх того он должен 1500 за сам август — итого 6000.

Первая версия брала debt ВМЕСТО взноса и недосчитывала по 1500 ₽ на каждом
должнике. Отсюда правило: должен = перенос + собственный взнос месяца.

ПРО ЗАМОРОЗКУ. is_frozen значит «месяц закрыт», а не «платить не надо».
В списке должников замороженные месяцы отдельными строками не идут — они уже
свёрнуты в перенос. А вот в сборе за месяц их исключать нельзя, иначе
история любого прошлого месяца превращается в «0 ₽, 100 %».
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


def _owes_current(p) -> bool:
    """Должен ли за САМ этот месяц (без переноса)."""
    return not p.is_budget and not p.paid


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
    #
    # Считаем так: перенос берём с АКТИВНОГО (незамороженного) периода — это
    # текущий месяц, и в его debt уже свёрнуты все прошлые неоплаченные. Сверх
    # переноса добавляем собственный взнос текущего месяца, если он не закрыт.
    # Замороженные периоды нужны только чтобы назвать месяцы: суммы из них
    # брать нельзя, они бы удвоили перенос.
    by_athlete = {}
    for p, ath, parent in rows:
        rec = by_athlete.setdefault(ath.id, {
            "athlete": ath.full_name, "parent": parent.full_name,
            "phone": parent.phone, "carry": 0, "own": 0, "periods": [],
        })
        if p.is_frozen:
            if not p.is_budget and not p.paid:
                rec["periods"].append((p.period_year, p.period_month))
            continue
        # Активный период — их не больше одного на спортсмена.
        rec["carry"] = int(p.debt or 0)
        if _owes_current(p):
            rec["own"] = fee
            rec["periods"].append((p.period_year, p.period_month))

    for rec in by_athlete.values():
        rec["total"] = rec["carry"] + rec["own"]
    by_athlete = {k: v for k, v in by_athlete.items() if v["total"] > 0}

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

    # Из расчёта исключены только бюджетники: они не платят вовсе, и включи их
    # в «начислено» — процент сбора занизится на ровном месте.
    #
    # Замороженные НЕ исключаем. Заморозка значит «месяц закрыт», а не «платить
    # не надо»: у всех прошлых месяцев она стоит поголовно, и отбросив их, мы
    # показали бы историю как «0 ₽, 100 %».
    #
    # Считаем по собственному взносу месяца, без переноса: «сбор за август» —
    # это про август, а не про накопленный долг. Накопленный виден в должниках.
    payable = [p for p in rows if not p.is_budget]
    due  = len(payable) * fee
    paid = sum(fee for p in payable if p.paid)
    left = max(0, due - paid)
    pct  = round(paid * 100 / due) if due else 100

    closed = sum(1 for p in payable if p.paid)
    open_  = len(payable) - closed
    budget = sum(1 for p in rows if p.is_budget)

    # Полоска: долю видно быстрее числа, а тренер смотрит с телефона.
    # Округление ВНИЗ, а не round: иначе 95 % рисуется полной полоской, и
    # «почти собрали» выглядит как «собрали».
    filled = 10 if pct >= 100 else int(pct // 10)
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
    if budget:
        out.append(f"Бюджетных мест: {budget} (в расчёт не входят)")

    out += ["", "Другой месяц: <code>/collection 07.2026</code>",
            "", f"🔗 Подробно:\n{CABINET_FEES}"]
    return "\n".join(out)


# ─── Отметка оплаты ──────────────────────────────────────────────────────────
#
# Единственное ДЕЙСТВИЕ среди просмотра: всё остальное в боте только читает.
# Поэтому здесь два шага, а не один.
#
# ПОЧЕМУ ПОДТВЕРЖДЕНИЕ. Родитель занёс деньги на тренировке, тренер тут же
# отмечает с телефона. Нажать не туда в списке из тридцати фамилий легко, а
# отменённая по ошибке задолженность не всплывёт: человек просто перестанет
# быть должником, и об этом никто не узнает. Поэтому сначала бот называет
# фамилию, месяц и сумму, и только по второму нажатию ставит отметку.
#
# ПОЧЕМУ ПО ИМЕНИ, А НЕ КНОПКОЙ У КАЖДОГО. Тридцать кнопок в списке — это
# тридцать поводов промахнуться пальцем. Ввод фамилии заставляет назвать
# человека вслух, и промах становится маловероятным.

PAY_CONFIRMED  = "payok:"


def _find_debt_periods(db, query: str):
    """Незакрытые периоды по части фамилии ребёнка или родителя."""
    from app.models.fees import AthleteFeePeriod
    from app.models.user import Athlete, User

    needle = (query or "").strip().casefold()
    if not needle:
        return []

    rows = (
        db.query(AthleteFeePeriod, Athlete, User)
        .join(Athlete, Athlete.id == AthleteFeePeriod.athlete_id)
        .join(User, User.id == Athlete.user_id)
        .filter(Athlete.is_archived == False, User.is_active == True,
                AthleteFeePeriod.is_budget == False,
                AthleteFeePeriod.paid == False,
                AthleteFeePeriod.is_frozen == False)
        .all()
    )
    return [(p, a, u) for p, a, u in rows
            if needle in (a.full_name or "").casefold()
            or needle in (u.full_name or "").casefold()]


def pay_prompt(db, query: str):
    """Шаг 1: найти человека и предложить подтверждение.

    Возвращает (текст, payload_для_кнопки). payload пуст, если подтверждать
    нечего — не нашли или нашли несколько.
    """
    from app.core.markup import esc

    if not (query or "").strip():
        return ("Укажите фамилию: <code>/paid Абрамова</code>\n\n"
                "Отмечается взнос за текущий месяц. Долг за прошлые месяцы "
                "закрывается в кабинете — там видно, за какой именно.", "")

    found = _find_debt_periods(db, query)
    if not found:
        return (f"Не нашёл незакрытых взносов по запросу «{esc(query)}».\n\n"
                "Возможно, уже оплачено. Полный список — /debtors", "")

    if len(found) > 1:
        names = "\n".join(f"• {esc(a.full_name)} ({esc(u.full_name)})"
                          for _, a, u in found[:10])
        return (f"Нашлось несколько ({len(found)}). Уточните запрос:\n\n"
                + names, "")

    p, a, u = found[0]
    fee = _fee_amount(db)
    carry = int(p.debt or 0)
    text = (f"💰 <b>Отметить оплату?</b>\n\n"
            f"🥋 {esc(a.full_name)}\n"
            f"👤 {esc(u.full_name)} — {esc(u.phone)}\n\n"
            f"Взнос за {_label(p.period_year, p.period_month)}: <b>{fee} ₽</b>")
    if carry:
        text += (f"\n\n⚠️ Кроме этого за прошлые месяцы числится "
                 f"<b>{carry} ₽</b> — они останутся. Закрыть их можно в "
                 f"кабинете, там видно, за какой месяц.")
    text += "\n\nНажмите кнопку ниже, чтобы подтвердить."
    return text, f"{PAY_CONFIRMED}{p.id}"


def pay_commit(db, payload: str, actor_id: int) -> str:
    """Шаг 2: поставить отметку. Пишет, КТО и ОТКУДА отметил."""
    from datetime import datetime
    from app.core.markup import esc
    from app.models.fees import AthleteFeePeriod
    from app.models.user import Athlete, User

    try:
        period_id = int(payload[len(PAY_CONFIRMED):])
    except (ValueError, IndexError):
        return "Не понял, что подтверждать. Попробуйте /paid ФАМИЛИЯ заново."

    p = db.query(AthleteFeePeriod).filter(
        AthleteFeePeriod.id == period_id).with_for_update().first()
    if p is None:
        return "Этот взнос больше не найден. Проверьте /debtors."

    if p.paid:
        # Кто-то успел раньше — второй тренер или кабинет. Говорим прямо, а не
        # молча повторяем отметку: иначе непонятно, чья она.
        who = db.query(User).filter(User.id == p.paid_by).first() if p.paid_by else None
        when = f" {p.paid_at:%d.%m %H:%M}" if p.paid_at else ""
        by = f" ({esc(who.full_name)})" if who else ""
        return f"👌 Уже отмечено как оплаченное{when}{by}. Ничего не меняю."

    a = db.query(Athlete).filter(Athlete.id == p.athlete_id).first()
    p.paid = True
    p.paid_at = datetime.utcnow()
    p.paid_by = actor_id
    p.paid_source = "bot"
    db.commit()

    actor = db.query(User).filter(User.id == actor_id).first()
    logger.info("Оплата отмечена из бота: период %s (%s, %s) — отметил %s",
                p.id, a.full_name if a else "?",
                _label(p.period_year, p.period_month),
                actor.full_name if actor else actor_id)

    fee = _fee_amount(db)
    carry = int(p.debt or 0)
    out = (f"✅ <b>Оплата отмечена</b>\n\n"
           f"🥋 {esc(a.full_name) if a else '—'}\n"
           f"{_label(p.period_year, p.period_month)}: {fee} ₽\n\n"
           f"Отметил: {esc(actor.full_name) if actor else '—'}")
    if carry:
        out += f"\n\n⚠️ За прошлые месяцы осталось {carry} ₽."
    out += f"\n\n🔗 {CABINET_FEES}"
    return out


# ─── Сводка о начале просрочки ───────────────────────────────────────────────

PAYMENT_DAY = 25   # то же значение, что в app/routes/fees.py


def overdue_digest(db) -> str:
    """Одна сводка в день начала просрочки. Пусто — рассылать нечего.

    Одна на всех, а не письмо про каждого должника: при тридцати неплательщиках
    тридцать сообщений перестанут читать ровно тогда, когда они нужны.
    Дальше человек сам открывает /debtors, если решил звонить сегодня.
    """
    from app.models.fees import AthleteFeePeriod
    from app.models.user import Athlete, User

    today = date.today()
    fee = _fee_amount(db)

    rows = (
        db.query(AthleteFeePeriod)
        .join(Athlete, Athlete.id == AthleteFeePeriod.athlete_id)
        .join(User, User.id == Athlete.user_id)
        .filter(
            AthleteFeePeriod.period_year == today.year,
            AthleteFeePeriod.period_month == today.month,
            AthleteFeePeriod.is_budget == False,
            AthleteFeePeriod.is_frozen == False,
            AthleteFeePeriod.paid == False,
            Athlete.is_archived == False,
            User.is_active == True,
        )
        .all()
    )
    if not rows:
        return ""

    total = len(rows) * fee
    return (f"⏰ <b>Начался срок просрочки</b>\n\n"
            f"Взнос за {_label(today.year, today.month)} не внесли "
            f"<b>{len(rows)}</b> чел.\n"
            f"Сумма: <b>{total} ₽</b>\n\n"
            f"Кто именно — /debtors")


def debtors_count(db) -> int:
    """Сколько РОДИТЕЛЕЙ имеют долг. Для счётчика в шапке кабинета.

    Считает по той же выборке, что и debtors(), чтобы цифра в кабинете и в
    боте не расходились: две независимые формулы одного числа рано или поздно
    разъезжаются, и тогда непонятно, какой верить.
    """
    from app.models.fees import AthleteFeePeriod
    from app.models.user import Athlete, User

    fee = _fee_amount(db)
    rows = (
        db.query(AthleteFeePeriod, Athlete, User)
        .join(Athlete, Athlete.id == AthleteFeePeriod.athlete_id)
        .join(User, User.id == Athlete.user_id)
        .filter(Athlete.is_archived == False, User.is_active == True,
                AthleteFeePeriod.is_frozen == False)
        .all()
    )
    parents = set()
    for p, ath, parent in rows:
        total = int(p.debt or 0) + (fee if _owes_current(p) else 0)
        if total > 0:
            parents.add(parent.id)
    return len(parents)
