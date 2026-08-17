"""Логи, переживающие деплой.

Деплой делает `docker compose down`, а json-лог docker'а лежит внутри каталога
контейнера и удаляется вместе с ним. 17.08.2026 из-за этого не удалось
посчитать, сколько уведомлений не дошло: вся история обрывалась на последней
пересборке, а их за день было шесть.

Поэтому пишем ещё и в файл на примонтированном томе вне /opt/taipan — его не
трогают ни `git reset --hard` при деплое, ни удаление контейнера.

Ротация двухуровневая:
  * по размеру — здесь, RotatingFileHandler;
  * по сроку   — logrotate на хосте (/etc/logrotate.d/taipan).

Важно: сюда попадает только то, что идёт через logging. Legacy-вызовы print()
в коде остаются лишь в json-логе docker'а и умирают вместе с контейнером.
"""

import logging
import os
from logging.handlers import RotatingFileHandler

LOG_DIR = os.getenv("LOG_DIR", "/var/log/taipan")
MAX_BYTES = 20 * 1024 * 1024   # 20 МБ на файл
BACKUP_COUNT = 5               # + 5 архивных, т.е. не больше ~120 МБ на сервис

_configured = False
_handler = None


def _build_handler(service: str):
    """Создать (или вернуть уже созданный) файловый обработчик."""
    global _handler
    if _handler is not None:
        return _handler
    os.makedirs(LOG_DIR, exist_ok=True)
    path = os.path.join(LOG_DIR, f"{service}.log")
    h = RotatingFileHandler(
        path, maxBytes=MAX_BYTES, backupCount=BACKUP_COUNT, encoding="utf-8"
    )
    h.setFormatter(logging.Formatter(
        "%(asctime)s %(levelname)-8s %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    ))
    h.setLevel(logging.INFO)
    _handler = h
    return h


def attach_file_handler(logger) -> None:
    """Повесить файловый обработчик на конкретный логгер.

    Нужно для Celery: он после старта перенастраивает логирование и сносит
    обработчики корневого логгера, из-за чего исходы доставки уведомлений —
    ровно то, ради чего файл и заводился, — в него не попадали.
    """
    if _handler is None:
        return
    # Повторяем и здесь: Celery перенастраивает логирование после нашего
    # setup_file_logging и может вернуть httpx на INFO, а с ним — токен бота
    # в тексте URL.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    if _handler not in logger.handlers:
        logger.addHandler(_handler)
    if logger.level > logging.INFO or logger.level == logging.NOTSET:
        logger.setLevel(logging.INFO)


def setup_file_logging(service: str) -> None:
    """Добавить к корневому логгеру запись в /var/log/taipan/<service>.log.

    Имя файла берётся из LOG_SERVICE, если задано. Это важно для Celery:
    worker и beat — разные процессы, и общий файл они бы ротировали наперегонки,
    затирая записи друг друга.
    """
    global _configured
    if _configured:
        return

    service = os.getenv("LOG_SERVICE", service)
    try:
        handler = _build_handler(service)
        path = handler.baseFilename
        root = logging.getLogger()
        root.addHandler(handler)
        # INFO, иначе не видно строк вида «доставлено с попытки 2»: uvicorn
        # оставляет корневой логгер на WARNING, и успешные ретраи терялись.
        if root.level > logging.INFO or root.level == logging.NOTSET:
            root.setLevel(logging.INFO)
        # httpx на INFO печатает URL целиком, а у Telegram токен зашит прямо в
        # путь: .../bot<TOKEN>/sendMessage. В эфемерном логе контейнера это
        # почти не жило, но файл на диске хранится 30 суток — токен туда
        # попадать не должен.
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("httpcore").setLevel(logging.WARNING)

        _configured = True
        root.info("logging: файловый лог включён — %s", path)
    except Exception as e:
        # Логи не должны ронять сервис: не смогли открыть файл — работаем как
        # раньше, только в stdout.
        logging.getLogger(__name__).warning(
            "logging: файловый лог не включён (%s: %s)", type(e).__name__, e
        )
