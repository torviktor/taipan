from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from app.core.database import get_db
from app.core.security import get_current_user, require_manager, hash_password
from app.models.user import User, Athlete, Gender

router = APIRouter()

# ─── Схемы ────────────────────────────────────────────────────────────────────
class UserOut(BaseModel):
    id:         int
    full_name:  str
    phone:      str
    email:      Optional[str]
    role:       str
    created_at: datetime
    class Config:
        from_attributes = True

class AthleteOut(BaseModel):
    id:           int
    user_id:      int
    full_name:    str
    birth_date:   date
    gender:       Gender
    gup:          Optional[int]
    dan:          Optional[int]
    weight:       Optional[float]
    group:        Optional[str]
    age:          Optional[int]
    auto_group:   Optional[str]
    parent_name:  Optional[str]
    parent_phone: Optional[str]
    class Config:
        from_attributes = True

class AthleteUpdate(BaseModel):
    weight: Optional[float] = None
    group:  Optional[str]   = None
    gup:    Optional[int]   = None
    dan:    Optional[int]   = None

class ResetPasswordRequest(BaseModel):
    new_password: str

# ─── Вспомогательная функция ──────────────────────────────────────────────────
def build_athlete_out(a: Athlete) -> AthleteOut:
    today = date.today()
    b = a.birth_date
    age = today.year - b.year - ((today.month, today.day) < (b.month, b.day))
    return AthleteOut(
        id=a.id, user_id=a.user_id, full_name=a.full_name,
        birth_date=a.birth_date, gender=a.gender,
        gup=a.gup, dan=a.dan,
        weight=float(a.weight) if a.weight else None,
        group=a.group, age=age, auto_group=a.auto_group,
        parent_name=a.user.full_name, parent_phone=a.user.phone,
    )

# ─── Мой профиль ──────────────────────────────────────────────────────────────
@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# ─── МОИ спортсмены — только свои дети текущего пользователя ─────────────────
# Этот роут используется в личном кабинете родителя.
# Возвращает только спортсменов привязанных к текущему аккаунту.
@router.get("/my-athletes", response_model=List[AthleteOut])
def get_my_athletes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    athletes = db.query(Athlete).filter(Athlete.user_id == current_user.id).all()
    return [build_athlete_out(a) for a in athletes]

# ─── Все пользователи (только admin/manager) ──────────────────────────────────
@router.get("/", response_model=List[UserOut])
def get_all_users(db: Session = Depends(get_db), _: User = Depends(require_manager)):
    return db.query(User).order_by(User.created_at.desc()).all()

# ─── Все спортсмены (только admin/manager) ────────────────────────────────────
@router.get("/athletes", response_model=List[AthleteOut])
def get_athletes(db: Session = Depends(get_db), _: User = Depends(require_manager)):
    athletes = db.query(Athlete).join(User, Athlete.user_id == User.id).all()
    return [build_athlete_out(a) for a in athletes]

# ─── Обновить спортсмена (только admin/manager) ───────────────────────────────
@router.patch("/athletes/{athlete_id}", response_model=AthleteOut)
def update_athlete(
    athlete_id: int, data: AthleteUpdate,
    db: Session = Depends(get_db), _: User = Depends(require_manager)
):
    a = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Спортсмен не найден")
    if data.weight is not None: a.weight = data.weight
    if data.group  is not None: a.group  = data.group
    if data.gup    is not None: a.gup    = data.gup
    if data.dan    is not None: a.dan    = data.dan
    db.commit()
    db.refresh(a)
    return build_athlete_out(a)

# ─── Удалить спортсмена (только admin/manager) ────────────────────────────────
@router.delete("/athletes/{athlete_id}")
def delete_athlete(
    athlete_id: int,
    db: Session = Depends(get_db), _: User = Depends(require_manager)
):
    a = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Спортсмен не найден")
    db.delete(a)
    db.commit()
    return {"ok": True}

# ─── Сброс пароля (только admin/manager) ─────────────────────────────────────
@router.patch("/{user_id}/reset-password")
def reset_password(
    user_id: int, data: ResetPasswordRequest,
    db: Session = Depends(get_db), _: User = Depends(require_manager)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if len(data.new_password) < 4:
        raise HTTPException(status_code=400, detail="Пароль минимум 4 символа")
    user.password = hash_password(data.new_password)
    db.commit()
    return {"ok": True}
