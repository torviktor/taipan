# backend/app/routes/competitions.py

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional
from datetime import date
import math

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Athlete
from app.models.competition import (
    Competition, CompetitionResult,
    SIGNIFICANCE_TABLE, get_significance, calc_result_rating
)
from pydantic import BaseModel, Field

router = APIRouter(prefix="/competitions", tags=["competitions"])


# ─── Pydantic схемы ──────────────────────────────────────────────────────────

class CompetitionCreate(BaseModel):
    name:       str   = Field(..., min_length=2, max_length=255)
    date:       date
    location:   Optional[str] = None
    level:      str   # CompetitionLevel value
    comp_type:  str   # CompetitionType value
    notes:      Optional[str] = None
    season:     Optional[int] = None  # если не передан — берём год из date


class CompetitionUpdate(BaseModel):
    name:      Optional[str]  = None
    date:      Optional[date] = None
    location:  Optional[str]  = None
    level:     Optional[str]  = None
    comp_type: Optional[str]  = None
    notes:     Optional[str]  = None


class ResultUpsert(BaseModel):
    """Результат одного спортсмена — создаём или обновляем."""
    athlete_id:      int

    sparring_place:  Optional[int] = Field(None, ge=1, le=3)
    sparring_fights: int           = Field(0, ge=0)

    stopball_place:  Optional[int] = Field(None, ge=1, le=3)
    stopball_fights: int           = Field(0, ge=0)

    tuli_place:      Optional[int] = Field(None, ge=1, le=3)
    tuli_perfs:      int           = Field(0, ge=0)


class BulkResultsUpsert(BaseModel):
    results: list[ResultUpsert]


# ─── Вспомогательная функция: проверка роли ──────────────────────────────────

def require_manager(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    return current_user


# ─── CRUD соревнований ───────────────────────────────────────────────────────

@router.post("", status_code=201)
def create_competition(
    data: CompetitionCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_manager),
):
    """Создать новое соревнование."""
    level     = data.level
    comp_type = data.comp_type

    # Проверяем, что уровень и тип валидны
    if level not in SIGNIFICANCE_TABLE:
        raise HTTPException(400, detail=f"Неизвестный уровень: {level}")
    if comp_type not in SIGNIFICANCE_TABLE.get(level, {}):
        raise HTTPException(400, detail=f"Тип «{comp_type}» недоступен для уровня «{level}»")

    sig    = get_significance(level, comp_type)
    season = data.season or data.date.year

    comp = Competition(
        name         = data.name,
        date         = data.date,
        location     = data.location,
        level        = level,
        comp_type    = comp_type,
        significance = sig,
        notes        = data.notes,
        season       = season,
        created_by   = user.id,
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)
    return _comp_schema(comp)


@router.get("")
def list_competitions(
    season:  Optional[int] = None,
    db:      Session       = Depends(get_db),
    _user:   User          = Depends(get_current_user),
):
    """Список всех соревнований (опц. фильтр по сезону)."""
    q = db.query(Competition).order_by(Competition.date.desc())
    if season:
        q = q.filter(Competition.season == season)
    comps = q.all()
    return [_comp_schema(c) for c in comps]


@router.get("/significance-table")
def significance_table():
    """Таблица значимостей — для фронта при создании соревнования."""
    return SIGNIFICANCE_TABLE


