-- Сессия 6, задача 4.1: ввод колонки status в таблице news.
-- is_published НЕ удаляется — остаётся в БД для возможного отката.
-- DROP COLUMN is_published вынесен в отдельную миграцию следующей сессии,
-- когда новый код подтвердит стабильность.

ALTER TABLE news
  ADD COLUMN status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'archived'));

UPDATE news
   SET status = CASE WHEN is_published THEN 'published' ELSE 'draft' END;

CREATE INDEX news_status_idx ON news(status);
