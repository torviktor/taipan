"""Охват уведомлений: кто из родителей достижим через мессенджеры, а кто нет.

Задача простая по смыслу и коварная по деталям. На 22.08.2026 из 57 активных
родителей аккаунт привязан у одного, то есть уведомления о взносах, сборах и
аттестациях доходят почти до никого. Тренеру нужно видеть, кого догонять.

ГЛАВНОЕ ПРАВИЛО ЭТОГО МОДУЛЯ: каждый запрос к messenger_subscribers несёт
фильтр по platform. Идентификаторы площадок — просто числа, и telegram chat_id
может совпасть с MAX user_id. База защищает только уникальность пары
(platform, external_id); от запроса без фильтра она не спасает, а цена ошибки —
уведомление, ушедшее чужому человеку.

Кого считаем «родителем»: активного пользователя с ролью parent. Неактивные
(is_active = false) исключены — это дубли и ушедшие, в списке «догнать» они
только шумят. Роль athlete (взрослый спортсмен без родителя) в базу охвата не
входит: таких сейчас один, и логика «чьи дети» к нему неприменима.
"""

import logging
from typing import List

logger = logging.getLogger(__name__)

PLATFORMS = ("telegram", "max")

PLATFORM_NAMES = {
    "telegram": "Telegram",
    "max":      "MAX",
}

STAFF_ROLES = ("manager", "admin")


def _role_value(user) -> str:
    """Роль строкой: в модели это Enum, а сравнивать удобнее с текстом."""
    role = getattr(user, "role", None)
    return getattr(role, "value", role) or ""


def is_staff(db, user_id) -> bool:
    """Тренер или администратор?

    Используется как замок на служебных командах бота. Отсутствие привязки —
    это не «нет прав», а «неизвестно кто», и ответ должен быть один и тот же:
    команды не существует.
    """
    if not user_id:
        return False
    from app.models.user import User
    user = db.query(User).filter(User.id == user_id).first()
    return bool(user and user.is_active and _role_value(user) in STAFF_ROLES)


def _parents_query(db):
    from app.models.user import User
    return db.query(User).filter(
        User.role == "parent",
        User.is_active == True,
    )


def _links_by_user(db) -> dict:
    """Привязки вида {user_id: [(площадка, дата), …]}.

    Один запрос вместо запроса на каждого родителя: строк немного, но
    обращение к БД в цикле по 57 людям — привычка, которая потом дорого
    обходится на списках побольше.
    """
    from app.models.event import MessengerSubscriber

    rows = (
        db.query(MessengerSubscriber)
        .filter(
            MessengerSubscriber.platform.in_(PLATFORMS),   # фильтр обязателен
            MessengerSubscriber.subscribed == True,
            MessengerSubscriber.user_id != None,
        )
        .all()
    )
    out = {}
    for r in rows:
        out.setdefault(r.user_id, []).append((r.platform, r.created_at))
    return out


def _active_athletes_by_user(db) -> dict:
    from app.models.user import Athlete
    rows = (
        db.query(Athlete)
        .filter(Athlete.is_archived == False)
        .order_by(Athlete.full_name)
        .all()
    )
    out = {}
    for a in rows:
        out.setdefault(a.user_id, []).append(a.full_name)
    return out


def format_summary(db) -> str:
    """Короткая сводка охвата — то, что показывается по /subs.

    Раньше сюда же валился список всех непривязанных с двумя персональными
    ссылками на каждого: 12 тысяч символов, четыре сообщения. Тренер открывает
    /subs, чтобы узнать «сколько нас», а не чтобы листать портянку, поэтому
    списки уехали в отдельные действия, а здесь осталось ровно одно сообщение.
    """
    from app.services.delivery import stats_24h

    r = build_report(db)
    per = r["per_platform"]

    out = [
        "📊 <b>Охват уведомлений</b>",
        "",
        f"Привязано: <b>{r['linked_count']}</b> из {r['total']} ({r['percent']}%)",
        f"Telegram: {per.get('telegram', 0)}   ·   MAX: {per.get('max', 0)}",
        f"Не привязаны: <b>{r['unlinked_count']}</b>",
    ]

    # Самая лёгкая добыча: человек уже нашёл бота и нажал «Начать», осталось
    # одно нажатие кнопки. Поэтому строка идёт сразу под охватом.
    d = r["dangling"]
    if sum(d.values()):
        out += ["",
                f"💬 Написали боту, но не привязались: <b>{sum(d.values())}</b>",
                f"   Telegram: {d.get('telegram', 0)}   ·   MAX: {d.get('max', 0)}"]

    # Доставка за сутки. Пустой блок «0 · 0 · 0» был бы шумом, поэтому при
    # отсутствии доставок пишем это словами — одной строкой.
    delivered = stats_24h(db)
    rows = []
    for platform in PLATFORMS:
        st = delivered.get(platform)
        if not st:
            continue
        rows.append(f"   {PLATFORM_NAMES.get(platform, platform)}: "
                    + ", ".join(f"{v} {k}" for k, v in sorted(st.items())))
    if rows:
        out += ["", "📨 <b>Доставка за сутки</b>"] + rows
    else:
        out += ["", "📨 Доставок за сутки не было"]

    out += ["",
            "———",
            "/unlinked — кто ещё не привязан",
            "/invite ФАМИЛИЯ — персональная ссылка для одного человека"]
    return "\n".join(out)


