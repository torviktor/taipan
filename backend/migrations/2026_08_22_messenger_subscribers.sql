-- Миграция: подписчики мессенджеров становятся мультиканальными.
-- telegram_subscribers -> messenger_subscribers (+ platform, external_id).
--
-- ЗАЧЕМ. К Telegram добавляется второй транспорт — бот в MAX
-- (id5034074017_bot, платформа platform-api2.max.ru). Привязка «человек в
-- мессенджере <-> аккаунт на сайте» по смыслу одна и та же, различается только
-- площадка, поэтому хранить её в двух таблицах — значит писать union в каждом
-- месте, где идёт рассылка, и добавлять третий union при третьем канале.
--
-- ПОЧЕМУ НЕ ОТДЕЛЬНАЯ ТАБЛИЦА max_subscribers. Она заманчива тем, что не
-- трогает живые данные вовсе. Но конвейер рассылки (deliver_*) обязан ответить
-- на вопрос «куда доставить уведомление пользователю N по всем каналам» —
-- с двумя таблицами это UNION ALL с ручным ярлыком площадки в каждом запросе,
-- то есть та же колонка platform, только вычисляемая в коде и не проверяемая
-- базой. Один общий справочник + честная колонка дают то же самое, но с
-- ограничением целостности на стороне БД.
--
-- ГЛАВНАЯ ОПАСНОСТЬ ВЫБРАННОГО ВАРИАНТА, назову прямо: идентификаторы разных
-- площадок — это просто числа, и они могут совпасть. Telegram chat_id 387846422
-- и MAX user_id 387846422 внешне неотличимы. Поэтому:
--   * UNIQUE ставится на пару (platform, external_id), а не на external_id;
--   * КАЖДЫЙ запрос по external_id в коде обязан нести фильтр по platform.
-- Второе база не гарантирует — это предмет ревью при выкате кода.
--
-- ВАЖНО ПРО СЕМАНТИКУ external_id. Для Telegram это chat_id. Для MAX в личной
-- переписке это sender.user_id из апдейта, а НЕ recipient.chat_id: личка в MAX
-- адресуется по пользователю, а GET /chats отдаёт только групповые беседы.
-- Класть сюда chat_id из личного диалога MAX нельзя — отправка ответит
-- 404 chat.not.found.
--
-- ДАННЫЕ. На 22.08.2026 в таблице 10 живых строк, из них 1 с привязкой к
-- users.id. Ломать нельзя, поэтому все шаги — переименования и добавления,
-- без пересоздания таблицы; данные не переносятся и не переписываются.
--
-- ПОРЯДОК ВЫКАТА. В отличие от 2026_08_17_notifications_tg_status.sql, здесь
-- переименование: старое имя таблицы исчезает, и работающий код,
-- ожидающий telegram_subscribers, немедленно упадёт. Поэтому ШАГ 5 создаёт
-- совместимое представление со старым именем и старым набором колонок —
-- миграцию можно применить ДО выката кода, без окна недоступности.
-- Представление удаляется отдельным шагом после того, как код переведён
-- на новую модель (см. хвост файла).
--
-- НЕ ПРИМЕНЕНА. Прогонять вручную, см. команды в конце.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- ШАГ 1. Таблица и колонка получают нейтральные имена.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE telegram_subscribers RENAME TO messenger_subscribers;
ALTER TABLE messenger_subscribers RENAME COLUMN telegram_id TO external_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- ШАГ 2. Площадка. DEFAULT 'telegram' закрывает существующие 10 строк —
-- отдельный UPDATE не нужен, NOT NULL ставится сразу и безопасно.
-- Длина 20 с запасом: 'telegram', 'max', дальше возможен 'vk'.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE messenger_subscribers
    ADD COLUMN IF NOT EXISTS platform VARCHAR(20) NOT NULL DEFAULT 'telegram';

-- Опечатка в platform превращает подписчика в невидимку: рассылка его просто
-- не найдёт, и это не всплывёт ни в одной ошибке. Пусть падает сразу.
ALTER TABLE messenger_subscribers
    ADD CONSTRAINT ck_messenger_subscribers_platform
    CHECK (platform IN ('telegram', 'max'));

-- ─────────────────────────────────────────────────────────────────────────────
-- ШАГ 3. Уникальность — по паре. Старое ограничение снимается: оно запрещало
-- бы одному и тому же числу быть и chat_id в Telegram, и user_id в MAX.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE messenger_subscribers
    DROP CONSTRAINT IF EXISTS telegram_subscribers_telegram_id_key;

