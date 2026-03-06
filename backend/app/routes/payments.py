from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from datetime import datetime
from app.core.database import get_db
from app.core.security import get_current_user, require_manager
from app.models.user import User, Payment, PaymentStatus

router = APIRouter()

class PaymentOut(BaseModel):
    id:          int
    amount:      float
    description: str
    status:      str
    created_at:  datetime
    paid_at:     datetime | None
    class Config:
        from_attributes = True

class PaymentCreate(BaseModel):
    user_id:     int
    amount:      float
    description: str

# ─── История платежей текущего пользователя ───────────────────────────────────
@router.get("/my", response_model=List[PaymentOut], summary="Мои платежи")
def my_payments(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Payment).filter(Payment.user_id == current_user.id).order_by(Payment.created_at.desc()).all()

# ─── Создать платёж вручную (менеджер фиксирует оплату) ──────────────────────
@router.post("/", response_model=PaymentOut, summary="Зафиксировать оплату (менеджер)")
def create_payment(
    data: PaymentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_manager)
):
    payment = Payment(
        user_id     = data.user_id,
        amount      = data.amount,
        description = data.description,
        status      = PaymentStatus.paid,
        paid_at     = datetime.utcnow()
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment

# ─── Все платежи (менеджер) ───────────────────────────────────────────────────
@router.get("/", response_model=List[PaymentOut], summary="Все платежи (менеджер)")
def all_payments(db: Session = Depends(get_db), _: User = Depends(require_manager)):
    return db.query(Payment).order_by(Payment.created_at.desc()).all()
