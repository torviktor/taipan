# backend/app/services/news_drafts.py

import logging
from datetime import date as date_type
from typing import Literal, Optional

from sqlalchemy.orm import Session

from app.models.news import News
from app.models.competition import Competition
from app.models.certification import Certification
from app.models.camp import Camp


log = logging.getLogger(__name__)


Source = Literal[
    'manual',
    'auto_competition_anons',
    'auto_certification_anons',
    'auto_camp_anons',
    'nadezhda',
    'vk',
    'gtf_telegram',
    'ai',
]


_FK_BY_SOURCE = {
    'auto_competition_anons':   'competition_id',
    'auto_certification_anons': 'certification_id',
    'auto_camp_anons':          'camp_id',
}


def _fmt_ru(d: Optional[date_type]) -> str:
    return d.strftime('%d.%m.%Y') if d else '—'


def build_competition_anons(c: Competition) -> tuple[str, str]:
    title = f"Анонс: {c.name}"
    body = (
        f"Соревнование: {c.name}\n"
        f"Дата: {_fmt_ru(c.date)}\n"
        f"Место: {c.location or '—'}\n"
        f"Тип: {c.level} {c.comp_type}\n\n"
        "<тренер дополняет>"
    )
    return title, body


def build_certification_anons(c: Certification) -> tuple[str, str]:
    title = f"Анонс аттестации {_fmt_ru(c.date)}"
    notes_block = f"{c.notes}\n" if c.notes else ""
    body = (
        f"Аттестация: {c.name}\n"
        f"Дата: {_fmt_ru(c.date)}\n"
        f"Место: {c.location or '—'}\n"
        f"{notes_block}\n"
        "<тренер дополняет>"
    )
    return title, body


def build_camp_anons(c: Camp) -> tuple[str, str]:
    title = f"Анонс сборов: {c.name}"
    price_str = f"{c.price} ₽" if c.price else "—"
    notes_block = f"{c.notes}\n" if c.notes else ""
    body = (
        f"Сборы: {c.name}\n"
        f"Заезд: {_fmt_ru(c.date_start)}\n"
        f"Выезд: {_fmt_ru(c.date_end)}\n"
        f"Место: {c.location or '—'}\n"
        f"Стоимость: {price_str}\n"
        f"{notes_block}\n"
        "<тренер дополняет>"
    )
    return title, body


def create_event_draft(
    db: Session,
    *,
    source: Source,
    entity_id: int,
    title: str,
    body: str,
    created_by: int,
) -> Optional[News]:
    """
    Создать черновик News(status='draft', source=<source>) с привязкой
    к сущности по entity_id. FK выбирается автоматически по source.
    Дедуп: вернёт None, если черновик такого source для этой сущности
    уже существует. Падения логирует и проглатывает (тоже None) —
    не валит основную операцию caller'а.
    """
    try:
        fk_field = _FK_BY_SOURCE.get(source)
        if not fk_field:
            log.error("create_event_draft: unknown source %r", source)
            return None

        existing = db.query(News).filter(
            News.source == source,
            getattr(News, fk_field) == entity_id,
            News.status == 'draft',
        ).first()
        if existing:
            return None

        news = News(
            title=title[:255],
            body=body,
            status='draft',
            source=source,
            created_by=created_by,
            **{fk_field: entity_id},
        )
        db.add(news)
        db.commit()
        db.refresh(news)
        return news
    except Exception:
        log.exception(
            "create_event_draft failed (source=%s, entity_id=%s)",
            source, entity_id,
        )
        try:
            db.rollback()
        except Exception:
            pass
        return None
