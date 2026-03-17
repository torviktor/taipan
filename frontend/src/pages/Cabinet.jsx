import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import './Cabinet.css'
import './Competitions.css'

const API = '/api'

const GROUPS = ['Младшая группа (6–10 лет)', 'Старшая группа (11+)', 'Взрослые (18+)']

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
      if (group === 'junior')  return g.includes('6') || g.includes('Младшая')
      if (group === 'senior')  return g.includes('11') || g.includes('Старшая')
      if (group === 'adults')  return g.includes('18') || g.includes('Взрослые')
      return false
    })
  , [athletes, group])

  useEffect(() => { loadSessions() }, [group])
  useEffect(() => { if (showChart) loadChartData(group) }, [showChart, group])

  const loadSessions = async () => {
    try {
      const r = await fetch(`${API}/attendance/sessions?group_name=${group}&limit=50`, { headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) setSessions(await r.json())
    } catch {}
  }

  const loadChartData = async (grp) => {
    const g = grp || group
    try {
      const r = await fetch(`${API}/attendance/sessions?group_name=${g}&limit=200`, { headers: { Authorization: `Bearer ${token}` } })
      if (!r.ok) return
      const data = await r.json()
      const monthly = {}
      data.forEach(s => {
        const month = s.date ? s.date.substring(0, 7) : null
        if (!month) return
        if (!monthly[month]) monthly[month] = { month, sessions: 0, present: 0, total: 0 }
        monthly[month].sessions += 1
        monthly[month].present  += (s.present || 0)
        monthly[month].total    += (s.total   || 0)
      })
      setChartData(Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)))
    } catch (e) { console.error('Chart error:', e) }
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
          <button className={`att-group-btn ${group === 'junior' ? 'active' : ''}`} onClick={() => { setGroup('junior'); setViewMode('history') }}>Младшая (6–10 лет)</button>
          <button className={`att-group-btn ${group === 'senior' ? 'active' : ''}`} onClick={() => { setGroup('senior'); setViewMode('history') }}>Старшая (11+)</button>
          <button className={`att-group-btn ${group === 'adults' ? 'active' : ''}`} onClick={() => { setGroup('adults'); setViewMode('history') }}>Взрослые (18+)</button>
          <button className={`att-group-btn ${showChart ? 'active' : ''}`} onClick={() => {
            const next = !showChart
            setShowChart(next)
            if (next) loadChartData(group)
          }}>График</button>
        </div>
        <div className="attendance-view-tabs">
          <button className={`att-view-btn ${viewMode !== 'history' ? 'active' : ''}`} onClick={startNewSession}>+ Новая тренировка</button>
          <button className={`att-view-btn ${viewMode === 'history' ? 'active' : ''}`} onClick={() => setViewMode('history')}>История ({sessions.length})</button>
        </div>
      </div>
      {showChart && (
        <div style={{ background:'var(--dark2)', border:'1px solid var(--gray-dim)', borderRadius:10, padding:20, marginBottom:16 }}>
          <div style={{ marginBottom:8, fontSize:'0.85rem', color:'var(--gray)' }}>Тренировок в месяц</div>
          {chartData.length === 0
            ? <div className="cabinet-empty" style={{ cursor:'pointer' }} onClick={loadChartData}>Нет данных. Нажмите для загрузки.</div>
            : <LineChart data={chartData} xKey="month" yKey="sessions" color="var(--red)" height={180}/>
          }
          {chartData.length > 0 && (
            <>
              <div style={{ marginTop:20, marginBottom:8, fontSize:'0.85rem', color:'var(--gray)' }}>Присутствовало (чел.) в месяц</div>
              <LineChart data={chartData} xKey="month" yKey="present" color="#6cba6c" height={160}/>
            </>
          )}
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
  const [compConfirm,    setCompConfirm]    = useState(null)
  const [msg,            setMsg]            = useState('')
  const [form, setForm] = useState({ name:'', date:'', time:'09:00', location:'', level:'Местный', comp_type:'Турнир', notes:'', add_to_calendar: false })

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
          status:          ex.status          ?? 'pending',
          paid:            ex.paid            ?? false,
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
      const payload = rows.map(r => ({
          athlete_id:      r.athlete_id,
          sparring_place:  r.sparring_place  !== '' ? Number(r.sparring_place)  : null,
          sparring_fights: Number(r.sparring_fights) || 0,
          stopball_place:  r.stopball_place  !== '' ? Number(r.stopball_place)  : null,
          stopball_fights: Number(r.stopball_fights) || 0,
          tegtim_place:    r.tegtim_place    !== '' ? Number(r.tegtim_place)    : null,
          tegtim_fights:   Number(r.tegtim_fights)   || 0,
          tuli_place:      r.tuli_place      !== '' ? Number(r.tuli_place)      : null,
          tuli_perfs:      Number(r.tuli_perfs)      || 0,
          status:          r.status || 'pending',
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
        body: JSON.stringify({ name: form.name, date: form.date, time: form.time, location: form.location || null, level: form.level, comp_type: form.comp_type, notes: form.notes || null, add_to_calendar: form.add_to_calendar })
      })
      if (r.ok) {
        const created = await r.json()
        setShowForm(false)
        setForm({ name:'', date:'', time:'09:00', location:'', level:'Местный', comp_type:'Турнир', notes:'', add_to_calendar: false })
        setMsg('')
        await loadComps(); await loadSeasons()
        // п.1 — открываем карточку только что созданного соревнования
        await openDetail(created) // п.5 — возвращаем на список
      } else { const d = await r.json(); setMsg(d.detail || 'Ошибка') }
    } catch { setMsg('Ошибка создания') }
  }

  const deleteComp = (id, e) => {
    e.stopPropagation()
    setCompConfirm({
      message: 'Удалить соревнование и все результаты? Событие из календаря также будет удалено.',
      confirmText: 'Удалить',
      onConfirm: async () => {
        setCompConfirm(null)
        await fetch(`${API}/competitions/${id}`, { method: 'DELETE', headers: h })
        if (detail?.id === id) { setCompView('list'); setDetail(null) }
        await loadComps()
      }
    })
  }

  const notifyComp = async () => {
    if (!detail) return
    try {
      const r = await fetch(`${API}/competitions/${detail.id}/notify`, { method: 'POST', headers: hj })
      if (r.ok) { const d = await r.json(); setMsg(`Уведомлений отправлено: ${d.sent}`) }
      else setMsg('Ошибка отправки')
    } catch { setMsg('Ошибка отправки') }
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
      {compConfirm && <ConfirmModal message={compConfirm.message} confirmText={compConfirm.confirmText} danger={true} onConfirm={compConfirm.onConfirm} onCancel={() => setCompConfirm(null)}/>}
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
              {!readOnly && <button className="att-all-btn" onClick={notifyComp}>Уведомить всех</button>}
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
                  <th rowSpan="2">Взнос</th>
                  {!readOnly && <th rowSpan="2"></th>}
                </tr>
                <tr>
                  <th>Место</th><th>Бои</th>
                  <th>Место</th><th>Бои</th>
                  <th>Место</th><th>Бои</th>
                  <th>Место</th><th>Выст.</th>
                </tr>
              </thead>
              <tbody>
                {/* Сортируем: сначала confirmed/paid, потом pending, потом declined */}
                {[...rows].sort((a,b) => {
                  const order = {paid:0, confirmed:1, pending:2, declined:3}
                  return (order[a.status]??2) - (order[b.status]??2)
                }).map(r => {
                  const isGoing   = r.status === 'confirmed' || r.status === 'paid'
                  const isDeclined = r.status === 'declined'
                  const rowOpacity = isDeclined ? 0.3 : isGoing ? 1 : 0.55
                  return (
                  <tr key={r.athlete_id} style={{ opacity: rowOpacity }}>
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
                    <td style={{textAlign:'center'}}>
                      {!readOnly && <input type="checkbox" checked={r.paid||false}
                        onChange={async e => {
                          const paid = e.target.checked
                          updateRow(r.athlete_id, 'paid', paid)
                          await fetch(`${API}/competitions/${detail.id}/results/${r.athlete_id}/paid?paid=${paid}`, { method:'PATCH', headers:{Authorization:`Bearer ${token}`} })
                        }}
                        title={r.paid ? 'Оплачено' : 'Не оплачено'}
                      />}
                      {readOnly && <span style={{color: r.paid ? '#6cba6c' : 'var(--gray)', fontSize:'0.8rem'}}>{r.paid ? '✓' : '—'}</span>}
                    </td>
                    {!readOnly && (
                      <td>
                        <select className="td-input td-input-sm" value={r.status||'pending'}
                          onChange={e => updateRow(r.athlete_id, 'status', e.target.value)}
                          style={{color: isGoing ? '#6cba6c' : isDeclined ? 'var(--red)' : 'var(--gray)'}}>
                          <option value="pending">Ожидает</option>
                          <option value="confirmed">Едет</option>
                          <option value="declined">Не едет</option>
                        </select>
                      </td>
                    )}
                    {!readOnly && <td><button className="td-btn td-btn-del" onClick={() => removeRow(r.athlete_id)} title="Убрать из списка">✕</button></td>}
                  </tr>
                )})}
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
          <div className="modal-box comp-modal" onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:560 }}>
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
                <label>Время начала</label>
                <input type="time" className="modal-input" value={form.time} onChange={e=>setForm(p=>({...p,time:e.target.value}))} />
              </div>
              <div className="comp-field comp-field-full">
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
              <div className="comp-field comp-field-full">
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
              <div className="comp-field comp-field-full">
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', textTransform:'none', fontSize:'0.9rem', color:'var(--white)' }}>
                  <input type="checkbox" checked={form.add_to_calendar} onChange={e=>setForm(p=>({...p,add_to_calendar:e.target.checked}))} />
                  Добавить в календарь клуба
                </label>
              </div>
            </div>
            {msg && <div className="modal-msg">{msg}</div>}
            <div className="modal-msg" style={{ background:'#1a1200', border:'1px solid #c8962a', color:'#c8962a', marginBottom:8 }}>
              При создании все зарегистрированные пользователи получат уведомление с опросом об участии.
            </div>
            <div className="modal-btns-row">
              <button className="btn-primary" onClick={createComp}>Создать и уведомить всех</button>
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

