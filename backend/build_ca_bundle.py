"""Сборка CA-bundle с доверием к УЦ Минцифры. Выполняется ПРИ СБОРКЕ ОБРАЗА.

Зачем это вообще нужно
──────────────────────
Бот клуба в MAX ходит на https://platform-api2.max.ru. Сертификат *.max.ru
выдан «Russian Trusted Sub CA» Минцифры, которого нет ни в одном мировом
наборе корневых сертификатов. Замер из контейнера 22.08.2026: 20 запросов из
20 падали с CERTIFICATE_VERIFY_FAILED, при том что TLS-рукопожатие доходило
до сервера за 14 мс — ломалась ровно проверка цепочки, а не сеть.

httpx берёт набор из certifi, а НЕ из /etc/ssl/certs, поэтому привычный
update-ca-certificates задачу не решает: нужен отдельный bundle, путь к
которому уходит в MAX_CA_BUNDLE и подставляется в verify=.

Почему сертификаты лежат в репозитории (backend/certs/)
───────────────────────────────────────────────────────
Первая версия скачивала их с gu-st.ru прямо при сборке. Так делать нельзя:
деплой начинал зависеть от доступности постороннего сайта, и падение gu-st.ru
останавливало выкат любых правок, даже никак не связанных с MAX. Вдобавок в
момент плановой ротации Sub CA закреплённая контрольная сумма перестала бы
совпадать — и сборка ломалась бы внезапно и с неочевидной причиной.

Поэтому ЭТОТ СКРИПТ В СЕТЬ НЕ ХОДИТ. Он только собирает bundle из локальных
файлов и проверяет, что они те самые. Вопрос «не пора ли обновить»
решает scripts/check_ca_certs.py — отдельно, еженедельно, вне сборки.

Что делает проверка контрольных сумм
────────────────────────────────────
Теперь она защищает не от подмены по сети (сети нет), а от случайной порчи
файла: перекодировки при переносе, «полезного» автоформатирования, обрезанного
копипаста. Расхождение останавливает сборку с явным указанием, что делать.
"""

import hashlib
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import certifi

BUNDLE = "/etc/ssl/max_ca_bundle.pem"
CERT_DIR = Path(__file__).parent / "certs"

# Порядок важен только для читаемости лога: bundle — это просто набор.
# Суммы и даты сняты 22.08.2026, порядок обновления описан в certs/README.md.
CERTS = {
    "russian_trusted_root_ca.pem":
        "936a43fea6e8e525bcc0f81acd9c3d21b4fc4b9b68acea7906d698005afc6504",
    "russian_trusted_sub_ca.pem":
        "f0ae589f36774f29ef3648f7984b08d42fcce6f1ffeeb6236d773daeb2744ea6",
}

# За 60 дней до истечения сборка начинает ворчать в лог. Это дублирующий
# рубеж: основной — ежедневная сводка монитора с порогом 30 дней. Сборка
# при этом НЕ падает: просроченный корень ломает бота в MAX, но не повод
# запретить выкатывать сайт.
WARN_DAYS = 60

parts = [Path(certifi.where()).read_text(encoding="utf-8")]
problems = []

for name, want in CERTS.items():
    path = CERT_DIR / name

    if not path.is_file():
        sys.exit(
            f"\nСБОРКА ОСТАНОВЛЕНА: нет файла {path}.\n"
            f"Сертификаты УЦ Минцифры должны лежать в backend/certs/ —\n"
            f"см. backend/certs/README.md, раздел «Как обновить».\n"
        )

    raw = path.read_bytes()
    got = hashlib.sha256(raw).hexdigest()
    if got != want:
        sys.exit(
            f"\nСБОРКА ОСТАНОВЛЕНА: {name} не совпал с ожидаемой суммой.\n"
            f"  ожидалось: {want}\n"
            f"  получено : {got}\n\n"
            f"Это либо порча файла при переносе, либо ПЛАНОВОЕ ОБНОВЛЕНИЕ\n"
            f"сертификата. Если обновление намеренное — пересчитайте сумму\n"
            f"(sha256sum backend/certs/{name}) и впишите её в CERTS здесь же,\n"
            f"а даты поправьте в backend/certs/README.md.\n"
        )

    pem = raw.decode("ascii", errors="replace")
    if "BEGIN CERTIFICATE" not in pem:
        sys.exit(
            f"\nСБОРКА ОСТАНОВЛЕНА: {name} не похож на PEM.\n"
            f"Файлы с gu-st.ru отдаются с расширением .cer, но внутри PEM.\n"
            f"Если попался DER — сконвертируйте:\n"
            f"  openssl x509 -inform DER -in {name} -out {name}\n"
        )

    info = subprocess.run(
        ["openssl", "x509", "-noout", "-subject", "-enddate"],
        input=raw, capture_output=True, check=True,
    ).stdout.decode()

    not_after = next(l for l in info.splitlines() if l.startswith("notAfter="))
    exp = datetime.strptime(not_after[len("notAfter="):].strip(),
                            "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
    left = (exp - datetime.now(timezone.utc)).days

    print(f"[ca-bundle] {name}: sha256 ok, истекает {exp:%d.%m.%Y} (через {left} дн.)")
    if left < 0:
        problems.append(f"{name} ИСТЁК {-left} дн. назад")
    elif left < WARN_DAYS:
        problems.append(f"{name} истекает через {left} дн.")

    parts.append(pem)

Path(BUNDLE).write_text("\n".join(parts), encoding="utf-8")
print(f"[ca-bundle] собран {BUNDLE}: certifi + {len(CERTS)} сертификата Минцифры")

for p in problems:
    print(f"[ca-bundle] ВНИМАНИЕ: {p} — обновите backend/certs/, см. README.md там же")
