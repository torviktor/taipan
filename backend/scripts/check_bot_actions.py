"""Каждое действие, которое бот предлагает человеку, должно исполняться.

ЗАЧЕМ. 25.08.2026 кнопки «💰 Должники» и «📊 Сбор за месяц» в MAX отвечали
«не понимаю эту команду». Имена debtors/collection/paid были в клавиатуре и в
карте прав ACTION_ROLES, но ни в ACTIONS, ни в STAFF_ACTIONS — то есть ветки
исполнения для них не существовало. Кнопка рисовалась, право давало «можно»,
payload доезжал до диспетчера и проваливался мимо всех веток к финальному
return UNKNOWN. Три места из четырёх были заполнены, и этого хватило, чтобы
дефект выглядел как проблема с payload.

Проверка закрывает ровно этот зазор: она не читает списки, а СПРАШИВАЕТ у
бота, что он покажет, и потом просит его это исполнить.

ОТКУДА БЕРЁТСЯ СПИСОК КНОПОК. Из реально собранной клавиатуры: main_keyboard()
вызывается для каждой роли, payload'ы вынимаются из готовой структуры. Первая
версия этой проверки искала их регулярным выражением по тексту модуля и
пропускала ряды, собираемые циклом, — денежный ряд как раз такой. Кнопка,
которую видит человек, и кнопка, которую видит проверка, теперь один объект.

ПОЧЕМУ ИСПОЛНЯЕМ ОТ ИМЕНИ АДМИНА. Права в ACTION_ROLES вложены: admin может
всё, что может manager. Значит одного актора достаточно, чтобы дойти до ветки
исполнения любого действия; сами права проверяются отдельной колонкой.

ЧТО ЭТА ПРОВЕРКА НЕ ДЕЛАЕТ. Она не заменяет живое нажатие: разбор апдейта от
платформы, доставка ответа и подтверждение колбэка остаются за её границей.
Она отвечает на один вопрос — «есть ли кому исполнить», — и на него отвечает
полно.

Запуск:
    docker compose exec -T backend python scripts/check_bot_actions.py
Код возврата 1, если найдено хоть одно неисполняемое действие.

Лежит в backend/, а не в scripts/ при корне: корневой каталог в образ не
копируется (Dockerfile: WORKDIR /app, COPY . . из backend/), и написанная
здесь команда запуска молча не работала бы.
"""
import os
import re
import sys
import asyncio

# python scripts/check_bot_actions.py кладёт в sys.path каталог САМОГО скрипта,
# а не рабочий, поэтому пакет app иначе не находится. Проверено запуском:
# первая версия падала на ModuleNotFoundError ровно той командой, которая
# написана выше как способ её запустить.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.event import MessengerSubscriber, TelegramSubscriber
from app.models.user import User

# Действия, меняющие состояние подписки: их исполнение проверяется живым
# нажатием, а не здесь — скрипт не должен ничего переключать.
MUTATING = {"start", "stop", "unlink", "link"}


def _payloads(rows) -> set:
    """Payload'ы всех callback-кнопок готовой клавиатуры."""
    out = set()
    for row in rows or []:
        for btn in row:
            if isinstance(btn, dict) and btn.get("type") == "callback":
                out.add(btn.get("payload", ""))
    return out


def check_max(db) -> list:
    from app.routes import max as mx
    from app.services import reach

    print("=" * 78)
    print("MAX")
    print("=" * 78)

    # Клавиатура каждой роли — из самого сборщика.
    #
    # Подписчик создаётся временный и в базу НЕ попадает: сборка клавиатуры
    # ничего не коммитит, autoflush выключен, в конце db.rollback(). Реальные
    # строки при этом не трогаются — иначе пришлось бы на время переставлять
    # чужую привязку, а этого делать нельзя.
    seen, by_role = set(), {}
    probes = [("не привязан", None)]
    for role in ("parent", "manager", "admin"):
        u = db.query(User).filter(User.role == role, User.is_active == True).first()
        if u:
            probes.append((role, u.id))

    for label, uid in probes:
        probe = MessengerSubscriber(platform="max", external_id="__check__",
                                    user_id=uid, subscribed=True)
        db.add(probe)
        pl = _payloads(mx.main_keyboard(probe))
        db.expunge(probe)
        by_role[label] = pl
        seen |= pl
        print(f"  клавиатура [{label:11}] кнопок-действий: {len(pl)}")
    db.rollback()

    universe = set(mx.ACTIONS) | set(mx.STAFF_ACTIONS) | set(reach.ACTION_ROLES) | seen
    print(f"  всего действий к проверке: {len(universe)}\n")

    actor = (db.query(MessengerSubscriber)
             .join(User, User.id == MessengerSubscriber.user_id)
             .filter(MessengerSubscriber.platform == "max",
                     User.role == "admin", User.is_active == True)
             .first())
    if actor is None:
        print("  ⚠️  нет ни одного админа с привязанным MAX — исполнение не проверено")
        return sorted(universe)
    print(f"  исполняю от имени admin (подписчик {actor.external_id})\n")

    # Колонка «кнопка»: р — родитель, м — менеджер, а — админ.
    hdr = f"  {'действие':16} {'кнопка':7} {'право':6} {'команда':8} исход"
    print(hdr)
    print("  " + "-" * (len(hdr) - 2))

    broken = []
    for a in sorted(universe):
        kb = "".join(r[0] for r, p in by_role.items()
                     if a in p and r != "не привязан") or "—"
        right = ("да" if reach.can(db, actor.user_id, a)
                 else "нет") if a in reach.ACTION_ROLES else "н/д"
        cmd = "да" if f"/{a}" in mx.COMMAND_ALIASES else "НЕТ"
        if a in MUTATING:
            out = "пропущено (меняет подписку)"
        else:
            try:
                r = mx.run_action(a, db, actor, "")
                if isinstance(r, tuple):
                    r = r[0]
                if r == mx.UNKNOWN:
                    out = "❌ НЕ ПОНИМАЮ ЭТУ КОМАНДУ"
                    broken.append(f"max:{a}")
                else:
                    out = "✅ " + re.sub(r"<[^>]+>", "", r).strip().splitlines()[0][:38]
            except Exception as e:
                out = f"💥 {type(e).__name__}: {e}"
                broken.append(f"max:{a}")
            db.rollback()
        print(f"  {a:16} {kb:7} {right:6} {cmd:8} {out}")
    return broken


