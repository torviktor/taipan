from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter()

# ─── Метаданные методичек и программ ──────────────────────────────────────────
# На этом этапе контент — заглушки. Реальный текст будет загружаться на этапах 4–5.

METHODS_META = [
    {"slug": "beginner", "title": "Для начинающих", "subtitle": "10–8 гып"},
    {"slug": "7-5",      "title": "7–5 гып",         "subtitle": "жёлтый — синий"},
    {"slug": "4-3",      "title": "4–3 гып",         "subtitle": "синий — красный"},
    {"slug": "2-1",      "title": "2–1 гып",         "subtitle": "красный — чёрный"},
    {"slug": "itf",      "title": "Большое пособие ИТФ", "subtitle": "все гыпы"},
]

VALID_METHOD_SLUGS = {m["slug"] for m in METHODS_META}

PLANS_META = [
    {"gup": 10, "title": "10 гып", "subtitle": "белый пояс"},
    {"gup": 9,  "title": "9 гып",  "subtitle": "белый с жёлтой полосой"},
    {"gup": 8,  "title": "8 гып",  "subtitle": "жёлтый"},
    {"gup": 7,  "title": "7 гып",  "subtitle": "жёлтый с зелёной полосой"},
    {"gup": 6,  "title": "6 гып",  "subtitle": "зелёный"},
]

VALID_PLAN_GUPS = {p["gup"] for p in PLANS_META}


# ─── Guard: только активные члены клуба ──────────────────────────────────────
def require_active_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Архивные пользователи не должны видеть закрытый раздел.
    is_active = False означает заархивированного спортсмена или родителя
    архивного спортсмена, потерявшего доступ.
    """
    if not current_user.is_active:
        raise HTTPException(status_code=403, detail="Доступ закрыт")
    return current_user


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/preparation/methods")
def list_methods(_: User = Depends(require_active_user)):
    """Список всех методичек (только мета — для меню/навигации)."""
    return METHODS_META


@router.get("/preparation/method/{slug}")
def get_method(slug: str, _: User = Depends(require_active_user)):
    """Содержимое конкретной методички."""
    if slug not in VALID_METHOD_SLUGS:
        raise HTTPException(status_code=404, detail="Методичка не найдена")
    meta = next(m for m in METHODS_META if m["slug"] == slug)
    return {
        "slug":    slug,
        "title":   meta["title"],
        "status":  "draft",
        "content": None,
    }


@router.get("/preparation/plans")
def list_plans(_: User = Depends(require_active_user)):
    """Список всех программ 30 дней (только мета)."""
    return PLANS_META


@router.get("/preparation/plan/{gup}")
def get_plan(gup: int, _: User = Depends(require_active_user)):
    """Содержимое конкретной программы 30 дней."""
    if gup not in VALID_PLAN_GUPS:
        raise HTTPException(status_code=404, detail="Программа не найдена")
    meta = next(p for p in PLANS_META if p["gup"] == gup)
    return {
        "gup":     gup,
        "title":   meta["title"],
        "status":  "draft",
        "content": None,
    }
