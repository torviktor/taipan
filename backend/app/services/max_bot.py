"""Транспорт мессенджера MAX.

Второй канал рядом с Telegram, живёт по тем же правилам, но отличается почти
всем, что касается протокола. Три отличия стоят того, чтобы держать их перед
глазами — каждое стоило отдельной отладки.

1. ТОКЕН уходит заголовком Authorization СЫРОЙ СТРОКОЙ. Префикс Bearer
   ломает авторизацию: проверено, MAX отвечает 401 verify.token
   «Malformed access token».

2. АДРЕСАТ передаётся в query, а не в теле запроса: с адресатом в теле MAX
   отвечает 400 proto.payload «Unknown recipient». В личной переписке адрес —
   это user_id отправителя, а НЕ chat_id: подставленный chat_id даёт
   404 chat.not.found, тогда как чужой user_id — 404 dialog.not.found.
   GET /chats возвращает только групповые беседы, личку там искать бесполезно.

3. СЕРТИФИКАТ platform-api2.max.ru выдан УЦ Минцифры, которого нет в certifi,
   поэтому httpx обязан ходить с отдельным bundle (MAX_CA_BUNDLE, собирается
   при сборке образа). Без него падают 20 запросов из 20, причём TLS доходит
   до сервера за 14 мс — по таймингам выглядит как сетевая проблема, хотя
   ломается проверка цепочки.

Канал до MAX, в отличие от Telegram, стабилен: замер 22.08.2026 дал 20/20 и
медиану 23 мс. Ретраи оставлены на случай коротких отказов, но бюджет им
нужен куда меньший, чем телеграмному.
"""
import logging
import os
import time
from typing import Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

DEFAULT_API_BASE = "https://platform-api2.max.ru"

MAX_SEND_ATTEMPTS = 3
MAX_SEND_DELAY    = 1     # база паузы между попытками, секунды
MAX_SEND_TIMEOUT  = 10

BOT_USERNAME = "id5034074017_bot"


def api_base() -> str:
    """Единственное место, где берётся адрес API.

    Читается при каждом вызове, чтобы правка .env подхватывалась перезапуском
    контейнера без пересборки образа. Старый platform-api.max.ru отключён
    19.07.2026, поэтому по умолчанию сразу platform-api2.
    """
    return os.getenv("MAX_API_BASE", DEFAULT_API_BASE).rstrip("/")


def api_headers() -> dict:
    """Заголовки. Authorization — сырой токен, без Bearer (см. шапку модуля)."""
    return {
        "Authorization": os.getenv("MAX_BOT_TOKEN", ""),
        "Content-Type":  "application/json",
    }


def ca_bundle() -> str:
    """Путь к bundle с корнями Минцифры.

    Переменная выставляется в Dockerfile. Значение по умолчанию совпадает с
    ней и нужно лишь для запуска вне контейнера — если файла нет, httpx
    честно упадёт, и это лучше, чем незаметно ходить без проверки.
    """
    return os.getenv("MAX_CA_BUNDLE", "/etc/ssl/max_ca_bundle.pem")


def is_configured() -> bool:
    return bool(os.getenv("MAX_BOT_TOKEN", ""))


# ─── Отправка ────────────────────────────────────────────────────────────────

