import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import './Cabinet.css'
import './Competitions.css'
import CompApplicationMatrix from './CompApplicationMatrix'
import InsuranceTab from './InsuranceTab'
import StrategyTab  from './StrategyTab'
import { API, GROUPS, getSeason, seasonLabel, currentSeason, currentSeasonLabel, seasonRange } from '../cabinet/constants'
import { useSorted, SortIcon, Th, ColFilter } from '../cabinet/tableUtils'
import ResetPasswordModal from '../cabinet/ResetPasswordModal'
import LineChart from '../cabinet/LineChart'
import ConfirmModal from '../cabinet/ConfirmModal'
import UnreadBadge from '../cabinet/UnreadBadge'
import BeltDisplay from '../cabinet/BeltDisplay'
import ParentCampsTab from '../cabinet/ParentCampsTab'
import ParentAttendanceTab from '../cabinet/ParentAttendanceTab'
import ParentCompetitionsTab from '../cabinet/ParentCompetitionsTab'
import ParentAnalyticsTab from '../cabinet/ParentAnalyticsTab'
import ParentInsuranceTab from '../cabinet/ParentInsuranceTab'
import AttendanceTab from '../cabinet/AttendanceTab'
import RatingTab from '../cabinet/RatingTab'
import NotificationsTab from '../cabinet/NotificationsTab'
import InsuranceAdminTab from '../cabinet/InsuranceAdminTab'
import { AchievementBadge, AchievementsLeaderboard } from '../cabinet/AchievementsTab'
import AchievementsTab from '../cabinet/AchievementsTab'
import CertificationTab from '../cabinet/CertificationTab'
import HallOfFameAdmin from '../cabinet/HallOfFameAdmin'
import CampsTab from '../cabinet/CampsTab'
import InfoTab from '../cabinet/InfoTab'
import AnalyticsAdminTab from '../cabinet/AnalyticsAdminTab'

// ── РЕЙТИНГ ДЛЯ РОДИТЕЛЯ — используем CompetitionsTab с readOnly ───────────────

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

  const [compFiles,    setCompFiles]    = useState([])
  const [filesLoading, setFilesLoading] = useState(false)

  const loadFiles = async (compId) => {
    try {
      const r = await fetch(`${API}/competitions/${compId}/files`, { headers: h })
      if (r.ok) setCompFiles(await r.json())
    } catch {}
  }

  const uploadFile = async (e) => {
    const file = e.target.files[0]
    if (!file || !detail) return
    const fd = new FormData()
    fd.append('file', file)
    setFilesLoading(true)
    try {
      const r = await fetch(`${API}/competitions/${detail.id}/files`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      })
      if (r.ok) await loadFiles(detail.id)
      else { const d = await r.json(); setMsg(d.detail || 'Ошибка загрузки') }
    } catch { setMsg('Ошибка загрузки') }
    setFilesLoading(false)
    e.target.value = ''
  }

  const deleteFile = async (fileId) => {
    if (!detail) return
    try {
      await fetch(`${API}/competitions/${detail.id}/files/${fileId}`, {
        method: 'DELETE', headers: h
      })
      await loadFiles(detail.id)
    } catch {}
  }

  const h  = { Authorization: `Bearer ${token}` }
  const hj = { ...h, 'Content-Type': 'application/json' }

  useEffect(() => { loadSeasons(); loadComps() }, [])
  useEffect(() => { loadComps() }, [season])
  useEffect(() => { if (showChart && comps.length > 0) buildChartData() }, [showChart, comps])

  // Автообновление деталей каждые 20 сек пока открыт детальный вид
  useEffect(() => {
    if (compView !== 'detail' || !detail) return
    const id = detail.id
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`${API}/competitions/${id}`, { headers: { Authorization: `Bearer ${token}` } })
        if (!r.ok) return
        const d = await r.json()
        const existingMap = {}
        ;(d.results || []).forEach(res => { existingMap[res.athlete_id] = res })
        setRows(prev => prev.map(row => {
          const ex = existingMap[row.athlete_id]
          return ex ? { ...row, status: ex.status || row.status, paid: ex.paid ?? row.paid } : row
        }))
      } catch {}
    }, 20000)
    return () => clearInterval(interval)
  }, [compView, detail?.id])

  const loadSeasons = async () => {
    try {
      const r = await fetch(`${API}/competitions/seasons`, { headers: h })
      if (r.ok) {
        const years = await r.json()
        setSeasons(years)
        if (years.includes(currentSeason)) setSeason(currentSeason)
        else if (years.length > 0) setSeason(years[0])
      }
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
          weight:          a.weight           || null,
          birth_date:      a.birth_date       || '',
          dan:             a.dan,
          auto_group:      a.auto_group       || '',
          _inList:         true,
        }
      })
