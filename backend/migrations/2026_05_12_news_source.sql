-- Сессия 6, задача 4.2: ввод колонки source в таблице news.
-- Используется для:
--   * различения автодрафтов от ручных новостей и парсерных
--   * дедупликации автодрафтов по паре (FK сущности, source) в пределах
--     status='draft' — например, второй POST /competitions с тем же id
--     не наплодит второй анонс
--
-- Значения (Literal на уровне приложения, БЕЗ CHECK constraint —
-- чтобы 4.4/4.5 могли добавлять новые источники без миграции):
--   manual, auto_competition_anons, auto_certification_anons,
--   auto_camp_anons, nadezhda, vk, gtf_telegram, ai
--
-- Идемпотентна: повторный прогон не упадёт.

BEGIN;

ALTER TABLE news
  ADD COLUMN IF NOT EXISTS source TEXT;

CREATE INDEX IF NOT EXISTS news_source_idx ON news(source);

UPDATE news SET source = 'manual' WHERE source IS NULL;

COMMIT;
