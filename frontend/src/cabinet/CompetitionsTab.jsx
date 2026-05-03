import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { API, currentSeason, seasonLabel } from './constants'
import ConfirmModal from './ConfirmModal'
import LineChart from './LineChart'
import CompApplicationMatrix from '../pages/CompApplicationMatrix'
import { usePatchQueue } from './usePatchQueue'

// Поля результата, которые автосейв уносит на бэк через PATCH-эндпоинт.
// Всё остальное (_inList, full_name, weight и т.п.) — локальные/derivative.
const PERSISTED_FIELDS = new Set([
  'sparring_place', 'sparring_fights',
  'stopball_place', 'stopball_fights',
  'tegtim_place',   'tegtim_fights',
  'tuli_place',     'tuli_perfs',
  'status', 'paid',
  'powerbreak', 'spectech',
  'sparring_disabled', 'stopball_disabled', 'tegtim_disabled', 'tuli_disabled',
  'powerbreak_disabled', 'spectech_disabled',
])
// Toggle-поля улетают сразу (immediate), числовые — через дебаунс 700 ms.
const IMMEDIATE_FIELDS = new Set([
  'status', 'paid',
  'powerbreak', 'spectech',
  'sparring_disabled', 'stopball_disabled', 'tegtim_disabled', 'tuli_disabled',
  'powerbreak_disabled', 'spectech_disabled',
])
const PLACE_FIELDS = new Set(['sparring_place','stopball_place','tegtim_place','tuli_place'])

