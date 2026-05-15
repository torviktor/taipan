"""
ML-проверка качества AI-сгенерированных черновиков новостей.

Применяется в обёртках create_*_news_draft (tasks/yandex_gpt.py)
между вызовом generate_*_news (получение dict от GPT) и
create_event_draft (запись в БД).

Severity:
  - HARD: черновик не должен попасть в БД как есть; вызывающий код
    обязан подменить на fallback-шаблон.
  - SOFT: черновик создаётся, но с пометкой needs_review=True;
    тренер видит бейдж "Требует проверки" в кабинете.
  - OK: всё чисто, черновик создаётся как обычный.

Управляется флагом settings.NEWS_QUALITY_CHECK_ENABLED. Если выключен —
validate_generated_news возвращает OK без проверок.
"""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field
from typing import Literal, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.user import Athlete

log = logging.getLogger(__name__)

Severity = Literal["ok", "soft", "hard"]
Mode = Literal["anons", "report"]

# ── пороги ────────────────────────────────────────────────────────────
TITLE_MIN = 15
TITLE_MAX = 200
BODY_MIN_ANONS = 200
BODY_MIN_REPORT = 300
BODY_HARD_FLOOR = 100  # ниже этого — HARD-fail независимо от режима
MIN_PARAGRAPH = 50      # хотя бы один абзац такой длины

# ── паттерны плейсхолдеров (HARD при срабатывании) ────────────────────
PLACEHOLDER_PATTERNS = [
    re.compile(r"\{[a-zA-Z_][a-zA-Z0-9_]*\}"),   # утёкшие {name}, {date}
    re.compile(r"<[а-яА-ЯёЁa-zA-Z][^>]{2,40}>"), # <тренер дополняет>
    re.compile(r"\[(название|вставьте|укажите|TODO|TBD|XXX)\]", re.IGNORECASE),
    re.compile(r"\bздесь\s+ваш\s+текст\b", re.IGNORECASE),
    re.compile(r"\bваш\s+текст\s+здесь\b", re.IGNORECASE),
    re.compile(r"\bтренер\s+дополня(ет|ить)\b", re.IGNORECASE),
    re.compile(r"\bтекст\s+будет\s+добавлен\b", re.IGNORECASE),
    re.compile(r"\.{4,}"),                       # длинные многоточия
]

# ── паттерны мягких подозрений (SOFT) ─────────────────────────────────
SOFT_PATTERNS = [
    re.compile(r"как\s+(гласит|известно|сообщают)\b", re.IGNORECASE),
    re.compile(r"\bпо\s+слухам\b", re.IGNORECASE),
]

# ── имена: «слово с заглавной кириллической буквы длиной ≥4» ──────────
CAPWORD_RE = re.compile(r"[А-ЯЁ][а-яё]{3,}")

# Топонимы / события / месяцы, которые НЕ имена — исключаем из проверки.
NAME_STOPWORDS = {
    # топонимы
    "москва","московская","подмосковье","россия","российский","российской",
    "тула","тульская","клуб","тайпан","павловский","посад","посаде",
    "санкт","петербург","ленинградская","область","области","город",
    # календарь
    "январь","февраль","март","апрель","май","июнь","июль","август",
    "сентябрь","октябрь","ноябрь","декабрь",
    "января","февраля","марта","апреля","мая","июня","июля","августа",
    "сентября","октября","ноября","декабря",
    "понедельник","вторник","среда","четверг","пятница","суббота","воскресенье",
    # терминология тхэквондо
    "тхэквондо","спарринг","туль","стопбол","тегтим","даны","дан",
    "гыпы","гып","аттестация","аттестации","соревнование","соревнования",
    "первенство","чемпионат","кубок","турнир","сборы","сбор",
    "медаль","медали","медалист","золото","серебро","бронза",
    "детская","юношеская","юниорская","взрослая","категория","категории",
    # организации
    "гтф","фткр","сфо","цфо","итф",
}

# ── кеш словаря фамилий ────────────────────────────────────────────────
_surnames_cache: set[str] = set()
_surnames_cache_ts: float = 0.0
_SURNAMES_TTL = 300  # 5 минут


def _load_surnames(db: Session) -> set[str]:
    """Множество фамилий (первое слово full_name, в lowercase)."""
    rows = db.query(Athlete.full_name).all()
    out: set[str] = set()
    for (full_name,) in rows:
        if not full_name:
            continue
        parts = full_name.strip().split()
        if not parts:
            continue
        out.add(parts[0].lower())
    return out


def _get_surnames() -> set[str]:
    """Кешированный словарь фамилий. Fail-open при ошибке БД."""
    global _surnames_cache, _surnames_cache_ts
    now = time.time()
    if _surnames_cache and (now - _surnames_cache_ts) < _SURNAMES_TTL:
        return _surnames_cache
    db = SessionLocal()
    try:
        _surnames_cache = _load_surnames(db)
        _surnames_cache_ts = now
        return _surnames_cache
    except Exception:
        log.exception("news_quality: failed to load surnames, fail-open")
        return _surnames_cache  # вернём то, что есть (возможно пусто)
    finally:
        db.close()


