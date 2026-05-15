# backend/app/tasks/yandex_gpt.py

import logging
import os
import requests
from datetime import date
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.services.news_quality import validate_generated_news

log = logging.getLogger(__name__)

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


# ── Автоновость о соревновании (auto: preview / past по дате) ────────

def generate_competition_news(comp_id: int) -> dict:
    """
    Генерирует новость о соревновании через YandexGPT.
    Режим определяется автоматически по comp.date vs date.today():
      - дата в будущем → анонс (preview, будущее время, без имён участников)
      - дата в прошлом или сегодня → репортаж (past, прошедшее время, имена + медали)
    Возвращает {title, body}.
    """
    from app.models.competition import Competition, CompetitionResult
    from app.models.user import Athlete

    db = SessionLocal()
    try:
        comp = db.query(Competition).filter(Competition.id == comp_id).first()
        if not comp:
            raise ValueError(f"Соревнование {comp_id} не найдено")

        today = date.today()
        is_preview = comp.date and comp.date > today
        date_str = comp.date.strftime("%d.%m.%Y") if comp.date else ""

        # ── facts блок (отличается для preview vs past) ─────────────────
        if is_preview:
            # Анонс: только данные события, без имён.
            facts = f"""
Соревнование: {comp.name}
Дата проведения (БУДУЩАЯ, ещё не прошло): {date_str}
Сегодня: {today.strftime("%d.%m.%Y")}
Место проведения: {comp.location or 'не указано'}
Уровень: {comp.level} {comp.comp_type}
""".strip()
        else:
            results = db.query(CompetitionResult).filter(
                CompetitionResult.competition_id == comp_id,
                CompetitionResult.status.in_(["confirmed", "paid"])
            ).all()

            participants = []
            gold = silver = bronze = 0
            medal_details = []

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

            total_med = gold + silver + bronze
            facts = f"""
Соревнование: {comp.name}
Дата проведения (УЖЕ ПРОШЛО): {date_str}
Сегодня: {today.strftime("%d.%m.%Y")}
Место проведения: {comp.location or 'не указано'}
Уровень: {comp.level} {comp.comp_type}
Количество участников от клуба «Тайпан»: {len(participants)}
Список участников: {', '.join(participants) if participants else 'нет данных'}
Медали: золото — {gold}, серебро — {silver}, бронза — {bronze} (всего {total_med})
Призёры: {chr(10).join(medal_details) if medal_details else 'мест не заняли'}
""".strip()

        # ── system промт (отличается для preview vs past) ───────────────
        if is_preview:
            system = """Ты — редактор новостей спортивного клуба тхэквондо «Тайпан» из Павловского Посада.
Пишешь АНОНС ПРЕДСТОЯЩЕГО соревнования. Соревнование ещё не прошло.
Используй БУДУЩЕЕ время («состоится», «пройдёт», «выступят», «представят клуб»).
НЕ пиши о результатах, медалях, победах — их ещё нет.
НЕ перечисляй имена спортсменов — пиши общо («наши спортсмены», «команда клуба»).
Создавай ожидание, поддерживай команду, призывай болеть за клуб.
Стиль — мотивирующий, энергичный, гордый. Не используй эмодзи.
Структура: вступление о предстоящем событии, основная часть (даты/место/уровень), завершение с мотивацией.
Объём — 150-250 слов."""
        else:
            system = """Ты — редактор новостей спортивного клуба тхэквондо «Тайпан» из Павловского Посада.
Пишешь РЕПОРТАЖ о ПРОШЕДШЕМ соревновании. Соревнование уже состоялось.
Используй ПРОШЕДШЕЕ время («состоялось», «прошло», «выступили», «завоевали»).
Включи реальные результаты и медали из данных — не выдумывай.
Стиль — радостный, поддерживающий, гордый за спортсменов. Не используй эмодзи.
Структура: вступление (1-2 предложения), основная часть с результатами, завершение с мотивацией.
Объём — 150-250 слов."""

        # ── prompt (одинаковый для обоих режимов) ───────────────────────
        prompt = f"""Напиши новость о соревновании по тхэквондо для сайта клуба на основе этих данных:

{facts}

Заголовок должен быть ярким и содержать название соревнования и дату.
Верни ответ в формате:
ЗАГОЛОВОК: [заголовок]
ТЕКСТ: [текст новости]"""

        response = yandex_gpt(prompt, system)

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


