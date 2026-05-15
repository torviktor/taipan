-- Сессия 11, задача 4.4 (шаг 1/7): флаг needs_review для ML-валидации
-- AI-сгенерированных черновиков. Утилита validate_generated_news будет
-- ставить needs_review=true для черновиков с подозрительным содержимым;
-- ручные новости (source='manual') и проверенные авто-черновики остаются
-- с needs_review=false.
--
-- Идемпотентна.

BEGIN;

ALTER TABLE news
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false;

COMMIT;
