from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.core.database import get_db
from app.core.security import get_current_user, require_manager
from app.models.user import Application, ApplicationStatus, User

router = APIRouter()

# ─── Схемы ────────────────────────────────────────────────────────────────────
class ApplicationCreate(BaseModel):
    full_name:  str
    phone:      str
    age:        Optional[int] = None
    section_id: Optional[int] = None
    comment:    Optional[str] = None

class ApplicationOut(BaseModel):
    id:         int
    full_name:  str
    phone:      str
    age:        Optional[int]
    comment:    Optional[str]
    status:     str
    created_at: datetime
    section_id: Optional[int]

    class Config:
        from_attributes = True

class StatusUpdate(BaseModel):
    status: ApplicationStatus

# ─── Создать заявку (доступно всем, без авторизации) ─────────────────────────
@router.post("/", response_model=ApplicationOut, summary="Подать заявку на запись")
def create_application(data: ApplicationCreate, db: Session = Depends(get_db)):
    app = Application(**data.model_dump())
    db.add(app)
    db.commit()
    db.refresh(app)
    return app

# ─── Все заявки — только для менеджера ───────────────────────────────────────
@router.get("/", response_model=List[ApplicationOut], summary="Все заявки (менеджер)")
def get_all_applications(
    status: Optional[ApplicationStatus] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_manager)
):
    query = db.query(Application)
    if status:
        query = query.filter(Application.status == status)
    return query.order_by(Application.created_at.desc()).all()

# ─── Обновить статус заявки ───────────────────────────────────────────────────
@router.patch("/{app_id}/status", response_model=ApplicationOut, summary="Изменить статус заявки")
def update_status(
    app_id: int,
    data: StatusUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_manager)
):
    application = db.query(Application).filter(Application.id == app_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    application.status = data.status
    db.commit()
    db.refresh(application)
    return application
