# backend/app/services/weekly_digest.py

from datetime import datetime, timedelta, date, time, timezone
from typing import Tuple
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.attendance import TrainingSession, Attendance
from app.models.achievement import AthleteAchievement, ACHIEVEMENT_MAP, TIER_ORDER
from app.models.user import Athlete
from app.models.competition import Competition, CompetitionResult
from app.models.certification import Certification, CertificationResult


MSK = ZoneInfo("Europe/Moscow")


_DISCIPLINES = [
    ("sparring_place", "спарринг"),
    ("stopball_place", "степбол"),
    ("tegtim_place",   "тэги"),
    ("tuli_place",     "туль"),
]


RU_MONTHS_GENITIVE = {
    1:  "января",   2:  "февраля", 3:  "марта",    4:  "апреля",
    5:  "мая",      6:  "июня",    7:  "июля",     8:  "августа",
    9:  "сентября", 10: "октября", 11: "ноября",   12: "декабря",
}


def _pluralize_ru(n: int, one: str, few: str, many: str) -> str:
    """Русские числительные.

    one  — для 1, 21, 31, ... (кроме 11)
    few  — для 2-4, 22-24, ... (кроме 12-14)
    many — для 0, 5-20, 25-30, ...
    """
    n_abs = abs(n)
    mod100 = n_abs % 100
    mod10 = n_abs % 10
    if 11 <= mod100 <= 14:
        return many
    if mod10 == 1:
        return one
    if 2 <= mod10 <= 4:
        return few
    return many


def _format_medals_aggregate(medals: list[dict]) -> str:
    """Агрегат по списку медалей: "12 медалей (3 золота, 4 серебра, 5 бронзы)".

    medals — элементы вида {"place": 1|2|3, ...}. Категории "золото/серебро/
    бронза" — фиксированные слова без плюрализации; нулевые не выводятся.
    """
    gold = sum(1 for m in medals if m.get("place") == 1)
    silver = sum(1 for m in medals if m.get("place") == 2)
    bronze = sum(1 for m in medals if m.get("place") == 3)
    total = gold + silver + bronze
    word = _pluralize_ru(total, "медаль", "медали", "медалей")
    parts = []
    if gold:
        parts.append(f"{gold} золот{'о' if gold == 1 else 'а'}")
    if silver:
        parts.append(f"{silver} серебр{'о' if silver == 1 else 'а'}")
    if bronze:
        parts.append(f"{bronze} бронз{'а' if bronze == 1 else 'ы'}")
    if parts:
        return f"{total} {word} ({', '.join(parts)})"
    return f"{total} {word}"


def _format_bday_ru(day_month: str) -> str:
    """'18.05' -> '18 мая'. На некорректном вводе возвращает исходник."""
    try:
        d, m = day_month.split(".", 1)
        return f"{int(d)} {RU_MONTHS_GENITIVE[int(m)]}"
    except (ValueError, KeyError):
        return day_month


def get_msk_week_range(now_utc: datetime) -> Tuple[datetime, datetime]:
    """UTC-границы московской календарной недели для момента now_utc.

    Понедельник 00:00:00 МСК — воскресенье 23:59:59 МСК → обратно в UTC.
    """
    now_msk = now_utc.astimezone(MSK)
    monday_date = (now_msk - timedelta(days=now_msk.weekday())).date()
    week_start_msk = datetime.combine(monday_date, time(0, 0, 0), tzinfo=MSK)
    week_end_msk = datetime.combine(
        monday_date + timedelta(days=6), time(23, 59, 59), tzinfo=MSK,
    )
    return (
        week_start_msk.astimezone(timezone.utc),
        week_end_msk.astimezone(timezone.utc),
    )


