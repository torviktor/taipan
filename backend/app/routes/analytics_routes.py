# backend/app/routes/analytics.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Athlete
from app.models.analytics_model import AnalyticsRequest, AnalyticsReport

router = APIRouter(prefix="/analytics", tags=["analytics"])


# ─── Права ────────────────────────────────────────────────────────────────────

def require_manager(u: User = Depends(get_current_user)) -> User:
    if u.role not in ("manager", "admin"):
        raise HTTPException(403, "Недостаточно прав")
    return u


# ─── Схемы ────────────────────────────────────────────────────────────────────

class RequestCreate(BaseModel):
    athlete_id: int
    comment:    Optional[str] = None


class RequestStatusUpdate(BaseModel):
    status: str  # new / in_progress / done


class ReportCreate(BaseModel):
    athlete_id: int
    title:      str
    content:    str
    status:     str = "in_progress"  # in_progress / ready


class ReportUpdate(BaseModel):
    title:   Optional[str] = None
    content: Optional[str] = None
    status:  Optional[str] = None


# ─── Сериализация ─────────────────────────────────────────────────────────────

def _req_out(r: AnalyticsRequest) -> dict:
    return {
        "id":           r.id,
        "athlete_id":   r.athlete_id,
        "athlete_name": r.athlete.full_name if r.athlete else None,
        "parent_name":  r.creator.full_name if r.creator else None,
        "comment":      r.comment,
        "status":       r.status,
        "created_at":   str(r.created_at),
    }


def _rep_out(r: AnalyticsReport) -> dict:
    return {
        "id":           r.id,
        "athlete_id":   r.athlete_id,
        "athlete_name": r.athlete.full_name if r.athlete else None,
        "title":        r.title,
        "content":      r.content,
        "status":       r.status,
        "created_at":   str(r.created_at),
        "updated_at":   str(r.updated_at) if r.updated_at else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# ЗАЯВКИ
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/requests/", status_code=201)
def create_request(
    data: RequestCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Подать заявку на аналитику (parent / athlete)."""
    # Проверяем что спортсмен принадлежит этому пользователю
    athlete = db.query(Athlete).filter(Athlete.id == data.athlete_id).first()
    if not athlete:
        raise HTTPException(404, "Спортсмен не найден")
    if user.role not in ("manager", "admin"):
        if athlete.user_id != user.id:
            raise HTTPException(403, "Нет доступа к этому спортсмену")

    # Блокируем повторную заявку если есть активная
    existing = db.query(AnalyticsRequest).filter(
        AnalyticsRequest.athlete_id == data.athlete_id,
        AnalyticsRequest.status.in_(["new", "in_progress"]),
    ).first()
    if existing:
        raise HTTPException(400, "По этому спортсмену уже есть активная заявка")

    req = AnalyticsRequest(
        athlete_id=data.athlete_id,
        created_by=user.id,
        comment=data.comment,
        status="new",
    )
    db.add(req); db.commit(); db.refresh(req)
    return _req_out(req)


@router.get("/requests/my/")
def my_requests(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Мои заявки (parent / athlete) — по всем своим спортсменам."""
    my_athlete_ids = [
        a.id for a in db.query(Athlete).filter(Athlete.user_id == user.id).all()
    ]
    reqs = db.query(AnalyticsRequest).filter(
        AnalyticsRequest.athlete_id.in_(my_athlete_ids)
    ).order_by(AnalyticsRequest.created_at.desc()).all()
    return [_req_out(r) for r in reqs]


@router.get("/requests/")
def all_requests(
    status: Optional[str] = None,
    db:     Session = Depends(get_db),
    _:      User    = Depends(require_manager),
):
    """Все заявки (manager / admin)."""
    q = db.query(AnalyticsRequest).order_by(AnalyticsRequest.created_at.desc())
    if status:
        q = q.filter(AnalyticsRequest.status == status)
    return [_req_out(r) for r in q.all()]


@router.patch("/requests/{req_id}/status")
def update_request_status(
    req_id: int,
    data:   RequestStatusUpdate,
    db:     Session = Depends(get_db),
    _:      User    = Depends(require_manager),
):
    """Сменить статус заявки (manager / admin)."""
    req = db.query(AnalyticsRequest).filter(AnalyticsRequest.id == req_id).first()
    if not req:
        raise HTTPException(404, "Заявка не найдена")
    if data.status not in ("new", "in_progress", "done"):
        raise HTTPException(400, "Недопустимый статус")
    req.status = data.status
    db.commit(); db.refresh(req)
    return _req_out(req)


# ─────────────────────────────────────────────────────────────────────────────
# АНАЛИТИКИ
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/reports/", status_code=201)
def create_report(
    data: ReportCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_manager),
):
    """Создать аналитику по спортсмену (manager / admin)."""
    athlete = db.query(Athlete).filter(Athlete.id == data.athlete_id).first()
    if not athlete:
        raise HTTPException(404, "Спортсмен не найден")
    if data.status not in ("in_progress", "ready"):
        raise HTTPException(400, "Недопустимый статус")

    rep = AnalyticsReport(
        athlete_id=data.athlete_id,
        created_by=user.id,
        title=data.title,
        content=data.content,
        status=data.status,
    )
    db.add(rep); db.commit(); db.refresh(rep)
    return _rep_out(rep)


@router.get("/reports/my/")
def my_reports(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    """Мои аналитики (parent / athlete)."""
    my_athlete_ids = [
        a.id for a in db.query(Athlete).filter(Athlete.user_id == user.id).all()
    ]
    reps = db.query(AnalyticsReport).filter(
        AnalyticsReport.athlete_id.in_(my_athlete_ids)
    ).order_by(AnalyticsReport.created_at.desc()).all()
    return [_rep_out(r) for r in reps]


@router.get("/reports/")
def all_reports(
    db: Session = Depends(get_db),
    _:  User    = Depends(require_manager),
):
    """Все аналитики (manager / admin)."""
    reps = db.query(AnalyticsReport).order_by(AnalyticsReport.created_at.desc()).all()
    return [_rep_out(r) for r in reps]


@router.patch("/reports/{rep_id}/")
def update_report(
    rep_id: int,
    data:   ReportUpdate,
    db:     Session = Depends(get_db),
    _:      User    = Depends(require_manager),
):
    """Обновить аналитику (manager / admin)."""
    rep = db.query(AnalyticsReport).filter(AnalyticsReport.id == rep_id).first()
    if not rep:
        raise HTTPException(404, "Аналитика не найдена")
    if data.title   is not None: rep.title   = data.title
    if data.content is not None: rep.content = data.content
    if data.status  is not None:
        if data.status not in ("in_progress", "ready"):
            raise HTTPException(400, "Недопустимый статус")
        rep.status = data.status
    db.commit(); db.refresh(rep)
    return _rep_out(rep)


@router.delete("/reports/{rep_id}/", status_code=204)
def delete_report(
    rep_id: int,
    db:     Session = Depends(get_db),
    _:      User    = Depends(require_manager),
):
    """Удалить аналитику (manager / admin)."""
    rep = db.query(AnalyticsReport).filter(AnalyticsReport.id == rep_id).first()
    if not rep:
        raise HTTPException(404, "Аналитика не найдена")
    db.delete(rep); db.commit()
