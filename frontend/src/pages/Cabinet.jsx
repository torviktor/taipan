import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import './Cabinet.css'
import './Competitions.css'

const API = '/api'

const GROUPS = ['Младшая группа (6–10 лет)', 'Старшая группа (11+)']

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

// ── Простой линейный SVG-график ───────────────────────────────────────────────
function LineChart({ data, xKey, yKey, color = 'var(--red)', height = 180 }) {
  if (!data || data.length === 0) return <div className="cabinet-empty">Нет данных</div>
  const vals = data.map(d => d[yKey])
  const max  = Math.max(...vals, 1)
  const W = 620, H = height
  // Увеличиваем нижний отступ если много точек — для диагональных подписей
  const bottomPad = data.length > 6 ? 60 : 36
  const PAD = { t: 20, r: 20, b: bottomPad, l: 36 }
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const px = i => PAD.l + (i / (data.length - 1 || 1)) * iw
  const py = v => PAD.t + ih - (v / max) * ih
  const pts = data.map((d, i) => `${px(i)},${py(d[yKey])}`).join(' ')
  const area = `M${px(0)},${py(0)} ` + data.map((d,i) => `L${px(i)},${py(d[yKey])}`).join(' ') + ` L${px(data.length-1)},${PAD.t+ih} L${px(0)},${PAD.t+ih} Z`
  const diagonal = data.length > 6
  return (
    <svg viewBox={`0 0 ${W} ${H + (diagonal ? 20 : 0)}`} style={{ width:'100%', maxWidth:W, display:'block' }}>
      {[0,0.5,1].map(f => <line key={f} x1={PAD.l} x2={W-PAD.r} y1={PAD.t+ih*(1-f)} y2={PAD.t+ih*(1-f)} stroke="var(--gray-dim)" strokeDasharray="4 3"/>)}
      <path d={area} fill={color} fillOpacity="0.1"/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={px(i)} cy={py(d[yKey])} r="4" fill={color}/>
          <text x={px(i)} y={py(d[yKey])-8} textAnchor="middle" fontSize="11" fill="var(--white)">{d[yKey]}</text>
          {diagonal
            ? <text
                transform={`translate(${px(i)}, ${H - bottomPad + 14}) rotate(-40)`}
                textAnchor="end" fontSize="10" fill="var(--gray)"
              >{d[xKey]}</text>
            : <text x={px(i)} y={H - bottomPad + 16} textAnchor="middle" fontSize="10" fill="var(--gray)">{d[xKey]}</text>
          }
        </g>
      ))}
      {[0, Math.round(max/2), max].map(v => <text key={v} x={PAD.l-4} y={py(v)+4} textAnchor="end" fontSize="10" fill="var(--gray)">{v}</text>)}
    </svg>
  )
}

