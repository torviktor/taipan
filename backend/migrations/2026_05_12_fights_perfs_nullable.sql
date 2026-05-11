-- Миграция: разрешить NULL в полях fights/perfs таблицы competition_results.
--
-- Цель: на фронте поля «количество боёв/выступлений» теперь могут быть пустыми
-- (это означает «не заполнено» в отличие от явно введённого 0). Pydantic и
-- модель уже обновлены на Optional/nullable, но на существующей БД действует
-- старый констрейнт NOT NULL — для новых записей INSERT с NULL упадёт.
--
-- Существующие нули в БД НЕ трогаем — отличить «реально 0» от «не заполнено»
-- ретроспективно невозможно. Старые записи останутся с 0, новые пойдут с NULL.

ALTER TABLE competition_results
    ALTER COLUMN sparring_fights DROP NOT NULL,
    ALTER COLUMN sparring_fights SET DEFAULT NULL,
    ALTER COLUMN stopball_fights DROP NOT NULL,
    ALTER COLUMN stopball_fights SET DEFAULT NULL,
    ALTER COLUMN tegtim_fights   DROP NOT NULL,
    ALTER COLUMN tegtim_fights   SET DEFAULT NULL,
    ALTER COLUMN tuli_perfs      DROP NOT NULL,
    ALTER COLUMN tuli_perfs      SET DEFAULT NULL;

-- Проверка после применения (должна вернуть is_nullable = YES для всех 4 колонок):
-- SELECT column_name, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'competition_results'
--   AND column_name IN ('sparring_fights','stopball_fights','tegtim_fights','tuli_perfs');
