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
    title:            str
    body:             str
    competition_id:   Optional[int] = None
    certification_id: Optional[int] = None
    camp_id:          Optional[int] = None


class NewsUpdate(BaseModel):
    title: Optional[str] = None
    body:  Optional[str] = None


def _out(n: News) -> dict:
    return {
        "id":               n.id,
        "title":            n.title,
        "body":             n.body,
        "photo_url":        n.photo_url,
        "published_at":     str(n.published_at),
        "competition_id":   n.competition_id,
        "certification_id": n.certification_id,
        "camp_id":          n.camp_id,
        "author":           n.author.full_name if n.author else None,
    }


def _rank_label(gup: Optional[int], dan: Optional[int]) -> str:
    """Читаемое обозначение гыпа/дана."""
    if dan:
        suffixes = {1:"1-й дан",2:"2-й дан",3:"3-й дан",4:"4-й дан",
                    5:"5-й дан",6:"6-й дан",7:"7-й дан",8:"8-й дан",9:"9-й дан"}
        return suffixes.get(dan, f"{dan}-й дан")
    if gup == 0:
        return "без пояса"
    if gup:
        return f"{gup}-й гып"
    return "—"


def _athlete_word(n: int) -> str:
    if n % 10 == 1 and n % 100 != 11:  return "спортсмен"
    if 2 <= n % 10 <= 4 and not (12 <= n % 100 <= 14): return "спортсмена"
    return "спортсменов"


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
    if data.certification_id:
        existing = db.query(News).filter(News.certification_id == data.certification_id, News.is_published == True).first()
        if existing: raise HTTPException(400, "Новость об этой аттестации уже опубликована")
    if data.camp_id:
        existing = db.query(News).filter(News.camp_id == data.camp_id, News.is_published == True).first()
        if existing: raise HTTPException(400, "Новость об этих сборах уже опубликована")

    n = News(
        title=data.title, body=data.body,
        competition_id=data.competition_id,
        certification_id=data.certification_id,
        camp_id=data.camp_id,
        created_by=user.id
    )
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


# ─── from-competition ────────────────────────────────────────────────────────

@router.post("/from-competition/{comp_id}", status_code=201)
def news_from_competition(comp_id: int, db: Session = Depends(get_db), user: User = Depends(require_manager)):
    from app.models.competition import Competition, CompetitionResult
    from app.models.user import Athlete

    comp = db.query(Competition).filter(Competition.id == comp_id).first()
    if not comp: raise HTTPException(404, "Соревнование не найдено")

    existing = db.query(News).filter(News.competition_id == comp_id, News.is_published == True).first()
    if existing: raise HTTPException(400, "Новость об этом соревновании уже опубликована")

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
        body_parts.append(f"В соревнованиях участвовали {len(participants)} {_athlete_word(len(participants))} клуба «Тайпан»:")
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


# ─── from-certification ──────────────────────────────────────────────────────

