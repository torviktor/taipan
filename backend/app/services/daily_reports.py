# backend/app/services/daily_reports.py

import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.core.database import SessionLocal
from app.models.competition import Competition
from app.models.news import News


log = logging.getLogger(__name__)

MSK = ZoneInfo("Europe/Moscow")


def run_daily_event_reports() -> int:
    """Для каждого соревнования, прошедшего вчера (по МСК), поставить черновик
    репортажа (source='auto_competition_report'), если ещё не создан.

    Использует create_competition_news_draft(mode='report'), который сам делает
    дедуп через create_event_draft. Этот же дедуп мы делаем заранее, чтобы
    не дёргать GPT впустую.

    Возвращает количество новых созданных черновиков.
    """
    from app.tasks.yandex_gpt import create_competition_news_draft

    yesterday = (datetime.now(MSK).date() - timedelta(days=1))
    db = SessionLocal()
    created = 0
    try:
        comps = db.query(Competition).filter(Competition.date == yesterday).all()
        log.info("run_daily_event_reports: %s competitions on %s", len(comps), yesterday)

        for comp in comps:
            try:
                existing = db.query(News).filter(
                    News.competition_id == comp.id,
                    News.source == 'auto_competition_report',
                    News.status.in_(('draft', 'published')),
                ).first()
                if existing:
                    log.info(
                        "run_daily_event_reports: report already exists for comp=%s (news id=%s)",
                        comp.id, existing.id,
                    )
                    continue

                if create_competition_news_draft(comp.id, mode='report'):
                    created += 1
            except Exception:
                log.exception(
                    "run_daily_event_reports: failed for comp=%s", comp.id,
                )

        log.info("run_daily_event_reports: created %s drafts", created)
        return created
    finally:
        db.close()