def send_message_result(user_id: str, text: str) -> Tuple[str, str]:
    """Отправить сообщение в личку. Возвращает (статус, текст ошибки).

    Статусы совпадают со значениями notifications.tg_status, чтобы в будущем
    мультиканальном конвейере не пришлось переводить одно в другое:
    "sent" | "failed".
    """
    if not is_configured():
        return "failed", "MAX_BOT_TOKEN не задан"

    url = f"{api_base()}/messages"
    last = ""

    for attempt in range(1, MAX_SEND_ATTEMPTS + 1):
        try:
            r = httpx.post(
                url,
                params={"user_id": user_id},
                json={"text": text},
                headers=api_headers(),
                timeout=MAX_SEND_TIMEOUT,
                verify=ca_bundle(),
            )
            if r.status_code == 200:
                if attempt > 1:
                    logger.info("MAX: user_id=%s доставлено с попытки %s", user_id, attempt)
                return "sent", ""

            last = f"HTTP {r.status_code}: {r.text[:200]}"

            # Повторять эти две бессмысленно: адресата не существует или бот
            # не имеет права ему писать. Дальнейшие попытки только задержат
            # обработку вебхука, на который MAX ждёт ответ.
            if r.status_code in (403, 404):
                logger.warning("MAX: user_id=%s не доставлено, повтор не поможет — %s", user_id, last)
                return "failed", last
        except Exception as e:
            # Пустой str(e) у httpx.ConnectError даёт бесполезное «MAX error: »,
            # поэтому логируем и тип исключения.
            last = f"{type(e).__name__}: {e}"

        if attempt < MAX_SEND_ATTEMPTS:
            time.sleep(MAX_SEND_DELAY * attempt)

    logger.error("MAX: не доставлено за %s попыток — %s", MAX_SEND_ATTEMPTS, last)
    return "failed", last


def send_message(user_id: str, text: str) -> bool:
    """Обёртка для мест, которым нужен только факт успеха."""
    return send_message_result(user_id, text)[0] == "sent"


def get_me() -> Optional[dict]:
    """Информация о боте. Используется как проба живости токена."""
    try:
        r = httpx.get(f"{api_base()}/me", headers=api_headers(),
                      timeout=MAX_SEND_TIMEOUT, verify=ca_bundle())
        return r.json() if r.status_code == 200 else None
    except Exception as e:
        logger.warning("MAX: /me не ответил — %s: %s", type(e).__name__, e)
        return None


# ─── Подписка на вебхук ──────────────────────────────────────────────────────
#
# У MAX подписка живёт не вечно: платформа удаляет её после 8 часов без
# успешного ответа нашего эндпоинта. Кроме того, повторный POST /subscriptions
# НЕ заменяет прежнюю подписку, а добавляет ещё одну — накопленные дубли
# означают дубли апдейтов. Поэтому порядок всегда один: сначала снести все
# существующие, потом поставить свою.

def list_subscriptions() -> list:
    r = httpx.get(f"{api_base()}/subscriptions", headers=api_headers(),
                  timeout=MAX_SEND_TIMEOUT, verify=ca_bundle())
    r.raise_for_status()
    data = r.json()
    return data.get("subscriptions", []) if isinstance(data, dict) else (data or [])


def delete_subscription(url: str) -> bool:
    r = httpx.delete(f"{api_base()}/subscriptions", params={"url": url},
                     headers=api_headers(), timeout=MAX_SEND_TIMEOUT,
                     verify=ca_bundle())
    return r.status_code == 200


def ensure_subscription(url: str) -> dict:
    """Привести подписки к состоянию «ровно одна, наша».

    Идемпотентна: годится и для старта приложения, и для периодической сверки
    (единственный источник истины — ответ API, а не локальное состояние).
    """
    result = {"deleted": 0, "created": False, "already": False, "error": None}
    try:
        existing = list_subscriptions()

        for s in existing:
            u = s.get("url", "")
            if u == url:
                result["already"] = True
                continue
            if delete_subscription(u):
                result["deleted"] += 1
                logger.info("MAX: снята чужая подписка %s", u)

        if result["already"]:
            return result

        r = httpx.post(f"{api_base()}/subscriptions", headers=api_headers(),
                       json={"url": url}, timeout=MAX_SEND_TIMEOUT,
                       verify=ca_bundle())
        if r.status_code == 200:
            result["created"] = True
            logger.info("MAX: подписка на вебхук поставлена — %s", url)
        else:
            result["error"] = f"HTTP {r.status_code}: {r.text[:200]}"
            logger.error("MAX: не удалось поставить подписку — %s", result["error"])
    except Exception as e:
        result["error"] = f"{type(e).__name__}: {e}"
        logger.error("MAX: сверка подписки упала — %s", result["error"])

    return result