// Восстанавливаем черновик из кэша если есть
      try {
        const draft = localStorage.getItem(`comp_draft_${comp.id}`)
        if (draft) {
          const parsed = JSON.parse(draft)
          // Мержим: берём статусы из БД, результаты из кэша
          const merged = baseList.map(b => {
            const d = parsed.find(p => p.athlete_id === b.athlete_id)
            return d ? { ...b, sparring_place: d.sparring_place, sparring_fights: d.sparring_fights,
              stopball_place: d.stopball_place, stopball_fights: d.stopball_fights,
              tegtim_place: d.tegtim_place, tegtim_fights: d.tegtim_fights,
              tuli_place: d.tuli_place, tuli_perfs: d.tuli_perfs } : b
          })
          setRows(merged)
        } else {
          setRows(baseList)
        }
      } catch { setRows(baseList) }
      setAllAthletes(athletes)
      setCompView('detail')
      await loadFiles(comp.id)
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
      // Сохраняем только тех кто подтвердил участие, не трогаем pending/declined
      const goingRows = rows.filter(r => r.status === 'confirmed' || r.status === 'paid')
      const payload = goingRows.map(r => ({
        athlete_id:      r.athlete_id,
        sparring_place:  r.sparring_place  !== '' ? Number(r.sparring_place)  : null,
        sparring_fights: Number(r.sparring_fights) || 0,
        stopball_place:  r.stopball_place  !== '' ? Number(r.stopball_place)  : null,
        stopball_fights: Number(r.stopball_fights) || 0,
        tegtim_place:    r.tegtim_place    !== '' ? Number(r.tegtim_place)    : null,
        tegtim_fights:   Number(r.tegtim_fights)   || 0,
        tuli_place:      r.tuli_place      !== '' ? Number(r.tuli_place)      : null,
        tuli_perfs:      Number(r.tuli_perfs)      || 0,
        status:          r.status,
      }))
      if (payload.length === 0) { setMsg('Нет подтверждённых участников'); setSaving(false); return }
      const r = await fetch(`${API}/competitions/${detail.id}/results`, {
        method: 'PUT', headers: hj, body: JSON.stringify({ results: payload })
      })
      if (r.ok) {
        try { localStorage.removeItem(`comp_draft_${detail.id}`) } catch {}
        setMsg('Результаты сохранены')
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

  const updateRow = (athleteId, field, value) => {
    setRows(prev => {
      const updated = prev.map(r => r.athlete_id === athleteId ? { ...r, [field]: value } : r)
      if (detail) {
        try { localStorage.setItem(`comp_draft_${detail.id}`, JSON.stringify(updated)) } catch {}
      }
      return updated
    })
  }

  const updateRowStatus = async (athleteId, status) => {
    updateRow(athleteId, 'status', status)
    const row = rows.find(r => r.athlete_id === athleteId)
    if (!row || !detail) return
    try {
      await fetch(`${API}/competitions/${detail.id}/results`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: [{
          athlete_id: athleteId,
          sparring_place: row.sparring_place !== '' ? Number(row.sparring_place) : null,
          sparring_fights: Number(row.sparring_fights) || 0,
          stopball_place: row.stopball_place !== '' ? Number(row.stopball_place) : null,
          stopball_fights: Number(row.stopball_fights) || 0,
          tegtim_place: row.tegtim_place !== '' ? Number(row.tegtim_place) : null,
          tegtim_fights: Number(row.tegtim_fights) || 0,
          tuli_place: row.tuli_place !== '' ? Number(row.tuli_place) : null,
          tuli_perfs: Number(row.tuli_perfs) || 0,
          status,
        }]})
      })
    } catch {}
  }

  const renderResultRow = (r) => {
    const isGoing = r.status === 'confirmed' || r.status === 'paid'
    return (
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
        <td className="comp-rating-val">{calcRatingPreview(r, detail?.significance||1)}</td>
        <td style={{textAlign:'center'}}>
          {!readOnly && <input type="checkbox" checked={r.paid||false}
            onChange={async e => {
              const paid = e.target.checked
              updateRow(r.athlete_id, 'paid', paid)
              await fetch(`${API}/competitions/${detail.id}/results/${r.athlete_id}/paid?paid=${paid}`, { method:'PATCH', headers:{Authorization:`Bearer ${token}`} })
            }}/>}
          {readOnly && <span style={{color: r.paid ? '#6cba6c' : 'var(--gray)', fontSize:'0.8rem'}}>{r.paid ? '✓' : '—'}</span>}
        </td>
        {!readOnly && <td>
          <select className="td-input td-input-sm" value={r.status||'confirmed'}
            onChange={e => updateRowStatus(r.athlete_id, e.target.value)}
            style={{color:'#6cba6c'}}>
            <option value="pending">Ожидает</option>
            <option value="confirmed">Участвует</option>
            <option value="declined">Не участвует</option>
          </select>
        </td>}
        {!readOnly && <td><button className="td-btn td-btn-del" onClick={() => removeRow(r.athlete_id)}>✕</button></td>}
      </tr>
    )
  }

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
          <select className="att-date-input" value={season} onChange={e => setSeason(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: 'auto' }}>
            <option value="">Все сезоны</option>
            {seasons.map(s => <option key={s} value={s}>{seasonLabel(s)}</option>)}
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

          {/* ── Файлы соревнования ── */}
          <div style={{ margin:'16px 0', padding:'16px 20px', background:'var(--dark2)', border:'1px solid var(--gray-dim)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: compFiles.length > 0 ? 12 : 0 }}>
              <span style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)' }}>
                Документы к соревнованию
              </span>
              {!readOnly && (
                <label style={{ cursor:'pointer' }}>
                  <input type="file" style={{ display:'none' }} onChange={uploadFile} />
                  <span className="att-all-btn" style={{ fontSize:'12px' }}>
                    {filesLoading ? 'Загрузка...' : '+ Прикрепить файл'}
                  </span>
                </label>
              )}
            </div>
            {compFiles.length === 0
              ? <p style={{ color:'var(--gray)', fontSize:'13px', margin:'8px 0 0', fontStyle:'italic' }}>
                  {readOnly ? 'Документы не прикреплены' : 'Файлы не прикреплены'}
                </p>
              : compFiles.map(f => (
                  <div key={f.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--gray-dim)' }}>
                    <a href={f.file_url} target="_blank" rel="noreferrer"
                      style={{ color:'var(--white)', fontSize:'14px', textDecoration:'none', display:'flex', alignItems:'center', gap:8 }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{flexShrink:0}}>
                      <path d="M8 1v9M4 7l4 4 4-4M2 13h12" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {f.filename}
                    </a>
                    {!readOnly && (
                      <button className="td-btn td-btn-del" style={{ fontSize:'11px', padding:'3px 8px' }} onClick={() => deleteFile(f.id)}>✕</button>
                    )}
                  </div>
                ))
            }
          </div>
{/* ── Матрица заявок ── */}
<CompApplicationMatrix
  rows={rows}
  athletes={athletes}
  detail={detail}
  token={token}
  readOnly={readOnly}
  updateRow={updateRow}
  updateRowStatus={updateRowStatus}
  removeRow={removeRow}
  calcRatingPreview={calcRatingPreview}
/>
          
          {/* Блок ожидают ответа */}
          {rows.filter(r => r.status === 'pending').length > 0 && (
            <div style={{ marginBottom:20, opacity:0.55 }}>
              <div style={{
                fontFamily:'Bebas Neue', fontSize:'1.1rem', letterSpacing:'0.12em',
                color:'var(--gray)', marginBottom:16, marginTop:8,
                paddingBottom:8, borderBottom:'1px solid var(--gray-dim)',
                textAlign:'center'
              }}>▸ ОЖИДАЮТ ОТВЕТА — {rows.filter(r => r.status === 'pending').length} чел.</div>
              <div className="athletes-table-wrap">
                <table className="athletes-table">
                  <tbody>
                    {rows.filter(r => r.status === 'pending').map(r => (
                      <tr key={r.athlete_id}>
                        <td className="td-name">{r.full_name}</td>
                        <td colSpan={8} style={{color:'var(--gray)',fontSize:'0.82rem'}}>ожидается ответ</td>
                        {!readOnly && <td>
                          <select className="td-input td-input-sm" value="pending"
                            onChange={e => updateRowStatus(r.athlete_id, e.target.value)}
                            style={{color:'var(--gray)'}}>
                            <option value="pending">Ожидает</option>
                            <option value="confirmed">Участвует</option>
                            <option value="declined">Не участвует</option>
                          </select>
                        </td>}
                        {!readOnly && <td><button className="td-btn td-btn-del" onClick={() => removeRow(r.athlete_id)}>✕</button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Блок не участвуют */}
          {rows.filter(r => r.status === 'declined').length > 0 && (
            <div style={{ opacity:0.35 }}>
              <div style={{
                fontFamily:'Bebas Neue', fontSize:'1.1rem', letterSpacing:'0.12em',
                color:'var(--red)', marginBottom:16, marginTop:8,
                paddingBottom:8, borderBottom:'1px solid #3a1a1a',
                textAlign:'center'
              }}>▸ НЕ УЧАСТВУЮТ — {rows.filter(r => r.status === 'declined').length} чел.</div>
              <div className="athletes-table-wrap">
                <table className="athletes-table">
                  <tbody>
                    {rows.filter(r => r.status === 'declined').map(r => (
                      <tr key={r.athlete_id}>
                        <td className="td-name" style={{color:'var(--gray)'}}>{r.full_name}</td>
                        <td colSpan={8} style={{color:'var(--gray)',fontSize:'0.82rem'}}>отказался</td>
                        {!readOnly && <td>
                          <select className="td-input td-input-sm" value="declined"
                            onChange={e => updateRowStatus(r.athlete_id, e.target.value)}
                            style={{color:'var(--red)'}}>
                            <option value="pending">Ожидает</option>
                            <option value="confirmed">Участвует</option>
                            <option value="declined">Не участвует</option>
                          </select>
                        </td>}
                        {!readOnly && <td></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {rows.length === 0 && <div className="cabinet-empty">Нет участников.</div>}
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


// ── ВКЛАДКА НОВОСТИ (тренер) ─────────────────────────────────────────────────

function NewsTab({ token }) {
  const h   = { Authorization: `Bearer ${token}` }
  const hj  = { ...h, 'Content-Type': 'application/json' }

  const [items,        setItems]        = useState([])
  const [comps,        setComps]        = useState([])
  const [certs,        setCerts]        = useState([])
  const [camps,        setCamps]        = useState([])
  const [loading,      setLoading]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [msg,          setMsg]          = useState('')
  const [showForm,     setShowForm]     = useState(false)
  const [photoFile,    setPhotoFile]    = useState(null)
  const [editingId,    setEditingId]    = useState(null)
  const [editForm,     setEditForm]     = useState({ title: '', body: '' })
  const [editPhoto,    setEditPhoto]    = useState(null)
  const [editHasPhoto, setEditHasPhoto] = useState(false)
  const [confirm,      setConfirm]      = useState(null)
  const [form, setForm] = useState({ title: '', body: '' })

  useEffect(() => { loadNews(); loadComps(); loadCerts(); loadCamps() }, [])

  const loadNews = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/news?limit=50`, { headers: h })
      if (r.ok) { const d = await r.json(); setItems(d.items) }
    } catch {}
    setLoading(false)
  }

  const loadComps = async () => {
    try {
      const r = await fetch(`${API}/competitions`, { headers: h })
      if (r.ok) setComps(await r.json())
    } catch {}
  }

  const loadCerts = async () => {
    try {
      const r = await fetch(`${API}/certifications`, { headers: h })
      if (r.ok) { const d = await r.json(); setCerts(d) }
    } catch {}
  }

  const loadCamps = async () => {
    try {
      const r = await fetch(`${API}/camps`, { headers: h })
      if (r.ok) { const d = await r.json(); setCamps(d) }
    } catch {}
  }

  const createNews = async () => {
    if (!form.title.trim() || !form.body.trim()) { setMsg('Заполните заголовок и текст'); return }
    setSaving(true); setMsg('')
    try {
      const r = await fetch(`${API}/news`, { method: 'POST', headers: hj, body: JSON.stringify(form) })
      if (!r.ok) { const d = await r.json(); setMsg(d.detail || 'Ошибка'); setSaving(false); return }
      const created = await r.json()
      if (photoFile) {
        const fd = new FormData(); fd.append('file', photoFile)
        await fetch(`${API}/news/${created.id}/photo`, { method: 'POST', headers: h, body: fd })
      }
      setShowForm(false); setForm({ title: '', body: '' }); setPhotoFile(null)
      setMsg('Новость опубликована'); await loadNews()
    } catch { setMsg('Ошибка') }
    setSaving(false)
  }

  const deleteNews = async (id) => {
    try {
      await fetch(`${API}/news/${id}`, { method: 'DELETE', headers: h })
      await loadNews(); setConfirm(null)
    } catch {}
  }

  const saveEdit = async () => {
    if (!editingId) return
    setSaving(true); setMsg('')
    try {
      const r = await fetch(`${API}/news/${editingId}`, {
        method: 'PATCH', headers: hj, body: JSON.stringify(editForm)
      })
      if (!r.ok) { setMsg('Ошибка сохранения'); setSaving(false); return }
      if (editPhoto) {
        const fd = new FormData(); fd.append('file', editPhoto)
        await fetch(`${API}/news/${editingId}/photo`, { method: 'POST', headers: h, body: fd })
      }
      setEditingId(null); setEditPhoto(null); await loadNews()
    } catch { setMsg('Ошибка') }
    setSaving(false)
  }

  const deletePhoto = async (newsId) => {
    try {
      await fetch(`${API}/news/${newsId}/photo`, { method: 'DELETE', headers: h })
      setEditHasPhoto(false); await loadNews()
    } catch {}
  }

  const generateWithGPT = async (compId) => {
    setSaving(true); setMsg('')
    try {
      const r = await fetch(`${API}/news-admin/generate-comp-news`, {
        method: 'POST', headers: hj, body: JSON.stringify({ comp_id: compId })
      })
      const d = await r.json()
      setMsg(d.message || (r.ok ? 'Готово' : 'Ошибка'))
      if (r.ok) await loadNews()
    } catch { setMsg('Ошибка') }
    setSaving(false)
  }

  const publishFromComp = async (compId) => {
    setSaving(true); setMsg('')
    try {
      const r = await fetch(`${API}/news/from-competition/${compId}`, { method: 'POST', headers: h })
      if (r.ok) { setMsg('Новость опубликована'); await loadNews() }
      else { const d = await r.json(); setMsg(d.detail || 'Ошибка') }
    } catch { setMsg('Ошибка') }
    setSaving(false)
  }

  const publishFromCert = async (certId, certName, certDate) => {
    setSaving(true); setMsg('')
    try {
      const dateStr = new Date(certDate).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })
      const title = `${certName} — ${dateStr}`
      const body  = `${dateStr} в клубе «Тайпан» прошла аттестация: ${certName}.\n\nПоздравляем всех участников с получением новых поясов! Каждый пояс — это результат упорного труда, дисциплины и преданности тхэквондо ГТФ.\n\nПродолжаем расти и совершенствоваться!`
      const r = await fetch(`${API}/news`, { method: 'POST', headers: hj, body: JSON.stringify({ title, body, certification_id: certId }) })
      if (r.ok) { setMsg('Новость об аттестации опубликована'); await loadNews() }
      else { const d = await r.json(); setMsg(d.detail || 'Ошибка') }
    } catch { setMsg('Ошибка') }
    setSaving(false)
  }


  const generateCertWithGPT = async (certId, certName, certDate) => {
    setSaving(true); setMsg('')
    try {
      const dateStr = new Date(certDate).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })
      const prompt = `Напиши новость об аттестации по тхэквондо ГТФ для сайта клуба «Тайпан».\n\nДанные:\nНазвание аттестации: ${certName}\nДата: ${dateStr}\nКлуб: Тайпан, г. Павловский Посад\nФедерация: ГТФ (GTF)\n\nСтиль — торжественный, поддерживающий, гордый. Не используй эмодзи. Зал называется доянг. Пояса — гыпы (ученические) и даны (мастерские).\nОбъём 100-180 слов.\nВерни:\nЗАГОЛОВОК: [заголовок]\nТЕКСТ: [текст]`
      const rGpt = await fetch(`${API}/ai/chat`, { method: 'POST', headers: hj, body: JSON.stringify({ message: prompt, history: [] }) })
      if (!rGpt.ok) { setMsg('Ошибка YandexGPT'); setSaving(false); return }
      const gptData = await rGpt.json()
      const reply = gptData.reply || ''
      let title = `${certName} — ${dateStr}`
      let body  = reply
      if (reply.includes('ЗАГОЛОВОК:') && reply.includes('ТЕКСТ:')) {
        const parts = reply.split('ТЕКСТ:')
        title = parts[0].replace('ЗАГОЛОВОК:', '').trim() || title
        body  = parts[1].trim()
      }
      const rSave = await fetch(`${API}/news`, { method: 'POST', headers: hj, body: JSON.stringify({ title: title.slice(0,255), body, certification_id: certId }) })
      if (rSave.ok) { setMsg('Новость об аттестации сгенерирована YandexGPT'); await loadNews() }
      else { const d = await rSave.json(); setMsg(d.detail || 'Ошибка') }
    } catch { setMsg('Ошибка') }
    setSaving(false)
  }


  const publishFromCamp = async (campId, campName, campDateStart, campDateEnd, campLocation) => {
    setSaving(true); setMsg('')
    try {
      const ds = new Date(campDateStart).toLocaleDateString('ru-RU', { day:'numeric', month:'long' })
      const de = new Date(campDateEnd).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })
      const loc = campLocation ? ` в ${campLocation}` : ''
      const title = `Учебно-тренировочные сборы «${campName}» — ${ds}–${de}`
      const body  = `С ${ds} по ${de} наши спортсмены приняли участие в учебно-тренировочных сборах «${campName}»${loc}.\n\nСборы — важная часть подготовки каждого спортсмена. Интенсивные тренировки, работа над техникой хъёнгов и массоги, командный дух и взаимная поддержка — всё это делает наших бойцов сильнее.\n\nБлагодарим всех участников за старание и самоотдачу!`
      const r = await fetch(`${API}/news`, { method: 'POST', headers: hj, body: JSON.stringify({ title, body, camp_id: campId }) })
      if (r.ok) { setMsg('Новость о сборах опубликована'); await loadNews() }
      else { const d = await r.json(); setMsg(d.detail || 'Ошибка') }
    } catch { setMsg('Ошибка') }
    setSaving(false)
  }


  const generateCampWithGPT = async (campId, campName, campDateStart, campDateEnd, campLocation) => {
    setSaving(true); setMsg('')
    try {
      const ds = new Date(campDateStart).toLocaleDateString('ru-RU', { day:'numeric', month:'long' })
      const de = new Date(campDateEnd).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })
      const loc = campLocation ? `, место: ${campLocation}` : ''
      const prompt = `Напиши новость об учебно-тренировочных сборах по тхэквондо ГТФ для сайта клуба «Тайпан».\n\nДанные:\nНазвание: ${campName}\nДаты: ${ds}–${de}${loc}\nКлуб: Тайпан, г. Павловский Посад\nФедерация: ГТФ (GTF)\n\nСтиль — живой, мотивирующий, командный. Не используй эмодзи. Зал называется доянг, техника — хъёнги и массоги.\nОбъём 120-200 слов.\nВерни:\nЗАГОЛОВОК: [заголовок]\nТЕКСТ: [текст]`
      const rGpt = await fetch(`${API}/ai/chat`, { method: 'POST', headers: hj, body: JSON.stringify({ message: prompt, history: [] }) })
      if (!rGpt.ok) { setMsg('Ошибка YandexGPT'); setSaving(false); return }
      const gptData = await rGpt.json()
      const reply = gptData.reply || ''
      let title = `Сборы «${campName}» — ${ds}–${de}`
      let body  = reply
      if (reply.includes('ЗАГОЛОВОК:') && reply.includes('ТЕКСТ:')) {
        const parts = reply.split('ТЕКСТ:')
        title = parts[0].replace('ЗАГОЛОВОК:', '').trim() || title
        body  = parts[1].trim()
      }
      const rSave = await fetch(`${API}/news`, { method: 'POST', headers: hj, body: JSON.stringify({ title: title.slice(0,255), body, camp_id: campId }) })
      if (rSave.ok) { setMsg('Новость о сборах сгенерирована YandexGPT'); await loadNews() }
      else { const d = await rSave.json(); setMsg(d.detail || 'Ошибка') }
    } catch { setMsg('Ошибка') }
    setSaving(false)
  }


  const publishedCompIds = new Set(items.filter(n => n.competition_id).map(n => n.competition_id))
  const compsWithoutNews = comps.filter(c => !publishedCompIds.has(c.id))
  const publishedCertIds = new Set(items.filter(n => n.certification_id).map(n => n.certification_id))
  const publishedCampIds = new Set(items.filter(n => n.camp_id).map(n => n.camp_id))
  const recentCerts = certs.filter(c => !publishedCertIds.has(c.id)).slice(0, 5)
  const recentCamps = camps.filter(c => !publishedCampIds.has(c.id)).slice(0, 5)

  return (
    <div>
      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Удалить новость?</h3>
            <p style={{ color:'var(--gray)', marginBottom:20 }}>Это действие необратимо.</p>
            <div className="modal-btns-row">
              <button className="btn-primary" style={{ background:'var(--red)' }} onClick={() => deleteNews(confirm)}>Удалить</button>
              <button className="btn-outline" onClick={() => setConfirm(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:8 }}>
        <span style={{ fontFamily:'Bebas Neue', fontSize:'1.4rem', letterSpacing:'0.06em', color:'var(--white)' }}>
          Новости клуба
        </span>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="att-all-btn" style={{ fontSize:'13px' }}
            onClick={async () => {
              setSaving(true); setMsg('')
              try {
                const r = await fetch(`${API}/news-admin/generate-announcement`, { method:'POST', headers:hj })
                const d = await r.json()
                setMsg(d.message || 'Готово')
                if (r.ok) await loadNews()
              } catch { setMsg('Ошибка') }
              setSaving(false)
            }} disabled={saving}>
            Анонс соревнований
          </button>
          <button className="btn-primary" style={{ padding:'8px 18px', fontSize:'14px' }} onClick={() => setShowForm(true)}>
            + Новость
          </button>
        </div>
      </div>

      {msg && <div className="att-msg" style={{ marginBottom:12 }}>{msg}</div>}

      {/* Соревнования без новости */}
      {compsWithoutNews.length > 0 && (
        <div style={{ background:'var(--dark2)', border:'1px solid var(--gray-dim)', borderLeft:'3px solid var(--red)', padding:'16px 20px', marginBottom:12 }}>
          <div style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)', marginBottom:12 }}>
            Соревнования без новости
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {compsWithoutNews.slice(0, 5).map(c => (
              <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                <span style={{ color:'var(--white)', fontSize:'14px', flex:1, minWidth:0 }}>
                  {c.name} — {new Date(c.date).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}
                </span>
                <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                  <button className="att-all-btn" style={{ fontSize:'12px', whiteSpace:'nowrap' }}
                    onClick={() => publishFromComp(c.id)} disabled={saving}>Стандартная</button>
                  <button className="btn-primary" style={{ fontSize:'12px', padding:'6px 12px', whiteSpace:'nowrap' }}
                    onClick={() => generateWithGPT(c.id)} disabled={saving}>YandexGPT</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Аттестации */}
      {recentCerts.length > 0 && (
        <div style={{ background:'var(--dark2)', border:'1px solid var(--gray-dim)', borderLeft:'3px solid #c8962a', padding:'16px 20px', marginBottom:12 }}>
          <div style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)', marginBottom:12 }}>
            Аттестации без новости
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {recentCerts.map(c => (
              <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                <span style={{ color:'var(--white)', fontSize:'14px', flex:1, minWidth:0 }}>
                  {c.name} — {new Date(c.date).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}
                </span>
                <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                  <button className="att-all-btn" style={{ fontSize:'12px', whiteSpace:'nowrap' }}
                    onClick={() => publishFromCert(c.id, c.name, c.date)} disabled={saving}>Стандартная</button>
                  <button className="btn-primary" style={{ fontSize:'12px', padding:'6px 12px', whiteSpace:'nowrap' }}
                    onClick={() => generateCertWithGPT(c.id, c.name, c.date)} disabled={saving}>YandexGPT</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Сборы */}
      {recentCamps.length > 0 && (
        <div style={{ background:'var(--dark2)', border:'1px solid var(--gray-dim)', borderLeft:'3px solid #4caf50', padding:'16px 20px', marginBottom:20 }}>
          <div style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)', marginBottom:12 }}>
            Сборы без новости
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {recentCamps.map(c => (
              <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                <span style={{ color:'var(--white)', fontSize:'14px', flex:1, minWidth:0 }}>
                  {c.name} — {new Date(c.date_start).toLocaleDateString('ru-RU', { day:'numeric', month:'long' })}–{new Date(c.date_end).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}
                </span>
                <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                  <button className="att-all-btn" style={{ fontSize:'12px', whiteSpace:'nowrap' }}
                    onClick={() => publishFromCamp(c.id, c.name, c.date_start, c.date_end, c.location)} disabled={saving}>Стандартная</button>
                  <button className="btn-primary" style={{ fontSize:'12px', padding:'6px 12px', whiteSpace:'nowrap' }}
                    onClick={() => generateCampWithGPT(c.id, c.name, c.date_start, c.date_end, c.location)} disabled={saving}>YandexGPT</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <div className="cabinet-loading">Загрузка...</div>}
      {!loading && items.length === 0 && <div className="cabinet-empty">Новостей пока нет</div>}

      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        {items.map(n => (
          <div key={n.id} style={{ background:'var(--dark)', border:'1px solid var(--gray-dim)', padding:'16px 20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:'Barlow Condensed', fontSize:'11px', fontWeight:700, letterSpacing:'2px', color:'var(--red)', marginBottom:4 }}>
                  {new Date(n.published_at).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}
                  {n.competition_id && <span style={{ marginLeft:8, color:'var(--gray)' }}>· соревнование</span>}
                </div>
                <div style={{ fontWeight:600, color:'var(--white)', fontSize:'15px', marginBottom:4 }}>{n.title}</div>
                <div style={{ color:'var(--gray)', fontSize:'13px', lineHeight:1.5 }}>
                  {n.body.slice(0, 120).replace(/\n/g, ' ')}{n.body.length > 120 ? '…' : ''}
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0, alignItems:'flex-end' }}>
                {n.photo_url && <img src={n.photo_url} alt="" style={{ width:100, height:70, objectFit:'cover', borderRadius:2 }} />}
                <div style={{ display:'flex', gap:6 }}>
                  <button className="att-all-btn" style={{ fontSize:'11px', padding:'4px 10px' }}
                    onClick={() => { setEditingId(n.id); setEditForm({ title: n.title, body: n.body }); setEditPhoto(null); setEditHasPhoto(!!n.photo_url) }}>
                    Ред.
                  </button>
                  <button className="td-btn td-btn-del" onClick={() => setConfirm(n.id)}>✕</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box" style={{ maxWidth:600 }} onClick={e => e.stopPropagation()}>
            <h3>Новая новость</h3>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)', display:'block', marginBottom:6 }}>Заголовок</label>
              <input className="modal-input" placeholder="Заголовок новости..." value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)', display:'block', marginBottom:6 }}>Текст</label>
              <textarea style={{ width:'100%', minHeight:160, background:'var(--dark2)', border:'1px solid var(--gray-dim)', color:'var(--white)', padding:'10px 14px', fontSize:'14px', fontFamily:'Barlow, sans-serif', resize:'vertical', boxSizing:'border-box' }}
                placeholder="Текст новости..." value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)', display:'block', marginBottom:6 }}>Фото (необязательно)</label>
              <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files[0])} />
              {photoFile && <div style={{ color:'var(--gray)', fontSize:'12px', marginTop:4 }}>{photoFile.name}</div>}
            </div>
            {msg && <div className="modal-msg" style={{ marginBottom:8 }}>{msg}</div>}
            <div className="modal-btns-row">
              <button className="btn-primary" onClick={createNews} disabled={saving}>{saving ? 'Публикация...' : 'Опубликовать'}</button>
              <button className="btn-outline" onClick={() => { setShowForm(false); setMsg('') }}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {editingId && (
        <div className="modal-overlay" onClick={() => setEditingId(null)}>
          <div className="modal-box" style={{ maxWidth:600 }} onClick={e => e.stopPropagation()}>
            <h3>Редактировать новость</h3>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)', display:'block', marginBottom:6 }}>Заголовок</label>
              <input className="modal-input" value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)', display:'block', marginBottom:6 }}>Текст</label>
              <textarea style={{ width:'100%', minHeight:200, background:'var(--dark2)', border:'1px solid var(--gray-dim)', color:'var(--white)', padding:'10px 14px', fontSize:'14px', fontFamily:'Barlow, sans-serif', resize:'vertical', boxSizing:'border-box' }}
                value={editForm.body} onChange={e => setEditForm(p => ({ ...p, body: e.target.value }))} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)', display:'block', marginBottom:6 }}>Фото</label>
              {editHasPhoto && (
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  <span style={{ color:'var(--gray)', fontSize:'13px' }}>Фото прикреплено</span>
                  <button className="td-btn td-btn-del" style={{ fontSize:'11px' }} onClick={() => deletePhoto(editingId)}>Удалить фото</button>
                </div>
              )}
              <input type="file" accept="image/*" onChange={e => setEditPhoto(e.target.files[0])} />
              {editPhoto && <div style={{ color:'var(--gray)', fontSize:'12px', marginTop:4 }}>{editPhoto.name}</div>}
            </div>
            <div className="modal-btns-row">
              <button className="btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
              <button className="btn-outline" onClick={() => setEditingId(null)}>Отмена</button>
            </div>
          </div>
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
  const [parentView,   setParentView]   = useState('athletes') // для кабинета родителя
  const [analyticsModal, setAnalyticsModal] = useState(null) // { athlete_id, athlete_name, application_id }
  const [deleteAppConfirm, setDeleteAppConfirm] = useState(null) // { id, full_name }
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
    if (!window.confirm('Удалить спортсмена из базы безвозвратно?')) return
    await fetch(`${API}/users/athletes/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    loadAthletes()
  }

  const [archiveAthleteModal, setArchiveAthleteModal] = useState(null) // { athlete_id, parent_name, user_id }

  const archiveAthlete = async (id) => {
    // Сначала проверяем — есть ли другие дети у родителя
    const athlete = athletes.find(a => a.id === id)
    if (!athlete) return
    const siblings = athletes.filter(a => a.user_id === athlete.user_id && a.id !== id && !a.is_archived)
    // Показываем модал с вопросом об архивировании родителя
    setArchiveAthleteModal({
      athlete_id: id,
      athlete_name: athlete.full_name,
      user_id: athlete.user_id,
      parent_name: athlete.parent_name,
      has_siblings: siblings.length > 0,
    })
  }

  const doArchiveAthlete = async (athlete_id, also_archive_parent) => {
    setArchiveAthleteModal(null)
    await fetch(`${API}/users/athletes/${athlete_id}/archive`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
    if (also_archive_parent) {
      const athlete = athletes.find(a => a.id === athlete_id)
      if (athlete) await fetch(`${API}/users/parents/${athlete.user_id}/archive`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ archive_children: false })
      })
    }
    loadAthletes()
  }

  const restoreAthlete = async (id) => {
    await fetch(`${API}/users/athletes/${id}/restore`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
    loadAthletes()
  }

  const [archiveParentModal, setArchiveParentModal] = useState(null) // { user_id, parent_name, children }

  const archiveParent = async (user_id, archiveChildren) => {
    const r = await fetch(`${API}/users/parents/${user_id}/archive`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ archive_children: archiveChildren })
    })
    if (r.ok) {
      const d = await r.json()
      if (d.needs_confirmation) {
        setArchiveParentModal({ user_id, children: d.children })
      } else {
        setArchiveParentModal(null)
        loadAthletes()
      }
    }
  }

  const restoreParent = async (user_id) => {
    await fetch(`${API}/users/parents/${user_id}/restore?restore_children=true`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}` }
    })
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

  const deleteApplication = async (id) => {
    await fetch(`${API}/applications/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setDeleteAppConfirm(null)
    loadApplications()
  }

  const openAnalyticsFromApp = (app) => {
    // Ищем спортсмена по имени из заявки
    const matched = athletes.find(a =>
      a.full_name.toLowerCase() === app.full_name.toLowerCase() ||
      a.parent_name?.toLowerCase() === app.full_name.toLowerCase()
    )
    setAnalyticsModal({
      athlete_id: matched ? matched.id : null,
      athlete_name: matched ? matched.full_name : app.full_name,
      application_id: app.id,
    })
  }

  const uniqueGroups  = useMemo(() => GROUPS, [])  // п.7 — фиксированный справочник
  const uniqueGupDan  = useMemo(() => { const v = new Set(); athletes.forEach(a => { if (a.dan) v.add(`${a.dan} дан`); else if (a.gup) v.add(`${a.gup} гып`) }); return [...v].sort() }, [athletes])
  const uniqueParents = useMemo(() => [...new Set(athletes.map(a => a.parent_name).filter(Boolean))].sort((a,b) => a.localeCompare(b,'ru')), [athletes])

  const filteredAthletes = useMemo(() => athletes.filter(a => {
    if (a.is_archived) return false  // архивных не показываем в основном списке
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
    // Включаем всех — и родителей и взрослых спортсменов
    athletes.forEach(a => {
      if (!map.has(a.user_id)) {
        const isAthlete = a.parent_phone === a.user_id?.toString() || !a.parent_name ||
          athletes.filter(x => x.user_id === a.user_id).every(x => x.user_id === x.id)
        map.set(a.user_id, {
          user_id:      a.user_id,
          parent_name:  a.parent_name,
          parent_phone: a.parent_phone,
          is_athlete:   false, // будет определено ниже
          children:     athletes.filter(x => x.user_id === a.user_id && !x.is_archived).map(x => x.full_name),
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
            <button className={`cabinet-tab ${parentView==='rating'?'active':''}`}        onClick={() => setParentView('rating')}>Рейтинг</button>
            <button className={`cabinet-tab ${parentView==='notifications'?'active':''}`} onClick={() => setParentView('notifications')}>
              Уведомления
              <UnreadBadge token={token}/>
            </button>
            <button className={`cabinet-tab ${parentView==='analytics'?'active':''}`} onClick={() => setParentView('analytics')}>Аналитика</button>
            <button className={`cabinet-tab ${parentView==='insurance'?'active':''}`} onClick={() => setParentView('insurance')}>Страхование</button>
            <button className={`cabinet-tab ${parentView==='info'?'active':''}`} style={{color: parentView==='info' ? undefined : 'var(--gray)'}} onClick={() => setParentView('info')}>Информация</button>
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
                      </div>
                      <BeltDisplay gup={a.gup} dan={a.dan}/>
                      <InsuranceStatus athleteId={a.id} token={token} />
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
          {parentView === 'rating'        && !loading && <RatingTab token={token} myAthleteIds={myAthletes.map(a=>a.id)}/>}
          {parentView === 'notifications' && <NotificationsTab token={token}/>}
          {parentView === 'insurance'     && <ParentInsuranceTab token={token} athletes={myAthletes}/>}
          {parentView === 'info'          && <InfoTab isAdmin={false} token={token}/>}
          {parentView === 'analytics'     && !loading && <ParentAnalyticsTab token={token} athletes={myAthletes}/>}
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
          <div className="cabinet-header-main">
            <p className="section-label">Панель управления</p>
            <h1 className="cabinet-title">{name}</h1>
            <span className="cabinet-role-badge">{role === 'admin' ? 'Администратор' : 'Тренер'}</span>
          </div>
          <button className="btn-outline cabinet-logout" onClick={logout}>Выйти</button>
        </div>

        {/* Сгруппированные вкладки */}
        <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:16 }}>
          {/* ── Вкладки тренера ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:2 }}>

<div className="cabinet-tabs-group">
  {/* Люди */}
  <div style={{ display:'flex', alignItems:'stretch', gap:0 }}>
    <div style={{ fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.65rem', letterSpacing:'0.12em', color:'var(--gray)', textTransform:'uppercase', width:90, flexShrink:0, display:'flex', alignItems:'center', padding:'0 10px 0 0', borderRight:'1px solid var(--gray-dim)' }}>Люди</div>
    <div style={{ display:'flex', flexWrap:'wrap', gap:2, paddingLeft:8 }}>
      <button className={`cabinet-tab ${view==='athletes'?'active':''}`} onClick={() => setView('athletes')}>Спортсмены ({athletes.filter(a=>!a.is_archived).length})</button>
      <button className={`cabinet-tab ${view==='parents'?'active':''}`} onClick={() => setView('parents')}>Родители ({parents.length})</button>
      <button className={`cabinet-tab ${view==='insurance_admin'?'active':''}`} onClick={() => setView('insurance_admin')}>Страхование</button>
      <button className={`cabinet-tab ${view==='archive'?'active':''}`} style={{ color: view==='archive' ? undefined : 'var(--gray)' }} onClick={() => setView('archive')}>Архив ({athletes.filter(a=>a.is_archived).length})</button>
      <button className={`cabinet-tab ${view==='applications'?'active':''}`} onClick={() => setView('applications')}>Заявки{applications.filter(a => a.status==='new').length > 0 && <span className="tab-badge">{applications.filter(a => a.status==='new').length}</span>}</button>
      <button className={`cabinet-tab ${view==='hof'?'active':''}`} style={{ color: view==='hof' ? undefined : '#c8962a' }} onClick={() => setView('hof')}>Зал Славы</button>
    </div>
  </div>
</div>
<div className="cabinet-tabs-group">
  {/* События */}
  <div style={{ display:'flex', alignItems:'stretch', gap:0 }}>
    <div style={{ fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.65rem', letterSpacing:'0.12em', color:'var(--gray)', textTransform:'uppercase', width:90, flexShrink:0, display:'flex', alignItems:'center', padding:'0 10px 0 0', borderRight:'1px solid var(--gray-dim)' }}>События</div>
    <div style={{ display:'flex', flexWrap:'wrap', gap:2, paddingLeft:8 }}>
      <button className={`cabinet-tab ${view==='attendance'?'active':''}`} onClick={() => setView('attendance')}>Посещаемость</button>
      <button className={`cabinet-tab ${view==='competitions'?'active':''}`} onClick={() => setView('competitions')}>Соревнования</button>
      <button className={`cabinet-tab ${view==='certification'?'active':''}`} onClick={() => setView('certification')}>Аттестация</button>
      <button className={`cabinet-tab ${view==='camps'?'active':''}`} onClick={() => setView('camps')}>Сборы</button>
      <button className={`cabinet-tab ${view==='news'?'active':''}`} onClick={() => setView('news')}>Новости</button>
    </div>
  </div>
</div>
<div className="cabinet-tabs-group">
  {/* Результаты */}
  <div style={{ display:'flex', alignItems:'stretch', gap:0 }}>
    <div style={{ fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.65rem', letterSpacing:'0.12em', color:'var(--gray)', textTransform:'uppercase', width:90, flexShrink:0, display:'flex', alignItems:'center', padding:'0 10px 0 0', borderRight:'1px solid var(--gray-dim)' }}>Результаты</div>
    <div style={{ display:'flex', flexWrap:'wrap', gap:2, paddingLeft:8 }}>
      <button className={`cabinet-tab ${view==='rating'?'active':''}`} onClick={() => setView('rating')}>Рейтинг</button>
      <button className={`cabinet-tab ${view==='achievements'?'active':''}`} onClick={() => setView('achievements')}>Ачивки</button>
      <button className={`cabinet-tab ${view==='analytics'?'active':''}`} onClick={() => setView('analytics')}>Аналитика</button>
      <button className={`cabinet-tab ${view==='info'?'active':''}`} style={{color: view==='info' ? undefined : 'var(--gray)'}} onClick={() => setView('info')}>Информация</button>
    </div>
  </div>
</div>

          </div>

        {view !== 'attendance' && view !== 'competitions' && view !== 'rating' && view !== 'certification' && view !== 'achievements' && view !== 'camps' && view !== 'archive' && view !== 'analytics' && view !== 'insurance_admin' && (
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

        {view === 'attendance'   && <AttendanceTab    token={token} athletes={athletes.filter(a=>!a.is_archived)} />}
        {view === 'competitions' && <CompetitionsTab  token={token} athletes={athletes.filter(a=>!a.is_archived)} />}
        {view === 'rating'        && <RatingTab        token={token} />}
        {view === 'certification' && <CertificationTab token={token} athletes={athletes.filter(a=>!a.is_archived)} />}
        {view === 'achievements'  && <AchievementsLeaderboard token={token} />}
        {view === 'camps'         && <CampsTab token={token} athletes={athletes.filter(a=>!a.is_archived)} />}
        {view === 'news'          && <NewsTab token={token} />}
        {view === 'info'          && <InfoTab isAdmin={true} token={token} />}
        {view === 'analytics'     && <AnalyticsAdminTab token={token} athletes={athletes} />}
        {view === 'insurance_admin' && <InsuranceAdminTab token={token} athletes={athletes.filter(a=>!a.is_archived)} />}
        {view === 'hof'           && <HallOfFameAdmin token={token} />}
        {view === 'archive'       && (
          <div>
            <div style={{ marginBottom:16, color:'var(--gray)', fontSize:'0.9rem' }}>
              Архивные спортсмены не отображаются в посещаемости, соревнованиях и рейтинге. Архивные родители не могут войти в личный кабинет.
            </div>
            {athletes.filter(a => a.is_archived).length === 0
              ? <div className="cabinet-empty">Архив пуст.</div>
              : <div className="athletes-table-wrap">
                  <table className="athletes-table">
                    <thead><tr>
                      <th style={{textAlign:'left'}}>Спортсмен</th>
                      <th>Группа</th>
                      <th>Возраст</th>
                      <th>Гып/Дан</th>
                      <th>Родитель</th>
                      <th></th>
                    </tr></thead>
                    <tbody>
                      {athletes.filter(a => a.is_archived).map(a => (
                        <tr key={a.id} style={{ opacity:0.7 }}>
                          <td className="td-name">{a.full_name}</td>
                          <td>{a.group||'—'}</td>
                          <td>{a.age} лет</td>
                          <td>{a.dan ? `${a.dan} дан` : a.gup === 0 ? 'Без пояса' : a.gup ? `${a.gup} гып` : '—'}</td>
                          <td style={{fontSize:'0.82rem',color:'var(--gray)'}}>{a.parent_name}</td>
                          <td>
                            <button className="td-btn td-btn-edit" onClick={() => restoreAthlete(a.id)}>Восстановить</button>
                            <button className="td-btn td-btn-del" onClick={() => deleteAthlete(a.id)}>Удал.</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
            }
          </div>
        )}

        {/* ── Спортсмены ── */}
        {view === 'athletes' && (
          <div>
            {archiveAthleteModal && (
              <div className="modal-overlay" onClick={() => setArchiveAthleteModal(null)}>
                <div className="modal-box" onClick={e => e.stopPropagation()} style={{maxWidth:420}}>
                  <h3 style={{marginBottom:12}}>Архивировать спортсмена?</h3>
                  <p style={{color:'var(--white)', marginBottom:8, fontSize:'0.9rem'}}>
                    {archiveAthleteModal.athlete_name}
                  </p>
                  {!archiveAthleteModal.has_siblings && (
                    <p style={{color:'var(--gray)', marginBottom:12, fontSize:'0.85rem'}}>
                      Это единственный ребёнок у родителя {archiveAthleteModal.parent_name}. Заблокировать его кабинет?
                    </p>
                  )}
                  <div style={{display:'flex', gap:8, marginTop:16, flexWrap:'wrap'}}>
                    {!archiveAthleteModal.has_siblings ? (
                      <>
                        <button className="btn-primary" style={{padding:'8px 16px', fontSize:'13px'}} onClick={() => doArchiveAthlete(archiveAthleteModal.athlete_id, true)}>Архивировать с родителем</button>
                        <button className="btn-outline" style={{padding:'8px 16px', fontSize:'13px'}} onClick={() => doArchiveAthlete(archiveAthleteModal.athlete_id, false)}>Только спортсмена</button>
                      </>
                    ) : (
                      <button className="btn-primary" style={{padding:'8px 16px', fontSize:'13px'}} onClick={() => doArchiveAthlete(archiveAthleteModal.athlete_id, false)}>В архив</button>
                    )}
                    <button className="btn-outline" style={{padding:'8px 16px', fontSize:'13px'}} onClick={() => setArchiveAthleteModal(null)}>Отмена</button>
                  </div>
                </div>
              </div>
            )}
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
                        <><button className="td-btn td-btn-edit" onClick={() => startEdit(a)}>Ред.</button><button className="td-btn" style={{color:'var(--gray)',border:'1px solid var(--gray-dim)'}} onClick={() => archiveAthlete(a.id)}>В архив</button><button className="td-btn td-btn-del" onClick={() => deleteAthlete(a.id)}>Удал.</button></>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sortedAthletes.length === 0 && !loading && <div className="cabinet-empty">Спортсменов не найдено</div>}
            </div>
          </div>
        )}

        {/* ── Родители ── */}
        {view === 'parents' && (
          <div>
            {archiveParentModal && (
              <div className="modal-overlay" onClick={() => setArchiveParentModal(null)}>
                <div className="modal-box" onClick={e => e.stopPropagation()} style={{maxWidth:420}}>
                  <h3 style={{marginBottom:12}}>Архивировать детей?</h3>
                  <p style={{color:'var(--gray)', marginBottom:12, fontSize:'0.9rem'}}>
                    Вместе с родителем в архив перейдут:
                  </p>
                  {archiveParentModal.children.map(c => (
                    <div key={c.id} style={{color:'var(--white)', marginBottom:4, fontSize:'0.9rem'}}>— {c.full_name}</div>
                  ))}
                  <div style={{display:'flex', gap:8, marginTop:16, flexWrap:'wrap'}}>
                    <button className="btn-primary" style={{padding:'8px 16px', fontSize:'13px'}} onClick={() => archiveParent(archiveParentModal.user_id, true)}>С детьми</button>
                    <button className="btn-outline" style={{padding:'8px 16px', fontSize:'13px'}} onClick={() => archiveParent(archiveParentModal.user_id, false)}>Только родителя</button>
                    <button className="btn-outline" style={{padding:'8px 16px', fontSize:'13px'}} onClick={() => setArchiveParentModal(null)}>Отмена</button>
                  </div>
                </div>
              </div>
            )}
            <div className="athletes-table-wrap">
              <table className="athletes-table">
                <thead>
                  <tr>
                    <Th colKey="parent_name"  sort={sortP} toggle={toggleP}>ФИО</Th>
                    <Th colKey="parent_phone" sort={sortP} toggle={toggleP}>Телефон</Th>
                    <Th colKey="children"     sort={sortP} toggle={toggleP}>Спортсмены</Th>
                    <th>Пароль</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedParents.map((p, i) => (
                    <tr key={i}>
                      <td className="td-name">
                        {p.parent_name}
                        {p.children.length === 1 && p.children[0] === p.parent_name && (
                          <span style={{color:'var(--gray)', fontSize:'0.75rem', marginLeft:6}}>(взрослый спортсмен)</span>
                        )}
                      </td>
                      <td>{p.parent_phone}</td>
                      <td>{p.children.join(', ') || '—'}</td>
                      <td><button className="td-btn td-btn-edit" onClick={() => setResetUser(p)}>Сбросить пароль</button></td>
                      <td><button className="td-btn" style={{color:'var(--gray)',border:'1px solid var(--gray-dim)'}} onClick={() => archiveParent(p.user_id, null)}>В архив</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sortedParents.length === 0 && !loading && <div className="cabinet-empty">Родителей не найдено</div>}
            </div>
          </div>
        )}

        {/* ── Заявки ── */}
        {view === 'applications' && (
          <div>
            {deleteAppConfirm && (
              <div className="modal-overlay" onClick={() => setDeleteAppConfirm(null)}>
                <div className="modal-box" onClick={e => e.stopPropagation()} style={{maxWidth:400}}>
                  <h3 style={{marginBottom:12}}>Удалить заявку?</h3>
                  <p style={{color:'var(--gray)', fontSize:'0.9rem', marginBottom:16}}>
                    Заявка от <span style={{color:'var(--white)'}}>{deleteAppConfirm.full_name}</span> будет удалена безвозвратно.
                  </p>
                  <div style={{display:'flex', gap:8}}>
                    <button className="btn-primary" style={{padding:'8px 16px', fontSize:'13px'}} onClick={() => deleteApplication(deleteAppConfirm.id)}>Удалить</button>
                    <button className="btn-outline" style={{padding:'8px 16px', fontSize:'13px'}} onClick={() => setDeleteAppConfirm(null)}>Отмена</button>
                  </div>
                </div>
              </div>
            )}
            {analyticsModal && <AnalyticsModal
              token={token}
              athletes={athletes.filter(a=>!a.is_archived)}
              preselectedAthleteId={analyticsModal.athlete_id}
              preselectedAthleteName={analyticsModal.athlete_name}
              applicationId={analyticsModal.application_id}
              onClose={() => setAnalyticsModal(null)}
              onSuccess={() => { setAnalyticsModal(null); loadApplications() }}
            />}
            <div className="athletes-table-wrap">
            <table className="athletes-table">
              <thead>
                <tr>
                  <Th colKey="created_at" sort={sortAp} toggle={toggleAp}>Дата</Th>
                  <Th colKey="full_name"  sort={sortAp} toggle={toggleAp}>ФИО</Th>
                  <Th colKey="phone"      sort={sortAp} toggle={toggleAp}>Телефон</Th>
                  <th>Комментарий</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {sortedApps.map(a => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace:'nowrap' }}>{new Date(a.created_at).toLocaleDateString('ru')}</td>
                    <td className="td-name">{a.full_name}</td>
                    <td>{a.phone}</td>
                    <td style={{ fontSize:'13px', color:'var(--gray)', maxWidth:'200px' }}>{a.comment || '—'}</td>
                    <td className="td-actions">
                      <button className="td-btn td-btn-edit" onClick={() => openAnalyticsFromApp(a)}>Исполнить</button>
                      <button className="td-btn td-btn-del" onClick={() => setDeleteAppConfirm({ id: a.id, full_name: a.full_name })}>Удалить</button>
                      {(localStorage.getItem('phone') || '').replace(/[\+\s\-\(\)]/g, '') === '79253653597' && (() => {
                        const matched = athletes.find(x => x.full_name.toLowerCase() === a.full_name.toLowerCase() || x.parent_name?.toLowerCase() === a.full_name.toLowerCase())
                        if (!matched) return null
                        return <button className="td-btn" style={{color:'#c8962a', borderColor:'#c8962a'}} onClick={async () => {
                          try {
                            const r = await fetch(`${API}/analytics/export/${matched.id}`, { headers: { Authorization: `Bearer ${token}` } })
                            if (!r.ok) { alert('Ошибка'); return }
                            const data = await r.json()
                            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                            const url = URL.createObjectURL(blob)
                            const link = document.createElement('a')
                            link.href = url
                            link.download = `analytics_${matched.full_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`
                            link.click()
                            URL.revokeObjectURL(url)
                          } catch { alert('Ошибка') }
                        }}>Данные</button>
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sortedApps.length === 0 && !loading && <div className="cabinet-empty">Заявок нет</div>}
            </div>
          </div>
        )}
      </div>
    </div>
    </main>
  )
}
