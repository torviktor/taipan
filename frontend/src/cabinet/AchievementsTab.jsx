import { useState, useEffect } from 'react'
import { API, currentSeason, seasonRange, seasonLabel } from './constants'

// SVG иконки убраны — используем только эмблему клуба

const TIER_STYLES = {
  common:    { border: '#555555', bg: '#111111', glow: 'none',                          label: 'Обычная' },
  rare:      { border: '#CC0000', bg: '#180000', glow: '0 0 14px rgba(204,0,0,0.5)',    label: 'Редкая' },
  legendary: { border: '#c8962a', bg: '#1a1200', glow: '0 0 18px rgba(200,150,42,0.6)', label: 'Легендарная' },
}

const TIER_LABEL = { common: 'Обычная', rare: 'Редкая', legendary: 'Легендарная' }

const CATEGORY_LABEL = {
  attendance:   'Посещаемость',
  competition:  'Соревнования',
  certification:'Аттестация',
  camp:         'Сборы',
}

export function AchievementBadge({ ach, size = 'normal' }) {
  const style = TIER_STYLES[ach.tier] || TIER_STYLES.common
  const dim = size === 'small' ? 80 : 110
  const opacity = ach.granted ? 1 : 0.2

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, opacity, transition:'opacity 0.2s', width: dim + 20 }}>
      <div style={{
        width: dim, height: dim,
        border: `2px solid ${style.border}`,
        borderRadius: 8,
        background: style.bg,
        boxShadow: ach.granted ? style.glow : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Эмблема клуба — яркая, во всю площадь */}
        <img src="/logo.png" alt="" style={{
          width: '82%', height: '82%',
          objectFit: 'contain',
          opacity: ach.granted ? 0.9 : 0.15,
          filter: ach.granted
            ? (ach.tier === 'legendary'
                ? 'drop-shadow(0 0 8px rgba(200,150,42,0.8))'
                : ach.tier === 'rare'
                ? 'drop-shadow(0 0 6px rgba(204,0,0,0.8))'
                : 'none')
            : 'grayscale(1)',
          transition: 'all 0.2s',
          position: 'relative', zIndex: 1
        }}/>
        {/* Угловой индикатор редкости */}
        {ach.granted && (
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: 0, height: 0,
            borderStyle: 'solid',
            borderWidth: '0 22px 22px 0',
            borderColor: `transparent ${style.border} transparent transparent`,
          }}/>
        )}
      </div>
      <div style={{
        fontFamily: 'Bebas Neue, sans-serif',
        fontSize: size === 'small' ? '0.7rem' : '0.78rem',
        letterSpacing: '0.05em',
        color: ach.granted ? style.border : '#333',
        textAlign: 'center', lineHeight: 1.2,
        maxWidth: dim + 10
      }}>{ach.name}</div>
      {ach.granted && (
        <div style={{ fontSize: '0.65rem', color: 'var(--gray)', textAlign:'center' }}>
          {TIER_LABEL[ach.tier]}
        </div>
      )}
    </div>
  )
}

export function AchievementsLeaderboard({ token }) {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(false)
  const [season,  setSeason]  = useState(currentSeason)
  const [seasons, setSeasons] = useState([currentSeason])

  useEffect(() => {
    // Загружаем доступные сезоны из соревнований
    fetch(`${API}/competitions/seasons`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [currentSeason])
      .then(s => {
        const list = s.length ? s : [currentSeason]
        setSeasons(list)
        // Устанавливаем текущий сезон если есть, иначе первый
        if (list.includes(currentSeason)) setSeason(currentSeason)
        else setSeason(list[0])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const url = season !== ''
      ? (() => { const {start,end} = seasonRange(season); return `${API}/achievements/leaderboard?date_from=${start}&date_to=${end}` })()
      : `${API}/achievements/leaderboard`
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [season])

  if (loading) return <div className="cabinet-loading">Загрузка...</div>

  return (
    <div>
      <div style={{marginBottom:12}}>
        <select className="att-date-input" value={season} onChange={e => setSeason(e.target.value === '' ? '' : Number(e.target.value))} style={{width:'auto'}}>
          <option value="">Все сезоны</option>
          {seasons.map(y=>(
            <option key={y} value={y}>{seasonLabel(y)}</option>
          ))}
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
          {data.map((r, i) => (
            <tr key={r.athlete_id}>
              <td style={{textAlign:'center', fontFamily:'Bebas Neue', fontWeight:700, fontSize:'1.2rem'}}>{i+1}</td>
              <td className="td-name">{r.full_name}</td>
              <td>{r.group||'—'}</td>
              <td style={{textAlign:'center', fontWeight:700}}>{r.total}</td>
              <td style={{textAlign:'center', color:'#c8962a', fontWeight:700}}>{r.legendary||0}</td>
            </tr>
          ))}
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
    fetch(`${API}/competitions/seasons`, { headers: { Authorization: `Bearer ${token}` } })
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
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
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
