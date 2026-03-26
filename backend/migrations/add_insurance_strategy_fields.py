"""
Миграция: добавить поля insurance_expiry (дата страховки спортсмена)
и strategy_items (JSON чеклист тренера) в БД.

Запустить на сервере:
  sudo docker compose exec backend python /app/migrations/add_insurance_strategy_fields.py
"""

import sys
sys.path.insert(0, '/app')

from app.core.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    # Дата окончания страховки — на каждого спортсмена
    try:
        conn.execute(text("ALTER TABLE athletes ADD COLUMN insurance_expiry DATE"))
        print("✅ athletes.insurance_expiry добавлено")
    except Exception as e:
        print(f"ℹ️  athletes.insurance_expiry: {e}")

    # JSON-чеклист стратегии тренера — на пользователя (менеджер/админ)
    try:
        conn.execute(text("ALTER TABLE users ADD COLUMN strategy_items TEXT DEFAULT '[]'"))
        print("✅ users.strategy_items добавлено")
    except Exception as e:
        print(f"ℹ️  users.strategy_items: {e}")

    conn.commit()
    print("Миграция завершена.")