@router.get("/seasons")
def get_seasons(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Список доступных сезонов."""
    rows = db.query(Competition.season).distinct().order_by(Competition.season.desc()).all()
    return [r[0] for r in rows]


@router.get("/{comp_id}")
def get_competition(
    comp_id: int,
    db:      Session = Depends(get_db),
    _user:   User    = Depends(get_current_user),
):
    comp = _get_comp_or_404(comp_id, db)
    results = (
        db.query(CompetitionResult)
        .options(joinedload(CompetitionResult.athlete))
        .filter(CompetitionResult.competition_id == comp_id)
        .all()
    )
    return {**_comp_schema(comp), "results": [_result_schema(r) for r in results]}


@router.patch("/{comp_id}")
def update_competition(
    comp_id: int,
    data:    CompetitionUpdate,
    db:      Session = Depends(get_db),
    _user:   User    = Depends(require_manager),
):
    comp = _get_comp_or_404(comp_id, db)
    updated = data.dict(exclude_none=True)

    # Если меняется уровень или тип — пересчитываем значимость
    new_level     = updated.get("level",     comp.level)
    new_comp_type = updated.get("comp_type", comp.comp_type)
    if "level" in updated or "comp_type" in updated:
        updated["significance"] = get_significance(new_level, new_comp_type)

    for k, v in updated.items():
        setattr(comp, k, v)

    # Если значимость изменилась — пересчитать рейтинги всех результатов
    if "significance" in updated:
        _recalc_all_results(comp, db)

    db.commit()
    db.refresh(comp)
    return _comp_schema(comp)


@router.delete("/{comp_id}", status_code=204)
def delete_competition(
    comp_id: int,
    db:      Session = Depends(get_db),
    _user:   User    = Depends(require_manager),
):
    comp = _get_comp_or_404(comp_id, db)
    db.delete(comp)
    db.commit()


# ─── Результаты ──────────────────────────────────────────────────────────────

@router.put("/{comp_id}/results")
def bulk_upsert_results(
    comp_id: int,
    data:    BulkResultsUpsert,
    db:      Session = Depends(get_db),
    _user:   User    = Depends(require_manager),
):
    """
    Массовое добавление / обновление результатов турнира.
    Если результат для спортсмена уже есть — обновляем, иначе создаём.
    """
    comp = _get_comp_or_404(comp_id, db)

    # Загружаем существующие результаты в словарь {athlete_id: result}
    existing = {
        r.athlete_id: r
        for r in db.query(CompetitionResult)
        .filter(CompetitionResult.competition_id == comp_id)
        .all()
    }

    # Проверяем, что все athlete_id существуют
    athlete_ids = [r.athlete_id for r in data.results]
    athletes = {a.id: a for a in db.query(Athlete).filter(Athlete.id.in_(athlete_ids)).all()}
    missing = set(athlete_ids) - set(athletes.keys())
    if missing:
        raise HTTPException(400, detail=f"Спортсмены не найдены: {missing}")

    saved = []
    for item in data.results:
        if item.athlete_id in existing:
            r = existing[item.athlete_id]
        else:
            r = CompetitionResult(competition_id=comp_id, athlete_id=item.athlete_id)
            db.add(r)

        r.sparring_place  = item.sparring_place
        r.sparring_fights = item.sparring_fights
        r.stopball_place  = item.stopball_place
        r.stopball_fights = item.stopball_fights
        r.tuli_place      = item.tuli_place
        r.tuli_perfs      = item.tuli_perfs
        r.rating          = calc_result_rating(r, comp.significance)
        saved.append(r)

    db.commit()
    for r in saved:
        db.refresh(r)
    return [_result_schema(r) for r in saved]


@router.delete("/{comp_id}/results/{athlete_id}", status_code=204)
def delete_result(
    comp_id:    int,
    athlete_id: int,
    db:         Session = Depends(get_db),
    _user:      User    = Depends(require_manager),
):
    r = (
        db.query(CompetitionResult)
        .filter(
            CompetitionResult.competition_id == comp_id,
            CompetitionResult.athlete_id     == athlete_id
        )
        .first()
    )
    if not r:
        raise HTTPException(404, detail="Результат не найден")
    db.delete(r)
    db.commit()


# ─── Рейтинг ─────────────────────────────────────────────────────────────────

@router.get("/rating/overall")
def overall_rating(
    season:   Optional[int] = None,
    group:    Optional[str] = None,
    gender:   Optional[str] = None,
    db:       Session       = Depends(get_db),
    _user:    User          = Depends(get_current_user),
):
    """
    Сводный рейтинг спортсменов за сезон (или за всё время).
    Фильтры: season, group, gender.
    """
    q = (
        db.query(
            Athlete.id,
            Athlete.full_name,
            Athlete.birth_date,
            Athlete.gender,
            Athlete.gup,
            Athlete.group,
            func.sum(CompetitionResult.rating).label("total_rating"),
            func.count(CompetitionResult.id).label("tournaments_count"),
            func.sum(
                (CompetitionResult.sparring_place == 1).cast(db.bind.dialect.INTEGER if hasattr(db.bind, 'dialect') else 'Integer') +
                (CompetitionResult.stopball_place == 1).cast('Integer') +
                (CompetitionResult.tuli_place     == 1).cast('Integer')
            ).label("gold"),
            func.sum(
                (CompetitionResult.sparring_place == 2).cast('Integer') +
                (CompetitionResult.stopball_place == 2).cast('Integer') +
                (CompetitionResult.tuli_place     == 2).cast('Integer')
            ).label("silver"),
            func.sum(
                (CompetitionResult.sparring_place == 3).cast('Integer') +
                (CompetitionResult.stopball_place == 3).cast('Integer') +
                (CompetitionResult.tuli_place     == 3).cast('Integer')
            ).label("bronze"),
        )
        .join(CompetitionResult, CompetitionResult.athlete_id == Athlete.id)
        .join(Competition, Competition.id == CompetitionResult.competition_id)
    )

    if season:
        q = q.filter(Competition.season == season)
    if group:
        q = q.filter(Athlete.group == group)
    if gender:
        q = q.filter(Athlete.gender == gender)

    rows = (
        q.group_by(Athlete.id, Athlete.full_name, Athlete.birth_date,
                   Athlete.gender, Athlete.gup, Athlete.group)
        .order_by(func.sum(CompetitionResult.rating).desc())
        .all()
    )

    return [
        {
            "place":             i + 1,
            "athlete_id":        r.id,
            "full_name":         r.full_name,
            "birth_date":        str(r.birth_date) if r.birth_date else None,
            "gender":            r.gender,
            "gup":               r.gup,
            "group":             r.group,
            "total_rating":      round(r.total_rating or 0, 2),
            "tournaments_count": r.tournaments_count,
            "gold":              int(r.gold   or 0),
            "silver":            int(r.silver or 0),
            "bronze":            int(r.bronze or 0),
        }
        for i, r in enumerate(rows)
    ]


@router.get("/rating/athlete/{athlete_id}")
def athlete_rating(
    athlete_id: int,
    season:     Optional[int] = None,
    db:         Session       = Depends(get_db),
    current_user: User        = Depends(get_current_user),
):
    """
    Детальная история соревнований одного спортсмена.
    Доступно: manager/admin — любой; athlete — свой; parent — дети.
    """
    athlete = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not athlete:
        raise HTTPException(404, detail="Спортсмен не найден")

    # Проверка прав доступа
    role = current_user.role
    if role not in ("manager", "admin"):
        if role == "athlete":
            if athlete.user_id != current_user.id:
                raise HTTPException(403, detail="Нет доступа")
        elif role == "parent":
            children_ids = [a.id for a in db.query(Athlete).filter(Athlete.user_id == current_user.id).all()]
            if athlete_id not in children_ids:
                raise HTTPException(403, detail="Нет доступа")
        else:
            raise HTTPException(403, detail="Нет доступа")

    q = (
        db.query(CompetitionResult)
        .options(joinedload(CompetitionResult.competition))
        .filter(CompetitionResult.athlete_id == athlete_id)
    )
    if season:
        q = q.join(Competition).filter(Competition.season == season)

    results = q.order_by(CompetitionResult.competition_id.desc()).all()

    total = round(sum(r.rating for r in results), 2)

    return {
        "athlete_id":  athlete_id,
        "full_name":   athlete.full_name,
        "total_rating": total,
        "results": [
            {
                "competition_id":   r.competition_id,
                "competition_name": r.competition.name,
                "competition_date": str(r.competition.date),
                "level":            r.competition.level,
                "comp_type":        r.competition.comp_type,
                "significance":     r.competition.significance,
                "sparring_place":   r.sparring_place,
                "sparring_fights":  r.sparring_fights,
                "stopball_place":   r.stopball_place,
                "stopball_fights":  r.stopball_fights,
                "tuli_place":       r.tuli_place,
                "tuli_perfs":       r.tuli_perfs,
                "rating":           r.rating,
            }
            for r in results
        ]
    }


# ─── Хелперы ─────────────────────────────────────────────────────────────────

def _get_comp_or_404(comp_id: int, db: Session) -> Competition:
    comp = db.query(Competition).filter(Competition.id == comp_id).first()
    if not comp:
        raise HTTPException(404, detail="Соревнование не найдено")
    return comp


def _recalc_all_results(comp: Competition, db: Session):
    """Пересчитать рейтинги всех участников после смены значимости."""
    results = db.query(CompetitionResult).filter(CompetitionResult.competition_id == comp.id).all()
    for r in results:
        r.rating = calc_result_rating(r, comp.significance)


def _comp_schema(c: Competition) -> dict:
    return {
        "id":           c.id,
        "name":         c.name,
        "date":         str(c.date),
        "location":     c.location,
        "level":        c.level,
        "comp_type":    c.comp_type,
        "significance": c.significance,
        "notes":        c.notes,
        "season":       c.season,
        "created_by":   c.created_by,
        "created_at":   str(c.created_at) if c.created_at else None,
    }


def _result_schema(r: CompetitionResult) -> dict:
    return {
        "id":             r.id,
        "competition_id": r.competition_id,
        "athlete_id":     r.athlete_id,
        "full_name":      r.athlete.full_name if r.athlete else None,
        "sparring_place":  r.sparring_place,
        "sparring_fights": r.sparring_fights,
        "stopball_place":  r.stopball_place,
        "stopball_fights": r.stopball_fights,
        "tuli_place":      r.tuli_place,
        "tuli_perfs":      r.tuli_perfs,
        "rating":          r.rating,
    }
