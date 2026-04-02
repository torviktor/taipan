import { useState, useEffect, useMemo } from 'react'
import { API, currentSeason, seasonRange, seasonLabel } from './constants'
import LineChart from './LineChart'

export default function AttendanceTab({ token, athletes }) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate]         = useState(today)
  const [group, setGroup]       = useState('junior')
  const [season, setSeason]     = useState(currentSeason)
  const [seasons, setSeasons]   = useState([currentSeason])
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [marks, setMarks]       = useState({})
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState('')
  const [viewMode, setViewMode] = useState('history')
  const [showChart, setShowChart] = useState(false)
  const [chartData, setChartData] = useState([])
  const [shownSessions, setShownSessions] = useState(10)

  const groupAthletes = useMemo(() =>
    athletes.filter(a => {
      const g = a.group || a.auto_group || ''
      if (group === 'junior')  return g.includes('6') || g.includes('Младшая')
      if (group === 'senior')  return g.includes('11') || g.includes('Старшая') || g.includes('18') || g.includes('Взрослые')
      return false
    })
  , [athletes, group])

  useEffect(() => {
    fetch(`${API}/attendance/seasons`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [currentSeason])
      .then(s => { setSeasons(s.length ? s : [currentSeason]) })
      .catch(() => {})
  }, [])

  useEffect(() => { loadSessions(); setShownSessions(10) }, [group, season])
  useEffect(() => { if (showChart) loadChartData(group) }, [showChart, group])

  const loadSessions = async () => {
    try {
      const { start, end } = seasonRange(season)
      const url = season !== '' ? `${API}/attendance/sessions?group_name=${group}&limit=300&date_from=${start}&date_to=${end}` : `${API}/attendance/sessions?group_name=${group}&limit=300`
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
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
        initMarks(groupAthletes, em)
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
      const mr = await fetch(`${API}/attendance/sessions/${sid}/mark`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ records })
      })
      if (!mr.ok) { const e = await mr.json(); setMsg(e.detail || 'Ошибка сохранения галочек'); setSaving(false); return }
      const savedMarks = {}
      records.forEach(r => { savedMarks[r.athlete_id] = r.present })
      setMarks(savedMarks)
      if (!activeSession) setActiveSession({ id: sid })
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
      <div className="comp-top" style={{marginBottom:8}}>
        <div className="comp-top-left">
          <select className="att-date-input" value={season} onChange={e => setSeason(e.target.value === '' ? '' : Number(e.target.value))} style={{width:'auto'}}>
            <option value="">Все сезоны</option>
            {seasons.map(y=>(
              <option key={y} value={y}>{seasonLabel(y)}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="attendance-header">
        <div className="attendance-group-tabs">
          <button className={`att-group-btn ${group === 'junior' ? 'active' : ''}`} onClick={() => { setGroup('junior'); setViewMode('history') }}>Младшая (6–10 лет)</button>
          <button className={`att-group-btn ${group === 'senior' ? 'active' : ''}`} onClick={() => { setGroup('senior'); setViewMode('history') }}>Старшая (11+)</button>
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
          {sessions.slice(0, shownSessions).map(s => (
            <div key={s.id} className="att-session-row" onClick={() => openSession(s)}>
              <span className="att-session-date">{new Date(s.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              <span className="att-session-stat">{s.present} / {s.total} присутствовали{s.total > 0 && <span className="att-pct"> ({Math.round(s.present/s.total*100)}%)</span>}</span>
              {s.notes && <span className="att-session-notes">{s.notes}</span>}
              <span className="att-session-edit">Открыть →</span>
            </div>
          ))}
          {sessions.length > shownSessions && (
            <button className="btn-outline" style={{ marginTop:12, width:'100%' }}
              onClick={() => setShownSessions(s => s + 10)}>
              Показать ещё ({sessions.length - shownSessions} тренировок)
            </button>
          )}
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
