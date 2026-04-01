import { useState, useEffect } from 'react'
import { API } from './constants'

export default function InsuranceAdminTab({ token, athletes }) {
  const [data, setData]     = useState([])
  const [loading, setLoad]  = useState(false)
  const [saving, setSaving] = useState(null)
  const [msg, setMsg]       = useState('')
  const [search, setSearch] = useState('')
  const h  = { Authorization: `Bearer ${token}` }
  const hj = { ...h, 'Content-Type': 'application/json' }
  const today = new Date().toISOString().slice(0,10)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoad(true)
    try {
      const r = await fetch(`${API}/insurance-strategy/insurance`, { headers: h })
      if (r.ok) setData(await r.json())
      else {
        // Если эндпоинт ещё не готов — используем список спортсменов
        setData(athletes.map(a => ({ athlete_id: a.id, full_name: a.full_name, insurance_expiry: null })))
      }
    } catch {
      setData(athletes.map(a => ({ athlete_id: a.id, full_name: a.full_name, insurance_expiry: null })))
    }
    setLoad(false)
  }

  const save = async (athleteId, expiry) => {
    setSaving(athleteId)
    try {
      const r = await fetch(`${API}/insurance-strategy/insurance`, {
        method: 'PATCH', headers: hj,
        body: JSON.stringify({ athlete_id: athleteId, insurance_expiry: expiry || null })
      })
      if (r.ok) {
        setData(prev => prev.map(x => x.athlete_id === athleteId ? { ...x, insurance_expiry: expiry || null } : x))
        setMsg('Сохранено'); setTimeout(() => setMsg(''), 2000)
      }
    } catch {}
    setSaving(null)
  }

  const getStatus = (expiry) => {
    if (!expiry) return { label: 'Не указана', color: 'var(--gray)' }
    if (expiry < today) return { label: 'Истекла', color: 'var(--red)' }
    const diff = Math.floor((new Date(expiry) - new Date(today)) / 86400000)
    if (diff <= 30) return { label: `Истекает через ${diff} дн.`, color: '#c8962a' }
    return { label: 'Действует', color: '#6cba6c' }
  }

  const filtered = data.filter(a => a.full_name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ padding:'0 0 40px' }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:'Bebas Neue', fontSize:'1.8rem', letterSpacing:'0.06em', color:'var(--white)', marginBottom:4 }}>Сроки страховок</div>
        <div style={{ color:'var(--gray)', fontSize:'0.88rem' }}>Отслеживание дат окончания страховых полисов спортсменов.</div>
      </div>
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        <input type="text" placeholder="Поиск по имени..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ background:'var(--dark)', border:'1px solid var(--gray-dim)', color:'var(--white)', padding:'7px 14px', fontSize:'0.88rem', fontFamily:'Barlow', outline:'none', minWidth:220 }} />
        {msg && <span style={{ color:'#6cba6c', fontSize:'0.85rem', fontFamily:'Barlow Condensed', fontWeight:700 }}>{msg}</span>}
      </div>
      {loading ? <div style={{ color:'var(--gray)' }}>Загрузка...</div> : (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.9rem' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--gray-dim)' }}>
                {['Спортсмен','Дата окончания полиса','Статус',''].map(h => (
                  <th key={h} style={{ fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.72rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--gray)', padding:'8px 12px', textAlign:'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const status = getStatus(a.insurance_expiry)
                return (
                  <tr key={a.athlete_id} style={{ borderBottom:'1px solid var(--gray-dim)' }}>
                    <td style={{ padding:'10px 12px', color:'var(--white)', fontWeight:600 }}>{a.full_name}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{ color: a.insurance_expiry ? 'var(--white)' : 'var(--gray)', fontSize:'0.9rem' }}>{a.insurance_expiry || '—'}</span>
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      {a.insurance_expiry && <span style={{ fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.85rem', color:status.color }}>{status.label}</span>}
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      {saving === a.athlete_id && <span style={{ color:'var(--gray)', fontSize:'0.8rem' }}>Сохранение...</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ display:'flex', gap:20, marginTop:16, flexWrap:'wrap' }}>
        {[['#6cba6c','Действует'],['#c8962a','Истекает в течение 30 дней'],['var(--red)','Истекла'],['var(--gray)','Не указана']].map(([color, label]) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:8, fontSize:'0.82rem' }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:color, flexShrink:0 }} />
            <span style={{ color:'var(--gray)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
