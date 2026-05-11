-- Миграция: добавить таблицу season_best_athletes (4 слота лучших сезона
-- с привязкой к Athlete + историей) и снести legacy-плейсхолдеры из hall_of_fame.
--
-- Старая система — две строки в hall_of_fame с флагами season_best_senior /
-- season_best_junior — заменяется новой моделью SeasonBestAthlete. Колонки
-- season_best_* в hall_of_fame оставляем как DEPRECATED dead-fields,
-- удаление колонок — отдельной сессией.
--
-- Применять командами раздельно через psql.

-- ─────────────────────────────────────────────────────────────────────────────
-- ШАГ 1. Создать новую таблицу.
-- create_all() при старте бэка тоже её создаст на пустых БД (модель есть),
-- но на проде с уже наполненной БД этот ALTER нужно прогнать вручную.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS season_best_athletes (
    id         SERIAL PRIMARY KEY,
    athlete_id INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    slot       VARCHAR(20) NOT NULL,
    season     INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT ux_sba_slot_season UNIQUE (slot, season)
);

CREATE INDEX IF NOT EXISTS ix_sba_athlete_id ON season_best_athletes (athlete_id);
CREATE INDEX IF NOT EXISTS ix_sba_season     ON season_best_athletes (season);

-- ─────────────────────────────────────────────────────────────────────────────
-- ШАГ 2. Удалить legacy-плейсхолдеры из hall_of_fame.
-- Это 2 фиктивные карточки, создаваемые стартовым хуком (теперь удалён).
-- Реальные исторические записи Зала Славы не задеваются: у них флаги false.
-- ─────────────────────────────────────────────────────────────────────────────
-- Сначала диагностика — посмотреть, что удалится:
SELECT id, full_name, season_best_senior, season_best_junior
FROM hall_of_fame
WHERE season_best_senior = TRUE OR season_best_junior = TRUE;

-- Потом удаление:
DELETE FROM hall_of_fame
WHERE season_best_senior = TRUE OR season_best_junior = TRUE;

-- Проверка после применения:
-- SELECT COUNT(*) FROM season_best_athletes;  -- 0 (пока никто не назначен)
-- SELECT COUNT(*) FROM hall_of_fame WHERE season_best_senior OR season_best_junior;  -- 0