def create_competition_news_draft(comp_id: int, mode: str = 'auto') -> bool:
    """
    Создать черновик новости о соревновании.

    mode:
      'auto'   — определить по comp.date vs today (preview если в будущем).
      'anons'  — принудительно preview (source='auto_competition_anons').
      'report' — принудительно past   (source='auto_competition_report').

    Сначала пробует сгенерировать текст через YandexGPT; при любой ошибке
    (timeout / 5xx / парсинг / etc.) — логирует и падает на статический
    шаблон build_competition_anons / build_competition_report. Тот же
    fallback срабатывает, если validate_generated_news вернул severity=hard
    (плейсхолдеры, катастрофически короткий текст и т.п.).

    Возвращает True если черновик создан, False если дедуп заблокировал
    или соревнование не найдено.
    """
    from app.models.competition import Competition
    from app.services.news_drafts import (
        build_competition_anons,
        build_competition_report,
        create_event_draft,
    )

    db = SessionLocal()
    try:
        comp = db.query(Competition).filter(Competition.id == comp_id).first()
        if not comp:
            log.warning("create_competition_news_draft: competition %s not found", comp_id)
            return False

        if mode == 'anons':
            is_preview = True
        elif mode == 'report':
            is_preview = False
        else:
            is_preview = bool(comp.date and comp.date > date.today())

        target_source = 'auto_competition_anons' if is_preview else 'auto_competition_report'
        author_id = get_manager_id(db)

        gpt_used = False
        try:
            result = generate_competition_news(comp_id)
            title, body = result["title"], result["body"]
            gpt_used = True
        except Exception:
            log.exception(
                "create_competition_news_draft: GPT failed for comp=%s mode=%s, falling back to template",
                comp_id, mode,
            )
            if is_preview:
                title, body = build_competition_anons(comp)
            else:
                title, body = build_competition_report(comp)

        needs_review = False
        if gpt_used:
            check_mode = 'anons' if is_preview else 'report'
            vr = validate_generated_news(
                title, body, mode=check_mode, event_name=comp.name,
            )
            if vr.is_hard_fail:
                log.warning(
                    "create_competition_news_draft: GPT result rejected by validator "
                    "(comp=%s mode=%s issues=%s), falling back to template",
                    comp_id, mode, vr.issues,
                )
                if is_preview:
                    title, body = build_competition_anons(comp)
                else:
                    title, body = build_competition_report(comp)
            elif vr.needs_review:
                needs_review = True

        draft = create_event_draft(
            db,
            source=target_source,
            entity_id=comp_id,
            title=title,
            body=body,
            created_by=author_id,
            needs_review=needs_review,
        )
        return bool(draft)
    finally:
        db.close()


# ── Автоновость об аттестации (auto: preview / past по дате) ──────────

def generate_certification_news(cert_id: int) -> dict:
    """
    Генерирует новость об аттестации через YandexGPT.
    Режим по cert.date vs today:
      - дата в будущем → анонс (preview, будущее время, без имён)
      - дата прошла/сегодня → репортаж (past, прошедшее время, имена участников)
    Возвращает {title, body}.
    """
    from app.models.certification import Certification, CertificationResult
    from app.models.user import Athlete

    db = SessionLocal()
    try:
        cert = db.query(Certification).filter(Certification.id == cert_id).first()
        if not cert:
            raise ValueError(f"Аттестация {cert_id} не найдена")

        today = date.today()
        is_preview = cert.date and cert.date > today
        date_str = cert.date.strftime("%d.%m.%Y") if cert.date else ""
        notes_block = f"\nПримечания: {cert.notes}" if cert.notes else ""

        if is_preview:
            facts = f"""
Аттестация: {cert.name}
Дата проведения (БУДУЩАЯ, ещё не прошло): {date_str}
Сегодня: {today.strftime("%d.%m.%Y")}
Место проведения: {cert.location or 'не указано'}{notes_block}
""".strip()
        else:
            participant_names = []
            results = db.query(CertificationResult).filter(
                CertificationResult.certification_id == cert_id
            ).all()
            for r in results:
                athlete = db.query(Athlete).filter(Athlete.id == r.athlete_id).first()
                if athlete:
                    participant_names.append(athlete.full_name)
            facts = f"""
Аттестация: {cert.name}
Дата проведения (УЖЕ ПРОШЛО): {date_str}
Сегодня: {today.strftime("%d.%m.%Y")}
Место проведения: {cert.location or 'не указано'}{notes_block}
Количество участников от клуба «Тайпан»: {len(participant_names)}
Список участников: {', '.join(participant_names) if participant_names else 'нет данных'}
""".strip()

        if is_preview:
            system = """Ты — редактор новостей спортивного клуба тхэквондо «Тайпан» из Павловского Посада.
Пишешь АНОНС ПРЕДСТОЯЩЕЙ аттестации. Аттестация ещё не прошла.
Используй БУДУЩЕЕ время («состоится», «пройдёт», «выйдут на доянг»).
НЕ перечисляй имена — пиши общо («наши кандидаты», «спортсмены клуба»).
НЕ выдумывай детали, которых нет в данных.
Стиль — торжественный, поддерживающий. Не используй эмодзи.
Структура: вступление о предстоящем событии, основная часть (дата/место), завершение с мотивацией.
Объём — 120-200 слов."""
        else:
            system = """Ты — редактор новостей спортивного клуба тхэквондо «Тайпан» из Павловского Посада.
Пишешь РЕПОРТАЖ по итогам аттестации. Аттестация уже прошла.
Используй ПРОШЕДШЕЕ время («прошла», «вышли», «приступили»).
Упомяни участников по именам из данных.
НЕ упоминай, кто сдал и кто не сдал — результаты тренер дополнит вручную.
Стиль — торжественный, поддерживающий. Не используй эмодзи.
Структура: вступление, перечисление участников, завершение с мотивацией.
Объём — 120-200 слов."""

        prompt = f"""Напиши новость об аттестации по тхэквондо для сайта клуба на основе этих данных:

{facts}

Заголовок должен содержать слово «аттестация» и дату.
Верни ответ в формате:
ЗАГОЛОВОК: [заголовок]
ТЕКСТ: [текст новости]"""

        response = yandex_gpt(prompt, system)

        title = f"{cert.name} — {date_str}"
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


