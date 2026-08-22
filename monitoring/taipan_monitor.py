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
    for k in ("TELEGRAM_BOT_TOKEN", "ALERT_CHAT_ID", "TELEGRAM_API_BASE",
              "TELEGRAM_API_SECRET"):
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
    # Воркер-релей закрыт секретом: без верного x-bridge-auth он в строгом
    # режиме отвечает 403. Если секрет не задан — заголовка нет вовсе, так
    # работает обращение напрямую к api.telegram.org.
    secret = cfg.get("TELEGRAM_API_SECRET", "")
    if secret:
        req.add_header("x-bridge-auth", secret)

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


CERT_WARN_DAYS = 30


def _cert_days_left(host, port=443):
    """Сколько дней осталось сертификату, который отдаёт host.

    Проверка доверия намеренно отключена: нас интересует только дата, а
    platform-api2.max.ru закрыт сертификатом УЦ Минцифры, которого нет в
    системном наборе хоста — со штатной проверкой функция падала бы там,
    где всё в порядке.
    """
    import ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        with socket.create_connection((host, port), timeout=HTTP_TIMEOUT) as s:
            with ctx.wrap_socket(s, server_hostname=host) as ss:
                der = ss.getpeercert(binary_form=True)
        out = subprocess.run(["openssl", "x509", "-inform", "DER", "-noout", "-enddate"],
                             input=der, capture_output=True, timeout=15)
        line = out.stdout.decode().strip()          # notAfter=Oct  7 21:09:44 2026 GMT
        exp = datetime.strptime(line.split("=", 1)[1].strip(), "%b %d %H:%M:%S %Y %Z")
        return (exp.replace(tzinfo=timezone.utc) - datetime.now(timezone.utc)).days
    except Exception:
        return None


def _bundle_sub_ca_days_left():
    """Срок Sub CA Минцифры в bundle внутри образа backend.

    Именно этот сертификат делает возможными запросы к MAX. Он истекает
    06.03.2027 и, в отличие от нашего Let's Encrypt, никем не продлевается
    автоматически: bundle пересобирается только при сборке образа. Молча
    просроченный корень — это внезапно замолчавший бот.
    """
    # Разбор идёт внутри контейнера: bundle лежит в образе, снаружи его нет.
    # Через cryptography, а не через openssl с нарезкой файла — bundle это
    # больше сотни склеенных PEM, и любая нарезка текста на них хрупка.
    code = (
        "from cryptography import x509;"
        "import os,sys;"
        "d=open(os.environ['MAX_CA_BUNDLE'],'rb').read();"
        "c=[c for c in x509.load_pem_x509_certificates(d)"
        " if 'Russian Trusted Sub CA' in c.subject.rfc4514_string()];"
        "print(c[0].not_valid_after_utc.isoformat() if c else '')"
    )
    try:
        out = subprocess.run(
            ["docker", "compose", "exec", "-T", "backend", "python", "-c", code],
            capture_output=True, text=True, timeout=40, cwd="/opt/taipan",
        )
        val = out.stdout.strip()
        if not val:
            return None
        exp = datetime.fromisoformat(val)
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return (exp - datetime.now(timezone.utc)).days
    except Exception:
        return None


def _cert_lines():
    """Строки о сертификатах для сводки + список тех, что скоро истекут.

    Возвращает (строки, тревоги). Тревога поднимается за CERT_WARN_DAYS дней:
    этого хватает, чтобы успеть отреагировать спокойно, а не в ночь отказа.
    """
    checks = [
        ("наш сертификат (taipan-tkd.ru)", _cert_days_left("taipan-tkd.ru")),
        ("сертификат max.ru",              _cert_days_left("platform-api2.max.ru")),
        ("корень Минцифры в bundle",       _bundle_sub_ca_days_left()),
    ]
    lines, alarms = [], []
    for name, days in checks:
        if days is None:
            lines.append(f"{name}: проверить не удалось")
            continue
        if days < 0:
            lines.append(f"{name}: ⛔ ИСТЁК {-days} дн. назад")
            alarms.append(f"{name} истёк")
        elif days <= CERT_WARN_DAYS:
            lines.append(f"{name}: ⚠️ {days} дн.")
            alarms.append(f"{name} истекает через {days} дн.")
        else:
            lines.append(f"{name}: {days} дн.")
    return lines, alarms


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

    cert_lines, cert_alarms = _cert_lines()

    if problems:
        site_line = "ЕСТЬ ПРОБЛЕМЫ — " + escape("; ".join(problems))
        head = "🟠 <b>Тайпан: сводка за сутки</b>"
    else:
        site_line = "работает"
        # Истекающий сертификат — это не «сайт лежит», но и не «всё хорошо»:
        # молчаливая смерть через полгода уже случалась, поэтому заголовок
        # обязан отличаться от спокойной галочки.
        head = ("⚠️ <b>Тайпан: сводка за сутки</b>" if cert_alarms
                else "✅ <b>Тайпан: сводка за сутки</b>")

    cert_block = "\n".join(escape(l) for l in cert_lines)
    warn_block = ("\n\nВНИМАНИЕ: " + escape("; ".join(cert_alarms))) if cert_alarms else ""

    ok = telegram_send(cfg, (
        f"{head}\n\n"
        f"Сайт: {site_line}\n"
        f"IP и A-запись: {escape(ip_line)}\n"
        f"Неудачных проверок за сутки: {fails_24h}\n"
        f"Уведомлений не доставлено: {notif_line}\n\n"
        f"Сертификаты:\n{cert_block}{warn_block}\n\n"
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
