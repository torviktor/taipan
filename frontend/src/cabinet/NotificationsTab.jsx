import { useState, useEffect } from 'react'
import { API } from './constants'

export default function NotificationsTab({ token }) {
  const [notifs,   setNotifs]   = useState([])
  const [loading,  setLoading]  = useState(false)
  const [showAll,  setShowAll]  = useState(false)
  const LIMIT = 10

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
    if (t === 'fee')           return { text: 'ВЗНОС',   color: '#4caf50', bg: '#1a2e1a' }
    return                            { text: 'INFO',    color: 'var(--gray)', bg: 'var(--dark)' }
  }
  const unreadCount = notifs.filter(n => !n.is_read).length
  const visibleNotifs = showAll ? notifs : notifs.slice(0, LIMIT)
  const hiddenCount = notifs.length - LIMIT

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <span style={{ color:'var(--gray)', fontSize:'0.9rem' }}>
          {unreadCount > 0 ? `Непрочитанных: ${unreadCount}` : 'Все уведомления прочитаны'}
          {notifs.length > 0 && <span style={{marginLeft:8, opacity:0.5}}>· Всего: {notifs.length}</span>}
        </span>
        {unreadCount > 0 && <button className="att-all-btn" onClick={markAllRead}>Прочитать все</button>}
      </div>

      {loading && <div className="cabinet-loading">Загрузка...</div>}
      {!loading && notifs.length === 0 && <div className="cabinet-empty">Уведомлений пока нет.</div>}

      {visibleNotifs.map(n => (
        <div key={n.id}
          style={{
            background: n.is_read ? 'var(--dark2)' : '#1a1500',
            border: `1px solid ${n.is_read ? 'var(--gray-dim)' : '#c8962a'}`,
            borderRadius: 8, padding: '14px 16px', marginBottom: 10,
            transition: 'background 0.15s'
          }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, cursor: !n.is_read && !n.link_type ? 'pointer' : 'default' }}
            onClick={() => !n.is_read && !n.link_type && markRead(n.id)}>
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

      {hiddenCount > 0 && !showAll && (
        <button className="att-all-btn" style={{width:'100%', marginTop:8, textAlign:'center'}}
          onClick={() => setShowAll(true)}>
          Показать ещё {hiddenCount} уведомлений
        </button>
      )}
      {showAll && notifs.length > LIMIT && (
        <button className="att-all-btn" style={{width:'100%', marginTop:8, textAlign:'center'}}
          onClick={() => setShowAll(false)}>
          Свернуть
        </button>
      )}
    </div>
  )
}