@router.post("/from-certification/{cert_id}", status_code=201)
def news_from_certification(cert_id: int, db: Session = Depends(get_db), user: User = Depends(require_manager)):
    from app.models.certification import Certification, CertificationResult
    from app.models.user import Athlete

    cert = db.query(Certification).filter(Certification.id == cert_id).first()
    if not cert: raise HTTPException(404, "Аттестация не найдена")

    existing = db.query(News).filter(News.certification_id == cert_id, News.is_published == True).first()
    if existing: raise HTTPException(400, "Новость об этой аттестации уже опубликована")

    all_results    = db.query(CertificationResult).filter(CertificationResult.certification_id == cert_id).all()
    passed_results = [r for r in all_results if r.passed is True]

    date_str = cert.date.strftime("%d.%m.%Y") if cert.date else ""
    title    = f"{cert.name} — {date_str}"

    # Собираем строки по сдавшим
    passed_lines = []
    for r in passed_results:
        athlete = db.query(Athlete).filter(Athlete.id == r.athlete_id).first()
        if not athlete: continue
        rank = _rank_label(r.target_gup, r.target_dan)
        passed_lines.append(f"{athlete.full_name} — {rank}")

    total        = len(all_results)
    passed_count = len(passed_lines)
    location_str = f" в {cert.location}" if cert.location else ""

    body_parts = [
        f"{date_str} в клубе «Тайпан»{location_str} прошла аттестация.",
        "",
        f"Аттестация: {cert.name}",
        f"Дата: {date_str}",
    ]
    if cert.location:
        body_parts.append(f"Место проведения: {cert.location}")
    body_parts.append("")

    body_parts.append(f"К аттестации приступили {total} {_athlete_word(total)}.")
    body_parts.append("")

    if passed_lines:
        body_parts.append(f"Успешно сдали {passed_count} {_athlete_word(passed_count)}:")
        for line in passed_lines:
            body_parts.append(f"• {line}")
        body_parts.append("")
        body_parts.append("Поздравляем с новыми поясами! Продолжаем расти и совершенствоваться.")
    else:
        body_parts.append("В этот раз никто из участников не подтвердил допуск к следующему поясу. Продолжаем тренироваться!")

    if cert.notes:
        body_parts.append("")
        body_parts.append(cert.notes)

    n = News(title=title, body="\n".join(body_parts), certification_id=cert_id, created_by=user.id)
    db.add(n); db.commit(); db.refresh(n)
    return _out(n)


# ─── from-camp ───────────────────────────────────────────────────────────────

@router.post("/from-camp/{camp_id}", status_code=201)
def news_from_camp(camp_id: int, db: Session = Depends(get_db), user: User = Depends(require_manager)):
    from app.models.camp import Camp, CampParticipant
    from app.models.user import Athlete

    camp = db.query(Camp).filter(Camp.id == camp_id).first()
    if not camp: raise HTTPException(404, "Сборы не найдены")

    existing = db.query(News).filter(News.camp_id == camp_id, News.is_published == True).first()
    if existing: raise HTTPException(400, "Новость об этих сборах уже опубликована")

    participants = db.query(CampParticipant).filter(
        CampParticipant.camp_id == camp_id,
        CampParticipant.status.in_(["confirmed", "paid"])
    ).all()

    date_start_str = camp.date_start.strftime("%d.%m.%Y") if camp.date_start else ""
    date_end_str   = camp.date_end.strftime("%d.%m.%Y")   if camp.date_end   else ""
    date_range     = f"{date_start_str} – {date_end_str}" if date_start_str and date_end_str else date_start_str or date_end_str

    title = f"{camp.name} — {date_range}"

    names = []
    for p in participants:
        athlete = db.query(Athlete).filter(Athlete.id == p.athlete_id).first()
        if athlete:
            names.append(athlete.full_name)

    count        = len(names)
    location_str = f" в {camp.location}" if camp.location else ""

    body_parts = [
        f"С {date_range} прошли учебно-тренировочные сборы{location_str}.",
        "",
        f"Сборы: {camp.name}",
        f"Даты: {date_range}",
    ]
    if camp.location:
        body_parts.append(f"Место проведения: {camp.location}")
    body_parts.append("")

    if count > 0:
        body_parts.append(f"В сборах принял участие {count} {_athlete_word(count)} клуба «Тайпан»:")
        for name in names:
            body_parts.append(f"• {name}")
        body_parts.append("")
        body_parts.append("Интенсивные тренировки прошли продуктивно. Спасибо всем участникам за труд и самоотдачу!")
    else:
        body_parts.append("Информация об участниках уточняется.")

    if camp.notes:
        body_parts.append("")
        body_parts.append(camp.notes)

    n = News(title=title, body="\n".join(body_parts), camp_id=camp_id, created_by=user.id)
    db.add(n); db.commit(); db.refresh(n)
    return _out(n)
