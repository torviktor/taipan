# backend/app/models/analytics.py

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class AnalyticsRequest(Base):
    """Заявка родителя/спортсмена на аналитику."""
    __tablename__ = "analytics_requests"

    id         = Column(Integer, primary_key=True, index=True)
    athlete_id = Column(Integer, ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False)
    comment    = Column(Text, nullable=True)
    status     = Column(String(20), nullable=False, default="new")
    # new | in_progress | done
    paid       = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    athlete = relationship("Athlete", foreign_keys=[athlete_id])


class AnalyticsReport(Base):
    """Готовая аналитика, выданная тренером."""
    __tablename__ = "analytics_reports"

    id         = Column(Integer, primary_key=True, index=True)
    athlete_id = Column(Integer, ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False)
    title      = Column(String(255), nullable=False)
    content    = Column(Text, nullable=True)       # текстовый вариант (необязателен)
    file_url   = Column(String(512), nullable=True) # путь к загруженному файлу
    status     = Column(String(20), nullable=False, default="in_progress")
    # in_progress | ready
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    athlete = relationship("Athlete", foreign_keys=[athlete_id])
