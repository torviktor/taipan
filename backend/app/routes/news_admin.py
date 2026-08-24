# backend/app/routes/news_admin.py

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_user, require_manager
from app.models.user import User

router = APIRouter(prefix="/news-admin", tags=["news-admin"])




@router.post("/fetch-dss")
def fetch_dss(user: User = Depends(require_manager)):
    try:
        from app.tasks.news_fetcher import run_dss_fetch
        count = run_dss_fetch()
        return {"ok": True, "imported": count, "source": "Дворец спорта Надежда"}
    except Exception as e:
        raise HTTPException(500, f"Ошибка парсинга: {str(e)}")


@router.post("/fetch-vk")
def fetch_vk(user: User = Depends(require_manager)):
    try:
        from app.tasks.vk_fetcher import run_vk_fetch
        count = run_vk_fetch()
        return {"ok": True, "imported": count, "source": "ВКонтакте"}
    except Exception as e:
        raise HTTPException(500, f"Ошибка парсинга VK: {str(e)}")
