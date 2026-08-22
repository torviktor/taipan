FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ─── Доверие к УЦ Минцифры ───────────────────────────────────────────────────
# API мессенджера MAX закрыто сертификатом «Russian Trusted Sub CA», которого
# нет в наборе certifi, — без этого шага httpx отвергает КАЖДЫЙ запрос к
# platform-api2.max.ru.
#
# Сертификаты лежат в репозитории (certs/), и сборка В СЕТЬ НЕ ХОДИТ: иначе
# деплой зависел бы от доступности gu-st.ru, и его падение останавливало бы
# выкат любых правок. Проверку «не пора ли обновить» делает еженедельная
# задача монитора, вне критического пути сборки.
#
# Шаг стоит после pip install (нужен certifi) и до COPY . . — правки кода
# не сбрасывают его кэш, а правка сертификатов сбрасывает.
COPY certs/ /tmp/certs/
COPY build_ca_bundle.py /tmp/build_ca_bundle.py
RUN python /tmp/build_ca_bundle.py && rm -rf /tmp/build_ca_bundle.py /tmp/certs
ENV MAX_CA_BUNDLE=/etc/ssl/max_ca_bundle.pem

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
