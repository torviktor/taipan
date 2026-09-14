# backend/app/routes/transcribe.py
#
# Транскрибация записей совещаний (задача 30). Сайт сам ничего не
# распознаёт — только принимает файл, кладёт его в общий inbox-каталог
# (bind-mount, единственный канал до бота-транскрайбера /opt/transcriber,
# сети между собой не видят друг друга) и ждёт колбэк. Бот сам конвертирует
# ffmpeg'ом и шлёт в Yandex SpeechKit — на сайте ни ffmpeg, ни ключей
# движка распознавания нет и не должно быть.

import hashlib
import hmac
import json
import logging
import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_admin
from app.models.user import User
from app.models.transcription import TranscriptionJob

log = logging.getLogger(__name__)

router = APIRouter(prefix="/transcribe", tags=["Транскрибация"])

INBOX_DIR = os.getenv("TRANSCRIBE_INBOX_DIR", "/data/transcribe_inbox")
CALLBACK_SECRET = os.getenv("TRANSCRIBE_CALLBACK_SECRET", "")
MAX_SIZE_MB = int(os.getenv("TRANSCRIBE_MAX_SIZE_MB", "2048"))
CHUNK_SIZE = 1024 * 1024  # 1 МБ за раз — на 1.9 ГБ RAM сервера file.read() целиком недопустим

os.makedirs(INBOX_DIR, exist_ok=True)


class CallbackBody(BaseModel):
    job_id: str
    status: str
    text: str | None = None
    duration_sec: int | None = None
    error: str | None = None


def _job_out(j: TranscriptionJob) -> dict:
    return {
        "id":            str(j.id),
        "original_name": j.original_name,
        "size_bytes":    j.size_bytes,
        "duration_sec":  j.duration_sec,
        "status":        j.status,
        "text":          j.text,
        "error":         j.error,
        "created_at":    j.created_at.isoformat() if j.created_at else None,
        "finished_at":   j.finished_at.isoformat() if j.finished_at else None,
    }


def _callback_url() -> str:
    site_url = os.getenv("SITE_URL", "https://taipan-tkd.ru")
    return f"{site_url}/api/transcribe/callback"


def _cleanup_inbox_for(job_id: str) -> None:
    """Подчистить inbox по job_id — бот должен был убрать сам, это страховка."""
    try:
        for name in os.listdir(INBOX_DIR):
            if name.startswith(job_id):
                try:
                    os.remove(os.path.join(INBOX_DIR, name))
                except OSError:
                    log.warning("transcribe: не удалось удалить %s из inbox", name)
    except OSError:
        pass


# ── Загрузить запись ────────────────────────────────────────────────────────

@router.post("/upload", status_code=201)
def upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):
    active = db.query(TranscriptionJob).filter(
        TranscriptionJob.user_id == user.id,
        TranscriptionJob.status.in_(("uploaded", "processing")),
    ).first()
    if active:
        raise HTTPException(409, "Уже есть необработанное задание — дождитесь его завершения")

    ext = os.path.splitext(file.filename or "")[1].lower() or ".bin"
    job_id = uuid.uuid4()
    part_path = os.path.join(INBOX_DIR, f"{job_id}.part")
    final_path = os.path.join(INBOX_DIR, f"{job_id}{ext}")
    max_bytes = MAX_SIZE_MB * 1024 * 1024

    size = 0
    try:
        with open(part_path, "wb") as out:
            while True:
                chunk = file.file.read(CHUNK_SIZE)
                if not chunk:
                    break
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(400, f"Файл больше {MAX_SIZE_MB} МБ")
                out.write(chunk)
    except HTTPException:
        if os.path.exists(part_path):
            os.remove(part_path)
        raise
    except Exception:
        if os.path.exists(part_path):
            os.remove(part_path)
        log.exception("transcribe/upload: запись файла упала")
        raise HTTPException(500, "Не удалось сохранить файл")

    # Атомарное переименование — гарантия, что бот увидит .json только тогда,
    # когда аудио уже дописано целиком.
    os.rename(part_path, final_path)

    sidecar = {
        "job_id":         str(job_id),
        "original_name":  file.filename,
        "callback_url":   _callback_url(),
        "signature_alg":  "HMAC-SHA256",
    }
    with open(os.path.join(INBOX_DIR, f"{job_id}.json"), "w", encoding="utf-8") as f:
        json.dump(sidecar, f, ensure_ascii=False)

    job = TranscriptionJob(
        id=job_id,
        user_id=user.id,
        original_name=file.filename or f"{job_id}{ext}",
        size_bytes=size,
        status="uploaded",
    )
    db.add(job)
    db.commit()

    return {"job_id": str(job_id)}


# ── Список и статус заданий (только свои) ───────────────────────────────────

@router.get("/jobs")
def list_jobs(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    jobs = db.query(TranscriptionJob) \
        .filter(TranscriptionJob.user_id == user.id) \
        .order_by(TranscriptionJob.created_at.desc()) \
        .all()
    return [_job_out(j) for j in jobs]


@router.get("/jobs/{job_id}")
def get_job(job_id: str, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    j = db.query(TranscriptionJob).filter(
        TranscriptionJob.id == job_id, TranscriptionJob.user_id == user.id
    ).first()
    if not j:
        raise HTTPException(404, "Задание не найдено")
    return _job_out(j)


@router.delete("/jobs/{job_id}", status_code=204)
def delete_job(job_id: str, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    j = db.query(TranscriptionJob).filter(
        TranscriptionJob.id == job_id, TranscriptionJob.user_id == user.id
    ).first()
    if not j:
        raise HTTPException(404, "Задание не найдено")
    db.delete(j)
    db.commit()
    _cleanup_inbox_for(job_id)


# ── Колбэк от бота (без JWT, по HMAC) ────────────────────────────────────────

@router.post("/callback")
async def callback(request: Request, db: Session = Depends(get_db)):
    raw = await request.body()

    if not CALLBACK_SECRET:
        log.error("transcribe/callback: TRANSCRIBE_CALLBACK_SECRET не задан — колбэк отклонён")
        raise HTTPException(403, "Callback не настроен")

    sig = request.headers.get("X-Signature", "")
    expected = hmac.new(CALLBACK_SECRET.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        raise HTTPException(403, "Неверная подпись")

    body = CallbackBody.model_validate_json(raw)
    try:
        uuid.UUID(body.job_id)
    except ValueError:
        raise HTTPException(400, "job_id не UUID")

    j = db.query(TranscriptionJob).filter(TranscriptionJob.id == body.job_id).first()
    if not j or j.status not in ("uploaded", "processing"):
        # Нет записи (удалена пользователем/подчищена по TTL) или задание уже
        # закрыто — повторный/запоздавший колбэк тихо игнорируем, без 4xx:
        # боту незачем ретраить то, что уже неактуально.
        _cleanup_inbox_for(body.job_id)
        return {"ok": True}

    if body.status == "error":
        j.status = "error"
        j.error = body.error or "Неизвестная ошибка распознавания"
    else:
        j.status = "done"
        j.text = body.text
        j.duration_sec = body.duration_sec
    j.finished_at = datetime.now(timezone.utc)
    db.commit()

    _cleanup_inbox_for(body.job_id)
    return {"ok": True}
