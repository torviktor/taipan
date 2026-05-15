# backend/app/routes/news_routes.py

import os, uuid
from datetime import date as date_type
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.news import News

router = APIRouter(prefix="/news", tags=["news"])

UPLOAD_DIR = "/app/static/news"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}
MAX_SIZE    = 10 * 1024 * 1024


def require_manager(u: User = Depends(get_current_user)) -> User:
    if u.role not in ("manager", "admin"):
        raise HTTPException(403, "Недостаточно прав")
    return u


class NewsCreate(BaseModel):
    title:            str
    body:             str
    competition_id:   Optional[int] = None
    certification_id: Optional[int] = None
    camp_id:          Optional[int] = None


class NewsUpdate(BaseModel):
    title: Optional[str] = None
    body:  Optional[str] = None


class ModeBody(BaseModel):
    mode: str = "auto"   # "auto" | "past" | "preview"


def _out(n: News) -> dict:
    return {
        "id":               n.id,
        "title":            n.title,
        "body":             n.body,
        "photo_url":        n.photo_url,
        "published_at":     str(n.published_at),
        "competition_id":   n.competition_id,
        "certification_id": n.certification_id,
        "camp_id":          n.camp_id,
        "status":           n.status,
        "source":           n.source,
    }


def _rank_label(gup: Optional[int], dan: Optional[int]) -> str:
    if dan:
        suffixes = {1:"1-й дан",2:"2-й дан",3:"3-й дан",4:"4-й дан",
                    5:"5-й дан",6:"6-й дан",7:"7-й дан",8:"8-й дан",9:"9-й дан"}
        return suffixes.get(dan, f"{dan}-й дан")
    if gup == 0: return "без пояса"
    if gup:      return f"{gup}-й гып"
    return "—"


def _athlete_word(n: int) -> str:
    if n % 10 == 1 and n % 100 != 11:  return "спортсмен"
    if 2 <= n % 10 <= 4 and not (12 <= n % 100 <= 14): return "спортсмена"
    return "спортсменов"


def _resolve_mode(mode: str, event_date: date_type) -> str:
    """
    'auto'    → определяем по дате события
    'past'    → свершившийся факт
    'preview' → анонс предстоящего
    Если mode='auto' и дата == сегодня, возвращаем 'past' как fallback
    (фронт должен передать явный режим при date == today).
    """
    if mode != "auto":
        return mode
    today = date_type.today()
    if event_date < today:  return "past"
    if event_date > today:  return "preview"
    return "past"  # today fallback


# ─── CRUD роуты ──────────────────────────────────────────────────────────────

@router.get("")
def list_news(limit: int = 20, offset: int = 0, db: Session = Depends(get_db)):
    items = db.query(News).filter(News.status == 'published').order_by(News.published_at.desc()).offset(offset).limit(limit).all()
    total = db.query(News).filter(News.status == 'published').count()
    return {"items": [_out(n) for n in items], "total": total}


@router.get("/drafts/count")
def drafts_count(db: Session = Depends(get_db), _: User = Depends(require_manager)):
    return {"count": db.query(News).filter(News.status == 'draft').count()}


@router.get("/drafts")
def list_drafts(
    limit:  int = 50,
    offset: int = 0,
    db:     Session = Depends(get_db),
    _:      User    = Depends(require_manager),
):
    items = (
        db.query(News)
          .filter(News.status == 'draft')
          .order_by(News.published_at.desc())
          .offset(offset).limit(limit).all()
    )
    total = db.query(News).filter(News.status == 'draft').count()
    return {"items": [_out(n) for n in items], "total": total}


@router.post("/{news_id}/publish", status_code=204)
def publish_draft(
    news_id: int,
    db:      Session = Depends(get_db),
    _:       User    = Depends(require_manager),
):
    n = db.query(News).filter(News.id == news_id, News.status == 'draft').first()
    if not n:
        raise HTTPException(404, "Черновик не найден")
    from sqlalchemy import func
    n.status = 'published'
    n.published_at = func.now()
    db.commit()


@router.get("/{news_id}")
def get_news(news_id: int, db: Session = Depends(get_db)):
    n = db.query(News).filter(News.id == news_id, News.status == 'published').first()
    if not n: raise HTTPException(404, "Новость не найдена")
    return _out(n)


@router.post("", status_code=201)
def create_news(data: NewsCreate, db: Session = Depends(get_db), user: User = Depends(require_manager)):
    if data.competition_id:
        existing = db.query(News).filter(News.competition_id == data.competition_id, News.status.in_(('draft', 'published'))).first()
        if existing: raise HTTPException(400, "Новость об этом соревновании уже опубликована")
    if data.certification_id:
        existing = db.query(News).filter(News.certification_id == data.certification_id, News.status.in_(('draft', 'published'))).first()
        if existing: raise HTTPException(400, "Новость об этой аттестации уже опубликована")
    if data.camp_id:
        existing = db.query(News).filter(News.camp_id == data.camp_id, News.status.in_(('draft', 'published'))).first()
        if existing: raise HTTPException(400, "Новость об этих сборах уже опубликована")

    n = News(
        title=data.title, body=data.body,
        competition_id=data.competition_id,
        certification_id=data.certification_id,
        camp_id=data.camp_id,
        created_by=user.id,
        status='draft',
        source='manual',
    )
    db.add(n); db.commit(); db.refresh(n)

    return _out(n)


