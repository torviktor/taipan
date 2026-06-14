"""Эндпоинты «Лучшие спортсмены сезона» — 4 слота × сезоны.

Слоты: junior_boy, junior_girl, senior_boy, senior_girl.
Сезон хранится как int (год начала). Наружу формируется как "YYYY/YYYY".
"""

import os
import shutil
import uuid
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.seasons import get_current_season, format_season_label
from app.models.user import User, Athlete
from app.models.competition import CompetitionResult, Competition
from app.models.achievement import AthleteAchievement, ACHIEVEMENT_MAP
from app.models.season_best import SeasonBestAthlete, ALL_SLOTS

router = APIRouter(prefix="/season-best", tags=["Лучшие сезона"])

UPLOAD_DIR = "/app/static/season-best"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _remove_photo_file(photo_url: Optional[str]) -> None:
    """Удалить файл фото с диска по его публичному URL. Безопасно для None."""
    if not photo_url:
        return
    path = f"/app/static{photo_url.replace('/static', '')}"
    if os.path.exists(path):
        os.remove(path)


# ── Группы (синхронизировано с fees.py) ───────────────────────────────────────

JUNIOR_GROUPS = ('Младшая группа (6–10 лет)',)
SENIOR_GROUPS = ('Старшая группа (11+)', 'Взрослые (18+)')


def _slot_filters(slot: str):
    """Возвращает (groups_tuple, gender_str) для слота."""
    if slot == "junior_boy":   return JUNIOR_GROUPS, "male"
    if slot == "junior_girl":  return JUNIOR_GROUPS, "female"
    if slot == "senior_boy":   return SENIOR_GROUPS, "male"
    if slot == "senior_girl":  return SENIOR_GROUPS, "female"
    raise HTTPException(400, f"Неизвестный слот: {slot}")


SLOT_TO_ACHIEVEMENT = {
    "junior_boy":  "season_best_junior_boy",
    "junior_girl": "season_best_junior_girl",
    "senior_boy":  "season_best_senior_boy",
    "senior_girl": "season_best_senior_girl",
}


def require_manager(u: User = Depends(get_current_user)) -> User:
    if u.role not in ("manager", "admin"):
        raise HTTPException(403, "Недостаточно прав")
    return u


# ── Схемы запроса ─────────────────────────────────────────────────────────────

class AssignBody(BaseModel):
    athlete_id: int = Field(..., gt=0)
    slot:       str
    season:     Optional[int] = None  # если не указано — текущий сезон


class PositionBody(BaseModel):
    photo_position: str


# ── Хелперы выдачи ────────────────────────────────────────────────────────────

def _entry_out(e: SeasonBestAthlete) -> dict:
    a = e.athlete
    return {
        "id":           e.id,
        "athlete_id":   e.athlete_id,
        "athlete_name": a.full_name if a else "",
        "gup":          a.gup if a else None,
        "dan":          a.dan if a else None,
        "group":        a.group if a else None,
        "gender":       (a.gender.value if hasattr(a.gender, "value") else a.gender) if a else None,
        "slot":           e.slot,
        "season":         e.season,
        "season_label":   format_season_label(e.season),
        "photo_url":      e.photo_url,
        "photo_position": e.photo_position or "0px 0px / 100%",
    }


def _athlete_out(a: Athlete, total_rating: float, tournaments: int) -> dict:
    return {
        "athlete_id":        a.id,
        "full_name":         a.full_name,
        "group":             a.group,
        "gender":            a.gender.value if hasattr(a.gender, "value") else a.gender,
        "gup":               a.gup,
        "dan":               a.dan,
        "total_rating":      round(float(total_rating or 0), 2),
        "tournaments_count": int(tournaments or 0),
    }


def _top_candidates(db: Session, slot: str, season: int, limit: int = 3) -> List[dict]:
    """Топ-N спортсменов по сумме CompetitionResult.rating в указанном сезоне,
    с фильтром по группе и полу слота. Архивированные исключены."""
    groups, gender = _slot_filters(slot)

    sub_q = (
        db.query(
            CompetitionResult.athlete_id,
            func.sum(CompetitionResult.rating).label("total"),
            func.count(CompetitionResult.id).label("cnt"),
        )
        .join(Competition, Competition.id == CompetitionResult.competition_id)
        .filter(Competition.season == season)
        .group_by(CompetitionResult.athlete_id)
        .subquery()
    )

    rows = (
        db.query(
            Athlete,
            func.coalesce(sub_q.c.total, 0).label("total"),
            func.coalesce(sub_q.c.cnt, 0).label("cnt"),
        )
        .filter(
            Athlete.is_archived == False,
            Athlete.group.in_(groups),
            Athlete.gender == gender,
        )
        .outerjoin(sub_q, sub_q.c.athlete_id == Athlete.id)
        .order_by(
            func.coalesce(sub_q.c.total, 0).desc(),
            Athlete.full_name.asc(),
        )
        .limit(limit)
        .all()
    )
    return [_athlete_out(a, total, cnt) for (a, total, cnt) in rows]