def format_unlinked(db) -> str:
    """Список непривязанных: имя, телефон, дети. БЕЗ персональных ссылок.

    Ссылки убраны намеренно. Основной путь привязки теперь — кнопка
    «Поделиться контактом» по общей ссылке, и персональная нужна только тому,
    у кого номер в мессенджере не совпадает с номером на сайте. Выдавать её
    всем скопом — значит утроить длину списка ради редкого случая.
    Точечно её отдаёт /invite.
    """
    from app.core.markup import esc

    r = build_report(db)
    if not r["unlinked"]:
        return "✅ Непривязанных нет."

    lines = []
    for p in r["unlinked"]:
        line = f"• {esc(p['full_name'])} — {esc(p['phone'])}"
        if p["children"]:
            line += "\n   " + esc(", ".join(p["children"]))
        else:
            line += "\n   (нет активных спортсменов)"
        lines.append(line)

    return (f"❗ <b>Не привязаны — {r['unlinked_count']}</b>\n"
            "Сначала те, у кого дети в текущем составе.\n\n"
            + "\n".join(lines)
            + "\n\n———\n/invite ФАМИЛИЯ — персональная ссылка для одного человека")


def format_invite(db, query: str) -> str:
    """Персональная ссылка для одного человека.

    Поиск по части фамилии или по номеру. Выбор именно так, а не по номеру
    строки в списке: тренер помнит фамилии, а не порядковые номера, и список
    между двумя вызовами перестраивается — привязался один человек, и все
    номера уехали на единицу.
    """
    from app.core.markup import esc
    from app.services import link_tokens
    from app.services.binding import normalize_phone

    query = (query or "").strip()
    if not query:
        return ("Укажите фамилию или номер: <code>/invite Абрамова</code>\n\n"
                "Ссылка нужна только тому, у кого номер в мессенджере не "
                "совпадает с номером на сайте. Остальным достаточно общей "
                "ссылки и кнопки «Поделиться контактом».")

    r = build_report(db)
    digits = normalize_phone(query)
    needle = query.casefold()

    if len(digits) >= 10:
        found = [p for p in r["unlinked"] if normalize_phone(p["phone"]) == digits]
    else:
        found = [p for p in r["unlinked"]
                 if needle in (p["full_name"] or "").casefold()]

    if not found:
        # «Уже привязан» полезнее, чем «не найдено»: тренер обычно ищет
        # человека, а не строку, и ответ должен закрывать вопрос.
        already = [p for p in r["linked"]
                   if needle in (p["full_name"] or "").casefold()]
        if already:
            names = ", ".join(esc(p["full_name"]) for p in already[:5])
            return f"👌 {names} — уже привязаны, ссылка не нужна."
        return (f"Никого не нашёл по запросу «{esc(query)}».\n\n"
                "Попробуйте часть фамилии или номер телефона. "
                "Полный список — /unlinked")

    if len(found) > 1:
        names = "\n".join(f"• {esc(p['full_name'])} — {esc(p['phone'])}"
                          for p in found[:10])
        more = f"\n… и ещё {len(found) - 10}" if len(found) > 10 else ""
        return (f"Нашлось несколько ({len(found)}). Уточните запрос:\n\n"
                + names + more)

    p = found[0]
    lk = link_tokens.links_for(db, p["user_id"])
    kids = esc(", ".join(p["children"])) if p["children"] else "нет активных спортсменов"
    return (f"🔗 <b>{esc(p['full_name'])}</b>\n"
            f"{esc(p['phone'])} · {kids}\n\n"
            f"MAX:\n{lk['max']}\n\n"
            f"Telegram:\n{lk['telegram']}\n\n"
            "Ссылка одноразовая, действует 14 дней. Перешлите её лично — "
            "по ней привяжется тот, кто первым откроет.")