def create_certification_news_draft(cert_id: int, mode: str = 'auto') -> bool:
    """Создать черновик новости об аттестации.
    mode ∈ {'auto','anons','report'}. GPT с fallback на шаблон."""
    from app.models.certification import Certification
    from app.services.news_drafts import (
        build_certification_anons,
        build_certification_report,
        create_event_draft,
    )

    db = SessionLocal()
    try:
        cert = db.query(Certification).filter(Certification.id == cert_id).first()
        if not cert:
            log.warning("create_certification_news_draft: certification %s not found", cert_id)
            return False

        if mode == 'anons':
            is_preview = True
        elif mode == 'report':
            is_preview = False
        else:
            is_preview = bool(cert.date and cert.date > date.today())

        target_source = 'auto_certification_anons' if is_preview else 'auto_certification_report'
        author_id = get_manager_id(db)

        gpt_used = False
        try:
            result = generate_certification_news(cert_id)
            title, body = result["title"], result["body"]
            gpt_used = True
        except Exception:
            log.exception(
                "create_certification_news_draft: GPT failed for cert=%s mode=%s, falling back to template",
                cert_id, mode,
            )
            if is_preview:
                title, body = build_certification_anons(cert)
            else:
                title, body = build_certification_report(cert)

        needs_review = False
        if gpt_used:
            check_mode = 'anons' if is_preview else 'report'
            vr = validate_generated_news(
                title, body, mode=check_mode, event_name=cert.name,
            )
            if vr.is_hard_fail:
                log.warning(
                    "create_certification_news_draft: GPT result rejected by validator "
                    "(cert=%s mode=%s issues=%s), falling back to template",
                    cert_id, mode, vr.issues,
                )
                if is_preview:
                    title, body = build_certification_anons(cert)
                else:
                    title, body = build_certification_report(cert)
            elif vr.needs_review:
                needs_review = True

        draft = create_event_draft(
            db,
            source=target_source,
            entity_id=cert_id,
            title=title,
            body=body,
            created_by=author_id,
            needs_review=needs_review,
        )
        return bool(draft)
    finally:
        db.close()


# ── Автоновость о сборах (auto: preview / past по date_end) ───────────

