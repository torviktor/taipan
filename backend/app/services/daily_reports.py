# backend/app/services/daily_reports.py

import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.core.database import SessionLocal
from app.models.competition import Competition
from app.models.certification import Certification
from app.models.camp import Camp
from app.models.news import News


log = logging.getLogger(__name__)

MSK = ZoneInfo("Europe/Moscow")


def run_daily_event_reports() -> int:
    """Для каждого события, прошедшего вчера (по МСК), поставить черновик
    репортажа, если ещё не создан:
      - Competition.date == yesterday → source='auto_competition_report'
      - Certification.date == yesterday → source='auto_certification_report'
      - Camp.date_end == yesterday → source='auto_camp_report'

    Каждая обёртка create_*_news_draft сама делает дедуп через
    create_event_draft. Пред-проверка тут — чтобы не дёргать GPT впустую.

    Возвращает количество новых созданных черновиков.
    """
    yesterday = (datetime.now(MSK).date() - timedelta(days=1))
    db = SessionLocal()
    created = 0
    try:
        # Competitions
        from app.tasks.yandex_gpt import create_competition_news_draft
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
                    "run_daily_event_reports: competition %s failed", comp.id,
                )

        # Certifications
        from app.tasks.yandex_gpt import create_certification_news_draft
        certs = db.query(Certification).filter(Certification.date == yesterday).all()
        log.info("run_daily_event_reports: %s certifications on %s", len(certs), yesterday)

        for cert in certs:
            try:
                existing = db.query(News).filter(
                    News.certification_id == cert.id,
                    News.source == 'auto_certification_report',
                    News.status.in_(('draft', 'published')),
                ).first()
                if existing:
                    log.info(
                        "run_daily_event_reports: report already exists for cert=%s (news id=%s)",
                        cert.id, existing.id,
                    )
                    continue

                if create_certification_news_draft(cert.id, mode='report'):
                    created += 1
            except Exception:
                log.exception(
                    "run_daily_event_reports: certification %s failed", cert.id,
                )

        # Camps
        from app.tasks.yandex_gpt import create_camp_news_draft
        camps = db.query(Camp).filter(Camp.date_end == yesterday).all()
        log.info("run_daily_event_reports: %s camps ending on %s", len(camps), yesterday)

        for camp in camps:
            try:
                existing = db.query(News).filter(
                    News.camp_id == camp.id,
                    News.source == 'auto_camp_report',
                    News.status.in_(('draft', 'published')),
                ).first()
                if existing:
                    log.info(
                        "run_daily_event_reports: report already exists for camp=%s (news id=%s)",
                        camp.id, existing.id,
                    )
                    continue

                if create_camp_news_draft(camp.id, mode='report'):
                    created += 1
            except Exception:
                log.exception(
                    "run_daily_event_reports: camp %s failed", camp.id,
                )

        log.info("run_daily_event_reports: created %s drafts", created)
        return created
    finally:
        db.close()
