"""Выжимки по ребёнку для бота: рейтинг, ачивки, взносы, посещаемость.

ЗАЧЕМ ЭТО В БОТЕ, ЕСЛИ ЕСТЬ КАБИНЕТ. Бот отвечает за короткий ответ на
короткий вопрос — «оплачено или нет», «сколько тренировок». Кабинет отвечает
за полную картину: динамику, историю, разбор. Поэтому КАЖДЫЙ ответ здесь
заканчивается ссылкой на соответствующую вкладку кабинета: бот не заменяет
сайт, а приводит на него.

Тексты живут в одном месте на оба мессенджера. Две копии одного ответа
разъезжаются — это уже проверено на отчёте охвата.

ПРО ССЫЛКИ НА ВКЛАДКИ. До 23.08.2026 вкладки кабинета были чистым состоянием
React: любая ссылка открывала «Спортсменов», и «смотрите вкладку Рейтинг»
означало «ищите сами». Поэтому во фронтенд добавлена поддержка ?tab=, и
ссылки ниже ведут прямо в нужный раздел.
"""

import logging
from datetime import date

logger = logging.getLogger(__name__)

SITE = "https://taipan-tkd.ru"

# Вкладки кабинета родителя. Значения совпадают с parentView во фронтенде —
# при переименовании там сломается здесь, поэтому список короткий и на виду.
TAB = {
    "rating":       f"{SITE}/cabinet?tab=rating",
    "achievements": f"{SITE}/cabinet?tab=achievements",
    "fees":         f"{SITE}/cabinet?tab=fees",
    "attendance":   f"{SITE}/cabinet?tab=attendance",
    "insurance":    f"{SITE}/cabinet?tab=insurance",
    "competitions": f"{SITE}/cabinet?tab=competitions",
}

MONTHS = ("январь", "февраль", "март", "апрель", "май", "июнь",
          "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь")


def _athletes(db, user_id):
    from app.models.user import Athlete
    return (
        db.query(Athlete)
        .filter(Athlete.user_id == user_id, Athlete.is_archived == False)
        .order_by(Athlete.full_name)
        .all()
    )


def _is_female(athlete) -> bool:
    """Пол спортсмена строкой: в модели это Enum, сравнивать удобнее с текстом."""
    g = getattr(athlete, "gender", None)
    return (getattr(g, "value", g) or "") == "female"


def _no_athletes() -> str:
    return ("🥋 За вами пока не закреплено ни одного спортсмена.\n\n"
            "Если это ошибка — скажите тренеру.")


def _footer(tab: str, hint: str) -> str:
    return f"\n\n🔗 {hint}\n{TAB[tab]}"


# ─── Рейтинг ─────────────────────────────────────────────────────────────────

def rating(db, user_id) -> str:
    """Место ребёнка в рейтинге клуба.

    Считается тем же способом, что и в кабинете: сумма CompetitionResult.rating
    за всё время, место — по убыванию суммы среди неархивных спортсменов.
    Повторять здесь логику расчёта нельзя, иначе бот и сайт однажды покажут
    разные места одному человеку.
    """
    from sqlalchemy import func
    from app.core.markup import esc
    from app.models.competition import CompetitionResult
    from app.models.user import Athlete

    mine = _athletes(db, user_id)
    if not mine:
        return _no_athletes()

    totals = dict(
        db.query(CompetitionResult.athlete_id,
                 func.coalesce(func.sum(CompetitionResult.rating), 0))
        .group_by(CompetitionResult.athlete_id)
        .all()
    )
    counts = dict(
        db.query(CompetitionResult.athlete_id, func.count(CompetitionResult.id))
        .group_by(CompetitionResult.athlete_id)
        .all()
    )

    # Место среди всех активных: сортировка та же, что в кабинете.
    everyone = db.query(Athlete).filter(Athlete.is_archived == False).all()
    ranked = sorted(everyone,
                    key=lambda a: (-float(totals.get(a.id, 0) or 0), a.full_name or ""))
    place = {a.id: i + 1 for i, a in enumerate(ranked)}
    total_athletes = len(ranked)

    blocks = []
    for a in mine:
        pts = round(float(totals.get(a.id, 0) or 0), 1)
        cnt = int(counts.get(a.id, 0) or 0)
        if cnt == 0:
            verb = "участвовала" if _is_female(a) else "участвовал"
            blocks.append(
                f"🥋 <b>{esc(a.full_name)}</b>\n"
                f"Пока не {verb} в соревнованиях — рейтинга ещё нет.\n"
                "Он появится после первого выступления."
            )
        else:
            blocks.append(
                f"🥋 <b>{esc(a.full_name)}</b>\n"
                f"Место в клубе: <b>{place.get(a.id, '—')}</b> из {total_athletes}\n"
                f"Очки рейтинга: <b>{pts}</b>\n"
                f"Соревнований: {cnt}"
            )

    return ("🏆 <b>Рейтинг</b>\n\n" + "\n\n".join(blocks)
            + _footer("rating", "Таблица целиком и по сезонам:"))


