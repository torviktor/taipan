# backend/app/routes/competitions.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional
from datetime import date

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Athlete
from app.models.competition import (
    Competition, CompetitionResult,
    SIGNIFICANCE_TABLE, get_significance, calc_result_rating
)
from pydantic import BaseModel, Field

router = APIRouter(prefix="/competitions", tags=["competitions"])


# ── Схемы ─────────────────────────────────────────────────────────────────────

class CompetitionCreate(BaseModel):
    name:      str
    date:      date
    location:  Optional[str] = None
    level:     str
    comp_type: str
    notes:     Optional[str] = None
    season:    Optional[int] = None


class CompetitionUpdate(BaseModel):
    name:      Optional[str]  = None
    date:      Optional[date] = None
    location:  Optional[str]  = None
    level:     Optional[str]  = None
    comp_type: Optional[str]  = None
    notes:     Optional[str]  = None


class ResultUpsert(BaseModel):
    athlete_id:      int
    sparring_place:  Optional[int] = Field(None, ge=1, le=3)
    sparring_fights: int = Field(0, ge=0)
    stopball_place:  Optional[int] = Field(None, ge=1, le=3)
    stopball_fights: int = Field(0, ge=0)
    tegtim_place:    Optional[int] = Field(None, ge=1, le=3)
    tegtim_fights:   int = Field(0, ge=0)
    tuli_place:      Optional[int] = Field(None, ge=1, le=3)
    tuli_perfs:      int = Field(0, ge=0)


class BulkResults(BaseModel):
    results: list[ResultUpsert]


# ── Права ─────────────────────────────────────────────────────────────────────

def require_manager(u: User = Depends(get_current_user)) -> User:
    if u.role not in ("manager", "admin"):
        raise HTTPException(403, "Недостаточно прав")
    return u


# ── CRUD соревнований ─────────────────────────────────────────────────────────

@router.post("", status_code=201)
def create_competition(data: CompetitionCreate, db: Session = Depends(get_db), user: User = Depends(require_manager)):
    if data.level not in SIGNIFICANCE_TABLE:
        raise HTTPException(400, f"Неизвестный уровень: {data.level}")
    if data.comp_type not in SIGNIFICANCE_TABLE.get(data.level, {}):
        raise HTTPException(400, f"Тип «{data.comp_type}» недоступен для «{data.level}»")
    comp = Competition(
        name=data.name, date=data.date, location=data.location,
        level=data.level, comp_type=data.comp_type,
        significance=get_significance(data.level, data.comp_type),
        notes=data.notes, season=data.season or data.date.year,
        created_by=user.id,
    )
    db.add(comp); db.commit(); db.refresh(comp)
    return _comp_out(comp)


