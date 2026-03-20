# backend/app/routes/achievements.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import date

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Athlete
from app.models.achievement import AthleteAchievement, ACHIEVEMENTS, ACHIEVEMENT_MAP, TIER_ORDER, TIER_LABEL, TIER_COLOR

router = APIRouter(prefix="/achievements", tags=["achievements"])


def get_sport_season(d: date = None) -> int:
    """Год начала спортивного сезона (сентябрь–август)."""
    if d is None:
        d = date.today()
    return d.year if d.month >= 9 else d.year - 1


def season_range(season: int):
    """Диапазон дат сезона."""
    from datetime import date
    return date(season, 9, 1), date(season + 1, 8, 31)


# ── Получить ачивки спортсмена ────────────────────────────────────────────────

@router.get("/athlete/{athlete_id}")
def get_athlete_achievements(
    athlete_id: int,
    date_from: Optional[str] = None,
    date_to:   Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    athlete = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not athlete:
        raise HTTPException(404, "Спортсмен не найден")

    role = current_user.role
    if role not in ("manager", "admin"):
        if role == "athlete":
            if athlete.user_id != current_user.id:
                raise HTTPException(403)
        elif role == "parent":
            ids = [a.id for a in db.query(Athlete).filter(Athlete.user_id == current_user.id).all()]
            if athlete_id not in ids:
                raise HTTPException(403)
        else:
            raise HTTPException(403)

    q = db.query(AthleteAchievement).filter(AthleteAchievement.athlete_id == athlete_id)
    if date_from: q = q.filter(AthleteAchievement.granted_at >= date_from)
    if date_to:   q = q.filter(AthleteAchievement.granted_at <= date_to + ' 23:59:59')
    granted = q.all()
    granted_codes = {a.code for a in granted}

    result = []
    for ach in ACHIEVEMENTS:
        entry = {
            "code":        ach["code"],
            "name":        ach["name"],
            "description": ach["description"],
            "category":    ach["category"],
            "tier":        ach["tier"],
            "tier_label":  TIER_LABEL[ach["tier"]],
            "tier_color":  TIER_COLOR[ach["tier"]],
            "icon":        ach["icon"],
            "granted":     ach["code"] in granted_codes,
            "granted_at":  None,
        }
        if ach["code"] in granted_codes:
            for g in granted:
                if g.code == ach["code"]:
                    entry["granted_at"] = str(g.granted_at)
                    break
        result.append(entry)

    result.sort(key=lambda x: (0 if x["granted"] else 1, TIER_ORDER.get(x["tier"], 0)))
    return result


# ── Таблица лидеров ───────────────────────────────────────────────────────────

@router.get("/leaderboard")
def leaderboard(
    date_from: Optional[str] = None,
    date_to:   Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    q = (
        db.query(Athlete, func.count(AthleteAchievement.id))
        .join(AthleteAchievement, AthleteAchievement.athlete_id == Athlete.id)
        .filter(Athlete.is_archived == False)
    )
    if date_from:
        q = q.filter(AthleteAchievement.granted_at >= date_from)
    if date_to:
        q = q.filter(AthleteAchievement.granted_at <= date_to + ' 23:59:59')
    rows = q.group_by(Athlete.id).order_by(func.count(AthleteAchievement.id).desc()).all()
    result = []
    for i, (a, cnt) in enumerate(rows):
        legendary = db.query(AthleteAchievement).filter(
            AthleteAchievement.athlete_id == a.id,
            AthleteAchievement.code.in_([
                ac["code"] for ac in ACHIEVEMENTS if ac["tier"] == "legendary"
            ])
        ).count()
        result.append({
            "place":      i + 1,
            "athlete_id": a.id,
            "full_name":  a.full_name,
            "group":      a.group,
            "gup":        a.gup,
            "total":      cnt,
            "legendary":  legendary,
        })
    return result


# ── Ручная выдача ─────────────────────────────────────────────────────────────

@router.post("/grant")
def grant_achievement(
    athlete_id: int,
    code: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role not in ("manager", "admin"):
        raise HTTPException(403)
    if code not in ACHIEVEMENT_MAP:
        raise HTTPException(400, f"Неизвестный код: {code}")
    existing = db.query(AthleteAchievement).filter(
        AthleteAchievement.athlete_id == athlete_id,
        AthleteAchievement.code == code
    ).first()
    if existing:
        return {"ok": True, "already": True}
    db.add(AthleteAchievement(athlete_id=athlete_id, code=code, season=get_sport_season()))
    db.commit()
    return {"ok": True, "granted": True}


# ── Автоначисление ────────────────────────────────────────────────────────────

def auto_grant(athlete_id: int, db: Session) -> list[str]:
    """
    Проверяет и выдаёт ачивки за текущий сезон.
    Все ачивки посезонные — каждый сезон начисляются заново.
    """
    current_season = get_sport_season()
    season_start, season_end = season_range(current_season)

    # Уже выданные ачивки В ТЕКУЩЕМ СЕЗОНЕ
    existing = {
        a.code for a in db.query(AthleteAchievement).filter(
            AthleteAchievement.athlete_id == athlete_id,
            AthleteAchievement.season == current_season
        ).all()
    }

    athlete = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not athlete:
        return []

    new_codes = []

    def grant(code):
        if code not in existing and code in ACHIEVEMENT_MAP:
            db.add(AthleteAchievement(athlete_id=athlete_id, code=code, season=current_season))
            existing.add(code)
            new_codes.append(code)

    # ── Посещаемость ──────────────────────────────────────────────────────────
    try:
        from app.models.attendance import Attendance, TrainingSession
        from sqlalchemy import extract

        # Тренировки в текущем сезоне
        season_present = (
            db.query(Attendance)
            .join(TrainingSession, TrainingSession.id == Attendance.session_id)
            .filter(
                Attendance.athlete_id == athlete_id,
                Attendance.present == True,
                TrainingSession.date >= season_start,
                TrainingSession.date <= season_end,
            )
            .count()
        )

        if season_present >= 1:   grant("attendance_first")
        if season_present >= 30:  grant("attendance_30")
        if season_present >= 60:  grant("attendance_60")
        if season_present >= 90:  grant("attendance_90")

        # 100% за любой месяц текущего сезона
        sessions_by_month = (
            db.query(
                extract('year',  TrainingSession.date).label('y'),
                extract('month', TrainingSession.date).label('m'),
                func.count(TrainingSession.id).label('total'),
                func.sum(Attendance.present.cast('integer')).label('present')
            )
            .join(Attendance, Attendance.session_id == TrainingSession.id)
            .filter(
                Attendance.athlete_id == athlete_id,
                TrainingSession.date >= season_start,
                TrainingSession.date <= season_end,
            )
            .group_by('y', 'm')
            .all()
        )
        for row in sessions_by_month:
            if row.total > 0 and row.present == row.total:
                grant("attendance_perfect_month")
                break

    except Exception as e:
        print(f"Attendance achievement error: {e}")

    # ── Соревнования ──────────────────────────────────────────────────────────
    try:
        from app.models.competition import CompetitionResult, Competition

        season_results = (
            db.query(CompetitionResult)
            .join(Competition, Competition.id == CompetitionResult.competition_id)
            .filter(
                CompetitionResult.athlete_id == athlete_id,
                Competition.season == current_season,
                CompetitionResult.status.in_(["confirmed", "paid"])
            )
            .all()
        )

        if season_results:
            grant("competition_first")

        # Соревнований за сезон
        comp_ids = {r.competition_id for r in season_results}
        if len(comp_ids) >= 3:
            grant("competition_3season")

        for r in season_results:
            # Любой призовой
            places = [r.sparring_place, r.stopball_place, r.tegtim_place, r.tuli_place]
            if any(p in (1, 2, 3) for p in places if p):
                grant("competition_medal")
            # 1-е место
            if any(p == 1 for p in places if p):
                grant("competition_gold")
            # Многоборец — 3+ вида на одном соревновании
            disciplines = sum(1 for p in [
                r.sparring_fights, r.stopball_fights, r.tegtim_fights, r.tuli_perfs
            ] if p and p > 0)
            if disciplines >= 3:
                grant("competition_allround")

    except Exception as e:
        print(f"Competition achievement error: {e}")

    # ── Аттестация ────────────────────────────────────────────────────────────
    try:
        from app.models.certification import CertificationResult, Certification

        cert_results = (
            db.query(CertificationResult)
            .join(Certification, Certification.id == CertificationResult.certification_id)
            .filter(
                CertificationResult.athlete_id == athlete_id,
                CertificationResult.passed == True,
                Certification.date >= season_start,
                Certification.date <= season_end,
            )
            .all()
        )

        if cert_results:
            grant("certification_passed")
        if len(cert_results) >= 2:
            grant("certification_double")

    except Exception as e:
        print(f"Certification achievement error: {e}")

    # ── Сборы ─────────────────────────────────────────────────────────────────
    try:
        from app.models.camp import CampParticipant, Camp

        camp_count = (
            db.query(CampParticipant)
            .join(Camp, Camp.id == CampParticipant.camp_id)
            .filter(
                CampParticipant.athlete_id == athlete_id,
                CampParticipant.status.in_(["confirmed", "paid"]),
                Camp.date_start >= season_start,
                Camp.date_start <= season_end,
            )
            .count()
        )

        if camp_count >= 1: grant("camp_first")
        if camp_count >= 2: grant("camp_veteran")

    except Exception as e:
        print(f"Camp achievement error: {e}")

    # ── Комбо ─────────────────────────────────────────────────────────────────
    has_comp  = "competition_first" in existing
    has_cert  = "certification_passed" in existing
    has_camp  = "camp_first" in existing
    if has_comp and has_cert and has_camp:
        grant("combo_full")

    # ── Мета-ачивки (за количество ачивок в сезоне) ───────────────────────────
    season_count = len(existing)  # уже включает только что выданные
    if season_count >= 5:  grant("meta_5")
    if season_count >= 10: grant("meta_10")
    if season_count >= 15: grant("meta_15")

    if new_codes:
        db.commit()

    return new_codes
