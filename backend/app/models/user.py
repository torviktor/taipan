from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Text, Numeric, Boolean, Date
from sqlalchemy.orm import relationship
from datetime import datetime, date
from app.core.database import Base
import enum

# ─── Роли пользователей ───────────────────────────────────────────────────────
class UserRole(str, enum.Enum):
    parent   = "parent"   # Родитель
    athlete  = "athlete"  # Взрослый спортсмен
    manager  = "manager"  # Тренер
    admin    = "admin"    # Администратор

# ─── Пол ──────────────────────────────────────────────────────────────────────
class Gender(str, enum.Enum):
    male   = "male"
    female = "female"

# ─── Пользователь ─────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id           = Column(Integer, primary_key=True, index=True)
    full_name    = Column(String(200), nullable=False)
    phone        = Column(String(20), unique=True, nullable=False)
    email        = Column(String(200), unique=True, nullable=True)
    password     = Column(String(300), nullable=False)
    role           = Column(Enum(UserRole), default=UserRole.parent)
    created_at     = Column(DateTime, default=datetime.utcnow)
    is_active      = Column(Boolean, default=True)
    strategy_items = Column(Text, default='[]')
    last_login_at    = Column(DateTime, nullable=True)
    last_activity_at = Column(DateTime, nullable=True)
    manager_group  = Column(String(20), nullable=True)
    # manager_group: 'junior' = только младшая, 'senior' = старшая + взрослые, None = все (admin)

    athletes     = relationship("Athlete", back_populates="user", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="user")
    payments     = relationship("Payment", back_populates="user")

# ─── Спортсмен (данные участника клуба) ───────────────────────────────────────
class Athlete(Base):
    __tablename__ = "athletes"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False)

    full_name    = Column(String(200), nullable=False)
    birth_date   = Column(Date, nullable=False)
    gender       = Column(Enum(Gender), nullable=False)
    gup          = Column(Integer, nullable=True)
    dan          = Column(Integer, nullable=True)

    weight       = Column(Numeric(5, 2), nullable=True)
    group        = Column(String(100), nullable=True)
    is_archived  = Column(Boolean, default=False, nullable=False)
    insurance_expiry = Column(Date, nullable=True)
    archived_at  = Column(DateTime, nullable=True)

    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user               = relationship("User", back_populates="athletes")
    attendance_records = relationship("Attendance", back_populates="athlete")
    competition_results = relationship(
        "CompetitionResult",
        back_populates="athlete",
        cascade="all, delete-orphan"
    )
    certification_results = relationship(
        "CertificationResult",
        back_populates="athlete",
        cascade="all, delete-orphan"
    )
    achievements = relationship(
        "AthleteAchievement",
        back_populates="athlete",
        cascade="all, delete-orphan"
    )
    camp_participations = relationship(
        "CampParticipant",
        back_populates="athlete",
        cascade="all, delete-orphan"
    )

    @property
    def age(self) -> int:
        today = date.today()
        b = self.birth_date
        return today.year - b.year - ((today.month, today.day) < (b.month, b.day))

    @property
    def auto_group(self) -> str:
        a = self.age
        if a <= 10:
            return "Младшая группа (6–10 лет)"
        elif a <= 17:
            return "Старшая группа (11+)"
        else:
            return "Взрослые (18+)"

# ─── Секции клуба ─────────────────────────────────────────────────────────────
class Section(Base):
    __tablename__ = "sections"

    id          = Column(Integer, primary_key=True)
    name        = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    price       = Column(Numeric(10, 2), nullable=True)

    schedule     = relationship("Schedule", back_populates="section")
    applications = relationship("Application", back_populates="section")

# ─── Расписание ───────────────────────────────────────────────────────────────
class Schedule(Base):
    __tablename__ = "schedule"

    id          = Column(Integer, primary_key=True)
    section_id  = Column(Integer, ForeignKey("sections.id"))
    day_of_week = Column(Integer, nullable=False)
    time_start  = Column(String(5), nullable=False)
    time_end    = Column(String(5), nullable=False)
    trainer     = Column(String(200), nullable=True)
    location    = Column(String(300), nullable=True)

    section = relationship("Section", back_populates="schedule")

# ─── Заявки на запись ─────────────────────────────────────────────────────────
class ApplicationStatus(str, enum.Enum):
    new        = "new"
    processing = "processing"
    confirmed  = "confirmed"
    rejected   = "rejected"

class Application(Base):
    __tablename__ = "applications"

    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=True)
    full_name  = Column(String(200), nullable=False)
    phone      = Column(String(20), nullable=False)
    age        = Column(Integer, nullable=True)
    comment    = Column(Text, nullable=True)
    status     = Column(Enum(ApplicationStatus), default=ApplicationStatus.new)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user    = relationship("User", back_populates="applications")
    section = relationship("Section", back_populates="applications")

# ─── Оплаты ───────────────────────────────────────────────────────────────────
class PaymentStatus(str, enum.Enum):
    pending  = "pending"
    paid     = "paid"
    failed   = "failed"
    refunded = "refunded"

class Payment(Base):
    __tablename__ = "payments"

    id          = Column(Integer, primary_key=True)
    user_id     = Column(Integer, ForeignKey("users.id"))
    amount      = Column(Numeric(10, 2), nullable=False)
    description = Column(String(300), nullable=True)
    status      = Column(Enum(PaymentStatus), default=PaymentStatus.pending)
    created_at  = Column(DateTime, default=datetime.utcnow)
    paid_at     = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="payments")