def generate_camp_news(camp_id: int) -> dict:
    """
    Генерирует новость о сборах через YandexGPT.
    Режим по camp.date_end vs today:
      - date_end в будущем → анонс (preview, будущее время, без имён)
      - date_end в прошлом → репортаж (past, прошедшее время, имена участников)
    Возвращает {title, body}.
    """
    from app.models.camp import Camp, CampParticipant
    from app.models.user import Athlete

    db = SessionLocal()
    try:
        camp = db.query(Camp).filter(Camp.id == camp_id).first()
        if not camp:
            raise ValueError(f"Сборы {camp_id} не найдены")

        today = date.today()
        is_preview = camp.date_end and camp.date_end > today

        date_start_str = camp.date_start.strftime("%d.%m.%Y") if camp.date_start else ""
        date_end_str   = camp.date_end.strftime("%d.%m.%Y")   if camp.date_end   else ""
        price_str = f"{camp.price} руб." if camp.price else "не указано"
        notes_block = f"\nПримечания: {camp.notes}" if camp.notes else ""

        if is_preview:
            facts = f"""
Сборы: {camp.name}
Даты проведения (БУДУЩИЕ, ещё не прошли): {date_start_str} – {date_end_str}
Сегодня: {today.strftime("%d.%m.%Y")}
Место проведения: {camp.location or 'не указано'}
Стоимость участия: {price_str}{notes_block}
""".strip()
        else:
            participant_names = []
            parts = db.query(CampParticipant).filter(
                CampParticipant.camp_id == camp_id,
                CampParticipant.status.in_(("confirmed", "paid")),
            ).all()
            for p in parts:
                athlete = db.query(Athlete).filter(Athlete.id == p.athlete_id).first()
                if athlete:
                    participant_names.append(athlete.full_name)
            facts = f"""
Сборы: {camp.name}
Даты проведения (УЖЕ ПРОШЛИ): {date_start_str} – {date_end_str}
Сегодня: {today.strftime("%d.%m.%Y")}
Место проведения: {camp.location or 'не указано'}{notes_block}
Количество участников от клуба «Тайпан»: {len(participant_names)}
Список участников: {', '.join(participant_names) if participant_names else 'нет данных'}
""".strip()

        if is_preview:
            system = """Ты — редактор новостей спортивного клуба тхэквондо «Тайпан» из Павловского Посада.
Пишешь АНОНС ПРЕДСТОЯЩИХ учебно-тренировочных сборов.
Используй БУДУЩЕЕ время («состоятся», «пройдут», «выедут», «команда отправится»).
НЕ перечисляй имена — пиши общо («команда клуба», «наши спортсмены»).
НЕ выдумывай детали, которых нет в данных.
Стиль — энергичный, командный, мотивирующий. Не используй эмодзи.
Структура: вступление о предстоящих сборах, основная часть (даты/место/стоимость), завершение с мотивацией.
Объём — 120-200 слов."""
        else:
            system = """Ты — редактор новостей спортивного клуба тхэквондо «Тайпан» из Павловского Посада.
Пишешь РЕПОРТАЖ по итогам прошедших учебно-тренировочных сборов.
Используй ПРОШЕДШЕЕ время («прошли», «состоялись», «приняли участие»).
Упомяни участников по именам из данных.
Стиль — командный, благодарный, гордый. Не используй эмодзи.
Структура: вступление, перечисление участников, завершение с благодарностью и мотивацией.
Объём — 120-200 слов."""

        prompt = f"""Напиши новость об учебно-тренировочных сборах по тхэквондо для сайта клуба на основе этих данных:

{facts}

Заголовок должен содержать название сборов и даты.
Верни ответ в формате:
ЗАГОЛОВОК: [заголовок]
ТЕКСТ: [текст новости]"""

        response = yandex_gpt(prompt, system)

        title = f"{camp.name} — {date_start_str}–{date_end_str}"
        body  = response

        if "ЗАГОЛОВОК:" in response and "ТЕКСТ:" in response:
            parts_text = response.split("ТЕКСТ:", 1)
            title_part = parts_text[0].replace("ЗАГОЛОВОК:", "").strip()
            body  = parts_text[1].strip()
            if title_part:
                title = title_part

        return {"title": title[:255], "body": body}
    finally:
        db.close()


def create_camp_news_draft(camp_id: int, mode: str = 'auto') -> bool:
    """Создать черновик новости о сборах.
    mode ∈ {'auto','anons','report'}. 'auto' определяется по camp.date_end."""
    from app.models.camp import Camp
    from app.services.news_drafts import (
        build_camp_anons,
        build_camp_report,
        create_event_draft,
    )

    db = SessionLocal()
    try:
        camp = db.query(Camp).filter(Camp.id == camp_id).first()
        if not camp:
            log.warning("create_camp_news_draft: camp %s not found", camp_id)
            return False

        if mode == 'anons':
            is_preview = True
        elif mode == 'report':
            is_preview = False
        else:
            is_preview = bool(camp.date_end and camp.date_end > date.today())

        target_source = 'auto_camp_anons' if is_preview else 'auto_camp_report'
        author_id = get_manager_id(db)

        gpt_used = False
        try:
            result = generate_camp_news(camp_id)
            title, body = result["title"], result["body"]
            gpt_used = True
        except Exception:
            log.exception(
                "create_camp_news_draft: GPT failed for camp=%s mode=%s, falling back to template",
                camp_id, mode,
            )
            if is_preview:
                title, body = build_camp_anons(camp)
            else:
                title, body = build_camp_report(camp)

        needs_review = False
        if gpt_used:
            check_mode = 'anons' if is_preview else 'report'
            vr = validate_generated_news(
                title, body, mode=check_mode, event_name=camp.name,
            )
            if vr.is_hard_fail:
                log.warning(
                    "create_camp_news_draft: GPT result rejected by validator "
                    "(camp=%s mode=%s issues=%s), falling back to template",
                    camp_id, mode, vr.issues,
                )
                if is_preview:
                    title, body = build_camp_anons(camp)
                else:
                    title, body = build_camp_report(camp)
            elif vr.needs_review:
                needs_review = True

        draft = create_event_draft(
            db,
            source=target_source,
            entity_id=camp_id,
            title=title,
            body=body,
            created_by=author_id,
            needs_review=needs_review,
        )
        return bool(draft)
    finally:
        db.close()
