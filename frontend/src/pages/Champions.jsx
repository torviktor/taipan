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

function getBelt(item) {
  if (item.dan)  return { bg: '#111', text: '#FFD700', label: `${item.dan} дан` }
  if (item.gup)  return { ...(BELT_COLORS[item.gup] || { bg:'var(--gray)', text:'#fff' }), label: `${item.gup} гып` }
  return null
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

function SeasonBestCard({ item }) {
  const belt = item ? getBelt(item) : null

  return (
    <div className="champion-card champion-card--dynamic" style={{ border: '2px solid var(--red)' }}>
      <div className="champion-img-wrap">
        {item ? (
          <>
            {item.is_featured && (
              <div style={{position:'absolute', top:10, left:10, zIndex:2, background:'#c8962a', borderRadius:'50%', width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', boxShadow:'0 2px 8px rgba(0,0,0,0.5)'}}>★</div>
            )}
            <ChampionImg item={item} />
          </>
        ) : (
          <div className="champion-img-placeholder">
            <span>БУДЕТ ОБЪЯВЛЕН</span>
          </div>
        )}
        {belt && (
          <div className="champion-belt-badge" style={{ background: belt.bg, color: belt.text }}>
            {belt.label}
          </div>
        )}
      </div>
      <div className="champion-info">
        {item ? (
          <>
            <div className="champion-name">{item.full_name}</div>
            {item.achievements && (
              <ul className="champion-achievements">
                {item.achievements.split('\n').filter(Boolean).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div style={{ color:'var(--gray)', fontStyle:'italic', fontSize:'0.9rem' }}>
            Лучший спортсмен будет объявлен по итогам сезона
          </div>
        )}
      </div>
    </div>
  )
}

export default function Champions() {
  const [items,      setItems]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [seasonBest, setSeasonBest] = useState({ senior: null, junior: null })

  useEffect(() => {
    fetch(`${API}/hall-of-fame`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { setItems(d); setLoading(false) })
      .catch(() => setLoading(false))

    fetch(`${API}/hall-of-fame/season-best`)
      .then(r => r.ok ? r.json() : { senior: null, junior: null })
      .then(d => setSeasonBest(d))
      .catch(() => {})
  }, [])

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

          {/* ── Лучшие сезона ── */}
          <h2 className="season-best-title">Лучшие сезона</h2>
          <div className="season-best-row">
            <div className="season-best-item">
              <SeasonBestCard item={seasonBest.senior} />
              <div className="season-best-caption">Лучший спортсмен сезона — Старшая группа</div>
            </div>
            <div className="season-best-item">
              <SeasonBestCard item={seasonBest.junior} />
              <div className="season-best-caption">Лучший спортсмен сезона — Младшая группа</div>
            </div>
          </div>

          {loading && (
            <div style={{ textAlign:'center', color:'var(--gray)', padding:'60px 0' }}>
              Загрузка...
            </div>
          )}

          {!loading && items.length === 0 && (
            <div style={{ textAlign:'center', color:'var(--gray)', padding:'60px 0' }}>
              <p style={{ fontSize:'1.1rem' }}>Зал Славы пока пополняется.</p>
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="champions-grid">
              {items.map(item => {
                const belt = getBelt(item)

                return (
                  <div key={item.id} className={`champion-card champion-card--dynamic`} style={{
                    border: item.is_featured ? '2px solid #c8962a' : undefined,
                    boxShadow: item.is_featured ? '0 0 20px rgba(200,150,42,0.35)' : undefined,
                  }}>
                    <div className="champion-img-wrap">
                      {item.is_featured && (
                        <div style={{position:'absolute', top:10, left:10, zIndex:2, background:'#c8962a', borderRadius:'50%', width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', boxShadow:'0 2px 8px rgba(0,0,0,0.5)'}}>★</div>
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
              })}
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
