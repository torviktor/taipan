from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User, UserRole

router = APIRouter()

# ─── Схемы ────────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    full_name: str
    phone: str
    password: str
    email: Optional[str] = None
    age: Optional[int] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    full_name: str

# ─── Регистрация ──────────────────────────────────────────────────────────────
@router.post("/register", response_model=TokenResponse, summary="Регистрация нового ученика")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    # Проверяем уникальность телефона
    if db.query(User).filter(User.phone == data.phone).first():
        raise HTTPException(status_code=400, detail="Телефон уже зарегистрирован")

    user = User(
        full_name = data.full_name,
        phone     = data.phone,
        email     = data.email,
        age       = data.age,
        password  = hash_password(data.password),
        role      = UserRole.student,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token, role=user.role, full_name=user.full_name)

# ─── Вход ─────────────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse, summary="Вход по телефону и паролю")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone == form.username).first()
    if not user or not verify_password(form.password, user.password):
        raise HTTPException(status_code=401, detail="Неверный телефон или пароль")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Аккаунт заблокирован")

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token, role=user.role, full_name=user.full_name)