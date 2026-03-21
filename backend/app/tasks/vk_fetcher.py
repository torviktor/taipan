# backend/app/tasks/vk_fetcher.py

import re
import requests
from bs4 import BeautifulSoup
from app.core.database import SessionLocal
from app.models.news import News

VK_GROUPS = [
    {"url": "https://vk.com/club95706392", "title": "Клуб Тайпан ВК"},
    {"url": "https://vk.com/tkd_msk",      "title": "Тхэквондо Москва"},
    {"url": "https://vk.com/ftr_gtf",      "title": "ГТФ Россия ВК"},
    {"url": "https://vk.com/dss_pp",       "title": "Дворец спорта Надежда ВК"},
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept-Language": "ru-RU,ru;q=0.9",
}


def fetch_vk_group(group_url: str, source_title: str) -> list[dict]:
    try:
        resp = requests.get(group_url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        print(f"[VK] Ошибка загрузки {group_url}: {e}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    posts = soup.select(".wall_item") or soup.select("._post") or soup.select(".post")

    result = []
    for post in posts[:8]:
        # Текст поста
        text_el = (
            post.select_one(".wall_post_text") or
            post.select_one("._post_content") or
            post.select_one(".post__text")
        )
        if not text_el:
            continue

        text = text_el.get_text(separator="\n").strip()
        if not text or len(text) < 40:
            continue

        # ID поста для ссылки
        post_id = ""
        link_el = post.select_one("a.post__date") or post.select_one(".post_link") or post.get("data-post-id", "")
        if hasattr(link_el, "get"):
            href = link_el.get("href", "")
            if "wall" in href:
                post_id = href.split("/")[-1] if "/" in href else href

        post_url = f"{group_url}?w={post_id}" if post_id else group_url

        # Заголовок — первая непустая строка
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        title = lines[0][:200] if lines else f"Новость — {source_title}"

        # Убираем ссылки из текста
        text_clean = re.sub(r'https?://\S+', '', text).strip()

        body = f"Источник: {source_title}\n\n{text_clean}\n\nОригинал: {group_url}"
        result.append({"title": title, "body": body, "url": group_url + text[:30]})

    return result


def news_already_exists(db, signature: str) -> bool:
    return db.query(News).filter(News.body.contains(signature)).first() is not None


def get_manager_id(db) -> int:
    from app.models.user import User
    user = db.query(User).filter(User.role.in_(["manager", "admin"])).first()
    return user.id if user else 1


def run_vk_fetch() -> int:
    from app.models import user, event, attendance, competition, certification, achievement, camp, hall_of_fame, news, competition_file

    db = SessionLocal()
    imported = 0
    try:
        author_id = get_manager_id(db)

        for group in VK_GROUPS:
            posts = fetch_vk_group(group["url"], group["title"])
            for p in posts:
                # Используем первые 60 символов текста как уникальный ключ
                sig = p["body"][p["body"].find("\n\n")+2:][:60] if "\n\n" in p["body"] else p["body"][:60]
                if news_already_exists(db, sig):
                    continue
                n = News(title=p["title"], body=p["body"], created_by=author_id)
                db.add(n)
                imported += 1

        if imported > 0:
            db.commit()

        print(f"[VK] Импортировано постов: {imported}")
        return imported
    finally:
        db.close()
