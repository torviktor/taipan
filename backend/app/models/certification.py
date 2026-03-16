# backend/app/models/certification.py

from sqlalchemy import (
    Column, Integer, String, Date, DateTime, Boolean,
    ForeignKey, Text, Enum, func
)
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class CertificationStatus(str, enum.Enum):
    planned   = "planned"    # Планируется
    active    = "active"     # Идёт прямо сейчас
    completed = "completed"  # Завершена


class Certification(Base):
    """Событие аттестации."""
    __tablename__ = "certifications"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(255), nullable=False)   # напр. "Аттестация апрель 2026"
    date        = Column(Date, nullable=False)
    location    = Column(String(255), nullable=True)
    notes       = Column(Text, nullable=True)
    status      = Column(String(20), nullable=False, default=CertificationStatus.planned)
    notify_sent = Column(Boolean, default=False)        # флаг: уведомления отправлены
    created_by  = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())

    results  = relationship("CertificationResult", back_populates="certification", cascade="all, delete-orphan")
    creator  = relationship("User", foreign_keys=[created_by])


class CertificationResult(Base):
    """Результат одного спортсмена на аттестации."""
    __tablename__ = "certification_results"

    id               = Column(Integer, primary_key=True, index=True)
    certification_id = Column(Integer, ForeignKey("certifications.id", ondelete="CASCADE"), nullable=False)
    athlete_id       = Column(Integer, ForeignKey("athletes.id",        ondelete="CASCADE"), nullable=False)

    current_gup      = Column(Integer, nullable=True)   # гып на момент аттестации
    current_dan      = Column(Integer, nullable=True)
    target_gup       = Column(Integer, nullable=True)   # предполагаемый гып
    target_dan       = Column(Integer, nullable=True)
    passed           = Column(Boolean, nullable=True)   # None = ещё не отмечено

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    certification = relationship("Certification", back_populates="results")
    athlete       = relationship("Athlete", back_populates="certification_results")


# ─── Уведомления ─────────────────────────────────────────────────────────────

class NotificationType(str, enum.Enum):
    certification = "certification"   # аттестация
    training      = "training"        # тренировка
    competition   = "competition"     # соревнование
    camp          = "camp"            # сборы
    general       = "general"         # общее


class Notification(Base):
    """Уведомление для пользователя."""
    __tablename__ = "notifications"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type       = Column(String(30), nullable=False, default=NotificationType.general)
    title      = Column(String(255), nullable=False)
    body       = Column(Text, nullable=False)
    is_read    = Column(Boolean, default=False)
    link_id    = Column(Integer, nullable=True)    # id связанного объекта (certification_id и т.д.)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", foreign_keys=[user_id])
