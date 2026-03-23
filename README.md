# 🥋 Taipan — Taekwondo Club Management Platform

> **Комплексная цифровая платформа управления спортивной организацией**  
> Спортивный клуб тхэквондо «Тайпан», Павловский Посад · **[taipan-tkd.ru](https://taipan-tkd.ru)**

![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?style=flat-square&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)
![YandexGPT](https://img.shields.io/badge/YandexGPT-5.1_Pro-CC0000?style=flat-square)
![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF?style=flat-square&logo=github-actions&logoColor=white)
![Production](https://img.shields.io/badge/Status-Production-4CAF50?style=flat-square)

---

## О проекте

Taipan — это не просто сайт спортивного клуба. Это **полноценная ERP-система для управления секцией тхэквондо** с AI-интеграциями, автоматизацией бизнес-процессов и геймификацией.

Проект решает реальную проблему: тренер тратил часы на ручное ведение журналов посещаемости, составление рейтингов, публикацию новостей и уведомление родителей. После внедрения системы всё это происходит автоматически.

**Ключевые цифры:**

| Параметр | Значение |
|---|---|
| Моделей БД | 12 (User, Athlete, Competition, Certification, Camp, Attendance, Achievement, News, HallOfFame, Event, Schedule, Payment) |
| API-роутеров | 16 (auth, users, applications, schedule, payments, events, telegram, ai, attendance, competitions, certifications, notifications, achievements, camps, hall-of-fame, news) |
| Страниц фронтенда | 15+ (Home, About, Schedule, Calendar, Champions, Apply, Login, Register, Cabinet, GroupKids1/2, Adults, News, Quiz, Privacy) |
| Ачивок | 18, три уровня редкости |
| Ролей пользователей | 4 (parent, athlete, manager, admin) |
| В продакшене с | 2025 года |

---

## Стек технологий

### Backend
| Технология | Версия | Назначение |
|---|---|---|
| Python | 3.11 | Основной язык |
| FastAPI | 0.115 | REST API, автодокументация (Swagger) |
| SQLAlchemy | 2.0 | ORM, работа с БД |
| PostgreSQL | 15 | Основная БД |
| Alembic | — | Миграции |
| Celery | — | Фоновые задачи |
| Redis | 7 | Брокер Celery, кэш |
| httpx | — | Async HTTP клиент (YandexGPT, Telegram API) |
| python-jose | — | JWT токены |
| passlib | — | Хеширование паролей |

### Frontend
| Технология | Версия | Назначение |
|---|---|---|
| React | 18 | UI фреймворк |
| React Router | 6 | SPA навигация |
| Vite | — | Сборщик |
| FullCalendar | — | Интерактивный календарь событий |
| Axios | — | HTTP клиент |

### AI / ML
| Технология | Назначение |
|---|---|
| **YandexGPT 5.1 Pro** (Yandex AI Studio) | Генерация новостей о событиях клуба, еженедельные анонсы |
| **TaipanGPT** (OpenRouter / Llama) | AI-ассистент с детальным системным промтом (терминология ГТФ) |

### Infrastructure
| Технология | Назначение |
|---|---|
| Docker Compose | Оркестрация (nginx + frontend + backend + db + redis + celery) |
| Nginx | Reverse proxy, статика |
| GitHub Actions | CI/CD — автодеплой на сервер при push в main |

### SEO
- Schema.org микроразметка `SportsClub`
- `sitemap.xml`, `robots.txt`
- Open Graph теги для соцсетей
- Интеграция Яндекс Вебмастер + Google Search Console
- Favicon из логотипа клуба

---

## Архитектура системы

```
┌─────────────────────────────────────────────────────────────┐
│                        Клиент (браузер)                       │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────┐
│                     Nginx (reverse proxy)                     │
│          /          →  React SPA (Vite build)                 │
│          /api/      →  FastAPI                                │
│          /static/   →  uploaded files                         │
└──────┬──────────────────────────────────────────────────────┘
       │
┌──────▼──────────┐    ┌──────────────┐    ┌─────────────────┐
│   FastAPI app   │◄──►│  PostgreSQL  │    │      Redis      │
│  (16 роутеров)  │    │  (12 таблиц) │    │  (Celery broker)│
└──────┬──────────┘    └──────────────┘    └────────┬────────┘
       │                                            │
       │   ┌──────────────────────────┐             │
       └──►│  Celery Worker + Beat    │◄────────────┘
           │  · парсинг новостей      │
           │  · Telegram-уведомления  │
           │  · начисление ачивок     │
           └──────────────────────────┘
```

### Роли пользователей

| Роль | Возможности |
|---|---|
| `parent` | Кабинет родителя, просмотр посещаемости/соревнований своих детей, уведомления, ответы на опросы |
| `athlete` | Личный кабинет спортсмена, рейтинг, ачивки |
| `manager` | Полный доступ к управлению: спортсмены, посещаемость, соревнования, аттестации, сборы, новости, Зал Славы |
| `admin` | Всё то же + управление пользователями, сброс паролей, архивирование |

**JWT-аутентификация:** `sub = str(user.id)`, токен передаётся в заголовке `Authorization: Bearer <token>`.

---

## Ключевые функции

### Управление клубом

**Журнал посещаемости**
- Пометка присутствия/отсутствия по каждой тренировке
- Сезонная статистика (сентябрь–август) с графиками
- Фильтрация по группам и периодам
- Экспорт и история сессий

**Система соревнований**
- Матрица заявок: все спортсмены × все дисциплины (спарринг, стоп-балл, тег-тим, туль/хъенг)
- Подсчёт медалей, результатов, мест
- Интеграция с рейтинговой системой (автоматический пересчёт)
- Уровни: Местный → Региональный → Окружной → Всероссийский → Международный

**Аттестации**
- Учёт текущих и целевых гыпов/данов (гып 11 → 1, затем даны 1–9)
- Отметка сдал/не сдал по каждому спортсмену
- Автоматическое обновление пояса при успешной сдаче
- История аттестаций

**Учебно-тренировочные сборы**
- Статусы участников: pending → confirmed / declined / paid
- Стоимость, место, даты
- Опрос участников через уведомления

**Зал Славы**
- Публичная страница чемпионов клуба
- Управление через кабинет тренера
- Фото, достижения, уровень пояса
- Золотая рамка для чемпионов мира и Европы

---

### Геймификация

**18 посезонных ачивок** трёх уровней редкости:

| Уровень | Примеры |
|---|---|
| `common` | «Первые шаги» (10 тренировок), «Боевое крещение» (1-е соревнование) |
| `rare` | «Стабильный боец» (50 тренировок), «Призёр» (1-е место), «Отличник посещаемости» (100% за месяц) |
| `legendary` | «Железная дисциплина» (100 тренировок), «Чемпион клуба» (топ-3 рейтинга за сезон) |

- Автоматическое начисление по триггерам (посещаемость / соревнования / аттестации)
- Таблица лидеров
- Просмотр прогресса в личном кабинете

---

### AI-интеграции

#### YandexGPT — автогенерация новостей

Тренер нажимает одну кнопку — система сама пишет новость:

1. Читает реальные данные из БД (участники, результаты, места, пояса)
2. **Умно определяет режим:** если дата события в прошлом → репортаж («прошло», итоги, поздравления); если в будущем → анонс («состоится», список участников, призыв следить). Если событие сегодня — спрашивает у тренера
3. Отправляет сформированный промт в YandexGPT 5.1 Pro
4. Сохраняет результат в БД, публикует на сайте

Три типа автоновостей:
- **`/api/news-admin/generate-comp-news`** — о соревновании (медали, места, участники)
- **`/api/news-admin/generate-cert-news`** — об аттестации (кто сдал, на какой пояс)
- **`/api/news-admin/generate-camp-news`** — о сборах (участники, место, даты)

Также: **`generate-announcement`** — еженедельный анонс предстоящих соревнований.

Есть и шаблонная генерация без GPT (`/api/news/from-competition/{id}` и аналоги) — быстро, бесплатно, по данным из БД.

#### TaipanGPT — AI-ассистент клуба

Чат-бот с детальным системным промтом: знает расписание, тренера, адрес, цены, правила. Использует специфическую терминологию ГТФ (доянг, хъёнги, массоги). Встроен в сайт как FAB-кнопка.

---

### Автоматизация (Celery)

| Задача | Расписание |
|---|---|
| Парсинг новостей с сайта дворца спорта | Ежедневно |
| Проверка и отправка Telegram-напоминаний о событиях | Каждые 10 минут |
| Начисление ачивок по триггерам | При каждом событии |

При создании соревнования/аттестации/сборов:
- Все активные спортсмены автоматически добавляются в список участников
- Всем пользователям отправляется уведомление в системе и Telegram

---

### Новостная лента

- Публикация с загрузкой фото (JPG/PNG/WebP, до 10 МБ)
- Привязка новости к соревнованию / аттестации / сборам
- Пагинация, фильтрация
- Редактирование и удаление с кнопки «Ред.» в кабинете

---

## Рейтинговая система

### Основная формула

```
Очки = Значимость × ln(Спарринг + Стоп-балл + Тег-тим + Тули + Медали + 1)
```

**Натуральный логарифм** нивелирует разрыв между победителем и рядовым участником: при сумме 10 → `ln(11) ≈ 2.4`; при сумме 100 → `ln(101) ≈ 4.6`.

### Коэффициент значимости турнира

| Уровень | Фестиваль | Турнир | Кубок | Первенство | Чемпионат |
|---|---|---|---|---|---|
| Местный | 1.0 | 1.2 | 1.5 | 1.5 | 1.5 |
| Региональный | 2.0 | 2.5 | 2.8 | 2.8 | 3.0 |
| Окружной | 4.0 | 4.5 | 5.0 | 5.0 | 6.0 |
| Всероссийский | 7.0 | 8.0 | 9.0 | 10.0 | 11.0 |
| Международный | 15.0 | 17.0 | 20.0 | 21.0 | 24.0 |

### Очки за дисциплины

**Контактные** (спарринг, стоп-балл, тег-тим):
```
очки = кол-во боёв × 3 + бонус за место (1-е: +40, 2-е: +24, 3-е: +14)
```

**Бесконтактные** (туль / хъенг):
```
очки = кол-во выступлений × 2 + бонус (1-е: +25, 2-е: +15, 3-е: +9)
```

**Медальный бонус** (применяется один раз):

| Медали | Бонус |
|---|---|
| 2+ золота | +55 |
| 1 золото + другие | +40 |
| 1 золото | +30 |
| 2+ медали (без золота) | +40 |
| 1 серебро | +18 |
| 1 бронза | +10 |

### Пример расчёта

Всероссийский фестиваль (значимость = 7.0). Иван: спарринг — 4 боя, 1 место; тули — 2 выступления, без места; 1 золото.

```
Спарринг = (4 × 3) + 40 = 52
Тули     = (2 × 2) + 0  =  4
Медали   = 30  (1 золото)
Сумма    = 52 + 4 + 30  = 86
ln(86 + 1) ≈ 4.465
Итог     = 7 × 4.465   ≈ 31.26 очков
```

### Возрастные категории и сезон

Рейтинги ведутся отдельно по категориям: **6–7, 8–9, 10–11, 12–14, 15–17 лет** (спортсмены 18+ не участвуют в рейтинге).

Спортивный сезон: **сентябрь–август** (2025/2026 = сен 2025 – авг 2026). Очки за все турниры сезона суммируются. При равных очках — делят место.

---

## Структура проекта

```
taipan/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI app, подключение роутеров
│   │   ├── core/
│   │   │   ├── database.py             # SQLAlchemy engine, get_db
│   │   │   └── security.py             # JWT, get_current_user, require_manager
│   │   ├── models/
│   │   │   ├── user.py                 # User, Athlete, Section, Schedule, Application, Payment
│   │   │   ├── event.py                # Event, EventReminder, TelegramSubscriber
│   │   │   ├── attendance.py           # AttendanceSession, AttendanceRecord
│   │   │   ├── competition.py          # Competition, CompetitionResult
│   │   │   ├── certification.py        # Certification, CertificationResult, Notification
│   │   │   ├── achievement.py          # AthleteAchievement, ACHIEVEMENTS (18 штук)
│   │   │   ├── camp.py                 # Camp, CampParticipant
│   │   │   ├── hall_of_fame.py         # HallOfFame
│   │   │   └── news.py                 # News
│   │   ├── routes/
│   │   │   ├── auth.py                 # Регистрация, логин
│   │   │   ├── users.py                # Профиль, список пользователей
│   │   │   ├── applications.py         # Заявки на запись
│   │   │   ├── schedule.py             # Расписание
│   │   │   ├── payments.py             # Оплата
│   │   │   ├── events.py               # Календарь событий
│   │   │   ├── telegram.py             # Telegram-бот, подписка
│   │   │   ├── ai.py                   # TaipanGPT (OpenRouter)
│   │   │   ├── attendance.py           # Журнал посещаемости
│   │   │   ├── competitions.py         # Соревнования, рейтинг
│   │   │   ├── certifications.py       # Аттестации + уведомления
│   │   │   ├── achievements.py         # Ачивки, начисление, таблица лидеров
│   │   │   ├── camps.py                # Сборы
│   │   │   ├── hall_of_fame_routes.py  # Зал Славы
│   │   │   ├── news_routes.py          # Новости (CRUD + автогенерация из БД)
│   │   │   └── news_admin.py           # Новости через YandexGPT
│   │   ├── tasks/
│   │   │   ├── yandex_gpt.py           # YandexGPT клиент, run_competition_news и др.
│   │   │   ├── news_fetcher.py         # Парсинг новостей дворца спорта
│   │   │   └── vk_fetcher.py           # Парсинг ВКонтакте
│   │   └── services/
│   │       └── notifications.py        # Celery задачи, Telegram-рассылка
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx                     # Роутинг (15 страниц)
│   │   ├── pages/
│   │   │   ├── Home.jsx                # Главная, счётчики, карта
│   │   │   ├── About.jsx               # О клубе (7 разделов)
│   │   │   ├── Schedule.jsx            # Расписание
│   │   │   ├── Calendar.jsx            # Интерактивный календарь (FullCalendar)
│   │   │   ├── Champions.jsx           # Зал Славы (публичная)
│   │   │   ├── Apply.jsx               # Запись в клуб
│   │   │   ├── Login.jsx / Register.jsx
│   │   │   ├── Cabinet.jsx             # Главный компонент (~4400 строк):
│   │   │   │                           #   кабинеты parent/athlete/manager/admin
│   │   │   │                           #   вкладки: Люди / События / Результаты / Информация
│   │   │   ├── CompetitionsTab.jsx     # Соревнования, матрица результатов
│   │   │   ├── GroupKids1.jsx          # Группа 6–10 лет
│   │   │   ├── GroupKids2.jsx          # Группа 11–16 лет
│   │   │   ├── GroupAdults.jsx         # Взрослая группа
│   │   │   ├── News.jsx                # Новостная лента
│   │   │   └── Privacy.jsx             # Политика конфиденциальности
│   │   └── components/
│   │       ├── Navbar.jsx              # Навигация с поиском (static index + API events)
│   │       ├── Footer.jsx              # Футер
│   │       ├── ScrollToTop.jsx
│   │       └── TaipanGPT.jsx           # AI-ассистент (FAB-чат)
│   └── nginx.conf                      # SPA-конфиг для React Router
├── nginx/
│   └── nginx.conf                      # Reverse proxy: frontend + /api/ + /static/
├── docker-compose.yml
└── .github/
    └── workflows/
        └── deploy.yml                  # Auto-deploy при push в main
```

---

## Запуск локально

```bash
# 1. Клонировать репозиторий
git clone https://github.com/torviktor/taipan.git
cd taipan

# 2. Настроить переменные окружения
cp .env.example .env
# Отредактировать .env (минимум: TELEGRAM_BOT_TOKEN, YANDEX_API_KEY)

# 3. Запустить
docker compose up -d --build

# 4. Открыть в браузере
# Сайт:      http://localhost
# API:        http://localhost:8000
# Swagger:    http://localhost:8000/docs
```

Первый менеджер — через SQL:
```sql
UPDATE users SET role = 'manager' WHERE phone = '+79999999999';
```

---

## Переменные окружения

| Переменная | Описание | Обязательна |
|---|---|---|
| `DATABASE_URL` | PostgreSQL DSN | ✅ |
| `SECRET_KEY` | Секрет для JWT | ✅ |
| `REDIS_URL` | Redis DSN для Celery | ✅ |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота | ✅ |
| `YANDEX_API_KEY` | Ключ Yandex AI Studio (YandexGPT) | для AI-новостей |
| `YANDEX_FOLDER_ID` | Folder ID Yandex Cloud | для AI-новостей |
| `ANTHROPIC_API_KEY` | Claude API (альтернативный AI) | нет |
| `OPENROUTER_API_KEY` | OpenRouter (TaipanGPT ассистент) | нет |
| `SITE_URL` | Публичный URL сайта | нет |

---

## CI/CD

GitHub Actions автоматически деплоит на сервер при каждом push в ветку `main`:

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]

steps:
  - SSH на сервер (appleboy/ssh-action)
  - cd /opt/taipan && git pull origin main
  - docker compose up -d --build
  - docker image prune -f
```

Секреты в GitHub: `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`.

Обновление только backend или frontend без полной пересборки:
```bash
# Только backend
sudo docker compose build --no-cache backend && sudo docker compose up -d backend

# Только frontend
sudo docker compose build --no-cache frontend && sudo docker compose up -d frontend
```

---

## Скриншоты

| | |
|---|---|
| ![Главная](docs/screenshots/home.png) | ![Кабинет тренера](docs/screenshots/cabinet-manager.png) |
| **Главная страница** — hero, счётчики, группы, тренер, карта | **Кабинет тренера** — вкладки Люди / События / Результаты |
| ![Новости](docs/screenshots/news.png) | ![Мобильная версия](docs/screenshots/mobile.png) |
| **Новостная лента** — авто и ручные новости с фото | **Мобильная версия** — полностью адаптивный дизайн |

---

## Лицензия

Собственность клуба тхэквондо «Тайпан».  
Разработчик: [t.me/TORVIKTOR](https://t.me/TORVIKTOR)

---

<div align="center">
  <strong>🥋 Тайпан · Павловский Посад · taipan-tkd.ru</strong>
</div>
