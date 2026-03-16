import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import './Cabinet.css'
import './Competitions.css'

const API = '/api'

function useSorted(data) {
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const toggle = (key) => setSort(s =>
    s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
  )
  const sorted = useMemo(() => {
    if (!sort.key) return data
    return [...data].sort((a, b) => {
      const va = a[sort.key] ?? '', vb = b[sort.key] ?? ''
      const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'ru')
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [data, sort])
  return { sorted, sort, toggle }
}

function SortIcon({ active, dir }) {
  if (!active) return <span className="sort-icon sort-icon-idle">o</span>
  return <span className="sort-icon sort-icon-active">{dir === 'asc' ? 'v' : '^'}</span>
}

function Th({ children, colKey, sort, toggle, filter }) {
  return (
    <th className="th-sortable" style={{ verticalAlign: 'top' }}>
      <div className="th-inner" onClick={() => toggle(colKey)}>
        {children} <SortIcon active={sort.key === colKey} dir={sort.dir} />
      </div>
      {filter}
    </th>
  )
}

function ColFilter({ value, onChange, options, placeholder }) {
  return (
    <select className="col-filter" value={value} onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}>
      <option value="">{placeholder || 'Все'}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function ResetPasswordModal({ user, token, onClose }) {
  const [pwd, setPwd] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const save = async () => {
    if (pwd.length < 4) { setMsg('Минимум 4 символа'); return }
    setLoading(true)
    const r = await fetch(`${API}/users/${user.user_id}/reset-password`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_password: pwd }),
    })
    setLoading(false)
    if (r.ok) { setMsg('Пароль изменён'); setTimeout(onClose, 1200) }
    else { const d = await r.json(); setMsg(d.detail || 'Ошибка') }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3>Сброс пароля</h3>
        <p>{user.parent_name}</p>
        <input type="text" placeholder="Новый пароль" value={pwd}
          onChange={e => setPwd(e.target.value)} className="modal-input" />
        {msg && <div className="modal-msg">{msg}</div>}
        <div className="modal-btns-row">
          <button className="btn-primary" onClick={save} disabled={loading}>{loading ? '...' : 'Сохранить'}</button>
          <button className="btn-outline" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

// ── ЖУРНАЛ ПОСЕЩАЕМОСТИ ────────────────────────────────────────────────────────
function AttendanceTab({ token, athletes }) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate]           = useState(today)
  const [group, setGroup]         = useState('junior')
  const [sessions, setSessions]   = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [marks, setMarks]         = useState({})
  const [notes, setNotes]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState('')
  const [viewMode, setViewMode]   = useState('create')

  const groupAthletes = useMemo(() =>
    athletes.filter(a => {
      const g = a.group || a.auto_group || ''
      return group === 'junior'
        ? g.includes('6') || g.includes('Младшая')
        : g.includes('11') || g.includes('Старшая') || g.includes('Взрослые') || g.includes('16')
    })
  , [athletes, group])

  useEffect(() => { loadSessions() }, [group])

  const loadSessions = async () => {
    try {
      const r = await fetch(`${API}/attendance/sessions?group_name=${group}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (r.ok) setSessions(await r.json())
    } catch {}
  }

  const initMarks = (athleteList, existingMarks = {}) => {
    const m = {}
    athleteList.forEach(a => { m[a.id] = existingMarks[a.id] ?? false })
    setMarks(m)
  }

  const startNewSession = () => {
    initMarks(groupAthletes)
    setNotes('')
    setActiveSession(null)
    setViewMode('create')
    setMsg('')
  }

  const openSession = async (s) => {
    try {
      const r = await fetch(`${API}/attendance/sessions/${s.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (r.ok) {
        const data = await r.json()
        const existingMarks = {}
        data.athletes.forEach(a => { existingMarks[a.id] = a.present })
        initMarks(data.athletes, existingMarks)
        setActiveSession(data)
        setNotes(data.notes || '')
        setViewMode('session')
      }
    } catch {}
  }

  const saveSession = async () => {
    setSaving(true)
    setMsg('')
    try {
      let sessionId = activeSession?.id
      if (!sessionId) {
        const cr = await fetch(`${API}/attendance/sessions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, group_name: group, notes })
        })
        if (!cr.ok) {
          const e = await cr.json()
          setMsg(e.detail || 'Ошибка создания тренировки')
          setSaving(false)
          return
        }
        const created = await cr.json()
        sessionId = created.id
      }
      const records = Object.entries(marks).map(([athlete_id, present]) => ({
        athlete_id: parseInt(athlete_id), present
      }))
      await fetch(`${API}/attendance/sessions/${sessionId}/mark`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ records })
      })
      setMsg(`Сохранено! Присутствовало: ${records.filter(r => r.present).length} из ${records.length}`)
      loadSessions()
    } catch {
      setMsg('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const toggleAll = (val) => {
    const m = {}
    Object.keys(marks).forEach(id => { m[id] = val })
    setMarks(m)
  }

  const presentCount = Object.values(marks).filter(Boolean).length
  const totalCount   = Object.keys(marks).length

  return (
    <div className="attendance-wrap">
      <div className="attendance-header">
        <div className="attendance-group-tabs">
          <button className={`att-group-btn ${group === 'junior' ? 'active' : ''}`}
            onClick={() => { setGroup('junior'); startNewSession() }}>
            Младшая (6–10 лет)
          </button>
          <button className={`att-group-btn ${group === 'senior' ? 'active' : ''}`}
            onClick={() => { setGroup('senior'); startNewSession() }}>
            Старшая (11+)
          </button>
        </div>
        <div className="attendance-view-tabs">
          <button className={`att-view-btn ${viewMode !== 'history' ? 'active' : ''}`}
            onClick={startNewSession}>+ Новая тренировка</button>
          <button className={`att-view-btn ${viewMode === 'history' ? 'active' : ''}`}
            onClick={() => setViewMode('history')}>История ({sessions.length})</button>
        </div>
      </div>

      {viewMode === 'history' && (
        <div className="att-history">
          {sessions.length === 0 && <div className="cabinet-empty">Тренировок пока нет</div>}
          {sessions.map(s => (
            <div key={s.id} className="att-session-row" onClick={() => openSession(s)}>
              <span className="att-session-date">{new Date(s.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <span className="att-session-stat">
                {s.present} / {s.total} присутствовали
                {s.total > 0 && <span className="att-pct"> ({Math.round(s.present/s.total*100)}%)</span>}
              </span>
              {s.notes && <span className="att-session-notes">{s.notes}</span>}
              <span className="att-session-edit">Открыть →</span>
            </div>
          ))}
        </div>
      )}

      {viewMode !== 'history' && (
        <div className="att-form">
          <div className="att-form-top">
            {viewMode === 'create' ? (
              <div className="att-date-row">
                <label>Дата тренировки</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="att-date-input" />
              </div>
            ) : (
              <div className="att-session-title">
                Тренировка: {new Date(activeSession.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
            <div className="att-date-row">
              <label>Заметка к тренировке</label>
              <input type="text" placeholder="Например: открытая тренировка..." value={notes}
                onChange={e => setNotes(e.target.value)} className="att-notes-input" />
            </div>
          </div>

          <div className="att-counter-row">
            <span className="att-counter">
              Присутствует: <strong>{presentCount}</strong> из <strong>{totalCount}</strong>
            </span>
            <button className="att-all-btn" onClick={() => toggleAll(true)}>Все пришли</button>
            <button className="att-all-btn" onClick={() => toggleAll(false)}>Сбросить</button>
          </div>

          <div className="att-list">
            {groupAthletes.length === 0 && (
              <div className="cabinet-empty">Нет спортсменов в этой группе</div>
            )}
            {groupAthletes.map(a => (
              <div
                key={a.id}
                className={`att-athlete-row ${marks[a.id] ? 'present' : 'absent'}`}
                onClick={() => setMarks(m => ({ ...m, [a.id]: !m[a.id] }))}
              >
                <div className="att-check">{marks[a.id] ? '✓' : '—'}</div>
                <div className="att-athlete-name">{a.full_name}</div>
                <div className="att-athlete-age">{a.age} лет · {a.group || a.auto_group}</div>
              </div>
            ))}
          </div>

          {msg && <div className="att-msg">{msg}</div>}

          <button className="btn-primary att-save-btn" onClick={saveSession} disabled={saving}>
            {saving ? 'Сохранение...' : 'Сохранить тренировку'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── СОРЕВНОВАНИЯ ───────────────────────────────────────────────────────────────

const SIG_TABLE = {
  'Местный':        { 'Фестиваль': 1.0, 'Турнир': 1.2, 'Кубок': 1.5, 'Первенство': 1.5, 'Чемпионат': 1.5 },
  'Региональный':   { 'Фестиваль': 2.0, 'Турнир': 2.5, 'Кубок': 2.8, 'Первенство': 2.8, 'Чемпионат': 3.0 },
  'Окружной':       { 'Фестиваль': 4.0, 'Турнир': 4.5, 'Кубок': 5.0, 'Первенство': 5.0, 'Чемпионат': 6.0 },
  'Всероссийский':  { 'Фестиваль': 7.0, 'Турнир': 8.0, 'Кубок': 9.0, 'Первенство': 10.0, 'Чемпионат': 11.0 },
  'Международный':  { 'Фестиваль': 15.0, 'Турнир': 17.0, 'Кубок': 20.0, 'Первенство': 21.0, 'Чемпионат': 24.0 },
}
const LEVELS = Object.keys(SIG_TABLE)

const PLACE_OPTS = [
  { value: '', label: '—' },
  { value: 1,  label: '🥇 1' },
  { value: 2,  label: '🥈 2' },
  { value: 3,  label: '🥉 3' },
]

const LEVEL_BADGE = {
  'Местный':       'cbadge-local',
  'Региональный':  'cbadge-regional',
  'Окружной':      'cbadge-district',
  'Всероссийский': 'cbadge-national',
  'Международный': 'cbadge-international',
}

function calcRatingPreview(row, sig) {
  const pb = (p, b1, b2, b3) => p === 1 ? b1 : p === 2 ? b2 : p === 3 ? b3 : 0
  const sp  = Number(row.sparring_place)  || 0
  const sf  = Number(row.sparring_fights) || 0
  const sbp = Number(row.stopball_place)  || 0
  const sbf = Number(row.stopball_fights) || 0
  const tp  = Number(row.tuli_place)      || 0
  const tf  = Number(row.tuli_perfs)      || 0
  const spts  = sf  * 3   + pb(sp,  40, 24, 14)
  const sbpts = sbf * 2.5 + pb(sbp, 40, 24, 14)
  const tpts  = tf  * 2   + pb(tp,  25, 15,  9)
  let gold = 0, silver = 0, bronze = 0
  ;[sp, sbp, tp].forEach(p => { if (p===1) gold++; else if (p===2) silver++; else if (p===3) bronze++ })
  const total = gold + silver + bronze
  let mb = 0
  if (gold >= 2) mb = 55
  else if (gold === 1 && total === 1) mb = 30
  else if (total >= 2) mb = 40
  else if (silver === 1 && total === 1) mb = 18
  else if (bronze === 1 && total === 1) mb = 10
  const raw = spts + sbpts + tpts + mb
  return raw > 0 ? (sig * Math.log(raw + 1)).toFixed(2) : '—'
}

function CompetitionsTab({ token, athletes }) {
  const [compView,    setCompView]   = useState('list')   // 'list' | 'detail' | 'rating'
  const [comps,       setComps]      = useState([])
  const [seasons,     setSeasons]    = useState([])
  const [season,      setSeason]     = useState('')
  const [detail,      setDetail]     = useState(null)
  const [rows,        setRows]       = useState([])
  const [rating,      setRating]     = useState([])
  const [ratingFilter,setRatingFilter] = useState('all')
  const [loading,     setLoading]    = useState(false)
  const [saving,      setSaving]     = useState(false)
  const [showForm,    setShowForm]   = useState(false)
  const [msg,         setMsg]        = useState('')
  const [form, setForm] = useState({
    name: '', date: '', location: '', level: 'Местный', comp_type: 'Турнир', notes: ''
  })

  const h = { Authorization: `Bearer ${token}` }
  const hj = { ...h, 'Content-Type': 'application/json' }

  useEffect(() => { loadSeasons(); loadComps() }, [])
  useEffect(() => { loadComps() }, [season])

  const loadSeasons = async () => {
    try {
      const r = await fetch(`${API}/competitions/seasons`, { headers: h })
      if (r.ok) setSeasons(await r.json())
    } catch {}
  }

  const loadComps = async () => {
    setLoading(true)
    try {
      const url = season ? `${API}/competitions?season=${season}` : `${API}/competitions`
      const r = await fetch(url, { headers: h })
      if (r.ok) setComps(await r.json())
    } catch {}
    setLoading(false)
  }

  const openDetail = async (comp) => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/competitions/${comp.id}`, { headers: h })
      if (!r.ok) return
      const d = await r.json()
      setDetail(d)
      const existingMap = {}
      ;(d.results || []).forEach(res => { existingMap[res.athlete_id] = res })
      setRows(athletes.map(a => {
        const ex = existingMap[a.id] || {}
        return {
          athlete_id:      a.id,
          full_name:       a.full_name,
          sparring_place:  ex.sparring_place  ?? '',
          sparring_fights: ex.sparring_fights ?? 0,
          stopball_place:  ex.stopball_place  ?? '',
          stopball_fights: ex.stopball_fights ?? 0,
          tuli_place:      ex.tuli_place      ?? '',
          tuli_perfs:      ex.tuli_perfs      ?? 0,
          saved_rating:    ex.rating          ?? null,
        }
      }))
      setCompView('detail')
    } catch {}
    setLoading(false)
  }

  const saveResults = async () => {
    if (!detail) return
    setSaving(true)
    setMsg('')
    try {
      const payload = rows
        .filter(r => r.sparring_place !== '' || r.sparring_fights > 0 ||
                     r.stopball_place !== '' || r.stopball_fights > 0 ||
                     r.tuli_place !== '' || r.tuli_perfs > 0)
        .map(r => ({
          athlete_id:      r.athlete_id,
          sparring_place:  r.sparring_place  !== '' ? Number(r.sparring_place)  : null,
          sparring_fights: Number(r.sparring_fights) || 0,
          stopball_place:  r.stopball_place  !== '' ? Number(r.stopball_place)  : null,
          stopball_fights: Number(r.stopball_fights) || 0,
          tuli_place:      r.tuli_place      !== '' ? Number(r.tuli_place)      : null,
          tuli_perfs:      Number(r.tuli_perfs) || 0,
        }))
      const r = await fetch(`${API}/competitions/${detail.id}/results`, {
        method: 'PUT', headers: hj, body: JSON.stringify({ results: payload })
      })
      if (r.ok) { setMsg('Результаты сохранены'); await openDetail(detail) }
      else setMsg('Ошибка сохранения')
    } catch { setMsg('Ошибка сохранения') }
    setSaving(false)
  }

  const createComp = async () => {
    if (!form.name.trim() || !form.date) { setMsg('Заполните название и дату'); return }
    try {
      const r = await fetch(`${API}/competitions`, {
        method: 'POST', headers: hj,
        body: JSON.stringify({ name: form.name, date: form.date, location: form.location || null,
          level: form.level, comp_type: form.comp_type, notes: form.notes || null })
      })
      if (r.ok) {
        setShowForm(false)
        setForm({ name: '', date: '', location: '', level: 'Местный', comp_type: 'Турнир', notes: '' })
        setMsg('')
        await loadComps(); await loadSeasons()
      } else { const d = await r.json(); setMsg(d.detail || 'Ошибка') }
    } catch { setMsg('Ошибка создания') }
  }

  const deleteComp = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm('Удалить соревнование и все результаты?')) return
    await fetch(`${API}/competitions/${id}`, { method: 'DELETE', headers: h })
    if (detail?.id === id) { setCompView('list'); setDetail(null) }
    await loadComps()
  }

  const loadRating = async () => {
    setLoading(true)
    try {
      const url = season
        ? `${API}/competitions/rating/overall?season=${season}`
        : `${API}/competitions/rating/overall`
      const r = await fetch(url, { headers: h })
      if (r.ok) { setRating(await r.json()); setCompView('rating') }
    } catch {}
    setLoading(false)
  }

  const exportCsv = () => {
    const data = ratingFilter === 'all' ? rating : rating
    const lines = [['Место','ФИО','Группа','Гып','Пол','Турниров','🥇','🥈','🥉','Рейтинг'].join(';')]
    data.forEach((r, i) => {
      lines.push([i+1, r.full_name, r.group||'', r.gup||'', r.gender||'',
        r.tournaments_count, r.gold, r.silver, r.bronze, r.total_rating].join(';'))
    })
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `Рейтинг_Тайпан_${season || 'все'}.csv`
    a.click()
  }

  const updateRow = (athleteId, field, value) =>
    setRows(prev => prev.map(r => r.athlete_id === athleteId ? { ...r, [field]: value } : r))

  const typesForLevel = (lvl) => Object.keys(SIG_TABLE[lvl] || {})
  const formSig = (SIG_TABLE[form.level] || {})[form.comp_type] || 1.0

  const getRatingGroups = () => {
    const groups = {}
    rating.forEach(r => {
      const key = r[ratingFilter] || 'Не указано'
      if (!groups[key]) groups[key] = []
      groups[key].push(r)
    })
    return groups
  }

  return (
    <div className="comp-wrap">

      {/* Шапка */}
      <div className="comp-top">
        <div className="comp-top-left">
          <select className="att-date-input" value={season}
            onChange={e => setSeason(e.target.value)} style={{ width: 'auto' }}>
            <option value="">Все сезоны</option>
            {seasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {compView !== 'list' && (
            <button className="att-all-btn"
              onClick={() => { setCompView('list'); setDetail(null); setMsg('') }}>
              ← К списку
            </button>
          )}
        </div>
        <div className="comp-top-right">
          <button className="att-all-btn" onClick={loadRating}>🏆 Рейтинг сезона</button>
          <button className="btn-primary" style={{ padding: '8px 18px', fontSize: '14px' }}
            onClick={() => { setShowForm(true); setMsg('') }}>
            + Соревнование
          </button>
        </div>
      </div>

      {msg && <div className="att-msg">{msg}</div>}
      {loading && <div className="cabinet-loading">Загрузка...</div>}

      {/* ── Список соревнований ── */}
      {!loading && compView === 'list' && (
        <div className="comp-list">
          {comps.length === 0 && (
            <div className="cabinet-empty">
              Соревнований пока нет{season ? ` в ${season} году` : ''}.
            </div>
          )}
          {comps.map(c => (
            <div key={c.id} className="comp-card" onClick={() => openDetail(c)}>
              <div className="comp-card-body">
                <div className="comp-card-name">{c.name}</div>
                <div className="comp-card-meta">
                  <span className="comp-card-date">
                    {new Date(c.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  {c.location && <span className="comp-card-date">📍 {c.location}</span>}
                  <span className={`comp-badge ${LEVEL_BADGE[c.level] || ''}`}>{c.level}</span>
                  <span className="comp-badge">{c.comp_type}</span>
                </div>
              </div>
              <div className="comp-card-right">
                <span className="comp-sig">×{c.significance}</span>
                <button className="td-btn td-btn-del"
                  onClick={e => deleteComp(c.id, e)}>Удал.</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Детальный вид ── */}
      {!loading && compView === 'detail' && detail && (
        <div className="comp-detail">
          <div className="comp-detail-head">
            <div>
              <div className="comp-detail-name">{detail.name}</div>
              <div className="comp-card-meta" style={{ marginTop: 4 }}>
                <span className="comp-card-date">
                  {new Date(detail.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                {detail.location && <span className="comp-card-date">📍 {detail.location}</span>}
                <span className={`comp-badge ${LEVEL_BADGE[detail.level] || ''}`}>{detail.level}</span>
                <span className="comp-badge">{detail.comp_type}</span>
                <span className="comp-sig">×{detail.significance}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="att-all-btn" onClick={exportCsv}>↓ CSV</button>
              <button className="btn-primary" style={{ padding: '8px 18px', fontSize: '14px' }}
                onClick={saveResults} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>

          <div className="athletes-table-wrap">
            <table className="athletes-table comp-results-table">
              <thead>
                <tr>
                  <th rowSpan="2" style={{ textAlign: 'left' }}>Спортсмен</th>
                  <th colSpan="2">Спарринг</th>
                  <th colSpan="2">Стоп-балл</th>
                  <th colSpan="2">Тули</th>
                  <th rowSpan="2">Рейтинг</th>
                </tr>
                <tr>
                  <th>Место</th><th>Бои</th>
                  <th>Место</th><th>Бои</th>
                  <th>Место</th><th>Выст.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.athlete_id}>
                    <td className="td-name">{r.full_name}</td>
                    <td>
                      <select className="td-input td-input-sm" value={r.sparring_place}
                        onChange={e => updateRow(r.athlete_id, 'sparring_place', e.target.value)}>
                        {PLACE_OPTS.map(o => <option key={o.label} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <input type="number" min="0" max="99" className="td-input td-input-sm"
                        value={r.sparring_fights}
                        onChange={e => updateRow(r.athlete_id, 'sparring_fights', e.target.value)} />
                    </td>
                    <td>
                      <select className="td-input td-input-sm" value={r.stopball_place}
                        onChange={e => updateRow(r.athlete_id, 'stopball_place', e.target.value)}>
                        {PLACE_OPTS.map(o => <option key={o.label} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <input type="number" min="0" max="99" className="td-input td-input-sm"
                        value={r.stopball_fights}
                        onChange={e => updateRow(r.athlete_id, 'stopball_fights', e.target.value)} />
                    </td>
                    <td>
                      <select className="td-input td-input-sm" value={r.tuli_place}
                        onChange={e => updateRow(r.athlete_id, 'tuli_place', e.target.value)}>
                        {PLACE_OPTS.map(o => <option key={o.label} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <input type="number" min="0" max="99" className="td-input td-input-sm"
                        value={r.tuli_perfs}
                        onChange={e => updateRow(r.athlete_id, 'tuli_perfs', e.target.value)} />
                    </td>
                    <td className="comp-rating-val">
                      {calcRatingPreview(r, detail.significance || 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <div className="cabinet-empty">Нет спортсменов</div>}
          </div>
        </div>
      )}

      {/* ── Рейтинг ── */}
      {!loading && compView === 'rating' && (
        <div>
          <div className="comp-rating-filters">
            {[
              { key: 'all',    label: 'Общий' },
              { key: 'group',  label: 'По группе' },
              { key: 'gender', label: 'По полу' },
              { key: 'gup',    label: 'По гыпу' },
            ].map(f => (
              <button key={f.key}
                className={`att-group-btn ${ratingFilter === f.key ? 'active' : ''}`}
                onClick={() => setRatingFilter(f.key)}>
                {f.label}
              </button>
            ))}
            <button className="att-all-btn" onClick={exportCsv}>↓ CSV</button>
          </div>

          {rating.length === 0 && (
            <div className="cabinet-empty">Результатов пока нет{season ? ` за ${season} год` : ''}.</div>
          )}

          {ratingFilter === 'all' ? (
            renderRatingTable(rating)
          ) : (
            Object.entries(getRatingGroups()).map(([group, rows_g]) => (
              <div key={group} style={{ marginBottom: 28 }}>
                <div className="comp-group-label">{group}</div>
                {renderRatingTable(rows_g)}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Форма создания ── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box comp-modal" onClick={e => e.stopPropagation()}>
            <h3>Новое соревнование</h3>
            <div className="comp-form-grid">
              <div className="comp-field comp-field-full">
                <label>Название *</label>
                <input type="text" className="modal-input"
                  placeholder="Открытое первенство Московской области..."
                  value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="comp-field">
                <label>Дата *</label>
                <input type="date" className="modal-input"
                  value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="comp-field">
                <label>Место проведения</label>
                <input type="text" className="modal-input" placeholder="Москва, СК «Олимп»"
                  value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
              </div>
              <div className="comp-field">
                <label>Уровень</label>
                <select className="modal-input" value={form.level}
                  onChange={e => {
                    const lvl = e.target.value
                    const types = typesForLevel(lvl)
                    setForm(p => ({ ...p, level: lvl, comp_type: types.includes(p.comp_type) ? p.comp_type : types[0] }))
                  }}>
                  {LEVELS.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="comp-field">
                <label>Тип</label>
                <select className="modal-input" value={form.comp_type}
                  onChange={e => setForm(p => ({ ...p, comp_type: e.target.value }))}>
                  {typesForLevel(form.level).map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="comp-field comp-field-sig">
                <label>Коэффициент значимости</label>
                <div className="comp-sig-preview">
                  <span>{form.level} · {form.comp_type}</span>
                  <span className="comp-sig">×{formSig}</span>
                </div>
              </div>
              <div className="comp-field comp-field-full">
                <label>Примечание</label>
                <input type="text" className="modal-input" placeholder="Дополнительно..."
                  value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            {msg && <div className="modal-msg">{msg}</div>}
            <div className="modal-btns-row">
              <button className="btn-primary" onClick={createComp}>Создать</button>
              <button className="btn-outline" onClick={() => setShowForm(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  function renderRatingTable(data) {
    return (
      <div className="athletes-table-wrap">
        <table className="athletes-table">
          <thead>
            <tr>
              <th>Место</th>
              <th style={{ textAlign: 'left' }}>Спортсмен</th>
              <th>Группа</th>
              <th>Гып</th>
              <th>Медали</th>
              <th>Турниров</th>
              <th>Рейтинг</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={r.athlete_id}>
                <td style={{ textAlign: 'center', fontWeight: 700 }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </td>
                <td className="td-name">{r.full_name}</td>
                <td>{r.group || '—'}</td>
                <td>{r.gup || '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {r.gold   > 0 && <span>🥇{r.gold} </span>}
                  {r.silver > 0 && <span>🥈{r.silver} </span>}
                  {r.bronze > 0 && <span>🥉{r.bronze}</span>}
                  {r.gold + r.silver + r.bronze === 0 && '—'}
                </td>
                <td style={{ textAlign: 'center' }}>{r.tournaments_count}</td>
                <td className="comp-rating-val">{r.total_rating}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
}

// ── СТАТУСЫ ЗАЯВОК ─────────────────────────────────────────────────────────────
const STATUS_LABELS = {
  new:        { label: 'Новая',        color: '#FFD700' },
  processing: { label: 'В обработке',  color: '#4caf50' },
  confirmed:  { label: 'Подтверждена', color: '#2196F3' },
  rejected:   { label: 'Отклонена',    color: '#CC0000' },
}

// ── ГЛАВНЫЙ КОМПОНЕНТ ──────────────────────────────────────────────────────────
export default function Cabinet() {
  const navigate = useNavigate()
  const token    = localStorage.getItem('token')
  const role     = localStorage.getItem('role')
  const name     = localStorage.getItem('full_name')
  const isAdmin  = ['admin', 'manager'].includes(role)

  const [athletes,     setAthletes]     = useState([])
  const [applications, setApplications] = useState([])
  const [myAthletes,   setMyAthletes]   = useState([])
  const [loading,      setLoading]      = useState(false)
  const [editing,      setEditing]      = useState(null)
  const [editData,     setEditData]     = useState({})
  const [search,       setSearch]       = useState('')
  const [view,         setView]         = useState('athletes')
  const [resetUser,    setResetUser]    = useState(null)
  const [cf, setCfState] = useState({ gender: '', group: '', gup_dan: '', parent_name: '' })
  const setCf = (k, v) => setCfState(f => ({ ...f, [k]: v }))
  const resetFilters = () => { setSearch(''); setCfState({ gender: '', group: '', gup_dan: '', parent_name: '' }) }

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    if (isAdmin) { loadAthletes(); loadApplications() }
    else loadMyAthletes()
  }, [])

  const loadAthletes = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/users/athletes`, { headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) setAthletes(await r.json())
    } catch {}
    setLoading(false)
  }

  const loadApplications = async () => {
    try {
      const r = await fetch(`${API}/applications/`, { headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) setApplications(await r.json())
    } catch {}
  }

  const loadMyAthletes = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/users/my-athletes`, { headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) setMyAthletes(await r.json())
    } catch {}
    setLoading(false)
  }

  const startEdit = (a) => {
    setEditing(a.id)
    setEditData({ weight: a.weight || '', group: a.group || '', gup: a.gup || '', dan: a.dan || '' })
  }

  const saveEdit = async (id) => {
    const body = {}
    if (editData.weight) body.weight = parseFloat(editData.weight)
    if (editData.group)  body.group  = editData.group
    if (editData.gup)    body.gup    = parseInt(editData.gup)
    if (editData.dan)    body.dan    = parseInt(editData.dan)
    await fetch(`${API}/users/athletes/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setEditing(null)
    loadAthletes()
  }

  const deleteAthlete = async (id) => {
    if (!window.confirm('Удалить спортсмена из базы?')) return
    await fetch(`${API}/users/athletes/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    loadAthletes()
  }

  const updateAppStatus = async (id, status) => {
    await fetch(`${API}/applications/${id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    loadApplications()
  }

  const uniqueGroups  = useMemo(() => [...new Set(athletes.map(a => a.group || a.auto_group).filter(Boolean))].sort(), [athletes])
  const uniqueGupDan  = useMemo(() => { const v = new Set(); athletes.forEach(a => { if (a.dan) v.add(`${a.dan} дан`); else if (a.gup) v.add(`${a.gup} гып`) }); return [...v].sort() }, [athletes])
  const uniqueParents = useMemo(() => [...new Set(athletes.map(a => a.parent_name).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru')), [athletes])

  const filteredAthletes = useMemo(() => athletes.filter(a => {
    const s = search.toLowerCase()
    if (s && !a.full_name.toLowerCase().includes(s) && !(a.parent_name || '').toLowerCase().includes(s)) return false
    if (cf.gender && a.gender !== cf.gender) return false
    if (cf.group) { const g = a.group || a.auto_group || ''; if (g !== cf.group) return false }
    if (cf.gup_dan) { const val = a.dan ? `${a.dan} дан` : a.gup ? `${a.gup} гып` : ''; if (val !== cf.gup_dan) return false }
    if (cf.parent_name && a.parent_name !== cf.parent_name) return false
    return true
  }), [athletes, search, cf])

  const parents = useMemo(() => {
    const map = new Map()
    athletes.forEach(a => {
      if (!map.has(a.parent_phone)) {
        map.set(a.parent_phone, {
          user_id: a.user_id, parent_name: a.parent_name, parent_phone: a.parent_phone,
          children: athletes.filter(x => x.parent_phone === a.parent_phone).map(x => x.full_name),
        })
      }
    })
    return [...map.values()]
  }, [athletes])

  const filteredParents = parents.filter(p =>
    p.parent_name.toLowerCase().includes(search.toLowerCase()) ||
    p.children.join(' ').toLowerCase().includes(search.toLowerCase())
  )
  const filteredApps = applications.filter(a =>
    a.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (a.phone || '').includes(search)
  )

  const { sorted: sortedAthletes, sort: sortA,  toggle: toggleA  } = useSorted(filteredAthletes)
  const { sorted: sortedParents,  sort: sortP,  toggle: toggleP  } = useSorted(filteredParents)
  const { sorted: sortedApps,     sort: sortAp, toggle: toggleAp } = useSorted(filteredApps)

  const activeFiltersCount = Object.values(cf).filter(Boolean).length + (search ? 1 : 0)
  const logout = () => { localStorage.clear(); navigate('/login') }

  // ── КАБИНЕТ РОДИТЕЛЯ ────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <main className="cabinet-page">
        <div className="container cabinet-container">
          <div className="cabinet-header">
            <div>
              <p className="section-label">Личный кабинет</p>
              <h1 className="cabinet-title">{name}</h1>
            </div>
            <div style={{display:'flex',gap:'12px',alignItems:'center',flexWrap:'wrap'}}>
              <a href="/register?add=1" className="btn-outline" style={{fontSize:'13px',padding:'8px 16px'}}>
                + Добавить ребёнка
              </a>
              <button className="btn-outline cabinet-logout" onClick={logout}>Выйти</button>
            </div>
          </div>
          {loading && <div className="cabinet-loading">Загрузка...</div>}
          {!loading && myAthletes.length > 0 && (
            <div className="my-athletes">
              <p className="section-label" style={{ marginBottom: '16px' }}>Спортсмены</p>
              {myAthletes.map(a => (
                <div className="my-athlete-card" key={a.id}>
                  <div className="my-athlete-name">{a.full_name}</div>
                  <div className="my-athlete-details">
                    <span>Дата рождения: {a.birth_date}</span>
                    <span>{a.age} лет</span>
                    <span>{a.gender === 'male' ? 'Мужской' : 'Женский'}</span>
                    <span>{a.group || a.auto_group}</span>
                    <span>{a.dan ? `${a.dan} дан` : a.gup ? `${a.gup} гып` : 'Пояс не указан'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && myAthletes.length === 0 && (
            <div className="cabinet-coming">
              <p>Данные о спортсменах пока не добавлены.</p>
              <p>Если вы регистрировали ребёнка — обратитесь к тренеру.</p>
            </div>
          )}
        </div>
      </main>
    )
  }

  // ── КАБИНЕТ АДМИНА ──────────────────────────────────────────────────────────
  return (
    <main className="cabinet-page">
      {resetUser && (
        <ResetPasswordModal user={resetUser} token={token} onClose={() => setResetUser(null)} />
      )}
      <div className="container cabinet-container">
        <div className="cabinet-header">
          <div>
            <p className="section-label">Панель управления</p>
            <h1 className="cabinet-title">{name}</h1>
            <span className="cabinet-role-badge">{role === 'admin' ? 'Администратор' : 'Тренер'}</span>
          </div>
          <button className="btn-outline cabinet-logout" onClick={logout}>Выйти</button>
        </div>

        <div className="cabinet-tabs">
          <button className={`cabinet-tab ${view === 'athletes' ? 'active' : ''}`} onClick={() => setView('athletes')}>
            Спортсмены ({athletes.length})
          </button>
          <button className={`cabinet-tab ${view === 'parents' ? 'active' : ''}`} onClick={() => setView('parents')}>
            Родители ({parents.length})
          </button>
          <button className={`cabinet-tab ${view === 'applications' ? 'active' : ''}`} onClick={() => setView('applications')}>
            Заявки
            {applications.filter(a => a.status === 'new').length > 0 && (
              <span className="tab-badge">{applications.filter(a => a.status === 'new').length}</span>
            )}
          </button>
          <button className={`cabinet-tab ${view === 'attendance' ? 'active' : ''}`} onClick={() => setView('attendance')}>
            Журнал посещаемости
          </button>
          <button className={`cabinet-tab ${view === 'competitions' ? 'active' : ''}`} onClick={() => setView('competitions')}>
            Соревнования
          </button>
        </div>

        {view !== 'attendance' && view !== 'competitions' && (
          <div className="cabinet-toolbar">
            <div className="cabinet-search">
              <input type="text" placeholder="Поиск..."
                value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button className="cabinet-search-clear" onClick={() => setSearch('')}>✕</button>}
            </div>
            {activeFiltersCount > 0 && (
              <button className="cabinet-reset-filters" onClick={resetFilters}>
                Сбросить фильтры ({activeFiltersCount})
              </button>
            )}
          </div>
        )}

        {loading && <div className="cabinet-loading">Загрузка...</div>}

        {/* ── Журнал посещаемости ── */}
        {view === 'attendance' && (
          <AttendanceTab token={token} athletes={athletes} />
        )}

        {/* ── Соревнования ── */}
        {view === 'competitions' && (
          <CompetitionsTab token={token} athletes={athletes} />
        )}

        {/* ── Спортсмены ── */}
        {view === 'athletes' && (
          <div className="athletes-table-wrap">
            <table className="athletes-table">
              <thead>
                <tr>
                  <Th colKey="full_name"   sort={sortA} toggle={toggleA}>ФИО</Th>
                  <Th colKey="birth_date"  sort={sortA} toggle={toggleA}>Дата рожд.</Th>
                  <Th colKey="age"         sort={sortA} toggle={toggleA}>Возраст</Th>
                  <Th colKey="gender"      sort={sortA} toggle={toggleA}
                    filter={<ColFilter value={cf.gender} onChange={v => setCf('gender', v)} options={['male','female']} />}>Пол</Th>
                  <Th colKey="group"       sort={sortA} toggle={toggleA}
                    filter={<ColFilter value={cf.group} onChange={v => setCf('group', v)} options={uniqueGroups} />}>Группа</Th>
                  <Th colKey="gup"         sort={sortA} toggle={toggleA}
                    filter={<ColFilter value={cf.gup_dan} onChange={v => setCf('gup_dan', v)} options={uniqueGupDan} />}>Гып / Дан</Th>
                  <Th colKey="weight"      sort={sortA} toggle={toggleA}>Вес (кг)</Th>
                  <Th colKey="parent_name" sort={sortA} toggle={toggleA}
                    filter={<ColFilter value={cf.parent_name} onChange={v => setCf('parent_name', v)} options={uniqueParents} />}>Родитель</Th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {sortedAthletes.map(a => (
                  <tr key={a.id}>
                    <td className="td-name">{a.full_name}</td>
                    <td>{a.birth_date}</td>
                    <td>{a.age}</td>
                    <td>{a.gender === 'male' ? 'М' : 'Ж'}</td>
                    <td>{editing === a.id
                      ? <input value={editData.group} onChange={e=>setEditData(d=>({...d,group:e.target.value}))} className="td-input"/>
                      : (a.group || a.auto_group)}</td>
                    <td>{editing === a.id
                      ? <div style={{display:'flex',gap:'4px'}}>
                          <input placeholder="Гып" value={editData.gup} onChange={e=>setEditData(d=>({...d,gup:e.target.value,dan:''}))} className="td-input td-input-sm"/>
                          <input placeholder="Дан" value={editData.dan} onChange={e=>setEditData(d=>({...d,dan:e.target.value,gup:''}))} className="td-input td-input-sm"/>
                        </div>
                      : a.dan ? `${a.dan} дан` : a.gup ? `${a.gup} гып` : '—'}</td>
                    <td>{editing === a.id
                      ? <input value={editData.weight} placeholder="кг" onChange={e=>setEditData(d=>({...d,weight:e.target.value}))} className="td-input td-input-sm"/>
                      : a.weight ? `${a.weight} кг` : '—'}</td>
                    <td className="td-parent">
                      <div>{a.parent_name}</div>
                      <div className="td-phone">{a.parent_phone}</div>
                    </td>
                    <td className="td-actions">
                      {editing === a.id ? (
                        <>
                          <button className="td-btn td-btn-save" onClick={() => saveEdit(a.id)}>✓</button>
                          <button className="td-btn td-btn-cancel" onClick={() => setEditing(null)}>✕</button>
                        </>
                      ) : (
                        <>
                          <button className="td-btn td-btn-edit" onClick={() => startEdit(a)}>Ред.</button>
                          <button className="td-btn td-btn-del" onClick={() => deleteAthlete(a.id)}>Удал.</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sortedAthletes.length === 0 && !loading && <div className="cabinet-empty">Спортсменов не найдено</div>}
          </div>
        )}

        {/* ── Родители ── */}
        {view === 'parents' && (
          <div className="athletes-table-wrap">
            <table className="athletes-table">
              <thead>
                <tr>
                  <Th colKey="parent_name"  sort={sortP} toggle={toggleP}>ФИО родителя</Th>
                  <Th colKey="parent_phone" sort={sortP} toggle={toggleP}>Телефон</Th>
                  <Th colKey="children"     sort={sortP} toggle={toggleP}>Спортсмены</Th>
                  <th>Пароль</th>
                </tr>
              </thead>
              <tbody>
                {sortedParents.map((p, i) => (
                  <tr key={i}>
                    <td className="td-name">{p.parent_name}</td>
                    <td>{p.parent_phone}</td>
                    <td>{p.children.join(', ')}</td>
                    <td><button className="td-btn td-btn-edit" onClick={() => setResetUser(p)}>Сбросить пароль</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sortedParents.length === 0 && !loading && <div className="cabinet-empty">Родителей не найдено</div>}
          </div>
        )}

        {/* ── Заявки ── */}
        {view === 'applications' && (
          <div className="athletes-table-wrap">
            <table className="athletes-table">
              <thead>
                <tr>
                  <Th colKey="created_at" sort={sortAp} toggle={toggleAp}>Дата</Th>
                  <Th colKey="full_name"  sort={sortAp} toggle={toggleAp}>ФИО</Th>
                  <Th colKey="phone"      sort={sortAp} toggle={toggleAp}>Телефон</Th>
                  <th>Комментарий</th>
                  <Th colKey="status"     sort={sortAp} toggle={toggleAp}>Статус</Th>
                  <th>Изменить статус</th>
                </tr>
              </thead>
              <tbody>
                {sortedApps.map(a => {
                  const st = STATUS_LABELS[a.status] || { label: a.status, color: 'var(--gray)' }
                  return (
                    <tr key={a.id}>
                      <td style={{whiteSpace:'nowrap'}}>{new Date(a.created_at).toLocaleDateString('ru')}</td>
                      <td className="td-name">{a.full_name}</td>
                      <td>{a.phone}</td>
                      <td style={{fontSize:'13px',color:'var(--gray)',maxWidth:'200px'}}>{a.comment || '—'}</td>
                      <td><span style={{color:st.color,fontWeight:700,fontSize:'13px'}}>{st.label}</span></td>
                      <td>
                        <select className="td-status-select" value={a.status}
                          onChange={e => updateAppStatus(a.id, e.target.value)}>
                          <option value="new">Новая</option>
                          <option value="processing">В обработке</option>
                          <option value="confirmed">Подтверждена</option>
                          <option value="rejected">Отклонена</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {sortedApps.length === 0 && !loading && <div className="cabinet-empty">Заявок нет</div>}
          </div>
        )}
      </div>
    </main>
  )
}
