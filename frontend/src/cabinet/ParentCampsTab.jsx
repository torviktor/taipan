import { useState, useEffect } from 'react'
import { API, seasonRange } from './constants'

export default function ParentCampsTab({ token, athletes }) {
  const [camps,   setCamps]   = useState([])
  const [loading, setLoading] = useState(false)
  const [msg,     setMsg]     = useState('')

  const h  = { Authorization: `Bearer ${token}` }
  const hj = { ...h, 'Content-Type': 'application/json' }

  useEffect(() => { loadCamps() }, [season])

  const loadCamps = async () => {
    setLoading(true)
    try {
      const url = season !== '' ? (() => { const {start,end} = seasonRange(season); return `${API}/camps?date_from=${start}&date_to=${end}` })() : `${API}/camps`
      const r = await fetch(url, { headers: h })
      if (r.ok) setCamps(await r.json())
    } catch {}
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
