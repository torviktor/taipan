# backend/app/models/attendance.py
from sqlalchemy import Column, Integer, String, Date, Boolean, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class TrainingSession(Base):
    __tablename__ = "training_sessions"

    id         = Column(Integer, primary_key=True, index=True)
    date       = Column(Date, nullable=False)
    group_name = Column(String(20), nullable=False)   # "junior" | "senior"
    notes      = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    records = relationship("Attendance", back_populates="session", cascade="all, delete-orphan")


class Attendance(Base):
    __tablename__ = "attendance"

    id         = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("training_sessions.id"), nullable=False)
    athlete_id = Column(Integer, ForeignKey("athletes.id"), nullable=False)
    present    = Column(Boolean, default=False)

    session = relationship("TrainingSession", back_populates="records")
    athlete = relationship("Athlete")
