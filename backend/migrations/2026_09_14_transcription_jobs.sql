-- Миграция: задания транскрибации совещаний (задача 30).
--
-- ЗАЧЕМ. Аудио совещаний распознаёт не сайт, а отдельный сервис
-- /opt/transcriber (свой Docker-проект, своя сеть, своя SQLite) — общий
-- канал между ними только каталог /opt/transcriber/inbox, смонтированный в
-- оба контейнера. Сайт кладёт файл в inbox и ждёт колбэк с готовым текстом;
-- сам файл в БД сайта никогда не хранится, только результат.
--
-- Таблицу создаст и Base.metadata.create_all при старте backend (см.
-- backend/app/main.py) — этот файл прогонять вручную не обязательно, но
-- заведён по общему для проекта принципу: у каждой новой таблицы есть свой
-- .sql, а не только запись в SQLAlchemy-модели (см., например,
-- 2026_08_22_link_tokens.sql).
--
-- СТАТУСЫ. uploaded -> processing -> done | error. processing выставляет
-- бот, когда достаёт задание из своей очереди; uploaded и processing —
-- единственные статусы, которые ещё можно тронуть колбэком или списать по
-- TTL (backend/app/celery_app.py, transcribe_cleanup_task).
--
-- НЕ ПРИМЕНЕНА. Прогонять вручную, см. команды в конце.

BEGIN;

CREATE TABLE IF NOT EXISTS transcription_jobs (
    id             UUID PRIMARY KEY,
    user_id        INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_name  VARCHAR(300) NOT NULL,
    size_bytes     BIGINT       NOT NULL,
    duration_sec   INTEGER,                      -- заполняет бот после ffprobe
    status         VARCHAR(20)  NOT NULL DEFAULT 'uploaded',
    text           TEXT,
    error          TEXT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    finished_at    TIMESTAMPTZ
);

-- Список своих заданий (GET /api/transcribe/jobs) и проверка «нет ли уже
-- активного задания у пользователя» (POST /api/transcribe/upload).
CREATE INDEX IF NOT EXISTS ix_transcription_jobs_user
    ON transcription_jobs (user_id, created_at DESC);

-- Уборка по TTL (celery beat, раз в час) ищет именно незакрытые и старые.
CREATE INDEX IF NOT EXISTS ix_transcription_jobs_active
    ON transcription_jobs (created_at)
    WHERE status IN ('uploaded', 'processing');

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- ПРОВЕРКА ПОСЛЕ ПРИМЕНЕНИЯ
-- ─────────────────────────────────────────────────────────────────────────────
-- \d transcription_jobs
-- SELECT status, count(*) FROM transcription_jobs GROUP BY status;
--
-- ─────────────────────────────────────────────────────────────────────────────
-- ОТКАТ
-- ─────────────────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS transcription_jobs;