def check_telegram(db) -> list:
    """То же для Telegram.

    Там нет ни единого списка действий, ни общей точки исполнения: команды
    разведены руками по цепочке elif, а перечень для человека — обычная
    строка в ответе на /start. Значит и спрашивать надо у этой строки: что
    боту приписали, то он и обязан уметь.

    Ответы никуда не уходят: send_telegram_message на время проверки заменён
    сборщиком. Без этого прогон разослал бы сообщения живому человеку.
    """
    from app.routes import telegram as tg
    from app.services import notifications

    print()
    print("=" * 78)
    print("TELEGRAM")
    print("=" * 78)

    src = open(tg.__file__, encoding="utf-8").read()
    start = src.index('"🥋 <b>Добро пожаловать')
    welcome = src[start:src.index('"📢 Наш канал', start)]
    # Разметку убираем ДО поиска команд: иначе <b> читается как команда /b.
    # Первый прогон именно так и сделал — проверка сама придумала себе дефект.
    welcome = re.sub(r"<[^>]+>", "", welcome)
    advertised = set(re.findall(r"/([a-z_]+)", welcome))

    universe = advertised | {c.lstrip("/") for c in tg.STAFF_COMMANDS} \
        | {c.lstrip("/") for c in tg.PARENT_COMMANDS}
    print(f"  обещано в ответе на /start: {len(advertised)}")
    print(f"  всего команд к проверке:    {len(universe)}\n")

    actor = (db.query(TelegramSubscriber)
             .join(User, User.id == TelegramSubscriber.user_id)
             .filter(User.role == "admin", User.is_active == True).first())
    if actor is None:
        print("  ⚠️  нет ни одного админа с привязанным Telegram — не проверено")
        return sorted(f"tg:{a}" for a in universe)
    print(f"  исполняю от имени admin (chat_id {actor.telegram_id})\n")

    sent = []

    async def collector(chat_id, text, **kw):
        sent.append(text)
        return True

    real = notifications.send_telegram_message
    notifications.send_telegram_message = collector

    hdr = f"  {'команда':16} {'в /start':9} {'служебная':10} исход"
    print(hdr)
    print("  " + "-" * (len(hdr) - 2))

    broken = []
    try:
        for a in sorted(universe):
            adv = "да" if a in advertised else "—"
            staff = "да" if f"/{a}" in tg.STAFF_COMMANDS else "—"
            if a in MUTATING:
                print(f"  /{a:15} {adv:9} {staff:10} пропущено (меняет подписку)")
                continue
            sent.clear()
            update = {"message": {"chat": {"id": actor.telegram_id},
                                  "text": f"/{a}",
                                  "from": {"username": "check",
                                           "first_name": "check", "last_name": ""}}}
            try:
                asyncio.run(tg.process_telegram_update(update))
                if not sent:
                    out = "❌ МОЛЧАНИЕ — ветки нет либо отказ по праву"
                    broken.append(f"tg:{a}")
                else:
                    out = "✅ " + re.sub(r"<[^>]+>", "",
                                        sent[0]).strip().splitlines()[0][:38]
            except Exception as e:
                out = f"💥 {type(e).__name__}: {e}"
                broken.append(f"tg:{a}")
            print(f"  /{a:15} {adv:9} {staff:10} {out}")
    finally:
        notifications.send_telegram_message = real
    return broken


def main():
    db = SessionLocal()
    try:
        broken = check_max(db) + check_telegram(db)
    finally:
        db.rollback()
        db.close()

    print()
    print("=" * 78)
    if broken:
        print("НЕИСПОЛНЯЕМЫЕ ДЕЙСТВИЯ:", ", ".join(broken))
        return 1
    print("Неисполняемых действий нет.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
