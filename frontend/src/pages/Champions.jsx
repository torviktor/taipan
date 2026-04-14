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

export default function Champions() {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/hall-of-fame`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { setItems(d); setLoading(false) })
      .catch(() => setLoading(false))
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
                const belt = item.dan
                  ? { bg: '#111', text: '#FFD700', label: `${item.dan} дан` }
                  : item.gup
                    ? { ...(BELT_COLORS[item.gup] || { bg:'var(--gray)', text:'#fff' }), label: `${item.gup} гып` }
                    : null

                return (
                  <div key={item.id} className={`champion-card champion-card--dynamic`} style={{
                    border: item.is_featured ? '2px solid #c8962a' : undefined,
                    boxShadow: item.is_featured ? '0 0 20px rgba(200,150,42,0.35)' : undefined,
                  }}>
                    <div className="champion-img-wrap">
                      {item.is_featured && (
                        <div style={{position:'absolute', top:10, left:10, zIndex:2, background:'#c8962a', borderRadius:'50%', width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', boxShadow:'0 2px 8px rgba(0,0,0,0.5)'}}>★</div>
                      )}
                      {item.photo_url ? (
                        <img src={item.photo_url} alt={item.full_name} className="champion-img"
                          style={(() => {
                            const parts = (item.photo_position || '50% 50% 1.00').split(' ')
                            const px   = parts[0] || '50%'
                            const py   = parts[1] || '50%'
                            const zoom = parseFloat(parts[2]) || 1.0
                            return {
                              objectPosition: `${px} ${py}`,
                              transform: `scale(${zoom})`,
                              transformOrigin: `${px} ${py}`,
                            }
                          })()}
                        />
                      ) : (
                        <div className="champion-img-placeholder">
                          <span>Фото</span>
                        </div>
                      )}
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