def collect_week_stats(
    db: Session,
    week_start_utc: datetime,
    week_end_utc: datetime,
) -> dict:
    """Собрать агрегаты по недельному диапазону для еженедельного дайджеста."""
    week_start_msk = week_start_utc.astimezone(MSK)
    week_end_msk = week_end_utc.astimezone(MSK)
    week_start_date = week_start_msk.date()
    week_end_date = week_end_msk.date()

    # ── Тренировки и посещаемость (по МСК-датам) ──────────────────────────
    sessions = db.query(TrainingSession).filter(
        TrainingSession.date >= week_start_date,
        TrainingSession.date <= week_end_date,
    ).all()
    trainings_count = len(sessions)

    if sessions:
        session_ids = [s.id for s in sessions]
        attendance_total = db.query(func.count(Attendance.id)).filter(
            Attendance.session_id.in_(session_ids),
        ).scalar() or 0
        attendance_present = db.query(func.count(Attendance.id)).filter(
            Attendance.session_id.in_(session_ids),
            Attendance.present == True,
        ).scalar() or 0
    else:
        attendance_total = 0
        attendance_present = 0

    attendance_rate = (
        attendance_present / attendance_total * 100.0
        if attendance_total else 0.0
    )

    # ── Новые ачивки за неделю ────────────────────────────────────────────
    ach_rows = db.query(AthleteAchievement, Athlete).join(
        Athlete, AthleteAchievement.athlete_id == Athlete.id,
    ).filter(
        AthleteAchievement.granted_at >= week_start_utc,
        AthleteAchievement.granted_at <= week_end_utc,
    ).order_by(AthleteAchievement.granted_at.asc()).all()

    new_achievements: list[dict] = []
    for ach, athlete in ach_rows:
        meta = ACHIEVEMENT_MAP.get(ach.code)
        if not meta:
            continue
        new_achievements.append({
            "athlete_name": athlete.full_name,
            "achievement_name": meta["name"],
            "tier": meta.get("tier", "common"),
        })

    # Правило массовости: при >10 ачивках свернуть список в агрегат
    # с 2-3 яркими примерами (приоритет по tier: legendary > rare > common).
    total_ach = len(new_achievements)
    if total_ach > 10:
        sorted_for_highlights = sorted(
            new_achievements,
            key=lambda a: TIER_ORDER.get(a["tier"], 0),
            reverse=True,
        )
        seen: set[str] = set()
        highlights: list[str] = []
        for a in sorted_for_highlights:
            name = a["achievement_name"]
            if name not in seen:
                seen.add(name)
                highlights.append(name)
            if len(highlights) >= 3:
                break
        new_achievements_overflow = {"total": total_ach, "highlights": highlights}
    else:
        new_achievements_overflow = None

    # ── Соревнования за неделю + медали ───────────────────────────────────
    competitions_list: list[dict] = []
    comps = db.query(Competition).filter(
        Competition.date >= week_start_date,
        Competition.date <= week_end_date,
    ).order_by(Competition.date.asc()).all()

    for comp in comps:
        result_rows = db.query(CompetitionResult, Athlete).join(
            Athlete, CompetitionResult.athlete_id == Athlete.id,
        ).filter(
            CompetitionResult.competition_id == comp.id,
        ).all()

        medals: list[dict] = []
        for r, athlete in result_rows:
            for field_name, discipline in _DISCIPLINES:
                place = getattr(r, field_name)
                if place in (1, 2, 3):
                    medals.append({
                        "athlete_name": athlete.full_name,
                        "place": place,
                        "discipline": discipline,
                    })
        medals.sort(key=lambda m: m["place"])

        competitions_list.append({
            "name": comp.name,
            "date": comp.date,
            "medals": medals,
        })

    # ── Аттестации за неделю ──────────────────────────────────────────────
    certifications_list: list[dict] = []
    certs = db.query(Certification).filter(
        Certification.date >= week_start_date,
        Certification.date <= week_end_date,
    ).order_by(Certification.date.asc()).all()

    for cert in certs:
        total_count = db.query(func.count(CertificationResult.id)).filter(
            CertificationResult.certification_id == cert.id,
        ).scalar() or 0
        passed_count = db.query(func.count(CertificationResult.id)).filter(
            CertificationResult.certification_id == cert.id,
            CertificationResult.passed == True,
        ).scalar() or 0
        certifications_list.append({
            "name": cert.name,
            "date": cert.date,
            "passed_count": passed_count,
            "total_count": total_count,
        })

    # ── Дни рождения на следующей неделе ──────────────────────────────────
    next_week_start = week_end_date + timedelta(days=1)
    target_md = {
        ((next_week_start + timedelta(days=i)).month,
         (next_week_start + timedelta(days=i)).day)
        for i in range(7)
    }

    birthdays_next_week: list[dict] = []
    athletes_active = db.query(Athlete).filter(
        Athlete.is_archived == False,
    ).all()
    for ath in athletes_active:
        if not ath.birth_date:
            continue
        key = (ath.birth_date.month, ath.birth_date.day)
        if key in target_md:
            birthdays_next_week.append({
                "athlete_name": ath.full_name,
                "day_month": f"{ath.birth_date.day:02d}.{ath.birth_date.month:02d}",
                "_sort_key": key,
            })
    birthdays_next_week.sort(key=lambda b: b["_sort_key"])
    for b in birthdays_next_week:
        b.pop("_sort_key", None)

    # ── Лидеры по приросту рейтинга ───────────────────────────────────────
    leader_rows = db.query(
        CompetitionResult.athlete_id,
        func.sum(CompetitionResult.rating).label("total"),
    ).filter(
        CompetitionResult.created_at >= week_start_utc,
        CompetitionResult.created_at <= week_end_utc,
        CompetitionResult.rating > 0,
    ).group_by(CompetitionResult.athlete_id).order_by(
        func.sum(CompetitionResult.rating).desc()
    ).limit(5).all()

    rating_leaders: list[dict] = []
    if leader_rows:
        leader_ids = [row[0] for row in leader_rows]
        athletes_map = {
            a.id: a
            for a in db.query(Athlete).filter(Athlete.id.in_(leader_ids)).all()
        }
        for athlete_id, total in leader_rows:
            athlete = athletes_map.get(athlete_id)
            if not athlete:
                continue
            rating_leaders.append({
                "athlete_name": athlete.full_name,
                "rating_gained": round(float(total), 1),
            })

    return {
        "trainings_count":           trainings_count,
        "attendance_present":        attendance_present,
        "attendance_total":          attendance_total,
        "attendance_rate":           attendance_rate,
        "new_achievements":          new_achievements,
        "new_achievements_overflow": new_achievements_overflow,
        "competitions":              competitions_list,
        "certifications":            certifications_list,
        "birthdays_next_week":       birthdays_next_week,
        "rating_leaders":            rating_leaders,
    }