@dataclass
class ValidationResult:
    severity: Severity = "ok"
    issues: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return self.severity == "ok"

    @property
    def needs_review(self) -> bool:
        return self.severity == "soft"

    @property
    def is_hard_fail(self) -> bool:
        return self.severity == "hard"

    def _bump(self, level: Severity) -> None:
        order = {"ok": 0, "soft": 1, "hard": 2}
        if order[level] > order[self.severity]:
            self.severity = level

    def add(self, level: Severity, msg: str) -> None:
        self.issues.append(f"[{level.upper()}] {msg}")
        self._bump(level)


def _check_lengths(title: str, body: str, mode: Mode, r: ValidationResult) -> None:
    tlen = len(title.strip()) if title else 0
    blen = len(body.strip()) if body else 0

    if tlen == 0:
        r.add("hard", "title пустой")
    elif tlen < TITLE_MIN:
        r.add("soft", f"title слишком короткий ({tlen} < {TITLE_MIN})")
    elif tlen > TITLE_MAX:
        r.add("soft", f"title слишком длинный ({tlen} > {TITLE_MAX})")

    if blen == 0:
        r.add("hard", "body пустой")
    elif blen < BODY_HARD_FLOOR:
        r.add("hard", f"body катастрофически короткий ({blen} < {BODY_HARD_FLOOR})")
    else:
        floor = BODY_MIN_REPORT if mode == "report" else BODY_MIN_ANONS
        if blen < floor:
            r.add("soft", f"body короче порога для {mode} ({blen} < {floor})")


def _check_placeholders(title: str, body: str, r: ValidationResult) -> None:
    combined = f"{title}\n{body}"
    for pat in PLACEHOLDER_PATTERNS:
        m = pat.search(combined)
        if m:
            r.add("hard", f"найден плейсхолдер/заглушка: {m.group(0)!r}")
            return  # достаточно одного

    for pat in SOFT_PATTERNS:
        m = pat.search(combined)
        if m:
            r.add("soft", f"подозрительная формулировка: {m.group(0)!r}")
            return


def _check_paragraph_structure(body: str, r: ValidationResult) -> None:
    if not body:
        return
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    if not paragraphs:
        r.add("hard", "body не содержит абзацев")
        return
    if max(len(p) for p in paragraphs) < MIN_PARAGRAPH:
        r.add("soft", f"нет ни одного абзаца длиннее {MIN_PARAGRAPH} символов")


def _check_names(body: str, event_name: Optional[str], r: ValidationResult) -> None:
    """
    Только для report-режимов. Имена в anons по унификации Сессии 10 не
    появляются — туда эта функция не вызывается.
    """
    surnames = _get_surnames()
    if not surnames:
        # БД недоступна или пуста — не блокируем
        return

    # слова из event_name не считаем подозрительными
    event_words: set[str] = set()
    if event_name:
        for w in CAPWORD_RE.findall(event_name):
            event_words.add(w.lower())

    found_caps = CAPWORD_RE.findall(body)
    suspicious: list[str] = []
    seen: set[str] = set()

    for word in found_caps:
        lw = word.lower()
        if lw in seen:
            continue
        seen.add(lw)
        if lw in NAME_STOPWORDS:
            continue
        if lw in event_words:
            continue
        # проверка по фамилии с учётом склонений: совпадение по началу
        # длиной не короче 4 символов в обе стороны.
        hit = False
        for surname in surnames:
            common = 0
            for a, b in zip(lw, surname):
                if a == b:
                    common += 1
                else:
                    break
            if common >= max(4, min(len(surname), 5)):
                hit = True
                break
        if not hit:
            suspicious.append(word)

    if suspicious:
        # ограничим вывод первыми 5
        sample = ", ".join(suspicious[:5])
        more = f" и ещё {len(suspicious)-5}" if len(suspicious) > 5 else ""
        r.add("soft", f"возможно выдуманные имена: {sample}{more}")


def validate_generated_news(
    title: str,
    body: str,
    *,
    mode: Mode,
    event_name: Optional[str] = None,
) -> ValidationResult:
    """
    Главная точка входа. Безопасна к любым входам (None, пустые строки).

    Любая внутренняя ошибка валидатора → возвращаем OK + лог exception.
    Принцип fail-open: лучше пропустить сомнительный черновик, чем
    потерять весь GPT-результат из-за бага в эвристике.
    """
    r = ValidationResult()

    if not settings.NEWS_QUALITY_CHECK_ENABLED:
        return r

    title = title or ""
    body = body or ""

    try:
        _check_lengths(title, body, mode, r)
        _check_placeholders(title, body, r)
        _check_paragraph_structure(body, r)
        if mode == "report":
            _check_names(body, event_name, r)
    except Exception:
        log.exception("news_quality: validator crashed, fail-open")
        return ValidationResult()  # чистый OK

    if not r.ok:
        log.info(
            "news_quality: mode=%s severity=%s issues=%s",
            mode, r.severity, r.issues,
        )
    return r
