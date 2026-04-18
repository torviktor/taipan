import io
from datetime import datetime, date as date_type
from typing import Optional, List
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User, Athlete
from app.models.fees import FeeDeadline, MonthlyFee, FeeStatus, FeeConfig, AthleteFeePeriod
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


class SubsidizedBody(BaseModel):
    is_subsidized: bool


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
    FeeStatus.subsidized: 4,
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
        "is_subsidized": bool(f.is_subsidized),
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

    prev_month = date_type(period.year - 1, 12, 1) if period.month == 1 \
                 else date_type(period.year, period.month - 1, 1)

    new_athlete_ids = []
    for athlete in athletes:
        exists = db.query(MonthlyFee).filter(
            MonthlyFee.athlete_id == athlete.id,
            MonthlyFee.period == period,
        ).first()
        if exists:
            continue
        prev_fee = db.query(MonthlyFee).filter(
            MonthlyFee.athlete_id == athlete.id,
            MonthlyFee.period == prev_month,
        ).first()
        db.add(MonthlyFee(
            athlete_id=athlete.id,
            deadline_id=config.id,
            period=period,
            amount_due=config.amount_due,
            amount_paid=0,
            is_subsidized=bool(prev_fee.is_subsidized) if prev_fee else False,
        ))
        new_athlete_ids.append(athlete.id)

    db.commit()

    if notify and new_athlete_ids:
        deadline_str = config.deadline.strftime("%d.%m.%Y")
        plabel = period_label(period)
        amount_str = f"{float(config.amount_due):.0f}"
        new_ids_set = set(new_athlete_ids)
        notif_title = f"Клубный взнос за {plabel}"
        notif_body = f"Внесите оплату до {deadline_str}. Сумма: {amount_str} руб."
        for athlete in athletes:
            if athlete.id in new_ids_set and athlete.user_id:
                db.add(Notification(
                    user_id=athlete.user_id,
                    type="fee",
                    title=notif_title,
                    body=notif_body,
                ))
        db.commit()
        from app.services.notifications import send_telegram_to_user
        for athlete in athletes:
            if athlete.id in new_ids_set and athlete.user_id:
                send_telegram_to_user(athlete.user_id, notif_title, notif_body, db)

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
    fee_notif_data = None
    if athlete and athlete.user_id:
        plabel = period_label(fee.period)
        notif_title = f"Взнос за {plabel} принят"
        notif_body = f"Получено: {body.amount_paid:.0f} руб. из {float(fee.amount_due):.0f} руб."
        db.add(Notification(
            user_id=athlete.user_id,
            type="fee",
            title=notif_title,
            body=notif_body,
        ))
        fee_notif_data = (athlete.user_id, notif_title, notif_body)

    db.commit()
    db.refresh(fee)
    if fee_notif_data:
        from app.services.notifications import send_telegram_to_user
        send_telegram_to_user(*fee_notif_data, db)
    return fee_to_dict(fee)


# ── Статус бюджетника ─────────────────────────────────────────────────────────

@router.patch("/{fee_id}/subsidized")
def set_subsidized(
    fee_id: int,
    body: SubsidizedBody,
    db: Session = Depends(get_db),
    _: User = Depends(require_manager),
):
    fee = db.query(MonthlyFee).filter(MonthlyFee.id == fee_id).first()
    if not fee:
        raise HTTPException(404, "Взнос не найден")
    fee.is_subsidized = body.is_subsidized
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
        "subsidized": "Бюджетник",
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
        if d["status"] in ("overdue", "due") and d["debt"] > 0 and not d["is_subsidized"]:
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


# ── Автоуведомление должников (вызывается планировщиком) ──────────────────────

