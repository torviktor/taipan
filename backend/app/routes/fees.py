import io
from datetime import datetime, date as date_type
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Athlete
from app.models.fees import FeeDeadline, MonthlyFee, FeeStatus
from app.models.certification import Notification

router = APIRouter()


def require_manager(u: User = Depends(get_current_user)) -> User:
    if u.role not in ("manager", "admin"):
        raise HTTPException(403, "Недостаточно прав")
    return u


# ── Схемы ─────────────────────────────────────────────────────────────────────

class DeadlineCreate(BaseModel):
    day_of_month: int   # 1–28
    amount_due: float


class PayBody(BaseModel):
    amount_paid: float
    note: Optional[str] = None


# ── Константы ─────────────────────────────────────────────────────────────────

MONTHS_RU = {
    1: 'Январь', 2: 'Февраль', 3: 'Март', 4: 'Апрель',
    5: 'Май', 6: 'Июнь', 7: 'Июль', 8: 'Август',
    9: 'Сентябрь', 10: 'Октябрь', 11: 'Ноябрь', 12: 'Декабрь',
}

MONTHS_RU_GEN = {
    1: "январь", 2: "февраль", 3: "март", 4: "апрель",
    5: "май", 6: "июнь", 7: "июль", 8: "август",
    9: "сентябрь", 10: "октябрь", 11: "ноябрь", 12: "декабрь",
}

STATUS_ORDER = {
    FeeStatus.overdue: 0,
    FeeStatus.due: 1,
    FeeStatus.pending: 2,
    FeeStatus.paid: 3,
}


def period_label(d: date_type) -> str:
    """Для уведомлений: 'январь 2026'"""
    return f"{MONTHS_RU_GEN.get(d.month, str(d.month))} {d.year}"


def period_label_nom(d: date_type) -> str:
    """Для отображения: 'Январь 2026'"""
    return f"{MONTHS_RU.get(d.month, str(d.month))} {d.year}"


def fee_to_dict(f: MonthlyFee) -> dict:
    status = f.computed_status
    amount_due = float(f.amount_due or 0)
    amount_paid = float(f.amount_paid or 0)
    debt = max(0.0, amount_due - amount_paid)
    athlete = f.athlete
    parent = athlete.user if athlete else None
    period = f.period
    return {
        "id": f.id,
        "athlete_id": f.athlete_id,
        "athlete_name": athlete.full_name if athlete else "",
        "athlete_group": (athlete.group or athlete.auto_group) if athlete else "",
        "parent_name": parent.full_name if parent else "",
        "parent_phone": parent.phone if parent else "",
        "period": str(period),
        "period_label": period_label_nom(period) if period else "",
        "amount_due": amount_due,
        "amount_paid": amount_paid,
        "debt": debt,
        "deadline": str(f.deadline_obj.deadline) if f.deadline_obj else None,
        "status": status.value,
        "deadline_id": f.deadline_id,
        "note": f.note,
        "paid_at": f.paid_at.isoformat() if f.paid_at else None,
    }


# ── Генерация взносов ──────────────────────────────────────────────────────────

def generate_monthly_fees(db: Session, notify: bool = True) -> int:
    """
    Создать MonthlyFee записи для всех активных спортсменов на текущий месяц.
    Вызывается при сохранении настройки и планировщиком каждый месяц.
    """
    today = date_type.today()
    period = date_type(today.year, today.month, 1)

    config = db.query(FeeDeadline).order_by(FeeDeadline.created_at.desc()).first()
    if not config:
        return 0

    athletes = db.query(Athlete).filter(Athlete.is_archived == False).all()

    new_athlete_ids = []
    for athlete in athletes:
        exists = db.query(MonthlyFee).filter(
            MonthlyFee.athlete_id == athlete.id,
            MonthlyFee.period == period,
        ).first()
        if exists:
            continue
        db.add(MonthlyFee(
            athlete_id=athlete.id,
            deadline_id=config.id,
            period=period,
            amount_due=config.amount_due,
            amount_paid=0,
        ))
        new_athlete_ids.append(athlete.id)

    db.commit()

    if notify and new_athlete_ids:
        deadline_str = config.deadline.strftime("%d.%m.%Y")
        plabel = period_label(period)
        amount_str = f"{float(config.amount_due):.0f}"
        new_ids_set = set(new_athlete_ids)
        for athlete in athletes:
            if athlete.id in new_ids_set and athlete.user_id:
                db.add(Notification(
                    user_id=athlete.user_id,
                    type="fee",
                    title=f"Клубный взнос за {plabel}",
                    body=f"Внесите оплату до {deadline_str}. Сумма: {amount_str} руб.",
                ))
        db.commit()

    return len(new_athlete_ids)


