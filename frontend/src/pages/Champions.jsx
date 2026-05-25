import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './Champions.css'

const API = '/api'

const BELT_COLORS = {
  11: { bg: '#FF8C00', text: '#fff' },
  10: { bg: '#f0f0f0', text: '#111' },
  9:  { bg: '#f0f0f0', text: '#111' },
  8:  { bg: '#FFD700', text: '#111' },
  7:  { bg: '#FFD700', text: '#111' },
  6:  { bg: '#3a9a3a', text: '#fff' },
  5:  { bg: '#3a9a3a', text: '#fff' },
  4:  { bg: '#1a6ab5', text: '#fff' },
  3:  { bg: '#1a6ab5', text: '#fff' },
  2:  { bg: '#CC0000', text: '#fff' },
  1:  { bg: '#CC0000', text: '#fff' },
}

const SLOT_LABEL = {
  junior_boy:  'Лучший юный спортсмен сезона',
  junior_girl: 'Лучшая юная спортсменка сезона',
  senior_boy:  'Лучший спортсмен сезона',
  senior_girl: 'Лучшая спортсменка сезона',
}

const SLOT_ORDER = ['junior_boy', 'junior_girl', 'senior_boy', 'senior_girl']

function getBelt(item) {
  if (item.dan)  return { bg: '#111', text: '#FFD700', label: `${item.dan} дан` }
  if (item.gup)  return { ...(BELT_COLORS[item.gup] || { bg:'var(--gray)', text:'#fff' }), label: `${item.gup} гып` }
  return null
}

function getInitials(fullName) {
  if (!fullName) return '—'
  const parts = fullName.trim().split(/\s+/)
  const first = parts[0]?.[0] || ''
  const second = parts[1]?.[0] || ''
  return (first + second).toUpperCase() || '—'
}

function ChampionImg({ item }) {
  if (!item.photo_url) {
    return (
      <div className="champion-img-placeholder">
        <span>Фото</span>
      </div>
    )
  }
  const ps = item.photo_position || '0px 0px / 100%'
  const [posStr, zoomStr] = ps.split('/')
  const parts = posStr.trim().split(' ')
  const ptx   = parseFloat(parts[0]) || 0
  const pty   = parseFloat(parts[1]) || 0
  const pzoom = parseFloat(zoomStr) || 100
  return (
    <img src={item.photo_url} alt={item.full_name} className="champion-img"
      style={{
        width:'auto', height:`${pzoom}%`,
        position:'absolute', top:'50%', left:'50%', maxWidth:'none',
        transform:`translate(calc(-50% + ${ptx}px), calc(-50% + ${pty}px))`,
      }}
    />
  )
}

function buildSlotMap(slots) {
  const map = {}
  for (const s of slots || []) map[s.slot] = s
  return map
}

function SeasonBestCard({ slot, entry, compact = false }) {
  const cls = compact ? 'champion-card champion-card--dynamic champion-card--compact'
                      : 'champion-card champion-card--dynamic'
  return (
    <div className={cls} style={{ border: '2px solid var(--red)' }}>
      <div className="champion-img-wrap">
        <div className="season-best-label">{SLOT_LABEL[slot]}</div>
        {/* TODO: после реализации Athlete.photo_url — заменить инициалы на <img src={entry.photo_url}> */}
        <div className="season-best-initials">
          {entry ? getInitials(entry.athlete_name) : '—'}
        </div>
        {entry && getBelt(entry) && (
          <div className="champion-belt-badge"
            style={{ background: getBelt(entry).bg, color: getBelt(entry).text }}>
            {getBelt(entry).label}
          </div>
        )}
      </div>
      <div className="champion-info">
        <div className="champion-name">
          {entry ? entry.athlete_name : 'Не назначен'}
        </div>
        {entry?.group && (
          <ul className="champion-achievements">
            <li>{entry.group}</li>
          </ul>
        )}
      </div>
    </div>
  )
}

function SeasonBlock({ seasonLabel, slots, compact = false, title }) {
  const slotMap = buildSlotMap(slots)
  return (
    <div className={compact ? 'season-best-archive-block' : 'season-best-current-block'}>
      {title && (
        <h2 className={compact ? 'season-best-archive-title' : 'season-best-current-title'}>
          {title}
        </h2>
      )}
      <div className={compact ? 'season-best-history-grid' : 'champions-grid champions-grid--season-best'}>
        {SLOT_ORDER.map(slot => (
          <SeasonBestCard key={slot} slot={slot} entry={slotMap[slot]} compact={compact}/>
        ))}
      </div>
    </div>
  )
}

