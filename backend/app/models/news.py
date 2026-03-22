# backend/app/models/news.py

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class News(Base):
    __tablename__ = "news"

    id               = Column(Integer, primary_key=True, index=True)
    title            = Column(String(255), nullable=False)
    body             = Column(Text, nullable=False)
    photo_url        = Column(String(512), nullable=True)
    published_at     = Column(DateTime(timezone=True), server_default=func.now())
    created_by       = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_published     = Column(Boolean, default=True, nullable=False)
    competition_id   = Column(Integer, ForeignKey("competitions.id",   ondelete="SET NULL"), nullable=True)
    certification_id = Column(Integer, ForeignKey("certifications.id", ondelete="SET NULL"), nullable=True)
    camp_id          = Column(Integer, ForeignKey("camps.id",          ondelete="SET NULL"), nullable=True)

    author          = relationship("User",          foreign_keys=[created_by])
    competition     = relationship("Competition",   foreign_keys=[competition_id])
    certification   = relationship("Certification", foreign_keys=[certification_id])
    camp            = relationship("Camp",          foreign_keys=[camp_id])
