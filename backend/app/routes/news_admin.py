# backend/app/routes/news_admin.py

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/news-admin", tags=["news-admin"])


def require_manager(u: User = Depends(get_current_user)) -> User:
    if u.role not in ("manager", "admin"):
        raise HTTPException(403, "Недостаточно прав")
    return u


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


class CompNewsRequest(BaseModel):
    comp_id: int

@router.post("/generate-comp-news")
def generate_comp_news(data: CompNewsRequest, user: User = Depends(require_manager)):
    try:
        from app.tasks.yandex_gpt import run_competition_news
        ok = run_competition_news(data.comp_id)
        if ok:
            return {"ok": True, "message": "Новость сгенерирована и опубликована"}
        else:
            return {"ok": False, "message": "Новость уже существует или нет данных"}
    except Exception as e:
        raise HTTPException(500, f"Ошибка генерации: {str(e)}")


@router.post("/generate-announcement")
def generate_announcement(user: User = Depends(require_manager)):
    try:
        from app.tasks.yandex_gpt import run_weekly_announcement
        ok = run_weekly_announcement()
        if ok:
            return {"ok": True, "message": "Анонс сгенерирован и опубликован"}
        else:
            return {"ok": False, "message": "Нет предстоящих соревнований"}
    except Exception as e:
        raise HTTPException(500, f"Ошибка генерации: {str(e)}")
