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


# ─── Разметка и длина ────────────────────────────────────────────────────────
#
# Что установлено опытом на живом API 22.08.2026, а не взято из документации.
# Приём: тело запроса проверяется РАНЬШЕ поиска адресата, поэтому по коду
# ответа для несуществующего получателя видно, принят ли payload:
# 400 proto.payload — отвергнут, 404 dialog.not.found — принят.
#
#   * format принимает только html и markdown, регистр не важен.
#     'md', 'text', 'plain', 'none' отвергаются с 400.
#   * Предел текста — ровно 4000 СИМВОЛОВ (не байт: кириллица и латиница
#     ведут себя одинаково). 4000 проходит, 4001 отвергается.
#   * Сообщение, у которого нет видимого текста, отвергается: пустая строка,
#     '<b></b>' и одиночный '<br>' одинаково дают 400. Это ловушка — пустой
#     список событий легко превращается в такое сообщение.
#   * А вот НАБОР ТЕГОВ API не проверяет: и <b>, и выдуманный <div> одинаково
#     дают 404, то есть payload принят. Значит, какие теги действительно
#     отображаются, по API узнать НЕЛЬЗЯ — нужен живой диалог и глаза.
#     Поэтому ниже сознательно узкий список: только то, что заведомо есть в
#     любой реализации HTML-разметки мессенджеров. Проверить остальное
#     поможет scripts/max_markup_probe.py, когда появится собеседник.

MAX_TEXT_LIMIT = 4000

# Узкий список намеренно: непроверенный тег в худшем случае показывается
# читателю сырым, и это хуже отсутствия выделения.
ALLOWED_TAGS = ("b", "i", "u", "s", "code", "a")


# Экранирование общее для обоих мессенджеров и живёт в core: правило одно,
# а дублирование означало бы однажды поправить только в одном месте.
# Имя оставлено доступным отсюда — им пользуются роуты бота MAX.
from app.core.markup import esc  # noqa: E402  (ре-экспорт ради читаемости вызовов)


def has_visible_text(text: str) -> bool:
    """Останется ли что-то после снятия разметки.

    MAX отвергает сообщение без видимого текста с 400 proto.payload, а такое
    сообщение получается само собой: заголовок в <b>, пустой список под ним —
    и внезапно нечего показывать.
    """
    import re
    stripped = re.sub(r"<[^>]*>", "", text)
    return bool(stripped.replace("&nbsp;", " ").strip())


# ─── Клавиатура под сообщением ───────────────────────────────────────────────
#
# Пределы и структура установлены на живом API 22.08.2026 тем же приёмом
# (400 proto.payload против 404 dialog.not.found у несуществующего адресата):
#
#   * вложение: {"type": "inline_keyboard", "payload": {"buttons": [[…], […]]}}.
#     Кнопки — СПИСОК РЯДОВ. Плоский список и вариант без обёртки payload
#     отвергаются с «Can't deserialize body»;
#   * не больше 7 кнопок в ряду (errors.maxRowSize) и 30 рядов
#     (errors.maxRows), то есть 210 штук всего;
#   * подпись кнопки — до 128 символов, пустая запрещена;
#   * payload у callback — до 1024 символов, поле обязательное, как и text;
#   * типы: callback, link, request_contact, request_geo_location, message.
#     Выдуманный тип отвергается.
#
# Пределы вынесены в константы не для красоты: подпись собирается из данных
# (например, имени ребёнка), и обрезать её надо нам, а не получать 400 из
# середины обработки вебхука.

KEYBOARD_MAX_ROWS    = 30
KEYBOARD_MAX_PER_ROW = 7
BUTTON_TEXT_LIMIT    = 128
CALLBACK_PAYLOAD_LIMIT = 1024


def callback_button(text: str, payload: str) -> dict:
    """Кнопка, присылающая апдейт message_callback."""
    text = (text or "").strip()[:BUTTON_TEXT_LIMIT]
    if not text:
        raise ValueError("подпись кнопки не может быть пустой — MAX отвергает")
    if len(payload) > CALLBACK_PAYLOAD_LIMIT:
        raise ValueError(f"payload длиннее {CALLBACK_PAYLOAD_LIMIT} символов")
    return {"type": "callback", "text": text, "payload": payload}


def link_button(text: str, url: str) -> dict:
    """Кнопка-ссылка. Нажатие к нам не приходит — браузер открывается сам."""
    return {"type": "link", "text": (text or "").strip()[:BUTTON_TEXT_LIMIT], "url": url}


def keyboard(rows: list) -> dict:
    """Собрать вложение с клавиатурой из списка рядов.

    Проверяем пределы здесь, чтобы ошибка всплыла на нашей стороне с внятным
    текстом, а не пришла как proto.payload посреди обработки апдейта.
    """
    rows = [r for r in rows if r]
    if len(rows) > KEYBOARD_MAX_ROWS:
        raise ValueError(f"рядов {len(rows)}, предел {KEYBOARD_MAX_ROWS}")
    for i, row in enumerate(rows, 1):
        if len(row) > KEYBOARD_MAX_PER_ROW:
            raise ValueError(f"в ряду {i} кнопок {len(row)}, предел {KEYBOARD_MAX_PER_ROW}")
    return {"type": "inline_keyboard", "payload": {"buttons": rows}}


