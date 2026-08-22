#!/usr/bin/env python3
"""Проверка актуальности сертификатов УЦ Минцифры, лежащих в репозитории.

ЗАЧЕМ ОТДЕЛЬНО ОТ СБОРКИ. Раньше сертификаты скачивались прямо в Dockerfile.
Это ставило деплой в зависимость от постороннего сайта: лежит gu-st.ru — не
выкатывается ничего, даже правки, никак с MAX не связанные. Плюс в момент
плановой ротации Sub CA закреплённая контрольная сумма перестала бы совпадать,
и сборка падала бы внезапно.

Поэтому сборка берёт файлы из backend/certs/ и в сеть не ходит, а этот скрипт
ходит — но он вне критического пути. Его дело: вовремя сказать «пора обновить»,
а не мешать выкату.

Проверяются две вещи:
  1. Не истекает ли скоро наш экземпляр (Sub CA — до 06.03.2027, продлевать
     руками, автоматики нет).
  2. Не отличается ли то, что лежит у нас, от того, что сейчас отдаёт
     gu-st.ru — то есть не выпустили ли замену.

Запуск:
    python3 scripts/check_ca_certs.py            # человекочитаемо
    python3 scripts/check_ca_certs.py --json     # для монитора

Код возврата: 0 — всё в порядке, 1 — есть что чинить.
"""

import argparse
import hashlib
import json
import ssl
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://gu-st.ru/content/Other/doc"
CERT_DIR = Path(__file__).resolve().parent.parent / "backend" / "certs"

# Соответствие «наш файл — имя у источника». У gu-st.ru расширение .cer,
# внутри при этом PEM; мы храним под .pem без конвертации.
FILES = {
    "russian_trusted_root_ca.pem": "russian_trusted_root_ca.cer",
    "russian_trusted_sub_ca.pem":  "russian_trusted_sub_ca.cer",
}

WARN_DAYS = 60          # запас на обновление руками
NETWORK_TIMEOUT = 30


def expiry_days(pem_bytes):
    """Сколько дней осталось сертификату. None — если разобрать не вышло."""
    try:
        out = subprocess.run(
            ["openssl", "x509", "-noout", "-enddate"],
            input=pem_bytes, capture_output=True, timeout=15, check=True,
        ).stdout.decode()
        raw = out.split("=", 1)[1].strip()
        exp = datetime.strptime(raw, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
        return (exp - datetime.now(timezone.utc)).days, exp
    except Exception:
        return None, None


def fetch(name):
    """Скачать файл у источника. Возвращает (данные, ошибка)."""
    try:
        ctx = ssl.create_default_context()
        with urllib.request.urlopen(f"{BASE}/{name}", timeout=NETWORK_TIMEOUT,
                                    context=ctx) as r:
            return r.read(), None
    except Exception as e:
        return None, f"{type(e).__name__}: {e}"


def check():
    report = {"certs": [], "problems": [], "network_ok": True}

    for local_name, remote_name in FILES.items():
        path = CERT_DIR / local_name
        entry = {"file": local_name}

        if not path.is_file():
            entry["error"] = "файла нет в репозитории"
            report["problems"].append(f"{local_name}: файла нет")
            report["certs"].append(entry)
            continue

        ours = path.read_bytes()
        entry["sha256"] = hashlib.sha256(ours).hexdigest()

        days, exp = expiry_days(ours)
        entry["days_left"] = days
        entry["expires"] = exp.strftime("%d.%m.%Y") if exp else None

        if days is None:
            report["problems"].append(f"{local_name}: срок не разобрался")
        elif days < 0:
            report["problems"].append(f"{local_name} ИСТЁК {-days} дн. назад")
        elif days < WARN_DAYS:
            report["problems"].append(f"{local_name} истекает через {days} дн.")

        remote, err = fetch(remote_name)
        if err:
            # Недоступность источника — не проблема нашей работы: бот от этого
            # не ломается. Отмечаем и идём дальше, тревогу не поднимаем.
            entry["upstream"] = f"недоступен ({err})"
            report["network_ok"] = False
        elif hashlib.sha256(remote).hexdigest() == entry["sha256"]:
            entry["upstream"] = "совпадает"
        else:
            r_days, r_exp = expiry_days(remote)
            entry["upstream"] = "ОТЛИЧАЕТСЯ"
            entry["upstream_expires"] = r_exp.strftime("%d.%m.%Y") if r_exp else None
            report["problems"].append(
                f"{local_name}: у источника ДРУГОЙ файл"
                + (f" (действует до {entry['upstream_expires']})" if r_exp else "")
                + " — пора обновить backend/certs/"
            )

        report["certs"].append(entry)

    return report


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--json", action="store_true", help="машиночитаемый вывод")
    args = ap.parse_args()

    report = check()

    if args.json:
        print(json.dumps(report, ensure_ascii=False))
        return 1 if report["problems"] else 0

    print("Сертификаты УЦ Минцифры в backend/certs/")
    print("=" * 62)
    for c in report["certs"]:
        if "error" in c:
            print(f"  {c['file']}: {c['error']}")
            continue
        print(f"  {c['file']}")
        print(f"      действует до : {c['expires']} ({c['days_left']} дн.)")
        print(f"      у источника   : {c['upstream']}")
    print()
    if report["problems"]:
        print("ТРЕБУЕТ ВНИМАНИЯ:")
        for p in report["problems"]:
            print(f"  • {p}")
        print("\nПорядок обновления — backend/certs/README.md")
        return 1

    print("Всё в порядке." + ("" if report["network_ok"]
                              else " (источник был недоступен, сверка не делалась)"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
