import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
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
import ParentInsuranceTab, { InsuranceStatus } from '../cabinet/ParentInsuranceTab'
import AttendanceTab from '../cabinet/AttendanceTab'
import RatingTab from '../cabinet/RatingTab'
import NotificationsTab from '../cabinet/NotificationsTab'
import InsuranceAdminTab from '../cabinet/InsuranceAdminTab'
import { AchievementBadge, AchievementsLeaderboard } from '../cabinet/AchievementsTab'
import AchievementsTab from '../cabinet/AchievementsTab'
import AnalyticsModal from '../cabinet/AnalyticsModal'
const CertificationTab  = lazy(() => import('../cabinet/CertificationTab'))
const HallOfFameAdmin   = lazy(() => import('../cabinet/HallOfFameAdmin'))
const CampsTab          = lazy(() => import('../cabinet/CampsTab'))
const InfoTab           = lazy(() => import('../cabinet/InfoTab'))
const AnalyticsAdminTab = lazy(() => import('../cabinet/AnalyticsAdminTab'))
const CompetitionsTab   = lazy(() => import('../cabinet/CompetitionsTab'))
const NewsTab           = lazy(() => import('../cabinet/NewsTab'))
const FeesTab           = lazy(() => import('../cabinet/FeesTab'))
const MyFeesTab         = lazy(() => import('../cabinet/MyFeesTab'))



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
  const [userRoles, setUserRoles] = useState({}) // user_id → role
  const [overdueCount, setOverdueCount] = useState(0)
  const resetFilters = () => { setSearch(''); setCfState({ gender:'', group:'', gup_dan:'', parent_name:'' }) }

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    if (isAdmin) { loadAthletes(); loadApplications(); loadUserRoles() }
    else loadMyAthletes()
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    const load = async () => {
      try {
        const r = await fetch(`${API}/fees/overdue-count`, { headers: { Authorization: `Bearer ${token}` } })
        if (r.ok) { const d = await r.json(); setOverdueCount(d.count) }
      } catch {}
    }
    load()
    const interval = setInterval(load, 300000)
    return () => clearInterval(interval)
  }, [token])

  const loadUserRoles = async () => {
    try {
      const r = await fetch(`${API}/users/`, { headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) {
        const data = await r.json()
        const map = {}
        data.forEach(u => { map[u.id] = u.role })
        setUserRoles(map)
      }
    } catch {}
  }

  const changeUserRole = async (userId, newRole) => {
    try {
      const r = await fetch(`${API}/users/${userId}/role`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (r.ok) {
        setUserRoles(prev => ({ ...prev, [userId]: newRole }))
      } else {
        const err = await r.json()
        alert(err.detail || 'Ошибка')
      }
    } catch {}
  }

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
  const isAnalyticsApp = (a) => !!(a.comment && a.comment.toLowerCase().includes('аналитику'))

  const filteredApps = applications.filter(a =>
    (a.status === 'new' || a.status === 'processing') &&
    (a.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (a.phone||'').includes(search))
  )

  const { sorted: sortedAthletes, sort: sortA,  toggle: toggleA  } = useSorted(filteredAthletes)
  const { sorted: sortedParents,  sort: sortP,  toggle: toggleP  } = useSorted(filteredParents)
  const { sorted: sortedApps,     sort: sortAp, toggle: toggleAp } = useSorted(filteredApps)

  const activeFiltersCount = Object.values(cf).filter(Boolean).length + (search ? 1 : 0)
  const logout = () => { localStorage.clear(); navigate('/login') }

  // ── КАБИНЕТ РОДИТЕЛЯ ────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <Suspense fallback={<div className="cabinet-loading">Загрузка...</div>}>
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
            <button className={`cabinet-tab ${parentView==='fees'?'active':''}`} onClick={() => setParentView('fees')}>Взносы</button>
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
          {parentView === 'fees'          && <MyFeesTab token={token}/>}
          {parentView === 'info'          && <InfoTab isAdmin={false} token={token}/>}
          {parentView === 'analytics'     && !loading && <ParentAnalyticsTab token={token} athletes={myAthletes}/>}
        </div>
      </main>
      </Suspense>
    )
  }

  // ── КАБИНЕТ АДМИНА ──────────────────────────────────────────────────────────
  return (
    <Suspense fallback={<div className="cabinet-loading">Загрузка...</div>}>
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
      <button className={`cabinet-tab ${view==='fees'?'active':''}`} onClick={() => setView('fees')}>Взносы{overdueCount > 0 && <span className="tab-badge" style={{ background:'var(--red)' }}>{overdueCount}</span>}</button>
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

        {view !== 'attendance' && view !== 'competitions' && view !== 'rating' && view !== 'certification' && view !== 'achievements' && view !== 'camps' && view !== 'archive' && view !== 'analytics' && view !== 'insurance_admin' && view !== 'fees' && (
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
        {view === 'fees'          && <FeesTab token={token} athletes={athletes.filter(a=>!a.is_archived)} />}
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
                    <th>Роль</th>
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
                      <td>
                        {role === 'admin' ? (
                          <select
                            value={userRoles[p.user_id] || 'parent'}
                            onChange={e => changeUserRole(p.user_id, e.target.value)}
                            className="td-input td-input-sm"
                            style={{ color: userRoles[p.user_id] === 'admin' ? 'var(--red)' : userRoles[p.user_id] === 'manager' ? '#c8962a' : 'var(--gray)' }}
                          >
                            <option value="parent">parent</option>
                            <option value="manager">manager</option>
                            <option value="admin">admin</option>
                          </select>
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: userRoles[p.user_id] === 'admin' ? 'var(--red)' : userRoles[p.user_id] === 'manager' ? '#c8962a' : 'var(--gray)' }}>
                            {userRoles[p.user_id] || 'parent'}
                          </span>
                        )}
                      </td>
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
                  <th>Тип</th>
                  <th>Комментарий</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {sortedApps.map(a => {
                  const isAnalytics = isAnalyticsApp(a)
                  const typeBadge = isAnalytics
                    ? <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:3, fontSize:'0.72rem', fontFamily:'Barlow Condensed', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', background:'rgba(200,150,42,0.15)', color:'#c8962a', border:'1px solid rgba(200,150,42,0.4)', whiteSpace:'nowrap' }}>Аналитика</span>
                    : <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:3, fontSize:'0.72rem', fontFamily:'Barlow Condensed', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', background:'rgba(108,186,108,0.12)', color:'#6cba6c', border:'1px solid rgba(108,186,108,0.35)', whiteSpace:'nowrap' }}>Первичное посещение</span>
                  return (
                  <tr key={a.id}>
                    <td style={{ whiteSpace:'nowrap' }}>{new Date(a.created_at).toLocaleDateString('ru')}</td>
                    <td className="td-name">{a.full_name}</td>
                    <td>{a.phone}</td>
                    <td>{typeBadge}</td>
                    <td style={{ fontSize:'13px', color:'var(--gray)', maxWidth:'200px' }}>{a.comment || '—'}</td>
                    <td className="td-actions">
                      <button className="td-btn td-btn-edit" onClick={() => isAnalytics ? openAnalyticsFromApp(a) : updateAppStatus(a.id, 'confirmed')}>Исполнить</button>
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
                  )
                })}
              </tbody>
            </table>
            {sortedApps.length === 0 && !loading && <div className="cabinet-empty">Заявок нет</div>}
            </div>
          </div>
        )}
      </div>
    </div>
    </main>
    </Suspense>
  )
}
