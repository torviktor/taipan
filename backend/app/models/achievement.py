# backend/app/models/achievement.py

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, func
from sqlalchemy.orm import relationship
from app.core.database import Base


# ── Определения ачивок ────────────────────────────────────────────────────────
# Все ачивки посезонные — при новом сезоне начисляются заново

ACHIEVEMENTS = [

    # ── Посещаемость ──────────────────────────────────────────────────────────
    {
        "code":        "attendance_first",
        "name":        "Первый шаг",
        "description": "Первая тренировка в сезоне",
        "category":    "attendance",
        "tier":        "common",
        "icon":        "steps",
    },
    {
        "code":        "attendance_30",
        "name":        "Стабильный",
        "description": "30 тренировок за сезон",
        "category":    "attendance",
        "tier":        "common",
        "icon":        "shield",
    },
    {
        "code":        "attendance_60",
        "name":        "Железный",
        "description": "60 тренировок за сезон",
        "category":    "attendance",
        "tier":        "rare",
        "icon":        "iron",
    },
    {
        "code":        "attendance_90",
        "name":        "Легенда зала",
        "description": "90 тренировок за сезон",
        "category":    "attendance",
        "tier":        "legendary",
        "icon":        "legend",
    },
    {
        "code":        "attendance_perfect_month",
        "name":        "Отличник",
        "description": "100% посещаемость за любой месяц сезона",
        "category":    "attendance",
        "tier":        "rare",
        "icon":        "star",
    },

    # ── Соревнования ─────────────────────────────────────────────────────────
    {
        "code":        "competition_first",
        "name":        "Боевое крещение",
        "description": "Первое соревнование в сезоне",
        "category":    "competition",
        "tier":        "common",
        "icon":        "sword",
    },
    {
        "code":        "competition_medal",
        "name":        "Медалист",
        "description": "Любой призовой результат в сезоне",
        "category":    "competition",
        "tier":        "rare",
        "icon":        "medal",
    },
    {
        "code":        "competition_gold",
        "name":        "Призёр",
        "description": "1-е место на соревновании в сезоне",
        "category":    "competition",
        "tier":        "rare",
        "icon":        "trophy",
    },
    {
        "code":        "competition_allround",
        "name":        "Многоборец",
        "description": "Участие в 3 и более видах на одном соревновании",
        "category":    "competition",
        "tier":        "rare",
        "icon":        "allround",
    },
    {
        "code":        "competition_3season",
        "name":        "Турнирный боец",
        "description": "3 и более соревнований за сезон",
        "category":    "competition",
        "tier":        "rare",
        "icon":        "warrior",
    },

    # ── Аттестация ────────────────────────────────────────────────────────────
    {
        "code":        "certification_passed",
        "name":        "Новый пояс",
        "description": "Прошёл аттестацию в сезоне",
        "category":    "certification",
        "tier":        "common",
        "icon":        "belt",
    },
    {
        "code":        "certification_double",
        "name":        "Двойной рост",
        "description": "Повысил пояс дважды за сезон",
        "category":    "certification",
        "tier":        "rare",
        "icon":        "upgrade",
    },

    # ── Сборы ─────────────────────────────────────────────────────────────────
    {
        "code":        "camp_first",
        "name":        "Полевой боец",
        "description": "Участие в спортивных сборах в сезоне",
        "category":    "camp",
        "tier":        "common",
        "icon":        "camp",
    },
    {
        "code":        "camp_veteran",
        "name":        "Ветеран сборов",
        "description": "2 и более сборов за сезон",
        "category":    "camp",
        "tier":        "rare",
        "icon":        "veteran",
    },

    # ── Комбо ─────────────────────────────────────────────────────────────────
    {
        "code":        "combo_full",
        "name":        "Полное комбо",
        "description": "Соревнование + аттестация + сборы в одном сезоне",
        "category":    "combo",
        "tier":        "legendary",
        "icon":        "combo",
    },

    # ── За ачивки ─────────────────────────────────────────────────────────────
    {
        "code":        "meta_5",
        "name":        "Коллекционер",
        "description": "5 ачивок за сезон",
        "category":    "meta",
        "tier":        "common",
        "icon":        "collection",
    },
    {
        "code":        "meta_10",
        "name":        "Охотник за наградами",
        "description": "10 ачивок за сезон",
        "category":    "meta",
        "tier":        "rare",
        "icon":        "hunter",
    },
    {
        "code":        "meta_15",
        "name":        "Абсолютный чемпион",
        "description": "15 ачивок за сезон",
        "category":    "meta",
        "tier":        "legendary",
        "icon":        "absolute",
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
    code       = Column(String(60), nullable=False)
    season     = Column(Integer, nullable=True)    # сезон (год начала, напр. 2025)
    granted_at = Column(DateTime(timezone=True), server_default=func.now())
    seen       = Column(Boolean, default=False)

    athlete = relationship("Athlete", back_populates="achievements")
