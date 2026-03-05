from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Text, Numeric, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
import enum

# ─── Роли пользователей ───────────────────────────────────────────────────────
class UserRole(str, enum.Enum):
    student  = "student"   # Ученик
    manager  = "manager"   # Менеджер / тренер
    admin    = "admin"     # Администратор

# ─── Пользователь ─────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id           = Column(Integer, primary_key=True, index=True)
    full_name    = Column(String(200), nullable=False)
    phone        = Column(String(20), unique=True, nullable=False)
    email        = Column(String(200), unique=True, nullable=True)
    password     = Column(String(300), nullable=False)
    role         = Column(Enum(UserRole), default=UserRole.student)
    age          = Column(Integer, nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)
    is_active    = Column(Boolean, default=True)

    applications = relationship("Application", back_populates="user")
    payments     = relationship("Payment", back_populates="user")

# ─── Секции клуба ─────────────────────────────────────────────────────────────
class Section(Base):
    __tablename__ = "sections"

    id          = Column(Integer, primary_key=True)
    name        = Column(String(100), nullable=False)   # Например: "Дети 6-10 лет"
    description = Column(Text, nullable=True)
    price       = Column(Numeric(10, 2), nullable=True) # Цена абонемента

    schedule     = relationship("Schedule", back_populates="section")
    applications = relationship("Application", back_populates="section")

# ─── Расписание ───────────────────────────────────────────────────────────────
class Schedule(Base):
    __tablename__ = "schedule"

    id         = Column(Integer, primary_key=True)
    section_id = Column(Integer, ForeignKey("sections.id"))
    day_of_week = Column(Integer, nullable=False)  # 0=Пн, 1=Вт, ... 6=Вс
    time_start  = Column(String(5), nullable=False) # "10:00"
    time_end    = Column(String(5), nullable=False) # "11:30"
    trainer     = Column(String(200), nullable=True)
    location    = Column(String(300), nullable=True) # Зал / адрес

    section = relationship("Section", back_populates="schedule")

# ─── Заявки на запись ─────────────────────────────────────────────────────────
class ApplicationStatus(str, enum.Enum):
    new        = "new"        # Новая
    processing = "processing" # В обработке
    confirmed  = "confirmed"  # Подтверждена
    rejected   = "rejected"   # Отклонена

class Application(Base):
    __tablename__ = "applications"

    id           = Column(Integer, primary_key=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=True)  # Может быть без регистрации
    section_id   = Column(Integer, ForeignKey("sections.id"), nullable=True)
    full_name    = Column(String(200), nullable=False)  # Дублируем для незарегистрированных
    phone        = Column(String(20), nullable=False)
    age          = Column(Integer, nullable=True)
    comment      = Column(Text, nullable=True)
    status       = Column(Enum(ApplicationStatus), default=ApplicationStatus.new)
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user    = relationship("User", back_populates="applications")
    section = relationship("Section", back_populates="applications")

# ─── Оплаты ───────────────────────────────────────────────────────────────────
class PaymentStatus(str, enum.Enum):
    pending  = "pending"   # Ожидает
    paid     = "paid"      # Оплачено
    failed   = "failed"    # Ошибка
    refunded = "refunded"  # Возврат

class Payment(Base):
    __tablename__ = "payments"

    id          = Column(Integer, primary_key=True)
    user_id     = Column(Integer, ForeignKey("users.id"))
    amount      = Column(Numeric(10, 2), nullable=False)
    description = Column(String(300), nullable=True)  # "Абонемент январь 2025"
    status      = Column(Enum(PaymentStatus), default=PaymentStatus.pending)
    created_at  = Column(DateTime, default=datetime.utcnow)
    paid_at     = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="payments")
