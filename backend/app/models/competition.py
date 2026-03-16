# backend/app/models/competition.py

from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import relationship
import math
from app.core.database import Base


SIGNIFICANCE_TABLE = {
    "Местный":        { "Фестиваль": 1.0, "Турнир": 1.2, "Кубок": 1.5, "Первенство": 1.5, "Чемпионат": 1.5 },
    "Региональный":   { "Фестиваль": 2.0, "Турнир": 2.5, "Кубок": 2.8, "Первенство": 2.8, "Чемпионат": 3.0 },
    "Окружной":       { "Фестиваль": 4.0, "Турнир": 4.5, "Кубок": 5.0, "Первенство": 5.0, "Чемпионат": 6.0 },
    "Всероссийский":  { "Фестиваль": 7.0, "Турнир": 8.0, "Кубок": 9.0, "Первенство": 10.0, "Чемпионат": 11.0 },
    "Международный":  { "Фестиваль": 15.0, "Турнир": 17.0, "Кубок": 20.0, "Первенство": 21.0, "Чемпионат": 24.0 },
}


def get_significance(level: str, comp_type: str) -> float:
    return SIGNIFICANCE_TABLE.get(level, {}).get(comp_type, 1.0)


class Competition(Base):
    __tablename__ = "competitions"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String(255), nullable=False)
    date         = Column(Date, nullable=False)
    location     = Column(String(255), nullable=True)
    level        = Column(String(50), nullable=False)
    comp_type    = Column(String(50), nullable=False)
    significance = Column(Float, nullable=False, default=1.0)
    notes        = Column(Text, nullable=True)
    season       = Column(Integer, nullable=False)
    created_by   = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())

    results = relationship("CompetitionResult", back_populates="competition", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by])


class CompetitionResult(Base):
    __tablename__ = "competition_results"

    id             = Column(Integer, primary_key=True, index=True)
    competition_id = Column(Integer, ForeignKey("competitions.id", ondelete="CASCADE"), nullable=False)
    athlete_id     = Column(Integer, ForeignKey("athletes.id",     ondelete="CASCADE"), nullable=False)

    sparring_place  = Column(Integer, nullable=True)
    sparring_fights = Column(Integer, nullable=False, default=0)

    stopball_place  = Column(Integer, nullable=True)
    stopball_fights = Column(Integer, nullable=False, default=0)

    tegtim_place    = Column(Integer, nullable=True)
    tegtim_fights   = Column(Integer, nullable=False, default=0)

    tuli_place      = Column(Integer, nullable=True)
    tuli_perfs      = Column(Integer, nullable=False, default=0)

    rating          = Column(Float, nullable=False, default=0.0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    competition = relationship("Competition", back_populates="results")
    athlete     = relationship("Athlete", back_populates="competition_results")


def _pb(place, b1, b2, b3):
    if place == 1: return b1
    if place == 2: return b2
    if place == 3: return b3
    return 0.0


def calc_result_rating(r, significance: float) -> float:
    sparring_pts = (r.sparring_fights or 0) * 3.0 + _pb(r.sparring_place, 40, 24, 14)
    stopball_pts = (r.stopball_fights or 0) * 2.5 + _pb(r.stopball_place, 40, 24, 14)
    tegtim_pts   = (r.tegtim_fights   or 0) * 2.5 + _pb(r.tegtim_place,   40, 24, 14)
    tuli_pts     = (r.tuli_perfs      or 0) * 2.0 + _pb(r.tuli_place,     25, 15,  9)

    gold = silver = bronze = 0
    for p in (r.sparring_place, r.stopball_place, r.tegtim_place, r.tuli_place):
        if p == 1:   gold   += 1
        elif p == 2: silver += 1
        elif p == 3: bronze += 1

    total = gold + silver + bronze
    if   gold >= 2:                  medal_bonus = 55
    elif gold == 1 and total == 1:   medal_bonus = 30
    elif total >= 2:                 medal_bonus = 40
    elif silver == 1 and total == 1: medal_bonus = 18
    elif bronze == 1 and total == 1: medal_bonus = 10
    else:                            medal_bonus = 0

    raw = sparring_pts + stopball_pts + tegtim_pts + tuli_pts + medal_bonus
    return round(significance * math.log(raw + 1), 2)