// ── ЖУРНАЛ ПОСЕЩАЕМОСТИ ────────────────────────────────────────────────────────
function AttendanceTab({ token, athletes }) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate]         = useState(today)
  const [group, setGroup]       = useState('junior')
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [marks, setMarks]       = useState({})
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState('')
  const [viewMode, setViewMode] = useState('history')
  const [showChart, setShowChart] = useState(false)
  const [chartData, setChartData] = useState([])

  const groupAthletes = useMemo(() =>
    athletes.filter(a => {
      const g = a.group || a.auto_group || ''
      return group === 'junior'
        ? g.includes('6') || g.includes('Младшая')
        : g.includes('11') || g.includes('Старшая') || g.includes('Взрослые') || g.includes('16')
    })
  , [athletes, group])

  useEffect(() => { loadSessions() }, [group])
  useEffect(() => { if (showChart) loadChartData() }, [showChart, group])

  const loadSessions = async () => {
    try {
      const r = await fetch(`${API}/attendance/sessions?group_name=${group}&limit=50`, { headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) setSessions(await r.json())
    } catch {}
  }

  const loadChartData = async () => {
    try {
      const r = await fetch(`${API}/attendance/sessions?group_name=${group}&limit=200`, { headers: { Authorization: `Bearer ${token}` } })
      if (!r.ok) return
      const data = await r.json()
      const monthly = {}
      data.forEach(s => {
        const month = s.date.substring(0, 7)
        if (!monthly[month]) monthly[month] = { month, sessions: 0, present: 0, total: 0 }
        monthly[month].sessions += 1
        monthly[month].present  += s.present || 0
        monthly[month].total    += s.total   || 0
      })
      setChartData(Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)))
    } catch {}
  }

  const initMarks = (list, existing = {}) => {
    const m = {}
    list.forEach(a => { m[a.id] = existing[a.id] ?? false })
    setMarks(m)
  }

  const startNewSession = () => { initMarks(groupAthletes); setNotes(''); setActiveSession(null); setViewMode('create'); setMsg('') }

  const openSession = async (s) => {
    try {
      const r = await fetch(`${API}/attendance/sessions/${s.id}`, { headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) {
        const data = await r.json()
        const em = {}
        data.athletes.forEach(a => { em[a.id] = a.present })
        initMarks(data.athletes, em)
        setActiveSession(data); setNotes(data.notes || ''); setViewMode('session')
      }
    } catch {}
  }

  const saveSession = async () => {
    setSaving(true); setMsg('')
    try {
      let sid = activeSession?.id
      if (!sid) {
        const cr = await fetch(`${API}/attendance/sessions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, group_name: group, notes })
        })
        if (!cr.ok) { const e = await cr.json(); setMsg(e.detail || 'Ошибка'); setSaving(false); return }
        sid = (await cr.json()).id
      }
      const records = Object.entries(marks).map(([athlete_id, present]) => ({ athlete_id: parseInt(athlete_id), present }))
      await fetch(`${API}/attendance/sessions/${sid}/mark`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ records })
      })
      setMsg(`Сохранено! Присутствовало: ${records.filter(r => r.present).length} из ${records.length}`)
      loadSessions()
    } catch { setMsg('Ошибка сохранения') }
    setSaving(false)
  }

  const toggleAll = (val) => { const m = {}; Object.keys(marks).forEach(id => { m[id] = val }); setMarks(m) }
  const presentCount = Object.values(marks).filter(Boolean).length
  const totalCount   = Object.keys(marks).length

  return (
    <div className="attendance-wrap">
      <div className="attendance-header">
        <div className="attendance-group-tabs">
          <button className={`att-group-btn ${group === 'junior' ? 'active' : ''}`} onClick={() => { setGroup('junior'); setViewMode('history'); setShowChart(false) }}>Младшая (6–10 лет)</button>
          <button className={`att-group-btn ${group === 'senior' ? 'active' : ''}`} onClick={() => { setGroup('senior'); setViewMode('history'); setShowChart(false) }}>Старшая (11+)</button>
          <button className={`att-group-btn ${showChart ? 'active' : ''}`} onClick={() => setShowChart(v => !v)}>График</button>
        </div>
        <div className="attendance-view-tabs">
          <button className={`att-view-btn ${viewMode !== 'history' ? 'active' : ''}`} onClick={startNewSession}>+ Новая тренировка</button>
          <button className={`att-view-btn ${viewMode === 'history' ? 'active' : ''}`} onClick={() => setViewMode('history')}>История ({sessions.length})</button>
        </div>
      </div>
      {showChart && (
        <div style={{ background:'var(--dark2)', border:'1px solid var(--gray-dim)', borderRadius:10, padding:20, marginBottom:16 }}>
          <div style={{ marginBottom:8, fontSize:'0.85rem', color:'var(--gray)' }}>Тренировок в месяц</div>
          <LineChart data={chartData} xKey="month" yKey="sessions" color="var(--red)" height={180}/>
          <div style={{ marginTop:20, marginBottom:8, fontSize:'0.85rem', color:'var(--gray)' }}>Присутствовало (чел.) в месяц</div>
          <LineChart data={chartData} xKey="month" yKey="present" color="#6cba6c" height={160}/>
          {chartData.length === 0 && <div className="cabinet-empty">Нет данных для графика</div>}
        </div>
      )}
      {viewMode === 'history' && !showChart && (
        <div className="att-history">
          {sessions.length === 0 && <div className="cabinet-empty">Тренировок пока нет</div>}
          {sessions.map(s => (
            <div key={s.id} className="att-session-row" onClick={() => openSession(s)}>
              <span className="att-session-date">{new Date(s.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <span className="att-session-stat">{s.present} / {s.total} присутствовали{s.total > 0 && <span className="att-pct"> ({Math.round(s.present/s.total*100)}%)</span>}</span>
              {s.notes && <span className="att-session-notes">{s.notes}</span>}
              <span className="att-session-edit">Открыть →</span>
            </div>
          ))}
        </div>
      )}
      {viewMode !== 'history' && !showChart && (
        <div className="att-form">
          <div className="att-form-top">
            {viewMode === 'create' ? (
              <div className="att-date-row"><label>Дата тренировки</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="att-date-input" /></div>
            ) : (
              <div className="att-session-title">Тренировка: {new Date(activeSession.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            )}
            <div className="att-date-row"><label>Заметка к тренировке</label><input type="text" placeholder="Например: открытая тренировка..." value={notes} onChange={e => setNotes(e.target.value)} className="att-notes-input" /></div>
          </div>
          <div className="att-counter-row">
            <span className="att-counter">Присутствует: <strong>{presentCount}</strong> из <strong>{totalCount}</strong></span>
            <button className="att-all-btn" onClick={() => toggleAll(true)}>Все пришли</button>
            <button className="att-all-btn" onClick={() => toggleAll(false)}>Сбросить</button>
          </div>
          <div className="att-list">
            {groupAthletes.length === 0 && <div className="cabinet-empty">Нет спортсменов в этой группе</div>}
            {groupAthletes.map(a => (
              <div key={a.id} className={`att-athlete-row ${marks[a.id] ? 'present' : 'absent'}`} onClick={() => setMarks(m => ({ ...m, [a.id]: !m[a.id] }))}>
                <div className="att-check">{marks[a.id] ? '✓' : '—'}</div>
                <div className="att-athlete-name">{a.full_name}</div>
                <div className="att-athlete-age">{a.age} лет · {a.group || a.auto_group}</div>
              </div>
            ))}
          </div>
          {msg && <div className="att-msg">{msg}</div>}
          <button className="btn-primary att-save-btn" onClick={saveSession} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить тренировку'}</button>
        </div>
      )}
    </div>
  )
}

// ── ПОСЕЩАЕМОСТЬ ДЛЯ РОДИТЕЛЯ ──────────────────────────────────────────────────
function ParentAttendanceTab({ token, athletes }) {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const results = []
    for (const a of athletes) {
      try {
        const r = await fetch(`${API}/attendance/athlete/${a.id}?months=6`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (r.ok) results.push(await r.json())
      } catch {}
    }
    setData(results)
    setLoading(false)
  }

  if (loading) return <div className="cabinet-loading">Загрузка...</div>
  if (data.length === 0) return <div className="cabinet-empty">Данные о посещаемости пока недоступны.</div>

  return (
    <div>
      {data.map(a => (
        <div key={a.athlete_id} className="my-athlete-card" style={{ marginBottom: 20 }}>
          <div className="my-athlete-name" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span>{a.full_name}</span>
            <span style={{ fontFamily:'Bebas Neue', fontSize:'1.4rem', color: a.percent >= 70 ? '#6cba6c' : a.percent >= 50 ? '#c8962a' : 'var(--red)' }}>
              {a.percent}%
            </span>
          </div>
          <div className="my-athlete-details" style={{ marginTop:8 }}>
            <span>Тренировок за 6 мес.: {a.total}</span>
            <span style={{ color:'#6cba6c' }}>Присутствовал: {a.present}</span>
            <span style={{ color:'var(--gray)' }}>Пропустил: {a.absent}</span>
          </div>
          {a.monthly && a.monthly.length > 0 && (
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:'0.78rem', color:'var(--gray)', marginBottom:6 }}>По месяцам:</div>
              {a.monthly.map((m, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 0', fontSize:'0.84rem' }}>
                  <span style={{ color:'var(--gray)', minWidth:60 }}>{m.month}</span>
                  <div style={{ flex:1, height:6, background:'var(--gray-dim)', borderRadius:3, overflow:'hidden' }}>
                    <div style={{ height:'100%', width: m.total ? `${Math.round(m.present/m.total*100)}%` : '0%', background:'var(--red)', borderRadius:3 }}/>
                  </div>
                  <span style={{ color:'var(--white)', minWidth:50, textAlign:'right' }}>{m.present}/{m.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── РЕЙТИНГ ДЛЯ РОДИТЕЛЯ — используем CompetitionsTab с readOnly ───────────────

// ── РЕЙТИНГ (отдельная вкладка) ───────────────────────────────────────────────
function RatingTab({ token, myAthleteIds = [] }) {
  const [rating,       setRating]       = useState([])
  const [seasons,      setSeasons]      = useState([])
  const [season,       setSeason]       = useState('')
  const [ratingFilter, setRatingFilter] = useState('all')
  const [loading,      setLoading]      = useState(false)

  const h = { Authorization: `Bearer ${token}` }

  useEffect(() => { loadSeasons(); loadRating() }, [])
  useEffect(() => { loadRating() }, [season])

  const loadSeasons = async () => {
    try { const r = await fetch(`${API}/competitions/seasons`, { headers: h }); if (r.ok) setSeasons(await r.json()) } catch {}
  }

  const loadRating = async () => {
    setLoading(true)
    try {
      const url = season ? `${API}/competitions/rating/overall?season=${season}` : `${API}/competitions/rating/overall`
      const r = await fetch(url, { headers: h }); if (r.ok) setRating(await r.json())
    } catch {}
    setLoading(false)
  }

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new()
    const header = ['Место','ФИО','Возраст','Возр. кат.','Группа','Гып','Пол','Вес','Турниров','Рейтинг']
    const toRows = (data) => data.map((r,i) => [i+1, r.full_name, r.age||'', r.age_category||'', r.group||'', r.gup||'', r.gender||'', r.weight||'', r.tournaments_count, r.total_rating])
    // Общий лист
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...toRows(rating)]), 'Общий рейтинг')
    // Все категории отдельными листами
    const filters = [
      { key:'age_category', label:'Возраст' },
      { key:'group',        label:'Группа' },
      { key:'gender',       label:'Пол' },
      { key:'gup',          label:'Гып' },
    ]
    filters.forEach(f => {
      const groups = {}
      rating.forEach(r => { const k = String(r[f.key]||'Не указано'); if (!groups[k]) groups[k]=[]; groups[k].push(r) })
      Object.entries(groups).forEach(([key, rows_g]) => {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...toRows(rows_g)]), `${f.label} ${key}`.substring(0,31))
      })
    })
    XLSX.writeFile(wb, `Рейтинг_Тайпан_${season||'все'}.xlsx`)
  }

  const getRatingGroups = () => {
    const groups = {}
    rating.forEach(r => { const k = String(r[ratingFilter]||'Не указано'); if (!groups[k]) groups[k]=[]; groups[k].push(r) })
    return groups
  }

  const renderTable = (data) => (
    <div className="athletes-table-wrap">
      <table className="athletes-table">
        <thead><tr>
          <th style={{width:50}}>Место</th>
          <th style={{textAlign:'left'}}>Спортсмен</th>
          <th>Возраст</th><th>Группа</th><th>Гып</th><th>Вес</th><th>Пол</th><th>Турниров</th><th>Рейтинг</th>
        </tr></thead>
        <tbody>
          {data.map((r,i) => {
            const isMyChild = myAthleteIds.includes(r.athlete_id)
            return (
            <tr key={r.athlete_id} style={isMyChild ? { background:'#1a1500', outline:'1px solid #c8962a' } : {}}>
              <td style={{textAlign:'center',fontWeight:700,fontFamily:'Bebas Neue'}}>{i+1}</td>
              <td className="td-name">
                {isMyChild && <span style={{color:'#c8962a',fontWeight:700,marginRight:6}}>▶</span>}
                {r.full_name}
              </td>
              <td style={{textAlign:'center'}}>{r.age||'—'}<br/><span style={{fontSize:'0.72rem',color:'var(--gray)'}}>{r.age_category}</span></td>
              <td>{r.group||'—'}</td>
              <td style={{textAlign:'center'}}>{r.gup||'—'}</td>
              <td style={{textAlign:'center'}}>{r.weight?`${r.weight} кг`:'—'}</td>
              <td style={{textAlign:'center'}}>{r.gender==='male'?'М':r.gender==='female'?'Ж':'—'}</td>
              <td style={{textAlign:'center'}}>{r.tournaments_count}</td>
              <td className="comp-rating-val">{r.total_rating}</td>
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="comp-wrap">
      <div className="comp-top">
        <div className="comp-top-left">
          <select className="att-date-input" value={season} onChange={e => setSeason(e.target.value)} style={{width:'auto'}}>
            <option value="">Все сезоны</option>
            {seasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="comp-top-right">
          <button className="att-all-btn" onClick={exportXlsx}>Экспорт xlsx</button>
        </div>
      </div>

      <div className="comp-rating-filters">
        {[
          {key:'all',          label:'Общий'},
          {key:'age_category', label:'По возрасту'},
          {key:'group',        label:'По группе'},
          {key:'gender',       label:'По полу'},
          {key:'gup',          label:'По гыпу'},
        ].map(f => (
          <button key={f.key} className={`att-group-btn ${ratingFilter===f.key?'active':''}`} onClick={() => setRatingFilter(f.key)}>{f.label}</button>
        ))}
      </div>

      {loading && <div className="cabinet-loading">Загрузка...</div>}
      {!loading && rating.length === 0 && <div className="cabinet-empty">Результатов пока нет{season?` за ${season} год`:''}.</div>}
      {!loading && rating.length > 0 && (
        ratingFilter === 'all'
          ? renderTable(rating)
          : Object.entries(getRatingGroups()).map(([grp, rows_g]) => (
              <div key={grp} style={{marginBottom:28}}>
                <div className="comp-group-label">{grp}</div>
                {renderTable(rows_g)}
              </div>
            ))
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
  { value: 1,  label: '1 место' },
  { value: 2,  label: '2 место' },
  { value: 3,  label: '3 место' },
]

const LEVEL_BADGE = {
  'Местный':       'cbadge-local',
  'Региональный':  'cbadge-regional',
  'Окружной':      'cbadge-district',
  'Всероссийский': 'cbadge-national',
  'Международный': 'cbadge-international',
}

const AGE_CATEGORIES = ['6-7', '8-9', '10-11', '12-14', '15-17', '18+']

function calcRatingPreview(row, sig) {
  const pb = (p, b1, b2, b3) => p==1?b1:p==2?b2:p==3?b3:0
  const sp  = Number(row.sparring_place)  || 0
  const sf  = Number(row.sparring_fights) || 0
  const sbp = Number(row.stopball_place)  || 0
  const sbf = Number(row.stopball_fights) || 0
  const tgp = Number(row.tegtim_place)    || 0
  const tgf = Number(row.tegtim_fights)   || 0
  const tp  = Number(row.tuli_place)      || 0
  const tf  = Number(row.tuli_perfs)      || 0
  const spts  = sf  * 3   + pb(sp,  40, 24, 14)
  const sbpts = sbf * 2.5 + pb(sbp, 40, 24, 14)
  const tgpts = tgf * 2.5 + pb(tgp, 40, 24, 14)
  const tpts  = tf  * 2   + pb(tp,  25, 15,  9)
  let gold=0, silver=0, bronze=0
  ;[sp, sbp, tgp, tp].forEach(p => { if(p===1)gold++; else if(p===2)silver++; else if(p===3)bronze++ })
  const total = gold+silver+bronze
  let mb = 0
  if(gold>=2) mb=55
  else if(gold===1&&total===1) mb=30
  else if(total>=2) mb=40
  else if(silver===1&&total===1) mb=18
  else if(bronze===1&&total===1) mb=10
  const raw = spts+sbpts+tgpts+tpts+mb
  return raw>0 ? (sig*Math.log(raw+1)).toFixed(2) : '—'
}

function CompetitionsTab({ token, athletes, readOnly = false }) {
  const [compView,       setCompView]       = useState('list')
  const [comps,          setComps]          = useState([])
  const [seasons,        setSeasons]        = useState([])
  const [season,         setSeason]         = useState('')
  const [detail,         setDetail]         = useState(null)
  const [rows,           setRows]           = useState([])
  const [allAthletes,    setAllAthletes]    = useState([])
  const [rating,         setRating]         = useState([])
  const [ratingFilter,   setRatingFilter]   = useState('all')
  const [loading,        setLoading]        = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [showForm,       setShowForm]       = useState(false)
  const [showAddAthlete, setShowAddAthlete] = useState(false)
  const [showChart,      setShowChart]      = useState(false)
  const [chartData,      setChartData]      = useState([])
  const [msg,            setMsg]            = useState('')
  const [form, setForm] = useState({ name:'', date:'', location:'', level:'Местный', comp_type:'Турнир', notes:'' })

  const h  = { Authorization: `Bearer ${token}` }
  const hj = { ...h, 'Content-Type': 'application/json' }

  useEffect(() => { loadSeasons(); loadComps() }, [])
  useEffect(() => { loadComps() }, [season])
  useEffect(() => { if (showChart && comps.length > 0) buildChartData() }, [showChart, comps])

  const loadSeasons = async () => {
    try { const r = await fetch(`${API}/competitions/seasons`, { headers: h }); if (r.ok) setSeasons(await r.json()) } catch {}
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

  const buildChartData = async () => {
    const data = []
    for (const c of comps) {
      try {
        const r = await fetch(`${API}/competitions/${c.id}`, { headers: h })
        if (r.ok) {
          const d = await r.json()
          data.push({ name: c.name.length > 18 ? c.name.substring(0,18)+'…' : c.name, date: c.date, participants: (d.results||[]).length })
        }
      } catch {}
    }
    setChartData(data.sort((a,b) => a.date.localeCompare(b.date)))
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
      // Показываем только тех у кого уже есть результаты ИЛИ всех спортсменов клуба
      // Начинаем с тех у кого есть результаты + все остальные
      const participantIds = new Set(Object.keys(existingMap).map(Number))
      const baseList = athletes.map(a => {
        const ex = existingMap[a.id] || {}
        return {
          athlete_id:      a.id,
          full_name:       a.full_name,
          sparring_place:  ex.sparring_place  ?? '',
          sparring_fights: ex.sparring_fights ?? 0,
          stopball_place:  ex.stopball_place  ?? '',
          stopball_fights: ex.stopball_fights ?? 0,
          tegtim_place:    ex.tegtim_place    ?? '',
          tegtim_fights:   ex.tegtim_fights   ?? 0,
          tuli_place:      ex.tuli_place      ?? '',
          tuli_perfs:      ex.tuli_perfs      ?? 0,
          saved_rating:    ex.rating          ?? null,
          _inList:         true,
        }
      })
      setRows(baseList)
      setAllAthletes(athletes)
      setCompView('detail')
    } catch {}
    setLoading(false)
  }

  const removeRow = (athleteId) => {
    setRows(prev => prev.filter(r => r.athlete_id !== athleteId))
  }

  const addAthleteToList = (a) => {
    if (rows.find(r => r.athlete_id === a.id)) return
    setRows(prev => [...prev, {
      athlete_id: a.id, full_name: a.full_name,
      sparring_place: '', sparring_fights: 0,
      stopball_place: '', stopball_fights: 0,
      tegtim_place: '',   tegtim_fights: 0,
      tuli_place: '',     tuli_perfs: 0,
      saved_rating: null, _inList: true,
    }])
    setShowAddAthlete(false)
  }

  const saveResults = async () => {
    if (!detail) return
    setSaving(true); setMsg('')
    try {
      const payload = rows
        .filter(r => r.sparring_place !== '' || r.sparring_fights > 0 ||
                     r.stopball_place !== '' || r.stopball_fights > 0 ||
                     r.tegtim_place   !== '' || r.tegtim_fights   > 0 ||
                     r.tuli_place     !== '' || r.tuli_perfs      > 0)
        .map(r => ({
          athlete_id:      r.athlete_id,
          sparring_place:  r.sparring_place  !== '' ? Number(r.sparring_place)  : null,
          sparring_fights: Number(r.sparring_fights) || 0,
          stopball_place:  r.stopball_place  !== '' ? Number(r.stopball_place)  : null,
          stopball_fights: Number(r.stopball_fights) || 0,
          tegtim_place:    r.tegtim_place    !== '' ? Number(r.tegtim_place)    : null,
          tegtim_fights:   Number(r.tegtim_fights)   || 0,
          tuli_place:      r.tuli_place      !== '' ? Number(r.tuli_place)      : null,
          tuli_perfs:      Number(r.tuli_perfs)      || 0,
        }))
      const r = await fetch(`${API}/competitions/${detail.id}/results`, {
        method: 'PUT', headers: hj, body: JSON.stringify({ results: payload })
      })
      if (r.ok) {
        setMsg('Результаты сохранены')
        // Остаёмся на странице, обновляем сохранённые значения
        await openDetail(detail)
      } else setMsg('Ошибка сохранения')
    } catch { setMsg('Ошибка сохранения') }
    setSaving(false)
  }

  const createComp = async () => {
    if (!form.name.trim() || !form.date) { setMsg('Заполните название и дату'); return }
    try {
      const r = await fetch(`${API}/competitions`, {
        method: 'POST', headers: hj,
        body: JSON.stringify({ name: form.name, date: form.date, location: form.location || null, level: form.level, comp_type: form.comp_type, notes: form.notes || null })
      })
      if (r.ok) {
        setShowForm(false)
        setForm({ name:'', date:'', location:'', level:'Местный', comp_type:'Турнир', notes:'' })
        setMsg('')
        await loadComps(); await loadSeasons()
        setCompView('list') // п.5 — возвращаем на список
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
      const url = season ? `${API}/competitions/rating/overall?season=${season}` : `${API}/competitions/rating/overall`
      const r = await fetch(url, { headers: h })
      if (r.ok) { setRating(await r.json()); setCompView('rating') }
    } catch {}
    setLoading(false)
  }

  const exportXlsx = () => {
    const getFilteredData = () => {
      if (ratingFilter === 'all') return { 'Общий рейтинг': rating }
      const groups = {}
      rating.forEach(r => {
        const key = r[ratingFilter] || 'Не указано'
        if (!groups[key]) groups[key] = []
        groups[key].push(r)
      })
      return groups
    }

    const wb = XLSX.utils.book_new()
    const sheets = getFilteredData()
    Object.entries(sheets).forEach(([name, data]) => {
      const wsData = [
        ['Место', 'ФИО', 'Возраст', 'Возр. категория', 'Группа', 'Гып', 'Пол', 'Вес', 'Турниров', 'Рейтинг'],
        ...data.map((r, i) => [i+1, r.full_name, r.age||'', r.age_category||'', r.group||'', r.gup||'', r.gender||'', r.weight||'', r.tournaments_count, r.total_rating])
      ]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), name.substring(0, 31))
    })
    XLSX.writeFile(wb, `Рейтинг_Тайпан_${season || 'все'}.xlsx`)
  }

  const exportResultsXlsx = () => {
    if (!detail) return
    const wsData = [
      ['Спортсмен', 'Спарринг место', 'Спарринг бои', 'Стоп-балл место', 'Стоп-балл бои', 'Тег-тим место', 'Тег-тим бои', 'Тули место', 'Тули выступлений', 'Рейтинг'],
      ...rows.map(r => [
        r.full_name,
        r.sparring_place || '—', r.sparring_fights,
        r.stopball_place || '—', r.stopball_fights,
        r.tegtim_place   || '—', r.tegtim_fights,
        r.tuli_place     || '—', r.tuli_perfs,
        calcRatingPreview(r, detail.significance || 1)
      ])
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), 'Результаты')
    XLSX.writeFile(wb, `${detail.name}_${detail.date}.xlsx`)
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

  const notInList = allAthletes.filter(a => !rows.find(r => r.athlete_id === a.id))

  return (
    <div className="comp-wrap">
      {/* Шапка */}
      <div className="comp-top">
        <div className="comp-top-left">
          <select className="att-date-input" value={season} onChange={e => setSeason(e.target.value)} style={{ width: 'auto' }}>
            <option value="">Все сезоны</option>
            {seasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {compView !== 'list' && (
            <button className="att-all-btn" onClick={() => { setCompView('list'); setDetail(null); setMsg('') }}>← К списку</button>
          )}
        </div>
        <div className="comp-top-right">
          <button className={`att-all-btn ${showChart?'active':''}`} onClick={() => setShowChart(v=>!v)}>График</button>
          {!readOnly && (
            <button className="btn-primary" style={{ padding:'8px 18px', fontSize:'14px' }} onClick={() => { setShowForm(true); setMsg('') }}>
              + Соревнование
            </button>
          )}
        </div>
      </div>

      {showChart && (
        <div style={{ background:'var(--dark2)', border:'1px solid var(--gray-dim)', borderRadius:10, padding:20, marginBottom:16 }}>
          <div style={{ marginBottom:8, fontSize:'0.85rem', color:'var(--gray)' }}>Количество участников по соревнованиям</div>
          {chartData.length === 0
            ? <div className="cabinet-empty">Загрузка данных...</div>
            : <LineChart data={chartData} xKey="name" yKey="participants" color="var(--red)" height={200}/>
          }
        </div>
      )}

      {msg && <div className="att-msg">{msg}</div>}
      {loading && <div className="cabinet-loading">Загрузка...</div>}

      {/* ── Список ── */}
      {!loading && compView === 'list' && (
        <div className="comp-list">
          {comps.length === 0 && <div className="cabinet-empty">Соревнований пока нет{season ? ` в ${season} году` : ''}.</div>}
          {comps.map(c => (
            <div key={c.id} className="comp-card" onClick={() => openDetail(c)}>
              <div className="comp-card-body">
                <div className="comp-card-name">{c.name}</div>
                <div className="comp-card-meta">
                  <span className="comp-card-date">{new Date(c.date).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}</span>
                  {c.location && <span className="comp-card-date">/ {c.location}</span>}
                  <span className={`comp-badge ${LEVEL_BADGE[c.level] || ''}`}>{c.level}</span>
                  <span className="comp-badge">{c.comp_type}</span>
                </div>
              </div>
              <div className="comp-card-right">
                <span className="comp-sig">×{c.significance}</span>
                {!readOnly && <button className="td-btn td-btn-del" onClick={e => deleteComp(c.id, e)}>Удал.</button>}
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
              <div className="comp-card-meta" style={{ marginTop:4 }}>
                <span className="comp-card-date">{new Date(detail.date).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}</span>
                {detail.location && <span className="comp-card-date">/ {detail.location}</span>}
                <span className={`comp-badge ${LEVEL_BADGE[detail.level]||''}`}>{detail.level}</span>
                <span className="comp-badge">{detail.comp_type}</span>
                <span className="comp-sig">×{detail.significance}</span>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              {!readOnly && <button className="att-all-btn" onClick={() => setShowAddAthlete(true)}>+ Добавить бойца</button>}
              <button className="att-all-btn" onClick={exportResultsXlsx}>Экспорт xlsx</button>
              {!readOnly && (
                <button className="btn-primary" style={{ padding:'8px 18px', fontSize:'14px' }} onClick={saveResults} disabled={saving}>
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              )}
            </div>
          </div>

          <div className="athletes-table-wrap">
            <table className="athletes-table comp-results-table">
              <thead>
                <tr>
                  <th rowSpan="2" style={{ textAlign:'left' }}>Спортсмен</th>
                  <th colSpan="2">Спарринг</th>
                  <th colSpan="2">Стоп-балл</th>
                  <th colSpan="2">Тег-тим</th>
                  <th colSpan="2">Тули</th>
                  <th rowSpan="2">Рейтинг</th>
                  <th rowSpan="2"></th>
                </tr>
                <tr>
                  <th>Место</th><th>Бои</th>
                  <th>Место</th><th>Бои</th>
                  <th>Место</th><th>Бои</th>
                  <th>Место</th><th>Выст.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.athlete_id}>
                    <td className="td-name">{r.full_name}</td>
                    <td>{readOnly ? (r.sparring_place||'—') : <select className="td-input td-input-sm" value={r.sparring_place} onChange={e => updateRow(r.athlete_id,'sparring_place',e.target.value)}>{PLACE_OPTS.map(o=><option key={o.label} value={o.value}>{o.label}</option>)}</select>}</td>
                    <td>{readOnly ? r.sparring_fights : <input type="number" min="0" max="99" className="td-input td-input-sm" value={r.sparring_fights} onChange={e=>updateRow(r.athlete_id,'sparring_fights',e.target.value)}/>}</td>
                    <td>{readOnly ? (r.stopball_place||'—') : <select className="td-input td-input-sm" value={r.stopball_place} onChange={e=>updateRow(r.athlete_id,'stopball_place',e.target.value)}>{PLACE_OPTS.map(o=><option key={o.label} value={o.value}>{o.label}</option>)}</select>}</td>
                    <td>{readOnly ? r.stopball_fights : <input type="number" min="0" max="99" className="td-input td-input-sm" value={r.stopball_fights} onChange={e=>updateRow(r.athlete_id,'stopball_fights',e.target.value)}/>}</td>
                    <td>{readOnly ? (r.tegtim_place||'—') : <select className="td-input td-input-sm" value={r.tegtim_place} onChange={e=>updateRow(r.athlete_id,'tegtim_place',e.target.value)}>{PLACE_OPTS.map(o=><option key={o.label} value={o.value}>{o.label}</option>)}</select>}</td>
                    <td>{readOnly ? r.tegtim_fights : <input type="number" min="0" max="99" className="td-input td-input-sm" value={r.tegtim_fights} onChange={e=>updateRow(r.athlete_id,'tegtim_fights',e.target.value)}/>}</td>
                    <td>{readOnly ? (r.tuli_place||'—') : <select className="td-input td-input-sm" value={r.tuli_place} onChange={e=>updateRow(r.athlete_id,'tuli_place',e.target.value)}>{PLACE_OPTS.map(o=><option key={o.label} value={o.value}>{o.label}</option>)}</select>}</td>
                    <td>{readOnly ? r.tuli_perfs : <input type="number" min="0" max="99" className="td-input td-input-sm" value={r.tuli_perfs} onChange={e=>updateRow(r.athlete_id,'tuli_perfs',e.target.value)}/>}</td>
                    <td className="comp-rating-val">{calcRatingPreview(r, detail.significance||1)}</td>
                    {!readOnly && <td><button className="td-btn td-btn-del" onClick={() => removeRow(r.athlete_id)} title="Убрать из списка">✕</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <div className="cabinet-empty">Нет участников. Нажмите «+ Добавить бойца».</div>}
          </div>
        </div>
      )}

      {/* ── Рейтинг ── */}
      {!loading && compView === 'rating' && (
        <div>
          <div className="comp-rating-filters">
            {[
              { key: 'all',          label: 'Общий' },
              { key: 'age_category', label: 'По возрасту' },
              { key: 'group',        label: 'По группе' },
              { key: 'gender',       label: 'По полу' },
              { key: 'gup',          label: 'По гыпу' },
            ].map(f => (
              <button key={f.key} className={`att-group-btn ${ratingFilter===f.key?'active':''}`} onClick={() => setRatingFilter(f.key)}>{f.label}</button>
            ))}
            <button className="att-all-btn" onClick={exportXlsx}>Экспорт xlsx</button>
          </div>

          {rating.length === 0 && <div className="cabinet-empty">Результатов пока нет{season?` за ${season} год`:''}.</div>}

          {ratingFilter === 'all' ? (
            renderRatingTable(rating)
          ) : (
            Object.entries(getRatingGroups()).map(([group, rows_g]) => (
              <div key={group} style={{ marginBottom:28 }}>
                <div className="comp-group-label">{group}</div>
                {renderRatingTable(rows_g)}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Модал: создание соревнования ── */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box comp-modal" onClick={e => e.stopPropagation()}>
            <h3>Новое соревнование</h3>
            <div className="comp-form-grid">
              <div className="comp-field comp-field-full">
                <label>Название *</label>
                <input type="text" className="modal-input" placeholder="Открытое первенство..." value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} />
              </div>
              <div className="comp-field">
                <label>Дата *</label>
                <input type="date" className="modal-input" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} />
              </div>
              <div className="comp-field">
                <label>Место проведения</label>
                <input type="text" className="modal-input" placeholder="Москва, СК «Олимп»" value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))} />
              </div>
              <div className="comp-field">
                <label>Уровень</label>
                <select className="modal-input" value={form.level} onChange={e=>{const l=e.target.value;const t=typesForLevel(l);setForm(p=>({...p,level:l,comp_type:t.includes(p.comp_type)?p.comp_type:t[0]}))}}>
                  {LEVELS.map(l=><option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="comp-field">
                <label>Тип</label>
                <select className="modal-input" value={form.comp_type} onChange={e=>setForm(p=>({...p,comp_type:e.target.value}))}>
                  {typesForLevel(form.level).map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="comp-field">
                <label>Коэффициент значимости</label>
                <div className="comp-sig-preview">
                  <span>{form.level} · {form.comp_type}</span>
                  <span className="comp-sig">×{formSig}</span>
                </div>
              </div>
              <div className="comp-field comp-field-full">
                <label>Примечание</label>
                <input type="text" className="modal-input" placeholder="Дополнительно..." value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} />
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

      {/* ── Модал: добавить бойца ── */}
      {showAddAthlete && (
        <div className="modal-overlay" onClick={() => setShowAddAthlete(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Добавить бойца</h3>
            {notInList.length === 0
              ? <p style={{ color:'var(--gray)' }}>Все спортсмены уже в списке.</p>
              : notInList.map(a => (
                  <div key={a.id} className="att-athlete-row absent" style={{ cursor:'pointer' }} onClick={() => addAthleteToList(a)}>
                    <div className="att-athlete-name">{a.full_name}</div>
                    <div className="att-athlete-age">{a.age} лет · {a.group || a.auto_group}</div>
                  </div>
                ))
            }
            <div className="modal-btns-row" style={{ marginTop:12 }}>
              <button className="btn-outline" onClick={() => setShowAddAthlete(false)}>Закрыть</button>
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
              <th style={{ width:50 }}>Место</th>
              <th style={{ textAlign:'left' }}>Спортсмен</th>
              <th>Возраст</th>
              <th>Группа</th>
              <th>Гып</th>
              <th>Вес</th>
              <th>Пол</th>
              <th>Турниров</th>
              <th>Рейтинг</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={r.athlete_id}>
                <td style={{ textAlign:'center', fontWeight:700, fontFamily:'Bebas Neue' }}>{i+1}</td>
                <td className="td-name">{r.full_name}</td>
                <td style={{ textAlign:'center' }}>{r.age || '—'}<br/><span style={{ fontSize:'0.75rem', color:'var(--gray)' }}>{r.age_category}</span></td>
                <td>{r.group || '—'}</td>
                <td style={{ textAlign:'center' }}>{r.gup || '—'}</td>
                <td style={{ textAlign:'center' }}>{r.weight ? `${r.weight} кг` : '—'}</td>
                <td style={{ textAlign:'center' }}>{r.gender === 'male' ? 'М' : r.gender === 'female' ? 'Ж' : '—'}</td>
                <td style={{ textAlign:'center' }}>{r.tournaments_count}</td>
                <td className="comp-rating-val">{r.total_rating}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
}

// ── БЕЙДЖ НЕПРОЧИТАННЫХ УВЕДОМЛЕНИЙ ──────────────────────────────────────────

function UnreadBadge({ token }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API}/notifications/unread-count`, { headers: { Authorization: `Bearer ${token}` } })
        if (r.ok) { const d = await r.json(); setCount(d.count) }
      } catch {}
    }
    load()
    const interval = setInterval(load, 60000) // обновляем каждую минуту
    return () => clearInterval(interval)
  }, [token])
  if (count === 0) return null
  return <span className="tab-badge">{count}</span>
}

