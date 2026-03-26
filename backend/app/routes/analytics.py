# backend/app/routes/analytics.py
# Эндпоинт для скачивания файлов аналитики с правильным Content-Disposition
# Добавить в main.py: from app.routes.analytics import router as analytics_router
# и: app.include_router(analytics_router, prefix="/api", tags=["Аналитика"])

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
import os

from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/analytics", tags=["Аналитика"])

ANALYTICS_DIR = "/app/static/analytics"


@router.get("/download/{filename}")
def download_analytics_file(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    """Отдать файл аналитики с правильным заголовком для скачивания."""
    # Безопасность: запрещаем path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(400, "Недопустимое имя файла")

    filepath = os.path.join(ANALYTICS_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(404, "Файл не найден")

    # Определяем media_type по расширению
    ext = os.path.splitext(filename)[1].lower()
    media_types = {
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.pdf':  'application/pdf',
        '.csv':  'text/csv; charset=utf-8',
    }
    media_type = media_types.get(ext, 'application/octet-stream')

    return FileResponse(
        path=filepath,
        media_type=media_type,
        filename=filename,          # Этот параметр добавляет Content-Disposition: attachment
        headers={"X-Content-Type-Options": "nosniff"}
    )
