# backend/app/routes/camps.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from datetime import date
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Athlete
from app.models.camp import Camp, CampParticipant
from app.models.certification import Notification, NotificationType

router = APIRouter(prefix="/camps", tags=["camps"])


def require_manager(u: User = Depends(get_current_user)) -> User:
    if u.role not in ("manager", "admin"):
        raise HTTPException(403, "Недостаточно прав")
    return u


# ── Схемы ─────────────────────────────────────────────────────────────────────

class CampCreate(BaseModel):
    name:       str
    date_start: date
    date_end:   date
    location:   Optional[str]  = None
    price:      Optional[float] = None
    notes:      Optional[str]  = None


class ParticipantUpsert(BaseModel):
    athlete_id: int


class BulkParticipants(BaseModel):
    athlete_ids: list[int]


class StatusUpdate(BaseModel):
    status: str  # confirmed / declined / paid
    paid:   Optional[bool] = None


# ── CRUD сборов ───────────────────────────────────────────────────────────────

@router.post("", status_code=201)
def create_camp(data: CampCreate, db: Session = Depends(get_db), user: User = Depends(require_manager)):
    camp = Camp(
        name=data.name, date_start=data.date_start, date_end=data.date_end,
        location=data.location, price=data.price, notes=data.notes,
        created_by=user.id
    )
    db.add(camp); db.commit(); db.refresh(camp)

    # Автоматически добавляем всех спортсменов со статусом pending
    athletes = db.query(Athlete).all()
    for a in athletes:
        db.add(CampParticipant(camp_id=camp.id, athlete_id=a.id, status="pending"))
    db.commit()

    # Уведомляем всех пользователей сразу при создании
    _notify_all_users(camp, db)

    return _camp_out(camp)


