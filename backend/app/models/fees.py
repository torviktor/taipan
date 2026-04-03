import enum
from datetime import datetime, date as date_type
from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Numeric, Text, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base


class FeeStatus(str, enum.Enum):
    pending = "pending"
    due = "due"
    overdue = "overdue"
    paid = "paid"


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
    athlete = relationship("Athlete")
    deadline_obj = relationship("FeeDeadline", back_populates="fees")
    recorder = relationship("User", foreign_keys=[recorded_by])

    @property
    def computed_status(self) -> FeeStatus:
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
