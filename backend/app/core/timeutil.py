from datetime import datetime
from zoneinfo import ZoneInfo

MSK = ZoneInfo("Europe/Moscow")


def now_msk() -> datetime:
    """Текущее время МСК, naive — в том же виде, в каком хранятся Event.event_date."""
    return datetime.now(MSK).replace(tzinfo=None)
