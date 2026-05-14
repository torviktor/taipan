# backend/app/tasks/news_fetcher.py

import logging
import re
from urllib.parse import urlsplit, urlunsplit

import requests
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.news import News
from app.models.user import User
from app.services.news_drafts import _create_news_draft

log = logging.getLogger(__name__)


# ── Хелперы ───────────────────────────────────────────────────────────────────

def get_system_user(db: Session) -> int:
    """Возвращает ID первого менеджера/админа для автоновостей."""
    user = db.query(User).filter(User.role.in_(["manager", "admin"])).first()
    return user.id if user else 1


def _normalize_url(url: str) -> str:
    """
    Канонизация URL для дедупа:
      - lower-case scheme + host
      - убрать leading 'www.'
      - убрать query и fragment
      - убрать trailing slash в path (кроме корня)
    Пример:
      https://www.dss-pp.ru/news/abc/?utm=foo#x
      → https://dss-pp.ru/news/abc
    """
    if not url:
        return ""
    try:
        parts = urlsplit(url.strip())
        scheme = parts.scheme.lower() or "https"
        host = parts.netloc.lower()
        if host.startswith("www."):
            host = host[4:]
        path = parts.path
        if len(path) > 1 and path.endswith("/"):
            path = path.rstrip("/")
        return urlunsplit((scheme, host, path, "", ""))
    except Exception:
        return url.strip()


def _source_url_marker(normalized: str) -> str:
    """Маркер для дедупа, встраивается первой строкой в body."""
    return f"Source-URL: {normalized}"


def news_already_exists(db: Session, normalized_url: str) -> bool:
    """Дедуп по нормализованному URL: ищем маркер в body."""
    if not normalized_url:
        return False
    marker = _source_url_marker(normalized_url)
    return db.query(News).filter(News.body.contains(marker)).first() is not None


# ── Парсер Telegram канала ────────────────────────────────────────────────────
# Источник 4.6 (Telegram ГТФ России) пока не используется в очереди черновиков.
# Логика парсинга оставлена как есть, run_telegram_fetch удалён до решения 4.6.

def fetch_telegram_gtf(limit: int = 10) -> list[dict]:
    """
    Парсит публичный Telegram канал t.me/s/gtfrussia.
    Возвращает список {title, body, url}.
    """
    url = "https://t.me/s/gtfrussia"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        log.warning("[TG parser] request failed: %s", e)
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    posts = soup.select(".tgme_widget_message")[-limit:]

    result = []
    for post in posts:
        text_el = post.select_one(".tgme_widget_message_text")
        if not text_el:
            continue
        text = text_el.get_text(separator="\n").strip()
        if not text or len(text) < 30:
            continue

        link_el = post.select_one(".tgme_widget_message_date")
        post_url = link_el["href"] if link_el and link_el.get("href") else ""

        time_el = post.select_one("time")
        post_date = ""
        if time_el and time_el.get("datetime"):
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(time_el["datetime"].replace("Z", "+00:00"))
                post_date = dt.strftime("%d.%m.%Y")
            except Exception:
                pass

        lines = [l.strip() for l in text.split("\n") if l.strip()]
        title = lines[0][:120] if lines else "Новость ГТФ России"

        body = text
        if post_date:
            body = f"Источник: Федерация тхэквондо ГТФ России\nДата: {post_date}\n\n{text}"
        if post_url:
            body += f"\n\nОригинал: {post_url}"

        result.append({"title": title, "body": body, "url": post_url})

    return result


# ── Парсер dss-pp.ru/news ─────────────────────────────────────────────────────

def fetch_dss_news(limit: int = 5) -> list[dict]:
    """
    Парсит страницу новостей дворца спорта «Надежда».
    Возвращает список {title, body, url, url_normalized}.
    Маркер Source-URL встраивается первой строкой body для дедупа.
    """
    base = "https://dss-pp.ru"
    url = f"{base}/news/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        resp.encoding = "utf-8"
    except Exception as e:
        log.warning("[DSS parser] request failed: %s", e)
        return []

    soup = BeautifulSoup(resp.text, "html.parser")

    news_links = []
    for a in soup.select("a[href]"):
        href = a["href"]
        if "/news/" in href and href != "/news/" and len(href) > 7:
            full = href if href.startswith("http") else base + href
            title = a.get_text(strip=True)
            if title and len(title) > 10:
                news_links.append({"url": full, "title": title})

    seen = set()
    unique = []
    for item in news_links:
        normalized = _normalize_url(item["url"])
        if normalized in seen:
            continue
        seen.add(normalized)
        item["url_normalized"] = normalized
        unique.append(item)

    result = []
    for item in unique[:limit]:
        try:
            r2 = requests.get(item["url"], headers=headers, timeout=10)
            r2.encoding = "utf-8"
            s2 = BeautifulSoup(r2.text, "html.parser")
            content = s2.select_one(".news-detail") or s2.select_one("article") or s2.select_one(".content")
            if content:
                text = content.get_text(separator="\n").strip()
                text = re.sub(r"\n{3,}", "\n\n", text)
            else:
                text = item["title"]

            marker = _source_url_marker(item["url_normalized"])
            body = (
                f"{marker}\n\n"
                f"Источник: Дворец спорта «Надежда», Павловский Посад\n\n"
                f"{text}\n\n"
                f"Оригинал: {item['url']}"
            )
            result.append({
                "title": item["title"][:200],
                "body": body,
                "url": item["url"],
                "url_normalized": item["url_normalized"],
            })
        except Exception as e:
            log.warning("[DSS parser] article load failed %s: %s", item["url"], e)
            continue

    return result


# ── Celery-функции (вызываются из celery_app.py через .delay/.apply) ─────────

def run_dss_fetch():
    """Импортировать новые новости с dss-pp.ru в очередь черновиков."""
    db = SessionLocal()
    try:
        author_id = get_system_user(db)
        posts = fetch_dss_news(limit=5)
        imported = 0
        skipped = 0
        for p in posts:
            if p["url_normalized"] and news_already_exists(db, p["url_normalized"]):
                skipped += 1
                continue
            draft = _create_news_draft(
                db,
                source="nadezhda",
                title=p["title"],
                body=p["body"],
                created_by=author_id,
            )
            if draft:
                imported += 1
            else:
                log.warning("[DSS] draft creation returned None for %s", p["url"])
        log.info(
            "[DSS] fetched=%d, imported=%d, skipped(dedup)=%d",
            len(posts), imported, skipped,
        )
        return imported
    finally:
        db.close()


# run_telegram_fetch удалён — Telegram ГТФ остаётся отдельной подзадачей 4.6.
