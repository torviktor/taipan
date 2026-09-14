# backend/app/models/transcription.py

import uuid
from sqlalchemy import Column, Integer, BigInteger, String, Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class TranscriptionJob(Base):
    """Задание на распознавание аудиозаписи совещания.

    Файл нигде не хранится в БД — только текст, который пришлёт бот-
    транскрайбер колбэком. Сам аудиофайл живёт какое-то время в общем
    inbox-каталоге (см. app/routes/transcribe.py и app/services/transcribe.py)
    и удаляется оттуда после обработки или по TTL.

    Статусы: uploaded → processing → done | error.
    """

    __tablename__ = "transcription_jobs"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    original_name = Column(String(300), nullable=False)
    size_bytes    = Column(BigInteger, nullable=False)
    duration_sec  = Column(Integer, nullable=True)   # заполняет бот после ffprobe
    status        = Column(String(20), nullable=False, default="uploaded")
    text          = Column(Text, nullable=True)
    error         = Column(Text, nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    finished_at   = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User")