const SIG_TABLE = {
  'Местный':        { 'Фестиваль': 1.0, 'Турнир': 1.2, 'Кубок': 1.5, 'Первенство': 1.5, 'Чемпионат': 1.5 },
  'Региональный':   { 'Фестиваль': 2.5, 'Турнир': 3.0, 'Кубок': 3.5, 'Первенство': 4.0, 'Чемпионат': 5.0 },
  'Окружной':       { 'Фестиваль': 5.0, 'Турнир': 5.0, 'Кубок': 5.5, 'Первенство': 6.0, 'Чемпионат': 6.0 },
  'Всероссийский':  { 'Фестиваль': 7.0, 'Турнир': 7.0, 'Кубок': 8.0, 'Первенство': 8.0, 'Чемпионат': 9.0 },
  'Международный':  { 'Фестиваль': 10.0, 'Турнир': 10.0, 'Кубок': 11.0, 'Первенство': 11.0, 'Чемпионат': 12.0 },
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

export function calcRatingPreview(row, sig) {
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

export default function CompetitionsTab({ token, athletes, readOnly = false }) {
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
  const [showForm,       setShowForm]       = useState(false)
  // MIGRATION 2025-05-03: можно удалить через 30 дней после деплоя коммита 2/3
  // (страховочная модалка для несинхронизированных черновиков из старой схемы).
  const [draftConflict,  setDraftConflict]  = useState(null) // { compId, athletes: [{ athlete_id, full_name, changes }] }
  const [showAddAthlete, setShowAddAthlete] = useState(false)
  const [showChart,      setShowChart]      = useState(false)
  const [chartData,      setChartData]      = useState([])
  const [compConfirm,    setCompConfirm]    = useState(null)
  const [msg,            setMsg]            = useState('')
  const [form, setForm] = useState({ name:'', date:'', time:'09:00', location:'', level:'Местный', comp_type:'Турнир', notes:'', add_to_calendar: false })

  const [compFiles,      setCompFiles]      = useState([])
  const [filesLoading,   setFilesLoading]   = useState(false)
  const [availableToAdd, setAvailableToAdd] = useState([])
  const [addLoading,     setAddLoading]     = useState(false)

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

  // Сервер возвращает поля с null для пустого места и булевы как есть. UI хочет
  // '' для пустого селекта; нормализуем перед мержем в rows.
  const applyServerUpdate = (updated) => {
    if (!updated || !updated.athlete_id) return
    const norm = { ...updated }
    for (const k of ['sparring_place','stopball_place','tegtim_place','tuli_place']) {
      if (norm[k] === null) norm[k] = ''
    }
    setRows(prev => prev.map(row => row.athlete_id === updated.athlete_id ? { ...row, ...norm } : row))
  }
  const handleSaveError = (athleteId, fields, err) => {
    console.warn('PATCH failed', { athleteId, fields, err })
    setMsg('Ошибка автосохранения. Нажмите «Повторить» в индикаторе.')
  }
  const { enqueue, status: saveStatus, retryFailed } = usePatchQueue({
    apiBase: API, compId: detail?.id, token,
    onSuccess: applyServerUpdate, onError: handleSaveError,
  })

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
          powerbreak:           ex.powerbreak           ?? false,
          spectech:             ex.spectech             ?? false,
          sparring_disabled:    ex.sparring_disabled    ?? false,
          stopball_disabled:    ex.stopball_disabled    ?? false,
          tegtim_disabled:      ex.tegtim_disabled      ?? false,
          tuli_disabled:        ex.tuli_disabled        ?? false,
          powerbreak_disabled:  ex.powerbreak_disabled  ?? false,
          spectech_disabled:    ex.spectech_disabled    ?? false,
          weight:          a.weight           || null,
          birth_date:      a.birth_date       || '',
          dan:             a.dan,
          auto_group:      a.auto_group       || '',
          _inList:         true,
        }
      })
      setRows(baseList)
      setAllAthletes(athletes)
      setCompView('detail')
      await loadFiles(comp.id)
      // MIGRATION 2025-05-03: разовая защита для черновиков из старой схемы.
      // Сравниваем localStorage-черновик с актуальной БД; конфликты — в модалку,
      // совпадения — молча убираем. Можно удалить через 30 дней.
      try {
        const draftRaw = localStorage.getItem(`comp_draft_${comp.id}`)
        if (!draftRaw) return
        const parsed = JSON.parse(draftRaw)
        const COMPARABLE = ['sparring_place','sparring_fights','stopball_place','stopball_fights',
                            'tegtim_place','tegtim_fights','tuli_place','tuli_perfs']
        const conflicts = []
        parsed.forEach(d => {
          const bd = baseList.find(b => b.athlete_id === d.athlete_id)
          if (!bd) return
          const changes = {}
          COMPARABLE.forEach(f => {
            if (String(d[f] ?? '') !== String(bd[f] ?? '')) changes[f] = d[f]
          })
          if (Object.keys(changes).length > 0) {
            conflicts.push({ athlete_id: d.athlete_id, full_name: bd.full_name, changes })
          }
        })
        if (conflicts.length > 0) {
          setDraftConflict({ compId: comp.id, athletes: conflicts })
        } else {
          try { localStorage.removeItem(`comp_draft_${comp.id}`) } catch {}
        }
      } catch {}
    } catch {}
    setLoading(false)
  }

  const removeRow = async (athleteId) => {
    if (!detail) return
    try {
      const r = await fetch(`${API}/competitions/${detail.id}/results/${athleteId}`, {
        method: 'DELETE', headers: h,
      })
      // 204 — удалено, 404 — строки не было (ничего не сохраняли) — тоже OK.
      if (r.status !== 204 && r.status !== 404) { setMsg('Ошибка удаления'); return }
      setRows(prev => prev.filter(x => x.athlete_id !== athleteId))
    } catch { setMsg('Ошибка удаления') }
  }

  const openAddModal = async () => {
    setAvailableToAdd([])
    setAddLoading(true)
    setShowAddAthlete(true)
    try {
      const r = await fetch(`${API}/users/athletes`, { headers: h })
      if (r.ok) {
        const fresh = await r.json()
        const alreadyIn = new Set(rows.map(r => r.athlete_id))
        setAvailableToAdd(fresh.filter(a => !alreadyIn.has(a.id)))
      }
    } catch {}
    setAddLoading(false)
  }

  const addAthleteToList = (a) => {
    if (rows.find(r => r.athlete_id === a.id)) return
    setRows(prev => [...prev, {
      athlete_id: a.id, full_name: a.full_name,
      sparring_place: '', sparring_fights: 0,
      stopball_place: '', stopball_fights: 0,
      tegtim_place: '',   tegtim_fights: 0,
      tuli_place: '',     tuli_perfs: 0,
      saved_rating: null,
      status: 'pending',
      paid: false,
      powerbreak: false, spectech: false,
      sparring_disabled: false, stopball_disabled: false,
      tegtim_disabled: false, tuli_disabled: false,
      powerbreak_disabled: false, spectech_disabled: false,
      weight: a.weight || null, birth_date: a.birth_date || '',
      dan: a.dan, auto_group: a.auto_group || '',
      _inList: true,
    }])
    setAvailableToAdd(prev => prev.filter(x => x.id !== a.id))
    setShowAddAthlete(false)
    // Создаём строку CompetitionResult на бэке (upsert), чтобы последующие PATCH'и
    // не падали 404. Если сетевая ошибка — пользователь увидит индикатор + сможет
    // нажать «Повторить»; локальное добавление не откатываем.
    enqueue(a.id, { status: 'pending' }, { immediate: true })
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

  // Optimistic local update + автосейв через PATCH-очередь.
  // Не-persisted поля (например full_name) остаются только в локальном state.
  const updateRow = (athleteId, field, value) => {
    setRows(prev => prev.map(r => r.athlete_id === athleteId ? { ...r, [field]: value } : r))
    if (!detail || !PERSISTED_FIELDS.has(field)) return
    let payloadValue = value
    if (PLACE_FIELDS.has(field)) {
      payloadValue = (value === '' || value === null) ? null : Number(value)
    } else if (field.endsWith('_fights') || field === 'tuli_perfs') {
      payloadValue = Number(value) || 0
    }
    enqueue(athleteId, { [field]: payloadValue }, { immediate: IMMEDIATE_FIELDS.has(field) })
  }

  const updateRowStatus = (athleteId, status) => updateRow(athleteId, 'status', status)

  // MIGRATION 2025-05-03: применить найденный черновик на сервер, потом убрать ключ.
  const applyDraftConflict = () => {
    if (!draftConflict) return
    const { compId, athletes: ath } = draftConflict
    ath.forEach(({ athlete_id, changes }) => {
      // Optimistic local update
      setRows(prev => prev.map(r => r.athlete_id === athlete_id ? { ...r, ...changes } : r))
      // Нормализуем place ('' -> null) и fights в числа перед отправкой
      const payload = {}
      Object.entries(changes).forEach(([f, v]) => {
        if (PLACE_FIELDS.has(f)) payload[f] = (v === '' || v === null) ? null : Number(v)
        else if (f.endsWith('_fights') || f === 'tuli_perfs') payload[f] = Number(v) || 0
        else payload[f] = v
      })
      enqueue(athlete_id, payload, { immediate: true })
    })
    try { localStorage.removeItem(`comp_draft_${compId}`) } catch {}
    setDraftConflict(null)
  }
  const discardDraftConflict = () => {
    if (!draftConflict) return
    try { localStorage.removeItem(`comp_draft_${draftConflict.compId}`) } catch {}
    setDraftConflict(null)
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
            onChange={e => updateRow(r.athlete_id, 'paid', e.target.checked)}/>}
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
              {!readOnly && <button className="att-all-btn" onClick={openAddModal}>+ Добавить бойца</button>}
              {!readOnly && <button className="att-all-btn" onClick={notifyComp}>Уведомить всех</button>}
              <button className="att-all-btn" onClick={exportResultsXlsx}>Экспорт xlsx</button>
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
  enqueue={enqueue}
  saveStatus={saveStatus}
  retryFailed={retryFailed}
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
            {addLoading
              ? <p style={{ color:'var(--gray)' }}>Загрузка...</p>
              : availableToAdd.length === 0
                ? <p style={{ color:'var(--gray)' }}>Все спортсмены уже в списке.</p>
                : availableToAdd.map(a => (
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

      {/* MIGRATION 2025-05-03: модалка для несинхронизированных черновиков из старой схемы.
          Можно удалить через 30 дней после деплоя коммита 2/3. */}
      {draftConflict && (
        <div className="modal-overlay" onClick={discardDraftConflict}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <h3>Обнаружены несохранённые данные</h3>
            <p style={{ color: 'var(--gray)', fontSize: 14, lineHeight: 1.5 }}>
              В вашем браузере найдены изменения по этому соревнованию,
              которые не были отправлены на сервер ({draftConflict.athletes.length} спортсм.).
              Применить их сейчас или отбросить?
            </p>
            <ul style={{ margin: '8px 0', padding: '0 0 0 18px', color: 'var(--white)', fontSize: 13, maxHeight: 180, overflowY: 'auto' }}>
              {draftConflict.athletes.map(a => (
                <li key={a.athlete_id}>{a.full_name}</li>
              ))}
            </ul>
            <div className="modal-btns-row" style={{ marginTop: 12 }}>
              <button className="btn-primary" onClick={applyDraftConflict}>Применить и сохранить</button>
              <button className="btn-outline" onClick={discardDraftConflict}>Отбросить</button>
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
