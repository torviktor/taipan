from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.database import engine, Base
from app.routes import auth, applications, schedule, users, payments
from app.routes import events, telegram
from app.routes.ai import router as ai_router
from app.routes.attendance import router as attendance_router
from app.routes.competitions import router as competitions_router
from app.models import user, event, attendance, competition

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Тайпан API",
    description="API клуба тхэквондо Тайпан",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,              prefix="/api/auth",         tags=["Авторизация"])
app.include_router(users.router,             prefix="/api/users",        tags=["Пользователи"])
app.include_router(applications.router,      prefix="/api/applications", tags=["Заявки"])
app.include_router(schedule.router,          prefix="/api/schedule",     tags=["Расписание"])
app.include_router(payments.router,          prefix="/api/payments",     tags=["Оплата"])
app.include_router(events.router,            prefix="/api/events",       tags=["Календарь"])
app.include_router(telegram.router,          prefix="/api/telegram",     tags=["Telegram"])
app.include_router(ai_router,                prefix="/api",              tags=["AI"])
app.include_router(attendance_router,        prefix="/api",              tags=["Посещаемость"])
app.include_router(competitions_router,      prefix="/api",              tags=["Соревнования"])

@app.get("/")
def root():
    return {"message": "Тайпан API работает ✅"}
