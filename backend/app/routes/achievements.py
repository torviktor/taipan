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


# ── Получить ачивки спортсмена ────────────────────────────────────────────────

@router.get("/athlete/{athlete_id}")
def get_athlete_achievements(
    athlete_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    athlete = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not athlete:
        raise HTTPException(404, "Спортсмен не найден")

    # Проверка прав
    role = current_user.role
    if role not in ("manager", "admin"):
        if role == "athlete" and athlete.user_id != current_user.id:
            raise HTTPException(403)
        if role == "parent":
            ids = [a.id for a in db.query(Athlete).filter(Athlete.user_id == current_user.id).all()]
            if athlete_id not in ids:
                raise HTTPException(403)

    granted = db.query(AthleteAchievement).filter(AthleteAchievement.athlete_id == athlete_id).all()
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
            rec = next(a for a in granted if a.code == ach["code"])
            entry["granted_at"] = str(rec.granted_at)
        result.append(entry)

    return result


@router.get("/athlete/{athlete_id}/unseen")
def get_unseen(athlete_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    unseen = db.query(AthleteAchievement).filter(
        AthleteAchievement.athlete_id == athlete_id,
        AthleteAchievement.seen == False
    ).all()
    return [{"code": a.code, "name": ACHIEVEMENT_MAP.get(a.code, {}).get("name", a.code)} for a in unseen]


@router.patch("/athlete/{athlete_id}/mark-seen")
def mark_seen(athlete_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    db.query(AthleteAchievement).filter(
        AthleteAchievement.athlete_id == athlete_id,
        AthleteAchievement.seen == False
    ).update({"seen": True})
    db.commit()
    return {"ok": True}


# ── Общий рейтинг по ачивкам (для админа) ────────────────────────────────────

@router.get("/leaderboard")
def leaderboard(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = (
        db.query(Athlete, func.count(AthleteAchievement.id).label("count"))
        .join(AthleteAchievement, AthleteAchievement.athlete_id == Athlete.id)
        .group_by(Athlete.id)
        .order_by(func.count(AthleteAchievement.id).desc())
        .all()
    )
    result = []
    for i, (a, cnt) in enumerate(rows):
        # Считаем легендарные отдельно для тай-брейка
        legendary = db.query(AthleteAchievement).filter(
            AthleteAchievement.athlete_id == a.id,
            AthleteAchievement.code.in_([
                ac["code"] for ac in ACHIEVEMENTS if ac["tier"] == "legendary"
            ])
        ).count()
        result.append({
            "place":       i + 1,
            "athlete_id":  a.id,
            "full_name":   a.full_name,
            "group":       a.group,
            "gup":         a.gup,
            "total":       cnt,
            "legendary":   legendary,
        })
    return result


# ── Ручная выдача (для тестирования/admin override) ───────────────────────────

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
    db.add(AthleteAchievement(athlete_id=athlete_id, code=code))
    db.commit()
    return {"ok": True, "granted": True}


# ── Автоначисление — вызывается из других роутов ──────────────────────────────

def auto_grant(athlete_id: int, db: Session) -> list[str]:
    """
    Проверяет и выдаёт все ачивки которые заслужил спортсмен.
    Возвращает список новых кодов.
    """
    existing = {a.code for a in db.query(AthleteAchievement).filter(AthleteAchievement.athlete_id == athlete_id).all()}
    athlete  = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not athlete:
        return []

    new_codes = []

    def grant(code):
        if code not in existing:
            db.add(AthleteAchievement(athlete_id=athlete_id, code=code))
            existing.add(code)
            new_codes.append(code)

    # ── Посещаемость ──────────────────────────────────────────────────────────
    try:
        from app.models.attendance import Attendance, TrainingSession
        total_present = db.query(Attendance).filter(
            Attendance.athlete_id == athlete_id,
            Attendance.present == True
        ).count()

        if total_present >= 10:  grant("attendance_10")
        if total_present >= 50:  grant("attendance_50")
        if total_present >= 100: grant("attendance_100")

        # 100% за любой месяц
        from sqlalchemy import extract
        sessions_by_month = (
            db.query(
                extract('year', TrainingSession.date).label('y'),
                extract('month', TrainingSession.date).label('m'),
                func.count(TrainingSession.id).label('total'),
                func.sum(Attendance.present.cast('integer')).label('present')
            )
            .join(Attendance, Attendance.session_id == TrainingSession.id)
            .filter(Attendance.athlete_id == athlete_id)
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
        results = db.query(CompetitionResult).filter(CompetitionResult.athlete_id == athlete_id).all()

        if results:
            grant("competition_first")

        for r in results:
            if r.sparring_place == 1 or r.stopball_place == 1 or r.tegtim_place == 1 or r.tuli_place == 1:
                grant("competition_gold")
                break

        # Топ-3 текущего сезона
        current_season = date.today().year
        season_rating = (
            db.query(func.sum(CompetitionResult.rating))
            .join(Competition, Competition.id == CompetitionResult.competition_id)
            .filter(
                CompetitionResult.athlete_id == athlete_id,
                Competition.season == current_season
            )
            .scalar() or 0
        )
        # Место в сезоне
        all_season = (
            db.query(Athlete.id, func.sum(CompetitionResult.rating).label('total'))
            .join(CompetitionResult, CompetitionResult.athlete_id == Athlete.id)
            .join(Competition, Competition.id == CompetitionResult.competition_id)
            .filter(Competition.season == current_season)
            .group_by(Athlete.id)
            .order_by(func.sum(CompetitionResult.rating).desc())
            .all()
        )
        ids_ordered = [r.id for r in all_season]
        if athlete_id in ids_ordered and ids_ordered.index(athlete_id) < 3:
            grant("competition_top3_season")

    except Exception as e:
        print(f"Competition achievement error: {e}")

    # ── Аттестация ────────────────────────────────────────────────────────────
    try:
        from app.models.certification import CertificationResult
        cert_results = db.query(CertificationResult).filter(
            CertificationResult.athlete_id == athlete_id,
            CertificationResult.passed == True
        ).all()

        for r in cert_results:
            # «Первый пояс» — только если получил именно 10 гып (первый в жизни)
            if r.target_gup == 10:
                grant("certification_first")
            # «Восхождение» — любое повышение выше 10 гыпа или получение дана
            if (r.target_gup and r.target_gup < 10) or r.target_dan:
                grant("certification_upgrade")

    except Exception as e:
        print(f"Certification achievement error: {e}")

    if new_codes:
        db.commit()

    return new_codes
