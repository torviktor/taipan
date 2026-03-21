# backend/app/tasks/news_fetcher.py

import re
import requests
from datetime import datetime, timezone
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.news import News
from app.models.user import User


# ── Хелперы ───────────────────────────────────────────────────────────────────

def get_system_user(db: Session) -> int:
    """Возвращает ID первого менеджера/админа для автоновостей."""
    user = db.query(User).filter(User.role.in_(["manager", "admin"])).first()
    return user.id if user else 1


def news_already_exists(db: Session, source_url: str) -> bool:
    """Проверяем не импортировали ли уже эту новость по URL в теле."""
    return db.query(News).filter(News.body.contains(source_url)).first() is not None


def save_news(db: Session, title: str, body: str, author_id: int):
    n = News(title=title, body=body, created_by=author_id)
    db.add(n)
    db.commit()


# ── Парсер Telegram канала ────────────────────────────────────────────────────

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
        print(f"[TG parser] Ошибка запроса: {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    posts = soup.select(".tgme_widget_message")[-limit:]

    result = []
    for post in posts:
        # Текст поста
        text_el = post.select_one(".tgme_widget_message_text")
        if not text_el:
            continue
        text = text_el.get_text(separator="\n").strip()
        if not text or len(text) < 30:
            continue

        # Ссылка на пост
        link_el = post.select_one(".tgme_widget_message_date")
        post_url = link_el["href"] if link_el and link_el.get("href") else ""

        # Дата
        time_el = post.select_one("time")
        post_date = ""
        if time_el and time_el.get("datetime"):
            try:
                dt = datetime.fromisoformat(time_el["datetime"].replace("Z", "+00:00"))
                post_date = dt.strftime("%d.%m.%Y")
            except Exception:
                pass

        # Первая строка как заголовок
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        title = lines[0][:120] if lines else "Новость ГТФ России"
        if len(title) == len(lines[0]) and len(lines) > 1:
            title = title  # первая строка и есть заголовок
        else:
            title = "Новость ГТФ России"

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
    Парсит страницу новостей дворца спорта Надежда.
    Возвращает список {title, body, url}.
    """
    base = "https://dss-pp.ru"
    url  = f"{base}/news/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        resp.encoding = "utf-8"
    except Exception as e:
        print(f"[DSS parser] Ошибка запроса: {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")

    # Ищем ссылки на новости
    news_links = []
    for a in soup.select("a[href]"):
        href = a["href"]
        if "/news/" in href and href != "/news/" and len(href) > 7:
            full = href if href.startswith("http") else base + href
            title = a.get_text(strip=True)
            if title and len(title) > 10:
                news_links.append({"url": full, "title": title})

    # Убираем дубли
    seen = set()
    unique = []
    for item in news_links:
        if item["url"] not in seen:
            seen.add(item["url"])
            unique.append(item)

    result = []
    for item in unique[:limit]:
        try:
            r2 = requests.get(item["url"], headers=headers, timeout=10)
            r2.encoding = "utf-8"
            s2 = BeautifulSoup(r2.text, "html.parser")
            # Ищем основной текст
            content = s2.select_one(".news-detail") or s2.select_one("article") or s2.select_one(".content")
            if content:
                text = content.get_text(separator="\n").strip()
                text = re.sub(r'\n{3,}', '\n\n', text)
            else:
                text = item["title"]

            body = f"Источник: Дворец спорта «Надежда», Павловский Посад\n\n{text}\n\nОригинал: {item['url']}"
            result.append({"title": item["title"][:200], "body": body, "url": item["url"]})
        except Exception as e:
            print(f"[DSS parser] Ошибка загрузки {item['url']}: {e}")
            continue

    return result


# ── Celery задачи ─────────────────────────────────────────────────────────────

def run_telegram_fetch():
    """Импортировать новые посты из Telegram ГТФ России."""
    db = SessionLocal()
    try:
        author_id = get_system_user(db)
        posts = fetch_telegram_gtf(limit=15)
        imported = 0
        for p in posts:
            if p["url"] and news_already_exists(db, p["url"]):
                continue
            save_news(db, p["title"], p["body"], author_id)
            imported += 1
        print(f"[TG] Импортировано новых постов: {imported}")
        return imported
    finally:
        db.close()


def run_dss_fetch():
    """Импортировать новые новости с сайта дворца спорта."""
    db = SessionLocal()
    try:
        author_id = get_system_user(db)
        posts = fetch_dss_news(limit=5)
        imported = 0
        for p in posts:
            if p["url"] and news_already_exists(db, p["url"]):
                continue
            save_news(db, p["title"], p["body"], author_id)
            imported += 1
        print(f"[DSS] Импортировано новых новостей: {imported}")
        return imported
    finally:
        db.close()
