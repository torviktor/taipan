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
    is_featured:  Optional[bool] = False

class HofUpdate(BaseModel):
    full_name:    Optional[str]  = None
    achievements: Optional[str]  = None
    gup:          Optional[int]  = None
    dan:          Optional[int]  = None
    sort_order:   Optional[int]  = None
    is_featured:  Optional[bool] = None

class HofPosition(BaseModel):
    photo_position: str

class HofSeasonBest(BaseModel):
    type: Optional[str] = None  # "senior" | "junior" | None

class HofSeasonBestClear(BaseModel):
    group: str  # "senior" | "junior"


def _out(h: HallOfFame) -> dict:
    return {
        "id":                  h.id,
        "full_name":           h.full_name,
        "photo_url":           h.photo_url,
        "achievements":        h.achievements,
        "gup":                 h.gup,
        "dan":                 h.dan,
        "sort_order":          h.sort_order,
        "is_featured":         bool(getattr(h, 'is_featured', False)),
        "photo_position":      h.photo_position or "50% 20%",
        "season_best_senior":  bool(getattr(h, 'season_best_senior', False)),
        "season_best_junior":  bool(getattr(h, 'season_best_junior', False)),
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
        is_featured=data.is_featured or False,
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
    if data.gup          is not None: h.gup          = data.gup if data.gup > 0 else None
    if data.dan          is not None: h.dan          = data.dan if data.dan > 0 else None
    if data.sort_order   is not None: h.sort_order   = data.sort_order
    if data.is_featured  is not None: h.is_featured  = data.is_featured
    db.commit()
    db.refresh(h)
    return _out(h)


# ── Лучшие сезона ────────────────────────────────────────────────────────────

@router.get("/season-best")
def get_season_best(db: Session = Depends(get_db)):
    senior = db.query(HallOfFame).filter(HallOfFame.season_best_senior == True).first()
    junior = db.query(HallOfFame).filter(HallOfFame.season_best_junior == True).first()
    return {
        "senior": _out(senior) if senior else None,
        "junior": _out(junior) if junior else None,
    }

@router.post("/season-best/clear")
def clear_season_best(data: HofSeasonBestClear, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    if data.group == "senior":
        db.query(HallOfFame).filter(HallOfFame.season_best_senior == True).update({"season_best_senior": False})
    elif data.group == "junior":
        db.query(HallOfFame).filter(HallOfFame.season_best_junior == True).update({"season_best_junior": False})
    db.commit()
    return {"ok": True}


@router.patch("/{hof_id}/season-best")
def set_season_best(hof_id: int, data: HofSeasonBest, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    h = db.query(HallOfFame).filter(HallOfFame.id == hof_id).first()
    if not h:
        raise HTTPException(404, "Не найдено")
    if data.type == "senior":
        db.query(HallOfFame).filter(HallOfFame.season_best_senior == True).update({"season_best_senior": False})
        h.season_best_senior = True
    elif data.type == "junior":
        db.query(HallOfFame).filter(HallOfFame.season_best_junior == True).update({"season_best_junior": False})
        h.season_best_junior = True
    elif data.type is None:
        h.season_best_senior = False
        h.season_best_junior = False
    db.commit()
    db.refresh(h)
    return _out(h)


# ── Позиция фото ─────────────────────────────────────────────────────────────

@router.patch("/{hof_id}/position")
def update_position(hof_id: int, data: HofPosition, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    h = db.query(HallOfFame).filter(HallOfFame.id == hof_id).first()
    if not h:
        raise HTTPException(404, "Не найдено")
    h.photo_position = data.photo_position
    db.commit()
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