@router.patch("/{news_id}")
def update_news(news_id: int, data: NewsUpdate, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    n = db.query(News).filter(News.id == news_id).first()
    if not n: raise HTTPException(404, "Новость не найдена")
    if data.title is not None: n.title = data.title
    if data.body  is not None: n.body  = data.body
    db.commit(); db.refresh(n)
    return _out(n)


@router.post("/{news_id}/photo")
def upload_photo(news_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), _: User = Depends(require_manager)):
    n = db.query(News).filter(News.id == news_id).first()
    if not n: raise HTTPException(404, "Новость не найдена")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXT: raise HTTPException(400, f"Формат {ext} не поддерживается")
    contents = file.file.read()
    if len(contents) > MAX_SIZE: raise HTTPException(400, "Файл слишком большой (макс. 10 МБ)")
    if n.photo_url:
        old = f"/app/static/news/{os.path.basename(n.photo_url)}"
        if os.path.exists(old): os.remove(old)
    stored = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(UPLOAD_DIR, stored), "wb") as f: f.write(contents)
    n.photo_url = f"/static/news/{stored}"
    db.commit()
    return _out(n)


@router.delete("/{news_id}/photo", status_code=204)
def delete_photo(news_id: int, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    n = db.query(News).filter(News.id == news_id).first()
    if not n: raise HTTPException(404)
    if n.photo_url:
        path = f"/app/static/news/{os.path.basename(n.photo_url)}"
        if os.path.exists(path): os.remove(path)
        n.photo_url = None
        db.commit()


@router.delete("/{news_id}", status_code=204)
def delete_news(news_id: int, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    n = db.query(News).filter(News.id == news_id).first()
    if not n: raise HTTPException(404, "Новость не найдена")
    if n.photo_url:
        path = f"/app/static/news/{os.path.basename(n.photo_url)}"
        if os.path.exists(path): os.remove(path)
    db.delete(n); db.commit()


# ─── from-certification ──────────────────────────────────────────────────────

@router.post("/from-certification/{cert_id}", status_code=201)
def news_from_certification(
    cert_id: int,
    data:    ModeBody = ModeBody(),
    db:      Session  = Depends(get_db),
    user:    User     = Depends(require_manager),
):
    from app.models.certification import Certification, CertificationResult
    from app.models.user import Athlete

    cert = db.query(Certification).filter(Certification.id == cert_id).first()
    if not cert: raise HTTPException(404, "Аттестация не найдена")

    existing = db.query(News).filter(News.certification_id == cert_id, News.status.in_(('draft', 'published'))).first()
    if existing: raise HTTPException(400, "Новость об этой аттестации уже опубликована")

    mode         = _resolve_mode(data.mode, cert.date)
    date_str     = cert.date.strftime("%d.%m.%Y") if cert.date else ""
    title        = f"{cert.name} — {date_str}"
    location_str = f" в {cert.location}" if cert.location else ""

    all_results    = db.query(CertificationResult).filter(CertificationResult.certification_id == cert_id).all()
    passed_results = [r for r in all_results if r.passed is True]

    if mode == "preview":
        participants = []
        for r in all_results:
            athlete = db.query(Athlete).filter(Athlete.id == r.athlete_id).first()
            if not athlete: continue
            rank = _rank_label(r.target_gup, r.target_dan)
            participants.append(f"{athlete.full_name} (цель: {rank})")

        body_parts = [
            f"{date_str} в клубе «Тайпан»{location_str} состоится аттестация.",
            "",
            f"Аттестация: {cert.name}",
            f"Дата: {date_str}",
        ]
        if cert.location: body_parts.append(f"Место проведения: {cert.location}")
        body_parts.append("")

        if participants:
            body_parts.append(f"К аттестации готовятся {len(participants)} {_athlete_word(len(participants))}:")
            for p in participants: body_parts.append(f"• {p}")
            body_parts.append("")

        body_parts.append("Желаем всем участникам уверенности и чистого исполнения! Боевой дух и усердие — ключ к новому поясу.")

    else:  # past
        passed_lines = []
        for r in passed_results:
            athlete = db.query(Athlete).filter(Athlete.id == r.athlete_id).first()
            if not athlete: continue
            rank = _rank_label(r.target_gup, r.target_dan)
            passed_lines.append(f"{athlete.full_name} — {rank}")

        total        = len(all_results)
        passed_count = len(passed_lines)

        body_parts = [
            f"{date_str} в клубе «Тайпан»{location_str} прошла аттестация.",
            "",
            f"Аттестация: {cert.name}",
            f"Дата: {date_str}",
        ]
        if cert.location: body_parts.append(f"Место проведения: {cert.location}")
        body_parts.append("")
        body_parts.append(f"К аттестации приступили {total} {_athlete_word(total)}.")
        body_parts.append("")

        if passed_lines:
            body_parts.append(f"Успешно сдали {passed_count} {_athlete_word(passed_count)}:")
            for line in passed_lines: body_parts.append(f"• {line}")
            body_parts.append("")
            body_parts.append("Поздравляем с новыми поясами! Продолжаем расти и совершенствоваться.")
        else:
            body_parts.append("В этот раз никто из участников не подтвердил допуск к следующему поясу. Продолжаем тренироваться!")

    if cert.notes:
        body_parts.append("")
        body_parts.append(cert.notes)

    n = News(title=title, body="\n".join(body_parts), certification_id=cert_id, created_by=user.id,
             status='draft', source='auto_certification_anons')
    db.add(n); db.commit(); db.refresh(n)
    return _out(n)


# ─── from-camp ───────────────────────────────────────────────────────────────

@router.post("/from-camp/{camp_id}", status_code=201)
def news_from_camp(
    camp_id: int,
    data:    ModeBody = ModeBody(),
    db:      Session  = Depends(get_db),
    user:    User     = Depends(require_manager),
):
    from app.models.camp import Camp, CampParticipant
    from app.models.user import Athlete

    camp = db.query(Camp).filter(Camp.id == camp_id).first()
    if not camp: raise HTTPException(404, "Сборы не найдены")

    existing = db.query(News).filter(News.camp_id == camp_id, News.status.in_(('draft', 'published'))).first()
    if existing: raise HTTPException(400, "Новость об этих сборах уже опубликована")

    # Для сборов auto-логика по date_start / date_end
    today = date_type.today()
    if data.mode == "auto":
        if camp.date_end < today:     mode = "past"
        elif camp.date_start > today: mode = "preview"
        else: mode = "past"   # сборы идут сейчас, fallback
    else:
        mode = data.mode

    date_start_str = camp.date_start.strftime("%d.%m.%Y") if camp.date_start else ""
    date_end_str   = camp.date_end.strftime("%d.%m.%Y")   if camp.date_end   else ""
    date_range     = f"{date_start_str} – {date_end_str}" if date_start_str and date_end_str else date_start_str or date_end_str
    title          = f"{camp.name} — {date_range}"
    location_str   = f" в {camp.location}" if camp.location else ""

    participants = db.query(CampParticipant).filter(
        CampParticipant.camp_id == camp_id,
        CampParticipant.status.in_(["confirmed", "paid"])
    ).all()
    names = []
    for p in participants:
        athlete = db.query(Athlete).filter(Athlete.id == p.athlete_id).first()
        if athlete: names.append(athlete.full_name)
    count = len(names)

    if mode == "preview":
        body_parts = [
            f"С {date_range} состоятся учебно-тренировочные сборы{location_str}.",
            "",
            f"Сборы: {camp.name}",
            f"Даты: {date_range}",
        ]
        if camp.location: body_parts.append(f"Место проведения: {camp.location}")
        if camp.price:    body_parts.append(f"Стоимость участия: {camp.price} руб.")
        body_parts.append("")

        if count > 0:
            body_parts.append(f"Уже подтвердили участие {count} {_athlete_word(count)}:")
            for name in names: body_parts.append(f"• {name}")
            body_parts.append("")

        body_parts.append("Сборы — отличная возможность для интенсивной работы над техникой и командного роста. Ждём всех!")

    else:  # past
        body_parts = [
            f"С {date_range} прошли учебно-тренировочные сборы{location_str}.",
            "",
            f"Сборы: {camp.name}",
            f"Даты: {date_range}",
        ]
        if camp.location: body_parts.append(f"Место проведения: {camp.location}")
        body_parts.append("")

        if count > 0:
            body_parts.append(f"В сборах принял участие {count} {_athlete_word(count)} клуба «Тайпан»:")
            for name in names: body_parts.append(f"• {name}")
            body_parts.append("")
            body_parts.append("Интенсивные тренировки прошли продуктивно. Спасибо всем участникам за труд и самоотдачу!")
        else:
            body_parts.append("Информация об участниках уточняется.")

    if camp.notes:
        body_parts.append("")
        body_parts.append(camp.notes)

    n = News(title=title, body="\n".join(body_parts), camp_id=camp_id, created_by=user.id,
             status='draft', source='auto_camp_anons')
    db.add(n); db.commit(); db.refresh(n)
    return _out(n)