def build_weekly_digest(
    stats: dict,
    week_start_utc: datetime,
    week_end_utc: datetime,
) -> Tuple[str, str]:
    """Сформировать (title, body) дайджеста по агрегатам."""
    week_start_msk = week_start_utc.astimezone(MSK)
    week_end_msk = week_end_utc.astimezone(MSK)

    title = f"Итоги недели {week_start_msk:%d.%m}—{week_end_msk:%d.%m.%Y}"

    sections: list[str] = []

    trainings_count    = stats["trainings_count"]
    attendance_present = stats["attendance_present"]
    attendance_total   = stats["attendance_total"]
    attendance_rate    = stats["attendance_rate"]

    if trainings_count > 0:
        trainings_word = _pluralize_ru(
            trainings_count, "тренировка", "тренировки", "тренировок",
        )
        line = f"За неделю проведено {trainings_count} {trainings_word}."
        if attendance_total > 0:
            line += (
                f" Посещаемость: {attendance_present} из {attendance_total}"
                f" ({attendance_rate:.0f}%)."
            )
        sections.append("ТРЕНИРОВКИ\n" + line)

    if stats["new_achievements"]:
        overflow = stats.get("new_achievements_overflow")
        if overflow:
            total_word = _pluralize_ru(
                overflow["total"], "достижение", "достижения", "достижений",
            )
            line = f"На этой неделе {overflow['total']} {total_word}."
            if overflow["highlights"]:
                line += f" Среди них: {', '.join(overflow['highlights'])}."
            sections.append("НОВЫЕ ДОСТИЖЕНИЯ\n" + line)
        else:
            lines = ["НОВЫЕ ДОСТИЖЕНИЯ"]
            for a in stats["new_achievements"]:
                lines.append(f"• {a['athlete_name']} — {a['achievement_name']}")
            sections.append("\n".join(lines))

    if stats["competitions"]:
        lines = ["СОРЕВНОВАНИЯ"]
        for comp in stats["competitions"]:
            d = comp["date"]
            if comp["medals"]:
                aggregate = _format_medals_aggregate(comp["medals"])
                lines.append(f"• {comp['name']} ({d:%d.%m}) — {aggregate}.")
            else:
                lines.append(
                    f"• {comp['name']} ({d:%d.%m}) — результаты будут добавлены позже."
                )
        sections.append("\n".join(lines))

    if stats["certifications"]:
        lines = ["АТТЕСТАЦИИ"]
        for cert in stats["certifications"]:
            d = cert["date"]
            lines.append(
                f"• {cert['name']} ({d:%d.%m}) — "
                f"сдали {cert['passed_count']} из {cert['total_count']}."
            )
        sections.append("\n".join(lines))

    if stats["birthdays_next_week"]:
        lines = ["ДНИ РОЖДЕНИЯ НА СЛЕДУЮЩЕЙ НЕДЕЛЕ"]
        for b in stats["birthdays_next_week"]:
            lines.append(f"• {b['athlete_name']} — {_format_bday_ru(b['day_month'])}")
        sections.append("\n".join(lines))

    if stats["rating_leaders"]:
        lines = ["ЛИДЕРЫ ПО ПРИРОСТУ РЕЙТИНГА"]
        for r in stats["rating_leaders"]:
            lines.append(f"• {r['athlete_name']} — +{r['rating_gained']}")
        sections.append("\n".join(lines))

    if not sections:
        body = "На этой неделе значимых событий не было. Хорошей следующей!"
    else:
        body = "\n\n".join(sections)

    return title, body
