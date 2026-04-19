from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.individual_training import IndividualTrainingRequest

router = APIRouter(prefix="/individual-training", tags=["Индивидуальные тренировки"])


def require_admin(u: User = Depends(get_current_user)) -> User:
    if u.role != "admin":
        raise HTTPException(403, "Недостаточно прав")
    return u


def _out(r: IndividualTrainingRequest) -> dict:
    return {
        "id":             r.id,
        "user_id":        r.user_id,
        "athlete_id":     r.athlete_id,
        "format":         r.format,
        "preferred_time": r.preferred_time,
        "comment":        r.comment,
        "status":         r.status,
        "created_at":     r.created_at.strftime("%d.%m.%Y %H:%M") if r.created_at else None,
        "user_name":      r.user.full_name if r.user else None,
        "athlete_name":   r.athlete.full_name if r.athlete else None,
    }


class CreateRequestBody(BaseModel):
    athlete_id:     Optional[int] = None
    format:         str
    preferred_time: Optional[str] = None
    comment:        Optional[str] = None


class UpdateStatusBody(BaseModel):
    status: str


@router.post("/request")
def create_request(
    body: CreateRequestBody,
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    req = IndividualTrainingRequest(
        user_id=user.id,
        athlete_id=body.athlete_id,
        format=body.format,
        preferred_time=body.preferred_time,
        comment=body.comment,
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    # Загружаем спортсмена для уведомления
    athlete_name = req.athlete.full_name if req.athlete else "—"
    format_ru = "индивидуальное занятие" if body.format == "individual" else "мини-группу"
    notif_title = "Заявка на индивидуальную тренировку"
    notif_body = (
        f"Родитель {user.full_name} подал заявку на {format_ru} "
        f"для {athlete_name}."
    )
    if body.preferred_time:
        notif_body += f" Пожелания: {body.preferred_time}."
    if body.comment:
        notif_body += f" {body.comment}"

    from app.models.certification import Notification
    from app.services.notifications import send_telegram_to_user

    managers = db.query(User).filter(
        User.role == "admin",
        User.is_active == True,
    ).all()
    for m in managers:
        db.add(Notification(
            user_id=m.id,
            type="individual_training",
            title=notif_title,
            body=notif_body,
        ))
    db.commit()
    for m in managers:
        send_telegram_to_user(m.id, notif_title, notif_body, db)

    return _out(req)


@router.get("/requests")
def list_requests(
    db:   Session = Depends(get_db),
    user: User    = Depends(get_current_user),
):
    if user.role == "admin":
        rows = db.query(IndividualTrainingRequest).order_by(
            IndividualTrainingRequest.status == "new",
            IndividualTrainingRequest.created_at.desc(),
        ).all()
    else:
        rows = db.query(IndividualTrainingRequest).filter(
            IndividualTrainingRequest.user_id == user.id,
        ).order_by(IndividualTrainingRequest.created_at.desc()).all()
    return [_out(r) for r in rows]


@router.patch("/requests/{req_id}")
def update_status(
    req_id: int,
    body:   UpdateStatusBody,
    db:     Session = Depends(get_db),
    _:      User    = Depends(require_admin),
):
    req = db.query(IndividualTrainingRequest).filter(IndividualTrainingRequest.id == req_id).first()
    if not req:
        raise HTTPException(404, "Заявка не найдена")

    req.status = body.status
    db.commit()

    athlete_name = req.athlete.full_name if req.athlete else "спортсмена"
    if body.status == "confirmed":
        notif_title = "Заявка подтверждена"
        notif_body = (
            f"Ваша заявка на индивидуальную тренировку для {athlete_name} подтверждена. "
            f"Тренер свяжется с вами."
        )
    else:
        notif_title = "Заявка отклонена"
        notif_body = (
            f"Ваша заявка на индивидуальную тренировку для {athlete_name} отклонена. "
            f"Обратитесь к тренеру."
        )

    from app.models.certification import Notification
    from app.services.notifications import send_telegram_to_user

    db.add(Notification(
        user_id=req.user_id,
        type="individual_training",
        title=notif_title,
        body=notif_body,
    ))
    db.commit()
    send_telegram_to_user(req.user_id, notif_title, notif_body, db)

    return _out(req)