def notify_overdue(db: Session) -> int:
    """
    Найти MonthlyFee где дедлайн был ровно 7 дней назад (первый день overdue).
    Отправить уведомление родителю/спортсмену.
    """
    from datetime import timedelta
    today = date_type.today()
    overdue_start = today - timedelta(days=7)  # дедлайн был 7 дней назад

    fees = (
        db.query(MonthlyFee)
        .join(FeeDeadline, MonthlyFee.deadline_id == FeeDeadline.id)
        .options(
            joinedload(MonthlyFee.athlete),
        )
        .filter(
            FeeDeadline.deadline == overdue_start,
            MonthlyFee.amount_paid < MonthlyFee.amount_due,
            MonthlyFee.is_subsidized != True,
        )
        .all()
    )

    sent = 0
    tg_notifs = []
    for fee in fees:
        athlete = fee.athlete
        if not athlete or not athlete.user_id:
            continue
        month_label = period_label(fee.period)
        debt = float(fee.amount_due or 0) - float(fee.amount_paid or 0)
        notif_body = f"Взнос за {month_label} не внесён. Долг: {debt:.0f} руб. Пожалуйста, свяжитесь с тренером."
        db.add(Notification(
            user_id=athlete.user_id,
            type="fee",
            title="Просрочен взнос",
            body=notif_body,
            link_id=fee.id,
        ))
        tg_notifs.append((athlete.user_id, "Просрочен взнос", notif_body))
        sent += 1

    db.commit()
    from app.services.notifications import send_telegram_to_user
    for uid, tl, bd in tg_notifs:
        send_telegram_to_user(uid, tl, bd, db)
    return sent


# ── Уведомить должников вручную ───────────────────────────────────────────────

@router.post("/notify-overdue")
def notify_overdue_manual(
    db: Session = Depends(get_db),
    _: User = Depends(require_manager),
):
    today = date_type.today()
    period_date = date_type(today.year, today.month, 1)

    fees = (
        db.query(MonthlyFee)
        .join(FeeDeadline, MonthlyFee.deadline_id == FeeDeadline.id)
        .options(joinedload(MonthlyFee.athlete))
        .filter(
            MonthlyFee.period == period_date,
            MonthlyFee.amount_paid < MonthlyFee.amount_due,
            FeeDeadline.deadline <= today,
            MonthlyFee.is_subsidized != True,
        )
        .all()
    )

    sent = 0
    tg_notifs = []
    for fee in fees:
        athlete = fee.athlete
        if not athlete or not athlete.user_id:
            continue
        status = fee.computed_status
        if status not in (FeeStatus.due, FeeStatus.overdue):
            continue
        month_label = period_label(fee.period)
        debt = float(fee.amount_due or 0) - float(fee.amount_paid or 0)
        deadline_str = fee.deadline_obj.deadline.strftime("%d.%m.%Y") if fee.deadline_obj else ""
        if status == FeeStatus.due:
            body = f"Внесите взнос за {month_label}. Сумма: {debt:.0f} руб. Дедлайн: {deadline_str}."
        else:
            body = f"Просрочен взнос за {month_label}. Долг: {debt:.0f} руб. Обратитесь к тренеру."
        db.add(Notification(
            user_id=athlete.user_id,
            type="fee",
            title="Напоминание о взносе",
            body=body,
            link_id=fee.id,
        ))
        tg_notifs.append((athlete.user_id, "Напоминание о взносе", body))
        sent += 1

    db.commit()
    from app.services.notifications import send_telegram_to_user
    for uid, tl, bd in tg_notifs:
        send_telegram_to_user(uid, tl, bd, db)
    return {"sent": sent}


# ── Счётчик просроченных взносов ──────────────────────────────────────────────

@router.get("/overdue-count")
def overdue_count(
    db: Session = Depends(get_db),
    _: User = Depends(require_manager),
):
    today = date_type.today()
    period_date = date_type(today.year, today.month, 1)

    count = (
        db.query(MonthlyFee)
        .join(FeeDeadline, MonthlyFee.deadline_id == FeeDeadline.id)
        .filter(
            MonthlyFee.period == period_date,
            MonthlyFee.amount_paid < MonthlyFee.amount_due,
            FeeDeadline.deadline < today,
            MonthlyFee.is_subsidized != True,
        )
        .count()
    )
    return {"count": count}


# ══════════════════════════════════════════════════════════════════════════════
# Новый модуль взносов — FeeConfig + AthleteFeePeriod
# ══════════════════════════════════════════════════════════════════════════════

MONTHS_RU_LIST = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']


class FeeConfigBody(BaseModel):
    payment_day: int
    fee_amount:  int


class PeriodPatchBody(BaseModel):
    is_budget: Optional[bool] = None
    paid:      Optional[bool] = None
    note:      Optional[str]  = None


class BulkItem(BaseModel):
    athlete_id: int
    is_budget:  bool


