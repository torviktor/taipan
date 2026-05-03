"""
Откат миграции add_competition_result_toggles.

Удаляет 8 boolean-колонок из competition_results, добавленных в
add_competition_result_toggles.py. ALTER TABLE DROP COLUMN IF EXISTS —
идемпотентен, можно запускать повторно.

ВАЖНО: запускать ТОЛЬКО ПОСЛЕ того, как фронт перестал ссылаться на эти поля
(т.е. откатил коммиты 2 и 3). Иначе старый фронт будет получать KeyError из
_result_out при чтении и падать на отправке этих полей в PATCH.

Запустить на сервере:
  sudo docker compose exec backend python /app/migrations/rollback_competition_result_toggles.py
"""

import sys
sys.path.insert(0, '/app')

from app.core.database import engine
from sqlalchemy import text

DROP_COLUMNS = [
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
    for col in DROP_COLUMNS:
        try:
            conn.execute(text(
                f"ALTER TABLE competition_results DROP COLUMN IF EXISTS {col}"
            ))
            print(f"OK  competition_results.{col} dropped (or did not exist)")
        except Exception as e:
            print(f"ERR competition_results.{col}: {e}")
    conn.commit()
    print("Rollback finished.")
