# backend/app/models/competition.py

from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime,
    ForeignKey, Enum, Text, func
)
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base


class CompetitionLevel(str, enum.Enum):
    local       = "Местный"
    regional    = "Региональный"
    district    = "Окружной"
    national    = "Всероссийский"
    international = "Международный"


class CompetitionType(str, enum.Enum):
    festival    = "Фестиваль"
    tournament  = "Турнир"
    cup         = "Кубок"
    championship = "Первенство"
    grand       = "Чемпионат"


# Таблица значимости: [уровень][тип] = коэффициент
SIGNIFICANCE_TABLE = {
    "Местный": {
        "Фестиваль": 1.0,
        "Турнир": 1.2,
        "Кубок": 1.5,
        "Первенство": 1.5,
        "Чемпионат": 1.5,
    },
    "Региональный": {
        "Фестиваль": 2.0,
        "Турнир": 2.5,
        "Кубок": 2.8,
        "Первенство": 2.8,
        "Чемпионат": 3.0,
    },
    "Окружной": {
        "Фестиваль": 4.0,
        "Турнир": 4.5,
        "Кубок": 5.0,
        "Первенство": 5.0,
        "Чемпионат": 6.0,
    },
    "Всероссийский": {
        "Фестиваль": 7.0,
        "Турнир": 8.0,
        "Кубок": 9.0,
        "Первенство": 10.0,
        "Чемпионат": 11.0,
    },
    "Международный": {
        "Фестиваль": 15.0,
        "Турнир": 17.0,
        "Кубок": 20.0,
        "Первенство": 21.0,
        "Чемпионат": 24.0,
    },
}


def get_significance(level: str, comp_type: str) -> float:
    return SIGNIFICANCE_TABLE.get(level, {}).get(comp_type, 1.0)


class Competition(Base):
    __tablename__ = "competitions"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String(255), nullable=False)
    date          = Column(Date, nullable=False)
    location      = Column(String(255), nullable=True)
    level         = Column(String(50), nullable=False)   # CompetitionLevel value
    comp_type     = Column(String(50), nullable=False)   # CompetitionType value
    significance  = Column(Float, nullable=False, default=1.0)
    notes         = Column(Text, nullable=True)
    season        = Column(Integer, nullable=False)      # год сезона, напр. 2025
    created_by    = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), onupdate=func.now())

    results       = relationship(
        "CompetitionResult",
        back_populates="competition",
        cascade="all, delete-orphan"
    )
    creator       = relationship("User", foreign_keys=[created_by])


class CompetitionResult(Base):
    """
    Результат одного спортсмена на одном соревновании.

    Дисциплины GTF:
      - sparring   (спарринг):  место + количество боёв
      - stopball   (стоп-балл): место + количество боёв
      - tuli       (тули):      место + количество выступлений

    Рейтинговая формула (из HTML-прототипа):
      sig  = коэффициент значимости турнира

      sparring_pts  = fights_s * 3  + place_bonus(place_s,  40, 24, 14)
      stopball_pts  = fights_sb * 2.5 + place_bonus(place_sb, 40, 24, 14)
      tuli_pts      = perfs_t  * 2  + place_bonus(place_t,  25, 15,  9)

      medals        = (gold, silver, bronze) по всем дисциплинам
      medal_bonus   = 30 / 55 / 18 / 10 / 40  — по матрице

      total_raw     = sparring_pts + stopball_pts + tuli_pts + medal_bonus
      rating        = sig * ln(total_raw + 1)   [округлено до 2 знаков]

    Значение rating хранится в БД (денормализация для скорости запросов).
    """
    __tablename__ = "competition_results"

    id              = Column(Integer, primary_key=True, index=True)
    competition_id  = Column(Integer, ForeignKey("competitions.id", ondelete="CASCADE"), nullable=False)
    athlete_id      = Column(Integer, ForeignKey("athletes.id",     ondelete="CASCADE"), nullable=False)

    # ── Спарринг ────────────────────────────────────────────────
    sparring_place  = Column(Integer, nullable=True)   # 1, 2, 3 или NULL
    sparring_fights = Column(Integer, nullable=False, default=0)

    # ── Стоп-балл ───────────────────────────────────────────────
    stopball_place  = Column(Integer, nullable=True)
    stopball_fights = Column(Integer, nullable=False, default=0)

    # ── Тули ────────────────────────────────────────────────────
    tuli_place      = Column(Integer, nullable=True)
    tuli_perfs      = Column(Integer, nullable=False, default=0)

    # ── Итог ────────────────────────────────────────────────────
    rating          = Column(Float, nullable=False, default=0.0)  # считается при сохранении

    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    competition     = relationship("Competition", back_populates="results")
    athlete         = relationship("Athlete", back_populates="competition_results")


# ─── Формула расчёта рейтинга ────────────────────────────────────────────────

import math

def _place_bonus(place: int | None, b1: float, b2: float, b3: float) -> float:
    if place == 1: return b1
    if place == 2: return b2
    if place == 3: return b3
    return 0.0


def calc_result_rating(result: "CompetitionResult", significance: float) -> float:
    """Вычисляет рейтинговые очки одного результата."""

    # ── базовые очки по дисциплинам ─────────────────────────────
    sparring_pts  = (result.sparring_fights * 3.0
                     + _place_bonus(result.sparring_place,  40, 24, 14))

    stopball_pts  = (result.stopball_fights * 2.5
                     + _place_bonus(result.stopball_place,  40, 24, 14))

    tuli_pts      = (result.tuli_perfs * 2.0
                     + _place_bonus(result.tuli_place,      25, 15,  9))

    # ── медальный бонус ──────────────────────────────────────────
    gold = silver = bronze = 0
    for place in (result.sparring_place, result.stopball_place, result.tuli_place):
        if place == 1: gold   += 1
        elif place == 2: silver += 1
        elif place == 3: bronze += 1

    total_medals = gold + silver + bronze
    if   gold >= 2:                    medal_bonus = 55
    elif gold == 1 and total_medals == 1: medal_bonus = 30
    elif total_medals >= 2:            medal_bonus = 40
    elif silver == 1 and total_medals == 1: medal_bonus = 18
    elif bronze == 1 and total_medals == 1: medal_bonus = 10
    else:                              medal_bonus = 0

    # ── финальная формула ────────────────────────────────────────
    raw    = sparring_pts + stopball_pts + tuli_pts + medal_bonus
    rating = significance * math.log(raw + 1)

    return round(rating, 2)