def answer_callback(callback_id: str, notification: Optional[str] = None) -> bool:
    """Подтвердить нажатие кнопки.

    Без этого у нажавшего остаётся крутящийся индикатор: платформа ждёт
    подтверждения. Пустое тело допустимо и ничего не показывает — всплывающее
    уведомление на каждое нажатие только мешало бы, ответ и так приходит
    отдельным сообщением.
    """
    body = {"notification": notification} if notification else {}
    try:
        r = httpx.post(f"{api_base()}/answers", params={"callback_id": callback_id},
                       json=body, headers=api_headers(),
                       timeout=MAX_SEND_TIMEOUT, verify=ca_bundle())
        if r.status_code != 200:
            logger.warning("MAX: нажатие не подтверждено — HTTP %s: %s",
                           r.status_code, r.text[:200])
        return r.status_code == 200
    except Exception as e:
        logger.warning("MAX: подтверждение нажатия упало — %s: %s", type(e).__name__, e)
        return False


def split_text(text: str, limit: int = MAX_TEXT_LIMIT) -> list:
    """Разбить длинный текст на части не длиннее limit символов.

    Режем по границам строк: список событий на месяц легко перерастает предел,
    и разрыв посреди строки выглядит как потеря данных. Если одна строка сама
    длиннее предела (такого в наших текстах быть не должно, но пусть), режем
    её жёстко — потерять кусок хуже, чем показать некрасиво.
    """
    if len(text) <= limit:
        return [text]

    parts, buf = [], ""
    for line in text.split("\n"):
        while len(line) > limit:
            if buf:
                parts.append(buf.rstrip("\n"))
                buf = ""
            parts.append(line[:limit])
            line = line[limit:]
        if len(buf) + len(line) + 1 > limit:
            parts.append(buf.rstrip("\n"))
            buf = ""
        buf += line + "\n"
    if buf.strip():
        parts.append(buf.rstrip("\n"))
    return parts


# ─── Отправка ────────────────────────────────────────────────────────────────

def send_message_result(user_id: str, text: str, fmt: str = "html",
                        buttons: Optional[list] = None) -> Tuple[str, str]:
    """Отправить сообщение в личку. Возвращает (статус, текст ошибки).

    Статусы совпадают со значениями notifications.tg_status, чтобы в будущем
    мультиканальном конвейере не пришлось переводить одно в другое:
    "sent" | "failed".

    Длинный текст разбивается на части: предел MAX — 4000 символов, а сводка
    событий на месяц его перерастает. Части уходят по очереди, статус общий:
    недоставленная середина делает сообщение бессмысленным целиком.

    Клавиатура, если задана, вешается на ПОСЛЕДНЮЮ часть: иначе кнопки
    оказались бы в середине разговора, над остатком текста.
    """
    if not is_configured():
        return "failed", "MAX_BOT_TOKEN не задан"

    if not has_visible_text(text):
        # Отправлять нечего. Без этой проверки MAX ответил бы 400
        # proto.payload, и в лог попала бы загадочная ошибка протокола вместо
        # понятной причины.
        return "failed", "нечего отправлять: текст пуст после снятия разметки"

    chunks = split_text(text)
    last = len(chunks)
    for i, chunk in enumerate(chunks, 1):
        status, err = _send_one(user_id, chunk, fmt,
                                buttons if i == last else None)
        if status != "sent":
            if last > 1:
                err = f"часть {i} из {last}: {err}"
            return status, err
    return "sent", ""


def _send_one(user_id: str, text: str, fmt: str,
              buttons: Optional[list] = None) -> Tuple[str, str]:
    """Одна порция текста, с повторами."""
    url = f"{api_base()}/messages"
    last = ""

    body = {"text": text, "format": fmt}
    if buttons:
        body["attachments"] = [keyboard(buttons)]

    for attempt in range(1, MAX_SEND_ATTEMPTS + 1):
        try:
            r = httpx.post(
                url,
                params={"user_id": user_id},
                json=body,
                headers=api_headers(),
                timeout=MAX_SEND_TIMEOUT,
                verify=ca_bundle(),
            )
            if r.status_code == 200:
                if attempt > 1:
                    logger.info("MAX: user_id=%s доставлено с попытки %s", user_id, attempt)
                return "sent", ""

            last = f"HTTP {r.status_code}: {r.text[:200]}"

            # Повторять эти три бессмысленно: адресата не существует, бот не
            # имеет права ему писать, либо тело запроса неверно — все три от
            # повтора не изменятся. Лишние попытки только задержат обработку
            # вебхука, на который MAX ждёт ответ.
            if r.status_code in (400, 403, 404):
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


def send_message(user_id: str, text: str, fmt: str = "html",
                 buttons: Optional[list] = None) -> bool:
    """Обёртка для мест, которым нужен только факт успеха."""
    return send_message_result(user_id, text, fmt, buttons)[0] == "sent"


def set_commands(commands: list) -> Tuple[bool, str]:
    """Записать меню команд в карточку бота.

    Аналог setMyCommands у Telegram существует и здесь: PATCH /me/commands,
    тело строго {"commands": [...]} — голый список отвергается с
    «Can't deserialize body». Проверено на живом API 22.08.2026.

    То есть трогать карточку на business.max.ru ради команд не нужно.
    """
    try:
        r = httpx.patch(f"{api_base()}/me/commands", json={"commands": commands},
                        headers=api_headers(), timeout=MAX_SEND_TIMEOUT,
                        verify=ca_bundle())
        if r.status_code == 200:
            return True, ""
        return False, f"HTTP {r.status_code}: {r.text[:200]}"
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"


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
