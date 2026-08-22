#!/bin/sh
# Суточные дампы БД для сервиса db-backup.
#
# Раньше это был однострочник в docker-compose.yml:
#     pg_dump $DATABASE_URL > /backups/backup_$(date ...).sql; sleep 86400
# У него две беды, обе подтверждены фактами на 22.08.2026.
#
# 1. Перенаправление создаёт файл ДО запуска pg_dump, поэтому упавший
#    pg_dump оставлял дамп нулевого размера — и выглядел как успешный.
#    Таких файлов нашлось 2 из 50, то есть 4% суток были без резервной
#    копии, и об этом никто не знал. Теперь дамп пишется во временный
#    файл и переименовывается только после успешного выхода pg_dump.
# 2. umask по умолчанию давал файлам права 644. Каталог 700 закрывает
#    их от чужих глаз, но внутри дампа — ФИО детей, телефоны родителей
#    и суммы взносов, так что права ставим явно.
#
# Ротация: 30 дней. Выполняется только после успешного дампа — иначе
# неудачная ночь стоила бы разом и свежей копии, и месячного архива.

set -u

BACKUP_DIR=/backups
KEEP_DAYS=30

umask 077

log() { echo "[db-backup] $(date -u +%Y-%m-%dT%H:%M:%SZ) $*"; }

while true; do
    STAMP=$(date +%Y%m%d_%H%M%S)
    TMP="$BACKUP_DIR/.tmp_$STAMP.sql"
    DST="$BACKUP_DIR/backup_$STAMP.sql"

    if pg_dump "$DATABASE_URL" > "$TMP" 2>/tmp/pg_dump.err; then
        # Пустой файл при нулевом коде возврата — теоретически невозможен,
        # но именно такие «невозможные» случаи мы и ловим постфактум.
        if [ -s "$TMP" ]; then
            mv "$TMP" "$DST"
            log "дамп готов: $(basename "$DST"), $(wc -c < "$DST") байт"

            DELETED=$(find "$BACKUP_DIR" -maxdepth 1 -name 'backup_*.sql' \
                          -mtime +$KEEP_DAYS -print -delete | wc -l)
            [ "$DELETED" -gt 0 ] && log "ротация: удалено $DELETED старше $KEEP_DAYS дней"
        else
            log "ОШИБКА: pg_dump вернул 0, но файл пуст — дамп отброшен"
            rm -f "$TMP"
        fi
    else
        log "ОШИБКА: pg_dump упал: $(head -c 200 /tmp/pg_dump.err)"
        rm -f "$TMP"
    fi

    # Подчистка временных файлов, осиротевших при убийстве контейнера
    # посреди дампа: без этого они копились бы вечно, никем не читаемые.
    find "$BACKUP_DIR" -maxdepth 1 -name '.tmp_*.sql' -mmin +180 -delete

    sleep 86400
done
