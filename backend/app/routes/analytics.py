# backend/app/routes/analytics.py

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from datetime import datetime
from app.core.database import get_db
from app.core.security import get_current_user, require_manager
from app.models.user import User, Athlete, Application
from app.models.analytics import Analytics
from app.models.certification import Notification, NotificationType
import os
import uuid

router = APIRouter()

UPLOAD_DIR = "/app/static/analytics"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ─── Создать аналитику (с файлом) — менеджер ────────────────────────────────

@router.post("/analytics")
async def create_analytics(
    athlete_id: int = Form(...),
    title: str = Form(...),
    comment: Optional[str] = Form(None),
    application_id: Optional[int] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    # Проверяем спортсмена
    athlete = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not athlete:
        raise HTTPException(status_code=404, detail="Спортсмен не найден")

    file_path = None
    file_name = None

    if file:
        ext = os.path.splitext(file.filename)[1] if file.filename else ""
        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = f"/static/analytics/{unique_name}"
        full_path = os.path.join(UPLOAD_DIR, unique_name)
        content = await file.read()
        with open(full_path, "wb") as f:
            f.write(content)
        file_name = file.filename

    record = Analytics(
        athlete_id=athlete_id,
        title=title,
        comment=comment or None,
        file_path=file_path,
        file_name=file_name,
        created_by=current_user.id,
    )
    db.add(record)
    db.flush()

    # Отправляем уведомление родителю
    notif_body = f"Аналитика по спортсмену {athlete.full_name}: {title}."
    if comment:
        notif_body += f" Комментарий: {comment}"
    db.add(Notification(
        user_id=athlete.user_id,
        type=NotificationType.general,
        title=f"Аналитика — {title}",
        body=notif_body,
        link_id=record.id,
        link_type="analytics",
    ))

    # Если пришёл application_id — удаляем заявку
    if application_id:
        app = db.query(Application).filter(Application.id == application_id).first()
        if app:
            db.delete(app)

    db.commit()
    db.refresh(record)

    return {
        "id": record.id,
        "athlete_id": record.athlete_id,
        "title": record.title,
        "comment": record.comment,
        "file_path": record.file_path,
        "file_name": record.file_name,
        "created_at": str(record.created_at),
    }


# ─── Все аналитики — менеджер ────────────────────────────────────────────────

@router.get("/analytics")
def get_all_analytics(
    athlete_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role = getattr(current_user, "role", "parent")

    if role in ("admin", "manager"):
        q = db.query(Analytics).options(
            joinedload(Analytics.athlete),
            joinedload(Analytics.creator),
        )
        if athlete_id:
            q = q.filter(Analytics.athlete_id == athlete_id)
    else:
        # Родитель / спортсмен — только свои
        my_ids = [a.id for a in db.query(Athlete).filter(Athlete.user_id == current_user.id).all()]
        q = db.query(Analytics).options(
            joinedload(Analytics.athlete),
        ).filter(Analytics.athlete_id.in_(my_ids))
        if athlete_id:
            q = q.filter(Analytics.athlete_id == athlete_id)

    records = q.order_by(Analytics.created_at.desc()).all()

    return [
        {
            "id": r.id,
            "athlete_id": r.athlete_id,
            "athlete_name": r.athlete.full_name if r.athlete else None,
            "title": r.title,
            "comment": r.comment,
            "file_path": r.file_path,
            "file_name": r.file_name,
            "created_by_name": r.creator.full_name if r.creator else None,
            "created_at": str(r.created_at),
        }
        for r in records
    ]


# ─── Удалить аналитику — менеджер ───────────────────────────────────────────

@router.delete("/analytics/{analytics_id}", status_code=204)
def delete_analytics(
    analytics_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_manager),
):
    record = db.query(Analytics).filter(Analytics.id == analytics_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Аналитика не найдена")

    # Удаляем файл с диска
    if record.file_path:
        full_path = f"/app{record.file_path}"
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
            except Exception:
                pass

    db.delete(record)
    db.commit()
