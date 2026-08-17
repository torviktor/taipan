"""Сетевые настройки процесса.

У сервера нет IPv6-маршрута, а часть внешних хостов (в первую очередь
api.telegram.org) резолвится и в A, и в AAAA. Попытка соединения по IPv6
гарантированно заканчивается «[Errno 101] Network is unreachable» и впустую
съедает таймаут — при и без того нестабильном канале это удваивало время
каждой неудачной отправки.

Тот же приём уже применён в monitoring/taipan_monitor.py.
"""

import logging
import socket

logger = logging.getLogger(__name__)

_orig_getaddrinfo = socket.getaddrinfo
_applied = False


def _getaddrinfo_ipv4_only(*args, **kwargs):
    res = [r for r in _orig_getaddrinfo(*args, **kwargs) if r[0] == socket.AF_INET]
    # Если IPv4-адресов нет вовсе — отдаём что есть, чтобы не сломать
    # обращения к хостам, доступным только по IPv6.
    return res or _orig_getaddrinfo(*args, **kwargs)


def force_ipv4() -> None:
    """Убрать IPv6 из результатов резолвинга для всего процесса."""
    global _applied
    if _applied:
        return
    socket.getaddrinfo = _getaddrinfo_ipv4_only
    _applied = True
    logger.info("net: резолвинг ограничен IPv4 (у хоста нет IPv6-маршрута)")
