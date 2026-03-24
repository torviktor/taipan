# backend/app/routes/analytics.py

import os, uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Athlete
from app.models.analytics import AnalyticsRequest, AnalyticsReport

router = APIRouter(prefix="/analytics", tags=["analytics"])

UPLOAD_DIR = "/app/static/analytics"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXT = {".pdf", ".doc", ".docx", ".xlsx", ".xls"}
MAX_SIZE    = 20 * 1024 * 1024  # 20 МБ


def require_manager(u: User = Depends(get_current_user)) -> User:
    if u.role not in ("manager", "admin"):
        raise HTTPException(403, "Недостаточно прав")
    return u


# ─── Схемы ────────────────────────────────────────────────────────────────────

class RequestCreate(BaseModel):
    athlete_id: int
    comment:    Optional[str] = None


class RequestStatusUpdate(BaseModel):
    status: Optional[str] = None   # new | in_progress | done
    paid:   Optional[bool] = None


class ReportCreate(BaseModel):
    athlete_id: int
    title:      str
    content:    Optional[str] = None
    status:     str = "in_progress"


class ReportUpdate(BaseModel):
    title:   Optional[str] = None
    content: Optional[str] = None
    status:  Optional[str] = None


# ─── Сериализация ─────────────────────────────────────────────────────────────

def _req_out(r: AnalyticsRequest) -> dict:
    a = r.athlete
    return {
        "id":           r.id,
        "athlete_id":   r.athlete_id,
        "athlete_name": a.full_name if a else None,
        "parent_name":  a.parent_name if a else None,
        "comment":      r.comment,
        "status":       r.status,
        "paid":         bool(r.paid),
        "created_at":   str(r.created_at),
    }


def _rep_out(r: AnalyticsReport) -> dict:
    a = r.athlete
    return {
        "id":           r.id,
        "athlete_id":   r.athlete_id,
        "athlete_name": a.full_name if a else None,
        "title":        r.title,
        "content":      r.content,
        "file_url":     r.file_url,
        "status":       r.status,
        "created_at":   str(r.created_at),
    }


# ─── Заявки ───────────────────────────────────────────────────────────────────

@router.post("/requests/", status_code=201)
def create_request(
    data: RequestCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    athlete = db.query(Athlete).filter(Athlete.id == data.athlete_id).first()
    if not athlete:
        raise HTTPException(404, "Спортсмен не найден")

    if user.role not in ("manager", "admin"):
        my_ids = [a.id for a in db.query(Athlete).filter(Athlete.user_id == user.id).all()]
        if data.athlete_id not in my_ids:
            raise HTTPException(403, "Нет доступа к этому спортсмену")

    existing = db.query(AnalyticsRequest).filter(
        AnalyticsRequest.athlete_id == data.athlete_id,
        AnalyticsRequest.status.in_(["new", "in_progress"])
    ).first()
    if existing:
        raise HTTPException(400, "По этому спортсмену уже есть активная заявка")

    req = AnalyticsRequest(athlete_id=data.athlete_id, comment=data.comment, status="new", paid=False)
    db.add(req); db.commit(); db.refresh(req)
    return _req_out(req)


@router.get("/requests/my/")
def my_requests(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    my_ids = [a.id for a in db.query(Athlete).filter(Athlete.user_id == user.id).all()]
    reqs = db.query(AnalyticsRequest).filter(
        AnalyticsRequest.athlete_id.in_(my_ids)
    ).order_by(AnalyticsRequest.created_at.desc()).all()
    return [_req_out(r) for r in reqs]


@router.get("/requests/")
def all_requests(
    status: Optional[str] = None,
    db:     Session = Depends(get_db),
    _:      User    = Depends(require_manager),
):
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
    req = db.query(AnalyticsRequest).filter(AnalyticsRequest.id == req_id).first()
    if not req:
        raise HTTPException(404, "Заявка не найдена")
    if data.status is not None:
        if data.status not in ("new", "in_progress", "done"):
            raise HTTPException(400, "Недопустимый статус")
        req.status = data.status
    if data.paid is not None:
        req.paid = data.paid
    db.commit(); db.refresh(req)
    return _req_out(req)


# ─── Аналитики ────────────────────────────────────────────────────────────────

@router.post("/reports/", status_code=201)
def create_report(
    data: ReportCreate,
    db:   Session = Depends(get_db),
    _:    User    = Depends(require_manager),
):
    athlete = db.query(Athlete).filter(Athlete.id == data.athlete_id).first()
    if not athlete:
        raise HTTPException(404, "Спортсмен не найден")
    if data.status not in ("in_progress", "ready"):
        raise HTTPException(400, "Недопустимый статус")

    rep = AnalyticsReport(
        athlete_id=data.athlete_id, title=data.title,
        content=data.content, status=data.status,
    )
    db.add(rep); db.commit(); db.refresh(rep)
    return _rep_out(rep)


@router.get("/reports/my/")
def my_reports(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    my_ids = [a.id for a in db.query(Athlete).filter(Athlete.user_id == user.id).all()]
    reps = db.query(AnalyticsReport).filter(
        AnalyticsReport.athlete_id.in_(my_ids)
    ).order_by(AnalyticsReport.created_at.desc()).all()
    return [_rep_out(r) for r in reps]


@router.get("/reports/")
def all_reports(db: Session = Depends(get_db), _: User = Depends(require_manager)):
    reps = db.query(AnalyticsReport).order_by(AnalyticsReport.created_at.desc()).all()
    return [_rep_out(r) for r in reps]


@router.patch("/reports/{rep_id}/")
def update_report(
    rep_id: int,
    data:   ReportUpdate,
    db:     Session = Depends(get_db),
    _:      User    = Depends(require_manager),
):
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


@router.post("/reports/{rep_id}/file")
def upload_report_file(
    rep_id: int,
    file:   UploadFile = File(...),
    db:     Session    = Depends(get_db),
    _:      User       = Depends(require_manager),
):
    rep = db.query(AnalyticsReport).filter(AnalyticsReport.id == rep_id).first()
    if not rep:
        raise HTTPException(404, "Аналитика не найдена")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"Формат {ext} не поддерживается. Допустимы: PDF, DOC, DOCX, XLSX")

    contents = file.file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(400, "Файл слишком большой (макс. 20 МБ)")

    # Удаляем старый файл если был
    if rep.file_url:
        old_path = f"/app/static/analytics/{os.path.basename(rep.file_url)}"
        if os.path.exists(old_path):
            os.remove(old_path)

    stored = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(UPLOAD_DIR, stored), "wb") as f:
        f.write(contents)

    rep.file_url = f"/static/analytics/{stored}"
    db.commit()
    return _rep_out(rep)


@router.delete("/reports/{rep_id}/", status_code=204)
def delete_report(
    rep_id: int,
    db:     Session = Depends(get_db),
    _:      User    = Depends(require_manager),
):
    rep = db.query(AnalyticsReport).filter(AnalyticsReport.id == rep_id).first()
    if not rep:
        raise HTTPException(404, "Аналитика не найдена")
    if rep.file_url:
        path = f"/app/static/analytics/{os.path.basename(rep.file_url)}"
        if os.path.exists(path):
            os.remove(path)
    db.delete(rep); db.commit()
