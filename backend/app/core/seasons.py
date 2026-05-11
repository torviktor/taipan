"""Утилита спортивного сезона.

Сезон = год начала (int). Сентябрь–август. Например, 2025 = сезон 2025/2026.
Эта утилита — каноническое место. Существующие дубли в `routes/achievements.py`
и `tasks/yandex_gpt.py` оставлены для обратной совместимости и должны быть
переведены на эту утилиту отдельной сессией рефакторинга.

TODO: deduplicate get_sport_season in routes/achievements.py and tasks/yandex_gpt.py.
"""

from datetime import date
from typing import Optional


def get_current_season(d: Optional[date] = None) -> int:
    """Возвращает год начала текущего спортивного сезона (сентябрь–август).

    Сентябрь–декабрь → текущий год.
    Январь–август    → предыдущий год.
    """
    if d is None:
        d = date.today()
    return d.year if d.month >= 9 else d.year - 1


def format_season_label(year: int) -> str:
    """Форматирует год начала в человекочитаемую строку: 2025 → '2025/2026'."""
    return f"{year}/{year + 1}"
