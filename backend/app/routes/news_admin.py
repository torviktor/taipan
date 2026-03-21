# backend/app/routes/news_admin.py
# Роут для ручного запуска парсеров новостей из кабинета тренера

from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/news-admin", tags=["news-admin"])


def require_manager(u: User = Depends(get_current_user)) -> User:
    if u.role not in ("manager", "admin"):
        raise HTTPException(403, "Недостаточно прав")
    return u


@router.post("/fetch-telegram")
def fetch_telegram(user: User = Depends(require_manager)):
    """Вручную запустить парсинг Telegram ГТФ России."""
    try:
        from app.tasks.news_fetcher import run_telegram_fetch
        count = run_telegram_fetch()
        return {"ok": True, "imported": count, "source": "Telegram ГТФ России"}
    except Exception as e:
        raise HTTPException(500, f"Ошибка парсинга: {str(e)}")


@router.post("/fetch-dss")
def fetch_dss(user: User = Depends(require_manager)):
    """Вручную запустить парсинг новостей дворца спорта."""
    try:
        from app.tasks.news_fetcher import run_dss_fetch
        count = run_dss_fetch()
        return {"ok": True, "imported": count, "source": "Дворец спорта Надежда"}
    except Exception as e:
        raise HTTPException(500, f"Ошибка парсинга: {str(e)}")
