from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.core.database import get_db
from app.core.security import get_current_user, require_manager
from app.models.user import User, Payment, PaymentStatus

# ─── USERS ────────────────────────────────────────────────────────────────────
router = APIRouter()

class UserOut(BaseModel):
    id:         int
    full_name:  str
    phone:      str
    email:      Optional[str]
    age:        Optional[int]
    role:       str
    created_at: datetime
    class Config:
        from_attributes = True

@router.get("/me", response_model=UserOut, summary="Мой профиль")
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/", response_model=List[UserOut], summary="Все ученики (менеджер)")
def get_all_users(db: Session = Depends(get_db), _: User = Depends(require_manager)):
    return db.query(User).order_by(User.created_at.desc()).all()
