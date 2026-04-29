import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import './Preparation.css'

/**
 * Один компонент на все 5 методичек.
 * URL: /preparation/method/:slug
 * slug ∈ ['beginner', '7-5', '4-3', '2-1', 'itf']
 */

const VALID_SLUGS = ['beginner', '7-5', '4-3', '2-1', 'itf']

const SLUG_TITLES = {
  'beginner': 'Методичка для начинающих (10–8 гып)',
  '7-5':      'Методичка 7–5 гып',
  '4-3':      'Методичка 4–3 гып',
  '2-1':      'Методичка 2–1 гып',
  'itf':      'Большое пособие ИТФ',
}

export default function Methodichka() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!VALID_SLUGS.includes(slug)) {
      navigate('/preparation', { replace: true })
      return
    }
    const token = localStorage.getItem('token')
    fetch(`/api/preparation/method/${slug}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (r.status === 401 || r.status === 403) {
          navigate('/login', { replace: true })
          return null
        }
        if (!r.ok) throw new Error('Не удалось загрузить методичку')
        return r.json()
      })
      .then(d => { if (d) setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug, navigate])

  return (
    <div className="prep-page">
      <div className="container">
        <Link to="/preparation" className="prep-back-link">← К разделу</Link>
        <h1 className="prep-title">{SLUG_TITLES[slug] || 'Методичка'}</h1>

        {loading && <p className="prep-lead">Загрузка...</p>}
        {error   && <p className="prep-lead prep-error">{error}</p>}

        {!loading && !error && data && (
          <>
            {data.status === 'draft' || !data.content ? (
              <div className="prep-stub">
                <h2 className="prep-stub-title">Контент в разработке</h2>
                <p className="prep-stub-text">
                  Методичка готовится — текст будет опубликован в ближайшее время.
                </p>
                <Link to="/preparation" className="btn-outline">Вернуться к разделу</Link>
              </div>
            ) : (
              <div className="prep-content">
                {/* Здесь на этапе 4 будет рендер реального контента */}
                <p>{data.content}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
