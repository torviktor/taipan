#!/usr/bin/env python3
"""Проверка разметки MAX на живом диалоге — глазами.

ЗАЧЕМ. Набор поддерживаемых тегов по API узнать НЕЛЬЗЯ. Проверено 22.08.2026:
тело запроса валидируется раньше поиска адресата, и по коду ответа видно,
принят ли payload (400 proto.payload против 404 dialog.not.found) — но
одинаково «принимаются» и <b>, и выдуманный <div>. То есть сервер про теги
ничего не говорит: отображается тег или показывается сырым, видно только в
клиенте.

Поэтому здесь единственный честный способ: отправить человеку сообщение, где
каждый тег подписан, и посмотреть на него глазами.

Запуск (user_id берётся из messenger_subscribers или из лога вебхука):

    docker compose exec -T backend python /app/../scripts/max_markup_probe.py 123456
    # либо прямо на хосте, если окружение настроено:
    MAX_BOT_TOKEN=... MAX_CA_BUNDLE=... python3 scripts/max_markup_probe.py 123456

Что делать с результатом: теги, которые пришли сырыми, убрать из
ALLOWED_TAGS в app/services/max_bot.py и не использовать в текстах.
"""

import os
import sys

import httpx

# Проверяем и то, что используем, и то, что могли бы использовать: список
# намеренно шире рабочего, иначе проверка не расширит наши возможности.
CASES = [
    ("b",          "<b>жирный</b>"),
    ("strong",     "<strong>жирный strong</strong>"),
    ("i",          "<i>курсив</i>"),
    ("em",         "<em>курсив em</em>"),
    ("u",          "<u>подчёркнутый</u>"),
    ("s",          "<s>зачёркнутый</s>"),
    ("code",       "<code>моноширинный</code>"),
    ("pre",        "<pre>блок кода</pre>"),
    ("a",          "<a href=\"https://taipan-tkd.ru\">ссылка на сайт</a>"),
    ("blockquote", "<blockquote>цитата</blockquote>"),
    ("вложенные",  "<b>жирный <i>и курсив</i></b>"),
    ("экранир.",   "амперсанд &amp; и знак &lt;меньше&gt;"),
]


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        print("ОШИБКА: укажите user_id получателя первым аргументом.")
        return 2

    user_id = sys.argv[1]
    token = os.getenv("MAX_BOT_TOKEN", "")
    bundle = os.getenv("MAX_CA_BUNDLE", "/etc/ssl/max_ca_bundle.pem")
    if not token:
        print("ОШИБКА: MAX_BOT_TOKEN не задан.")
        return 2

    lines = ["<b>Проверка разметки.</b> Слева название тега, справа результат.",
             "Если справа виден сам тег в угловых скобках — он не поддерживается.",
             ""]
    lines += [f"{name}: {sample}" for name, sample in CASES]
    text = "\n".join(lines)

    r = httpx.post(
        "https://platform-api2.max.ru/messages",
        params={"user_id": user_id},
        json={"text": text, "format": "html"},
        headers={"Authorization": token, "Content-Type": "application/json"},
        timeout=20,
        verify=bundle,
    )
    print(f"HTTP {r.status_code}")
    if r.status_code == 200:
        print(f"Отправлено {len(CASES)} образцов. Посмотрите сообщение в MAX и")
        print("сверьте, какие теги отобразились, а какие пришли сырыми.")
        return 0

    print(r.text[:400])
    if r.status_code == 404:
        print("\ndialog.not.found — с этим user_id у бота нет диалога.")
        print("Человек должен сначала написать боту хоть что-нибудь.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
