"""Сборка CA-bundle с доверием к УЦ Минцифры. Выполняется ПРИ СБОРКЕ ОБРАЗА.

Зачем это вообще нужно
──────────────────────
Бот клуба в MAX ходит на https://platform-api2.max.ru. Сертификат *.max.ru
выдан «Russian Trusted Sub CA» Минцифры, которого нет ни в одном мировом
наборе корневых сертификатов. Замер из контейнера 22.08.2026: 20 запросов из
20 падали с CERTIFICATE_VERIFY_FAILED, при том что TLS-рукопожатие доходило
до сервера за 14 мс — ломалась ровно проверка цепочки, а не сеть.

Почему bundle собирается здесь, а не лежит .pem-файлом в репозитории
────────────────────────────────────────────────────────────────────
Скачанный кем-то однажды сертификат в репозитории через год превращается в
файл без происхождения: неизвестно, откуда взят, кем и не подменён ли. Здесь
же источник, проверка и срок годности видны в одном месте и попадают в лог
сборки, а расхождение контрольной суммы ломает сборку громко и сразу.

Почему httpx, а не системное хранилище
──────────────────────────────────────
httpx берёт набор из certifi, а НЕ из /etc/ssl/certs. Поэтому привычный
update-ca-certificates эту задачу не решает — нужен именно отдельный bundle,
путь к которому уходит в MAX_CA_BUNDLE и подставляется в verify=.

Срок годности
─────────────
Sub CA истекает 06.03.2027. Скрипт печатает дату в лог сборки и ругается,
если до истечения осталось меньше 60 дней. Дополнительно за сроком следит
ежедневная сводка taipan-monitor.
"""

import hashlib
import ssl
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone

import certifi

BUNDLE = "/etc/ssl/max_ca_bundle.pem"
BASE = "https://gu-st.ru/content/Other/doc"

# Контрольные суммы сняты 22.08.2026. Сертификаты УЦ живут годами и меняться
# не должны: расхождение — это либо плановая замена корня (тогда обновить
# суммы осознанно, сверившись с gu-st.ru), либо подмена. Оба случая обязаны
# останавливать сборку, а не проезжать молча.
CERTS = {
    "russian_trusted_root_ca":
        "936a43fea6e8e525bcc0f81acd9c3d21b4fc4b9b68acea7906d698005afc6504",
    "russian_trusted_sub_ca":
        "f0ae589f36774f29ef3648f7984b08d42fcce6f1ffeeb6236d773daeb2744ea6",
}

# Сам gu-st.ru закрыт сертификатом GlobalSign, то есть общедоверенным:
# скачивание проверяется штатно, замкнутого круга «нужен корень, чтобы
# скачать корень» здесь нет.
ctx = ssl.create_default_context(cafile=certifi.where())

parts = [open(certifi.where(), encoding="utf-8").read()]

for name, want in CERTS.items():
    url = f"{BASE}/{name}.cer"
    with urllib.request.urlopen(url, timeout=30, context=ctx) as r:
        raw = r.read()

    got = hashlib.sha256(raw).hexdigest()
    if got != want:
        sys.exit(
            f"\nСБОРКА ОСТАНОВЛЕНА: {name} не совпал с ожидаемым.\n"
            f"  ожидалось: {want}\n  получено : {got}\n"
            f"  источник : {url}\n"
            f"Сверьтесь с gu-st.ru и обновите суммы осознанно.\n"
        )

    # Файлы отдаются в PEM, но полагаться на это вслепую не будем.
    text = raw.decode("ascii", errors="replace")
    if "BEGIN CERTIFICATE" not in text:
        pem = subprocess.run(
            ["openssl", "x509", "-inform", "DER"],
            input=raw, capture_output=True, check=True,
        ).stdout.decode()
    else:
        pem = text

    info = subprocess.run(
        ["openssl", "x509", "-noout", "-subject", "-enddate"],
        input=pem.encode(), capture_output=True, check=True,
    ).stdout.decode().strip()

    not_after = [l for l in info.splitlines() if l.startswith("notAfter=")][0]
    exp = datetime.strptime(not_after[len("notAfter="):].strip(),
                            "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
    left = (exp - datetime.now(timezone.utc)).days

    print(f"[ca-bundle] {name}: sha256 ok, истекает {exp:%d.%m.%Y} (через {left} дн.)")
    if left < 60:
        print(f"[ca-bundle] ВНИМАНИЕ: до истечения {name} осталось {left} дней!")

    parts.append(pem)

with open(BUNDLE, "w", encoding="utf-8") as f:
    f.write("\n".join(parts))

print(f"[ca-bundle] собран {BUNDLE}: certifi + {len(CERTS)} сертификата Минцифры")
