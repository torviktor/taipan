import enum
from datetime import datetime, date as date_type
from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Numeric, Text, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base


class FeeConfig(Base):
    __tablename__ = "fee_config"
    id          = Column(Integer, primary_key=True)
    payment_day = Column(Integer, default=1)
    fee_amount  = Column(Integer, default=2000)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by  = Column(Integer, ForeignKey("users.id"), nullable=True)


class AthleteFeePeriod(Base):
    __tablename__ = "athlete_fee_periods"
    id           = Column(Integer, primary_key=True)
    athlete_id   = Column(Integer, ForeignKey("athletes.id"))
    period_year  = Column(Integer)
    period_month = Column(Integer)
    is_budget    = Column(Boolean, default=False)
    paid         = Column(Boolean, default=False)
    paid_at      = Column(DateTime, nullable=True)
    debt         = Column(Integer, default=0)
    note         = Column(Text, nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)
    athlete      = relationship("Athlete", foreign_keys=[athlete_id])


class FeeStatus(str, enum.Enum):
    pending = "pending"
    due = "due"
    overdue = "overdue"
    paid = "paid"
    subsidized = "subsidized"


class FeeDeadline(Base):
    __tablename__ = "fee_deadlines"
    id = Column(Integer, primary_key=True)
    period = Column(Date, nullable=False)       # first day of month
    deadline = Column(Date, nullable=False)
    amount_due = Column(Numeric(10, 2), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    fees = relationship("MonthlyFee", back_populates="deadline_obj")


class MonthlyFee(Base):
    __tablename__ = "monthly_fees"
    id = Column(Integer, primary_key=True)
    athlete_id = Column(Integer, ForeignKey("athletes.id", ondelete="CASCADE"))
    deadline_id = Column(Integer, ForeignKey("fee_deadlines.id", ondelete="CASCADE"))
    period = Column(Date, nullable=False)
    amount_due = Column(Numeric(10, 2), nullable=False)
    amount_paid = Column(Numeric(10, 2), default=0)
    paid_at = Column(DateTime, nullable=True)
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    note = Column(Text, nullable=True)
    is_subsidized = Column(Boolean, default=False, nullable=True, server_default='false')
    athlete = relationship("Athlete")
    deadline_obj = relationship("FeeDeadline", back_populates="fees")
    recorder = relationship("User", foreign_keys=[recorded_by])

    @property
    def computed_status(self) -> FeeStatus:
        if self.is_subsidized:
            return FeeStatus.subsidized
        if float(self.amount_paid or 0) >= float(self.amount_due or 0):
            return FeeStatus.paid
        today = date_type.today()
        if not self.deadline_obj:
            return FeeStatus.pending
        dl = self.deadline_obj.deadline
        if today <= dl:
            return FeeStatus.pending
        diff = (today - dl).days
        if diff <= 7:
            return FeeStatus.due
        return FeeStatus.overdue
