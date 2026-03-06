from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.routes import auth, applications, schedule, users, payments

# Создаём все таблицы при старте
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Тайпан API",
    description="API для сайта клуба тхэквондо Тайпан, Павловский Посад",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшне заменить на домен
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,         prefix="/api/auth",         tags=["Авторизация"])
app.include_router(users.router,        prefix="/api/users",        tags=["Пользователи"])
app.include_router(applications.router, prefix="/api/applications", tags=["Заявки"])
app.include_router(schedule.router,     prefix="/api/schedule",     tags=["Расписание"])
app.include_router(payments.router,     prefix="/api/payments",     tags=["Оплата"])

@app.get("/")
def root():
    return {"message": "Тайпан API работает ✅"}
