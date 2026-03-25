# backend/app/models/analytics.py

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class Analytics(Base):
    __tablename__ = "analytics"

    id          = Column(Integer, primary_key=True, index=True)
    athlete_id  = Column(Integer, ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False)
    title       = Column(String(255), nullable=False)
    comment     = Column(Text, nullable=True)
    file_path   = Column(String(500), nullable=True)
    file_name   = Column(String(255), nullable=True)
    created_by  = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    athlete = relationship("Athlete", foreign_keys=[athlete_id])
    creator = relationship("User", foreign_keys=[created_by])
