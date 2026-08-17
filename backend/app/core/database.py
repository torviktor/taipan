from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# pool_pre_ping — проверяет соединение перед выдачей из пула: после рестарта
# postgres в пуле остаются мёртвые сокеты, и первый же запрос падал бы с
# OperationalError «server closed the connection unexpectedly».
# pool_recycle=280 — пересоздаём соединение раньше типового таймаута в 300 с.
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=280,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
