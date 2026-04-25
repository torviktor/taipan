from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
from app.core.database import get_db
from app.core.security import get_current_user, require_manager, hash_password
from app.models.user import User, Athlete, Gender

router = APIRouter()

# ─── Схемы ────────────────────────────────────────────────────────────────────
class UserOut(BaseModel):
    id:            int
    full_name:     str
    phone:         str
    email:         Optional[str]
    role:          str
    created_at:    datetime
    manager_group: Optional[str] = None
    class Config:
        from_attributes = True

class ManagerGroupBody(BaseModel):
    manager_group: Optional[str] = None  # 'junior' | 'senior' | None

class AthleteOut(BaseModel):
    id:           int
    user_id:      int
    full_name:    str
    birth_date:   date
    gender:       Gender
    gup:          Optional[int]
    dan:          Optional[int]
    weight:       Optional[float]
    group:        Optional[str]
    age:          Optional[int]
    auto_group:   Optional[str]
    parent_name:  Optional[str]
    parent_phone: Optional[str]
    is_archived:  bool = False
    class Config:
        from_attributes = True

class AthleteUpdate(BaseModel):
    weight: Optional[float] = None
    group:  Optional[str]   = None
    gup:    Optional[int]   = None
    dan:    Optional[int]   = None

class ResetPasswordRequest(BaseModel):
    new_password: str

# ─── Вспомогательная функция ──────────────────────────────────────────────────
def build_athlete_out(a: Athlete) -> dict:
    today = date.today()
    b = a.birth_date
    age = today.year - b.year - ((today.month, today.day) < (b.month, b.day))
    return {
        "id": a.id, "user_id": a.user_id, "full_name": a.full_name,
        "birth_date": str(a.birth_date), "gender": a.gender,
        "gup": a.gup, "dan": a.dan,
        "weight": float(a.weight) if a.weight else None,
        "group": a.group, "age": age, "auto_group": a.auto_group,
        "parent_name": a.user.full_name, "parent_phone": a.user.phone,
        "is_archived": bool(getattr(a, 'is_archived', False)),
    }

