#!/usr/bin/env python3
"""Внешний мониторинг доступности taipan-tkd.ru.

Работает НА ХОСТЕ, вне docker compose, и намеренно не зависит ни от одного
компонента приложения: ни от backend, ни от celery, ни от БД. Иначе монитор
разделил бы точку отказа с тем, что он проверяет, и при падении compose
никто бы ничего не узнал.

Проверяет:
  1. https://taipan-tkd.ru/            → 200
  2. https://taipan-tkd.ru/api/schedule/ → 200
  3. публичный IP сервера == A-запись домена
     (ровно тот сбой, что случился 14.08.2026: у сервера сменился адрес,
      DNS остался со старым, сайт лежал трое суток)

Алертит в Telegram один раз при переходе в «упал» и один раз при
восстановлении. Порог — FAIL_THRESHOLD неудачных проверок подряд.

Зависимости: только стандартная библиотека Python 3.
"""

import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

# У сервера нет IPv6-маршрута, а часть хостов (в т.ч. api.telegram.org)
# резолвится и в A, и в AAAA. Попытка по IPv6 гарантированно даёт
# «[Errno 101] Network is unreachable» и просто съедает время и попытки.
_orig_getaddrinfo = socket.getaddrinfo


def _getaddrinfo_ipv4_only(*args, **kwargs):
    res = [r for r in _orig_getaddrinfo(*args, **kwargs) if r[0] == socket.AF_INET]
    return res or _orig_getaddrinfo(*args, **kwargs)


socket.getaddrinfo = _getaddrinfo_ipv4_only

CONFIG_PATH = os.environ.get("TAIPAN_MONITOR_CONFIG", "/etc/taipan-monitor.env")
STATE_PATH = os.environ.get("TAIPAN_MONITOR_STATE", "/var/lib/taipan-monitor/state.json")

DOMAIN = "taipan-tkd.ru"
URL_ROOT = f"https://{DOMAIN}/"
URL_API = f"https://{DOMAIN}/api/schedule/"

HTTP_TIMEOUT = 15          # секунд на одну проверку
FAIL_THRESHOLD = 3         # столько неудач подряд до алерта (5 мин × 3 ≈ 15 мин)
TELEGRAM_ATTEMPTS = 6      # попыток доставки алерта: канал до Telegram нестабилен
TELEGRAM_RETRY_DELAY = 3   # база паузы между попытками, секунды (3, 6, 9, …)

# Переопределяется через TELEGRAM_API_BASE в /etc/taipan-monitor.env
DEFAULT_TELEGRAM_API_BASE = "https://api.telegram.org"

IP_SERVICES = [
    "https://api.ipify.org",
    "https://checkip.amazonaws.com",
    "https://ifconfig.me/ip",
]
DNS_RESOLVERS = ["1.1.1.1", "8.8.8.8"]


# ─── конфиг ───────────────────────────────────────────────────────────────────

def load_config():
    """Читает KEY=VALUE из /etc/taipan-monitor.env. Файл не в git — там токен."""
    cfg = {}
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                cfg[k.strip()] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    # переменные окружения имеют приоритет — удобно для ручного запуска
    for k in ("TELEGRAM_BOT_TOKEN", "ALERT_CHAT_ID", "TELEGRAM_API_BASE"):
        if os.environ.get(k):
            cfg[k] = os.environ[k]
    return cfg


# ─── состояние ────────────────────────────────────────────────────────────────

def _iso_hours_ago(hours):
    from datetime import timedelta
    return (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat(timespec="seconds")


def load_state():
    try:
        with open(STATE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, ValueError):
        return {"fails": 0, "down": False, "since": None, "fail_log": []}


def save_state(state):
    os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
    tmp = STATE_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False)
    os.replace(tmp, STATE_PATH)   # атомарно: не оставит битый файл при сбое


# ─── проверки ─────────────────────────────────────────────────────────────────

