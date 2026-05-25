-- Сессия 11, задача 22 (22c): свободное текстовое поле для причины
-- авто-разметки черновика. validate_generated_news пишет сюда краткую
-- ноту ("validator: rejected — ...", "validator: needs review — ...",
-- "gpt_unavailable: TimeoutError") вместе с needs_review=true. Тренер
-- видит ноту под заголовком черновика в кабинете и сразу понимает,
-- надо ли переписывать текст или достаточно лёгкой правки.
--
-- NULL = новость не проходила авто-разметку (manual / штатная GPT-выдача).
-- Идемпотентна.

BEGIN;

ALTER TABLE news
  ADD COLUMN IF NOT EXISTS quality_notes TEXT NULL;

COMMIT;
