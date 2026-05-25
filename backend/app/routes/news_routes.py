# backend/app/routes/news_routes.py

import os, uuid
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
        "needs_review":     bool(n.needs_review),
        "quality_notes":    n.quality_notes,
    }


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


