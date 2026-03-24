# backend/app/models/analytics.py

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class AnalyticsRequest(Base):
    """Заявка родителя/спортсмена на проведение аналитики."""
    __tablename__ = "analytics_requests"

    id         = Column(Integer, primary_key=True, index=True)
    athlete_id = Column(Integer, ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id",   ondelete="CASCADE"), nullable=False)
    comment    = Column(Text, nullable=True)
    # new / in_progress / done
    status     = Column(String(20), nullable=False, default="new")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    athlete = relationship("Athlete", foreign_keys=[athlete_id])
    creator = relationship("User",    foreign_keys=[created_by])


class AnalyticsReport(Base):
    """Готовая аналитика по спортсмену, созданная тренером/администратором."""
    __tablename__ = "analytics_reports"

    id         = Column(Integer, primary_key=True, index=True)
    athlete_id = Column(Integer, ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id",   ondelete="CASCADE"), nullable=False)
    title      = Column(String(255), nullable=False)
    content    = Column(Text, nullable=False)
    # in_progress / ready
    status     = Column(String(20), nullable=False, default="in_progress")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    athlete = relationship("Athlete", foreign_keys=[athlete_id])
    creator = relationship("User",    foreign_keys=[created_by])