// ── АТТЕСТАЦИЯ ────────────────────────────────────────────────────────────────

function CertificationTab({ token, athletes }) {
  const [certs,       setCerts]       = useState([])
  const [detail,      setDetail]      = useState(null)
  const [rows,        setRows]        = useState([])
  const [loading,     setLoading]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [showForm,    setShowForm]    = useState(false)
  const [showAdd,     setShowAdd]     = useState(false)
  const [msg,         setMsg]         = useState('')
  const [form, setForm] = useState({ name: '', date: '', location: '', notes: '' })

  const h  = { Authorization: `Bearer ${token}` }
  const hj = { ...h, 'Content-Type': 'application/json' }

  useEffect(() => { loadCerts() }, [])

  const loadCerts = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/certifications`, { headers: h })
      if (r.ok) setCerts(await r.json())
    } catch {}
    setLoading(false)
  }

  const openDetail = async (cert) => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/certifications/${cert.id}`, { headers: h })
      if (!r.ok) return
      const d = await r.json()
      setDetail(d)
      const existingMap = {}
      ;(d.results || []).forEach(res => { existingMap[res.athlete_id] = res })
      setRows(Object.values(existingMap))
    } catch {}
    setLoading(false)
  }

  const saveRows = async () => {
    if (!detail) return
    setSaving(true); setMsg('')
    try {
      const payload = rows.map(r => ({
        athlete_id: r.athlete_id,
        target_gup: r.target_gup || null,
        target_dan: r.target_dan || null,
        passed:     r.passed ?? null,
      }))
      const r = await fetch(`${API}/certifications/${detail.id}/results`, {
        method: 'PUT', headers: hj, body: JSON.stringify({ results: payload })
      })
      if (r.ok) { setMsg('Список сохранён'); await openDetail(detail) }
      else setMsg('Ошибка сохранения')
    } catch { setMsg('Ошибка сохранения') }
    setSaving(false)
  }

  const finalize = async () => {
    if (!detail) return
    if (!window.confirm('Завершить аттестацию? Гыпы/даны будут обновлены у сдавших спортсменов.')) return
    try {
      const r = await fetch(`${API}/certifications/${detail.id}/finalize`, { method: 'POST', headers: hj })
      if (r.ok) {
        const d = await r.json()
        setMsg(`Завершено. Обновлено спортсменов: ${d.updated_athletes}`)
        await loadCerts(); await openDetail(detail)
      }
    } catch { setMsg('Ошибка') }
  }

  const sendNotify = async () => {
    if (!detail) return
    try {
      const r = await fetch(`${API}/certifications/${detail.id}/notify`, { method: 'POST', headers: hj })
      if (r.ok) { const d = await r.json(); setMsg(`Уведомлений отправлено: ${d.sent}`) }
    } catch { setMsg('Ошибка отправки') }
  }

  const createCert = async () => {
    if (!form.name.trim() || !form.date) { setMsg('Заполните название и дату'); return }
    try {
      const r = await fetch(`${API}/certifications`, {
        method: 'POST', headers: hj,
        body: JSON.stringify({ name: form.name, date: form.date, location: form.location || null, notes: form.notes || null })
      })
      if (r.ok) {
        setShowForm(false)
        setForm({ name: '', date: '', location: '', notes: '' })
        await loadCerts()
      } else { const d = await r.json(); setMsg(d.detail || 'Ошибка') }
    } catch { setMsg('Ошибка создания') }
  }

  const deleteCert = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm('Удалить аттестацию?')) return
    await fetch(`${API}/certifications/${id}`, { method: 'DELETE', headers: h })
    if (detail?.id === id) { setDetail(null); setRows([]) }
    await loadCerts()
  }

  const addAthlete = (a) => {
    if (rows.find(r => r.athlete_id === a.id)) return
    const nextGup = a.gup && a.gup > 1 ? a.gup - 1 : null
    setRows(prev => [...prev, {
      athlete_id: a.id, full_name: a.full_name, group: a.group || a.auto_group,
      current_gup: a.gup, current_dan: a.dan,
      target_gup: nextGup, target_dan: null, passed: null
    }])
    setShowAdd(false)
  }

  const removeRow = (id) => setRows(prev => prev.filter(r => r.athlete_id !== id))
  const updateRow = (id, field, val) => setRows(prev => prev.map(r => r.athlete_id === id ? { ...r, [field]: val } : r))

  const notInList = athletes.filter(a => !rows.find(r => r.athlete_id === a.id))

  const statusLabel = (s) => s === 'planned' ? 'Планируется' : s === 'active' ? 'Идёт' : 'Завершена'
  const statusColor = (s) => s === 'completed' ? '#6cba6c' : s === 'active' ? '#c8962a' : 'var(--gray)'

  return (
    <div className="comp-wrap">
      <div className="comp-top">
        <div className="comp-top-left">
          {detail && <button className="att-all-btn" onClick={() => { setDetail(null); setRows([]); setMsg('') }}>← К списку</button>}
        </div>
        <div className="comp-top-right">
          {!detail && <button className="btn-primary" style={{ padding:'8px 18px', fontSize:'14px' }} onClick={() => { setShowForm(true); setMsg('') }}>+ Аттестация</button>}
          {detail && detail.status !== 'completed' && (
            <>
              <button className="att-all-btn" onClick={sendNotify} title={detail.notify_sent ? 'Уведомления уже отправлены' : 'Уведомить родителей'}>
                {detail.notify_sent ? 'Уведомлено' : 'Уведомить'}
              </button>
              <button className="att-all-btn" onClick={() => setShowAdd(true)}>+ Добавить</button>
              <button className="att-all-btn" onClick={finalize}>Завершить аттестацию</button>
              <button className="btn-primary" style={{ padding:'8px 18px', fontSize:'14px' }} onClick={saveRows} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </>
          )}
        </div>
      </div>

      {msg && <div className="att-msg">{msg}</div>}
      {loading && <div className="cabinet-loading">Загрузка...</div>}

      {/* Список аттестаций */}
      {!loading && !detail && (
        <div className="comp-list">
          {certs.length === 0 && <div className="cabinet-empty">Аттестаций пока нет.</div>}
          {certs.map(c => (
            <div key={c.id} className="comp-card" onClick={() => openDetail(c)}>
              <div className="comp-card-body">
                <div className="comp-card-name">{c.name}</div>
                <div className="comp-card-meta">
                  <span className="comp-card-date">{new Date(c.date).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}</span>
                  {c.location && <span className="comp-card-date">/ {c.location}</span>}
                  <span style={{ fontSize:'0.75rem', color: statusColor(c.status), fontWeight:600 }}>{statusLabel(c.status)}</span>
                  {c.notify_sent && <span className="comp-badge" style={{ background:'#1a2a1a', color:'#6cba6c' }}>Уведомлено</span>}
                </div>
              </div>
              <div className="comp-card-right">
                <button className="td-btn td-btn-del" onClick={e => deleteCert(c.id, e)}>Удал.</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Список кандидатов */}
      {!loading && detail && (
        <div className="comp-detail">
          <div className="comp-detail-head">
            <div>
              <div className="comp-detail-name">{detail.name}</div>
              <div className="comp-card-meta" style={{ marginTop:4 }}>
                <span className="comp-card-date">{new Date(detail.date).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}</span>
                {detail.location && <span className="comp-card-date">/ {detail.location}</span>}
                <span style={{ fontSize:'0.75rem', color: statusColor(detail.status), fontWeight:600 }}>{statusLabel(detail.status)}</span>
              </div>
            </div>
          </div>
          <div className="athletes-table-wrap">
            <table className="athletes-table">
              <thead><tr>
                <th style={{ textAlign:'left' }}>Спортсмен</th>
                <th>Группа</th>
                <th>Текущий</th>
                <th>Целевой гып/дан</th>
                <th>Результат</th>
                <th></th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.athlete_id} style={r.passed === true ? { background:'#0d1f0d' } : r.passed === false ? { background:'#1f0d0d' } : {}}>
                    <td className="td-name">{r.full_name}</td>
                    <td style={{ fontSize:'0.82rem', color:'var(--gray)' }}>{r.group || '—'}</td>
                    <td style={{ textAlign:'center' }}>
                      {r.current_dan ? `${r.current_dan} дан` : r.current_gup ? `${r.current_gup} гып` : '—'}
                    </td>
                    <td>
                      {detail.status !== 'completed' ? (
                        <div style={{ display:'flex', gap:4 }}>
                          <input type="number" min="1" max="10" placeholder="гып" className="td-input td-input-sm"
                            value={r.target_gup || ''} onChange={e => updateRow(r.athlete_id, 'target_gup', e.target.value ? parseInt(e.target.value) : null)} style={{ width:52 }}/>
                          <input type="number" min="1" max="9" placeholder="дан" className="td-input td-input-sm"
                            value={r.target_dan || ''} onChange={e => updateRow(r.athlete_id, 'target_dan', e.target.value ? parseInt(e.target.value) : null)} style={{ width:52 }}/>
                        </div>
                      ) : (
                        r.target_dan ? `${r.target_dan} дан` : r.target_gup ? `${r.target_gup} гып` : '—'
                      )}
                    </td>
                    <td>
                      {detail.status !== 'completed' ? (
                        <select className="td-input" value={r.passed === null ? '' : r.passed ? 'true' : 'false'}
                          onChange={e => updateRow(r.athlete_id, 'passed', e.target.value === '' ? null : e.target.value === 'true')}>
                          <option value="">Не отмечено</option>
                          <option value="true">Сдал</option>
                          <option value="false">Не сдал</option>
                        </select>
                      ) : (
                        <span style={{ color: r.passed ? '#6cba6c' : 'var(--red)', fontWeight:600 }}>
                          {r.passed === null ? '—' : r.passed ? 'Сдал' : 'Не сдал'}
                        </span>
                      )}
                    </td>
                    <td>{detail.status !== 'completed' && <button className="td-btn td-btn-del" onClick={() => removeRow(r.athlete_id)}>✕</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <div className="cabinet-empty">Нет кандидатов. Нажмите «+ Добавить».</div>}
          </div>
        </div>
      )}

      {/* Модал создания */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box comp-modal" onClick={e => e.stopPropagation()}>
            <h3>Новая аттестация</h3>
            <div className="comp-form-grid">
              <div className="comp-field comp-field-full"><label>Название *</label>
                <input type="text" className="modal-input" placeholder="Аттестация апрель 2026" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}/>
              </div>
              <div className="comp-field"><label>Дата *</label>
                <input type="date" className="modal-input" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}/>
              </div>
              <div className="comp-field"><label>Место</label>
                <input type="text" className="modal-input" placeholder="Зал клуба" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}/>
              </div>
              <div className="comp-field comp-field-full"><label>Примечание</label>
                <input type="text" className="modal-input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}/>
              </div>
            </div>
            {msg && <div className="modal-msg">{msg}</div>}
            <div className="modal-btns-row">
              <button className="btn-primary" onClick={createCert}>Создать</button>
              <button className="btn-outline" onClick={() => setShowForm(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Модал добавления спортсмена */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Добавить кандидата</h3>
            {notInList.length === 0
              ? <p style={{ color:'var(--gray)' }}>Все спортсмены уже в списке.</p>
              : notInList.map(a => (
                  <div key={a.id} className="att-athlete-row absent" style={{ cursor:'pointer' }} onClick={() => addAthlete(a)}>
                    <div className="att-athlete-name">{a.full_name}</div>
                    <div className="att-athlete-age">
                      {a.age} лет · {a.dan ? `${a.dan} дан` : a.gup ? `${a.gup} гып` : 'пояс не указан'}
                    </div>
                  </div>
                ))
            }
            <div className="modal-btns-row" style={{ marginTop:12 }}>
              <button className="btn-outline" onClick={() => setShowAdd(false)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── УВЕДОМЛЕНИЯ ───────────────────────────────────────────────────────────────

function NotificationsTab({ token }) {
  const [notifs,  setNotifs]  = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadNotifs() }, [])

  const loadNotifs = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/notifications`, { headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) setNotifs(await r.json())
    } catch {}
    setLoading(false)
  }

  const markRead = async (id) => {
    await fetch(`${API}/notifications/${id}/read`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const markAllRead = async () => {
    await fetch(`${API}/notifications/read-all`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const typeIcon = (t) => t === 'certification' ? '🥋' : t === 'competition' ? '🏆' : t === 'camp' ? '🏕️' : '📢'
  const unreadCount = notifs.filter(n => !n.is_read).length

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <span style={{ color:'var(--gray)', fontSize:'0.9rem' }}>
          {unreadCount > 0 ? `Непрочитанных: ${unreadCount}` : 'Все уведомления прочитаны'}
        </span>
        {unreadCount > 0 && <button className="att-all-btn" onClick={markAllRead}>Прочитать все</button>}
      </div>

      {loading && <div className="cabinet-loading">Загрузка...</div>}
      {!loading && notifs.length === 0 && <div className="cabinet-empty">Уведомлений пока нет.</div>}

      {notifs.map(n => (
        <div key={n.id} onClick={() => !n.is_read && markRead(n.id)}
          style={{
            background: n.is_read ? 'var(--dark2)' : '#1a1500',
            border: `1px solid ${n.is_read ? 'var(--gray-dim)' : '#c8962a'}`,
            borderRadius: 8, padding: '14px 16px', marginBottom: 10,
            cursor: n.is_read ? 'default' : 'pointer',
            transition: 'background 0.15s'
          }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
            <div style={{ display:'flex', gap:10, alignItems:'flex-start', flex:1 }}>
              <span style={{ fontSize:'1.2rem', flexShrink:0 }}>{typeIcon(n.type)}</span>
              <div>
                <div style={{ fontWeight:600, color: n.is_read ? 'var(--gray)' : 'var(--white)', marginBottom:4 }}>{n.title}</div>
                <div style={{ fontSize:'0.85rem', color:'var(--gray)', lineHeight:1.5 }}>{n.body}</div>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
              <span style={{ fontSize:'0.75rem', color:'var(--gray)' }}>
                {new Date(n.created_at).toLocaleDateString('ru-RU', { day:'numeric', month:'short' })}
              </span>
              {!n.is_read && <span style={{ width:8, height:8, borderRadius:'50%', background:'#c8962a', display:'block' }}/>}
            </div>
          </div>
        </div>
      ))}
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
  const [parentView,   setParentView]   = useState('athletes') // для кабинета родителя
  const [cf, setCfState] = useState({ gender:'', group:'', gup_dan:'', parent_name:'' })
  const setCf = (k, v) => setCfState(f => ({ ...f, [k]: v }))
  const resetFilters = () => { setSearch(''); setCfState({ gender:'', group:'', gup_dan:'', parent_name:'' }) }

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
    setEditData({ weight: a.weight||'', group: a.group||'', gup: a.gup||'', dan: a.dan||'' })
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
    setEditing(null); loadAthletes()
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

  const uniqueGroups  = useMemo(() => GROUPS, [])  // п.7 — фиксированный справочник
  const uniqueGupDan  = useMemo(() => { const v = new Set(); athletes.forEach(a => { if (a.dan) v.add(`${a.dan} дан`); else if (a.gup) v.add(`${a.gup} гып`) }); return [...v].sort() }, [athletes])
  const uniqueParents = useMemo(() => [...new Set(athletes.map(a => a.parent_name).filter(Boolean))].sort((a,b) => a.localeCompare(b,'ru')), [athletes])

  const filteredAthletes = useMemo(() => athletes.filter(a => {
    const s = search.toLowerCase()
    if (s && !a.full_name.toLowerCase().includes(s) && !(a.parent_name||'').toLowerCase().includes(s)) return false
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
    (a.phone||'').includes(search)
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
            <div style={{ display:'flex', gap:'12px', alignItems:'center', flexWrap:'wrap' }}>
              <a href="/register?add=1" className="btn-outline" style={{ fontSize:'13px', padding:'8px 16px' }}>+ Добавить ребёнка</a>
              <button className="btn-outline cabinet-logout" onClick={logout}>Выйти</button>
            </div>
          </div>

          {/* п.8 — вкладки родителя */}
          <div className="cabinet-tabs">
            <button className={`cabinet-tab ${parentView==='athletes'?'active':''}`}    onClick={() => setParentView('athletes')}>Спортсмены</button>
            <button className={`cabinet-tab ${parentView==='attendance'?'active':''}`}  onClick={() => setParentView('attendance')}>Посещаемость</button>
            <button className={`cabinet-tab ${parentView==='rating'?'active':''}`}      onClick={() => setParentView('rating')}>Рейтинг</button>
            <button className={`cabinet-tab ${parentView==='notifications'?'active':''}`} onClick={() => setParentView('notifications')}>
              Уведомления
              <UnreadBadge token={token}/>
            </button>
          </div>

          {loading && <div className="cabinet-loading">Загрузка...</div>}

          {parentView === 'athletes' && !loading && (
            <>
              {myAthletes.length > 0 ? (
                <div className="my-athletes">
                  <p className="section-label" style={{ marginBottom:'16px' }}>Спортсмены</p>
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
              ) : (
                <div className="cabinet-coming">
                  <p>Данные о спортсменах пока не добавлены.</p>
                  <p>Если вы регистрировали ребёнка — обратитесь к тренеру.</p>
                </div>
              )}
            </>
          )}

          {parentView === 'attendance'    && !loading && <ParentAttendanceTab token={token} athletes={myAthletes}/>}
          {parentView === 'rating'        && !loading && <RatingTab token={token} myAthleteIds={myAthletes.map(a=>a.id)}/>}
          {parentView === 'notifications' && <NotificationsTab token={token}/>}
        </div>
      </main>
    )
  }

  // ── КАБИНЕТ АДМИНА ──────────────────────────────────────────────────────────
  return (
    <main className="cabinet-page">
      {resetUser && <ResetPasswordModal user={resetUser} token={token} onClose={() => setResetUser(null)} />}
      <div className="container cabinet-container">
        <div className="cabinet-header">
          <div>
            <p className="section-label">Панель управления</p>
            <h1 className="cabinet-title">{name}</h1>
            <span className="cabinet-role-badge">{role === 'admin' ? 'Администратор' : 'Тренер'}</span>
          </div>
          <button className="btn-outline cabinet-logout" onClick={logout}>Выйти</button>
        </div>

        {/* п.5 — вкладка Соревнования кликабельна, сбрасывает состояние */}
        <div className="cabinet-tabs">
          <button className={`cabinet-tab ${view==='athletes'?'active':''}`} onClick={() => setView('athletes')}>Спортсмены ({athletes.length})</button>
          <button className={`cabinet-tab ${view==='parents'?'active':''}`} onClick={() => setView('parents')}>Родители ({parents.length})</button>
          <button className={`cabinet-tab ${view==='applications'?'active':''}`} onClick={() => setView('applications')}>
            Заявки
            {applications.filter(a => a.status==='new').length > 0 && (
              <span className="tab-badge">{applications.filter(a => a.status==='new').length}</span>
            )}
          </button>
          <button className={`cabinet-tab ${view==='attendance'?'active':''}`} onClick={() => setView('attendance')}>Журнал посещаемости</button>
          <button className={`cabinet-tab ${view==='competitions'?'active':''}`} onClick={() => setView('competitions')}>Соревнования</button>
          <button className={`cabinet-tab ${view==='rating'?'active':''}`} onClick={() => setView('rating')}>Рейтинг</button>
          <button className={`cabinet-tab ${view==='certification'?'active':''}`} onClick={() => setView('certification')}>Аттестация</button>
        </div>

        {view !== 'attendance' && view !== 'competitions' && view !== 'rating' && view !== 'certification' && (
          <div className="cabinet-toolbar">
            <div className="cabinet-search">
              <input type="text" placeholder="Поиск..." value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button className="cabinet-search-clear" onClick={() => setSearch('')}>✕</button>}
            </div>
            {activeFiltersCount > 0 && (
              <button className="cabinet-reset-filters" onClick={resetFilters}>Сбросить фильтры ({activeFiltersCount})</button>
            )}
          </div>
        )}

        {loading && <div className="cabinet-loading">Загрузка...</div>}

        {view === 'attendance'   && <AttendanceTab    token={token} athletes={athletes} />}
        {view === 'competitions' && <CompetitionsTab  token={token} athletes={athletes} />}
        {view === 'rating'       && <RatingTab        token={token} />}
        {view === 'certification'&& <CertificationTab token={token} athletes={athletes} />}

        {/* ── Спортсмены ── */}
        {view === 'athletes' && (
          <div className="athletes-table-wrap">
            <table className="athletes-table">
              <thead>
                <tr>
                  <Th colKey="full_name"   sort={sortA} toggle={toggleA}>ФИО</Th>
                  <Th colKey="birth_date"  sort={sortA} toggle={toggleA}>Дата рожд.</Th>
                  <Th colKey="age"         sort={sortA} toggle={toggleA}>Возраст</Th>
                  <Th colKey="gender"      sort={sortA} toggle={toggleA} filter={<ColFilter value={cf.gender} onChange={v=>setCf('gender',v)} options={['male','female']} />}>Пол</Th>
                  {/* п.7 — группа только из справочника */}
                  <Th colKey="group"       sort={sortA} toggle={toggleA} filter={<ColFilter value={cf.group} onChange={v=>setCf('group',v)} options={GROUPS} />}>Группа</Th>
                  <Th colKey="gup"         sort={sortA} toggle={toggleA} filter={<ColFilter value={cf.gup_dan} onChange={v=>setCf('gup_dan',v)} options={uniqueGupDan} />}>Гып / Дан</Th>
                  <Th colKey="weight"      sort={sortA} toggle={toggleA}>Вес (кг)</Th>
                  <Th colKey="parent_name" sort={sortA} toggle={toggleA} filter={<ColFilter value={cf.parent_name} onChange={v=>setCf('parent_name',v)} options={uniqueParents} />}>Родитель</Th>
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
                    <td>
                      {editing === a.id
                        /* п.7 — select вместо свободного ввода */
                        ? <select value={editData.group} onChange={e=>setEditData(d=>({...d,group:e.target.value}))} className="td-input">
                            <option value="">—</option>
                            {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        : (a.group || a.auto_group)}
                    </td>
                    <td>{editing === a.id
                      ? <div style={{ display:'flex', gap:'4px' }}>
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
                        <><button className="td-btn td-btn-save" onClick={() => saveEdit(a.id)}>✓</button><button className="td-btn td-btn-cancel" onClick={() => setEditing(null)}>✕</button></>
                      ) : (
                        <><button className="td-btn td-btn-edit" onClick={() => startEdit(a)}>Ред.</button><button className="td-btn td-btn-del" onClick={() => deleteAthlete(a.id)}>Удал.</button></>
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
                      <td style={{ whiteSpace:'nowrap' }}>{new Date(a.created_at).toLocaleDateString('ru')}</td>
                      <td className="td-name">{a.full_name}</td>
                      <td>{a.phone}</td>
                      <td style={{ fontSize:'13px', color:'var(--gray)', maxWidth:'200px' }}>{a.comment || '—'}</td>
                      <td><span style={{ color:st.color, fontWeight:700, fontSize:'13px' }}>{st.label}</span></td>
                      <td>
                        <select className="td-status-select" value={a.status} onChange={e => updateAppStatus(a.id, e.target.value)}>
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