@router.get("")
def list_competitions(season: Optional[int] = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    q = db.query(Competition).order_by(Competition.date.desc())
    if season:
        q = q.filter(Competition.season == season)
    return [_comp_out(c) for c in q.all()]


@router.get("/significance-table")
def sig_table():
    return SIGNIFICANCE_TABLE


@router.get("/seasons")
def get_seasons(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(Competition.season).distinct().order_by(Competition.season.desc()).all()
    return [r[0] for r in rows]


@router.get("/rating/overall")
def overall_rating(
    season: Optional[int] = None,
    group:  Optional[str] = None,
    gender: Optional[str] = None,
    age_category: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = (
        db.query(Athlete, func.sum(CompetitionResult.rating).label("total"),
                 func.count(CompetitionResult.id).label("cnt"))
        .join(CompetitionResult, CompetitionResult.athlete_id == Athlete.id)
        .join(Competition, Competition.id == CompetitionResult.competition_id)
    )
    if season:       q = q.filter(Competition.season == season)
    if group:        q = q.filter(Athlete.group == group)
    if gender:       q = q.filter(Athlete.gender == gender)

    rows = q.group_by(Athlete.id).order_by(func.sum(CompetitionResult.rating).desc()).all()

    result = []
    for i, (a, total, cnt) in enumerate(rows):
        age = _calc_age(a.birth_date)
        cat = _age_category(age)
        if age_category and cat != age_category:
            continue
        result.append({
            "place":             i + 1,
            "athlete_id":        a.id,
            "full_name":         a.full_name,
            "birth_date":        str(a.birth_date) if a.birth_date else None,
            "age":               age,
            "age_category":      cat,
            "gender":            a.gender,
            "gup":               a.gup,
            "weight":            float(a.weight) if a.weight else None,
            "group":             a.group,
            "total_rating":      round(total or 0, 2),
            "tournaments_count": cnt,
        })
    # Перенумеруем место после фильтра по возрасту
    for i, r in enumerate(result):
        r["place"] = i + 1
    return result


@router.get("/rating/athlete/{athlete_id}")
def athlete_rating(athlete_id: int, season: Optional[int] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    athlete = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not athlete:
        raise HTTPException(404, "Спортсмен не найден")

    role = current_user.role
    if role not in ("manager", "admin"):
        if role == "athlete":
            if athlete.user_id != current_user.id:
                raise HTTPException(403, "Нет доступа")
        elif role == "parent":
            ids = [a.id for a in db.query(Athlete).filter(Athlete.user_id == current_user.id).all()]
            if athlete_id not in ids:
                raise HTTPException(403, "Нет доступа")
        else:
            raise HTTPException(403, "Нет доступа")

    q = db.query(CompetitionResult).options(joinedload(CompetitionResult.competition)).filter(CompetitionResult.athlete_id == athlete_id)
    if season:
        q = q.join(Competition).filter(Competition.season == season)
    results = q.order_by(CompetitionResult.competition_id.desc()).all()

    return {
        "athlete_id":   athlete_id,
        "full_name":    athlete.full_name,
        "total_rating": round(sum(r.rating for r in results), 2),
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
                "tegtim_place":     r.tegtim_place,
                "tegtim_fights":    r.tegtim_fights,
                "tuli_place":       r.tuli_place,
                "tuli_perfs":       r.tuli_perfs,
                "rating":           r.rating,
            }
            for r in results
        ]
    }


@router.get("/{comp_id}")
def get_competition(comp_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    comp = _get_or_404(comp_id, db)
    results = db.query(CompetitionResult).options(joinedload(CompetitionResult.athlete)).filter(CompetitionResult.competition_id == comp_id).all()
    return {**_comp_out(comp), "results": [_result_out(r) for r in results]}


@router.patch("/{comp_id}")
def update_competition(comp_id: int, data: CompetitionUpdate, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    comp = _get_or_404(comp_id, db)
    upd = data.dict(exclude_none=True)
    new_level = upd.get("level", comp.level)
    new_type  = upd.get("comp_type", comp.comp_type)
    if "level" in upd or "comp_type" in upd:
        upd["significance"] = get_significance(new_level, new_type)
    for k, v in upd.items():
        setattr(comp, k, v)
    if "significance" in upd:
        for r in db.query(CompetitionResult).filter(CompetitionResult.competition_id == comp.id).all():
            r.rating = calc_result_rating(r, comp.significance)
    db.commit(); db.refresh(comp)
    return _comp_out(comp)


@router.delete("/{comp_id}", status_code=204)
def delete_competition(comp_id: int, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    comp = _get_or_404(comp_id, db)
    db.delete(comp); db.commit()


# ── Результаты ────────────────────────────────────────────────────────────────

@router.put("/{comp_id}/results")
def bulk_upsert_results(comp_id: int, data: BulkResults, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    comp = _get_or_404(comp_id, db)
    existing = {r.athlete_id: r for r in db.query(CompetitionResult).filter(CompetitionResult.competition_id == comp_id).all()}
    ids = [r.athlete_id for r in data.results]
    athletes = {a.id for a in db.query(Athlete).filter(Athlete.id.in_(ids)).all()}
    missing = set(ids) - athletes
    if missing:
        raise HTTPException(400, f"Спортсмены не найдены: {missing}")

    saved = []
    for item in data.results:
        r = existing.get(item.athlete_id) or CompetitionResult(competition_id=comp_id, athlete_id=item.athlete_id)
        if item.athlete_id not in existing:
            db.add(r)
        r.sparring_place  = item.sparring_place
        r.sparring_fights = item.sparring_fights
        r.stopball_place  = item.stopball_place
        r.stopball_fights = item.stopball_fights
        r.tegtim_place    = item.tegtim_place
        r.tegtim_fights   = item.tegtim_fights
        r.tuli_place      = item.tuli_place
        r.tuli_perfs      = item.tuli_perfs
        r.rating          = calc_result_rating(r, comp.significance)
        saved.append(r)

    db.commit()
    for r in saved:
        db.refresh(r)
    return [_result_out(r) for r in saved]


@router.delete("/{comp_id}/results/{athlete_id}", status_code=204)
def delete_result(comp_id: int, athlete_id: int, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    r = db.query(CompetitionResult).filter(
        CompetitionResult.competition_id == comp_id,
        CompetitionResult.athlete_id == athlete_id
    ).first()
    if not r:
        raise HTTPException(404, "Результат не найден")
    db.delete(r); db.commit()


# ── Хелперы ───────────────────────────────────────────────────────────────────

def _get_or_404(comp_id, db):
    c = db.query(Competition).filter(Competition.id == comp_id).first()
    if not c:
        raise HTTPException(404, "Соревнование не найдено")
    return c


def _calc_age(birth_date):
    if not birth_date:
        return None
    from datetime import date
    today = date.today()
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))


def _age_category(age):
    if age is None:     return "Не указан"
    if age <= 7:        return "6-7"
    if age <= 9:        return "8-9"
    if age <= 11:       return "10-11"
    if age <= 14:       return "12-14"
    if age <= 17:       return "15-17"
    return "18+"


def _comp_out(c):
    return {
        "id": c.id, "name": c.name, "date": str(c.date),
        "location": c.location, "level": c.level, "comp_type": c.comp_type,
        "significance": c.significance, "notes": c.notes,
        "season": c.season, "created_by": c.created_by,
    }


def _result_out(r):
    return {
        "id": r.id, "competition_id": r.competition_id, "athlete_id": r.athlete_id,
        "full_name":       r.athlete.full_name if r.athlete else None,
        "sparring_place":  r.sparring_place,  "sparring_fights": r.sparring_fights,
        "stopball_place":  r.stopball_place,  "stopball_fights": r.stopball_fights,
        "tegtim_place":    r.tegtim_place,    "tegtim_fights":   r.tegtim_fights,
        "tuli_place":      r.tuli_place,      "tuli_perfs":      r.tuli_perfs,
        "rating":          r.rating,
    }
