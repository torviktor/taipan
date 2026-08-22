"""Персональные ссылки привязки: выпуск и погашение токенов.

Ручной ввод «/link 79XXXXXXXXX» — то место, где теряются люди: девять человек
дошли до бота и на этом остановились, а привязанных родителей ноль. Ссылка в
одно нажатие убирает этот шаг.

КАК ЭТО РАБОТАЕТ

  1. Тренер открывает /subs и видит у каждого непривязанного персональную
     ссылку. Пересылает её родителю.
  2. Родитель нажимает. Мессенджер открывает бота и передаёт параметр:
       MAX      — апдейт bot_started, поле payload;
       Telegram — обычное сообщение «/start lnk_ТОКЕН».
  3. Бот гасит токен и привязывает аккаунт.

ПОЧЕМУ НЕ НОМЕР В ССЫЛКЕ. Ссылку пересылают — это её назначение. Лежи в
параметре телефон или user_id, первый же получатель пересланной ссылки
привязал бы к себе ЧУЖОЙ аккаунт и стал получать уведомления про чужих детей,
взносы и аттестации. Поэтому токен неугадываемый, одноразовый и срочный.

ПРО АЛФАВИТ. MAX принимает в параметре только A-Za-z0-9_- и, встретив что-то
иное, отбрасывает параметр ЦЕЛИКОМ БЕЗ СООБЩЕНИЯ ОБ ОШИБКЕ — ссылка просто
«не сработает», и причину искать негде. secrets.token_urlsafe даёт ровно этот
алфавит, поэтому используется он, а не что-то самодельное.
"""

import logging
import secrets
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

PREFIX = "lnk_"          # чтобы отличать от будущих видов payload
TOKEN_BYTES = 16         # 128 бит; token_urlsafe даёт 22 символа
TTL_DAYS = 14            # тренер зовёт людей не за один день

# MAX режет payload длиннее 128 символов. Наши 26 далеко не дотягивают, но
# проверка стоит: генератор однажды поменяют, а молчаливо отвалившийся
# параметр не оставит следов.
MAX_PAYLOAD_LEN = 128

MAX_BOT_USERNAME = "id5034074017_bot"
TG_BOT_USERNAME  = "taipan_tkd_bot"


def _payload(token: str) -> str:
    return f"{PREFIX}{token}"


def is_link_payload(value: str) -> bool:
    return bool(value) and value.startswith(PREFIX)


def issue(db, user_id: int) -> str:
    """Вернуть действующий токен пользователя, выпустив новый при нужде.

    Переиспользование намеренное: /subs открывают многократно, и выпускать
    по 57 новых токенов на каждый просмотр — значит засорять таблицу и, что
    хуже, обесценивать уже разосланные ссылки, если бы старые гасились.

    СРОК СКОЛЬЗЯЩИЙ: при каждом показе отсчёт начинается заново. Иначе
    получается ловушка — токены выпускаются в момент первого открытия отчёта,
    а рассылают ссылки неделями позже, и родителю приходит уже мёртвая. Теперь
    момент отсчёта совпадает с моментом, когда тренер смотрит на ссылку, то
    есть ровно перед тем, как её переслать.

    Продление не сбрасывает одноразовость: погашенный токен сюда не попадает,
    его отсекает фильтр used_at.
    """
    from app.models.event import LinkToken

    now = datetime.utcnow()
    alive = (
        db.query(LinkToken)
        .filter(
            LinkToken.user_id == user_id,
            LinkToken.used_at == None,
            LinkToken.expires_at > now,
        )
        .order_by(LinkToken.expires_at.desc())
        .first()
    )
    if alive:
        fresh = now + timedelta(days=TTL_DAYS)
        # Только продлеваем. Сокращать срок уже разосланной ссылки нельзя:
        # человек мог получить её вчера и открыть завтра.
        if alive.expires_at < fresh:
            alive.expires_at = fresh
            db.commit()
        return alive.token

    token = secrets.token_urlsafe(TOKEN_BYTES)
    row = LinkToken(
        user_id    = user_id,
        token      = token,
        created_at = now,
        expires_at = now + timedelta(days=TTL_DAYS),
    )
    db.add(row)
    db.commit()
    return token


def links_for(db, user_id: int) -> dict:
    """Готовые ссылки на оба бота для одного пользователя."""
    token = issue(db, user_id)
    payload = _payload(token)
    if len(payload) > MAX_PAYLOAD_LEN:
        # Практически недостижимо, но молчаливый отказ хуже громкого.
        logger.error("Токен привязки длиннее предела MAX: %s символов", len(payload))
    return {
        "max":      f"https://max.ru/{MAX_BOT_USERNAME}?start={payload}",
        "telegram": f"https://t.me/{TG_BOT_USERNAME}?start={payload}",
        "payload":  payload,
    }


