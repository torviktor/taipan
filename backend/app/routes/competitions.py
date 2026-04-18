# backend/app/routes/competitions.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional
from datetime import date, datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Athlete
from app.models.competition import (
    Competition, CompetitionResult,
    SIGNIFICANCE_TABLE, get_significance, calc_result_rating
)
from app.models.certification import Notification, NotificationType
from pydantic import BaseModel, Field

router = APIRouter(prefix="/competitions", tags=["competitions"])


# ── Схемы ─────────────────────────────────────────────────────────────────────

class CompetitionCreate(BaseModel):
    name:            str
    date:            date
    time:            Optional[str] = "09:00"  # HH:MM
    location:        Optional[str] = None
    level:           str
    comp_type:       str
    notes:           Optional[str] = None
    season:          Optional[int] = None
    add_to_calendar: bool = False


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
    status:          Optional[str] = "pending"


class BulkResults(BaseModel):
    results: list[ResultUpsert]


# ── Права ─────────────────────────────────────────────────────────────────────

def require_manager(u: User = Depends(get_current_user)) -> User:
    if u.role not in ("manager", "admin"):
        raise HTTPException(403, "Недостаточно прав")
    return u


# ── CRUD соревнований ─────────────────────────────────────────────────────────

@router.post("", status_code=201)
def create_competition(
    data: CompetitionCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_manager)
):
    if data.level not in SIGNIFICANCE_TABLE:
        raise HTTPException(400, f"Неизвестный уровень: {data.level}")
    if data.comp_type not in SIGNIFICANCE_TABLE.get(data.level, {}):
        raise HTTPException(400, f"Тип «{data.comp_type}» недоступен для «{data.level}»")

    comp = Competition(
        name=data.name, date=data.date, location=data.location,
        level=data.level, comp_type=data.comp_type,
        significance=get_significance(data.level, data.comp_type),
        notes=data.notes, season=data.season or _get_sport_season(data.date),
        created_by=user.id,
    )
    db.add(comp)
    db.flush()

    if data.add_to_calendar:
        _create_calendar_event(comp, user.id, db, data.time or "09:00")

    # Автоматически добавляем всех спортсменов со статусом pending (без результатов)
    athletes = db.query(Athlete).all()
    for a in athletes:
        db.add(CompetitionResult(
            competition_id=comp.id, athlete_id=a.id,
            sparring_place=None, sparring_fights=0,
            stopball_place=None, stopball_fights=0,
            tegtim_place=None, tegtim_fights=0,
            tuli_place=None, tuli_perfs=0,
            rating=0, status="pending"
        ))

    db.commit()
    db.refresh(comp)

    # Уведомляем всех при создании
    _notify_all_about_competition(comp, db)

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


def _get_sport_season(d: date) -> int:
    """Год начала спортивного сезона (сентябрь–август)."""
    return d.year if d.month >= 9 else d.year - 1