# ── Дедлайны ──────────────────────────────────────────────────────────────────

@router.get("/deadlines")
def list_deadlines(
    db: Session = Depends(get_db),
    _: User = Depends(require_manager),
):
    rows = db.query(FeeDeadline).order_by(FeeDeadline.created_at.desc()).all()
    return [
        {
            "id": d.id,
            "day_of_month": d.deadline.day,
            "amount_due": float(d.amount_due),
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in rows
    ]


@router.post("/deadlines", status_code=201)
def create_deadline(
    body: DeadlineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    if not 1 <= body.day_of_month <= 28:
        raise HTTPException(400, "День месяца должен быть от 1 до 28")

    today = date_type.today()
    period = date_type(today.year, today.month, 1)
    current_deadline = date_type(today.year, today.month, body.day_of_month)

    # Upsert: обновляем существующую настройку или создаём новую
    config = db.query(FeeDeadline).order_by(FeeDeadline.created_at.desc()).first()
    if config:
        config.period = period
        config.deadline = current_deadline
        config.amount_due = body.amount_due
        db.commit()
        db.refresh(config)
    else:
        config = FeeDeadline(
            period=period,
            deadline=current_deadline,
            amount_due=body.amount_due,
            created_by=current_user.id,
        )
        db.add(config)
        db.commit()
        db.refresh(config)

    created = generate_monthly_fees(db, notify=True)

    return {
        "day_of_month": config.deadline.day,
        "amount_due": float(config.amount_due),
        "athletes_count": created,
        "message": "Настройка сохранена",
    }


# ── Все взносы (admin/manager) ─────────────────────────────────────────────────

@router.get("/")
def list_fees(
    period: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_manager),
):
    today = date_type.today()
    if period:
        try:
            period_date = date_type.fromisoformat(period)
        except ValueError:
            period_date = date_type(today.year, today.month, 1)
    else:
        period_date = date_type(today.year, today.month, 1)

    fees = db.query(MonthlyFee).filter(MonthlyFee.period == period_date).all()
    result = [fee_to_dict(f) for f in fees]
    result.sort(key=lambda x: STATUS_ORDER.get(FeeStatus(x["status"]), 99))
    return result


# ── Внести оплату ─────────────────────────────────────────────────────────────

@router.patch("/{fee_id}/pay")
def pay_fee(
    fee_id: int,
    body: PayBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    fee = db.query(MonthlyFee).filter(MonthlyFee.id == fee_id).first()
    if not fee:
        raise HTTPException(404, "Взнос не найден")

    fee.amount_paid = body.amount_paid
    fee.recorded_by = current_user.id
    if body.note is not None:
        fee.note = body.note
    if float(body.amount_paid) >= float(fee.amount_due):
        fee.paid_at = datetime.utcnow()
    else:
        fee.paid_at = None

    athlete = fee.athlete
    if athlete and athlete.user_id:
        plabel = period_label(fee.period)
        db.add(Notification(
            user_id=athlete.user_id,
            type="fee",
            title=f"Взнос за {plabel} принят",
            body=f"Получено: {body.amount_paid:.0f} руб. из {float(fee.amount_due):.0f} руб.",
        ))

    db.commit()
    db.refresh(fee)
    return fee_to_dict(fee)


# ── Мои взносы (родитель/спортсмен) ───────────────────────────────────────────

@router.get("/my")
def my_fees(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    athletes = db.query(Athlete).filter(
        Athlete.user_id == current_user.id,
        Athlete.is_archived == False,
    ).all()
    athlete_ids = [a.id for a in athletes]
    if not athlete_ids:
        return []

    today = date_type.today()
    y, m = today.year, today.month - 6
    if m <= 0:
        y -= 1
        m += 12
    since = date_type(y, m, 1)

    fees = db.query(MonthlyFee).filter(
        MonthlyFee.athlete_id.in_(athlete_ids),
        MonthlyFee.period >= since,
    ).all()
    result = [fee_to_dict(f) for f in fees]
    result.sort(key=lambda x: x["period"] or "", reverse=True)
    return result


# ── Сводка ────────────────────────────────────────────────────────────────────

@router.get("/summary")
def summary(
    period: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_manager),
):
    today = date_type.today()
    if period:
        try:
            period_date = date_type.fromisoformat(period)
        except ValueError:
            period_date = date_type(today.year, today.month, 1)
    else:
        period_date = date_type(today.year, today.month, 1)

    fees = db.query(MonthlyFee).filter(MonthlyFee.period == period_date).all()
    total_due = sum(float(f.amount_due or 0) for f in fees)
    total_paid = sum(float(f.amount_paid or 0) for f in fees)
    total_debt = max(0.0, total_due - total_paid)

    statuses = [f.computed_status for f in fees]
    return {
        "total_due": total_due,
        "total_paid": total_paid,
        "total_debt": total_debt,
        "count_paid": statuses.count(FeeStatus.paid),
        "count_due": statuses.count(FeeStatus.due),
        "count_overdue": statuses.count(FeeStatus.overdue),
        "count_pending": statuses.count(FeeStatus.pending),
    }


# ── Экспорт xlsx ──────────────────────────────────────────────────────────────

@router.get("/export")
def export_fees(
    period: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_manager),
):
    try:
        import openpyxl
        from openpyxl.styles import Font
    except ImportError:
        raise HTTPException(500, "openpyxl не установлен")

    today = date_type.today()
    if period:
        try:
            period_date = date_type.fromisoformat(period)
        except ValueError:
            period_date = date_type(today.year, today.month, 1)
    else:
        period_date = date_type(today.year, today.month, 1)

    fees = db.query(MonthlyFee).filter(MonthlyFee.period == period_date).all()
    dicts = [fee_to_dict(f) for f in fees]

    STATUS_RU = {
        "paid": "Оплачено",
        "due": "К оплате",
        "overdue": "Просрочено",
        "pending": "Ожидание",
    }

    wb = openpyxl.Workbook()

    ws1 = wb.active
    ws1.title = "Все взносы"
    col_headers = ["Спортсмен", "Группа", "Родитель", "Телефон", "Период", "К оплате", "Внесено", "Долг", "Дедлайн", "Статус", "Примечание"]
    ws1.append(col_headers)
    for cell in ws1[1]:
        cell.font = Font(bold=True)

    for d in dicts:
        ws1.append([
            d["athlete_name"],
            d["athlete_group"],
            d["parent_name"],
            d["parent_phone"],
            d["period_label"],
            d["amount_due"],
            d["amount_paid"],
            d["debt"],
            d["deadline"],
            STATUS_RU.get(d["status"], d["status"]),
            d["note"] or "",
        ])

    ws2 = wb.create_sheet("Долги")
    ws2.append(col_headers)
    for cell in ws2[1]:
        cell.font = Font(bold=True)

    for d in dicts:
        if d["status"] in ("overdue", "due") and d["debt"] > 0:
            ws2.append([
                d["athlete_name"],
                d["athlete_group"],
                d["parent_name"],
                d["parent_phone"],
                d["period_label"],
                d["amount_due"],
                d["amount_paid"],
                d["debt"],
                d["deadline"],
                STATUS_RU.get(d["status"], d["status"]),
                d["note"] or "",
            ])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    filename = f"взносы_{period or 'текущий'}.xlsx"
    resp_headers = {"Content-Disposition": f"attachment; filename*=UTF-8''{quote(filename)}"}
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=resp_headers,
    )
