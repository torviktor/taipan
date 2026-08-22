"""Привязка аккаунта сайта по номеру телефона из мессенджера.

Основной путь привязки: человек открывает бота по ОБЩЕЙ ссылке, жмёт кнопку
«Поделиться контактом», мессенджер сам отдаёт боту номер. Ручной ввод и
персональные ссылки остаются запасными путями.

Почему так. Персональные ссылки требовали от тренера разослать 57 сообщений
поимённо — этого не случится. Ручной ввод номера теряет людей на наборе цифр:
девять человек дошли до бота и остановились. Кнопка не требует ни того, ни
другого: одна общая ссылка в чат клуба и одно нажатие.

БЕЗОПАСНОСТЬ — ГЛАВНОЕ ЗДЕСЬ

Контакт в мессенджере можно ПЕРЕСЛАТЬ. Если принимать номер из вложения не
глядя, любой сможет переслать боту карточку соседа и привязать к себе чужой
аккаунт: чужие дети, чужие взносы, чужие уведомления. Поэтому номер
принимается, только если доказано, что контакт принадлежит ОТПРАВИТЕЛЮ:

  Telegram — contact.user_id должен совпасть с id отправителя. У пересланной
             чужой карточки user_id либо чужой, либо отсутствует вовсе.

  MAX      — max_info.user_id из вложения должен совпасть с sender.user_id.
             Дополнительно платформа подписывает данные:
             hash = HMAC-SHA256(токен_бота, vcf_info). Подпись проверяется и
             логируется, но совпадение отправителя остаётся обязательным в
             любом случае — именно оно ловит пересылку.

Обе проверки живут в роутах (там доступен апдейт целиком), сюда номер попадает
уже подтверждённым.
"""

import logging
import re

logger = logging.getLogger(__name__)

# Причины отказа. Тексты — ниже, в BIND_TEXT.
OK              = "ok"
NOT_FOUND       = "not_found"
TAKEN           = "taken"          # аккаунт сайта уже держит другой подписчик
ALREADY_MINE    = "already_mine"   # этот же мессенджер уже привязан к этому человеку
REBOUND         = "rebound"        # был привязан к другому — переставили и сказали об этом


def normalize_phone(raw: str) -> str:
    """Привести номер к виду 7XXXXXXXXXX.

    Мессенджеры отдают номер по-разному: «+7 999 000-00-00», «79990000000»,
    «89990000000». На сайте он хранится как есть, тоже разнобоем, поэтому
    сравнение идёт по нормализованной форме с обеих сторон.
    """
    digits = re.sub(r"\D", "", str(raw or ""))
    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    if len(digits) == 10 and digits.startswith("9"):
        digits = "7" + digits
    return digits


def find_user_by_phone(db, phone: str):
    """Найти активного пользователя сайта по номеру.

    Сравниваем нормализованные формы: в базе номера лежат неоднородно —
    где-то с восьмёркой, где-то без плюса, — и точное сравнение строк
    промахивалось бы на части людей.
    """
    from app.models.user import User

    target = normalize_phone(phone)
    if len(target) != 11:
        return None

    for u in db.query(User).filter(User.phone != None, User.is_active == True).all():
        if normalize_phone(u.phone) == target:
            return u
    return None


def bind_by_phone(db, platform: str, external_id: str, phone: str):
    """Привязать подписчика к аккаунту сайта по подтверждённому номеру.

    Возвращает (пользователь, причина). Причина — одна из констант выше.
    Номер обязан быть уже подтверждён вызывающим как принадлежащий отправителю.
    """
    from app.models.event import MessengerSubscriber

    user = find_user_by_phone(db, phone)
    if user is None:
        return None, NOT_FOUND

    # Фильтр по platform обязателен: идентификаторы площадок могут совпасть
    # численно, и без него привязка ушла бы не тому человеку.
    mine = (
        db.query(MessengerSubscriber)
        .filter(
            MessengerSubscriber.platform == platform,
            MessengerSubscriber.external_id == str(external_id),
        )
        .first()
    )

    # Не занят ли этот аккаунт сайта ДРУГИМ аккаунтом того же мессенджера.
    # Молча перепривязывать нельзя: у семьи бывает один телефон на двоих, и
    # тихая перестановка увела бы уведомления у того, кто их уже получал.
    other = (
        db.query(MessengerSubscriber)
        .filter(
            MessengerSubscriber.platform == platform,
            MessengerSubscriber.user_id == user.id,
            MessengerSubscriber.external_id != str(external_id),
        )
        .first()
    )
    if other is not None:
        logger.info("Привязка отклонена: %s аккаунта %s уже занят подписчиком %s",
                    platform, user.id, other.external_id)
        return user, TAKEN

    if mine is not None and mine.user_id == user.id:
        logger.info("Привязка: %s:%s уже привязан к аккаунту %s, ничего не меняем",
                    platform, external_id, user.id)
        return user, ALREADY_MINE

    # Этот аккаунт мессенджера уже привязан к КОМУ-ТО ДРУГОМУ. Такое случается
    # при ошибочном переходе по чужой персональной ссылке, и человек чинит это
    # сам, прислав свой номер. Перепривязку разрешаем — номер подтверждён, —
    # но НЕ молча: 22.08.2026 именно молчаливая перестановка сделала неясным,
    # осталась ли где-то чужая связь.
    was_user_id = mine.user_id if mine is not None else None

    if mine is None:
        mine = MessengerSubscriber(
            platform=platform, external_id=str(external_id), subscribed=True
        )
        db.add(mine)

    mine.user_id = user.id
    mine.subscribed = True
    db.commit()

    if was_user_id and was_user_id != user.id:
        logger.warning("Привязка ПЕРЕСТАВЛЕНА: %s:%s был привязан к аккаунту %s, "
                       "теперь к %s", platform, external_id, was_user_id, user.id)
        return user, REBOUND

    logger.info("Привязка: аккаунт %s <- %s:%s", user.id, platform, external_id)

    # Тренерам — здесь, а не в роутах: путей привязки стало три (кнопка
    # контакта, /link, персональная ссылка), и уведомление, разложенное по
    # роутам, рано или поздно забыли бы добавить в четвёртый.
    try:
        from app.models.user import Athlete
        from app.services.reach import notify_staff_new_link
        athletes = (
            db.query(Athlete)
            .filter(Athlete.user_id == user.id, Athlete.is_archived == False)
            .all()
        )
        notify_staff_new_link(db, user, platform, [a.full_name for a in athletes])
    except Exception:
        # Служебное сообщение не должно ломать саму привязку: родителю она
        # уже подтверждена.
        logger.exception("Привязка: уведомление тренерам упало")

    return user, OK


