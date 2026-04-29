import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './Preparation.css'

/**
 * Главная раздела «Подготовка к аттестации».
 * 3 блока: Галерея, Методички, Программа на 30 дней.
 * Подсветка по гыпу: если у юзера есть гып и для него есть методичка/программа —
 * соответствующая карточка визуально выделяется и поднимается наверх.
 */

const METHODS = [
  { slug: 'beginner', title: 'Для начинающих', subtitle: '10–8 гып',          gups: [10, 9, 8] },
  { slug: '7-5',      title: '7–5 гып',         subtitle: 'жёлтый — синий',     gups: [7, 6, 5] },
  { slug: '4-3',      title: '4–3 гып',         subtitle: 'синий — красный',    gups: [4, 3] },
  { slug: '2-1',      title: '2–1 гып',         subtitle: 'красный — чёрный',   gups: [2, 1] },
  { slug: 'itf',      title: 'Большое пособие ИТФ', subtitle: 'все гыпы',      gups: [] },
]

const PLANS = [
  { gup: 10, title: '10 гып', subtitle: 'белый пояс' },
  { gup: 9,  title: '9 гып',  subtitle: 'белый с жёлтой полосой' },
  { gup: 8,  title: '8 гып',  subtitle: 'жёлтый' },
  { gup: 7,  title: '7 гып',  subtitle: 'жёлтый с зелёной полосой' },
  { gup: 6,  title: '6 гып',  subtitle: 'зелёный' },
]

export default function Preparation() {
  const [userGup, setUserGup] = useState(null)

  useEffect(() => {
    // Берём гып текущего юзера из его профиля.
    // Если юзер — родитель с несколькими детьми, берём первого неархивного.
    const token = localStorage.getItem('token')
    if (!token) return
    fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        // Если у самого юзера есть гып — используем его (athlete-роль)
        if (data.gup != null) {
          setUserGup(data.gup)
          return
        }
        // Иначе ищем в детях
        const athletes = data.athletes || []
        const active = athletes.find(a => !a.is_archived && a.gup != null)
        if (active) setUserGup(active.gup)
      })
      .catch(() => {})
  }, [])

  // Метод подходит юзеру если его гып попадает в диапазон
  const methodFitsUser = (m) => userGup != null && m.gups.includes(userGup)
  const planFitsUser   = (p) => userGup != null && p.gup === userGup

  // Сортировка: подходящий — наверх
  const sortedMethods = [...METHODS].sort((a, b) =>
    Number(methodFitsUser(b)) - Number(methodFitsUser(a))
  )
  const sortedPlans = [...PLANS].sort((a, b) =>
    Number(planFitsUser(b)) - Number(planFitsUser(a))
  )

  return (
    <div className="prep-page">
      <div className="container">
        <h1 className="prep-title">Подготовка к аттестации</h1>
        <p className="prep-lead">
          Закрытый раздел для членов клуба. Здесь — техника, методички и программы
          подготовки, которые помогут уверенно сдать на следующий гып.
        </p>

        {/* Блок 1: Галерея — кликабельная плашка целиком */}
        <Link to="/preparation/gallery" className="prep-gallery-card">
          <div className="prep-gallery-content">
            <h2 className="prep-block-title">Галерея техники</h2>
            <p className="prep-gallery-desc">
              Все стойки, удары, блоки и тули — с фильтрами по разделам и поиском.
            </p>
          </div>
          <span className="prep-gallery-arrow">→</span>
        </Link>

        {/* Блок 2: Методички */}
        <h2 className="prep-block-title prep-divider">Методички</h2>
        <div className="prep-cards-grid">
          {sortedMethods.map(m => (
            <Link
              key={m.slug}
              to={`/preparation/method/${m.slug}`}
              className={`prep-card ${methodFitsUser(m) ? 'prep-card-highlight' : ''}`}
            >
              {methodFitsUser(m) && (
                <span className="prep-card-badge">← это для тебя</span>
              )}
              <h3 className="prep-card-title">{m.title}</h3>
              <p className="prep-card-subtitle">{m.subtitle}</p>
            </Link>
          ))}
        </div>

        {/* Блок 3: Программа на 30 дней */}
        <h2 className="prep-block-title prep-divider">Программа на 30 дней</h2>
        <div className="prep-cards-grid">
          {sortedPlans.map(p => (
            <Link
              key={p.gup}
              to={`/preparation/plan/${p.gup}`}
              className={`prep-card ${planFitsUser(p) ? 'prep-card-highlight' : ''}`}
            >
              {planFitsUser(p) && (
                <span className="prep-card-badge">← это для тебя</span>
              )}
              <h3 className="prep-card-title">{p.title}</h3>
              <p className="prep-card-subtitle">{p.subtitle}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
