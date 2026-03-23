# backend/app/routes/news_admin.py

import os, requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.news import News

router = APIRouter(prefix="/news-admin", tags=["news-admin"])

YANDEX_API_KEY   = os.getenv("YANDEX_API_KEY", "")
YANDEX_FOLDER_ID = os.getenv("YANDEX_FOLDER_ID", "")
YANDEX_GPT_URL   = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"


def require_manager(u: User = Depends(get_current_user)) -> User:
    if u.role not in ("manager", "admin"):
        raise HTTPException(403, "Недостаточно прав")
    return u


def _yandex_gpt(prompt: str) -> str:
    """Отправляет промт в YandexGPT и возвращает текст ответа."""
    if not YANDEX_API_KEY or not YANDEX_FOLDER_ID:
        raise RuntimeError("Не заданы YANDEX_API_KEY / YANDEX_FOLDER_ID в переменных окружения")

    payload = {
        "modelUri": f"gpt://{YANDEX_FOLDER_ID}/yandexgpt-lite",
        "completionOptions": {
            "stream": False,
            "temperature": 0.6,
            "maxTokens": 1500,
        },
        "messages": [
            {
                "role": "system",
                "text": (
                    "Ты — редактор сайта спортивного клуба тхэквондо «Тайпан». "
                    "Пишешь короткие, живые новости в прошедшем времени. "
                    "Без эмодзи, без заголовков Markdown, только чистый текст. "
                    "Тон — позитивный, официально-дружелюбный."
                ),
            },
            {"role": "user", "text": prompt},
        ],
    }
    headers = {
        "Authorization": f"Api-Key {YANDEX_API_KEY}",
        "Content-Type":  "application/json",
    }
    resp = requests.post(YANDEX_GPT_URL, json=payload, headers=headers, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return data["result"]["alternatives"][0]["message"]["text"].strip()


def _rank_label(gup: Optional[int], dan: Optional[int]) -> str:
    if dan:
        suffixes = {1:"1-й дан",2:"2-й дан",3:"3-й дан",4:"4-й дан",
                    5:"5-й дан",6:"6-й дан",7:"7-й дан",8:"8-й дан",9:"9-й дан"}
        return suffixes.get(dan, f"{dan}-й дан")
    if gup == 0: return "без пояса"
    if gup:      return f"{gup}-й гып"
    return "—"


def _athlete_word(n: int) -> str:
    if n % 10 == 1 and n % 100 != 11:  return "спортсмен"
    if 2 <= n % 10 <= 4 and not (12 <= n % 100 <= 14): return "спортсмена"
    return "спортсменов"


def _out(n: News) -> dict:
    return {
        "id": n.id, "title": n.title, "body": n.body,
        "photo_url": n.photo_url, "published_at": str(n.published_at),
        "competition_id": n.competition_id,
        "certification_id": n.certification_id,
        "camp_id": n.camp_id,
        "author": n.author.full_name if n.author else None,
    }


# ─── существующие роуты ───────────────────────────────────────────────────────

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


# ─── generate-cert-news ───────────────────────────────────────────────────────

class CertNewsRequest(BaseModel):
    cert_id: int

@router.post("/generate-cert-news")
def generate_cert_news(
    data: CertNewsRequest,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_manager),
):
    from app.models.certification import Certification, CertificationResult
    from app.models.user import Athlete

    cert = db.query(Certification).filter(Certification.id == data.cert_id).first()
    if not cert:
        raise HTTPException(404, "Аттестация не найдена")

    existing = db.query(News).filter(
        News.certification_id == data.cert_id,
        News.is_published == True
    ).first()
    if existing:
        return {"ok": False, "message": "Новость об этой аттестации уже опубликована"}

    all_results    = db.query(CertificationResult).filter(
        CertificationResult.certification_id == data.cert_id
    ).all()
    passed_results = [r for r in all_results if r.passed is True]

    date_str = cert.date.strftime("%d.%m.%Y") if cert.date else ""

    passed_lines = []
    for r in passed_results:
        athlete = db.query(Athlete).filter(Athlete.id == r.athlete_id).first()
        if not athlete: continue
        rank = _rank_label(r.target_gup, r.target_dan)
        passed_lines.append(f"{athlete.full_name} — {rank}")

    total        = len(all_results)
    passed_count = len(passed_lines)
    location_str = f" в {cert.location}" if cert.location else ""

    prompt_parts = [
        f"Напиши новость для сайта спортивного клуба тхэквондо «Тайпан» об аттестации.",
        f"",
        f"Данные аттестации:",
        f"Название: {cert.name}",
        f"Дата: {date_str}",
    ]
    if cert.location:
        prompt_parts.append(f"Место проведения: {cert.location}")
    prompt_parts += [
        f"",
        f"Всего участвовали: {total} {_athlete_word(total)}.",
        f"Успешно сдали: {passed_count} {_athlete_word(passed_count)}.",
    ]
    if passed_lines:
        prompt_parts.append("Кто и на какой пояс сдал:")
        for line in passed_lines:
            prompt_parts.append(f"- {line}")
    if cert.notes:
        prompt_parts += ["", f"Дополнительно: {cert.notes}"]

    prompt_parts += [
        "",
        "Требования к тексту:",
        "— прошедшее время, свершившийся факт",
        "— не более 200 слов",
        "— без Markdown, без эмодзи",
        "— первый абзац — краткое резюме события",
        "— перечисли всех сдавших по имени с поясом",
        "— завершить мотивирующей фразой",
    ]

    try:
        body = _yandex_gpt("\n".join(prompt_parts))
    except Exception as e:
        raise HTTPException(500, f"Ошибка YandexGPT: {str(e)}")

    title = f"{cert.name} — {date_str}"
    n = News(title=title, body=body, certification_id=data.cert_id, created_by=user.id)
    db.add(n); db.commit(); db.refresh(n)
    return {"ok": True, "message": "Новость сгенерирована и опубликована", "news": _out(n)}


