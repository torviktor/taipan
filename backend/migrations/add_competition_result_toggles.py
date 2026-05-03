"""
Миграция: добавить boolean-поля в competition_results для матрицы заявки.

Новые колонки:
  - powerbreak           — участвует в силовой разбивке (+/−)
  - spectech             — участвует в спец. технике (+/−)
  - sparring_disabled    — ✕-метка "не участвует" поверх place-дисциплины
  - stopball_disabled
  - tegtim_disabled
  - tuli_disabled
  - powerbreak_disabled  — bulk-вычеркивание (на будущее)
  - spectech_disabled

Все поля nullable=False, default=False. ALTER TABLE ADD COLUMN с константным
DEFAULT в PostgreSQL >= 11 не переписывает таблицу — операция мгновенная.

Запустить на сервере:
  sudo docker compose exec backend python /app/migrations/add_competition_result_toggles.py
"""

import sys
sys.path.insert(0, '/app')

from app.core.database import engine
from sqlalchemy import text

NEW_COLUMNS = [
    "powerbreak",
    "spectech",
    "sparring_disabled",
    "stopball_disabled",
    "tegtim_disabled",
    "tuli_disabled",
    "powerbreak_disabled",
    "spectech_disabled",
]

with engine.connect() as conn:
    for col in NEW_COLUMNS:
        try:
            conn.execute(text(
                f"ALTER TABLE competition_results "
                f"ADD COLUMN IF NOT EXISTS {col} BOOLEAN NOT NULL DEFAULT FALSE"
            ))
            print(f"OK  competition_results.{col}")
        except Exception as e:
            print(f"ERR competition_results.{col}: {e}")
    conn.commit()
    print("Migration finished.")
