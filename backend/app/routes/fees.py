import io
from datetime import datetime, date as date_type
from typing import Optional

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
    period: date_type
    deadline: date_type
    amount_due: float


class PayBody(BaseModel):
    amount_paid: float
    note: Optional[str] = None


# ── Хелперы ───────────────────────────────────────────────────────────────────

STATUS_ORDER = {
    FeeStatus.overdue: 0,
    FeeStatus.due: 1,
    FeeStatus.pending: 2,
    FeeStatus.paid: 3,
}

MONTH_RU = {
    1: "январь", 2: "февраль", 3: "март", 4: "апрель",
    5: "май", 6: "июнь", 7: "июль", 8: "август",
    9: "сентябрь", 10: "октябрь", 11: "ноябрь", 12: "декабрь",
}


def period_label(d: date_type) -> str:
    return f"{MONTH_RU.get(d.month, str(d.month))} {d.year}"


def fee_to_dict(f: MonthlyFee) -> dict:
    status = f.computed_status
    amount_due = float(f.amount_due or 0)
    amount_paid = float(f.amount_paid or 0)
    debt = max(0.0, amount_due - amount_paid)
    athlete = f.athlete
    parent = athlete.user if athlete else None
    return {
        "id": f.id,
        "athlete_id": f.athlete_id,
        "athlete_name": athlete.full_name if athlete else "",
        "athlete_group": (athlete.group or athlete.auto_group) if athlete else "",
        "parent_name": parent.full_name if parent else "",
        "parent_phone": parent.phone if parent else "",
        "period": str(f.period),
        "amount_due": amount_due,
        "amount_paid": amount_paid,
        "debt": debt,
        "deadline": str(f.deadline_obj.deadline) if f.deadline_obj else None,
        "status": status.value,
        "deadline_id": f.deadline_id,
        "note": f.note,
        "paid_at": f.paid_at.isoformat() if f.paid_at else None,
    }


# ── Дедлайны ──────────────────────────────────────────────────────────────────

@router.get("/deadlines")
def list_deadlines(
    db: Session = Depends(get_db),
    _: User = Depends(require_manager),
):
    rows = db.query(FeeDeadline).order_by(FeeDeadline.period.desc()).all()
    return [
        {
            "id": d.id,
            "period": str(d.period),
            "deadline": str(d.deadline),
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
    # Check duplicate
    existing = db.query(FeeDeadline).filter(FeeDeadline.period == body.period).first()
    if existing:
        raise HTTPException(400, "Дедлайн для этого периода уже существует")

    deadline = FeeDeadline(
        period=body.period,
        deadline=body.deadline,
        amount_due=body.amount_due,
        created_by=current_user.id,
    )
    db.add(deadline)
    db.flush()  # get deadline.id

    # Auto-create fees for all active athletes
    athletes = db.query(Athlete).filter(Athlete.is_archived == False).all()
    plabel = period_label(body.period)
    deadline_str = body.deadline.strftime("%d.%m.%Y")

    for athlete in athletes:
        fee = MonthlyFee(
            athlete_id=athlete.id,
            deadline_id=deadline.id,
            period=body.period,
            amount_due=body.amount_due,
            amount_paid=0,
        )
        db.add(fee)

        # Notify parent
        notif = Notification(
            user_id=athlete.user_id,
            type="fee",
            title=f"Клубный взнос за {plabel}",
            body=f"Внесите оплату до {deadline_str}. Сумма: {body.amount_due:.0f} руб.",
        )
        db.add(notif)

    db.commit()
    db.refresh(deadline)
    return {
        "id": deadline.id,
        "period": str(deadline.period),
        "deadline": str(deadline.deadline),
        "amount_due": float(deadline.amount_due),
    }


# ── Все взносы (admin/manager) ─────────────────────────────────────────────────

@router.get("/")
def list_fees(
    db: Session = Depends(get_db),
    _: User = Depends(require_manager),
):
    fees = db.query(MonthlyFee).all()
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

    # Notify parent
    athlete = fee.athlete
    if athlete:
        plabel = period_label(fee.period)
        notif = Notification(
            user_id=athlete.user_id,
            type="fee",
            title=f"Взнос за {plabel} принят",
            body=f"Получено: {body.amount_paid:.0f} руб. из {float(fee.amount_due):.0f} руб.",
        )
        db.add(notif)

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
    fees = db.query(MonthlyFee).filter(MonthlyFee.athlete_id.in_(athlete_ids)).all()
    result = [fee_to_dict(f) for f in fees]
    result.sort(key=lambda x: (x["period"] or "", STATUS_ORDER.get(FeeStatus(x["status"]), 99)))
    return result


# ── Сводка ────────────────────────────────────────────────────────────────────

@router.get("/summary")
def summary(
    period: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_manager),
):
    query = db.query(MonthlyFee)
    if period:
        try:
            period_date = date_type.fromisoformat(period)
            query = query.filter(MonthlyFee.period == period_date)
        except ValueError:
            pass

    fees = query.all()
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
        from openpyxl.styles import Font, PatternFill, Alignment
    except ImportError:
        raise HTTPException(500, "openpyxl не установлен")

    query = db.query(MonthlyFee)
    if period:
        try:
            period_date = date_type.fromisoformat(period)
            query = query.filter(MonthlyFee.period == period_date)
        except ValueError:
            pass

    fees = query.all()
    dicts = [fee_to_dict(f) for f in fees]

    STATUS_RU = {
        "paid": "Оплачено",
        "due": "К оплате",
        "overdue": "Просрочено",
        "pending": "Ожидание",
    }

    wb = openpyxl.Workbook()

    # Sheet 1: все взносы
    ws1 = wb.active
    ws1.title = "Все взносы"
    headers = ["Спортсмен", "Группа", "Родитель", "Телефон", "Период", "К оплате", "Внесено", "Долг", "Дедлайн", "Статус", "Примечание"]
    ws1.append(headers)
    for cell in ws1[1]:
        cell.font = Font(bold=True)

    for d in dicts:
        ws1.append([
            d["athlete_name"],
            d["athlete_group"],
            d["parent_name"],
            d["parent_phone"],
            d["period"],
            d["amount_due"],
            d["amount_paid"],
            d["debt"],
            d["deadline"],
            STATUS_RU.get(d["status"], d["status"]),
            d["note"] or "",
        ])

    # Sheet 2: долги
    ws2 = wb.create_sheet("Долги")
    ws2.append(headers)
    for cell in ws2[1]:
        cell.font = Font(bold=True)

    for d in dicts:
        if d["status"] in ("overdue", "due") and d["debt"] > 0:
            ws2.append([
                d["athlete_name"],
                d["athlete_group"],
                d["parent_name"],
                d["parent_phone"],
                d["period"],
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

    filename = f"fees_{period or 'all'}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
