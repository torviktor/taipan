# backend/app/models/achievement.py

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, func
from sqlalchemy.orm import relationship
from app.core.database import Base


# ── Определения ачивок ────────────────────────────────────────────────────────
# Хранятся в коде, не в БД — так проще менять без миграций

ACHIEVEMENTS = [
    # ── Посещаемость ──────────────────────────────────────────────────────────
    {
        "code":        "attendance_10",
        "name":        "Первые шаги",
        "description": "Посетил 10 тренировок",
        "category":    "attendance",
        "tier":        "common",      # common / rare / legendary
        "icon":        "steps",
    },
    {
        "code":        "attendance_50",
        "name":        "Стабильный боец",
        "description": "Посетил 50 тренировок",
        "category":    "attendance",
        "tier":        "rare",
        "icon":        "shield",
    },
    {
        "code":        "attendance_100",
        "name":        "Железная дисциплина",
        "description": "Посетил 100 тренировок",
        "category":    "attendance",
        "tier":        "legendary",
        "icon":        "iron",
    },
    {
        "code":        "attendance_perfect_month",
        "name":        "Отличник посещаемости",
        "description": "100% посещаемость за календарный месяц",
        "category":    "attendance",
        "tier":        "rare",
        "icon":        "star",
    },
    # ── Соревнования ─────────────────────────────────────────────────────────
    {
        "code":        "competition_first",
        "name":        "Боевое крещение",
        "description": "Участвовал в первом соревновании",
        "category":    "competition",
        "tier":        "common",
        "icon":        "sword",
    },
    {
        "code":        "competition_gold",
        "name":        "Призёр",
        "description": "Занял 1-е место на соревновании",
        "category":    "competition",
        "tier":        "rare",
        "icon":        "trophy",
    },
    {
        "code":        "competition_top3_season",
        "name":        "Чемпион клуба",
        "description": "Топ-3 общего рейтинга за сезон",
        "category":    "competition",
        "tier":        "legendary",
        "icon":        "crown",
    },
    # ── Аттестация ────────────────────────────────────────────────────────────
    {
        "code":        "certification_first",
        "name":        "Первый пояс",
        "description": "Сдал первую аттестацию",
        "category":    "certification",
        "tier":        "common",
        "icon":        "belt",
    },
    {
        "code":        "certification_upgrade",
        "name":        "Восхождение",
        "description": "Повысил гып или дан",
        "category":    "certification",
        "tier":        "rare",
        "icon":        "upgrade",
    },
    # ── Сборы ─────────────────────────────────────────────────────────────────
    {
        "code":        "camp_first",
        "name":        "Боец сборов",
        "description": "Принял участие в спортивных сборах",
        "category":    "camp",
        "tier":        "rare",
        "icon":        "camp",
    },
]

ACHIEVEMENT_MAP = {a["code"]: a for a in ACHIEVEMENTS}

TIER_ORDER = {"common": 1, "rare": 2, "legendary": 3}
TIER_LABEL = {"common": "Обычная", "rare": "Редкая", "legendary": "Легендарная"}
TIER_COLOR = {"common": "#888888", "rare": "#CC0000", "legendary": "#c8962a"}


class AthleteAchievement(Base):
    """Выданная ачивка спортсмену."""
    __tablename__ = "athlete_achievements"

    id         = Column(Integer, primary_key=True, index=True)
    athlete_id = Column(Integer, ForeignKey("athletes.id", ondelete="CASCADE"), nullable=False)
    code       = Column(String(60), nullable=False)   # ключ из ACHIEVEMENT_MAP
    granted_at = Column(DateTime(timezone=True), server_default=func.now())
    seen       = Column(Boolean, default=False)       # родитель видел уведомление

    athlete = relationship("Athlete", back_populates="achievements")
