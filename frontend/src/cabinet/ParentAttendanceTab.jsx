import { useState, useEffect } from 'react'
import { API, currentSeason, seasonRange, seasonLabel } from './constants'

export default function ParentAttendanceTab({ token, athletes }) {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(false)
  const [season, setSeason]   = useState(currentSeason)
  const [seasons, setSeasons] = useState([currentSeason])

  useEffect(() => {
    fetch(`${API}/attendance/seasons`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [currentSeason])
      .then(s => { const list = s.length ? s : [currentSeason]; setSeasons(list); if (list.includes(currentSeason)) setSeason(currentSeason); else setSeason(list[0]) })
      .catch(() => {})
  }, [])

  useEffect(() => { loadAll() }, [season])

  const loadAll = async () => {
    setLoading(true)
    const results = []
    const { start, end } = seasonRange(season)
    const months = season !== '' ? Math.ceil((new Date(end) - new Date(start)) / (30*24*60*60*1000)) : 24
    for (const a of athletes) {
      try {
        const r = await fetch(`${API}/attendance/athlete/${a.id}?months=${months}`, {
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
      <div style={{marginBottom:12}}>
        <select className="att-date-input" value={season} onChange={e => setSeason(e.target.value === '' ? '' : Number(e.target.value))} style={{width:'auto'}}>
          <option value="">Все сезоны</option>
          {seasons.map(y => <option key={y} value={y}>{seasonLabel(y)}</option>)}
        </select>
      </div>
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
                  {a.monthly.map((m, i) => {
                    const pct = m.total ? Math.round(m.present/m.total*100) : 0
                    return (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'4px 0', fontSize:'0.84rem' }}>
                      <span style={{ color:'var(--gray)', minWidth:60 }}>{m.month}</span>
                      <div style={{ flex:1, height:6, background:'var(--gray-dim)', borderRadius:3, overflow:'hidden' }}>
                        <div style={{ height:'100%', width: pct+'%', background:'var(--red)', borderRadius:3 }}/>
                      </div>
                      <span style={{ color:'var(--white)', minWidth:50, textAlign:'right' }}>{m.present}/{m.total}</span>
                    </div>
                    )
                  })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
