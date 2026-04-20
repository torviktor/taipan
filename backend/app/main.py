from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.database import engine, Base, SessionLocal
from app.routes import auth, applications, schedule, users, payments
from app.routes import events, telegram
from app.routes.ai import router as ai_router
from app.routes.attendance import router as attendance_router
from app.routes.competitions import router as competitions_router
from app.routes.certifications import router as certifications_router, notif_router as notifications_router
from app.routes.achievements import router as achievements_router
from app.routes.camps import router as camps_router
from app.routes.hall_of_fame_routes import router as hof_router
from app.routes.news_routes import router as news_router
from app.routes.news_admin import router as news_admin_router
from app.routes.insurance_strategy import router as insurance_strategy_router
from app.routes.analytics import router as analytics_router
from app.routes.competition_files import router as competition_files_router
from app.routes.fees import router as fees_router
from app.models import user, event, attendance, competition, certification, achievement, camp
from app.models import hall_of_fame, analytics, news, competition_file
from app.models import fees as fees_model
from app.models import individual_training
from app.models import invite as invite_model
from app.routes.individual_training import router as individual_training_router
from app.routes.invite import router as invite_router
import os

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Тайпан API",
    description="API клуба тхэквондо Тайпан",
    version="1.0.0"
)

app.state.limiter = auth.limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://taipan-tkd.ru"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("/app/static/hall-of-fame", exist_ok=True)
os.makedirs("/app/static/analytics", exist_ok=True)
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
app.include_router(insurance_strategy_router, prefix="/api", tags=["Страховка и стратегия"])
app.include_router(analytics_router,          prefix="/api", tags=["Аналитика"])
app.include_router(competition_files_router,  prefix="/api", tags=["Файлы соревнований"])
app.include_router(news_router,       prefix="/api", tags=["Новости"])
app.include_router(news_admin_router,  prefix="/api", tags=["Новости Admin"])
app.include_router(hof_router,               prefix="/api",              tags=["Зал Славы"])
app.include_router(fees_router,              prefix="/api/fees",         tags=["fees"])
app.include_router(individual_training_router, prefix="/api",            tags=["Индивидуальные тренировки"])
app.include_router(invite_router,              prefix="/api",            tags=["Приглашения"])

@app.on_event("startup")
async def ensure_season_best_slots():
    db = SessionLocal()
    try:
        from app.models.hall_of_fame import HallOfFame
        senior = db.query(HallOfFame).filter(HallOfFame.season_best_senior == True).first()
        if not senior:
            db.add(HallOfFame(
                full_name="Лучший спортсмен сезона",
                achievements="Старшая группа",
                sort_order=-2,
                season_best_senior=True,
                is_featured=False,
            ))
        junior = db.query(HallOfFame).filter(HallOfFame.season_best_junior == True).first()
        if not junior:
            db.add(HallOfFame(
                full_name="Лучший спортсмен сезона",
                achievements="Младшая группа",
                sort_order=-1,
                season_best_junior=True,
                is_featured=False,
            ))
        db.commit()
    except Exception as e:
        print(f"Season best slots error: {e}")
    finally:
        db.close()


@app.get("/health")
def health():
    return JSONResponse({"status": "ok"})

@app.get("/")
def root():
    return {"message": "Тайпан API работает ✅"}
