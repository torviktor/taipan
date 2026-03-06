from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Event(Base):
    """
    Событие в календаре клуба.
    Создаётся администратором, видно всем подписанным пользователям.
    """
    __tablename__ = "events"

    id          = Column(Integer, primary_key=True, index=True)
    title       = Column(String(300), nullable=False)        # Название события
    description = Column(Text, nullable=True)                # Описание
    event_date  = Column(DateTime, nullable=False)           # Дата и время события
    location    = Column(String(300), nullable=True)         # Место проведения
    section_id  = Column(Integer, ForeignKey("sections.id"), nullable=True)  # Секция (опционально)
    created_by  = Column(Integer, ForeignKey("users.id"))    # Кто создал
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active   = Column(Boolean, default=True)

    # Настройки уведомлений
    # Пример: [1, 3, 7] — уведомить за 1, 3 и 7 дней до события
    notify_before_days = Column(JSON, default=list)          # список дней
    notify_everyone    = Column(Boolean, default=True)       # уведомить всех подписанных

    section      = relationship("Section", foreign_keys=[section_id])
    creator      = relationship("User", foreign_keys=[created_by])
    reminders    = relationship("EventReminder", back_populates="event", cascade="all, delete-orphan")


class EventReminder(Base):
    """
    Запись о том что напоминание было отправлено.
    Нужно чтобы не отправлять одно и то же дважды.
    """
    __tablename__ = "event_reminders"

    id         = Column(Integer, primary_key=True)
    event_id   = Column(Integer, ForeignKey("events.id"))
    days_before = Column(Integer)                            # За сколько дней отправлено
    sent_at    = Column(DateTime, default=datetime.utcnow)
    sent_count = Column(Integer, default=0)                  # Сколько человек получили

    event = relationship("Event", back_populates="reminders")


class TelegramSubscriber(Base):
    """
    Пользователи подписавшиеся на уведомления через Telegram бота.
    """
    __tablename__ = "telegram_subscribers"

    id          = Column(Integer, primary_key=True)
    telegram_id = Column(String(50), unique=True, nullable=False)  # chat_id из Telegram
    username    = Column(String(100), nullable=True)
    full_name   = Column(String(200), nullable=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=True)  # Связь с аккаунтом
    subscribed  = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])


class PushSubscriber(Base):
    """
    Подписки на Web Push уведомления в браузере.
    """
    __tablename__ = "push_subscribers"

    id           = Column(Integer, primary_key=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=True)
    subscription = Column(Text, nullable=False)   # JSON строка с endpoint и ключами
    created_at   = Column(DateTime, default=datetime.utcnow)
    is_active    = Column(Boolean, default=True)

    user = relationship("User", foreign_keys=[user_id])