export default function Champions() {
  const [items,     setItems]     = useState([])
  const [loading,   setLoading]   = useState(true)

  const [currentSB, setCurrentSB] = useState(null)
  const [seasons,   setSeasons]   = useState([])
  const [historyOpen,  setHistoryOpen]  = useState(false)
  const [seasonData,   setSeasonData]   = useState({})  // { 2024: {season, season_label, slots} }
  const [seasonLoad,   setSeasonLoad]   = useState({})  // { 2024: true } пока грузится

  useEffect(() => {
    Promise.all([
      fetch(`${API}/hall-of-fame`).then(r => r.ok ? r.json() : []),
      fetch(`${API}/season-best`).then(r => r.ok ? r.json() : null),
      fetch(`${API}/season-best/seasons`).then(r => r.ok ? r.json() : []),
    ])
    .then(([hof, sb, seas]) => {
      setItems(hof)
      setCurrentSB(sb)
      // Из истории исключаем текущий сезон — он показан отдельно сверху.
      const currentSeason = sb?.season
      setSeasons((seas || []).filter(s => s.season !== currentSeason))
      setLoading(false)
    })
    .catch(() => setLoading(false))
  }, [])

  const loadSeason = (year) => {
    if (seasonData[year] || seasonLoad[year]) return
    setSeasonLoad(prev => ({ ...prev, [year]: true }))
    fetch(`${API}/season-best?season=${year}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setSeasonData(prev => ({ ...prev, [year]: data }))
      })
      .finally(() => setSeasonLoad(prev => ({ ...prev, [year]: false })))
  }

  const [openSeasons, setOpenSeasons] = useState({})
  const toggleSeason = (year) => {
    setOpenSeasons(prev => {
      const next = !prev[year]
      if (next) loadSeason(year)
      return { ...prev, [year]: next }
    })
  }

  const renderHofCard = (item) => {
    const belt = getBelt(item)
    return (
      <div key={item.id} className="champion-card champion-card--dynamic" style={{
        border: item.is_featured ? '2px solid #c8962a' : undefined,
        boxShadow: item.is_featured ? '0 0 20px rgba(200,150,42,0.35)' : undefined,
      }}>
        <div className="champion-img-wrap">
          {item.is_featured && (
            <div style={{ position:'absolute', top:10, left:10, zIndex:2, background:'#c8962a',
              borderRadius:'50%', width:28, height:28, display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:'14px', boxShadow:'0 2px 8px rgba(0,0,0,0.5)' }}>★</div>
          )}
          <ChampionImg item={item} />
          {belt && (
            <div className="champion-belt-badge" style={{ background: belt.bg, color: belt.text }}>
              {belt.label}
            </div>
          )}
        </div>
        <div className="champion-info">
          <div className="champion-name">{item.full_name}</div>
          {item.achievements && (
            <ul className="champion-achievements">
              {item.achievements.split('\n').filter(Boolean).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  return (
    <main className="champions-page">
      <section className="champions-hero">
        <div className="container">
          <p className="section-label">Клуб тхэквондо «Тайпан»</p>
          <h1 className="champions-title">ЗАЛ СЛАВЫ</h1>
          <p className="champions-subtitle">
            Спортсмены г. Павловский Посад, завоевавшие награды<br/>
            на соревнованиях всероссийского и международного уровня<br/>
            в виде спорта тхэквондо
          </p>
        </div>
      </section>

      <section className="champions-grid-section">
        <div className="container">

          {loading && (
            <div style={{ textAlign:'center', color:'var(--gray)', padding:'60px 0' }}>
              Загрузка...
            </div>
          )}

          {!loading && currentSB && (
            <SeasonBlock
              seasonLabel={currentSB.season_label}
              slots={currentSB.slots}
              title={`Лучшие сезона ${currentSB.season_label}`}
            />
          )}

          {!loading && items.length === 0 && !currentSB && (
            <div style={{ textAlign:'center', color:'var(--gray)', padding:'60px 0' }}>
              <p style={{ fontSize:'1.1rem' }}>Зал Славы пока пополняется.</p>
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="champions-grid">
              {items.map(renderHofCard)}
            </div>
          )}

          {!loading && (
            <div className="season-best-history">
              <button className="season-best-history-toggle"
                onClick={() => setHistoryOpen(v => !v)}>
                {historyOpen ? '▾' : '▸'}  История лучших по сезонам
              </button>
              {historyOpen && seasons.length === 0 && (
                <div className="season-best-history-empty">
                  История пока пуста. Появится после завершения текущего сезона.
                </div>
              )}
              {historyOpen && seasons.length > 0 && (
                <div className="season-best-history-list">
                  {seasons.map(s => {
                    const isOpen = !!openSeasons[s.season]
                    const data = seasonData[s.season]
                    const loadingS = !!seasonLoad[s.season]
                    return (
                      <div key={s.season} className="season-best-history-season">
                        <button className="season-best-history-season-head"
                          onClick={() => toggleSeason(s.season)}>
                          {isOpen ? '▾' : '▸'}  Сезон {s.season_label}
                        </button>
                        {isOpen && loadingS && (
                          <div className="season-best-history-loading">Загрузка...</div>
                        )}
                        {isOpen && data && (
                          <SeasonBlock
                            seasonLabel={data.season_label}
                            slots={data.slots}
                            compact
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="champions-back">
            <Link to="/" className="btn-outline">← На главную</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
