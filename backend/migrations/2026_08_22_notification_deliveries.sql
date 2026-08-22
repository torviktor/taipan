-- Миграция: доставка уведомлений становится мультиканальной.
--
-- ЗАЧЕМ. Сейчас результат доставки живёт в двух колонках notifications:
-- tg_status и tg_error. Это работало, пока канал был один. С появлением бота
-- в MAX одно уведомление уходит в оба мессенджера, и «доставлено» перестаёт
-- быть одним значением: в Telegram могло уйти, в MAX упасть. Двумя колонками
-- это не выражается, а третий канал потребовал бы ещё двух.
--
-- Поэтому статус переезжает в отдельную таблицу: строка на пару
-- (уведомление, площадка).
--
-- ПРО no_account. Раньше он значил «у пользователя нет привязанного
-- Telegram». Теперь обязан значить «нет НИ ОДНОГО канала»: у родителя может
-- не быть Telegram, но быть MAX, и помечать такое уведомление как
-- недоставляемое — прямая ошибка. Поэтому строки доставки создаются только
-- под те площадки, где у человека есть привязка, а при полном их отсутствии
-- строк не создаётся вовсе и признак ставится на самом уведомлении.
--
-- СТАРЫЕ КОЛОНКИ НЕ ТРОГАЕМ. tg_status остаётся и продолжает заполняться —
-- как СВОДНЫЙ признак по всем каналам. На него смотрят кабинет и ежедневная
-- сводка монитора (запрос «сколько failed за сутки»), и ломать их ради
-- чистоты схемы нельзя. Историю 1040 строк тоже не переписываем: она
-- относится ко времени, когда канал был один, и в мультиканальные термины
-- честно не переводится.
--
-- Правило сведения (его реализует app/services/delivery.py):
--   хоть одна доставка sent      -> 'sent'
--   ни одной, но есть failed     -> 'failed'
--   каналов не было вовсе        -> 'no_account'
--   ещё есть pending             -> 'pending'
--
-- НЕ ПРИМЕНЕНА. Прогонять вручную, см. команды в конце.

BEGIN;

CREATE TABLE IF NOT EXISTS notification_deliveries (
    id              SERIAL PRIMARY KEY,
    notification_id INTEGER     NOT NULL
                    REFERENCES notifications(id) ON DELETE CASCADE,

    -- 'telegram' | 'max'. Та же щепетильность, что и в messenger_subscribers:
    -- опечатка превращает строку в невидимку — рассылка её не найдёт, и это
    -- не всплывёт ни в одной ошибке.
    platform        VARCHAR(20) NOT NULL,

    -- 'pending' | 'sent' | 'failed'. Значения намеренно совпадают с
    -- notifications.tg_status, чтобы не переводить одно в другое.
    -- 'no_account' здесь невозможен: строка создаётся только когда канал есть.
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    error           TEXT,

    -- Сколько раз пробовали. Нужно, чтобы отличить «не дошло с первого раза,
    -- но дошло» от «бьёмся в стену», не разбирая логи.
    attempts        INTEGER     NOT NULL DEFAULT 0,

    created_at      TIMESTAMP   NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP   NOT NULL DEFAULT now(),
    sent_at         TIMESTAMP,

    CONSTRAINT ck_notification_deliveries_platform
        CHECK (platform IN ('telegram', 'max')),
    CONSTRAINT ck_notification_deliveries_status
        CHECK (status IN ('pending', 'sent', 'failed')),

    -- Одно уведомление в одну площадку уходит ровно один раз. Без этого
    -- повторный запуск раскладки продублировал бы сообщения родителям.
    CONSTRAINT uq_notification_deliveries
        UNIQUE (notification_id, platform)
);

-- Главный запрос фоновой задачи: «что осталось разослать». Частичный индекс
-- держится маленьким независимо от того, сколько накопится доставленных.
CREATE INDEX IF NOT EXISTS ix_notification_deliveries_pending
    ON notification_deliveries (id)
    WHERE status = 'pending';

-- Для статистики за сутки в /subs и в сводке монитора.
CREATE INDEX IF NOT EXISTS ix_notification_deliveries_recent
    ON notification_deliveries (created_at, status);

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ
-- ─────────────────────────────────────────────────────────────────────────────
-- \d notification_deliveries
-- SELECT count(*) FROM notification_deliveries;              -- ожидается 0
-- SELECT platform, status, count(*) FROM notification_deliveries
--   GROUP BY 1, 2 ORDER BY 1, 2;
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ОТКАТ
-- ─────────────────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS notification_deliveries;
-- Колонки notifications.tg_status и tg_error не затрагивались, откатывать их
-- не требуется — рассылка вернётся к прежнему поведению сама.