def success_text(db, user) -> str:
    """Приветствие с перечислением спортсменов."""
    from app.core.markup import esc
    from app.models.user import Athlete

    athletes = (
        db.query(Athlete)
        .filter(Athlete.user_id == user.id, Athlete.is_archived == False)
        .all()
    )
    head = f"✅ <b>Аккаунт привязан!</b>\n\n👤 {esc(user.full_name)}\n\n"
    if athletes:
        lst = "\n".join(f"• {esc(a.full_name)}" for a in athletes)
        return (head + f"🥋 Ваши спортсмены:\n{lst}\n\n"
                "Теперь вы будете получать уведомления о соревнованиях, "
                "сборах, аттестациях и взносах.")
    return head + "Теперь вы будете получать персональные уведомления."


ASK_CONTACT = (
    "🥋 <b>Клуб Тайпан</b>\n"
    "г. Павловский Посад\n\n"
    "Чтобы присылать вам уведомления про <b>ваших</b> детей — тренировки, "
    "соревнования, сборы, аттестации и взносы, — боту нужно понять, кто вы.\n\n"
    "Для этого нажмите кнопку ниже: мессенджер сам передаст ваш номер "
    "телефона, вводить ничего не придётся.\n\n"
    "Номер нужен только чтобы найти вашу учётную запись на сайте клуба. "
    "Никому не передаётся.\n\n"
    "Если номер в мессенджере <i>не тот</i>, которым вы регистрировались на "
    "сайте — отправьте его вручную: <code>/link 79998887766</code>"
)

BIND_TEXT = {
    NOT_FOUND: (
        "❌ <b>Не нашёл вас в базе клуба</b>\n\n"
        "Номер {phone} не совпал ни с одной учётной записью на сайте.\n\n"
        "Обычно это значит одно из двух:\n"
        "• на сайте вы записаны под другим номером — тогда отправьте тот "
        "номер вручную: <code>/link 79998887766</code>;\n"
        "• учётной записи ещё нет — тогда скажите тренеру, вас заведут.\n\n"
        "Ничего страшного не произошло, просто напишите тренеру."
    ),
    TAKEN: (
        "⚠️ <b>Этот аккаунт уже привязан</b>\n\n"
        "Учётная запись «{name}» уже получает уведомления в этом мессенджере, "
        "но с другого аккаунта.\n\n"
        "Так бывает, когда в семье один номер на двоих. Молча переключать "
        "уведомления я не стану — тот, кто их получает сейчас, перестал бы их "
        "видеть и не узнал бы почему.\n\n"
        "Скажите тренеру, если переключить всё-таки нужно."
    ),
    ALREADY_MINE: (
        "👌 <b>Вы уже привязаны</b>\n\n"
        "Учётная запись «{name}» и так получает уведомления сюда. "
        "Делать ничего не нужно."
    ),
}

UNLINKED = (
    "🔓 <b>Привязка снята</b>\n\n"
    "Персональные уведомления сюда больше не приходят.\n\n"
    "Это не то же самое, что /stop: тот лишь приостанавливает рассылку, "
    "оставляя связь с учётной записью. Здесь связь разорвана — чтобы "
    "получать уведомления снова, придётся привязаться заново.\n\n"
    "Нажмите /start, когда понадобится."
)

NOT_LINKED = (
    "🔓 Здесь нечего отвязывать: этот мессенджер не связан ни с одной "
    "учётной записью клуба.\n\n"
    "Нажмите /start, если хотите привязаться."
)


def unlink(db, platform: str, external_id: str) -> str:
    """Разорвать связь мессенджера с аккаунтом сайта. Возвращает текст ответа.

    ЗАЧЕМ ОТДЕЛЬНО ОТ /stop. /stop снимает подписку — ставит subscribed=false,
    но user_id остаётся, и одного /start достаточно, чтобы уведомления пошли
    снова. Для «я случайно привязался не к тому» это не годится: человек
    считает, что отвязался, а связь с чужим аккаунтом жива.
    """
    from app.models.event import MessengerSubscriber

    sub = (
        db.query(MessengerSubscriber)
        .filter(
            MessengerSubscriber.platform == platform,   # фильтр обязателен
            MessengerSubscriber.external_id == str(external_id),
        )
        .first()
    )
    if sub is None or not sub.user_id:
        return NOT_LINKED

    was = sub.user_id
    sub.user_id = None
    sub.subscribed = False
    db.commit()
    logger.info("Отвязка: %s:%s отвязан от аккаунта %s", platform, external_id, was)
    return UNLINKED