def http_status(url, timeout=HTTP_TIMEOUT):
    """Возвращает (код, текст ошибки). Код 0 — соединения не было."""
    req = urllib.request.Request(url, headers={"User-Agent": "taipan-monitor/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, ""
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:
        return 0, f"{type(e).__name__}: {e}"


def get_public_ip():
    for url in IP_SERVICES:
        req = urllib.request.Request(url, headers={"User-Agent": "taipan-monitor/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                ip = r.read().decode().strip()
                if ip:
                    return ip
        except Exception:
            continue
    return None


def get_dns_ip():
    """A-запись домена глазами публичного резолвера, а не локального кэша."""
    for resolver in DNS_RESOLVERS:
        try:
            out = subprocess.run(
                ["dig", "+short", "+time=5", "+tries=1", "A", DOMAIN, f"@{resolver}"],
                capture_output=True, text=True, timeout=15,
            )
            ips = [l.strip() for l in out.stdout.splitlines()
                   if l.strip() and not l.strip().endswith(".")]
            if ips:
                return ips[0]
        except Exception:
            continue
    try:
        return socket.gethostbyname(DOMAIN)
    except Exception:
        return None


def run_checks():
    """Возвращает список проблем. Пустой список — всё хорошо."""
    problems = []

    code, err = http_status(URL_ROOT)
    if code != 200:
        problems.append(f"главная: {code or 'нет соединения'}" + (f" ({err})" if err else ""))

    code, err = http_status(URL_API)
    if code != 200:
        problems.append(f"/api/schedule/: {code or 'нет соединения'}" + (f" ({err})" if err else ""))

    public_ip = get_public_ip()
    dns_ip = get_dns_ip()
    if public_ip and dns_ip and public_ip != dns_ip:
        problems.append(
            f"IP сервера ({public_ip}) не совпадает с A-записью ({dns_ip}) — "
            f"нужно обновить DNS"
        )
    elif public_ip is None:
        problems.append("не удалось определить публичный IP сервера")
    elif dns_ip is None:
        problems.append("не удалось получить A-запись домена")

    return problems


# ─── telegram ─────────────────────────────────────────────────────────────────

def escape(text):
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def telegram_send(cfg, text):
    token = cfg.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = cfg.get("ALERT_CHAT_ID", "")
    if not token or not chat_id:
        missing = "TELEGRAM_BOT_TOKEN" if not token else "ALERT_CHAT_ID"
        log(f"ALERT НЕ ОТПРАВЛЕН: в {CONFIG_PATH} не заполнен {missing}")
        log("текст был: " + text.replace("\n", " | "))
        return False

    data = urllib.parse.urlencode({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": "true",
    }).encode()
    # Базовый адрес Bot API берётся из конфига: на проде это Cloudflare Worker,
    # прозрачно пробрасывающий /bot<token>/<method>. Прямой канал до
    # api.telegram.org с этого сервера теряет около половины запросов.
    base = cfg.get("TELEGRAM_API_BASE", DEFAULT_TELEGRAM_API_BASE).rstrip("/")
    url = f"{base}/bot{token}/sendMessage"

    # Повторы оставлены и после перехода на воркер: канал до Cloudflare
    # стабилен (20/20 в замере), но ретраи ничего не стоят, а алерт — это
    # ровно то сообщение, которое нельзя терять.
    # User-Agent обязателен: Cloudflare (а воркер живёт за ним) отдаёт
    # «error code: 1010» на дефолтный Python-urllib — блокировка по сигнатуре
    # клиента. Проверено: с любым осмысленным UA запрос проходит, без него —
    # стабильный 403, то есть алерты молча не уходили бы вообще.
    req = urllib.request.Request(url, data=data)
    req.add_header("User-Agent", "taipan-monitor/1.0")

    last = ""
    for attempt in range(1, TELEGRAM_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                if r.status == 200:
                    if attempt > 1:
                        log(f"Telegram: доставлено с попытки {attempt}")
                    return True
                last = f"HTTP {r.status}"
        except Exception as e:
            last = f"{type(e).__name__}: {e}"
        if attempt < TELEGRAM_ATTEMPTS:
            time.sleep(TELEGRAM_RETRY_DELAY * attempt)

    log(f"Telegram недоступен после {TELEGRAM_ATTEMPTS} попыток, последняя ошибка — {last}")
    log("недоставленный текст: " + text.replace("\n", " | "))
    return False


def log(msg):
    """В stdout — journald подхватит сам."""
    print(f"[{datetime.now(timezone.utc).isoformat(timespec='seconds')}] {msg}", flush=True)


# ─── сценарии ─────────────────────────────────────────────────────────────────

def cmd_check(cfg, force_fail=False):
    problems = ["ПРИНУДИТЕЛЬНАЯ ПРОВЕРКА (--force-fail): это учебная тревога"] if force_fail else run_checks()
    state = load_state()
    now = datetime.now(timezone.utc).strftime("%d.%m.%Y %H:%M UTC")

    if problems:
        state["fails"] = state.get("fails", 0) + 1
        # Журнал неудач за последние двое суток — из него ежедневная сводка
        # берёт цифру «сколько раз проверка падала». Счётчик fails для этого не
        # годится: он обнуляется при первой же удачной проверке.
        fail_log = [t for t in state.get("fail_log", []) if t > _iso_hours_ago(48)]
        fail_log.append(datetime.now(timezone.utc).isoformat(timespec="seconds"))
        state["fail_log"] = fail_log[-500:]
        log(f"проверка провалена ({state['fails']}/{FAIL_THRESHOLD}): {'; '.join(problems)}")

        if state["fails"] >= FAIL_THRESHOLD and not state.get("down"):
            body = "\n".join(f"• {escape(p)}" for p in problems)
            telegram_send(cfg, (
                f"🔴 <b>Сайт недоступен</b>\n\n{body}\n\n"
                f"Неудачных проверок подряд: {state['fails']}\n"
                f"Время: {now}"
            ))
            state["down"] = True
            state["since"] = now
    else:
        if state.get("down"):
            sent = telegram_send(cfg, (
                f"🟢 <b>Сайт снова доступен</b>\n\n"
                f"Был недоступен с {escape(str(state.get('since') or '—'))}\n"
                f"Время: {now}"
            ))
            log("восстановление" + (" — алерт отправлен" if sent else " — алерт отправить не удалось"))
        elif state.get("fails"):
            log(f"проверка успешна, счётчик сброшен (было {state['fails']})")
        state["fails"] = 0
        state["down"] = False
        state["since"] = None

    save_state(state)
    return 1 if problems else 0


def _failed_notifications_24h():
    """Сколько уведомлений за сутки осталось со статусом failed.

    Обращение к БД допустимо только здесь: сводка — это отчёт, а не путь
    доставки алерта. Если БД недоступна, сводка всё равно уходит, просто с
    пометкой вместо цифры.
    """
    sql = ("SELECT count(*) FROM notifications "
           "WHERE tg_status = 'failed' AND created_at >= now() - interval '24 hours';")
    try:
        out = subprocess.run(
            ["docker", "compose", "exec", "-T", "db", "psql", "-U", "taipan_user",
             "-d", "taipan_db", "-tAc", sql],
            capture_output=True, text=True, timeout=30, cwd="/opt/taipan",
        )
        val = out.stdout.strip()
        return int(val) if val.isdigit() else None
    except Exception:
        return None


def cmd_heartbeat(cfg):
    """Ежедневное «я жив».

    Смысл сообщения — не в его содержимом, а в самом факте прихода: если оно
    не пришло, значит сломан канал уведомлений. За сессию дважды случалось,
    что система считала себя исправной, а доставки не было — send_telegram_to_user
    возвращала True не глядя на ответ, а монитор получал от Cloudflare 403,
    показывая при этом --status OK. Такое молчание теперь заметно.

    Поэтому сводка уходит ВСЕГДА: она не зависит от состояния «упал/ок», не
    трогает счётчики и не подавляется антиспамом.
    """
    now = datetime.now(timezone.utc).strftime("%d.%m.%Y %H:%M UTC")
    problems = run_checks()
    state = load_state()

    public_ip = get_public_ip()
    dns_ip = get_dns_ip()
    ip_line = ("совпадает" if public_ip and public_ip == dns_ip
               else f"РАСХОЖДЕНИЕ: сервер {public_ip}, DNS {dns_ip}")

    since = _iso_hours_ago(24)
    fails_24h = len([t for t in state.get("fail_log", []) if t > since])
    failed_notifs = _failed_notifications_24h()
    notif_line = "нет данных (БД недоступна)" if failed_notifs is None else str(failed_notifs)

    if problems:
        site_line = "ЕСТЬ ПРОБЛЕМЫ — " + escape("; ".join(problems))
        head = "🟠 <b>Тайпан: сводка за сутки</b>"
    else:
        site_line = "работает"
        head = "✅ <b>Тайпан: сводка за сутки</b>"

    ok = telegram_send(cfg, (
        f"{head}\n\n"
        f"Сайт: {site_line}\n"
        f"IP и A-запись: {escape(ip_line)}\n"
        f"Неудачных проверок за сутки: {fails_24h}\n"
        f"Уведомлений не доставлено: {notif_line}\n\n"
        f"{now}"
    ))
    log("сводка отправлена" if ok else "сводку отправить НЕ удалось")
    return 0 if ok else 1


def cmd_test(cfg):
    now = datetime.now(timezone.utc).strftime("%d.%m.%Y %H:%M UTC")
    problems = run_checks()
    status = "все проверки прошли" if not problems else "; ".join(problems)
    ok = telegram_send(cfg, (
        f"🔧 <b>Тест мониторинга Тайпан</b>\n\n"
        f"Канал доставки работает.\n"
        f"Текущее состояние: {escape(status)}\n"
        f"Время: {now}"
    ))
    log("тестовое сообщение отправлено" if ok else "тестовое сообщение НЕ отправлено")
    return 0 if ok else 1


def cmd_status(cfg):
    problems = run_checks()
    log(f"публичный IP: {get_public_ip()}   A-запись: {get_dns_ip()}")
    log("состояние: " + ("OK" if not problems else "; ".join(problems)))
    log(f"файл состояния: {load_state()}")
    log(f"адресат алертов задан: {'да' if cfg.get('ALERT_CHAT_ID') else 'НЕТ'}")
    return 0 if not problems else 1


def cmd_resolve_chat():
    """Достаёт telegram_id админа из БД и печатает строку для конфига.

    Намеренно отдельная ручная команда, а не часть проверки: постоянная
    зависимость от БД вернула бы монитору общую точку отказа с приложением.
    """
    sql = ("SELECT t.telegram_id FROM telegram_subscribers t "
           "JOIN users u ON u.id = t.user_id "
           "WHERE u.role = 'admin' AND t.subscribed = true "
           "ORDER BY t.id LIMIT 1;")
    try:
        out = subprocess.run(
            ["docker", "compose", "exec", "-T", "db", "psql", "-U", "taipan_user",
             "-d", "taipan_db", "-tAc", sql],
            capture_output=True, text=True, timeout=30, cwd="/opt/taipan",
        )
        chat = out.stdout.strip()
    except Exception as e:
        log(f"не удалось обратиться к БД: {e}")
        return 1

    if not chat:
        log("В БД нет админа с привязанным Telegram.")
        log("Пусть админ напишет боту @taipan_tkd_bot команду:  /link <его телефон>")
        return 1
    log(f"Найден chat_id админа. Впишите в {CONFIG_PATH}:")
    print(f"ALERT_CHAT_ID={chat}")
    return 0


def main():
    args = sys.argv[1:]
    cfg = load_config()
    if "--test" in args:
        return cmd_test(cfg)
    if "--heartbeat" in args:
        return cmd_heartbeat(cfg)
    if "--status" in args:
        return cmd_status(cfg)
    if "--resolve-chat" in args:
        return cmd_resolve_chat()
    return cmd_check(cfg, force_fail="--force-fail" in args)


if __name__ == "__main__":
    sys.exit(main())
