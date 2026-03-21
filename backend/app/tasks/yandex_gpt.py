# backend/app/tasks/yandex_gpt.py

import os
import requests
from datetime import date, timedelta
from sqlalchemy.orm import Session

from app.core.database import SessionLocal

# Импортируем все модели чтобы SQLAlchemy правильно настроил relationships
from app.models import user, event, attendance, competition, certification, achievement, camp, hall_of_fame, news, competition_file

YANDEX_API_KEY   = os.getenv("YANDEX_API_KEY", "")
YANDEX_FOLDER_ID = os.getenv("YANDEX_FOLDER_ID", "")
YANDEX_GPT_URL   = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"


def yandex_gpt(prompt: str, system: str = "") -> str:
    """Отправить запрос к YandexGPT и получить ответ."""
    if not YANDEX_API_KEY or not YANDEX_FOLDER_ID:
        raise ValueError("YANDEX_API_KEY или YANDEX_FOLDER_ID не заданы в .env")

    headers = {
        "Authorization": f"Api-Key {YANDEX_API_KEY}",
        "Content-Type":  "application/json",
    }

    messages = []
    if system:
        messages.append({"role": "system", "text": system})
    messages.append({"role": "user", "text": prompt})

    body = {
        "modelUri": f"gpt://{YANDEX_FOLDER_ID}/yandexgpt/latest",
        "completionOptions": {
            "stream":      False,
            "temperature": 0.7,
            "maxTokens":   1500,
        },
        "messages": messages,
    }

    resp = requests.post(YANDEX_GPT_URL, json=body, headers=headers, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    return data["result"]["alternatives"][0]["message"]["text"].strip()


def get_sport_season(d: date = None) -> int:
    if d is None:
        d = date.today()
    return d.year if d.month >= 9 else d.year - 1


def get_manager_id(db: Session) -> int:
    from app.models.user import User
    user = db.query(User).filter(User.role.in_(["manager", "admin"])).first()
    return user.id if user else 1


# ── Автоновость о прошедшем соревновании ─────────────────────────────────────

def generate_competition_news(comp_id: int) -> dict:
    """
    Генерирует красивую новость о соревновании через YandexGPT.
    Возвращает {title, body}.
    """
    from app.models.competition import Competition, CompetitionResult
    from app.models.user import Athlete

    db = SessionLocal()
    try:
        comp = db.query(Competition).filter(Competition.id == comp_id).first()
        if not comp:
            raise ValueError(f"Соревнование {comp_id} не найдено")

        results = db.query(CompetitionResult).filter(
            CompetitionResult.competition_id == comp_id,
            CompetitionResult.status.in_(["confirmed", "paid"])
        ).all()

        # Подсчёт медалей
        gold = silver = bronze = 0
        medal_details = []
        participants = []

        for r in results:
            athlete = db.query(Athlete).filter(Athlete.id == r.athlete_id).first()
            if not athlete:
                continue
            participants.append(athlete.full_name)

            places = {
                "спарринг":  r.sparring_place,
                "стоп-балл": r.stopball_place,
                "тег-тим":   r.tegtim_place,
                "туль":      r.tuli_place,
            }
            for disc, place in places.items():
                if place == 1:
                    gold += 1
                    medal_details.append(f"{athlete.full_name} — 1 место ({disc})")
                elif place == 2:
                    silver += 1
                    medal_details.append(f"{athlete.full_name} — 2 место ({disc})")
                elif place == 3:
                    bronze += 1
                    medal_details.append(f"{athlete.full_name} — 3 место ({disc})")

        date_str  = comp.date.strftime("%d.%m.%Y") if comp.date else ""
        total_med = gold + silver + bronze

        # Формируем данные для GPT
        facts = f"""
Соревнование: {comp.name}
Дата: {date_str}
Место проведения: {comp.location or 'не указано'}
Уровень: {comp.level} {comp.comp_type}
Количество участников от клуба «Тайпан»: {len(participants)}
Список участников: {', '.join(participants) if participants else 'нет данных'}
Медали: золото — {gold}, серебро — {silver}, бронза — {bronze} (всего {total_med})
Призёры: {chr(10).join(medal_details) if medal_details else 'мест не заняли'}
        """.strip()

        system = """Ты — редактор новостей спортивного клуба тхэквондо «Тайпан» из Павловского Посада.
Пишешь живые, эмоциональные новости о соревнованиях. Стиль — радостный, поддерживающий, гордый за спортсменов.
Используй факты которые тебе дали. Не выдумывай детали которых нет.
Не используй эмодзи. Структура: вступление (1-2 предложения), основная часть с результатами, завершение с мотивацией.
Объём — 150-250 слов."""

        prompt = f"""Напиши новость о соревновании по тхэквондо для сайта клуба на основе этих данных:

{facts}

Заголовок должен быть ярким и содержать название соревнования и дату.
Верни ответ в формате:
ЗАГОЛОВОК: [заголовок]
ТЕКСТ: [текст новости]"""

        response = yandex_gpt(prompt, system)

        # Парсим ответ
        title = f"{comp.name} — {date_str}"
        body  = response

        if "ЗАГОЛОВОК:" in response and "ТЕКСТ:" in response:
            parts = response.split("ТЕКСТ:", 1)
            title_part = parts[0].replace("ЗАГОЛОВОК:", "").strip()
            body  = parts[1].strip()
            if title_part:
                title = title_part

        return {"title": title[:255], "body": body}

    finally:
        db.close()


def run_competition_news(comp_id: int) -> bool:
    """Создать новость о соревновании через YandexGPT."""
    from app.models.news import News

    db = SessionLocal()
    try:
        # Проверяем не публиковали ли уже
        existing = db.query(News).filter(
            News.competition_id == comp_id,
            News.is_published   == True
        ).first()
        if existing:
            print(f"[YaGPT] Новость о соревновании {comp_id} уже существует")
            return False

        author_id = get_manager_id(db)
        result = generate_competition_news(comp_id)

        n = News(
            title=result["title"],
            body=result["body"],
            competition_id=comp_id,
            created_by=author_id,
        )
        db.add(n)
        db.commit()
        print(f"[YaGPT] Создана новость: {result['title']}")
        return True

    except Exception as e:
        print(f"[YaGPT] Ошибка генерации новости: {e}")
        return False
    finally:
        db.close()


# ── Еженедельный анонс предстоящих соревнований ───────────────────────────────

def run_weekly_announcement() -> bool:
    """Генерирует анонс предстоящих соревнований на следующие 2 недели."""
    from app.models.competition import Competition
    from app.models.news import News

    db = SessionLocal()
    try:
        today     = date.today()
        in_2weeks = today + timedelta(days=14)

        upcoming = db.query(Competition).filter(
            Competition.date >= today,
            Competition.date <= in_2weeks,
        ).order_by(Competition.date).all()

        if not upcoming:
            print("[YaGPT] Нет предстоящих соревнований для анонса")
            return False

        comp_list = "\n".join([
            f"- {c.name}, {c.date.strftime('%d.%m.%Y')}, {c.location or 'место уточняется'}, уровень: {c.level}"
            for c in upcoming
        ])

        system = """Ты — редактор новостей спортивного клуба тхэквондо «Тайпан» из Павловского Посада.
Пишешь анонсы предстоящих соревнований. Стиль — мотивирующий, энергичный, поддерживающий.
Не используй эмодзи. Объём — 100-180 слов."""

        prompt = f"""Напиши анонс предстоящих соревнований для сайта клуба тхэквондо «Тайпан».

Предстоящие соревнования:
{comp_list}

Заголовок должен быть мотивирующим, упоминать ближайшие турниры.
Верни ответ в формате:
ЗАГОЛОВОК: [заголовок]
ТЕКСТ: [текст анонса]"""

        response = yandex_gpt(prompt, system)

        title = f"Анонс соревнований — {today.strftime('%d.%m.%Y')}"
        body  = response

        if "ЗАГОЛОВОК:" in response and "ТЕКСТ:" in response:
            parts = response.split("ТЕКСТ:", 1)
            title_part = parts[0].replace("ЗАГОЛОВОК:", "").strip()
            body  = parts[1].strip()
            if title_part:
                title = title_part

        author_id = get_manager_id(db)
        n = News(title=title[:255], body=body, created_by=author_id)
        db.add(n)
        db.commit()
        print(f"[YaGPT] Создан анонс: {title}")
        return True

    except Exception as e:
        print(f"[YaGPT] Ошибка генерации анонса: {e}")
        return False
    finally:
        db.close()