def build_report(db) -> dict:
    """Собрать всё разом: сводку, непривязанных и привязанных.

    Возвращает готовые к показу структуры, без объектов ORM: вызывающему коду
    (боту) нужны только строки, а тащить наружу сессию — способ однажды
    получить DetachedInstanceError в неожиданном месте.
    """
    parents = _parents_query(db).all()
    links   = _links_by_user(db)
    kids    = _active_athletes_by_user(db)

    unlinked, linked = [], []
    per_platform = {p: 0 for p in PLATFORMS}

    for u in parents:
        mine = links.get(u.id) or []
        children = kids.get(u.id) or []
        if mine:
            for platform, _ in mine:
                if platform in per_platform:
                    per_platform[platform] += 1
            linked.append({
                "user_id":   u.id,
                "full_name": u.full_name,
                "platforms": sorted({PLATFORM_NAMES.get(p, p) for p, _ in mine}),
                "linked_at": max((d for _, d in mine if d), default=None),
                "children":  children,
            })
        else:
            unlinked.append({
                "user_id":    u.id,
                "full_name":  u.full_name,
                "phone":      u.phone,
                "created_at": u.created_at,
                "children":   children,
            })

    # Сначала те, у кого дети в текущем составе: именно их отсутствие в
    # рассылке стоит дорого — они не узнают про взносы и сборы.
    unlinked.sort(key=lambda r: (not r["children"], r["full_name"] or ""))
    linked.sort(key=lambda r: r["full_name"] or "")

    total = len(parents)
    return {
        "total":        total,
        "linked_count": len(linked),
        "unlinked_count": len(unlinked),
        "percent":      round(len(linked) * 100 / total) if total else 0,
        "per_platform": per_platform,
        "dangling":     dangling_subscribers(db),
        "unlinked":     unlinked,
        "linked":       linked,
    }


def dangling_subscribers(db) -> dict:
    """Кто написал боту, но так и не привязал аккаунт.

    Отдельная и самая полезная категория: человек уже нашёл бота и нажал
    «Начать», ему остаётся отправить одну команду. Догонять его несравнимо
    легче, чем того, кто про бота не слышал. На 22.08.2026 таких девять —
    больше, чем привязанных.

    Имён здесь нет намеренно: пока привязки нет, мы не знаем, кто это, а
    показывать тренеру ник из мессенджера — значит выдавать за факт догадку.
    """
    from app.models.event import MessengerSubscriber

    out = {}
    for platform in PLATFORMS:
        out[platform] = (
            db.query(MessengerSubscriber)
            .filter(
                MessengerSubscriber.platform == platform,   # фильтр обязателен
                MessengerSubscriber.subscribed == True,
                MessengerSubscriber.user_id == None,
            )
            .count()
        )
    return out


def staff_recipients(db) -> List[dict]:
    """Тренеры и админы с их привязками — кому слать служебные сообщения.

    Возвращает [{user_id, full_name, platform, external_id}, …] по одной
    записи на площадку: у одного человека может быть и Telegram, и MAX, и
    сообщение должно прийти в оба, чтобы не зависеть от того, каким он
    пользуется сегодня.
    """
    from app.models.user import User
    from app.models.event import MessengerSubscriber

    staff = db.query(User).filter(
        User.role.in_(STAFF_ROLES),
        User.is_active == True,
    ).all()
    if not staff:
        return []

    ids = [u.id for u in staff]
    names = {u.id: u.full_name for u in staff}

    rows = (
        db.query(MessengerSubscriber)
        .filter(
            MessengerSubscriber.platform.in_(PLATFORMS),   # фильтр обязателен
            MessengerSubscriber.user_id.in_(ids),
            MessengerSubscriber.subscribed == True,
        )
        .all()
    )
    return [
        {"user_id": r.user_id, "full_name": names.get(r.user_id, ""),
         "platform": r.platform, "external_id": r.external_id}
        for r in rows
    ]


def notify_staff_new_link(db, user, platform: str, children: List[str]) -> None:
    """Сообщить тренерам, что родитель привязал аккаунт.

    Шлётся ТОЛЬКО на успешную привязку, а не на каждый /start: /start пишет
    любой, кто открыл бота, и такие сообщения быстро научили бы тренера их
    игнорировать.

    Ошибка доставки здесь не должна ломать привязку: родитель своё сообщение
    уже получил, и падение на служебном уведомлении откатило бы транзакцию.
    """
    from app.core.markup import esc

    kids = "\n".join(f"• {esc(c)}" for c in children) if children else "• (нет активных)"
    text = (
        "🔗 <b>Новая привязка к боту</b>\n\n"
        f"👤 {esc(user.full_name)}\n"
        f"💬 {esc(PLATFORM_NAMES.get(platform, platform))}\n"
        f"📞 {esc(user.phone)}\n\n"
        f"🥋 Спортсмены:\n{kids}"
    )

    sent, failed = 0, 0
    for who in staff_recipients(db):
        # Себе же уведомление о собственной привязке не шлём.
        if who["user_id"] == user.id:
            continue
        try:
            if who["platform"] == "max":
                from app.services.max_bot import send_message_result
                status, err = send_message_result(who["external_id"], text)
            else:
                from app.services.notifications import send_telegram_sync
                status, err = send_telegram_sync(who["external_id"], text)
            if status == "sent":
                sent += 1
            else:
                failed += 1
                logger.warning("Охват: тренеру %s в %s не доставлено — %s",
                               who["full_name"], who["platform"], err)
        except Exception:
            failed += 1
            logger.exception("Охват: уведомление тренеру %s упало", who["full_name"])

    # Успех тоже пишем: без этой строки «уведомление не пришло» и «уведомление
    # ушло, но тренер его не заметил» выглядят в логе одинаково — тишиной.
    logger.info("Охват: о привязке %s (%s) уведомлено тренеров: %s, не удалось: %s",
                user.full_name, platform, sent, failed)