def _grant_legendary(db: Session, athlete_id: int, slot: str, season: int) -> None:
    code = SLOT_TO_ACHIEVEMENT[slot]
    if code not in ACHIEVEMENT_MAP:
        return
    # Если у того же спортсмена уже есть эта ачивка за тот же сезон — не дублируем.
    existing = db.query(AthleteAchievement).filter(
        AthleteAchievement.athlete_id == athlete_id,
        AthleteAchievement.code == code,
        AthleteAchievement.season == season,
    ).first()
    if existing:
        return
    db.add(AthleteAchievement(athlete_id=athlete_id, code=code, season=season))


def _revoke_legendary(db: Session, athlete_id: int, slot: str, season: int) -> None:
    code = SLOT_TO_ACHIEVEMENT[slot]
    db.query(AthleteAchievement).filter(
        AthleteAchievement.athlete_id == athlete_id,
        AthleteAchievement.code == code,
        AthleteAchievement.season == season,
    ).delete()


def _validate_athlete_for_slot(db: Session, athlete_id: int, slot: str) -> Athlete:
    """Проверяет, что атлет существует, не архивирован и подходит под слот."""
    athlete = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not athlete:
        raise HTTPException(404, "Спортсмен не найден")
    if athlete.is_archived:
        raise HTTPException(400, "Нельзя назначить архивированного спортсмена")
    groups, gender = _slot_filters(slot)
    actual_gender = athlete.gender.value if hasattr(athlete.gender, "value") else athlete.gender
    if athlete.group not in groups or actual_gender != gender:
        raise HTTPException(
            400,
            f"Спортсмен не подходит под слот {slot}: "
            f"группа={athlete.group}, пол={actual_gender}",
        )
    return athlete


# ── Публичные роуты ──────────────────────────────────────────────────────────

