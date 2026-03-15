# backend/app/routes/attendance.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from datetime import date, timedelta
from typing import Optional
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.attendance import TrainingSession, Attendance
from app.models.user import Athlete, User, UserRole

router = APIRouter(prefix="/attendance", tags=["Посещаемость"])


def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.admin, UserRole.manager]:
        raise HTTPException(status_code=403, detail="Нет доступа")
    return current_user


# ── Схемы ──────────────────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    date: date
    group_name: str   # "junior" | "senior"
    notes: Optional[str] = None

class AttendanceMark(BaseModel):
    athlete_id: int
    present: bool

class SessionMarkRequest(BaseModel):
    records: list[AttendanceMark]


# ── Создать тренировку ──────────────────────────────────────────────────────────

@router.post("/sessions")
def create_session(data: SessionCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    # Проверяем — нет ли уже тренировки этой группы в эту дату
    existing = db.query(TrainingSession).filter(
        TrainingSession.date == data.date,
        TrainingSession.group_name == data.group_name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Тренировка уже создана")

    session = TrainingSession(date=data.date, group_name=data.group_name, notes=data.notes)
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"id": session.id, "date": str(session.date), "group_name": session.group_name}


# ── Получить список тренировок ──────────────────────────────────────────────────

@router.get("/sessions")
def get_sessions(
    group_name: Optional[str] = None,
    limit: int = 30,
    db: Session = Depends(get_db),
    _=Depends(require_admin)
):
    q = db.query(TrainingSession)
    if group_name:
        q = q.filter(TrainingSession.group_name == group_name)
    sessions = q.order_by(TrainingSession.date.desc()).limit(limit).all()
    return [
        {
            "id": s.id,
            "date": str(s.date),
            "group_name": s.group_name,
            "notes": s.notes,
            "total": len(s.records),
            "present": sum(1 for r in s.records if r.present),
        }
        for s in sessions
    ]


# ── Получить тренировку с записями ─────────────────────────────────────────────

@router.get("/sessions/{session_id}")
def get_session(session_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    s = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Не найдено")

    # Загружаем всех спортсменов группы
    athletes = db.query(Athlete).filter(
        Athlete.group == ("Младшая группа" if s.group_name == "junior" else "Старшая группа")
    ).all()

    # Текущие отметки
    marks = {r.athlete_id: r.present for r in s.records}

    return {
        "id": s.id,
        "date": str(s.date),
        "group_name": s.group_name,
        "notes": s.notes,
        "athletes": [
            {
                "id": a.id,
                "full_name": a.full_name,
                "present": marks.get(a.id, False),
            }
            for a in athletes
        ]
    }


# ── Отметить посещаемость ───────────────────────────────────────────────────────

@router.post("/sessions/{session_id}/mark")
def mark_attendance(
    session_id: int,
    data: SessionMarkRequest,
    db: Session = Depends(get_db),
    _=Depends(require_admin)
):
    s = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Тренировка не найдена")

    # Удаляем старые отметки и пишем новые
    db.query(Attendance).filter(Attendance.session_id == session_id).delete()
    for rec in data.records:
        db.add(Attendance(session_id=session_id, athlete_id=rec.athlete_id, present=rec.present))

    db.commit()
    return {"ok": True, "marked": len(data.records)}


# ── Статистика конкретного спортсмена ───────────────────────────────────────────

@router.get("/athlete/{athlete_id}")
def athlete_stats(
    athlete_id: int,
    months: int = 3,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Родитель может смотреть только своих детей
    athlete = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not athlete:
        raise HTTPException(status_code=404)
    if current_user.role not in [UserRole.admin, UserRole.manager]:
        if athlete.user_id != current_user.id:
            raise HTTPException(status_code=403)

    since = date.today() - timedelta(days=30 * months)
    records = (
        db.query(Attendance, TrainingSession)
        .join(TrainingSession, Attendance.session_id == TrainingSession.id)
        .filter(Attendance.athlete_id == athlete_id)
        .filter(TrainingSession.date >= since)
        .order_by(TrainingSession.date)
        .all()
    )

    total   = len(records)
    present = sum(1 for r, _ in records if r.present)
    pct     = round(present / total * 100) if total else 0

    # По месяцам для графика
    monthly = {}
    for rec, sess in records:
        key = str(sess.date)[:7]  # "2026-03"
        if key not in monthly:
            monthly[key] = {"total": 0, "present": 0}
        monthly[key]["total"] += 1
        if rec.present:
            monthly[key]["present"] += 1

    return {
        "athlete_id": athlete_id,
        "full_name": athlete.full_name,
        "total": total,
        "present": present,
        "absent": total - present,
        "percent": pct,
        "monthly": [
            {"month": k, "total": v["total"], "present": v["present"]}
            for k, v in sorted(monthly.items())
        ]
    }


# ── Общая статистика для админа ─────────────────────────────────────────────────

@router.get("/stats")
def overall_stats(db: Session = Depends(get_db), _=Depends(require_admin)):
    since = date.today() - timedelta(days=90)

    total_sessions = db.query(func.count(TrainingSession.id)).filter(
        TrainingSession.date >= since
    ).scalar()

    # Топ по посещаемости
    top = (
        db.query(
            Athlete.full_name,
            func.count(Attendance.id).label("total"),
            func.sum(Attendance.present.cast(Integer)).label("present")
        )
        .join(Attendance, Athlete.id == Attendance.athlete_id)
        .join(TrainingSession, Attendance.session_id == TrainingSession.id)
        .filter(TrainingSession.date >= since)
        .group_by(Athlete.id, Athlete.full_name)
        .order_by(func.sum(Attendance.present.cast(Integer)).desc())
        .limit(10)
        .all()
    )

    return {
        "total_sessions": total_sessions,
        "top_athletes": [
            {"name": r.full_name, "total": r.total, "present": r.present or 0}
            for r in top
        ]
    }
