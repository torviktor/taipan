from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.database import engine, Base
from app.routes import auth, applications, schedule, users, payments
from app.routes import events, telegram
from app.routes.ai import router as ai_router
from app.routes.attendance import router as attendance_router
from app.routes.competitions import router as competitions_router
from app.routes.certifications import router as certifications_router, notif_router as notifications_router
from app.routes.achievements import router as achievements_router
from app.routes.camps import router as camps_router
from app.routes.hall_of_fame_routes import router as hof_router
from app.routes.analytics import router as analytics_router          
from app.models import user, event, attendance, competition, certification, achievement, camp
from app.models import hall_of_fame, analytics                       
from app.models import news
from app.routes.news_routes import router as news_router
from app.routes.news_admin import router as news_admin_router
from app.models import competition_file
from app.routes.competition_files import router as competition_files_router
import os

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

os.makedirs("/app/static/hall-of-fame", exist_ok=True)
os.makedirs("/app/static/news", exist_ok=True)
app.mount("/static", StaticFiles(directory="/app/static"), name="static")

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
app.include_router(certifications_router,    prefix="/api",              tags=["Аттестация"])
app.include_router(notifications_router,     prefix="/api",              tags=["Уведомления"])
app.include_router(achievements_router,      prefix="/api",              tags=["Ачивки"])
app.include_router(camps_router,             prefix="/api",              tags=["Сборы"])
app.include_router(hof_router,               prefix="/api",              tags=["Зал Славы"])
app.include_router(analytics_router,         prefix="/api",              tags=["Аналитика"])
app.include_router(news_router,              prefix="/api",              tags=["Новости"])
app.include_router(news_admin_router,        prefix="/api",              tags=["Новости-Админ"])
app.include_router(competition_files_router, prefix="/api")

@app.get("/")
def root():
    return {"message": "Тайпан API работает ✅"}
