import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import './Cabinet.css'

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
  const [viewMode, setViewMode]   = useState('create') // 'create' | 'history' | 'session'

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
        // Создаём новую тренировку
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

      // Отмечаем посещаемость
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
      {/* Шапка */}
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

      {/* История тренировок */}
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

      {/* Форма новой / редактирование тренировки */}
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

          {/* Счётчик + кнопки выбора всех */}
          <div className="att-counter-row">
            <span className="att-counter">
              Присутствует: <strong>{presentCount}</strong> из <strong>{totalCount}</strong>
            </span>
            <button className="att-all-btn" onClick={() => toggleAll(true)}>Все пришли</button>
            <button className="att-all-btn" onClick={() => toggleAll(false)}>Сбросить</button>
          </div>

          {/* Список спортсменов */}
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
        </div>

        {view !== 'attendance' && (
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
