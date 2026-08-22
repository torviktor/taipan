FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ─── Доверие к УЦ Минцифры ───────────────────────────────────────────────────
# API мессенджера MAX закрыто сертификатом «Russian Trusted Sub CA», которого
# нет в наборе certifi, — без этого шага httpx отвергает КАЖДЫЙ запрос к
# platform-api2.max.ru. Bundle собирается здесь, а не хранится готовым файлом
# в репозитории: происхождение, контрольные суммы и срок годности видны в
# логе сборки, а подмена сертификата ломает сборку громко.
# Шаг стоит после pip install (нужен certifi) и до COPY . . — правки кода
# не сбрасывают его кэш.
COPY build_ca_bundle.py /tmp/build_ca_bundle.py
RUN python /tmp/build_ca_bundle.py && rm /tmp/build_ca_bundle.py
ENV MAX_CA_BUNDLE=/etc/ssl/max_ca_bundle.pem

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
