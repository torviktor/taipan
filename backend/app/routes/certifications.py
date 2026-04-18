# backend/app/routes/certifications.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from datetime import date

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Athlete
from app.models.certification import (
    Certification, CertificationResult, Notification,
    CertificationStatus, NotificationType
)
from pydantic import BaseModel

router = APIRouter(prefix="/certifications", tags=["certifications"])
notif_router = APIRouter(prefix="/notifications", tags=["notifications"])


# ── Права ─────────────────────────────────────────────────────────────────────

def require_manager(u: User = Depends(get_current_user)) -> User:
    if u.role not in ("manager", "admin"):
        raise HTTPException(403, "Недостаточно прав")
    return u


# ── Схемы ─────────────────────────────────────────────────────────────────────

class CertificationCreate(BaseModel):
    name:     str
    date:     date
    location: Optional[str] = None
    notes:    Optional[str] = None


class CertificationUpdate(BaseModel):
    name:     Optional[str]  = None
    date:     Optional[date] = None
    location: Optional[str]  = None
    notes:    Optional[str]  = None
    status:   Optional[str]  = None


class ResultUpsert(BaseModel):
    athlete_id:  int
    target_gup:  Optional[int] = None
    target_dan:  Optional[int] = None
    passed:      Optional[bool] = None


class BulkResults(BaseModel):
    results: list[ResultUpsert]


# ── CRUD аттестаций ───────────────────────────────────────────────────────────

@router.post("", status_code=201)
def create_certification(
    data: CertificationCreate,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_manager)
):
    cert = Certification(
        name=data.name, date=data.date, location=data.location,
        notes=data.notes, status=CertificationStatus.planned,
        created_by=user.id
    )
    db.add(cert); db.commit(); db.refresh(cert)
    return _cert_out(cert)