def _period_out(p: AthleteFeePeriod) -> dict:
    a = p.athlete
    return {
        "id":           p.id,
        "athlete_id":   p.athlete_id,
        "full_name":    a.full_name if a else "",
        "group":        (a.group or a.auto_group or "") if a else "",
        "is_budget":    bool(p.is_budget),
        "paid":         bool(p.paid),
        "paid_at":      p.paid_at.isoformat() if p.paid_at else None,
        "debt":         p.debt or 0,
        "note":         p.note or "",
        "is_frozen":    bool(p.is_frozen),
        "period_year":  p.period_year,
        "period_month": p.period_month,
    }


# ── GET /fees/config ──────────────────────────────────────────────────────────

@router.get("/config")
def get_fee_config(db: Session = Depends(get_db)):
    cfg = db.query(FeeConfig).first()
    if not cfg:
        return {"payment_day": 1, "fee_amount": 2000}
    return {"payment_day": cfg.payment_day, "fee_amount": cfg.fee_amount}


# ── POST /fees/config ─────────────────────────────────────────────────────────

@router.post("/config")
def save_fee_config(
    body: FeeConfigBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    cfg = db.query(FeeConfig).first()
    if cfg:
        cfg.payment_day = body.payment_day
        cfg.fee_amount  = body.fee_amount
        cfg.updated_by  = current_user.id
    else:
        cfg = FeeConfig(
            payment_day=body.payment_day,
            fee_amount=body.fee_amount,
            updated_by=current_user.id,
        )
        db.add(cfg)
    db.commit()
    return {"payment_day": cfg.payment_day, "fee_amount": cfg.fee_amount}


# ── GET /fees/periods ─────────────────────────────────────────────────────────

JUNIOR_GROUPS = ('Младшая группа (6–10 лет)',)
SENIOR_GROUPS = ('Старшая группа (11+)', 'Взрослые (18+)')


def _apply_group_filter(items, manager_group):
    """Фильтрует список AthleteFeePeriod по manager_group пользователя."""
    if not manager_group:
        return items
    if manager_group == 'junior':
        return [i for i in items if i.athlete and i.athlete.group in JUNIOR_GROUPS]
    if manager_group == 'senior':
        return [i for i in items if i.athlete and i.athlete.group in SENIOR_GROUPS]
    return items


@router.get("/periods")
def list_periods(
    year:         int = Query(...),
    month:        int = Query(...),
    db:           Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    items = (
        db.query(AthleteFeePeriod)
        .options(joinedload(AthleteFeePeriod.athlete))
        .filter(
            AthleteFeePeriod.period_year  == year,
            AthleteFeePeriod.period_month == month,
        )
        .order_by(AthleteFeePeriod.is_budget.asc())
        .all()
    )
    items = _apply_group_filter(items, current_user.manager_group)
    return [_period_out(p) for p in items]


# ── POST /fees/periods/init ───────────────────────────────────────────────────

@router.post("/periods/init")
def init_periods(
    year:         int = Query(...),
    month:        int = Query(...),
    db:           Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    cfg = db.query(FeeConfig).first()
    fee_amount = cfg.fee_amount if cfg else 2000

    prev_year  = year if month > 1 else year - 1
    prev_month = month - 1 if month > 1 else 12

    athletes = db.query(Athlete).filter(Athlete.is_archived == False).all()
    mg = current_user.manager_group
    if mg == 'junior':
        athletes = [a for a in athletes if a.group in JUNIOR_GROUPS]
    elif mg == 'senior':
        athletes = [a for a in athletes if a.group in SENIOR_GROUPS]

    db.query(AthleteFeePeriod).filter(
        AthleteFeePeriod.period_year  == prev_year,
        AthleteFeePeriod.period_month == prev_month,
    ).update({AthleteFeePeriod.is_frozen: True})
    db.flush()

    created = 0
    skipped = 0
    for athlete in athletes:
        exists = db.query(AthleteFeePeriod).filter(
            AthleteFeePeriod.athlete_id   == athlete.id,
            AthleteFeePeriod.period_year  == year,
            AthleteFeePeriod.period_month == month,
        ).first()
        if exists:
            skipped += 1
            continue

        unpaid_frozen = db.query(AthleteFeePeriod).filter(
            AthleteFeePeriod.athlete_id == athlete.id,
            AthleteFeePeriod.is_frozen  == True,
            AthleteFeePeriod.paid       == False,
            AthleteFeePeriod.is_budget  == False,
        ).count()

        debt = unpaid_frozen * fee_amount

        db.add(AthleteFeePeriod(
            athlete_id=athlete.id,
            period_year=year,
            period_month=month,
            debt=debt,
        ))
        created += 1

    db.commit()
    return {"created": created, "skipped": skipped}


# ── PATCH /fees/periods/{period_id} ──────────────────────────────────────────

@router.patch("/periods/{period_id}")
def patch_period(
    period_id: int,
    body:      PeriodPatchBody,
    db:        Session = Depends(get_db),
    _:         User = Depends(require_manager),
):
    p = db.query(AthleteFeePeriod).options(joinedload(AthleteFeePeriod.athlete)).filter(
        AthleteFeePeriod.id == period_id
    ).first()
    if not p:
        raise HTTPException(404, "Период не найден")
    if body.is_budget is not None:
        p.is_budget = body.is_budget
    if body.note is not None:
        p.note = body.note
    if body.paid is not None:
        p.paid = body.paid
        if body.paid:
            p.paid_at = datetime.utcnow()
            p.debt    = 0
        else:
            p.paid_at = None
            unpaid_frozen = db.query(AthleteFeePeriod).filter(
                AthleteFeePeriod.athlete_id == p.athlete_id,
                AthleteFeePeriod.is_frozen  == True,
                AthleteFeePeriod.paid       == False,
                AthleteFeePeriod.is_budget  == False,
            ).count()
            _cfg = db.query(FeeConfig).first()
            p.debt = unpaid_frozen * (_cfg.fee_amount if _cfg else 2000)
    db.commit()
    db.refresh(p)
    return _period_out(p)


# ── POST /fees/periods/save-and-notify ───────────────────────────────────────

@router.post("/periods/save-and-notify")
def save_and_notify(
    year:         int = Query(...),
    month:        int = Query(...),
    notify:       bool = Query(True),
    items:        List[BulkItem] = Body(...),
    db:           Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    cfg = db.query(FeeConfig).first()
    fee_amount = cfg.fee_amount if cfg else 2000

    saved    = 0
    notified = 0

    for item in items:
        p = db.query(AthleteFeePeriod).filter(
            AthleteFeePeriod.athlete_id   == item.athlete_id,
            AthleteFeePeriod.period_year  == year,
            AthleteFeePeriod.period_month == month,
        ).first()
        if not p:
            continue
        p.is_budget = item.is_budget
        saved += 1

    db.commit()

    if notify:
        month_label = MONTHS_RU_LIST[month] if 1 <= month <= 12 else str(month)
        notify_periods = (
            db.query(AthleteFeePeriod)
            .options(joinedload(AthleteFeePeriod.athlete))
            .filter(
                AthleteFeePeriod.period_year  == year,
                AthleteFeePeriod.period_month == month,
                AthleteFeePeriod.is_budget    == False,
                AthleteFeePeriod.paid         == False,
            )
            .all()
        )
        notify_periods = _apply_group_filter(notify_periods, current_user.manager_group)
        tg_notifs = []
        for p in notify_periods:
            athlete = p.athlete
            if not athlete or not athlete.user_id:
                continue
            body_text = (
                f"Напоминаем об оплате членского взноса за {month_label} {year} — {fee_amount} руб."
            )
            if p.debt > 0:
                body_text += (
                    f" Задолженность за прошлые периоды: {p.debt} руб."
                    f" Итого: {fee_amount + p.debt} руб."
                )
            notif_title = f"Оплата взноса — {month_label} {year}"
            db.add(Notification(
                user_id=athlete.user_id,
                type="fee",
                title=notif_title,
                body=body_text,
            ))
            tg_notifs.append((athlete.user_id, notif_title, body_text))
            notified += 1
        db.commit()
        from app.services.notifications import send_telegram_to_user
        for uid, tl, bd in tg_notifs:
            send_telegram_to_user(uid, tl, bd, db)

    return {"saved": saved, "notified": notified}


# ── GET /fees/periods/athlete/{athlete_id} ────────────────────────────────────

@router.get("/periods/athlete/{athlete_id}")
def get_athlete_periods(
    athlete_id: int,
    db:         Session = Depends(get_db),
    _:          User = Depends(require_manager),
):
    items = (
        db.query(AthleteFeePeriod)
        .options(joinedload(AthleteFeePeriod.athlete))
        .filter(AthleteFeePeriod.athlete_id == athlete_id)
        .order_by(AthleteFeePeriod.period_year.desc(), AthleteFeePeriod.period_month.desc())
        .all()
    )
    return [_period_out(p) for p in items]
