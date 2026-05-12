-- Сессия 6, задача 4.1: ввод колонки status в таблице news.
-- is_published НЕ удаляется — остаётся в БД для возможного отката.
-- DROP COLUMN is_published вынесен в отдельную миграцию следующей сессии,
-- когда новый код подтвердит стабильность.
--
-- Идемпотентна: повторный прогон не упадёт и не перепишет лишнего.
-- CREATE INDEX без CONCURRENTLY — внутри транзакционного блока; на news
-- (несколько сотен записей) лок миллисекундный.

BEGIN;

ALTER TABLE news
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'archived'));

UPDATE news
   SET status = CASE WHEN is_published THEN 'published' ELSE 'draft' END
 WHERE status = 'published' AND is_published = false;

CREATE INDEX IF NOT EXISTS news_status_idx ON news(status);

COMMIT;
