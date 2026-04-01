# backend/app/routes/analytics.py

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Optional
from datetime import date
from app.core.database import get_db
from app.core.security import get_current_user, require_manager
from app.models.user import User, Athlete, Application
from app.models.analytics import Analytics
from app.models.certification import Notification, NotificationType
from app.models.attendance import TrainingSession, Attendance
from app.models.competition import Competition, CompetitionResult
from app.models.certification import Certification, CertificationResult
from app.models.camp import Camp, CampParticipant
from app.models.achievement import AthleteAchievement, ACHIEVEMENT_MAP
import os, uuid

router = APIRouter()

UPLOAD_DIR = "/app/static/analytics"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ADMIN_PHONE = "79253653597"


# ─── Создать аналитику (с файлом) — менеджер ────────────────────────────────

@router.post("/analytics")
async def create_analytics(
    athlete_id: int = Form(...),
    title: str = Form(...),
    comment: Optional[str] = Form(None),
    application_id: Optional[int] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_manager),
):
    athlete = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not athlete:
        raise HTTPException(status_code=404, detail="Спортсмен не найден")
    file_path = file_name = None
    if file:
        ALLOWED_EXTENSIONS = {".pdf", ".docx", ".xlsx"}
        MAX_SIZE = 20 * 1024 * 1024  # 20MB
        safe_basename = os.path.basename(file.filename) if file.filename else ""
        ext = os.path.splitext(safe_basename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Недопустимый тип файла. Разрешены: .pdf, .docx, .xlsx")
        contents = await file.read()
        if len(contents) > MAX_SIZE:
            raise HTTPException(status_code=400, detail="Файл слишком большой. Максимум 20MB")
        unique_name = f"{uuid.uuid4().hex}{ext}"
        full_path = os.path.abspath(os.path.join(UPLOAD_DIR, unique_name))
        if not full_path.startswith(os.path.abspath(UPLOAD_DIR) + os.sep):
            raise HTTPException(status_code=400, detail="Недопустимый путь к файлу")
        file_path = f"/static/analytics/{unique_name}"
        with open(full_path, "wb") as f:
            f.write(contents)
        file_name = safe_basename
    record = Analytics(athlete_id=athlete_id, title=title, comment=comment or None,
                       file_path=file_path, file_name=file_name, created_by=current_user.id)
    db.add(record); db.flush()
    body = f"Аналитика по спортсмену {athlete.full_name}: {title}."
    if comment: body += f" Комментарий: {comment}"
    db.add(Notification(user_id=athlete.user_id, type=NotificationType.general,
                        title=f"Аналитика — {title}", body=body, link_id=record.id, link_type="analytics"))
    if application_id:
        app_obj = db.query(Application).filter(Application.id == application_id).first()
        if app_obj: db.delete(app_obj)
    db.commit(); db.refresh(record)
    return {"id": record.id, "athlete_id": record.athlete_id, "title": record.title,
            "comment": record.comment, "file_path": record.file_path,
            "file_name": record.file_name, "created_at": str(record.created_at)}


# ─── Все аналитики ──────────────────────────────────────────────────────────

@router.get("/analytics")
def get_all_analytics(athlete_id: Optional[int] = None, db: Session = Depends(get_db),
                      current_user: User = Depends(get_current_user)):
    role = getattr(current_user, "role", "parent")
    if role in ("admin", "manager"):
        q = db.query(Analytics).options(joinedload(Analytics.athlete), joinedload(Analytics.creator))
        if athlete_id: q = q.filter(Analytics.athlete_id == athlete_id)
    else:
        my_ids = [a.id for a in db.query(Athlete).filter(Athlete.user_id == current_user.id).all()]
        q = db.query(Analytics).options(joinedload(Analytics.athlete)).filter(Analytics.athlete_id.in_(my_ids))
        if athlete_id: q = q.filter(Analytics.athlete_id == athlete_id)
    return [{"id": r.id, "athlete_id": r.athlete_id,
             "athlete_name": r.athlete.full_name if r.athlete else None,
             "title": r.title, "comment": r.comment, "file_path": r.file_path,
             "file_name": r.file_name,
             "created_by_name": r.creator.full_name if r.creator else None,
             "created_at": str(r.created_at)}
            for r in q.order_by(Analytics.created_at.desc()).all()]


# ─── Удалить аналитику ──────────────────────────────────────────────────────

@router.delete("/analytics/{analytics_id}", status_code=204)
def delete_analytics(analytics_id: int, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    record = db.query(Analytics).filter(Analytics.id == analytics_id).first()
    if not record: raise HTTPException(404, "Аналитика не найдена")
    if record.file_path:
        fp = f"/app{record.file_path}"
        if os.path.exists(fp):
            try: os.remove(fp)
            except: pass
    db.delete(record); db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# ВЫГРУЗКА ДАННЫХ ДЛЯ CLAUDE (только для ADMIN_PHONE)
# ═══════════════════════════════════════════════════════════════════════════════

def _age(bd):
    if not bd: return None
    t = date.today()
    return t.year - bd.year - ((t.month, t.day) < (bd.month, bd.day))

def _agecat(age):
    if age is None: return "?"
    if age <= 7: return "6-7"
    if age <= 9: return "8-9"
    if age <= 11: return "10-11"
    if age <= 14: return "12-14"
    if age <= 17: return "15-17"
    return "18+"

def _belt(gup, dan):
    if dan: return f"{dan} дан"
    if gup == 0 or gup is None: return "Без пояса"
    return f"{gup} гып"

def _season(d):
    return d.year if d.month >= 9 else d.year - 1


@router.get("/analytics/export/{athlete_id}")
def export_analytics_data(athlete_id: int, db: Session = Depends(get_db),
                          current_user: User = Depends(get_current_user)):
    phone = (current_user.phone or "").replace("+","").replace(" ","").replace("-","").replace("(","").replace(")","")
    if phone != ADMIN_PHONE:
        raise HTTPException(403, "Доступ запрещён")

    a = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not a: raise HTTPException(404, "Спортсмен не найден")

    age = _age(a.birth_date)
    age_cat = _agecat(age)
    gender = a.gender or "unknown"
    group = a.group or (a.auto_group if hasattr(a, 'auto_group') else "Не указана")
    belt = _belt(a.gup, a.dan)
    all_ath = db.query(Athlete).filter(Athlete.is_archived == False).all()

    # ── Профиль ──────────────────────────────────────────────────────────────
    profile = {
        "full_name": a.full_name,
        "birth_date": str(a.birth_date) if a.birth_date else None,
        "age": age, "age_category": age_cat,
        "gender": "М" if gender == "male" else "Ж",
        "group": group, "gup": a.gup, "dan": a.dan, "belt": belt,
        "weight": float(a.weight) if a.weight else None,
        "registered_at": str(a.user.created_at) if a.user else None,
        "club_context": {
            "total_active": len(all_ath),
            "same_age_category": sum(1 for x in all_ath if _agecat(_age(x.birth_date)) == age_cat),
            "same_age_and_gender": sum(1 for x in all_ath if _agecat(_age(x.birth_date)) == age_cat and x.gender == gender),
            "same_belt": sum(1 for x in all_ath if _belt(x.gup, x.dan) == belt),
        }
    }

    # ── Посещаемость ─────────────────────────────────────────────────────────
    att_recs = (db.query(Attendance, TrainingSession)
                .join(TrainingSession, Attendance.session_id == TrainingSession.id)
                .filter(Attendance.athlete_id == athlete_id).order_by(TrainingSession.date).all())
    tot_att = len(att_recs)
    pres_att = sum(1 for r, _ in att_recs if r.present)

    att_m = {}
    for rec, sess in att_recs:
        k = str(sess.date)[:7]
        att_m.setdefault(k, {"t": 0, "p": 0})
        att_m[k]["t"] += 1
        if rec.present: att_m[k]["p"] += 1

    club_m = {}
    for sess in db.query(TrainingSession).all():
        k = str(sess.date)[:7]
        club_m.setdefault(k, {"t": 0, "p": 0})
        club_m[k]["t"] += len(sess.records)
        club_m[k]["p"] += sum(1 for r in sess.records if r.present)

    att_cmp = []
    for m in sorted(set(list(att_m) + list(club_m))):
        my = att_m.get(m, {"t": 0, "p": 0})
        cl = club_m.get(m, {"t": 0, "p": 0})
        att_cmp.append({"month": m,
                        "athlete_sessions": my["t"], "athlete_present": my["p"],
                        "athlete_pct": round(my["p"]/my["t"]*100) if my["t"] else 0,
                        "club_avg_pct": round(cl["p"]/cl["t"]*100) if cl["t"] else 0})

    att_top = (db.query(Athlete.id, Athlete.full_name,
                        func.count(Attendance.id).label("tot"),
                        func.sum(Attendance.present.cast('integer')).label("pres"))
               .join(Attendance, Athlete.id == Attendance.athlete_id)
               .filter(Athlete.is_archived == False)
               .group_by(Athlete.id)
               .order_by(func.sum(Attendance.present.cast('integer')).desc()).limit(10).all())

    attendance = {
        "total": tot_att, "present": pres_att, "absent": tot_att - pres_att,
        "pct": round(pres_att/tot_att*100) if tot_att else 0,
        "monthly": att_cmp,
        "top5": [{"place": i+1, "present": int(r.pres or 0), "is_this": r.id == athlete_id} for i, r in enumerate(att_top[:5])],
        "rank": next((i+1 for i, r in enumerate(att_top) if r.id == athlete_id), None),
    }

    # ── Соревнования + рейтинги ──────────────────────────────────────────────
    cr = (db.query(CompetitionResult).options(joinedload(CompetitionResult.competition))
          .filter(CompetitionResult.athlete_id == athlete_id, CompetitionResult.status == "confirmed").all())

    comps = []
    tot_rat = 0
    disc = {"sparring": 0, "stopball": 0, "tegtim": 0, "tuli": 0}
    pb = lambda p, a, b, c: a if p == 1 else b if p == 2 else c if p == 3 else 0
    for r in cr:
        c = r.competition
        if not c: continue
        sp = (r.sparring_fights or 0)*3 + pb(r.sparring_place, 40, 24, 14)
        sb = (r.stopball_fights or 0)*2.5 + pb(r.stopball_place, 40, 24, 14)
        tg = (r.tegtim_fights or 0)*2.5 + pb(r.tegtim_place, 40, 24, 14)
        tl = (r.tuli_perfs or 0)*2 + pb(r.tuli_place, 25, 15, 9)
        disc["sparring"] += sp; disc["stopball"] += sb; disc["tegtim"] += tg; disc["tuli"] += tl
        tot_rat += r.rating or 0
        comps.append({"name": c.name, "date": str(c.date), "level": c.level, "type": c.comp_type,
                      "significance": c.significance, "season": c.season,
                      "sparring": {"place": r.sparring_place, "fights": r.sparring_fights},
                      "stopball": {"place": r.stopball_place, "fights": r.stopball_fights},
                      "tegtim": {"place": r.tegtim_place, "fights": r.tegtim_fights},
                      "tuli": {"place": r.tuli_place, "perfs": r.tuli_perfs},
                      "rating": round(r.rating or 0, 2)})

    ar = (db.query(Athlete.id, Athlete.gender, Athlete.group, Athlete.gup, Athlete.dan, Athlete.birth_date,
                   func.sum(CompetitionResult.rating).label("tot"))
          .join(CompetitionResult, CompetitionResult.athlete_id == Athlete.id)
          .filter(Athlete.is_archived == False, CompetitionResult.status == "confirmed")
          .group_by(Athlete.id).order_by(func.sum(CompetitionResult.rating).desc()).all())

    def rank(rows, fn=None):
        f = sorted([(r, float(r.tot or 0)) for r in rows if fn is None or fn(r)], key=lambda x: -x[1])
        for i, (r, _) in enumerate(f):
            if r.id == athlete_id: return {"place": i+1, "of": len(f), "rating": round(float(r.tot or 0), 2)}
        return None

    td = sum(disc.values()) or 1
    camp_ids = set(p.athlete_id for p in db.query(CampParticipant).filter(CampParticipant.status.in_(["confirmed","paid"])).all())
    cr_camp = [float(r.tot or 0) for r in ar if r.id in camp_ids]
    cr_nocamp = [float(r.tot or 0) for r in ar if r.id not in camp_ids]

    competitions = {
        "total_tournaments": len(comps), "total_rating": round(tot_rat, 2), "results": comps,
        "discipline_pct": {k: round(v/td*100, 1) for k, v in disc.items()},
        "positions": {
            "overall": rank(ar),
            "by_age": rank(ar, lambda r: _agecat(_age(r.birth_date)) == age_cat),
            "by_group": rank(ar, lambda r: r.group == a.group),
            "by_gender": rank(ar, lambda r: r.gender == gender),
            "by_belt": rank(ar, lambda r: _belt(r.gup, r.dan) == belt),
        },
        "top5": [{"place": i+1, "rating": round(float(r.tot or 0), 2), "is_this": r.id == athlete_id} for i, r in enumerate(ar[:5])],
        "camps_effect": {
            "avg_camp": round(sum(cr_camp)/len(cr_camp), 2) if cr_camp else 0,
            "avg_no_camp": round(sum(cr_nocamp)/len(cr_nocamp), 2) if cr_nocamp else 0,
            "in_camps": athlete_id in camp_ids,
        }
    }

    # ── Аттестации ───────────────────────────────────────────────────────────
    certs = (db.query(CertificationResult).options(joinedload(CertificationResult.certification))
             .filter(CertificationResult.athlete_id == athlete_id).order_by(CertificationResult.id).all())
    cert_data = [{"name": r.certification.name if r.certification else None,
                  "date": str(r.certification.date) if r.certification else None,
                  "from": _belt(r.current_gup, r.current_dan), "to": _belt(r.target_gup, r.target_dan),
                  "passed": r.passed} for r in certs]

    all_cd = (db.query(CertificationResult.athlete_id, Certification.date).join(Certification)
              .filter(CertificationResult.passed == True).order_by(Certification.date).all())
    by_a = {}
    for aid, d in all_cd: by_a.setdefault(aid, []).append(d)
    my_int = []; cl_int = []
    for aid, ds in by_a.items():
        for i in range(1, len(ds)):
            delta = (ds[i]-ds[i-1]).days
            if aid == athlete_id: my_int.append(delta)
            cl_int.append(delta)

    certifications = {"results": cert_data, "passed": sum(1 for c in cert_data if c["passed"]),
                      "athlete_avg_days": round(sum(my_int)/len(my_int)) if my_int else None,
                      "club_avg_days": round(sum(cl_int)/len(cl_int)) if cl_int else None}

    # ── Сборы ────────────────────────────────────────────────────────────────
    cp = (db.query(CampParticipant).options(joinedload(CampParticipant.camp))
          .filter(CampParticipant.athlete_id == athlete_id).all())
    camp_data = [{"name": p.camp.name if p.camp else None,
                  "dates": f"{p.camp.date_start} — {p.camp.date_end}" if p.camp else None,
                  "status": p.status, "paid": p.paid} for p in cp]
    tc = db.query(Camp).count()
    ac = sum(1 for p in cp if p.status in ("confirmed","paid"))
    cl_cp = []
    for x in all_ath:
        xc = db.query(CampParticipant).filter(CampParticipant.athlete_id == x.id, CampParticipant.status.in_(["confirmed","paid"])).count()
        if tc: cl_cp.append(round(xc/tc*100))

    camps = {"results": camp_data, "confirmed": ac, "total": tc,
             "pct": round(ac/tc*100) if tc else 0,
             "club_avg_pct": round(sum(cl_cp)/len(cl_cp)) if cl_cp else 0}

    # ── Ачивки ───────────────────────────────────────────────────────────────
    achs = db.query(AthleteAchievement).filter(AthleteAchievement.athlete_id == athlete_id).all()
    ach_data = [{"code": x.code, "name": ACHIEVEMENT_MAP.get(x.code, {}).get("name", x.code),
                 "tier": ACHIEVEMENT_MAP.get(x.code, {}).get("tier"),
                 "date": str(x.granted_at) if x.granted_at else None} for x in achs]
    ach_top = (db.query(Athlete.id, func.count(AthleteAchievement.id).label("c"))
               .join(AthleteAchievement).filter(Athlete.is_archived == False)
               .group_by(Athlete.id).order_by(func.count(AthleteAchievement.id).desc()).limit(10).all())

    achievements = {"total": len(ach_data), "list": ach_data,
                    "top5": [{"place": i+1, "count": r.c, "is_this": r.id == athlete_id} for i, r in enumerate(ach_top[:5])],
                    "rank": next((i+1 for i, r in enumerate(ach_top) if r.id == athlete_id), None)}

    # ── Промт ────────────────────────────────────────────────────────────────
    prompt = f"""Ты — профессиональный аналитик спортивного клуба тхэквондо «Тайпан» (Павловский Посад, федерация ГТФ).
Подготовь развёрнутый аналитический отчёт по спортсмену {a.full_name} ({age} лет, {belt}, группа «{group}»).

Структура отчёта:

1. ПРЕВЬЮ — Краткая справка: имя, возраст, пояс, пол. Контекст: в клубе {len(all_ath)} активных спортсменов, из них {profile['club_context']['same_age_and_gender']} {'девочек' if gender=='female' else 'мальчиков'} в возрасте {age_cat} лет, с таким же поясом — {profile['club_context']['same_belt']}. Общее впечатление в 2-3 предложениях.

2. ПОСЕЩАЕМОСТЬ — Динамика по месяцам, сравнение со средним по клубу. Тренды. Место в топе клуба. Рекомендации.

3. СОРЕВНОВАНИЯ И РЕЙТИНГ — Количество турниров, уровни. Общий рейтинг и позиция в 5 срезах (общий, по возрасту, по группе, по полу, по гыпу). Распределение очков по дисциплинам (спарринг/стопбол/тэгтим/тули) — если 80%+ из одной дисциплины, рекомендуй развивать другие. Анализ: перерастает ли спортсмен свой пояс по рейтингу или наоборот.

4. АТТЕСТАЦИИ — Хронология поясов. Темп vs средний по клубу. Рекомендации.

5. СБОРЫ — Участие, % по сравнению с клубом. Корреляция: средний рейтинг участников сборов vs тех кто не ездит. Вывод.

6. АЧИВКИ — Список, место в топе. Какие ачивки ещё не получены.

7. КОРРЕЛЯЦИИ И ВЫВОДЫ — Связь посещаемости и рейтинга. Связь сборов и результатов. Сильные стороны. Зоны роста. 3-5 конкретных рекомендаций.

Тон: профессиональный, дружелюбный. Обращайся к родителям на «вы». Конкретные цифры. Без эмодзи. Оформи с заголовками."""

    return JSONResponse(content={
        "prompt": prompt,
        "export_date": str(date.today()),
        "season": f"{_season(date.today())}/{_season(date.today())+1}",
        "profile": profile, "attendance": attendance, "competitions_and_ratings": competitions,
        "certifications": certifications, "camps": camps, "achievements": achievements,
    })

# ─── Скачать файл с правильным Content-Disposition ──────────────────────────
from fastapi.responses import FileResponse

@router.get("/analytics/download/{filename}")
def download_analytics_file(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    safe_filename = os.path.basename(filename)
    filepath = os.path.abspath(os.path.join(UPLOAD_DIR, safe_filename))
    if not filepath.startswith(os.path.abspath(UPLOAD_DIR) + os.sep):
        raise HTTPException(400, "Недопустимое имя файла")
    if not os.path.exists(filepath):
        raise HTTPException(404, "Файл не найден")
    ext = os.path.splitext(safe_filename)[1].lower()
    media_types = {
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.pdf':  'application/pdf',
        '.csv':  'text/csv; charset=utf-8',
    }
    media_type = media_types.get(ext, 'application/octet-stream')
    return FileResponse(path=filepath, media_type=media_type, filename=safe_filename)
