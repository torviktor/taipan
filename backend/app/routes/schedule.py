from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_db
from app.core.security import require_manager
from app.models.user import Schedule, Section, User

router = APIRouter()

DAYS = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"]

# ─── Схемы ────────────────────────────────────────────────────────────────────
class SectionOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    price: Optional[float]
    class Config:
        from_attributes = True

class ScheduleOut(BaseModel):
    id:          int
    section_id:  int
    section:     SectionOut
    day_of_week: int
    day_name:    str
    time_start:  str
    time_end:    str
    trainer:     Optional[str]
    location:    Optional[str]
    class Config:
        from_attributes = True

class ScheduleCreate(BaseModel):
    section_id:  int
    day_of_week: int
    time_start:  str
    time_end:    str
    trainer:     Optional[str] = None
    location:    Optional[str] = None

# ─── Получить всё расписание (публично) ──────────────────────────────────────
@router.get("/", response_model=List[ScheduleOut], summary="Расписание всех секций")
def get_schedule(db: Session = Depends(get_db)):
    items = db.query(Schedule).order_by(Schedule.day_of_week, Schedule.time_start).all()
    result = []
    for item in items:
        out = ScheduleOut(
            id=item.id, section_id=item.section_id, section=item.section,
            day_of_week=item.day_of_week, day_name=DAYS[item.day_of_week],
            time_start=item.time_start, time_end=item.time_end,
            trainer=item.trainer, location=item.location
        )
        result.append(out)
    return result

# ─── Все секции (публично) ────────────────────────────────────────────────────
@router.get("/sections", response_model=List[SectionOut], summary="Список секций")
def get_sections(db: Session = Depends(get_db)):
    return db.query(Section).all()

# ─── Создать запись в расписании (менеджер) ───────────────────────────────────
@router.post("/", response_model=dict, summary="Добавить занятие в расписание")
def create_schedule(
    data: ScheduleCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_manager)
):
    item = Schedule(**data.model_dump())
    db.add(item)
    db.commit()
    return {"message": "Добавлено"}

# ─── Удалить запись (менеджер) ────────────────────────────────────────────────
@router.delete("/{item_id}", summary="Удалить занятие из расписания")
def delete_schedule(
    item_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_manager)
):
    item = db.query(Schedule).filter(Schedule.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Не найдено")
    db.delete(item)
    db.commit()
    return {"message": "Удалено"}
