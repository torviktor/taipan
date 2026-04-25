import { useState, useEffect, useMemo, lazy, Suspense, Component } from 'react'
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



// ── ERROR BOUNDARY ─────────────────────────────────────────────────────────────
class CabinetErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error, info) {
    console.error('CabinetErrorBoundary caught:', error, info)
  }
  render() {
    if (this.state.hasError) return (
      <div style={{ padding: 40, color: 'var(--white)' }}>
        <h2>Ошибка</h2>
        <pre style={{ color: 'var(--red)', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
          {this.state.error?.toString()}
        </pre>
        <button className="btn-outline" onClick={() => window.location.reload()}>
          Обновить
        </button>
      </div>
    )
    return this.props.children
  }
}

// ── ИНДИВИДУАЛЬНЫЕ ЗАНЯТИЯ ────────────────────────────────────────────────────
function IndividualTrainingTab({ token, role, athletes }) {
  const API_URL = (typeof API !== 'undefined' ? API : '/api')
  const isManager = role === 'manager' || role === 'admin'

  const [requests,      setRequests]      = useState([])
  const [athleteId,     setAthleteId]     = useState(athletes && athletes.length === 1 ? athletes[0].id : '')
  const [format,        setFormat]        = useState('individual')
  const [prefTime,      setPrefTime]      = useState('')
  const [comment,       setComment]       = useState('')
  const [sending,       setSending]       = useState(false)
  const [sent,          setSent]          = useState(false)
  const [error,         setError]         = useState('')

  const loadRequests = async () => {
    try {
      const r = await fetch(`${API_URL}/individual-training/requests`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (r.ok) setRequests(await r.json())
    } catch {}
  }

  useEffect(() => { loadRequests() }, [])

  const handleSubmit = async () => {
    setError('')
    if (!athleteId && athletes && athletes.length > 1) { setError('Выберите спортсмена'); return }
    setSending(true)
    try {
      const r = await fetch(`${API_URL}/individual-training/request`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ athlete_id: athleteId || null, format, preferred_time: prefTime, comment }),
      })
      if (r.ok) {
        setSent(true)
        setPrefTime(''); setComment('')
        loadRequests()
      } else {
        const d = await r.json()
        setError(d.detail || 'Ошибка отправки')
      }
    } catch { setError('Ошибка сети') }
    setSending(false)
  }

  const handleStatus = async (id, status) => {
    await fetch(`${API_URL}/individual-training/requests/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    loadRequests()
  }

  const statusLabel = s => {
    if (s === 'new')       return <span style={{ color:'#FFD700' }}>На рассмотрении</span>
    if (s === 'confirmed') return <span style={{ color:'#6cba6c' }}>Подтверждена</span>
    if (s === 'rejected')  return <span style={{ color:'var(--red)' }}>Отклонена</span>
    return s
  }

  return (
    <div style={{ marginTop: 24 }}>
      {/* Карточки форматов */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px,1fr))', gap:16, marginBottom:32 }}>
        <div style={{ background:'var(--dark2)', border:'1px solid var(--gray-dim)', borderTop:'3px solid var(--red)', borderRadius:10, padding:20 }}>
          <div style={{ fontWeight:700, fontSize:'1.05rem', marginBottom:6 }}>Индивидуальное занятие</div>
          <div style={{ color:'var(--red)', fontWeight:600, marginBottom:8 }}>1 ребёнок • 2000 руб / 1 час</div>
          <div style={{ color:'var(--gray)', fontSize:'0.9rem' }}>Персональная работа, максимальное внимание тренера, точная корректировка техники.</div>
        </div>
        <div style={{ background:'var(--dark2)', border:'1px solid var(--gray-dim)', borderTop:'3px solid #c8962a', borderRadius:10, padding:20 }}>
          <div style={{ fontWeight:700, fontSize:'1.05rem', marginBottom:6 }}>Мини-группа</div>
          <div style={{ color:'#c8962a', fontWeight:600, marginBottom:8 }}>2–3 ребёнка • 1000 руб / 1 час</div>
          <div style={{ color:'var(--gray)', fontSize:'0.9rem' }}>Совместная работа, упражнения в парах и мини-группах.</div>
        </div>
      </div>

      {/* Блок про состав */}
      <div style={{ borderLeft:'3px solid var(--red)', paddingLeft:16, marginBottom:28, color:'var(--gray)', fontSize:'0.9rem' }}>
        <strong style={{ color:'var(--white)', display:'block', marginBottom:6 }}>Если меняется состав группы</strong>
        При отсутствии одного из детей мини-группы второй может: перейти в другую мини-группу этого дня если есть место — оплата 1000 руб,
        или остаться на своём времени — занятие в формате индивидуального за 2000 руб.
      </div>

      {/* Форма */}
      <p className="section-label" style={{ marginBottom: 12 }}>Записаться на индивидуальное занятие</p>
      <div style={{ background:'var(--dark2)', border:'1px solid var(--gray-dim)', borderRadius:10, padding:24 }}>
        {athletes && athletes.length > 1 && (
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', marginBottom:6, fontSize:'0.85rem', color:'var(--gray)' }}>Спортсмен</label>
            <select className="td-input" value={athleteId} onChange={e => setAthleteId(Number(e.target.value))} style={{ width:'100%' }}>
              <option value="">Выберите спортсмена</option>
              {athletes.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
            </select>
          </div>
        )}

        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', marginBottom:8, fontSize:'0.85rem', color:'var(--gray)' }}>Формат занятия</label>
          <div style={{ display:'flex', gap:20 }}>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
              <input type="radio" name="format" value="individual" checked={format==='individual'} onChange={() => setFormat('individual')} />
              <span>Индивидуальное занятие <span style={{ color:'var(--red)' }}>(2000 руб)</span></span>
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
              <input type="radio" name="format" value="mini_group" checked={format==='mini_group'} onChange={() => setFormat('mini_group')} />
              <span>Мини-группа <span style={{ color:'#c8962a' }}>(1000 руб с ребёнка)</span></span>
            </label>
          </div>
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={{ display:'block', marginBottom:6, fontSize:'0.85rem', color:'var(--gray)' }}>Пожелания по времени</label>
          <input className="td-input" style={{ width:'100%' }} placeholder="Например: вторник после 17:00"
            value={prefTime} onChange={e => setPrefTime(e.target.value)} />
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={{ display:'block', marginBottom:6, fontSize:'0.85rem', color:'var(--gray)' }}>Комментарий</label>
          <textarea className="td-input" rows={3} style={{ width:'100%', resize:'vertical' }}
            placeholder="Дополнительные пожелания..."
            value={comment} onChange={e => setComment(e.target.value)} />
        </div>

        {error && <div style={{ color:'var(--red)', marginBottom:12 }}>{error}</div>}

        <button className="btn-primary" onClick={handleSubmit} disabled={sending}>
          {sending ? 'Отправка...' : 'Отправить заявку'}
        </button>

        {sent && (
          <div style={{ color:'#6cba6c', marginTop:12 }}>
            Заявка отправлена! Тренер свяжется с вами в ближайшее время.
          </div>
        )}

        {requests.length > 0 && (
          <div style={{ marginTop:28 }}>
            <p style={{ color:'var(--gray)', fontSize:'0.85rem', marginBottom:10 }}>Ваши заявки</p>
            {requests.map(r => (
              <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--gray-dim)', fontSize:'0.9rem' }}>
                <span>{r.created_at} — {r.format === 'individual' ? 'Индивид.' : 'Мини-группа'}{r.athlete_name ? ` (${r.athlete_name})` : ''}</span>
                <span>{statusLabel(r.status)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
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
  const isAdmin  = role === 'admin'

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
  const [indivRequests, setIndivRequests] = useState([])
  const [shareModal,   setShareModal]   = useState(null) // { athleteId, athleteName, inviteUrl, viewers, revoking }
  const [viewers,      setViewers]      = useState([])
  const [revokeViewerModal, setRevokeViewerModal] = useState(null) // { viewerId, athleteId, viewerName, athleteName }
  const resetFilters = () => { setSearch(''); setCfState({ gender:'', group:'', gup_dan:'', parent_name:'' }) }

  const loadIndivRequests = async () => {
    try {
      const r = await fetch(`${API}/individual-training/requests`, { headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) setIndivRequests(await r.json())
    } catch {}
  }

  const openShareModal = async (athlete) => {
    try {
      const [invRes, viewRes] = await Promise.all([
        fetch(`${API}/invite/generate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ athlete_id: athlete.id }),
        }),
        fetch(`${API}/invite/my-viewers/${athlete.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])
      const inv     = invRes.ok  ? await invRes.json()  : null
      const viewers = viewRes.ok ? await viewRes.json() : []
      setShareModal({
        athleteId:  athlete.id,
        athleteName: athlete.full_name,
        inviteUrl:  inv ? inv.invite_url : '',
        viewers,
        revoking:   false,
      })
    } catch {}
  }

  const revokeShare = async (athleteId) => {
    setShareModal(prev => prev ? { ...prev, revoking: true } : prev)
    try {
      await fetch(`${API}/invite/revoke/${athleteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setShareModal(prev => prev ? { ...prev, viewers: [], revoking: false } : prev)
    } catch {
      setShareModal(prev => prev ? { ...prev, revoking: false } : prev)
    }
  }

  const updateIndivStatus = async (id, status) => {
    await fetch(`${API}/individual-training/requests/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    loadIndivRequests()
  }

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    if (isAdmin) { loadAthletes(); loadApplications(); loadUserRoles(); loadIndivRequests(); loadViewers() }
    else loadMyAthletes()
  }, [])

  useEffect(() => {
    if (role !== 'admin' && role !== 'manager') return
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

  const loadViewers = async () => {
    try {
      const r = await fetch(`${API}/users/viewers`, { headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) setViewers(await r.json())
    } catch {}
  }

  const revokeViewerAccess = (viewerId, athleteId, viewerName, athleteName) => {
    setRevokeViewerModal({ viewerId, athleteId, viewerName, athleteName })
  }

  const doRevokeViewer = async () => {
    if (!revokeViewerModal) return
    const { viewerId, athleteId } = revokeViewerModal
    try {
      const r = await fetch(`${API}/users/viewers/${viewerId}/athlete/${athleteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (r.ok) {
        setViewers(prev => prev.filter(v => !(v.viewer_id === viewerId && v.athlete_id === athleteId)))
        setRevokeViewerModal(null)
      } else {
        const err = await r.json()
        alert(err.detail || 'Ошибка')
      }
    } catch {}
  }

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

  // ── КАБИНЕТ РОДИТЕЛЯ / ТРЕНЕРА ──────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <CabinetErrorBoundary>
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
            <button className={`cabinet-tab ${parentView==='individual'?'active':''}`} onClick={() => setParentView('individual')} style={{ display: 'none' }}>Индивид. занятия</button>
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
                      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                        <div className="my-athlete-name">{a.full_name}</div>
                        {a.is_viewer && (
                          <span style={{
                            fontSize:'0.72rem', fontFamily:'Barlow Condensed', fontWeight:700,
                            letterSpacing:'0.06em', textTransform:'uppercase',
                            color:'var(--gray)', border:'1px solid var(--gray-dim)',
                            borderRadius:4, padding:'2px 8px',
                          }}>Просмотр</span>
                        )}
                      </div>
                      <div className="my-athlete-details">
                        <span>Дата рождения: {a.birth_date}</span>
                        <span>{a.age} лет</span>
                        <span>{a.gender === 'male' ? 'Мужской' : 'Женский'}</span>
                        <span>{a.group || a.auto_group}</span>
                      </div>
                      <BeltDisplay gup={a.gup} dan={a.dan}/>
                      {!a.is_viewer && <InsuranceStatus athleteId={a.id} token={token} />}
                      {!a.is_viewer && role === 'parent' && (
                        <button
                          className="btn-outline"
                          style={{ marginTop:10, fontSize:'0.8rem', padding:'6px 14px' }}
                          onClick={() => openShareModal(a)}>
                          Поделиться доступом
                        </button>
                      )}
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
          {parentView === 'fees'          && (role === 'manager' ? <FeesTab token={token} role={role}/> : <MyFeesTab token={token}/>)}
          {parentView === 'info'          && <InfoTab isAdmin={false} isManager={role === 'manager'} token={token}/>}
          {parentView === 'analytics'     && !loading && <ParentAnalyticsTab token={token} athletes={myAthletes}/>}
          {false && parentView === 'individual'    && <IndividualTrainingTab token={token} role={role} athletes={myAthletes}/>}
        </div>

        {/* ── Модал: поделиться доступом ── */}
        {shareModal && (
          <div className="modal-overlay" onClick={() => setShareModal(null)}>
            <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:480 }}>
              <h3 style={{ marginBottom:8 }}>Поделиться доступом</h3>
              <p style={{ color:'var(--gray)', fontSize:'0.85rem', marginBottom:20 }}>
                Профиль: <strong style={{ color:'var(--white)' }}>{shareModal.athleteName}</strong>
              </p>

              {shareModal.inviteUrl && (
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:'0.8rem', color:'var(--gray)', fontFamily:'Barlow Condensed',
                    fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8 }}>
                    Ссылка-приглашение
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <input readOnly value={shareModal.inviteUrl}
                      style={{ flex:1, background:'var(--dark2)', border:'1px solid var(--gray-dim)',
                        borderRadius:6, padding:'9px 12px', color:'var(--white)',
                        fontFamily:'Barlow', fontSize:'13px', outline:'none' }} />
                    <button className="btn-outline" style={{ padding:'9px 14px', fontSize:'0.8rem', whiteSpace:'nowrap' }}
                      onClick={() => { navigator.clipboard.writeText(shareModal.inviteUrl) }}>
                      Копировать
                    </button>
                  </div>
                  <p style={{ color:'var(--gray)', fontSize:'0.78rem', marginTop:6 }}>
                    Ссылка действительна 30 дней
                  </p>
                </div>
              )}

              {shareModal.viewers && shareModal.viewers.length > 0 && (
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:'0.8rem', color:'var(--gray)', fontFamily:'Barlow Condensed',
                    fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8 }}>
                    Имеют доступ
                  </div>
                  {shareModal.viewers.map(v => (
                    <div key={v.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'8px 0', borderBottom:'1px solid var(--gray-dim)', fontSize:'0.88rem',
                      color:'var(--white)' }}>
                      {v.viewer_name}
                    </div>
                  ))}
                </div>
              )}

              <div className="modal-btns-row">
                <button className="btn-outline" style={{ color:'var(--red)', borderColor:'var(--red)' }}
                  disabled={shareModal.revoking}
                  onClick={() => revokeShare(shareModal.athleteId)}>
                  {shareModal.revoking ? 'Отзыв...' : 'Отозвать доступ'}
                </button>
                <button className="btn-outline" onClick={() => setShareModal(null)}>Закрыть</button>
              </div>
            </div>
          </div>
        )}
      </main>
      </Suspense>
      </CabinetErrorBoundary>
    )
  }

  // ── КАБИНЕТ АДМИНА ──────────────────────────────────────────────────────────
  return (
    <CabinetErrorBoundary>
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
      <button className={`cabinet-tab ${view==='viewers'?'active':''}`} onClick={() => setView('viewers')}>Приглашённые ({viewers.length})</button>
      <button className={`cabinet-tab ${view==='insurance_admin'?'active':''}`} onClick={() => setView('insurance_admin')}>Страхование</button>
      <button className={`cabinet-tab ${view==='fees'?'active':''}`} onClick={() => setView('fees')}>Взносы</button>
      <button className={`cabinet-tab ${view==='archive'?'active':''}`} style={{ color: view==='archive' ? undefined : 'var(--gray)' }} onClick={() => setView('archive')}>Архив ({athletes.filter(a=>a.is_archived).length})</button>
      <button className={`cabinet-tab ${view==='applications'?'active':''}`} onClick={() => setView('applications')}>Заявки{(applications.filter(a => a.status==='new').length + indivRequests.filter(r => r.status==='new').length) > 0 && <span className="tab-badge">{applications.filter(a => a.status==='new').length + indivRequests.filter(r => r.status==='new').length}</span>}</button>
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
      {(role === 'manager' || role === 'admin') && <button className={`cabinet-tab ${view==='strategy'?'active':''}`} onClick={() => setView('strategy')}>Стратегия</button>}
    </div>
  </div>
</div>

          </div>

        {view !== 'attendance' && view !== 'competitions' && view !== 'rating' && view !== 'certification' && view !== 'achievements' && view !== 'camps' && view !== 'archive' && view !== 'analytics' && view !== 'insurance_admin' && view !== 'fees' && view !== 'strategy' && (
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
        {view === 'info'          && <InfoTab isAdmin={role === 'admin'} isManager={role === 'manager' || role === 'admin'} token={token} />}
        {view === 'strategy'      && (role === 'manager' || role === 'admin') && <StrategyTab token={token} role={role} />}
        {view === 'analytics'     && <AnalyticsAdminTab token={token} athletes={athletes} />}
        {view === 'insurance_admin' && <InsuranceAdminTab token={token} athletes={athletes.filter(a=>!a.is_archived)} />}
        {view === 'hof'           && <HallOfFameAdmin token={token} />}
        {view === 'fees'          && <FeesTab token={token} role={role} />}
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

        {/* ── Приглашённые (вторые родители по invite-ссылке) ── */}
        {view === 'viewers' && (
          <div>
            {revokeViewerModal && (
              <div className="modal-overlay" onClick={() => setRevokeViewerModal(null)}>
                <div className="modal-box" onClick={e => e.stopPropagation()} style={{maxWidth:440}}>
                  <h3 style={{marginBottom:12}}>Отозвать доступ?</h3>
                  <p style={{color:'var(--gray)', marginBottom:8, fontSize:'0.9rem', lineHeight:1.6}}>
                    У пользователя <span style={{color:'var(--white)'}}>{revokeViewerModal.viewerName}</span> будет отозван доступ к спортсмену <span style={{color:'var(--white)'}}>{revokeViewerModal.athleteName}</span>.
                  </p>
                  <p style={{color:'var(--gray)', marginBottom:16, fontSize:'0.85rem'}}>
                    Аккаунт пользователя останется, но он перестанет видеть данные этого спортсмена.
                  </p>
                  <div style={{display:'flex', gap:8, marginTop:8, flexWrap:'wrap'}}>
                    <button className="btn-primary" style={{padding:'8px 16px', fontSize:'13px'}} onClick={doRevokeViewer}>Отозвать</button>
                    <button className="btn-outline" style={{padding:'8px 16px', fontSize:'13px'}} onClick={() => setRevokeViewerModal(null)}>Отмена</button>
                  </div>
                </div>
              </div>
            )}
            <div style={{ marginBottom:16, padding:'12px 16px', background:'var(--dark2)', border:'1px solid var(--gray-dim)', borderLeft:'3px solid var(--red)', fontSize:'0.88rem', color:'var(--gray)', lineHeight:1.6 }}>
              Это пользователи, которые получили доступ к профилю спортсмена по ссылке-приглашению от основного родителя. У них режим <span style={{color:'var(--white)'}}>только чтение</span> — они видят профиль, посещаемость, рейтинг и ачивки, но не могут отвечать на уведомления, оплачивать взносы и т.п. Создавать такие приглашения может сам родитель из своей карточки спортсмена.
            </div>
            <div className="athletes-table-wrap">
              <table className="athletes-table">
                <thead>
                  <tr>
                    <th>ФИО</th>
                    <th>Телефон</th>
                    <th>Email</th>
                    <th>Доступ к спортсмену</th>
                    <th>Основной родитель</th>
                    <th>Получен доступ</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {viewers
                    .filter(v =>
                      !search ||
                      (v.viewer_name||'').toLowerCase().includes(search.toLowerCase()) ||
                      (v.viewer_phone||'').includes(search) ||
                      (v.athlete_name||'').toLowerCase().includes(search.toLowerCase())
                    )
                    .map((v, i) => (
                      <tr key={`${v.viewer_id}-${v.athlete_id}-${i}`}>
                        <td className="td-name">{v.viewer_name}</td>
                        <td>{v.viewer_phone}</td>
                        <td style={{ color:'var(--gray)', fontSize:'0.85rem' }}>{v.viewer_email || '—'}</td>
                        <td className="td-name">{v.athlete_name}</td>
                        <td style={{ color:'var(--gray)' }}>{v.primary_parent_name}</td>
                        <td style={{ whiteSpace:'nowrap', color:'var(--gray)', fontSize:'0.85rem' }}>
                          {v.granted_at ? new Date(v.granted_at).toLocaleDateString('ru-RU', { day:'numeric', month:'short', year:'numeric' }) : '—'}
                        </td>
                        <td className="td-actions">
                          <button className="td-btn td-btn-edit" onClick={() => setResetUser({ user_id: v.viewer_id, parent_name: v.viewer_name, parent_phone: v.viewer_phone })}>Сбросить пароль</button>
                          <button className="td-btn td-btn-del" onClick={() => revokeViewerAccess(v.viewer_id, v.athlete_id, v.viewer_name, v.athlete_name)}>Отозвать</button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {viewers.length === 0 && !loading && <div className="cabinet-empty">Приглашённых пользователей пока нет.</div>}
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

            {/* ── Индивидуальные тренировки ── */}
            <div style={{ borderLeft:'3px solid var(--red)', paddingLeft:16, marginTop:36, marginBottom:12 }}>
              <p className="section-label" style={{ margin:0 }}>Заявки на индивидуальные тренировки</p>
            </div>
            {indivRequests.length === 0 && <div className="cabinet-empty">Заявок нет</div>}
            {indivRequests.length > 0 && (
              <div className="athletes-table-wrap">
                <table className="athletes-table">
                  <thead>
                    <tr>
                      <th>Дата</th><th>Родитель</th><th>Спортсмен</th><th>Формат</th>
                      <th>Пожелания</th><th>Комментарий</th><th>Статус</th><th>Действие</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indivRequests.map(r => (
                      <tr key={r.id}>
                        <td style={{ whiteSpace:'nowrap' }}>{r.created_at}</td>
                        <td>{r.user_name}</td>
                        <td>{r.athlete_name || '—'}</td>
                        <td>{r.format === 'individual' ? 'Индивидуальное' : 'Мини-группа'}</td>
                        <td style={{ fontSize:'13px', color:'var(--gray)' }}>{r.preferred_time || '—'}</td>
                        <td style={{ fontSize:'13px', color:'var(--gray)', maxWidth:160 }}>{r.comment || '—'}</td>
                        <td>
                          {r.status === 'new' && <span style={{ color:'#FFD700' }}>На рассмотрении</span>}
                          {r.status === 'confirmed' && <span style={{ color:'#6cba6c' }}>Подтверждена</span>}
                          {r.status === 'rejected' && <span style={{ color:'var(--red)' }}>Отклонена</span>}
                        </td>
                        <td>
                          {r.status === 'new' && (
                            <div style={{ display:'flex', gap:6 }}>
                              <button className="td-btn td-btn-edit" style={{ background:'rgba(42,122,42,0.15)', color:'#6cba6c', borderColor:'rgba(108,186,108,0.4)' }}
                                onClick={() => updateIndivStatus(r.id, 'confirmed')}>Подтвердить</button>
                              <button className="td-btn td-btn-del"
                                onClick={() => updateIndivStatus(r.id, 'rejected')}>Отклонить</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </main>
    </Suspense>
    </CabinetErrorBoundary>
  )
}