# ─── Достижения ──────────────────────────────────────────────────────────────

def achievements(db, user_id) -> str:
    from app.core.markup import esc
    from app.models.achievement import ACHIEVEMENTS, ACHIEVEMENT_MAP, AthleteAchievement

    mine = _athletes(db, user_id)
    if not mine:
        return _no_athletes()

    total_possible = len(ACHIEVEMENTS)
    blocks = []
    for a in mine:
        rows = (
            db.query(AthleteAchievement)
            .filter(AthleteAchievement.athlete_id == a.id)
            .order_by(AthleteAchievement.granted_at.desc())
            .all()
        )
        if not rows:
            blocks.append(
                f"🥋 <b>{esc(a.full_name)}</b>\n"
                "Пока ни одной ачивки.\n"
                "Они начисляются сами — за тренировки, соревнования и "
                "аттестации. Первая появится очень скоро."
            )
            continue

        # Показываем последние пять: полный список — в кабинете, а в боте
        # длинная простыня превращается в шум.
        names = []
        for r in rows[:5]:
            meta = ACHIEVEMENT_MAP.get(r.code) or {}
            names.append(f"• {esc(meta.get('name') or r.code)}")
        more = f"\n… и ещё {len(rows) - 5}" if len(rows) > 5 else ""
        blocks.append(
            f"🥋 <b>{esc(a.full_name)}</b>\n"
            f"Получено: <b>{len(rows)}</b> из {total_possible}\n"
            + "\n".join(names) + more
        )

    return ("🎖 <b>Достижения</b>\n\n" + "\n\n".join(blocks)
            + _footer("achievements", "Все ачивки и как их получить:"))


# ─── Взносы ──────────────────────────────────────────────────────────────────