def redeem(db, payload: str, platform: str, external_id: str):
    """Погасить токен и привязать аккаунт.

    Возвращает (пользователь, причина_отказа). Ровно одно из двух не None.

    Гашение и привязка идут в одной транзакции: иначе два одновременных перехода
    по одной ссылке могли бы привязать её дважды.
    """
    from app.models.event import LinkToken, MessengerSubscriber

    if not is_link_payload(payload):
        return None, "not_a_link"

    token = payload[len(PREFIX):]
    now = datetime.utcnow()

    # SELECT ... FOR UPDATE: два перехода по одной ссылке в один момент —
    # редкость, но цена ошибки здесь чужой аккаунт.
    row = (
        db.query(LinkToken)
        .filter(LinkToken.token == token)
        .with_for_update()
        .first()
    )

    if row is None:
        return None, "unknown"
    if row.used_at is not None:
        return None, "used"
    if row.expires_at <= now:
        return None, "expired"

    from app.models.user import User
    user = db.query(User).filter(User.id == row.user_id).first()
    if user is None or not user.is_active:
        return None, "no_user"

    # Подписчик этой площадки. Фильтр по platform обязателен: идентификаторы
    # площадок могут совпасть численно, и без фильтра привязка ушла бы чужому.
    sub = (
        db.query(MessengerSubscriber)
        .filter(
            MessengerSubscriber.platform == platform,
            MessengerSubscriber.external_id == str(external_id),
        )
        .first()
    )
    if sub is None:
        sub = MessengerSubscriber(
            platform=platform, external_id=str(external_id), subscribed=True
        )
        db.add(sub)

    sub.user_id = user.id
    sub.subscribed = True

    row.used_at = now
    row.used_platform = platform
    row.used_external_id = str(external_id)

    db.commit()
    logger.info("Привязка по ссылке: аккаунт %s <- %s:%s", user.id, platform, external_id)
    return user, None


def redeem_and_reply(db, payload: str, platform: str, external_id: str) -> str:
    """Погасить ссылку и вернуть готовый ответ родителю.

    Живёт здесь, а не в роутах: текст и последствия привязки обязаны совпадать
    в обоих ботах до буквы, а две копии одного ответа расходятся всегда.
    """
    from app.core.markup import esc
    from app.models.user import Athlete
    from app.services.reach import notify_staff_new_link

    user, refusal = redeem(db, payload, platform, external_id)
    if refusal:
        logger.info("Привязка по ссылке отклонена (%s): %s:%s",
                    refusal, platform, external_id)
        return REFUSAL_TEXT.get(refusal, REFUSAL_TEXT["unknown"])

    athletes = (
        db.query(Athlete)
        .filter(Athlete.user_id == user.id, Athlete.is_archived == False)
        .all()
    )

    # Тренерам — как и при ручной привязке. Ошибки глушатся внутри.
    notify_staff_new_link(db, user, platform, [a.full_name for a in athletes])

    head = (f"✅ <b>Аккаунт привязан!</b>\n\n👤 {esc(user.full_name)}\n\n")
    if athletes:
        lst = "\n".join(f"• {esc(a.full_name)}" for a in athletes)
        return (head + f"🥋 Ваши спортсмены:\n{lst}\n\n"
                "Теперь вы будете получать уведомления о соревнованиях, "
                "сборах, аттестациях и взносах.")
    return head + "Теперь вы будете получать персональные уведомления."


REFUSAL_TEXT = {
    "used":    ("🔗 Эта ссылка уже использована.\n\n"
                "Так и задумано: ссылка одноразовая, чтобы пересланная кому-то "
                "ещё не привязала ваш аккаунт чужому человеку.\n\n"
                "Попросите тренера прислать новую — или привяжите вручную: "
                "отправьте <code>/link НОМЕР</code>, тот номер телефона, "
                "которым вы зарегистрированы на сайте."),
    "expired": ("⌛ Срок действия ссылки истёк.\n\n"
                "Попросите тренера прислать новую — или привяжите вручную: "
                "отправьте <code>/link НОМЕР</code>."),
    "unknown": ("🔗 Ссылка не распознана.\n\n"
                "Возможно, она скопирована не целиком. Попросите тренера "
                "прислать её заново — или привяжите вручную: "
                "отправьте <code>/link НОМЕР</code>."),
    "no_user": ("🔗 Учётная запись, к которой ведёт ссылка, не активна.\n\n"
                "Обратитесь к тренеру."),
}
