import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './News.css'

const API = '/api'

function formatDate(str) {
  if (!str) return ''
  return new Date(str).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function excerpt(text, len = 180) {
  if (!text) return ''
  const plain = text.replace(/•/g, '').replace(/\n+/g, ' ').trim()
  return plain.length > len ? plain.slice(0, len) + '…' : plain
}

function NewsBody({ body }) {
  return (
    <div className="news-body">
      {body.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} className="news-body-spacer" />
        if (line.startsWith('•')) return (
          <div key={i} className="news-body-bullet">
            <span className="news-bullet-dot">—</span>
            <span>{line.replace(/^•\s*/, '')}</span>
          </div>
        )
        return <p key={i}>{line}</p>
      })}
    </div>
  )
}

export default function NewsPage() {
  const [items,   setItems]   = useState([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [openId,  setOpenId]  = useState(null)
  const [offset,  setOffset]  = useState(0)
  const LIMIT = 10

  useEffect(() => { load(0) }, [])

  const load = async (off) => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/news?limit=${LIMIT}&offset=${off}`)
      if (r.ok) {
        const d = await r.json()
        setItems(off === 0 ? d.items : prev => [...prev, ...d.items])
        setTotal(d.total)
        setOffset(off + LIMIT)
      }
    } catch {}
    setLoading(false)
  }

  const toggle = (id) => setOpenId(prev => prev === id ? null : id)

  return (
    <main className="news-page">
      <section className="news-hero">
        <div className="container">
          <p className="section-label">Клуб тхэквондо Тайпан</p>
          <h1 className="news-title">НОВОСТИ</h1>
          <div className="divider" />
        </div>
      </section>

      <section className="news-body-section">
        <div className="container news-container">
          {loading && items.length === 0 && (
            <div className="news-loading">Загрузка...</div>
          )}

          {!loading && items.length === 0 && (
            <div className="news-empty">Новостей пока нет</div>
          )}

          <div className="news-list">
            {items.map(n => {
              const isOpen = openId === n.id
              return (
                <article key={n.id} className={`news-card ${isOpen ? 'news-card--open' : ''}`}>
                  {n.photo_url && (
                    <div className="news-card-photo" onClick={() => toggle(n.id)}>
                      <img src={n.photo_url} alt={n.title} />
                    </div>
                  )}
                  <div className="news-card-body">
                    <div className="news-card-meta">
                      <span className="news-card-date">{formatDate(n.published_at)}</span>
                      {n.author && <span className="news-card-author">{n.author}</span>}
                    </div>
                    <h2 className="news-card-title" onClick={() => toggle(n.id)}>
                      {n.title}
                    </h2>
                    {!isOpen && (
                      <p className="news-card-excerpt">{excerpt(n.body)}</p>
                    )}
                    {isOpen && <NewsBody body={n.body} />}
                    <button className="news-card-toggle" onClick={() => toggle(n.id)}>
                      {isOpen ? 'Свернуть ↑' : 'Читать полностью →'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>

          {items.length < total && (
            <div className="news-more">
              <button className="btn-outline" onClick={() => load(offset)} disabled={loading}>
                {loading ? 'Загрузка...' : 'Показать ещё'}
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
