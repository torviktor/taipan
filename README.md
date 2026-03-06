# 🥋 Тайпан — Сайт клуба тхэквондо

**Спортивный клуб тхэквондо «Тайпан», Павловский Посад**

Полноценный веб-сайт с личным кабинетом, расписанием, заявками и панелью менеджера.

---

## Стек технологий

| Слой | Технология |
|------|-----------|
| Backend | FastAPI (Python 3.11) |
| Frontend | React + Vite |
| БД | PostgreSQL 15 |
| Авторизация | JWT |
| Деплой | Docker + Nginx |
| CI/CD | GitHub Actions |

---

## Структура проекта

```
taipan/
├── backend/          # FastAPI приложение
│   ├── app/
│   │   ├── main.py           # Точка входа
│   │   ├── core/             # Конфиг, БД, безопасность
│   │   ├── models/           # Модели БД
│   │   └── routes/           # API эндпоинты
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/         # React приложение
├── nginx/            # Nginx конфиг
├── docker-compose.yml
└── .github/workflows/deploy.yml
```

---

## API эндпоинты

### Авторизация
| Метод | URL | Описание |
|-------|-----|----------|
| POST | /api/auth/register | Регистрация |
| POST | /api/auth/login | Вход |

### Заявки
| Метод | URL | Описание |
|-------|-----|----------|
| POST | /api/applications/ | Подать заявку (без авторизации) |
| GET | /api/applications/ | Все заявки (менеджер) |
| PATCH | /api/applications/{id}/status | Изменить статус |

### Расписание
| Метод | URL | Описание |
|-------|-----|----------|
| GET | /api/schedule/ | Расписание (публично) |
| GET | /api/schedule/sections | Список секций |
| POST | /api/schedule/ | Добавить занятие (менеджер) |
| DELETE | /api/schedule/{id} | Удалить занятие |

### Пользователи
| Метод | URL | Описание |
|-------|-----|----------|
| GET | /api/users/me | Мой профиль |
| GET | /api/users/ | Все ученики (менеджер) |

### Оплаты
| Метод | URL | Описание |
|-------|-----|----------|
| GET | /api/payments/my | Мои платежи |
| POST | /api/payments/ | Зафиксировать оплату (менеджер) |
| GET | /api/payments/ | Все платежи (менеджер) |

---

## Запуск локально

```bash
# 1. Клонировать репозиторий
git clone https://github.com/ВАШ_НИК/taipan.git
cd taipan

# 2. Запустить через Docker
docker compose up -d --build

# 3. Открыть в браузере
# Сайт:    http://localhost
# API:     http://localhost:8000
# Swagger: http://localhost:8000/docs
```

---

## Деплой на сервер

```bash
# На сервере — первый раз
git clone https://github.com/ВАШ_НИК/taipan.git /opt/taipan
cd /opt/taipan
docker compose up -d --build

# Далее — автоматически через GitHub Actions при пуше в main
```

### Настройка GitHub Actions
В настройках репозитория → Secrets добавить:
- `SERVER_HOST` — IP адрес сервера
- `SERVER_USER` — имя пользователя (обычно root)
- `SERVER_SSH_KEY` — приватный SSH ключ

---

## Роли пользователей

| Роль | Что может |
|------|-----------|
| `student` | Личный кабинет, расписание, история платежей |
| `manager` | Заявки, ученики, расписание, платежи |
| `admin` | Всё |

Первый менеджер создаётся вручную через БД:
```sql
UPDATE users SET role = 'manager' WHERE phone = '+79999999999';
```

---

## Следующие этапы

- [ ] Frontend (React) — главная страница, расписание, форма заявки
- [ ] Личный кабинет ученика
- [ ] Панель менеджера
- [ ] Telegram Mini App
- [ ] Онлайн оплата (ЮКасса)
