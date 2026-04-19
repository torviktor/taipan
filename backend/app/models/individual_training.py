from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class IndividualTrainingRequest(Base):
    __tablename__ = "individual_training_requests"

    id             = Column(Integer, primary_key=True)
    user_id        = Column(Integer, ForeignKey("users.id"))
    athlete_id     = Column(Integer, ForeignKey("athletes.id"), nullable=True)
    format         = Column(String(20))          # 'individual' или 'mini_group'
    preferred_time = Column(String(200), nullable=True)
    comment        = Column(Text, nullable=True)
    status         = Column(String(20), default="new")  # new, confirmed, rejected
    created_at     = Column(DateTime, default=datetime.utcnow)

    user    = relationship("User",    foreign_keys=[user_id])
    athlete = relationship("Athlete", foreign_keys=[athlete_id])
