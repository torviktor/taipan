# backend/app/routes/news_routes.py

import os, uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.news import News

router = APIRouter(prefix="/news", tags=["news"])

UPLOAD_DIR = "/app/static/news"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}
MAX_SIZE    = 10 * 1024 * 1024


def require_manager(u: User = Depends(get_current_user)) -> User:
    if u.role not in ("manager", "admin"):
        raise HTTPException(403, "Недостаточно прав")
    return u


class NewsCreate(BaseModel):
    title:          str
    body:           str
    competition_id: Optional[int] = None

class NewsUpdate(BaseModel):
    title: Optional[str] = None
    body:  Optional[str] = None


def _out(n: News) -> dict:
    return {
        "id":             n.id,
        "title":          n.title,
        "body":           n.body,
        "photo_url":      n.photo_url,
        "published_at":   str(n.published_at),
        "competition_id": n.competition_id,
        "author":         n.author.full_name if n.author else None,
    }


@router.get("")
def list_news(limit: int = 20, offset: int = 0, db: Session = Depends(get_db)):
    items = db.query(News).filter(News.is_published == True).order_by(News.published_at.desc()).offset(offset).limit(limit).all()
    total = db.query(News).filter(News.is_published == True).count()
    return {"items": [_out(n) for n in items], "total": total}


@router.get("/{news_id}")
def get_news(news_id: int, db: Session = Depends(get_db)):
    n = db.query(News).filter(News.id == news_id, News.is_published == True).first()
    if not n: raise HTTPException(404, "Новость не найдена")
    return _out(n)


@router.post("", status_code=201)
def create_news(data: NewsCreate, db: Session = Depends(get_db), user: User = Depends(require_manager)):
    if data.competition_id:
        existing = db.query(News).filter(News.competition_id == data.competition_id, News.is_published == True).first()
        if existing: raise HTTPException(400, "Новость об этом соревновании уже опубликована")
    n = News(title=data.title, body=data.body, competition_id=data.competition_id, created_by=user.id)
    db.add(n); db.commit(); db.refresh(n)
    return _out(n)


@router.patch("/{news_id}")
def update_news(news_id: int, data: NewsUpdate, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    n = db.query(News).filter(News.id == news_id).first()
    if not n: raise HTTPException(404, "Новость не найдена")
    if data.title is not None: n.title = data.title
    if data.body  is not None: n.body  = data.body
    db.commit(); db.refresh(n)
    return _out(n)


@router.post("/{news_id}/photo")
def upload_photo(news_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), _: User = Depends(require_manager)):
    n = db.query(News).filter(News.id == news_id).first()
    if not n: raise HTTPException(404, "Новость не найдена")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXT: raise HTTPException(400, f"Формат {ext} не поддерживается")
    contents = file.file.read()
    if len(contents) > MAX_SIZE: raise HTTPException(400, "Файл слишком большой (макс. 10 МБ)")
    if n.photo_url:
        old = f"/app/static/news/{os.path.basename(n.photo_url)}"
        if os.path.exists(old): os.remove(old)
    stored = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(UPLOAD_DIR, stored), "wb") as f: f.write(contents)
    n.photo_url = f"/static/news/{stored}"
    db.commit()
    return _out(n)


@router.delete("/{news_id}/photo", status_code=204)
def delete_photo(news_id: int, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    n = db.query(News).filter(News.id == news_id).first()
    if not n: raise HTTPException(404)
    if n.photo_url:
        path = f"/app/static/news/{os.path.basename(n.photo_url)}"
        if os.path.exists(path): os.remove(path)
        n.photo_url = None
        db.commit()


@router.delete("/{news_id}", status_code=204)
def delete_news(news_id: int, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    n = db.query(News).filter(News.id == news_id).first()
    if not n: raise HTTPException(404, "Новость не найдена")
    if n.photo_url:
        path = f"/app/static/news/{os.path.basename(n.photo_url)}"
        if os.path.exists(path): os.remove(path)
    db.delete(n); db.commit()


@router.post("/from-competition/{comp_id}", status_code=201)
def news_from_competition(comp_id: int, db: Session = Depends(get_db), user: User = Depends(require_manager)):
    from app.models.competition import Competition, CompetitionResult
    from app.models.user import Athlete

    comp = db.query(Competition).filter(Competition.id == comp_id).first()
    if not comp: raise HTTPException(404, "Соревнование не найдено")

    existing = db.query(News).filter(News.competition_id == comp_id, News.is_published == True).first()
    if existing: raise HTTPException(400, "Новость об этом соревновании уже опубликована")

    # Без фильтра по статусу — берём всех у кого есть места
    results = db.query(CompetitionResult).filter(CompetitionResult.competition_id == comp_id).all()

    date_str = comp.date.strftime("%d.%m.%Y") if comp.date else ""
    gold = silver = bronze = 0
    medals = []
    participants = []

    for r in results:
        athlete = db.query(Athlete).filter(Athlete.id == r.athlete_id).first()
        if not athlete: continue
        participants.append(athlete.full_name)
        places = []
        for disc, place in [("спарринг", r.sparring_place), ("стоп-балл", r.stopball_place), ("тег-тим", r.tegtim_place), ("туль", r.tuli_place)]:
            if place == 1:   gold += 1;   places.append(f"1 место ({disc})")
            elif place == 2: silver += 1; places.append(f"2 место ({disc})")
            elif place == 3: bronze += 1; places.append(f"3 место ({disc})")
        if places:
            medals.append(f"{athlete.full_name} — {', '.join(places)}")

    location_str = f" в {comp.location}" if comp.location else ""
    level_str    = f"{comp.level} {comp.comp_type}".lower()
    title        = f"{comp.name} — {date_str}"

    body_parts = [f"{date_str} наши спортсмены приняли участие в {level_str}{location_str}.", "", f"Соревнование: {comp.name}", f"Дата: {date_str}"]
    if comp.location: body_parts.append(f"Место проведения: {comp.location}")
    body_parts.append("")

    if participants:
        body_parts.append(f"В соревнованиях участвовали {len(participants)} спортсменов клуба «Тайпан»:")
        for p in participants: body_parts.append(f"• {p}")
        body_parts.append("")

    total_medals = gold + silver + bronze
    if total_medals > 0:
        def medal_word(n):
            if n == 1: return "медаль"
            if n < 5:  return "медали"
            return "медалей"
        parts = []
        if gold:   parts.append(f"{gold} золот{'ая' if gold==1 else 'ых'}")
        if silver: parts.append(f"{silver} серебрян{'ая' if silver==1 else 'ых'}")
        if bronze: parts.append(f"{bronze} бронзов{'ая' if bronze==1 else 'ых'}")
        body_parts.append(f"Наши спортсмены завоевали {total_medals} {medal_word(total_medals)}: {', '.join(parts)}.")
        body_parts.append("")
        body_parts.append("Призовые места:")
        for m in medals: body_parts.append(f"• {m}")
        body_parts.append("")
        body_parts.append("Поздравляем наших спортсменов с заслуженными наградами! Продолжаем работать и идти вперёд.")
    else:
        body_parts.append("Наши спортсмены достойно выступили и набрали опыт участия в соревнованиях. Продолжаем работать!")

    n = News(title=title, body="\n".join(body_parts), competition_id=comp_id, created_by=user.id)
    db.add(n); db.commit(); db.refresh(n)
    return _out(n)
