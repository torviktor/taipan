import React, { useState, useEffect } from 'react'
import { API, currentSeason, seasonRange, seasonLabel } from './constants'
import { apiFetch } from '../utils/apiFetch'
import AchievementBadge from '../components/AchievementBadge'
import { CATEGORY_LABEL } from '../components/AchievementBadge'

export { AchievementBadge }

export function AchievementsLeaderboard({ token }) {
  const [data,     setData]     = useState([])
  const [loading,  setLoading]  = useState(false)
  const [season,   setSeason]   = useState(currentSeason)
  const [seasons,  setSeasons]  = useState([currentSeason])
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    apiFetch(`${API}/competitions/seasons`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [currentSeason])
      .then(s => {
        const list = s.length ? s : [currentSeason]
        setSeasons(list)
        setSeason(list.includes(currentSeason) ? currentSeason : list[0])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setExpanded(null)
    const url = season !== ''
      ? `${API}/achievements/leaderboard?season=${season}`
      : `${API}/achievements/leaderboard`
    apiFetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [season])

  if (loading) return <div className="cabinet-loading">Загрузка...</div>

  return (
    <div>
      <div style={{marginBottom:12}}>
        <select className="att-date-input" value={season}
                onChange={e => setSeason(e.target.value === '' ? '' : Number(e.target.value))}
                style={{width:'auto'}}>
          <option value="">Все сезоны</option>
          {seasons.map(y => <option key={y} value={y}>{seasonLabel(y)}</option>)}
        </select>
      </div>

      {data.length === 0 && <div className="cabinet-empty">Ачивок за этот сезон пока нет.</div>}

      {data.length > 0 && <div className="athletes-table-wrap">
      <table className="athletes-table">
        <thead><tr>
          <th style={{width:50}}>Место</th>
          <th style={{textAlign:'left'}}>Спортсмен</th>
          <th>Группа</th>
          <th>Ачивок</th>
          <th>Легендарных</th>
        </tr></thead>
        <tbody>
          {data.map(r => {
            const open = expanded === r.athlete_id
            const legend = r.items.filter(x => x.tier === 'legendary')
            return (
              <React.Fragment key={r.athlete_id}>
                <tr onClick={() => setExpanded(open ? null : r.athlete_id)}
                    style={{cursor:'pointer', background: open ? 'rgba(255,255,255,0.04)' : undefined}}>
                  <td style={{textAlign:'center', fontFamily:'Bebas Neue', fontWeight:700, fontSize:'1.2rem'}}>{r.place}</td>
                  <td className="td-name">
                    <span style={{color:'var(--gray)', marginRight:8, fontSize:'0.8rem'}}>{open ? '▾' : '▸'}</span>
                    {r.full_name}
                    {legend.map(x => (
                      <span key={x.code} style={{
                        marginLeft:6, padding:'2px 8px', borderRadius:10, fontSize:'0.7rem',
                        border:'1px solid #c8962a', color:'#c8962a', whiteSpace:'nowrap'
                      }}>{x.name}</span>
                    ))}
                  </td>
                  <td>{r.group || '—'}</td>
                  <td style={{textAlign:'center', fontWeight:700}}>{r.total}</td>
                  <td style={{textAlign:'center', color:'#c8962a', fontWeight:700}}>{r.legendary || 0}</td>
                </tr>
                {open && (
                  <tr>
                    <td colSpan={5} style={{padding:'4px 16px 16px', background:'rgba(255,255,255,0.02)'}}>
                      {r.items.map((x, j) => (
                        <div key={x.code + j} style={{
                          display:'flex', alignItems:'baseline', gap:10,
                          padding:'6px 0', borderBottom:'1px solid var(--gray-dim)'
                        }}>
                          <span style={{
                            width:8, height:8, borderRadius:'50%', flexShrink:0,
                            background:x.tier_color, display:'inline-block'
                          }}/>
                          <span style={{color:'var(--white)', fontWeight:600, minWidth:170}}>{x.name}</span>
                          <span style={{color:'var(--gray)', fontSize:'0.85rem', flex:1}}>{x.description}</span>
                          <span style={{color:'var(--gray)', fontSize:'0.78rem', whiteSpace:'nowrap'}}>
                            {new Date(x.granted_at).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                      ))}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
      </div>}
    </div>
  )
}

export default function AchievementsTab({ token, athletes }) {
  const [data,    setData]    = useState({})
  const [loading, setLoading] = useState(false)
  const [season,  setSeason]  = useState(currentSeason)
  const [seasons, setSeasons] = useState([currentSeason])

  useEffect(() => {
    apiFetch(`${API}/competitions/seasons`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [currentSeason])
      .then(s => { const list = s.length ? s : [currentSeason]; setSeasons(list); if (list.includes(currentSeason)) setSeason(currentSeason); else setSeason(list[0]) })
      .catch(() => {})
  }, [])

  useEffect(() => { loadAll() }, [season])

  const loadAll = async () => {
    setLoading(true)
    const result = {}
    for (const a of athletes) {
      try {
        const url = season !== '' ? (() => { const {start,end} = seasonRange(season); return `${API}/achievements/athlete/${a.id}?date_from=${start}&date_to=${end}` })() : `${API}/achievements/athlete/${a.id}`
        const r = await apiFetch(url, { headers: { Authorization: `Bearer ${token}` } })
        if (r.ok) result[a.id] = await r.json()
      } catch {}
    }
    setData(result)
    setLoading(false)
  }

  if (loading) return <div className="cabinet-loading">Загрузка...</div>
  if (athletes.length === 0) return <div className="cabinet-empty">Нет спортсменов.</div>

  const categories = ['attendance', 'competition', 'certification', 'camp', 'combo', 'meta']
  return (
    <div>
      <div style={{marginBottom:12}}>
        <select className="att-date-input" value={season} onChange={e => setSeason(e.target.value === '' ? '' : Number(e.target.value))} style={{width:'auto'}}>
          <option value="">Все сезоны</option>
          {seasons.map(y => <option key={y} value={y}>{seasonLabel(y)}</option>)}
        </select>
      </div>
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
