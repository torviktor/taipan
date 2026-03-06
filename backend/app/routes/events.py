from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.core.database import get_db
from app.core.security import get_current_user, require_manager
from app.models.user import User

# Импортируем модели событий
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

router = APIRouter()

# ─── Схемы ────────────────────────────────────────────────────────────────────

class EventCreate(BaseModel):
    title:              str
    description:        Optional[str] = None
    event_date:         datetime
    location:           Optional[str] = None
    section_id:         Optional[int] = None
    notify_before_days: List[int] = []      # [1, 3, 7] — за сколько дней уведомлять
    notify_everyone:    bool = True

class EventUpdate(BaseModel):
    title:              Optional[str] = None
    description:        Optional[str] = None
    event_date:         Optional[datetime] = None
    location:           Optional[str] = None
    section_id:         Optional[int] = None
    notify_before_days: Optional[List[int]] = None
    notify_everyone:    Optional[bool] = None

class EventOut(BaseModel):
    id:                 int
    title:              str
    description:        Optional[str]
    event_date:         datetime
    location:           Optional[str]
    section_id:         Optional[int]
    notify_before_days: List[int]
    notify_everyone:    bool
    created_at:         datetime
    created_by:         int

    class Config:
        from_attributes = True

class NotifyBeforeOption(BaseModel):
    label: str   # "За 1 день", "За неделю"
    days:  int   # 1, 7, 30 ...

# ─── Варианты напоминаний (для фронтенда) ─────────────────────────────────────

NOTIFY_OPTIONS = [
    {"label": "В день события",  "days": 0},
    {"label": "За 1 день",       "days": 1},
    {"label": "За 2 дня",        "days": 2},
    {"label": "За 3 дня",        "days": 3},
    {"label": "За 5 дней",       "days": 5},
    {"label": "За неделю",       "days": 7},
    {"label": "За 2 недели",     "days": 14},
    {"label": "За месяц",        "days": 30},
]

@router.get("/notify-options", summary="Варианты напоминаний")
def get_notify_options():
    return NOTIFY_OPTIONS

# ─── Получить все события ─────────────────────────────────────────────────────

@router.get("/", response_model=List[EventOut], summary="Все события календаря")
def get_events(
    from_date: Optional[datetime] = None,
    to_date:   Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    from app.models.event import Event
    query = db.query(Event).filter(Event.is_active == True)
    if from_date:
        query = query.filter(Event.event_date >= from_date)
    if to_date:
        query = query.filter(Event.event_date <= to_date)
    return query.order_by(Event.event_date).all()

# ─── Создать событие (только администратор) ───────────────────────────────────

@router.post("/", response_model=EventOut, summary="Создать событие")
def create_event(
    data: EventCreate,
    db:   Session = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    from app.models.event import Event
    event = Event(
        title              = data.title,
        description        = data.description,
        event_date         = data.event_date,
        location           = data.location,
        section_id         = data.section_id,
        notify_before_days = data.notify_before_days,
        notify_everyone    = data.notify_everyone,
        created_by         = current_user.id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # Ставим задачи на отправку напоминаний
    from app.services.notifications import schedule_reminders
    schedule_reminders(event)

    return event

# ─── Обновить событие ─────────────────────────────────────────────────────────

@router.patch("/{event_id}", response_model=EventOut, summary="Обновить событие")
def update_event(
    event_id: int,
    data: EventUpdate,
    db:   Session = Depends(get_db),
    _:    User    = Depends(require_manager)
):
    from app.models.event import Event
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(404, "Событие не найдено")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)

    # Пересчитываем напоминания
    from app.services.notifications import schedule_reminders
    schedule_reminders(event)

    return event

# ─── Удалить событие ──────────────────────────────────────────────────────────

@router.delete("/{event_id}", summary="Удалить событие")
def delete_event(
    event_id: int,
    db:   Session = Depends(get_db),
    _:    User    = Depends(require_manager)
):
    from app.models.event import Event
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(404, "Событие не найдено")
    event.is_active = False   # Мягкое удаление
    db.commit()
    return {"message": "Событие удалено"}

# ─── Подписаться на Push уведомления ──────────────────────────────────────────

@router.post("/push/subscribe", summary="Подписаться на Push уведомления")
def push_subscribe(
    subscription: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.event import PushSubscriber
    import json
    sub = PushSubscriber(
        user_id      = current_user.id,
        subscription = json.dumps(subscription),
    )
    db.add(sub)
    db.commit()
    return {"message": "Подписка оформлена"}
