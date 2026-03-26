# backend/app/routes/insurance_strategy.py
# Эндпоинты для хранения страховок спортсменов и чеклиста стратегии тренера в БД

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import json

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Athlete, UserRole

router = APIRouter(prefix="/insurance-strategy", tags=["Страховка и стратегия"])


# ── СТРАХОВКА ─────────────────────────────────────────────────────────────────

class InsuranceUpdate(BaseModel):
    athlete_id: int
    insurance_expiry: Optional[str] = None  # ISO date "2026-12-31" или null


@router.get("/insurance")
def get_insurance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить даты страховок для всех спортсменов (менеджер/админ)
    или только своих (родитель/спортсмен)."""
    if current_user.role in (UserRole.manager, UserRole.admin):
        athletes = db.query(Athlete).filter(Athlete.is_archived == False).all()
    elif current_user.role in (UserRole.parent, UserRole.athlete):
        athletes = db.query(Athlete).filter(
            Athlete.user_id == current_user.id,
            Athlete.is_archived == False
        ).all()
    else:
        raise HTTPException(403, "Нет доступа")

    return [
        {
            "athlete_id": a.id,
            "full_name": a.full_name,
            "insurance_expiry": str(a.insurance_expiry) if a.insurance_expiry else None
        }
        for a in athletes
    ]


@router.patch("/insurance")
def update_insurance(
    data: InsuranceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить дату страховки спортсмена (тренер/админ или родитель своего ребёнка)."""
    if current_user.role not in (UserRole.manager, UserRole.admin, UserRole.parent, UserRole.athlete):
        raise HTTPException(403, "Нет доступа")
    # Родитель может обновлять только своих детей
    if current_user.role in (UserRole.parent, UserRole.athlete):
        from app.models.user import Athlete as AthleteModel
        allowed = [a.id for a in db.query(AthleteModel).filter(AthleteModel.user_id == current_user.id).all()]
        if data.athlete_id not in allowed:
            raise HTTPException(403, "Нет доступа к этому спортсмену")

    athlete = db.query(Athlete).filter(Athlete.id == data.athlete_id).first()
    if not athlete:
        raise HTTPException(404, "Спортсмен не найден")

    from datetime import date
    if data.insurance_expiry:
        try:
            athlete.insurance_expiry = date.fromisoformat(data.insurance_expiry)
        except ValueError:
            raise HTTPException(400, "Неверный формат даты (ожидается YYYY-MM-DD)")
    else:
        athlete.insurance_expiry = None

    db.commit()
    return {"ok": True, "athlete_id": athlete.id, "insurance_expiry": str(athlete.insurance_expiry) if athlete.insurance_expiry else None}


# ── СТРАТЕГИЯ (чеклист тренера) ───────────────────────────────────────────────

class StrategyUpdate(BaseModel):
    items: list  # JSON-массив объектов [{id, text, done}, ...]


@router.get("/strategy")
def get_strategy(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить чеклист стратегии текущего тренера."""
    if current_user.role not in (UserRole.manager, UserRole.admin):
        raise HTTPException(403, "Только тренер или администратор")

    raw = getattr(current_user, 'strategy_items', None) or '[]'
    try:
        items = json.loads(raw)
    except Exception:
        items = []
    return {"items": items}


@router.put("/strategy")
def update_strategy(
    data: StrategyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Сохранить чеклист стратегии текущего тренера."""
    if current_user.role not in (UserRole.manager, UserRole.admin):
        raise HTTPException(403, "Только тренер или администратор")

    current_user.strategy_items = json.dumps(data.items, ensure_ascii=False)
    db.commit()
    return {"ok": True}