def fees(db, user_id) -> str:
    """Оплата за текущий месяц плюс долги за прошлые, если есть."""
    from app.core.markup import esc
    from app.models.fees import MonthlyFee, FeeStatus

    mine = _athletes(db, user_id)
    if not mine:
        return _no_athletes()

    today = date.today()
    period = date(today.year, today.month, 1)
    ids = [a.id for a in mine]

    current = {f.athlete_id: f for f in
               db.query(MonthlyFee)
               .filter(MonthlyFee.athlete_id.in_(ids), MonthlyFee.period == period)
               .all()}

    # Долги за прошлые месяцы: показываем одной строкой, разбор — в кабинете.
    past = (db.query(MonthlyFee)
            .filter(MonthlyFee.athlete_id.in_(ids), MonthlyFee.period < period)
            .all())
    debt = sum(max(0.0, float(f.amount_due or 0) - float(f.amount_paid or 0))
               for f in past)

    blocks = []
    for a in mine:
        f = current.get(a.id)
        if f is None:
            blocks.append(f"🥋 <b>{esc(a.full_name)}</b>\n"
                          "За этот месяц начислений пока нет.")
            continue

        due  = float(f.amount_due or 0)
        paid = float(f.amount_paid or 0)
        st   = f.computed_status

        if st == FeeStatus.subsidized:
            line = "Бюджетное место — платить не нужно."
        elif st == FeeStatus.paid:
            line = f"✅ Оплачено — {due:.0f} ₽"
        elif paid > 0:
            line = (f"⚠️ Оплачено частично: {paid:.0f} из {due:.0f} ₽\n"
                    f"Осталось: <b>{due - paid:.0f} ₽</b>")
        elif st == FeeStatus.overdue:
            line = f"🔴 Не оплачено, срок прошёл — <b>{due:.0f} ₽</b>"
        elif st == FeeStatus.due:
            line = f"🟠 Не оплачено, срок подходит — <b>{due:.0f} ₽</b>"
        else:
            line = f"🕓 К оплате: <b>{due:.0f} ₽</b>"

        blocks.append(f"🥋 <b>{esc(a.full_name)}</b>\n{line}")

    head = f"💰 <b>Взносы за {MONTHS[today.month - 1]}</b>\n\n"
    tail = ""
    if debt > 0.5:
        tail = f"\n\n❗ Задолженность за прошлые месяцы: <b>{debt:.0f} ₽</b>"

    return head + "\n\n".join(blocks) + tail + _footer("fees", "История платежей:")


# ─── Посещаемость ────────────────────────────────────────────────────────────

def attendance(db, user_id) -> str:
    """Сколько тренировок за текущий месяц."""
    from app.core.markup import esc
    from app.models.attendance import Attendance, TrainingSession

    mine = _athletes(db, user_id)
    if not mine:
        return _no_athletes()

    today = date.today()
    since = date(today.year, today.month, 1)

    blocks = []
    for a in mine:
        rows = (
            db.query(Attendance, TrainingSession)
            .join(TrainingSession, TrainingSession.id == Attendance.session_id)
            .filter(Attendance.athlete_id == a.id, TrainingSession.date >= since)
            .all()
        )
        if not rows:
            blocks.append(f"🥋 <b>{esc(a.full_name)}</b>\n"
                          "В этом месяце отметок пока нет.")
            continue

        been = sum(1 for att, _ in rows if att.present)
        total = len(rows)
        last = max((s.date for att, s in rows if att.present), default=None)

        # Половина клуба — девочки, и «Был на трёх тренировках» про Веронику
        # читается как небрежность. Пол у спортсмена есть, глагол дешёвый.
        verb = "Была" if _is_female(a) else "Был"
        line = f"{verb} на <b>{been}</b> из {total} тренировок"
        if last:
            line += f"\nПоследняя: {last:%d.%m}"
        blocks.append(f"🥋 <b>{esc(a.full_name)}</b>\n{line}")

    return (f"📊 <b>Посещаемость за {MONTHS[today.month - 1]}</b>\n\n"
            + "\n\n".join(blocks)
            + _footer("attendance", "Помесячно и по каждой тренировке:"))


# ─── Страховка ───────────────────────────────────────────────────────────────
#
# Самый ценный раздел из всех: страховка — это срок, который родители
# забывают, а без действующей ребёнка не допустят к соревнованиям. Поэтому
# здесь не только «посмотреть», но и упреждающие уведомления (см.
# app/services/insurance.py).

INSURANCE_OK_DAYS = 30      # с этого запаса считаем, что всё спокойно


