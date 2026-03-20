# backend/app/routes/competition_files.py

import os, uuid, shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.competition import Competition
from app.models.competition_file import CompetitionFile

router = APIRouter(prefix="/competitions", tags=["competition-files"])

UPLOAD_DIR = "/app/static/competition-files"
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 МБ

ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".txt", ".png", ".jpg", ".jpeg", ".zip", ".rar"
}


def require_manager(u: User = Depends(get_current_user)) -> User:
    if u.role not in ("manager", "admin"):
        raise HTTPException(403, "Недостаточно прав")
    return u


# ── Список файлов соревнования ────────────────────────────────────────────────

@router.get("/{comp_id}/files")
def list_files(
    comp_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user)
):
    comp = db.query(Competition).filter(Competition.id == comp_id).first()
    if not comp:
        raise HTTPException(404, "Соревнование не найдено")

    files = db.query(CompetitionFile)\
        .filter(CompetitionFile.competition_id == comp_id)\
        .order_by(CompetitionFile.uploaded_at.asc())\
        .all()

    return [_file_out(f) for f in files]


# ── Загрузить файл ────────────────────────────────────────────────────────────

@router.post("/{comp_id}/files", status_code=201)
def upload_file(
    comp_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_manager)
):
    comp = db.query(Competition).filter(Competition.id == comp_id).first()
    if not comp:
        raise HTTPException(404, "Соревнование не найдено")

    # Проверяем расширение
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Формат {ext} не поддерживается")

    # Проверяем размер
    contents = file.file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(400, "Файл слишком большой (макс. 20 МБ)")
    file.file.seek(0)

    # Сохраняем на диск
    stored_name = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, stored_name)
    with open(filepath, "wb") as f:
        f.write(contents)

    # Сохраняем в БД
    cf = CompetitionFile(
        competition_id=comp_id,
        filename=file.filename,
        stored_name=stored_name,
        file_url=f"/static/competition-files/{stored_name}",
        uploaded_by=user.id,
    )
    db.add(cf)
    db.commit()
    db.refresh(cf)

    return _file_out(cf)


# ── Удалить файл ──────────────────────────────────────────────────────────────

@router.delete("/{comp_id}/files/{file_id}", status_code=204)
def delete_file(
    comp_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_manager)
):
    cf = db.query(CompetitionFile).filter(
        CompetitionFile.id == file_id,
        CompetitionFile.competition_id == comp_id
    ).first()
    if not cf:
        raise HTTPException(404, "Файл не найден")

    # Удаляем с диска
    filepath = os.path.join(UPLOAD_DIR, cf.stored_name)
    if os.path.exists(filepath):
        os.remove(filepath)

    db.delete(cf)
    db.commit()


# ── Хелпер ───────────────────────────────────────────────────────────────────

def _file_out(f: CompetitionFile):
    return {
        "id":           f.id,
        "competition_id": f.competition_id,
        "filename":     f.filename,
        "file_url":     f.file_url,
        "uploaded_at":  str(f.uploaded_at),
    }
