# backend/app/models/competition_file.py

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class CompetitionFile(Base):
    __tablename__ = "competition_files"

    id             = Column(Integer, primary_key=True, index=True)
    competition_id = Column(Integer, ForeignKey("competitions.id", ondelete="CASCADE"), nullable=False)
    filename       = Column(String(255), nullable=False)   # оригинальное имя для отображения
    stored_name    = Column(String(255), nullable=False)   # uuid-имя на диске
    file_url       = Column(String(512), nullable=False)   # /static/competition-files/...
    uploaded_by    = Column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at    = Column(DateTime(timezone=True), server_default=func.now())

    competition = relationship("Competition", back_populates="files")
    uploader    = relationship("User", foreign_keys=[uploaded_by])
