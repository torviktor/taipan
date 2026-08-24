from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Неверные учётные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = int(payload.get("sub"))
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception

    # Троттлинг: обновляем last_activity_at не чаще раза в 5 минут
    try:
        now = datetime.utcnow()
        last = user.last_activity_at
        if last is None or (now - last) > timedelta(minutes=5):
            user.last_activity_at = now
            db.commit()
    except Exception:
        db.rollback()

    return user

def require_manager(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("manager", "admin"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    return current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Только администратор. Настоящий, без тренеров.

    Заведён после того, как выяснилось: в attendance.py функция с таким же
    именем пускала и менеджера. Одинаковое имя с разным смыслом — заготовка
    для дыры: кто-то напишет Depends(require_admin), будучи уверен, что закрыл
    эндпоинт от тренеров.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    return current_user


# Старшинство ролей. Нужно там, где действие затрагивает ЧУЖУЮ учётную запись:
# сброс пароля, блокировка, восстановление.
ROLE_RANK = {"parent": 0, "athlete": 0, "manager": 1, "admin": 2}


def can_manage_user(actor: User, target: User) -> bool:
    """Вправе ли actor распоряжаться учётной записью target.

    ЗАЧЕМ. Сброс пароля стоял под require_manager без единой проверки цели:
    любой из трёх тренеров мог задать новый пароль администратору и войти под
    ним. Смена роли при этом была закрыта правильно — то есть поднять себе
    роль тренер не мог, а сбросить пароль админа и стать им мог. Обход в одну
    ступень.

    ПРАВИЛО. Действовать можно только над РОЛЬЮ НИЖЕ своей. Администратор —
    исключение: он вправе распоряжаться любой учётной записью, включая другого
    администратора, иначе забытый пароль второго админа станет тупиком.

    Это сохраняет рабочий сценарий: родитель забыл пароль, звонит тренеру,
    тренер сбрасывает. Тренеру закрыты только тренеры и админы — случай,
    которого в обычной работе не бывает.
    """
    a = ROLE_RANK.get(_role_str(actor.role), -1)
    t = ROLE_RANK.get(_role_str(target.role), -1)
    if a == ROLE_RANK["admin"]:
        return True
    return a > t


def _role_str(role) -> str:
    """Роль строкой: в модели это Enum, сравнивать удобнее с текстом."""
    return getattr(role, "value", role) or ""


def ensure_can_manage(actor: User, target: User) -> None:
    """То же, но сразу отвечает 403. Чтобы не повторять if в каждом роуте."""
    if not can_manage_user(actor, target):
        raise HTTPException(
            status_code=403,
            detail="Недостаточно прав: нельзя распоряжаться этой учётной записью",
        )