@router.get("/seasons")
def get_cert_seasons(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(Certification.date).all()
    seasons = set()
    for (d,) in rows:
        year = d.year if d.month >= 9 else d.year - 1
        seasons.add(year)
    return sorted(seasons, reverse=True)


@router.get("")
def list_certifications(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    q = db.query(Certification).order_by(Certification.date.desc())
    if date_from: q = q.filter(Certification.date >= date_from)
    if date_to:   q = q.filter(Certification.date <= date_to)
    certs = q.all()
    return [_cert_out(c) for c in certs]


@router.get("/{cert_id}")
def get_certification(cert_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    cert = _get_or_404(cert_id, db)
    results = (
        db.query(CertificationResult)
        .options(joinedload(CertificationResult.athlete))
        .filter(CertificationResult.certification_id == cert_id)
        .all()
    )
    return {**_cert_out(cert), "results": [_result_out(r) for r in results]}


@router.patch("/{cert_id}")
def update_certification(
    cert_id: int,
    data:    CertificationUpdate,
    db:      Session = Depends(get_db),
    _:       User    = Depends(require_manager)
):
    cert = _get_or_404(cert_id, db)
    for k, v in data.dict(exclude_none=True).items():
        setattr(cert, k, v)
    db.commit(); db.refresh(cert)
    return _cert_out(cert)


@router.delete("/{cert_id}", status_code=204)
def delete_certification(cert_id: int, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    cert = _get_or_404(cert_id, db)
    db.delete(cert); db.commit()


# ── Результаты ────────────────────────────────────────────────────────────────

@router.put("/{cert_id}/results")
def upsert_results(
    cert_id: int,
    data:    BulkResults,
    db:      Session = Depends(get_db),
    _:       User    = Depends(require_manager)
):
    """Сохранить список кандидатов с предполагаемыми гыпами."""
    _get_or_404(cert_id, db)
    existing = {
        r.athlete_id: r
        for r in db.query(CertificationResult)
        .filter(CertificationResult.certification_id == cert_id).all()
    }
    ids = [r.athlete_id for r in data.results]
    athletes = {a.id: a for a in db.query(Athlete).filter(Athlete.id.in_(ids)).all()}

    saved = []
    for item in data.results:
        a = athletes.get(item.athlete_id)
        if not a:
            continue
        r = existing.get(item.athlete_id) or CertificationResult(
            certification_id=cert_id, athlete_id=item.athlete_id,
            current_gup=a.gup, current_dan=a.dan
        )
        if item.athlete_id not in existing:
            db.add(r)
        r.target_gup = item.target_gup
        r.target_dan = item.target_dan
        if item.passed is not None:
            r.passed = item.passed
        saved.append(r)

    # Удаляем тех, кого убрали из списка
    for aid, r in existing.items():
        if aid not in ids:
            db.delete(r)

    db.commit()
    for r in saved:
        db.refresh(r)
    return [_result_out(r) for r in saved]


@router.post("/{cert_id}/finalize")
def finalize_certification(
    cert_id: int,
    db:      Session = Depends(get_db),
    _:       User    = Depends(require_manager)
):
    """
    Завершить аттестацию:
    - Обновить гыпы/даны у тех кто сдал
    - Пометить аттестацию как completed
    """
    cert = _get_or_404(cert_id, db)
    results = db.query(CertificationResult).options(joinedload(CertificationResult.athlete)) \
        .filter(CertificationResult.certification_id == cert_id).all()

    updated = 0
    for r in results:
        if r.passed is True and r.athlete:
            if r.target_dan:
                r.athlete.dan = r.target_dan
                r.athlete.gup = None
            elif r.target_gup:
                r.athlete.gup = r.target_gup
                r.athlete.dan = None
            updated += 1

    cert.status = CertificationStatus.completed
    db.commit()
    try:
        from app.routes.achievements import auto_grant
        for r in results:
            if r.passed is True and r.athlete:
                auto_grant(r.athlete_id, db)
    except Exception as e:
        print(f"Achievement error: {e}")
    return {"updated_athletes": updated, "status": "completed"}


@router.patch("/{cert_id}/results/{athlete_id}/paid")
def update_paid(
    cert_id: int, athlete_id: int, paid: bool,
    db: Session = Depends(get_db), _: User = Depends(require_manager)
):
    r = db.query(CertificationResult).filter(
        CertificationResult.certification_id == cert_id,
        CertificationResult.athlete_id == athlete_id
    ).first()
    if not r: raise HTTPException(404)
    r.paid = paid
    db.commit()
    return _result_out(r)


@router.post("/{cert_id}/notify")
def send_notifications(
    cert_id: int,
    db:      Session = Depends(get_db),
    _:       User    = Depends(require_manager)
):
    """Отправить уведомления родителям/спортсменам об аттестации."""
    cert = _get_or_404(cert_id, db)
    results = db.query(CertificationResult).options(
        joinedload(CertificationResult.athlete).joinedload(Athlete.user)
    ).filter(CertificationResult.certification_id == cert_id).all()

    sent = 0
    telegram_notifs = []
    for r in results:
        if not r.athlete or not r.athlete.user:
            continue

        target_str = ""
        if r.target_dan:
            target_str = f"{r.target_dan} дан"
        elif r.target_gup:
            target_str = f"{r.target_gup} гып"

        # Определяем роль пользователя
        user_role = r.athlete.user.role if r.athlete.user else "parent"

        title = f"Аттестация — {cert.name}"
        if user_role == "athlete":
            body = (
                f"Вы отобраны для сдачи экзамена "
                f"на {target_str}. "
                f"Дата: {cert.date.strftime('%d.%m.%Y')}."
            )
        else:
            body = (
                f"Ваш спортсмен {r.athlete.full_name} отобран для сдачи экзамена "
                f"на {target_str}. "
                f"Дата: {cert.date.strftime('%d.%m.%Y')}."
            )
        if cert.location:
            body += f" Место: {cert.location}."
        if cert.notes:
            body += f" {cert.notes}"

        notif = Notification(
            user_id=r.athlete.user_id,
            type=NotificationType.certification,
            title=title,
            body=body,
            link_id=cert_id
        )
        db.add(notif)
        telegram_notifs.append((r.athlete.user_id, title, body))
        sent += 1

    cert.notify_sent = True
    db.commit()

    from app.services.notifications import send_telegram_to_user
    for uid, tl, bd in telegram_notifs:
        send_telegram_to_user(uid, tl, bd, db)

    return {"sent": sent}


# ── Уведомления ───────────────────────────────────────────────────────────────

@notif_router.get("")
def get_my_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    user: User  = Depends(get_current_user)
):
    q = db.query(Notification).filter(Notification.user_id == user.id)
    if unread_only:
        q = q.filter(Notification.is_read == False)
    notifs = q.order_by(Notification.created_at.desc()).limit(50).all()
    return [_notif_out(n) for n in notifs]


@notif_router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    count = db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.is_read == False
    ).count()
    return {"count": count}


@notif_router.patch("/{notif_id}/read")
def mark_read(notif_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    n = db.query(Notification).filter(Notification.id == notif_id, Notification.user_id == user.id).first()
    if not n: raise HTTPException(404)
    n.is_read = True; db.commit()
    return {"ok": True}


@notif_router.patch("/read-all")
def mark_all_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.query(Notification).filter(Notification.user_id == user.id, Notification.is_read == False) \
        .update({"is_read": True})
    db.commit()
    return {"ok": True}


@notif_router.post("/{notif_id}/respond")
def respond_notification(
    notif_id: int,
    going: bool,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    n = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.user_id == current_user.id
    ).first()
    if not n: raise HTTPException(404)
    n.response = "going" if going else "not_going"
    n.is_read = True
    db.commit()
    if getattr(n, "link_type", None) == "camp" and n.link_id:
        try:
            from app.models.camp import CampParticipant
            from app.models.user import Athlete as AthleteModel
            athletes = db.query(AthleteModel).filter(AthleteModel.user_id == current_user.id).all()
            for a in athletes:
                p = db.query(CampParticipant).filter(
                    CampParticipant.camp_id == n.link_id,
                    CampParticipant.athlete_id == a.id
                ).first()
                if p:
                    p.status = "confirmed" if going else "declined"
            db.commit()
        except Exception as e:
            print(f"Camp respond error: {e}")
    if getattr(n, "link_type", None) == "competition" and n.link_id:
        try:
            from app.models.competition import CompetitionResult
            from app.models.user import Athlete as AthleteModel
            athletes = db.query(AthleteModel).filter(AthleteModel.user_id == current_user.id).all()
            for a in athletes:
                r = db.query(CompetitionResult).filter(
                    CompetitionResult.competition_id == n.link_id,
                    CompetitionResult.athlete_id == a.id
                ).first()
                if r:
                    r.status = "confirmed" if going else "declined"
            db.commit()
        except Exception as e:
            print(f"Competition respond error: {e}")
    return {"ok": True, "response": n.response}


# ── Хелперы ───────────────────────────────────────────────────────────────────

def _get_or_404(cert_id, db):
    c = db.query(Certification).filter(Certification.id == cert_id).first()
    if not c: raise HTTPException(404, "Аттестация не найдена")
    return c


def _cert_out(c):
    return {
        "id": c.id, "name": c.name, "date": str(c.date),
        "location": c.location, "notes": c.notes,
        "status": c.status, "notify_sent": c.notify_sent,
        "created_by": c.created_by,
    }


def _result_out(r):
    return {
        "id":               r.id,
        "certification_id": r.certification_id,
        "athlete_id":       r.athlete_id,
        "full_name":        r.athlete.full_name if r.athlete else None,
        "group":            r.athlete.group if r.athlete else None,
        "current_gup":      r.current_gup,
        "current_dan":      r.current_dan,
        "target_gup":       r.target_gup,
        "target_dan":       r.target_dan,
        "passed":           r.passed,
        "paid":             getattr(r, "paid", False),
    }


def _notif_out(n):
    return {
        "id":         n.id,
        "type":       n.type,
        "title":      n.title,
        "body":       n.body,
        "is_read":    n.is_read,
        "link_id":    n.link_id,
        "link_type":  getattr(n, "link_type", None),
        "response":   getattr(n, "response", None),
        "created_at": str(n.created_at),
    }


def _send_telegram_notifications(results, cert, db):
    """Попытка отправить уведомления в Telegram."""
    import os, httpx
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        return
    for r in results:
        if not r.athlete or not r.athlete.user:
            continue
        chat_id = getattr(r.athlete.user, 'telegram_chat_id', None)
        if not chat_id:
            continue
        target_str = f"{r.target_dan} дан" if r.target_dan else f"{r.target_gup} гып" if r.target_gup else ""
        text = (
            f"🥋 *{cert.name}*\n\n"
            f"{r.athlete.full_name} отобран для сдачи экзамена на *{target_str}*.\n"
            f"📅 Дата: {cert.date.strftime('%d.%m.%Y')}"
        )
        if cert.location:
            text += f"\n📍 {cert.location}"
        try:
            httpx.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
                timeout=5
            )
        except Exception:
            pass