# ─── generate-camp-news ───────────────────────────────────────────────────────

class CampNewsRequest(BaseModel):
    camp_id: int

@router.post("/generate-camp-news")
def generate_camp_news(
    data: CampNewsRequest,
    db:   Session = Depends(get_db),
    user: User    = Depends(require_manager),
):
    from app.models.camp import Camp, CampParticipant
    from app.models.user import Athlete

    camp = db.query(Camp).filter(Camp.id == data.camp_id).first()
    if not camp:
        raise HTTPException(404, "Сборы не найдены")

    existing = db.query(News).filter(
        News.camp_id == data.camp_id,
        News.is_published == True
    ).first()
    if existing:
        return {"ok": False, "message": "Новость об этих сборах уже опубликована"}

    participants = db.query(CampParticipant).filter(
        CampParticipant.camp_id == data.camp_id,
        CampParticipant.status.in_(["confirmed", "paid"])
    ).all()

    date_start_str = camp.date_start.strftime("%d.%m.%Y") if camp.date_start else ""
    date_end_str   = camp.date_end.strftime("%d.%m.%Y")   if camp.date_end   else ""
    date_range     = f"{date_start_str} – {date_end_str}" if date_start_str and date_end_str else date_start_str or date_end_str

    names = []
    for p in participants:
        athlete = db.query(Athlete).filter(Athlete.id == p.athlete_id).first()
        if athlete:
            names.append(athlete.full_name)

    count = len(names)

    prompt_parts = [
        f"Напиши новость для сайта спортивного клуба тхэквондо «Тайпан» об учебно-тренировочных сборах.",
        f"",
        f"Данные сборов:",
        f"Название: {camp.name}",
        f"Даты: {date_range}",
    ]
    if camp.location:
        prompt_parts.append(f"Место проведения: {camp.location}")
    if camp.price:
        prompt_parts.append(f"Стоимость участия: {camp.price} руб.")
    prompt_parts += [
        f"",
        f"Участвовали: {count} {_athlete_word(count)} клуба.",
    ]
    if names:
        prompt_parts.append("Список участников:")
        for name in names:
            prompt_parts.append(f"- {name}")
    if camp.notes:
        prompt_parts += ["", f"Дополнительно: {camp.notes}"]

    prompt_parts += [
        "",
        "Требования к тексту:",
        "— прошедшее время, свершившийся факт",
        "— не более 200 слов",
        "— без Markdown, без эмодзи",
        "— первый абзац — краткое резюме события",
        "— упомяни всех участников",
        "— завершить благодарностью участникам и мотивирующей фразой",
    ]

    try:
        body = _yandex_gpt("\n".join(prompt_parts))
    except Exception as e:
        raise HTTPException(500, f"Ошибка YandexGPT: {str(e)}")

    title = f"{camp.name} — {date_range}"
    n = News(title=title, body=body, camp_id=data.camp_id, created_by=user.id)
    db.add(n); db.commit(); db.refresh(n)
    return {"ok": True, "message": "Новость сгенерирована и опубликована", "news": _out(n)}
