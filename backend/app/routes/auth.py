from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User, UserRole, Athlete, Gender

router = APIRouter()

# ─── Схемы ────────────────────────────────────────────────────────────────────
class AthleteData(BaseModel):
    full_name:  str
    birth_date: date          # YYYY-MM-DD
    gender:     Gender
    gup:        Optional[int] = None   # 1-10
    dan:        Optional[int] = None   # 1+

class RegisterRequest(BaseModel):
    full_name:  str           # ФИО пользователя (родителя или спортсмена)
    phone:      str
    password:   str
    email:      Optional[str] = None
    role:       UserRole = UserRole.parent
    athlete:    AthleteData   # Данные спортсмена (обязательно)

class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    role:         str
    full_name:    str

# ─── Регистрация ──────────────────────────────────────────────────────────────
@router.post("/register", response_model=TokenResponse)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    # Запрет регистрации как спортсмен для детей до 11 лет
    if data.role == UserRole.athlete:
        today = date.today()
        b = data.athlete.birth_date
        age = today.year - b.year - ((today.month, today.day) < (b.month, b.day))
        if age < 11:
            raise HTTPException(
                status_code=400,
                detail="Дети до 11 лет могут быть зарегистрированы только родителем"
            )

    # Уникальность телефона
    if db.query(User).filter(User.phone == data.phone).first():
        raise HTTPException(status_code=400, detail="Телефон уже зарегистрирован")

    # Создаём пользователя
    user = User(
        full_name = data.full_name,
        phone     = data.phone,
        email     = data.email,
        password  = hash_password(data.password),
        role      = data.role,
    )
    db.add(user)
    db.flush()  # получаем user.id

    # Определяем группу автоматически
    today = date.today()
    b = data.athlete.birth_date
    age = today.year - b.year - ((today.month, today.day) < (b.month, b.day))
    if age <= 10:
        auto_group = "Младшая группа (6–10 лет)"
    elif age <= 16:
        auto_group = "Старшая группа (11–16 лет)"
    else:
        auto_group = "Взрослые"

    # Создаём запись спортсмена
    athlete = Athlete(
        user_id    = user.id,
        full_name  = data.athlete.full_name,
        birth_date = data.athlete.birth_date,
        gender     = data.athlete.gender,
        gup        = data.athlete.gup,
        dan        = data.athlete.dan,
        group      = auto_group,
    )
    db.add(athlete)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token, role=user.role, full_name=user.full_name)

# ─── Вход ─────────────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone == form.username).first()
    if not user or not verify_password(form.password, user.password):
        raise HTTPException(status_code=401, detail="Неверный телефон или пароль")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Аккаунт заблокирован")
    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token, role=user.role, full_name=user.full_name)