@router.get("/rating/overall")
def overall_rating(
    season:       Optional[int] = None,
    group:        Optional[str] = None,
    gender:       Optional[str] = None,
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
    if season: q = q.filter(Competition.season == season)
    if group:  q = q.filter(Athlete.group == group)
    if gender: q = q.filter(Athlete.gender == gender)

    rows = q.group_by(Athlete.id).order_by(func.sum(CompetitionResult.rating).desc()).all()

    result = []
    for i, (a, total, cnt) in enumerate(rows):
        age = _calc_age(a.birth_date)
        cat = _age_category(age)
        if cat is None:  # взрослые 18+ не участвуют в рейтинге
            continue
        if age_category and cat != age_category:
            continue
        result.append({
            "place": i + 1, "athlete_id": a.id, "full_name": a.full_name,
            "birth_date": str(a.birth_date) if a.birth_date else None,
            "age": age, "age_category": cat, "gender": a.gender,
            "gup": a.gup, "weight": float(a.weight) if a.weight else None,
            "group": a.group, "total_rating": round(total or 0, 2),
            "tournaments_count": cnt,
        })
    for i, r in enumerate(result):
        r["place"] = i + 1
    return result


@router.get("/rating/athlete/{athlete_id}")
def athlete_rating(
    athlete_id: int,
    season: Optional[int] = None,
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
                raise HTTPException(403, "Нет доступа")
        elif role == "parent":
            ids = [a.id for a in db.query(Athlete).filter(Athlete.user_id == current_user.id).all()]
            if athlete_id not in ids:
                raise HTTPException(403, "Нет доступа")
        else:
            raise HTTPException(403, "Нет доступа")

    q = db.query(CompetitionResult).options(joinedload(CompetitionResult.competition)) \
        .filter(CompetitionResult.athlete_id == athlete_id)
    if season:
        q = q.join(Competition).filter(Competition.season == season)
    results = q.order_by(CompetitionResult.competition_id.desc()).all()

    return {
        "athlete_id": athlete_id,
        "full_name":  athlete.full_name,
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
    results = db.query(CompetitionResult).options(joinedload(CompetitionResult.athlete)) \
        .filter(CompetitionResult.competition_id == comp_id).all()
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
    # Удаляем связанное событие в календаре если есть
    try:
        from app.models.event import Event
        from datetime import datetime
        event_title = f"{comp.comp_type} — {comp.name}"
        event = db.query(Event).filter(Event.title == event_title).first()
        if event:
            db.delete(event)
    except Exception:
        pass
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
        if item.status:
            r.status = item.status
        saved.append(r)

    db.commit()
    for r in saved:
        db.refresh(r)
    # Автоначисление ачивок за соревнования
    try:
        from app.routes.achievements import auto_grant
        for r in saved:
            auto_grant(r.athlete_id, db)
    except Exception as e:
        print(f"Achievement error: {e}")
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


# ── Оплата взноса ────────────────────────────────────────────────────────────

@router.patch("/{comp_id}/results/{athlete_id}/paid")
def update_result_paid(
    comp_id: int, athlete_id: int, paid: bool,
    db: Session = Depends(get_db), _: User = Depends(require_manager)
):
    r = db.query(CompetitionResult).filter(
        CompetitionResult.competition_id == comp_id,
        CompetitionResult.athlete_id == athlete_id
    ).first()
    if not r: raise HTTPException(404)
    r.paid = paid
    db.commit()
    return _result_out(r)


# ── Уведомления о соревновании ────────────────────────────────────────────────

@router.post("/{comp_id}/notify")
def notify_competition(comp_id: int, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    """
    Отправить уведомление ВСЕМ зарегистрированным пользователям клуба
    о предстоящем соревновании.
    Уведомление также уйдёт через Telegram если есть chat_id.
    """
    comp = _get_or_404(comp_id, db)

    # Все активные пользователи клуба
    users = db.query(User).filter(User.is_active == True).all()

    title = f"Соревнование — {comp.name}"
    body  = (
        f"Предстоящее соревнование: {comp.name}. "
        f"Уровень: {comp.level}, {comp.comp_type}. "
        f"Дата: {comp.date.strftime('%d.%m.%Y')}."
    )
    if comp.location:
        body += f" Место: {comp.location}."
    if comp.notes:
        body += f" {comp.notes}"

    sent = 0
    for u in users:
        notif = Notification(
            user_id=u.id,
            type=NotificationType.competition,
            title=title,
            body=body,
            link_id=comp_id,
            link_type="competition",
        )
        db.add(notif)
        sent += 1

    db.commit()

    from app.services.notifications import send_telegram_to_user
    for u in users:
        send_telegram_to_user(u.id, title, body, db)

    return {"sent": sent}


@router.post("/{comp_id}/respond")
def respond_competition(
    comp_id: int, going: bool,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Родитель/спортсмен отвечает участвует или нет."""
    athletes = db.query(Athlete).filter(Athlete.user_id == current_user.id).all()
    athlete_ids = [a.id for a in athletes]

    results = db.query(CompetitionResult).filter(
        CompetitionResult.competition_id == comp_id,
        CompetitionResult.athlete_id.in_(athlete_ids)
    ).all()

    if not results:
        # Создаём pending запись если её нет
        for aid in athlete_ids:
            db.add(CompetitionResult(
                competition_id=comp_id, athlete_id=aid,
                sparring_place=None, sparring_fights=0,
                stopball_place=None, stopball_fights=0,
                tegtim_place=None, tegtim_fights=0,
                tuli_place=None, tuli_perfs=0,
                rating=0, status="confirmed" if going else "declined"
            ))
        db.commit()
        return {"ok": True, "status": "confirmed" if going else "declined"}

    for r in results:
        r.status = "confirmed" if going else "declined"
    db.commit()
    return {"ok": True, "status": "confirmed" if going else "declined"}


# ── Хелперы ───────────────────────────────────────────────────────────────────

def _get_or_404(comp_id, db):
    c = db.query(Competition).filter(Competition.id == comp_id).first()
    if not c:
        raise HTTPException(404, "Соревнование не найдено")
    return c


def _calc_age(birth_date):
    if not birth_date:
        return None
    today = date.today()
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))


def _age_category(age):
    if age is None:  return "Не указан"
    if age <= 7:     return "6-7"
    if age <= 9:     return "8-9"
    if age <= 11:    return "10-11"
    if age <= 14:    return "12-14"
    if age <= 17:    return "15-17"
    return None  # взрослые не попадают в возрастной рейтинг


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
        "status":          getattr(r, 'status', 'pending') or 'pending',
        "paid":            getattr(r, 'paid', False),
    }


def _notify_all_about_competition(comp: Competition, db: Session):
    """Уведомить всех активных пользователей о новом соревновании."""
    try:
        from app.models.certification import Notification, NotificationType
        users = db.query(User).filter(User.is_active == True).all()
        body = (
            f"Объявлено соревнование «{comp.name}». "
            f"Уровень: {comp.level}, {comp.comp_type}. "
            f"Дата: {comp.date.strftime('%d.%m.%Y')}."
        )
        if comp.location: body += f" Место: {comp.location}."
        body += " Укажите планируете ли участвовать."
        for u in users:
            db.add(Notification(
                user_id=u.id, type=NotificationType.competition,
                title=f"Соревнование — {comp.name}",
                body=body, link_id=comp.id, link_type="competition"
            ))
        db.commit()
    except Exception as e:
        print(f"Competition notify error: {e}")


def _create_calendar_event(comp: Competition, user_id: int, db: Session, time_str: str = "09:00"):
    """Создаёт событие в календаре при создании соревнования."""
    try:
        from app.models.event import Event
        hour, minute = (int(x) for x in time_str.split(":")) if ":" in time_str else (9, 0)
        event_dt = datetime.combine(comp.date, datetime.min.time()).replace(hour=hour, minute=minute)
        event = Event(
            title=f"{comp.comp_type} — {comp.name}",
            description=(
                f"Уровень: {comp.level}\n"
                f"Тип: {comp.comp_type}\n"
                f"Коэффициент значимости: ×{comp.significance}"
                + (f"\n{comp.notes}" if comp.notes else "")
            ),
            event_date=event_dt,
            location=comp.location,
            created_by=user_id,
            notify_before_days=[1, 3],
            notify_everyone=True,
        )
        db.add(event)
    except Exception as e:
        print(f"Calendar sync error: {e}")


