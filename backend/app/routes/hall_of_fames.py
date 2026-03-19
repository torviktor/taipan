from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.core.database import get_db
from app.core.security import get_current_user, require_manager
from app.models.hall_of_fame import HallOfFame
from app.models.user import User
import os, shutil, uuid

router = APIRouter(prefix="/hall-of-fame", tags=["Зал Славы"])

UPLOAD_DIR = "/app/static/hall-of-fame"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ── Схемы ─────────────────────────────────────────────────────────────────────

class HofCreate(BaseModel):
    full_name:    str
    achievements: Optional[str] = None
    gup:          Optional[int] = None
    dan:          Optional[int] = None
    sort_order:   Optional[int] = 0

class HofUpdate(BaseModel):
    full_name:    Optional[str] = None
    achievements: Optional[str] = None
    gup:          Optional[int] = None
    dan:          Optional[int] = None
    sort_order:   Optional[int] = None


def _out(h: HallOfFame) -> dict:
    return {
        "id":           h.id,
        "full_name":    h.full_name,
        "photo_url":    h.photo_url,
        "achievements": h.achievements,
        "gup":          h.gup,
        "dan":          h.dan,
        "sort_order":   h.sort_order,
    }


# ── Публичный список (без авторизации) ────────────────────────────────────────

@router.get("")
def list_hof(db: Session = Depends(get_db)):
    items = db.query(HallOfFame).order_by(HallOfFame.sort_order, HallOfFame.id).all()
    return [_out(h) for h in items]


# ── Создать ───────────────────────────────────────────────────────────────────

@router.post("")
def create_hof(data: HofCreate, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    h = HallOfFame(
        full_name=data.full_name,
        achievements=data.achievements,
        gup=data.gup,
        dan=data.dan,
        sort_order=data.sort_order or 0,
    )
    db.add(h)
    db.commit()
    db.refresh(h)
    return _out(h)


# ── Обновить ──────────────────────────────────────────────────────────────────

@router.patch("/{hof_id}")
def update_hof(hof_id: int, data: HofUpdate, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    h = db.query(HallOfFame).filter(HallOfFame.id == hof_id).first()
    if not h:
        raise HTTPException(404, "Не найдено")
    if data.full_name    is not None: h.full_name    = data.full_name
    if data.achievements is not None: h.achievements = data.achievements
    if data.gup          is not None: h.gup          = data.gup
    if data.dan          is not None: h.dan          = data.dan
    if data.sort_order   is not None: h.sort_order   = data.sort_order
    db.commit()
    db.refresh(h)
    return _out(h)


# ── Загрузить фото ────────────────────────────────────────────────────────────

@router.post("/{hof_id}/photo")
def upload_photo(
    hof_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_manager)
):
    h = db.query(HallOfFame).filter(HallOfFame.id == hof_id).first()
    if not h:
        raise HTTPException(404, "Не найдено")

    # Удаляем старое фото
    if h.photo_url:
        old_path = f"/app/static{h.photo_url.replace('/static', '')}"
        if os.path.exists(old_path):
            os.remove(old_path)

    ext = os.path.splitext(file.filename)[1].lower() or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)

    h.photo_url = f"/static/hall-of-fame/{filename}"
    db.commit()
    return _out(h)


# ── Удалить ───────────────────────────────────────────────────────────────────

@router.delete("/{hof_id}", status_code=204)
def delete_hof(hof_id: int, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    h = db.query(HallOfFame).filter(HallOfFame.id == hof_id).first()
    if not h:
        raise HTTPException(404, "Не найдено")
    if h.photo_url:
        old_path = f"/app/static{h.photo_url.replace('/static', '')}"
        if os.path.exists(old_path):
            os.remove(old_path)
    db.delete(h)
    db.commit()
