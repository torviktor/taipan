from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timedelta
import secrets

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Athlete
from app.models.invite import AthleteInvite, AthleteViewer

router = APIRouter(prefix="/invite", tags=["Приглашения"])


def _require_parent(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("parent", "manager", "admin"):
        raise HTTPException(403, "Нет доступа")
    return current_user


class GenerateBody(BaseModel):
    athlete_id: int


class AcceptBody(BaseModel):
    token: str


# ── GET /invite/my-viewers/{athlete_id} — до /{token} чтобы не перехватывало ──
@router.get("/my-viewers/{athlete_id}")
def my_viewers(
    athlete_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_parent),
):
    athlete = db.query(Athlete).filter(
        Athlete.id == athlete_id,
        Athlete.user_id == current_user.id,
    ).first()
    if not athlete:
        raise HTTPException(404, "Спортсмен не найден")
    viewers = db.query(AthleteViewer).filter(
        AthleteViewer.athlete_id == athlete_id
    ).all()
    return [
        {
            "id": v.id,
            "viewer_id": v.viewer_id,
            "viewer_name": v.viewer.full_name if v.viewer else "—",
            "created_at": v.created_at.isoformat() if v.created_at else None,
        }
        for v in viewers
    ]


# ── GET /invite/{token} — публичный ──────────────────────────────────────────
@router.get("/{token}")
def get_invite(token: str, db: Session = Depends(get_db)):
    inv = db.query(AthleteInvite).filter(AthleteInvite.token == token).first()
    if not inv or not inv.is_active or inv.expires_at < datetime.utcnow():
        raise HTTPException(404, "Ссылка недействительна или истекла")
    return {
        "athlete_name": inv.athlete.full_name if inv.athlete else "—",
        "token": inv.token,
    }


# ── POST /invite/generate ─────────────────────────────────────────────────────
@router.post("/generate")
def generate_invite(
    body: GenerateBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_parent),
):
    athlete = db.query(Athlete).filter(
        Athlete.id == body.athlete_id,
        Athlete.user_id == current_user.id,
    ).first()
    if not athlete:
        raise HTTPException(404, "Спортсмен не найден")

    token = secrets.token_urlsafe(8)[:10].upper()
    expires_at = datetime.utcnow() + timedelta(days=30)

    inv = AthleteInvite(
        athlete_id = body.athlete_id,
        created_by = current_user.id,
        token      = token,
        expires_at = expires_at,
        is_active  = True,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)

    return {
        "token": token,
        "invite_url": f"https://taipan-tkd.ru/invite/{token}",
        "expires_at": expires_at.isoformat(),
    }


# ── POST /invite/accept ───────────────────────────────────────────────────────
@router.post("/accept")
def accept_invite(
    body: AcceptBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    inv = db.query(AthleteInvite).filter(AthleteInvite.token == body.token).first()
    if not inv or not inv.is_active or inv.expires_at < datetime.utcnow():
        raise HTTPException(400, "Ссылка недействительна")

    existing = db.query(AthleteViewer).filter(
        AthleteViewer.athlete_id == inv.athlete_id,
        AthleteViewer.viewer_id  == current_user.id,
    ).first()
    if not existing:
        db.add(AthleteViewer(
            athlete_id = inv.athlete_id,
            viewer_id  = current_user.id,
        ))
        db.commit()

    return {
        "ok": True,
        "athlete_id": inv.athlete_id,
        "athlete_name": inv.athlete.full_name if inv.athlete else "—",
    }


# ── DELETE /invite/revoke/{athlete_id} ───────────────────────────────────────
@router.delete("/revoke/{athlete_id}")
def revoke_invite(
    athlete_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(_require_parent),
):
    athlete = db.query(Athlete).filter(
        Athlete.id == athlete_id,
        Athlete.user_id == current_user.id,
    ).first()
    if not athlete:
        raise HTTPException(404, "Спортсмен не найден")

    invites = db.query(AthleteInvite).filter(
        AthleteInvite.athlete_id == athlete_id,
        AthleteInvite.created_by == current_user.id,
    ).all()
    for inv in invites:
        inv.is_active = False

    db.query(AthleteViewer).filter(
        AthleteViewer.athlete_id == athlete_id
    ).delete()

    db.commit()
    return {"ok": True}