// ── СОРЕВНОВАНИЯ ДЛЯ РОДИТЕЛЯ ─────────────────────────────────────────────────

function ParentCompetitionsTab({ token, athletes }) {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const results = []
    for (const a of athletes) {
      try {
        const r = await fetch(`${API}/competitions/rating/athlete/${a.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (r.ok) results.push(await r.json())
      } catch {}
    }
    setData(results)
    setLoading(false)
  }

  const placeLabel = (p) => p === 1 ? '1 место' : p === 2 ? '2 место' : p === 3 ? '3 место' : null
  const placeColor = (p) => p === 1 ? '#c8962a' : p === 2 ? '#aaaaaa' : p === 3 ? '#c87833' : 'var(--gray)'

  if (loading) return <div className="cabinet-loading">Загрузка...</div>
  if (data.length === 0) return <div className="cabinet-empty">Данные о соревнованиях пока недоступны.</div>

  return (
    <div>
      {data.map(a => (
        <div key={a.athlete_id} style={{ marginBottom: 24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div className="my-athlete-name">{a.full_name}</div>
            <div style={{ fontFamily:'Bebas Neue', fontSize:'1.2rem', color:'var(--red)' }}>
              {a.total_rating} pts
            </div>
          </div>

          {a.results.length === 0 && (
            <div style={{ color:'var(--gray)', fontSize:'0.85rem', padding:'12px 0' }}>
              Соревнований пока нет.
            </div>
          )}

          {a.results.map((r, i) => (
            <div key={i} style={{
              background:'var(--dark2)', border:'1px solid var(--gray-dim)',
              borderRadius:8, padding:'14px 16px', marginBottom:8
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom:8 }}>
                <div>
                  <div style={{ fontWeight:600, color:'var(--white)', marginBottom:4 }}>{r.competition_name}</div>
                  <div style={{ fontSize:'0.8rem', color:'var(--gray)', display:'flex', gap:10, flexWrap:'wrap' }}>
                    <span>{new Date(r.competition_date).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}</span>
                    <span className={`comp-badge ${LEVEL_BADGE[r.level]||''}`}>{r.level}</span>
                    <span className="comp-badge">{r.comp_type}</span>
                  </div>
                </div>
                <div style={{ fontFamily:'Bebas Neue', fontSize:'1.4rem', color:'var(--red)', flexShrink:0 }}>{r.rating} pts</div>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[
                  { label:'Спарринг', place: r.sparring_place, fights: r.sparring_fights, unit:'боёв' },
                  { label:'Стоп-балл', place: r.stopball_place, fights: r.stopball_fights, unit:'боёв' },
                  { label:'Тег-тим', place: r.tegtim_place, fights: r.tegtim_fights, unit:'боёв' },
                  { label:'Тули', place: r.tuli_place, fights: r.tuli_perfs, unit:'выст.' },
                ].filter(d => d.place || d.fights > 0).map((d, j) => (
                  <div key={j} style={{
                    background:'var(--dark)', border:`1px solid ${d.place ? placeColor(d.place) : 'var(--gray-dim)'}`,
                    borderRadius:6, padding:'6px 12px', minWidth:80, textAlign:'center'
                  }}>
                    <div style={{ fontSize:'0.72rem', color:'var(--gray)', marginBottom:3 }}>{d.label}</div>
                    {d.place && <div style={{ fontFamily:'Bebas Neue', fontSize:'1.1rem', color: placeColor(d.place) }}>{placeLabel(d.place)}</div>}
                    {d.fights > 0 && <div style={{ fontSize:'0.78rem', color:'var(--gray)' }}>{d.fights} {d.unit}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── АЧИВКИ ────────────────────────────────────────────────────────────────────

// SVG иконки убраны — используем только эмблему клуба

const TIER_STYLES = {
  common:    { border: '#555555', bg: '#111111', glow: 'none',                          label: 'Обычная' },
  rare:      { border: '#CC0000', bg: '#180000', glow: '0 0 14px rgba(204,0,0,0.5)',    label: 'Редкая' },
  legendary: { border: '#c8962a', bg: '#1a1200', glow: '0 0 18px rgba(200,150,42,0.6)', label: 'Легендарная' },
}

const TIER_LABEL = { common: 'Обычная', rare: 'Редкая', legendary: 'Легендарная' }

const CATEGORY_LABEL = {
  attendance:   'Посещаемость',
  competition:  'Соревнования',
  certification:'Аттестация',
  camp:         'Сборы',
}

function AchievementBadge({ ach, size = 'normal' }) {
  const style = TIER_STYLES[ach.tier] || TIER_STYLES.common
  const dim = size === 'small' ? 80 : 110
  const opacity = ach.granted ? 1 : 0.2

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, opacity, transition:'opacity 0.2s', width: dim + 20 }}>
      <div style={{
        width: dim, height: dim,
        border: `2px solid ${style.border}`,
        borderRadius: 8,
        background: style.bg,
        boxShadow: ach.granted ? style.glow : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Эмблема клуба — яркая, во всю площадь */}
        <img src="/logo.png" alt="" style={{
          width: '82%', height: '82%',
          objectFit: 'contain',
          opacity: ach.granted ? 0.9 : 0.15,
          filter: ach.granted
            ? (ach.tier === 'legendary'
                ? 'drop-shadow(0 0 8px rgba(200,150,42,0.8))'
                : ach.tier === 'rare'
                ? 'drop-shadow(0 0 6px rgba(204,0,0,0.8))'
                : 'none')
            : 'grayscale(1)',
          transition: 'all 0.2s',
          position: 'relative', zIndex: 1
        }}/>
        {/* Угловой индикатор редкости */}
        {ach.granted && (
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: 0, height: 0,
            borderStyle: 'solid',
            borderWidth: '0 22px 22px 0',
            borderColor: `transparent ${style.border} transparent transparent`,
          }}/>
        )}
      </div>
      <div style={{
        fontFamily: 'Bebas Neue, sans-serif',
        fontSize: size === 'small' ? '0.7rem' : '0.78rem',
        letterSpacing: '0.05em',
        color: ach.granted ? style.border : '#333',
        textAlign: 'center', lineHeight: 1.2,
        maxWidth: dim + 10
      }}>{ach.name}</div>
      {ach.granted && (
        <div style={{ fontSize: '0.65rem', color: 'var(--gray)', textAlign:'center' }}>
          {TIER_LABEL[ach.tier]}
        </div>
      )}
    </div>
  )
}

function AchievementsTab({ token, athletes }) {
  const [data,    setData]    = useState({})   // { athlete_id: [achievements] }
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const result = {}
    for (const a of athletes) {
      try {
        const r = await fetch(`${API}/achievements/athlete/${a.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (r.ok) result[a.id] = await r.json()
      } catch {}
    }
    setData(result)
    setLoading(false)
  }

  if (loading) return <div className="cabinet-loading">Загрузка...</div>
  if (athletes.length === 0) return <div className="cabinet-empty">Нет спортсменов.</div>

  const categories = ['attendance', 'competition', 'certification', 'camp']

  return (
    <div>
      {athletes.map(a => {
        const achs = data[a.id] || []
        const granted = achs.filter(x => x.granted).length
        const total   = achs.length

        return (
          <div key={a.id} style={{ marginBottom: 28 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div className="my-athlete-name">{a.full_name}</div>
              <div style={{ fontFamily:'Bebas Neue', fontSize:'1rem', color:'var(--gray)' }}>
                {granted} / {total} ачивок
              </div>
            </div>

            {categories.map(cat => {
              const catAchs = achs.filter(x => x.category === cat)
              if (catAchs.length === 0) return null
              return (
                <div key={cat} style={{ marginBottom: 20 }}>
                  <div style={{
                    fontSize: '0.75rem', fontFamily: 'Barlow Condensed, sans-serif',
                    fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: 'var(--gray)', marginBottom: 12
                  }}>{CATEGORY_LABEL[cat]}</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
                    {catAchs.map(ach => <AchievementBadge key={ach.code} ach={ach}/>)}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// Лидерборд ачивок для админа
function AchievementsLeaderboard({ token }) {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/achievements/leaderboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="cabinet-loading">Загрузка...</div>
  if (data.length === 0) return <div className="cabinet-empty">Ачивок пока нет.</div>

  return (
    <div className="athletes-table-wrap">
      <table className="athletes-table">
        <thead><tr>
          <th style={{width:50}}>Место</th>
          <th style={{textAlign:'left'}}>Спортсмен</th>
          <th>Группа</th>
          <th>Ачивок</th>
          <th>Легендарных</th>
        </tr></thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={r.athlete_id}>
              <td style={{textAlign:'center', fontFamily:'Bebas Neue', fontWeight:700, fontSize:'1.2rem'}}>{i+1}</td>
              <td className="td-name">{r.full_name}</td>
              <td>{r.group||'—'}</td>
              <td style={{textAlign:'center', fontWeight:700}}>{r.total}</td>
              <td style={{textAlign:'center', color:'#c8962a', fontWeight:700}}>{r.legendary||0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── СБОРЫ ─────────────────────────────────────────────────────────────────────

const CAMP_STATUS = {
  pending:   { label: 'Ожидает ответа', color: 'var(--gray)' },
  confirmed: { label: 'Едет',           color: '#6cba6c' },
  declined:  { label: 'Не едет',        color: 'var(--red)' },
  paid:      { label: 'Оплачено',       color: '#c8962a' },
}

function CampsTab({ token, athletes }) {
  const [camps,   setCamps]   = useState([])
  const [detail,  setDetail]  = useState(null)
  const [parts,   setParts]   = useState([])
  const [loading, setLoading] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showAdd,  setShowAdd]  = useState(false)
  const [msg,     setMsg]     = useState('')
  const [form, setForm] = useState({ name:'', date_start:'', date_end:'', location:'', price:'', notes:'' })

  const h  = { Authorization: `Bearer ${token}` }
  const hj = { ...h, 'Content-Type': 'application/json' }

  useEffect(() => { loadCamps() }, [])

  const loadCamps = async () => {
    setLoading(true)
    try { const r = await fetch(`${API}/camps`, { headers: h }); if (r.ok) setCamps(await r.json()) } catch {}
    setLoading(false)
  }

  const openDetail = async (camp) => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/camps/${camp.id}`, { headers: h })
      if (r.ok) { const d = await r.json(); setDetail(d); setParts(d.participants || []) }
    } catch {}
    setLoading(false)
  }

  const createCamp = async () => {
    if (!form.name || !form.date_start || !form.date_end) { setMsg('Заполните название и даты'); return }
    try {
      const r = await fetch(`${API}/camps`, {
        method: 'POST', headers: hj,
        body: JSON.stringify({ name: form.name, date_start: form.date_start, date_end: form.date_end, location: form.location || null, price: form.price ? parseFloat(form.price) : null, notes: form.notes || null })
      })
      if (r.ok) {
        const created = await r.json()
        setShowForm(false)
        setForm({ name:'', date_start:'', date_end:'', location:'', price:'', notes:'' })
        await loadCamps()
        await openDetail(created)
      }
      else { const d = await r.json(); setMsg(d.detail || 'Ошибка') }
    } catch { setMsg('Ошибка') }
  }

  const deleteCamp = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm('Удалить сборы?')) return
    await fetch(`${API}/camps/${id}`, { method: 'DELETE', headers: h })
    if (detail?.id === id) { setDetail(null); setParts([]) }
    await loadCamps()
  }

  const saveParticipants = async () => {
    if (!detail) return
    setSaving(true)
    try {
      const r = await fetch(`${API}/camps/${detail.id}/participants`, {
        method: 'PUT', headers: hj,
        body: JSON.stringify({ athlete_ids: parts.map(p => p.athlete_id) })
      })
      if (r.ok) { setParts(await r.json()); setMsg('Список сохранён') }
    } catch { setMsg('Ошибка') }
    setSaving(false)
  }

  const updateStatus = async (athlete_id, status, paid) => {
    if (!detail) return
    try {
      const r = await fetch(`${API}/camps/${detail.id}/participants/${athlete_id}`, {
        method: 'PATCH', headers: hj,
        body: JSON.stringify({ status, paid: paid ?? undefined })
      })
      if (r.ok) setParts(prev => prev.map(p => p.athlete_id === athlete_id ? { ...p, status, paid: paid ?? p.paid } : p))
    } catch {}
  }

  const notifyCamp = async () => {
    if (!detail) return
    try {
      const r = await fetch(`${API}/camps/${detail.id}/notify`, { method: 'POST', headers: hj })
      if (r.ok) { const d = await r.json(); setMsg(`Уведомлений отправлено: ${d.sent}`) }
    } catch { setMsg('Ошибка') }
  }

  const addAthlete = (a) => {
    if (parts.find(p => p.athlete_id === a.id)) return
    setParts(prev => [...prev, { athlete_id: a.id, full_name: a.full_name, group: a.group || a.auto_group, status: 'pending', paid: false }])
    setShowAdd(false)
  }

  const removeParticipant = (id) => setParts(prev => prev.filter(p => p.athlete_id !== id))
  const notInList = athletes.filter(a => !parts.find(p => p.athlete_id === a.id))

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' }) : ''
  const confirmedCount = parts.filter(p => p.status === 'confirmed' || p.status === 'paid').length
  const paidCount      = parts.filter(p => p.paid).length

  return (
    <div className="comp-wrap">
      <div className="comp-top">
        <div className="comp-top-left">
          {detail && <button className="att-all-btn" onClick={() => { setDetail(null); setParts([]); setMsg('') }}>← К списку</button>}
        </div>
        <div className="comp-top-right">
          {!detail && <button className="btn-primary" style={{ padding:'8px 18px', fontSize:'14px' }} onClick={() => { setShowForm(true); setMsg('') }}>+ Сборы</button>}
          {detail && (
            <>
              <button className="att-all-btn" onClick={notifyCamp}>Уведомить участников</button>
              <button className="att-all-btn" onClick={() => setShowAdd(true)}>+ Участник</button>
              <button className="btn-primary" style={{ padding:'8px 18px', fontSize:'14px' }} onClick={saveParticipants} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить список'}
              </button>
            </>
          )}
        </div>
      </div>

      {msg && <div className="att-msg">{msg}</div>}
      {loading && <div className="cabinet-loading">Загрузка...</div>}

      {/* Список сборов */}
      {!loading && !detail && (
        <div className="comp-list">
          {camps.length === 0 && <div className="cabinet-empty">Сборов пока нет.</div>}
          {camps.map(c => (
            <div key={c.id} className="comp-card" onClick={() => openDetail(c)}>
              <div className="comp-card-body">
                <div className="comp-card-name">{c.name}</div>
                <div className="comp-card-meta">
                  <span className="comp-card-date">{formatDate(c.date_start)} — {formatDate(c.date_end)}</span>
                  {c.location && <span className="comp-card-date">/ {c.location}</span>}
                  {c.price && <span className="comp-badge">{c.price} руб.</span>}
                  <span className="comp-badge" style={{ color:'#6cba6c' }}>{c.confirmed}/{c.total} едут</span>
                  {c.paid > 0 && <span className="comp-badge" style={{ color:'#c8962a' }}>{c.paid} оплатили</span>}
                </div>
              </div>
              <div className="comp-card-right">
                <button className="td-btn td-btn-del" onClick={e => deleteCamp(c.id, e)}>Удал.</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Детальный вид */}
      {!loading && detail && (
        <div className="comp-detail">
          <div className="comp-detail-head">
            <div>
              <div className="comp-detail-name">{detail.name}</div>
              <div className="comp-card-meta" style={{ marginTop:4 }}>
                <span className="comp-card-date">{formatDate(detail.date_start)} — {formatDate(detail.date_end)}</span>
                {detail.location && <span className="comp-card-date">/ {detail.location}</span>}
                {detail.price && <span className="comp-badge">{detail.price} руб.</span>}
                <span className="comp-badge" style={{ color:'#6cba6c' }}>{confirmedCount} едут</span>
                <span className="comp-badge" style={{ color:'#c8962a' }}>{paidCount} оплатили</span>
              </div>
            </div>
          </div>

          {/* Блок едут */}
          {parts.filter(p => p.status === 'confirmed' || p.status === 'paid').length > 0 && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontFamily:'Bebas Neue', fontSize:'1rem', letterSpacing:'0.08em', color:'#6cba6c', marginBottom:10 }}>
                ЕДУТ — {parts.filter(p => p.status === 'confirmed' || p.status === 'paid').length}
              </div>
              <table className="athletes-table">
                <thead><tr>
                  <th style={{textAlign:'left'}}>Спортсмен</th>
                  <th>Группа</th>
                  <th>Статус</th>
                  <th>Оплата</th>
                  <th></th>
                </tr></thead>
                <tbody>
                  {parts.filter(p => p.status === 'confirmed' || p.status === 'paid').map(p => (
                    <tr key={p.athlete_id}>
                      <td className="td-name">{p.full_name}</td>
                      <td style={{fontSize:'0.82rem',color:'var(--gray)'}}>{p.group||'—'}</td>
                      <td>
                        <select className="td-input" value={p.status} onChange={e => updateStatus(p.athlete_id, e.target.value, undefined)}>
                          <option value="pending">Ожидает</option>
                          <option value="confirmed">Едет</option>
                          <option value="declined">Не едет</option>
                          <option value="paid">Оплачено</option>
                        </select>
                      </td>
                      <td>
                        <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',justifyContent:'center'}}>
                          <input type="checkbox" checked={p.paid} onChange={e => updateStatus(p.athlete_id, e.target.checked ? 'paid' : 'confirmed', e.target.checked)}/>
                          <span style={{fontSize:'0.8rem',color: p.paid ? '#c8962a' : 'var(--gray)'}}>{p.paid ? 'Оплачено' : 'Не оплачено'}</span>
                        </label>
                      </td>
                      <td><button className="td-btn td-btn-del" onClick={() => removeParticipant(p.athlete_id)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Блок ожидают ответа */}
          {parts.filter(p => p.status === 'pending').length > 0 && (
            <div style={{ marginBottom:20, opacity:0.6 }}>
              <div style={{ fontFamily:'Bebas Neue', fontSize:'1rem', letterSpacing:'0.08em', color:'var(--gray)', marginBottom:10 }}>
                ОЖИДАЮТ ОТВЕТА — {parts.filter(p => p.status === 'pending').length}
              </div>
              <table className="athletes-table">
                <tbody>
                  {parts.filter(p => p.status === 'pending').map(p => (
                    <tr key={p.athlete_id}>
                      <td className="td-name">{p.full_name}</td>
                      <td style={{fontSize:'0.82rem',color:'var(--gray)'}}>{p.group||'—'}</td>
                      <td>
                        <select className="td-input" value={p.status} onChange={e => updateStatus(p.athlete_id, e.target.value, undefined)}>
                          <option value="pending">Ожидает</option>
                          <option value="confirmed">Едет</option>
                          <option value="declined">Не едет</option>
                          <option value="paid">Оплачено</option>
                        </select>
                      </td>
                      <td></td>
                      <td><button className="td-btn td-btn-del" onClick={() => removeParticipant(p.athlete_id)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Блок не едут */}
          {parts.filter(p => p.status === 'declined').length > 0 && (
            <div style={{ opacity:0.35 }}>
              <div style={{ fontFamily:'Bebas Neue', fontSize:'1rem', letterSpacing:'0.08em', color:'var(--red)', marginBottom:10 }}>
                НЕ ЕДУТ — {parts.filter(p => p.status === 'declined').length}
              </div>
              <table className="athletes-table">
                <tbody>
                  {parts.filter(p => p.status === 'declined').map(p => (
                    <tr key={p.athlete_id}>
                      <td className="td-name" style={{color:'var(--gray)'}}>{p.full_name}</td>
                      <td style={{fontSize:'0.82rem',color:'var(--gray)'}}>{p.group||'—'}</td>
                      <td>
                        <select className="td-input" value={p.status} onChange={e => updateStatus(p.athlete_id, e.target.value, undefined)}>
                          <option value="pending">Ожидает</option>
                          <option value="confirmed">Едет</option>
                          <option value="declined">Не едет</option>
                        </select>
                      </td>
                      <td></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {parts.length === 0 && <div className="cabinet-empty">Список пуст.</div>}
        </div>
      )}

      {/* Модал создания */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box comp-modal" onClick={e => e.stopPropagation()} style={{ maxWidth:520 }}>
            <h3>Новые сборы</h3>
            <div className="comp-form-grid">
              <div className="comp-field comp-field-full"><label>Название *</label>
                <input type="text" className="modal-input" placeholder="Летние сборы 2026" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></div>
              <div className="comp-field"><label>Дата начала *</label>
                <input type="date" className="modal-input" value={form.date_start} onChange={e=>setForm(p=>({...p,date_start:e.target.value}))}/></div>
              <div className="comp-field"><label>Дата окончания *</label>
                <input type="date" className="modal-input" value={form.date_end} onChange={e=>setForm(p=>({...p,date_end:e.target.value}))}/></div>
              <div className="comp-field"><label>Место</label>
                <input type="text" className="modal-input" placeholder="Подмосковье, база «Олимп»" value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))}/></div>
              <div className="comp-field"><label>Стоимость (руб.)</label>
                <input type="number" className="modal-input" placeholder="5000" value={form.price} onChange={e=>setForm(p=>({...p,price:e.target.value}))}/></div>
              <div className="comp-field comp-field-full"><label>Примечание</label>
                <input type="text" className="modal-input" value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}/></div>
            </div>
            {msg && <div className="modal-msg">{msg}</div>}
            <div className="modal-msg" style={{ background:'#1a1200', border:'1px solid #c8962a', color:'#c8962a', marginBottom:8 }}>
              При создании все зарегистрированные пользователи получат уведомление с опросом об участии.
            </div>
            <div className="modal-btns-row">
              <button className="btn-primary" onClick={createCamp}>Создать и уведомить всех</button>
              <button className="btn-outline" onClick={() => setShowForm(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Модал добавления участника */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Добавить участника</h3>
            {notInList.length === 0
              ? <p style={{ color:'var(--gray)' }}>Все спортсмены уже в списке.</p>
              : notInList.map(a => (
                  <div key={a.id} className="att-athlete-row absent" style={{ cursor:'pointer' }} onClick={() => addAthlete(a)}>
                    <div className="att-athlete-name">{a.full_name}</div>
                    <div className="att-athlete-age">{a.age} лет · {a.group || a.auto_group}</div>
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

// ── СБОРЫ ДЛЯ РОДИТЕЛЯ ────────────────────────────────────────────────────────

function ParentCampsTab({ token, athletes }) {
  const [camps,   setCamps]   = useState([])
  const [loading, setLoading] = useState(false)
  const [msg,     setMsg]     = useState('')

  const h  = { Authorization: `Bearer ${token}` }
  const hj = { ...h, 'Content-Type': 'application/json' }

  useEffect(() => { loadCamps() }, [])

  const loadCamps = async () => {
    setLoading(true)
    try { const r = await fetch(`${API}/camps`, { headers: h }); if (r.ok) setCamps(await r.json()) } catch {}
    setLoading(false)
  }

  const respond = async (campId, going) => {
    try {
      const r = await fetch(`${API}/camps/${campId}/respond?going=${going}`, { method: 'POST', headers: hj })
      if (r.ok) { setMsg(going ? 'Подтверждено участие' : 'Отказ зафиксирован'); await loadCamps() }
    } catch { setMsg('Ошибка') }
  }

  const myAthleteIds = athletes.map(a => a.id)

  if (loading) return <div className="cabinet-loading">Загрузка...</div>
  if (camps.length === 0) return <div className="cabinet-empty">Информации о сборах пока нет.</div>

  return (
    <div>
      {msg && <div className="att-msg">{msg}</div>}
      {camps.map(c => (
        <div key={c.id} className="my-athlete-card" style={{ marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
            <div>
              <div className="my-athlete-name" style={{ marginBottom:6 }}>{c.name}</div>
              <div style={{ fontSize:'0.84rem', color:'var(--gray)', display:'flex', gap:10, flexWrap:'wrap' }}>
                <span>{new Date(c.date_start).toLocaleDateString('ru-RU')} — {new Date(c.date_end).toLocaleDateString('ru-RU')}</span>
                {c.location && <span>{c.location}</span>}
                {c.price && <span style={{ color:'#c8962a' }}>{c.price} руб.</span>}
              </div>
            </div>
          </div>
          {c.total > 0 && (
            <div style={{ display:'flex', gap:8, marginTop:12 }}>
              <button className="btn-primary" style={{ padding:'7px 16px', fontSize:'13px' }} onClick={() => respond(c.id, true)}>
                Едем
              </button>
              <button className="btn-outline" style={{ padding:'7px 16px', fontSize:'13px' }} onClick={() => respond(c.id, false)}>
                Не едем
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── КАСТОМНОЕ ПОДТВЕРЖДЕНИЕ ───────────────────────────────────────────────────

function ConfirmModal({ message, onConfirm, onCancel, confirmText = 'Подтвердить', danger = false }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <p style={{ color:'var(--white)', fontSize:'0.95rem', lineHeight:1.6, marginBottom:20 }}>{message}</p>
        <div className="modal-btns-row">
          <button
            className={danger ? 'btn-primary' : 'btn-primary'}
            style={danger ? { background:'var(--red)' } : {}}
            onClick={onConfirm}
          >{confirmText}</button>
          <button className="btn-outline" onClick={onCancel}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

// ── БЕЙДЖ НЕПРОЧИТАННЫХ УВЕДОМЛЕНИЙ ──────────────────────────────────────────

function UnreadBadge({ token }) {
  const [count, setCount] = useState(0)
  const load = async () => {
    try {
      const r = await fetch(`${API}/notifications/unread-count`, { headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) { const d = await r.json(); setCount(d.count) }
    } catch {}
  }
  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    // Обновляем когда пользователь читает уведомления
    window.addEventListener('notifications-read', load)
    return () => { clearInterval(interval); window.removeEventListener('notifications-read', load) }
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
  const [confirm,     setConfirm]     = useState(null)  // { message, onConfirm, confirmText, danger }
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

  const finalize = () => {
    setConfirm({
      message: 'Завершить аттестацию? Гыпы и даны будут автоматически обновлены у всех сдавших спортсменов.',
      confirmText: 'Завершить',
      danger: true,
      onConfirm: async () => {
        setConfirm(null)
        try {
          const r = await fetch(`${API}/certifications/${detail.id}/finalize`, { method: 'POST', headers: hj })
          if (r.ok) {
            const d = await r.json()
            setMsg(`Завершено. Обновлено спортсменов: ${d.updated_athletes}`)
            await loadCerts(); await openDetail(detail)
          }
        } catch { setMsg('Ошибка') }
      }
    })
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

  const deleteCert = (id, e) => {
    e.stopPropagation()
    setConfirm({
      message: 'Удалить аттестацию и все её результаты?',
      confirmText: 'Удалить',
      danger: true,
      onConfirm: async () => {
        setConfirm(null)
        await fetch(`${API}/certifications/${id}`, { method: 'DELETE', headers: h })
        if (detail?.id === id) { setDetail(null); setRows([]) }
        await loadCerts()
      }
    })
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
      {confirm && <ConfirmModal message={confirm.message} confirmText={confirm.confirmText} danger={confirm.danger} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)}/>}
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
                <th>Оплата</th>
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
                    <td style={{textAlign:'center'}}>
                      <input type="checkbox" checked={r.paid||false}
                        onChange={async e => {
                          const paid = e.target.checked
                          updateRow(r.athlete_id, 'paid', paid)
                          await fetch(`${API}/certifications/${detail.id}/results/${r.athlete_id}/paid?paid=${paid}`, {
                            method:'PATCH', headers:{Authorization:`Bearer ${token}`}
                          })
                        }}
                        title={r.paid ? 'Оплачено' : 'Не оплачено'}
                      />
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
                      {a.age} лет · {a.dan ? `${a.dan} дан` : a.gup === 0 ? 'Без пояса' : a.gup ? `${a.gup} гып` : 'пояс не указан'}
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
    window.dispatchEvent(new Event('notifications-read'))
  }

  const markAllRead = async () => {
    await fetch(`${API}/notifications/read-all`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
    window.dispatchEvent(new Event('notifications-read'))
  }

  const respond = async (notifId, going) => {
    const r = await fetch(`${API}/notifications/${notifId}/respond?going=${going}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }
    })
    if (r.ok) {
      setNotifs(prev => prev.map(n => n.id === notifId ? { ...n, response: going ? 'going' : 'not_going', is_read: true } : n))
      window.dispatchEvent(new Event('notifications-read'))
    }
  }

  const typeLabel = (t) => {
    if (t === 'certification') return { text: 'АТТЕСТ.', color: '#6a8ecb', bg: '#1a1a2e' }
    if (t === 'competition')   return { text: 'ТУРНИР',  color: '#c8962a', bg: '#2a1e0a' }
    if (t === 'camp')          return { text: 'СБОРЫ',   color: '#6cba6c', bg: '#1c2a1c' }
    return                            { text: 'INFO',    color: 'var(--gray)', bg: 'var(--dark)' }
  }
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
        <div key={n.id}
          style={{
            background: n.is_read ? 'var(--dark2)' : '#1a1500',
            border: `1px solid ${n.is_read ? 'var(--gray-dim)' : '#c8962a'}`,
            borderRadius: 8, padding: '14px 16px', marginBottom: 10,
            transition: 'background 0.15s'
          }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}
            onClick={() => !n.is_read && !n.link_type && markRead(n.id)}
            style={{ cursor: !n.is_read && !n.link_type ? 'pointer' : 'default' }}>
            <div style={{ display:'flex', gap:10, alignItems:'flex-start', flex:1 }}>
              {(() => { const lbl = typeLabel(n.type); return (
                <span style={{ fontFamily:'Barlow Condensed, sans-serif', fontWeight:700, fontSize:'0.7rem', letterSpacing:'0.08em', padding:'3px 7px', borderRadius:3, background:lbl.bg, color:lbl.color, flexShrink:0, marginTop:2, whiteSpace:'nowrap' }}>{lbl.text}</span>
              )})()}
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
          {/* Кнопки опроса для сборов и соревнований */}
          {(n.link_type === 'camp' || n.link_type === 'competition') && (
            <div style={{ marginTop:12, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              {n.response === 'going' && <span style={{ color:'#6cba6c', fontSize:'0.85rem', fontWeight:600 }}>✓ Вы подтвердили участие</span>}
              {n.response === 'not_going' && <span style={{ color:'var(--gray)', fontSize:'0.85rem' }}>✗ Вы отказались от участия</span>}
              <button
                className="btn-primary" style={{ padding:'6px 16px', fontSize:'13px', background: n.response === 'going' ? '#1a3a1a' : undefined, border: n.response === 'going' ? '1px solid #6cba6c' : undefined }}
                onClick={() => respond(n.id, true)}>
                {n.link_type === 'camp' ? (n.response === 'going' ? 'Еду ✓' : 'Еду') : (n.response === 'going' ? 'Участвую ✓' : 'Участвую')}
              </button>
              <button
                className="btn-outline" style={{ padding:'6px 16px', fontSize:'13px' }}
                onClick={() => respond(n.id, false)}>
                {n.link_type === 'camp' ? 'Не еду' : 'Не участвую'}
              </button>
            </div>
          )}
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
            <button className={`cabinet-tab ${parentView==='athletes'?'active':''}`}      onClick={() => setParentView('athletes')}>Спортсмены</button>
            <button className={`cabinet-tab ${parentView==='attendance'?'active':''}`}    onClick={() => setParentView('attendance')}>Посещаемость</button>
            <button className={`cabinet-tab ${parentView==='competitions'?'active':''}`}  onClick={() => setParentView('competitions')}>Соревнования</button>
            <button className={`cabinet-tab ${parentView==='achievements'?'active':''}`}  onClick={() => setParentView('achievements')}>Ачивки</button>
            <button className={`cabinet-tab ${parentView==='camps'?'active':''}`}          onClick={() => setParentView('camps')}>Сборы</button>
            <button className={`cabinet-tab ${parentView==='rating'?'active':''}`}        onClick={() => setParentView('rating')}>Рейтинг</button>
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
                        <span>{a.dan ? `${a.dan} дан` : a.gup === 0 ? 'Без пояса' : a.gup ? `${a.gup} гып` : 'Пояс не указан'}</span>
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
          {parentView === 'competitions'  && !loading && <ParentCompetitionsTab token={token} athletes={myAthletes}/>}
          {parentView === 'achievements'  && !loading && <AchievementsTab token={token} athletes={myAthletes}/>}
          {parentView === 'camps'         && !loading && <ParentCampsTab  token={token} athletes={myAthletes}/>}
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
          <button className={`cabinet-tab ${view==='competitions'?'active':''}`}  onClick={() => setView('competitions')}>Соревнования</button>
          <button className={`cabinet-tab ${view==='rating'?'active':''}`}        onClick={() => setView('rating')}>Рейтинг</button>
          <button className={`cabinet-tab ${view==='certification'?'active':''}`} onClick={() => setView('certification')}>Аттестация</button>
          <button className={`cabinet-tab ${view==='achievements'?'active':''}`}  onClick={() => setView('achievements')}>Ачивки</button>
          <button className={`cabinet-tab ${view==='camps'?'active':''}`}         onClick={() => setView('camps')}>Сборы</button>
        </div>

        {view !== 'attendance' && view !== 'competitions' && view !== 'rating' && view !== 'certification' && view !== 'achievements' && view !== 'camps' && (
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
        {view === 'rating'        && <RatingTab        token={token} />}
        {view === 'certification' && <CertificationTab token={token} athletes={athletes} />}
        {view === 'achievements'  && <AchievementsLeaderboard token={token} />}
        {view === 'camps'         && <CampsTab token={token} athletes={athletes} />}

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
                          <select className="td-input td-input-sm" value={editData.gup} onChange={e=>setEditData(d=>({...d,gup:e.target.value,dan:''}))}>
                            <option value="">— гып</option>
                            <option value="0">Без пояса</option>
                            {[11,10,9,8,7,6,5,4,3,2,1].map(g=><option key={g} value={g}>{g} гып</option>)}
                          </select>
                          <select className="td-input td-input-sm" value={editData.dan} onChange={e=>setEditData(d=>({...d,dan:e.target.value,gup:''}))}>
                            <option value="">— дан</option>
                            {[1,2,3,4,5,6,7,8,9].map(d=><option key={d} value={d}>{d} дан</option>)}
                          </select>
                        </div>
                      : a.dan ? `${a.dan} дан` : a.gup === 0 ? 'Без пояса' : a.gup ? `${a.gup} гып` : '—'}</td>
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
