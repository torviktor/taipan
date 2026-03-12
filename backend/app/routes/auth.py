from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User, UserRole, Athlete, Gender

router = APIRouter()

# ─── Схемы ────────────────────────────────────────────────────────────────────
class AthleteData(BaseModel):
    full_name:  str
    birth_date: date
    gender:     Gender
    gup:        Optional[int] = None
    dan:        Optional[int] = None

class RegisterRequest(BaseModel):
    full_name:  str
    phone:      str
    password:   str
    email:      Optional[str] = None
    role:       UserRole = UserRole.parent
    athlete:    AthleteData

class AddAthleteRequest(BaseModel):
    phone:    str
    password: str
    athlete:  AthleteData

class CheckPhoneResponse(BaseModel):
    exists:        bool
    athletes_count: int
    athletes:      List[str]   # список имён уже зарегистрированных детей

class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    role:         str
    full_name:    str

# ─── Вспомогательная функция расчёта группы ───────────────────────────────────
def calc_group(birth_date: date) -> str:
    today = date.today()
    age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
    if age <= 10:   return "Младшая группа (6–10 лет)"
    elif age <= 16: return "Старшая группа (11–16 лет)"
    else:           return "Взрослые"

def calc_age(birth_date: date) -> int:
    today = date.today()
    return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))

# ─── Проверка телефона (до регистрации) ───────────────────────────────────────
# Фронтенд вызывает этот роут когда пользователь вводит телефон.
# Если телефон уже есть — сообщаем сколько детей уже зарегистрировано.
@router.get("/check-phone/{phone}", response_model=CheckPhoneResponse)
def check_phone(phone: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone == phone).first()
    if not user:
        return CheckPhoneResponse(exists=False, athletes_count=0, athletes=[])
    athletes = db.query(Athlete).filter(Athlete.user_id == user.id).all()
    return CheckPhoneResponse(
        exists=True,
        athletes_count=len(athletes),
        athletes=[a.full_name for a in athletes]
    )

# ─── Регистрация нового пользователя ──────────────────────────────────────────
@router.post("/register", response_model=TokenResponse)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    # Запрет регистрации как спортсмен для детей до 11 лет
    if data.role == UserRole.athlete:
        age = calc_age(data.athlete.birth_date)
        if age < 11:
            raise HTTPException(
                status_code=400,
                detail="Дети до 11 лет могут быть зарегистрированы только родителем"
            )

    # Телефон уже занят
    if db.query(User).filter(User.phone == data.phone).first():
        raise HTTPException(
            status_code=400,
            detail="Телефон уже зарегистрирован. Используйте 'Добавить ребёнка' если хотите добавить второго ребёнка."
        )

    user = User(
        full_name = data.full_name,
        phone     = data.phone,
        email     = data.email,
        password  = hash_password(data.password),
        role      = data.role,
    )
    db.add(user)
    db.flush()

    athlete = Athlete(
        user_id    = user.id,
        full_name  = data.athlete.full_name,
        birth_date = data.athlete.birth_date,
        gender     = data.athlete.gender,
        gup        = data.athlete.gup,
        dan        = data.athlete.dan,
        group      = calc_group(data.athlete.birth_date),
    )
    db.add(athlete)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token, role=user.role, full_name=user.full_name)

# ─── Добавить ребёнка к существующему аккаунту ────────────────────────────────
# Родитель вводит свой телефон + пароль + данные нового ребёнка.
# Проверяем пароль, добавляем спортсмена. Лимит: 5 детей на аккаунт.
@router.post("/add-athlete", response_model=TokenResponse)
def add_athlete(data: AddAthleteRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.phone == data.phone).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if not verify_password(data.password, user.password):
        raise HTTPException(status_code=401, detail="Неверный пароль")

    # Лимит 5 детей
    count = db.query(Athlete).filter(Athlete.user_id == user.id).count()
    if count >= 5:
        raise HTTPException(status_code=400, detail="Достигнут лимит: максимум 5 спортсменов на аккаунт")

    athlete = Athlete(
        user_id    = user.id,
        full_name  = data.athlete.full_name,
        birth_date = data.athlete.birth_date,
        gender     = data.athlete.gender,
        gup        = data.athlete.gup,
        dan        = data.athlete.dan,
        group      = calc_group(data.athlete.birth_date),
    )
    db.add(athlete)
    db.commit()

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