@router.get("/seasons")
def get_camp_seasons(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(Camp.date_start).all()
    seasons = set()
    for (d,) in rows:
        year = d.year if d.month >= 9 else d.year - 1
        seasons.add(year)
    return sorted(seasons, reverse=True)


@router.get("")
def list_camps(
    date_from: Optional[str] = None,
    date_to:   Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    q = db.query(Camp).order_by(Camp.date_start.desc())
    if date_from: q = q.filter(Camp.date_start >= date_from)
    if date_to:   q = q.filter(Camp.date_start <= date_to)
    camps = q.all()
    return [_camp_out(c) for c in camps]


@router.get("/{camp_id}")
def get_camp(camp_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    camp = _get_or_404(camp_id, db)
    parts = db.query(CampParticipant).options(joinedload(CampParticipant.athlete)) \
        .filter(CampParticipant.camp_id == camp_id).all()
    return {**_camp_out(camp), "participants": [_part_out(p) for p in parts]}


@router.delete("/{camp_id}", status_code=204)
def delete_camp(camp_id: int, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    camp = _get_or_404(camp_id, db)
    db.delete(camp); db.commit()


# ── Участники ─────────────────────────────────────────────────────────────────

@router.put("/{camp_id}/participants")
def set_participants(
    camp_id: int,
    data: BulkParticipants,
    db: Session = Depends(get_db),
    _: User = Depends(require_manager)
):
    """Задать список участников (заменяет текущий список)."""
    _get_or_404(camp_id, db)
    existing = {p.athlete_id: p for p in db.query(CampParticipant).filter(CampParticipant.camp_id == camp_id).all()}

    # Удаляем убранных
    for aid, p in existing.items():
        if aid not in data.athlete_ids:
            db.delete(p)

    # Добавляем новых
    for aid in data.athlete_ids:
        if aid not in existing:
            db.add(CampParticipant(camp_id=camp_id, athlete_id=aid, status="pending"))

    db.commit()
    parts = db.query(CampParticipant).options(joinedload(CampParticipant.athlete)) \
        .filter(CampParticipant.camp_id == camp_id).all()
    return [_part_out(p) for p in parts]


@router.patch("/{camp_id}/participants/{athlete_id}")
def update_participant_status(
    camp_id: int,
    athlete_id: int,
    data: StatusUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_manager)
):
    p = db.query(CampParticipant).filter(
        CampParticipant.camp_id == camp_id,
        CampParticipant.athlete_id == athlete_id
    ).first()
    if not p: raise HTTPException(404)
    p.status = data.status
    if data.paid is not None:
        p.paid = data.paid
        if data.paid:
            p.status = "paid"
    db.commit()

    # Если статус "paid" — начисляем ачивку
    if p.status == "paid" or p.status == "confirmed":
        try:
            from app.routes.achievements import auto_grant
            auto_grant(athlete_id, db)
        except Exception as e:
            print(f"Achievement error: {e}")

    return _part_out(p)


# ── Уведомление участникам ────────────────────────────────────────────────────

@router.post("/{camp_id}/notify")
def notify_camp(camp_id: int, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    """
    Отправить уведомление всем участникам сборов.
    Родители могут ответить да/нет через вкладку Уведомления.
    """
    camp = _get_or_404(camp_id, db)
    parts = db.query(CampParticipant).options(
        joinedload(CampParticipant.athlete).joinedload(Athlete.user)
    ).filter(CampParticipant.camp_id == camp_id).all()

    price_str = f" Стоимость участия: {camp.price} руб." if camp.price else ""
    sent = 0

    for p in parts:
        if not p.athlete or not p.athlete.user:
            continue

        user_role = getattr(p.athlete.user, 'role', 'parent')
        if user_role == 'athlete':
            body = (
                f"Вы включены в список участников сборов «{camp.name}». "
                f"Даты: {camp.date_start.strftime('%d.%m.%Y')} — {camp.date_end.strftime('%d.%m.%Y')}."
            )
        else:
            body = (
                f"Спортсмен {p.athlete.full_name} включён в список участников сборов «{camp.name}». "
                f"Даты: {camp.date_start.strftime('%d.%m.%Y')} — {camp.date_end.strftime('%d.%m.%Y')}."
            )
        if camp.location:
            body += f" Место: {camp.location}."
        body += price_str
        if camp.notes:
            body += f" {camp.notes}"
        body += " Подтвердите участие в личном кабинете."

        notif = Notification(
            user_id=p.athlete.user_id,
            type=NotificationType.camp,
            title=f"Сборы — {camp.name}",
            body=body,
            link_id=camp_id
        )
        db.add(notif)
        sent += 1

    camp.notify_sent = True
    db.commit()
    return {"sent": sent}


# ── Ответ родителя/спортсмена ─────────────────────────────────────────────────

@router.post("/{camp_id}/respond")
def respond_to_camp(
    camp_id: int,
    going: bool,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Родитель/спортсмен отвечает едет или нет."""
    # Находим своего спортсмена
    athletes = db.query(Athlete).filter(Athlete.user_id == current_user.id).all()
    athlete_ids = [a.id for a in athletes]

    parts = db.query(CampParticipant).filter(
        CampParticipant.camp_id == camp_id,
        CampParticipant.athlete_id.in_(athlete_ids)
    ).all()

    if not parts:
        raise HTTPException(404, "Вы не в списке участников этих сборов")

    for p in parts:
        p.status = "confirmed" if going else "declined"

    db.commit()

    if going:
        try:
            from app.routes.achievements import auto_grant
            for p in parts:
                auto_grant(p.athlete_id, db)
        except Exception as e:
            print(f"Achievement error: {e}")

    return {"ok": True, "status": "confirmed" if going else "declined"}


# ── Хелперы ───────────────────────────────────────────────────────────────────

def _get_or_404(camp_id, db):
    c = db.query(Camp).filter(Camp.id == camp_id).first()
    if not c: raise HTTPException(404, "Сборы не найдены")
    return c


def _camp_out(c):
    confirmed = sum(1 for p in c.participants if p.status in ("confirmed", "paid"))
    paid      = sum(1 for p in c.participants if p.paid)
    return {
        "id": c.id, "name": c.name,
        "date_start": str(c.date_start), "date_end": str(c.date_end),
        "location": c.location, "price": float(c.price) if c.price else None,
        "notes": c.notes, "notify_sent": c.notify_sent,
        "total": len(c.participants), "confirmed": confirmed, "paid": paid,
    }


def _part_out(p):
    return {
        "athlete_id": p.athlete_id,
        "full_name":  p.athlete.full_name if p.athlete else None,
        "group":      p.athlete.group if p.athlete else None,
        "status":     p.status,
        "paid":       p.paid,
    }


def _notify_all_users(camp: Camp, db):
    """Уведомить всех активных пользователей о сборах."""
    from app.models.certification import Notification, NotificationType
    users = db.query(User).filter(User.is_active == True).all()
    price_str = f" Стоимость: {camp.price} руб." if camp.price else ""
    for u in users:
        user_role = getattr(u, 'role', 'parent')
        if user_role == 'athlete':
            body = f"Объявлены спортивные сборы «{camp.name}». Даты: {camp.date_start.strftime('%d.%m.%Y')} — {camp.date_end.strftime('%d.%m.%Y')}."
        else:
            body = f"Объявлены спортивные сборы «{camp.name}». Даты: {camp.date_start.strftime('%d.%m.%Y')} — {camp.date_end.strftime('%d.%m.%Y')}."
        if camp.location: body += f" Место: {camp.location}."
        body += price_str
        body += " Укажите планируете ли участвовать."
        db.add(Notification(
            user_id=u.id, type=NotificationType.camp,
            title=f"Сборы — {camp.name}",
            body=body, link_id=camp.id, link_type="camp"
        ))
    camp.notify_sent = True
    db.commit()
