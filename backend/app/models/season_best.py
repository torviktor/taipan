from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


# Допустимые значения slot — должны быть консистентны с фронтом.
SLOT_JUNIOR_BOY  = "junior_boy"
SLOT_JUNIOR_GIRL = "junior_girl"
SLOT_SENIOR_BOY  = "senior_boy"
SLOT_SENIOR_GIRL = "senior_girl"

ALL_SLOTS = (SLOT_JUNIOR_BOY, SLOT_JUNIOR_GIRL, SLOT_SENIOR_BOY, SLOT_SENIOR_GIRL)


class SeasonBestAthlete(Base):
    __tablename__ = "season_best_athletes"
    __table_args__ = (
        UniqueConstraint("slot", "season", name="ux_sba_slot_season"),
    )

    id         = Column(Integer, primary_key=True, index=True)
    athlete_id = Column(Integer, ForeignKey("athletes.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    slot       = Column(String(20), nullable=False)
    season     = Column(Integer, nullable=False, index=True)

    # Фото слота — переиспользует рендер/кадрирование Зала Славы.
    # photo_position в формате "Xpx Ypx / zoom%" (тот, что парсит ChampionImg).
    photo_url      = Column(String(500), nullable=True)
    photo_position = Column(String(50), nullable=True, default="0px 0px / 100%")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    athlete = relationship("Athlete")