def insurance(db, user_id) -> str:
    from app.core.markup import esc

    mine = _athletes(db, user_id)
    if not mine:
        return _no_athletes()

    today = date.today()
    blocks = []
    for a in mine:
        exp = getattr(a, "insurance_expiry", None)
        name = f"🥋 <b>{esc(a.full_name)}</b>"

        if exp is None:
            # Незаполненную дату родителю в вину не ставим: это пробел в
            # данных клуба, а не его забывчивость. Отсюда и формулировка.
            blocks.append(f"{name}\n"
                          "Данных о страховке нет.\n"
                          "Если полис есть — покажите его тренеру, "
                          "дату внесут.")
            continue

        left = (exp - today).days
        if left < 0:
            blocks.append(f"{name}\n"
                          f"🔴 Просрочена {-left} дн. назад "
                          f"(действовала до {exp:%d.%m.%Y})\n"
                          "Без действующей страховки к соревнованиям "
                          "не допускают.")
        elif left == 0:
            blocks.append(f"{name}\n🔴 Заканчивается сегодня ({exp:%d.%m.%Y})")
        elif left <= INSURANCE_OK_DAYS:
            blocks.append(f"{name}\n"
                          f"🟠 Действует до {exp:%d.%m.%Y} — осталось {left} дн.")
        else:
            blocks.append(f"{name}\n✅ Действует до {exp:%d.%m.%Y}")

    return ("🛡 <b>Страховка</b>\n\n" + "\n\n".join(blocks)
            + _footer("insurance", "Подробности в кабинете:"))


# ─── Соревнования ────────────────────────────────────────────────────────────

# Дисциплины: поле места -> как называется. Порядок важен для вывода.
DISCIPLINES = (
    ("sparring_place", "спарринг"),
    ("stopball_place", "стопбол"),
    ("tegtim_place",   "тэгтим"),
    ("tuli_place",     "туль"),
)

MEDAL = {1: "🥇", 2: "🥈", 3: "🥉"}


def competitions(db, user_id) -> str:
    """Медали и последние выступления ребёнка."""
    from app.core.markup import esc
    from app.models.competition import Competition, CompetitionResult

    mine = _athletes(db, user_id)
    if not mine:
        return _no_athletes()

    blocks = []
    for a in mine:
        rows = (
            db.query(CompetitionResult, Competition)
            .join(Competition, Competition.id == CompetitionResult.competition_id)
            .filter(CompetitionResult.athlete_id == a.id)
            .order_by(Competition.date.desc())
            .all()
        )
        if not rows:
            verb = "выступала" if _is_female(a) else "выступал"
            blocks.append(f"🥋 <b>{esc(a.full_name)}</b>\n"
                          f"Пока не {verb} на соревнованиях.\n"
                          "Здесь появятся результаты после первого турнира.")
            continue

        # Медали за всё время: по каждой дисциплине своё место, поэтому
        # считаем по всем четырём.
        medals = {1: 0, 2: 0, 3: 0}
        for res, _c in rows:
            for field, _label in DISCIPLINES:
                place = getattr(res, field, None)
                if place in medals:
                    medals[place] += 1

        head = f"🥋 <b>{esc(a.full_name)}</b>\nТурниров: {len(rows)}"
        if sum(medals.values()):
            head += ("\nМедали: "
                     + "   ".join(f"{MEDAL[p]} {medals[p]}"
                                  for p in (1, 2, 3) if medals[p]))
        else:
            head += "\nМедалей пока нет — они впереди."

        # Последние три турнира: полная история в кабинете, в боте — свежее.
        recent = []
        for res, comp in rows[:3]:
            places = []
            for field, label in DISCIPLINES:
                place = getattr(res, field, None)
                if place:
                    places.append(f"{MEDAL.get(place, f'{place} место')} {label}"
                                  if place in MEDAL else f"{label} — {place} место")
            tail = ", ".join(places) if places else "без призового места"
            recent.append(f"• {comp.date:%d.%m.%Y} — {esc(comp.name)}\n   {tail}")

        blocks.append(head + "\n\n" + "\n".join(recent))

    return ("🏅 <b>Соревнования</b>\n\n" + "\n\n".join(blocks)
            + _footer("competitions", "Все выступления и протоколы:"))
