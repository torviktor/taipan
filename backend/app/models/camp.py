# backend/app/models/camp.py

from sqlalchemy import Column, Integer, String, Date, DateTime, Boolean, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Camp(Base):
    """Спортивные сборы."""
    __tablename__ = "camps"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(255), nullable=False)
    date_start  = Column(Date, nullable=False)
    date_end    = Column(Date, nullable=False)
    location    = Column(String(255), nullable=True)
    price       = Column(Numeric(10, 2), nullable=True)   # стоимость участия
    notes       = Column(Text, nullable=True)
    notify_sent = Column(Boolean, default=False)
    created_by  = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    participants = relationship("CampParticipant", back_populates="camp", cascade="all, delete-orphan")
    creator      = relationship("User", foreign_keys=[created_by])


class CampParticipantStatus(str):
    pending  = "pending"   # Приглашён, ответа нет
    confirmed = "confirmed" # Едет
    declined  = "declined"  # Не едет
    paid      = "paid"      # Едет + оплатил


class CampParticipant(Base):
    """Участник сборов."""
    __tablename__ = "camp_participants"

    id         = Column(Integer, primary_key=True, index=True)
    camp_id    = Column(Integer, ForeignKey("camps.id", ondelete="CASCADE"), nullable=False)
    athlete_id = Column(Integer, ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False)
    status     = Column(String(20), default="pending")  # pending/confirmed/declined/paid
    paid       = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    camp    = relationship("Camp", back_populates="participants")
    athlete = relationship("Athlete", back_populates="camp_participations")