ALTER TABLE messenger_subscribers
    ADD CONSTRAINT uq_messenger_subscribers_platform_external
    UNIQUE (platform, external_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ШАГ 4. Индекс под главный запрос конвейера: «куда слать пользователю N».
-- Частичный — строки с subscribed = false рассылку не интересуют,
-- а user_id IS NULL означает «человек написал боту, но аккаунт не привязал».
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS ix_messenger_subscribers_delivery
    ON messenger_subscribers (user_id, platform)
    WHERE subscribed AND user_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- ШАГ 5. Совместимость со старым кодом на время выката.
--
-- Представление простое (одна таблица, без агрегатов и DISTINCT), поэтому
-- PostgreSQL делает его автообновляемым: работающий сейчас код продолжит
-- читать и писать telegram_subscribers как раньше.
-- WITH CHECK OPTION не даёт через него создать строку чужой площадки.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW telegram_subscribers AS
    SELECT id,
           external_id AS telegram_id,
           username,
           full_name,
           user_id,
           subscribed,
           created_at
      FROM messenger_subscribers
     WHERE platform = 'telegram'
    WITH CHECK OPTION;

-- INSERT через представление не знает про platform, а DEFAULT колонки при
-- вставке в view не применяется автоматически к отсутствующему столбцу —
-- поэтому право на запись даём, а корректность площадки обеспечивает DEFAULT
-- базовой таблицы (столбец в списке INSERT отсутствует => берётся DEFAULT).

-- ─────────────────────────────────────────────────────────────────────────────
-- ШАГ 6. Косметика: PostgreSQL при RENAME TABLE не переименовывает ни индекс
-- первичного ключа, ни последовательность — без этого шага в базе остались бы
-- telegram_subscribers_pkey и telegram_subscribers_id_seq на таблице
-- messenger_subscribers, а рядом ещё и представление с тем же именем.
--
-- Переименование последовательности безопасно: DEFAULT колонки хранит ссылку
-- на неё по OID (nextval('...'::regclass) разбирается при создании), поэтому
-- nextval продолжает работать и правки DEFAULT не требуется.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER INDEX    telegram_subscribers_pkey   RENAME TO messenger_subscribers_pkey;
ALTER SEQUENCE telegram_subscribers_id_seq RENAME TO messenger_subscribers_id_seq;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ
-- ─────────────────────────────────────────────────────────────────────────────
-- \d messenger_subscribers
-- SELECT platform, count(*), count(user_id) AS с_привязкой
--   FROM messenger_subscribers GROUP BY platform;
--   -- ожидается: telegram | 10 | 1
-- SELECT count(*) FROM telegram_subscribers;   -- через view, ожидается 10
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ОТКАТ (до выката кода, пока представление ещё нужно)
-- ─────────────────────────────────────────────────────────────────────────────
-- BEGIN;
-- DROP VIEW IF EXISTS telegram_subscribers;
-- ALTER TABLE messenger_subscribers DROP CONSTRAINT uq_messenger_subscribers_platform_external;
-- ALTER TABLE messenger_subscribers DROP CONSTRAINT ck_messenger_subscribers_platform;
-- DROP INDEX IF EXISTS ix_messenger_subscribers_delivery;
-- DELETE FROM messenger_subscribers WHERE platform <> 'telegram';  -- ВНИМАНИЕ: теряет подписчиков MAX
-- ALTER TABLE messenger_subscribers DROP COLUMN platform;
-- ALTER TABLE messenger_subscribers RENAME COLUMN external_id TO telegram_id;
-- ALTER SEQUENCE messenger_subscribers_id_seq RENAME TO telegram_subscribers_id_seq;
-- ALTER INDEX    messenger_subscribers_pkey  RENAME TO telegram_subscribers_pkey;
-- ALTER TABLE messenger_subscribers RENAME TO telegram_subscribers;
-- ALTER TABLE telegram_subscribers ADD CONSTRAINT telegram_subscribers_telegram_id_key UNIQUE (telegram_id);
-- COMMIT;
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ПОСЛЕ ПЕРЕВОДА КОДА НА НОВУЮ МОДЕЛЬ — снять совместимость отдельным шагом:
-- ─────────────────────────────────────────────────────────────────────────────
-- DROP VIEW telegram_subscribers;
