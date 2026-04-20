from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class AthleteInvite(Base):
    __tablename__ = "athlete_invites"
    id         = Column(Integer, primary_key=True)
    athlete_id = Column(Integer, ForeignKey("athletes.id"))
    created_by = Column(Integer, ForeignKey("users.id"))
    token      = Column(String(20), unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    athlete    = relationship("Athlete", foreign_keys=[athlete_id])


class AthleteViewer(Base):
    __tablename__ = "athlete_viewers"
    id         = Column(Integer, primary_key=True)
    athlete_id = Column(Integer, ForeignKey("athletes.id"))
    viewer_id  = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    athlete    = relationship("Athlete", foreign_keys=[athlete_id])
    viewer     = relationship("User", foreign_keys=[viewer_id])
