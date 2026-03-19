from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime
from app.core.database import Base


class HallOfFame(Base):
    __tablename__ = "hall_of_fame"

    id           = Column(Integer, primary_key=True, index=True)
    full_name    = Column(String(200), nullable=False)
    photo_url    = Column(String(500), nullable=True)
    achievements = Column(Text, nullable=True)
    gup          = Column(Integer, nullable=True)
    dan          = Column(Integer, nullable=True)
    sort_order   = Column(Integer, default=0, nullable=False)
    created_at   = Column(DateTime, default=datetime.utcnow)