# ─── Мой профиль ──────────────────────────────────────────────────────────────
@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# ─── Выбор своей группы менеджером ───────────────────────────────────────────
@router.patch("/me/group")
def set_manager_group(
    body: ManagerGroupBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    if body.manager_group not in (None, 'junior', 'senior'):
        raise HTTPException(400, "manager_group должен быть 'junior', 'senior' или null")
    current_user.manager_group = body.manager_group
    db.add(current_user)
    db.commit()
    return {"ok": True, "manager_group": current_user.manager_group}

# ─── МОИ спортсмены — свои дети + просматриваемые по инвайту ─────────────────
@router.get("/my-athletes")
def get_my_athletes(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.invite import AthleteViewer

    own = db.query(Athlete).filter(
        Athlete.user_id == current_user.id,
        Athlete.is_archived == False,
    ).all()
    result = []
    for a in own:
        out = build_athlete_out(a)
        out["is_viewer"] = False
        result.append(out)

    viewers = db.query(AthleteViewer).filter(
        AthleteViewer.viewer_id == current_user.id
    ).all()
    seen_ids = {a.id for a in own}
    for v in viewers:
        if v.athlete_id in seen_ids:
            continue
        athlete = db.query(Athlete).filter(
            Athlete.id == v.athlete_id,
            Athlete.is_archived == False,
        ).first()
        if athlete:
            out = build_athlete_out(athlete)
            out["is_viewer"] = True
            result.append(out)
            seen_ids.add(athlete.id)

    return result

# ─── Все пользователи (только admin/manager) ──────────────────────────────────
@router.get("/", response_model=List[UserOut])
def get_all_users(db: Session = Depends(get_db), _: User = Depends(require_manager)):
    return db.query(User).order_by(User.created_at.desc()).all()

# ─── Приглашённые пользователи (viewers) — admin/manager ─────────────────────
@router.get("/viewers")
def get_viewers(db: Session = Depends(get_db), _: User = Depends(require_manager)):
    from app.models.invite import AthleteViewer
    rows = db.query(AthleteViewer).all()
    result = []
    for v in rows:
        viewer = db.query(User).filter(User.id == v.viewer_id).first()
        athlete = db.query(Athlete).filter(Athlete.id == v.athlete_id).first()
        if not viewer or not athlete:
            continue
        primary_parent = db.query(User).filter(User.id == athlete.user_id).first()
        result.append({
            "viewer_id":           viewer.id,
            "viewer_name":         viewer.full_name,
            "viewer_phone":        viewer.phone,
            "viewer_email":        viewer.email,
            "viewer_created_at":   viewer.created_at.isoformat() if viewer.created_at else None,
            "athlete_id":          athlete.id,
            "athlete_name":        athlete.full_name,
            "primary_parent_id":   primary_parent.id if primary_parent else None,
            "primary_parent_name": primary_parent.full_name if primary_parent else "—",
            "granted_at":          v.created_at.isoformat() if v.created_at else None,
            "last_login_at":       viewer.last_login_at.isoformat() if viewer.last_login_at else None,
            "last_activity_at":    viewer.last_activity_at.isoformat() if viewer.last_activity_at else None,
            "viewer_is_active":    bool(getattr(viewer, "is_active", True)),
        })
    result.sort(key=lambda x: x["granted_at"] or "", reverse=True)
    return result


@router.delete("/viewers/{viewer_id}/athlete/{athlete_id}")
def revoke_viewer_access(
    viewer_id: int, athlete_id: int,
    db: Session = Depends(get_db), _: User = Depends(require_manager)
):
    from app.models.invite import AthleteViewer
    rows = db.query(AthleteViewer).filter(
        AthleteViewer.viewer_id == viewer_id,
        AthleteViewer.athlete_id == athlete_id,
    ).all()
    if not rows:
        raise HTTPException(404, "Связь не найдена")
    for r in rows:
        db.delete(r)
    db.commit()
    return {"ok": True}


# ─── Все спортсмены (только admin/manager) ────────────────────────────────────
@router.get("/athletes")
def get_athletes(db: Session = Depends(get_db), _: User = Depends(require_manager)):
    athletes = (
        db.query(Athlete)
        .join(User, Athlete.user_id == User.id)
        .filter(Athlete.is_archived == False)
        .all()
    )
    return [build_athlete_out(a) for a in athletes]

# ─── Обновить спортсмена (только admin/manager) ───────────────────────────────
@router.patch("/athletes/{athlete_id}")
def update_athlete(
    athlete_id: int, data: AthleteUpdate,
    db: Session = Depends(get_db), _: User = Depends(require_manager)
):
    a = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Спортсмен не найден")
    if data.weight is not None: a.weight = data.weight
    if data.group  is not None: a.group  = data.group
    if data.gup    is not None: a.gup    = data.gup
    if data.dan    is not None: a.dan    = data.dan
    db.commit()
    db.refresh(a)
    return build_athlete_out(a)

class ArchiveRequest(BaseModel):
    archive_children: Optional[bool] = None  # None = не спрашивали, True/False = ответ

# ─── Архивировать спортсмена ──────────────────────────────────────────────────
@router.patch("/athletes/{athlete_id}/archive")
def archive_athlete(
    athlete_id: int,
    db: Session = Depends(get_db), _: User = Depends(require_manager)
):
    a = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Спортсмен не найден")
    a.is_archived = True
    a.archived_at = datetime.utcnow()
    # Если у родителя больше нет активных детей — блокируем его аккаунт
    parent = db.query(User).filter(User.id == a.user_id).first()
    if parent and parent.role == 'parent':
        active_children = db.query(Athlete).filter(
            Athlete.user_id == parent.id,
            Athlete.id != athlete_id,
            Athlete.is_archived == False
        ).count()
        if active_children == 0:
            parent.is_active = False
    db.commit()
    return {"ok": True}

# ─── Восстановить спортсмена из архива ───────────────────────────────────────
@router.patch("/athletes/{athlete_id}/restore")
def restore_athlete(
    athlete_id: int,
    db: Session = Depends(get_db), _: User = Depends(require_manager)
):
    a = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Спортсмен не найден")
    a.is_archived = False
    a.archived_at = None
    # Восстанавливаем доступ родителя
    parent = db.query(User).filter(User.id == a.user_id).first()
    if parent and not parent.is_active:
        parent.is_active = True
    db.commit()
    return {"ok": True}

# ─── Архивировать родителя (с детьми) ────────────────────────────────────────
@router.patch("/parents/{user_id}/archive")
def archive_parent(
    user_id: int,
    data: ArchiveRequest,
    db: Session = Depends(get_db), _: User = Depends(require_manager)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    children = db.query(Athlete).filter(
        Athlete.user_id == user_id,
        Athlete.is_archived == False
    ).all()

    # Если есть дети и ответ не дан — просим подтверждение
    if children and data.archive_children is None:
        return {
            "needs_confirmation": True,
            "children_count": len(children),
            "children": [{"id": c.id, "full_name": c.full_name} for c in children]
        }

    # Архивируем детей если подтверждено
    if data.archive_children:
        for c in children:
            c.is_archived = True
            c.archived_at = datetime.utcnow()

    # Блокируем родителя
    user.is_active = False
    db.commit()
    return {"ok": True}

# ─── Восстановить родителя (с детьми) ────────────────────────────────────────
@router.patch("/parents/{user_id}/restore")
def restore_parent(
    user_id: int,
    restore_children: bool = True,
    db: Session = Depends(get_db), _: User = Depends(require_manager)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.is_active = True
    if restore_children:
        db.query(Athlete).filter(
            Athlete.user_id == user_id,
            Athlete.is_archived == True
        ).update({"is_archived": False, "archived_at": None})
    db.commit()
    return {"ok": True}

# ─── Удалить спортсмена безвозвратно (только admin/manager) ──────────────────
@router.delete("/athletes/{athlete_id}")
def delete_athlete(
    athlete_id: int,
    db: Session = Depends(get_db), _: User = Depends(require_manager)
):
    a = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Спортсмен не найден")
    db.delete(a)
    db.commit()
    return {"ok": True}

# ─── Смена роли пользователя (только admin) ──────────────────────────────────
class RoleUpdateRequest(BaseModel):
    role: str

@router.patch("/{user_id}/role")
def update_user_role(
    user_id: int, data: RoleUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(403, "Только администратор может менять роли")
    allowed_roles = ("parent", "athlete", "manager", "admin")
    if data.role not in allowed_roles:
        raise HTTPException(400, f"Недопустимая роль. Разрешены: {', '.join(allowed_roles)}")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    # Cannot demote last admin
    if user.role == "admin" and data.role != "admin":
        admin_count = db.query(User).filter(User.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(400, "Нельзя понизить роль единственного администратора")
    user.role = data.role
    db.commit()
    return {"ok": True, "user_id": user_id, "role": data.role}


# ─── Лента событий по своим/просматриваемым спортсменам ──────────────────────
@router.get("/my-feed")
def get_my_feed(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Лента событий за последние 30 дней по всем спортсменам пользователя:
    - Своим (Athlete.user_id == current_user.id)
    - Просматриваемым через invite (AthleteViewer.viewer_id == current_user.id)

    Возвращает список событий с типом, датой и текстом.
    """
    from app.models.invite import AthleteViewer
    from app.models.attendance import Attendance, TrainingSession
    from app.models.achievement import AthleteAchievement, ACHIEVEMENT_MAP
    from app.models.competition import Competition, CompetitionResult
    from app.models.camp import Camp, CampParticipant
    from app.models.certification import Certification, CertificationResult
    from datetime import datetime, timedelta, date

    # Собираем все доступные athlete_id
    own_ids = [
        a.id for a in db.query(Athlete).filter(
            Athlete.user_id == current_user.id,
            Athlete.is_archived == False
        ).all()
    ]
    viewer_links = db.query(AthleteViewer).filter(AthleteViewer.viewer_id == current_user.id).all()
    viewer_ids = [v.athlete_id for v in viewer_links]
    all_ids = list(set(own_ids + viewer_ids))

    if not all_ids:
        return []

    # Карта athlete_id → full_name
    athletes = db.query(Athlete).filter(Athlete.id.in_(all_ids)).all()
    name_map = {a.id: a.full_name for a in athletes}

    today = date.today()
    period_start = today - timedelta(days=30)
    feed = []

    # ─── 1. Посещённые тренировки за 30 дней ──────────────────────────────────
    for ath_id in all_ids:
        records = (
            db.query(Attendance, TrainingSession)
            .join(TrainingSession, Attendance.session_id == TrainingSession.id)
            .filter(
                Attendance.athlete_id == ath_id,
                Attendance.present == True,
                TrainingSession.date >= period_start,
            )
            .order_by(TrainingSession.date.desc())
            .limit(10)
            .all()
        )
        for att, sess in records:
            feed.append({
                "type":        "attendance",
                "date":        sess.date.isoformat(),
                "athlete_id":  ath_id,
                "athlete_name": name_map.get(ath_id, "—"),
                "title":       "Тренировка",
                "text":        f"{name_map.get(ath_id, '—')} был на тренировке",
            })

    # ─── 2. Новые ачивки за 30 дней ───────────────────────────────────────────
    period_start_dt = datetime.combine(period_start, datetime.min.time())
    achs = (
        db.query(AthleteAchievement)
        .filter(
            AthleteAchievement.athlete_id.in_(all_ids),
            AthleteAchievement.granted_at >= period_start_dt,
        )
        .order_by(AthleteAchievement.granted_at.desc())
        .all()
    )
    for a in achs:
        meta = ACHIEVEMENT_MAP.get(a.code, {})
        feed.append({
            "type":         "achievement",
            "date":         a.granted_at.isoformat() if a.granted_at else None,
            "athlete_id":   a.athlete_id,
            "athlete_name": name_map.get(a.athlete_id, "—"),
            "title":        f"Новая ачивка — {meta.get('name', a.code)}",
            "text":         f"{name_map.get(a.athlete_id, '—')}: {meta.get('description', '')}",
            "tier":         meta.get("tier", "common"),
        })

    # ─── 3. Ближайшие соревнования (на 30 дней вперёд) ────────────────────────
    future_30 = today + timedelta(days=30)
    upcoming_comps = (
        db.query(Competition, CompetitionResult)
        .join(CompetitionResult, Competition.id == CompetitionResult.competition_id)
        .filter(
            CompetitionResult.athlete_id.in_(all_ids),
            Competition.date >= today,
            Competition.date <= future_30,
        )
        .all()
    )
    for comp, _ in upcoming_comps:
        days_left = (comp.date - today).days
        feed.append({
            "type":         "competition_upcoming",
            "date":         comp.date.isoformat(),
            "athlete_id":   None,
            "athlete_name": "",
            "title":        f"Соревнование — {comp.name}",
            "text":         f"Через {days_left} дн.{' (' + comp.location + ')' if comp.location else ''}",
        })

    # ─── 4. Результаты прошедших соревнований за 30 дней ─────────────────────
    past_comps = (
        db.query(Competition, CompetitionResult)
        .join(CompetitionResult, Competition.id == CompetitionResult.competition_id)
        .filter(
            CompetitionResult.athlete_id.in_(all_ids),
            Competition.date >= period_start,
            Competition.date < today,
        )
        .all()
    )
    for comp, res in past_comps:
        places = []
        if res.sparring_place: places.append(f"спарринг — {res.sparring_place} место")
        if res.stopball_place: places.append(f"стоп-балл — {res.stopball_place} место")
        if res.tegtim_place:   places.append(f"тег-тим — {res.tegtim_place} место")
        if res.tuli_place:     places.append(f"тули — {res.tuli_place} место")
        text = f"{name_map.get(res.athlete_id, '—')}: " + (", ".join(places) if places else "участие")
        feed.append({
            "type":         "competition_result",
            "date":         comp.date.isoformat(),
            "athlete_id":   res.athlete_id,
            "athlete_name": name_map.get(res.athlete_id, "—"),
            "title":        f"Результат — {comp.name}",
            "text":         text,
        })

    # ─── 5. Ближайшие сборы ───────────────────────────────────────────────────
    upcoming_camps = (
        db.query(Camp, CampParticipant)
        .join(CampParticipant, Camp.id == CampParticipant.camp_id)
        .filter(
            CampParticipant.athlete_id.in_(all_ids),
            Camp.date_start >= today,
            Camp.date_start <= future_30,
        )
        .all()
    )
    for camp, _ in upcoming_camps:
        days_left = (camp.date_start - today).days
        feed.append({
            "type":         "camp_upcoming",
            "date":         camp.date_start.isoformat(),
            "athlete_id":   None,
            "athlete_name": "",
            "title":        f"Сборы — {camp.name}",
            "text":         f"Через {days_left} дн.{' (' + camp.location + ')' if camp.location else ''}",
        })

    # ─── 6. Ближайшие аттестации + результаты прошедших ──────────────────────
    cert_links = (
        db.query(Certification, CertificationResult)
        .join(CertificationResult, Certification.id == CertificationResult.certification_id)
        .filter(
            CertificationResult.athlete_id.in_(all_ids),
            Certification.date >= period_start,
            Certification.date <= future_30,
        )
        .all()
    )
    for cert, res in cert_links:
        if cert.date >= today:
            days_left = (cert.date - today).days
            target = f"{res.target_dan} дан" if res.target_dan else (f"{res.target_gup} гып" if res.target_gup else "")
            feed.append({
                "type":         "certification_upcoming",
                "date":         cert.date.isoformat(),
                "athlete_id":   res.athlete_id,
                "athlete_name": name_map.get(res.athlete_id, "—"),
                "title":        f"Аттестация — {cert.name}",
                "text":         f"{name_map.get(res.athlete_id, '—')}: на {target} через {days_left} дн." if target else f"{name_map.get(res.athlete_id, '—')}: через {days_left} дн.",
            })
        else:
            if res.passed is True:
                target = f"{res.target_dan} дан" if res.target_dan else (f"{res.target_gup} гып" if res.target_gup else "")
                feed.append({
                    "type":         "certification_passed",
                    "date":         cert.date.isoformat(),
                    "athlete_id":   res.athlete_id,
                    "athlete_name": name_map.get(res.athlete_id, "—"),
                    "title":        f"Сдан экзамен — {target}" if target else "Аттестация сдана",
                    "text":         f"{name_map.get(res.athlete_id, '—')} успешно сдал аттестацию {cert.name}",
                })

    # ─── Сортировка: новое сверху ────────────────────────────────────────────
    feed.sort(key=lambda x: x["date"] or "", reverse=True)

    # Лимит на 15 событий
    return feed[:15]


# ─── Активность пользователей (admin/manager) ────────────────────────────────
@router.get("/activity")
def get_users_activity(db: Session = Depends(get_db), _: User = Depends(require_manager)):
    users = db.query(User).filter(User.is_active == True).all()
    return [
        {
            "user_id":          u.id,
            "full_name":        u.full_name,
            "phone":            u.phone,
            "role":             u.role.value if hasattr(u.role, 'value') else u.role,
            "last_login_at":    u.last_login_at.isoformat() if u.last_login_at else None,
            "last_activity_at": u.last_activity_at.isoformat() if u.last_activity_at else None,
        }
        for u in users
    ]


# ─── Сброс пароля (только admin/manager) ─────────────────────────────────────
@router.patch("/{user_id}/reset-password")
def reset_password(
    user_id: int, data: ResetPasswordRequest,
    db: Session = Depends(get_db), _: User = Depends(require_manager)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if len(data.new_password) < 4:
        raise HTTPException(status_code=400, detail="Пароль минимум 4 символа")
    user.password = hash_password(data.new_password)
    db.commit()
    return {"ok": True}
