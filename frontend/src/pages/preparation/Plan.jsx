import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import './Preparation.css'

/**
 * Один компонент на все 5 программ 30 дней.
 * URL: /preparation/plan/:gup
 * gup ∈ [6, 7, 8, 9, 10]
 */

const VALID_GUPS = ['6', '7', '8', '9', '10']

const GUP_TITLES = {
  '10': 'Программа 30 дней — 10 гып (белый пояс)',
  '9':  'Программа 30 дней — 9 гып (белый с жёлтой полосой)',
  '8':  'Программа 30 дней — 8 гып (жёлтый)',
  '7':  'Программа 30 дней — 7 гып (жёлтый с зелёной полосой)',
  '6':  'Программа 30 дней — 6 гып (зелёный)',
}

export default function Plan() {
  const { gup } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!VALID_GUPS.includes(gup)) {
      navigate('/preparation', { replace: true })
      return
    }
    const token = localStorage.getItem('token')
    fetch(`/api/preparation/plan/${gup}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (r.status === 401 || r.status === 403) {
          navigate('/login', { replace: true })
          return null
        }
        if (!r.ok) throw new Error('Не удалось загрузить программу')
        return r.json()
      })
      .then(d => { if (d) setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [gup, navigate])

  return (
    <div className="prep-page">
      <div className="container">
        <Link to="/preparation" className="prep-back-link">← К разделу</Link>
        <h1 className="prep-title">{GUP_TITLES[gup] || 'Программа'}</h1>

        {loading && <p className="prep-lead">Загрузка...</p>}
        {error   && <p className="prep-lead prep-error">{error}</p>}

        {!loading && !error && data && (
          <>
            {data.status === 'draft' || !data.content ? (
              <div className="prep-stub">
                <h2 className="prep-stub-title">Контент в разработке</h2>
                <p className="prep-stub-text">
                  Программа готовится — план тренировок будет опубликован в ближайшее время.
                </p>
                <Link to="/preparation" className="btn-outline">Вернуться к разделу</Link>
              </div>
            ) : (
              <div className="prep-content">
                {/* Здесь на этапе 5 будет рендер реального контента */}
                <p>{data.content}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