@router.get("")
def list_season_best(
    season: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Список занятых слотов для указанного сезона (или текущего).
    Публичный — для страницы Champions."""
    if season is None:
        season = get_current_season()
    items = (
        db.query(SeasonBestAthlete)
        .filter(SeasonBestAthlete.season == season)
        .all()
    )
    return {
        "season":       season,
        "season_label": format_season_label(season),
        "slots":        [_entry_out(e) for e in items],
    }


@router.get("/seasons")
def list_seasons(db: Session = Depends(get_db)):
    """Список всех сезонов, в которых есть хотя бы один назначенный слот.
    По убыванию. Публичный."""
    rows = (
        db.query(SeasonBestAthlete.season)
        .distinct()
        .order_by(SeasonBestAthlete.season.desc())
        .all()
    )
    return [
        {"season": s, "season_label": format_season_label(s)}
        for (s,) in rows
    ]


# ── Защищённые роуты (manager/admin) ─────────────────────────────────────────

@router.get("/suggest")
def suggest_for_slot(
    slot:   str = Query(...),
    season: Optional[int] = Query(None),
    db:     Session = Depends(get_db),
    _:      User = Depends(require_manager),
):
    """Топ-3 кандидата для слота в указанном сезоне (или текущем)."""
    if season is None:
        season = get_current_season()
    return {
        "slot":         slot,
        "season":       season,
        "season_label": format_season_label(season),
        "candidates":   _top_candidates(db, slot, season, limit=3),
    }


@router.post("")
def assign_slot(
    body: AssignBody,
    db:   Session = Depends(get_db),
    _:    User = Depends(require_manager),
):
    """Назначить спортсмена в слот. Если слот уже занят — 409 с информацией
    о текущем занявшем (фронт показывает модалку подтверждения)."""
    season = body.season if body.season is not None else get_current_season()
    if body.slot not in ALL_SLOTS:
        raise HTTPException(400, f"Неизвестный слот: {body.slot}")

    candidate = _validate_athlete_for_slot(db, body.athlete_id, body.slot)

    existing = (
        db.query(SeasonBestAthlete)
        .filter(
            SeasonBestAthlete.slot == body.slot,
            SeasonBestAthlete.season == season,
        )
        .first()
    )
    if existing:
        cur_a = existing.athlete
        raise HTTPException(
            status_code=409,
            detail={
                "error": "slot_occupied",
                "current": {
                    "athlete_id":   existing.athlete_id,
                    "athlete_name": cur_a.full_name if cur_a else "",
                    "slot":         existing.slot,
                    "season":       existing.season,
                    "season_label": format_season_label(existing.season),
                },
                "candidate": {
                    "athlete_id":   candidate.id,
                    "athlete_name": candidate.full_name,
                },
            },
        )

    entry = SeasonBestAthlete(
        athlete_id=candidate.id,
        slot=body.slot,
        season=season,
    )
    db.add(entry)
    _grant_legendary(db, candidate.id, body.slot, season)
    try:
        db.commit()
    except IntegrityError:
        # Race: параллельный assign успел вставить запись. Сообщаем как 409.
        db.rollback()
        raise HTTPException(409, "Слот занят параллельно. Обновите страницу.")
    db.refresh(entry)
    return _entry_out(entry)


@router.post("/replace")
def replace_slot(
    body: AssignBody,
    db:   Session = Depends(get_db),
    _:    User = Depends(require_manager),
):
    """Принудительная замена (после подтверждения модалки).
    Снимает старого, назначает нового. Ачивка перевыдаётся."""
    season = body.season if body.season is not None else get_current_season()
    if body.slot not in ALL_SLOTS:
        raise HTTPException(400, f"Неизвестный слот: {body.slot}")

    candidate = _validate_athlete_for_slot(db, body.athlete_id, body.slot)

    existing = (
        db.query(SeasonBestAthlete)
        .filter(
            SeasonBestAthlete.slot == body.slot,
            SeasonBestAthlete.season == season,
        )
        .first()
    )
    if existing:
        # Если это тот же спортсмен — ничего не делаем.
        if existing.athlete_id == candidate.id:
            return _entry_out(existing)
        # Снимаем ачивку старому, удаляем фото и запись.
        _revoke_legendary(db, existing.athlete_id, body.slot, season)
        _remove_photo_file(existing.photo_url)
        db.delete(existing)
        db.flush()

    entry = SeasonBestAthlete(
        athlete_id=candidate.id,
        slot=body.slot,
        season=season,
    )
    db.add(entry)
    _grant_legendary(db, candidate.id, body.slot, season)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Конфликт при замене. Обновите страницу.")
    db.refresh(entry)
    return _entry_out(entry)


@router.delete("/{entry_id}", status_code=204)
def delete_slot(
    entry_id: int,
    db:       Session = Depends(get_db),
    _:        User = Depends(require_manager),
):
    """Снять спортсмена со слота без назначения нового."""
    entry = db.query(SeasonBestAthlete).filter(SeasonBestAthlete.id == entry_id).first()
    if not entry:
        raise HTTPException(404, "Запись не найдена")
    _revoke_legendary(db, entry.athlete_id, entry.slot, entry.season)
    _remove_photo_file(entry.photo_url)
    db.delete(entry)
    db.commit()


# ── Фото слота (manager/admin) ───────────────────────────────────────────────

@router.post("/{entry_id}/photo")
def upload_slot_photo(
    entry_id: int,
    file:     UploadFile = File(...),
    db:       Session = Depends(get_db),
    _:        User = Depends(require_manager),
):
    """Загрузить/заменить фото слота. Старый файл удаляется."""
    entry = db.query(SeasonBestAthlete).filter(SeasonBestAthlete.id == entry_id).first()
    if not entry:
        raise HTTPException(404, "Запись не найдена")

    # Удаляем старое фото
    _remove_photo_file(entry.photo_url)

    ext = os.path.splitext(file.filename)[1].lower() or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    entry.photo_url = f"/static/season-best/{filename}"
    if not entry.photo_position:
        entry.photo_position = "0px 0px / 100%"
    db.commit()
    db.refresh(entry)
    return _entry_out(entry)


@router.patch("/{entry_id}/position")
def update_slot_position(
    entry_id: int,
    body:     PositionBody,
    db:       Session = Depends(get_db),
    _:        User = Depends(require_manager),
):
    """Сохранить кадрирование фото слота (формат "Xpx Ypx / zoom%")."""
    entry = db.query(SeasonBestAthlete).filter(SeasonBestAthlete.id == entry_id).first()
    if not entry:
        raise HTTPException(404, "Запись не найдена")
    entry.photo_position = body.photo_position
    db.commit()
    db.refresh(entry)
    return _entry_out(entry)
