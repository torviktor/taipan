import { Link } from 'react-router-dom'
import './Champions.css'

const CHAMPIONS = [
  {
    name: 'Кабанова Ольга',
    achievements: [
      '4-кратная Чемпионка России',
      '4-кратная Чемпионка Европы',
    ],
    level: 'elite',
  },
  {
    name: 'Шамарин Глеб',
    achievements: [
      'Чемпион России (2022)',
      '1 место Кубок Мира (2021)',
    ],
    level: 'elite',
  },
  {
    name: 'Андрюшин Кирилл',
    achievements: [
      '1 место Кубок Мира (2021)',
    ],
    level: 'world',
  },
  {
    name: 'Фуртаева Анастасия',
    achievements: [
      'Чемпионка России',
      'Призёр чемпионата России',
      'Бронзовый призёр Чемпионата Европы (2020)',
    ],
    level: 'europe',
  },
  {
    name: 'Келим Анастасия',
    achievements: [
      '1 место «Юность России» (2023)',
      '1 место Кубок России (2025)',
    ],
    level: 'russia',
  },
  {
    name: 'Дорофеев Максим',
    achievements: [ '1 место командное масоги (2021)' ],
    level: 'russia',
  },
  {
    name: 'Медведев Илья',
    achievements: [ '2, 3 места Первенство России (2020–2022)' ],
    level: 'russia',
  },
  {
    name: 'Медведева Анастасия',
    achievements: [ '3 место Первенство России (2020–2022)' ],
    level: 'russia',
  },
  {
    name: 'Козлов Иван',
    achievements: [ '3 место Первенство России (2020)' ],
    level: 'russia',
  },
  {
    name: 'Комаров Константин',
    achievements: [ '3 место командное масоги, Первенство России (2022)' ],
    level: 'russia',
  },
  {
    name: 'Коростелёва Мария',
    achievements: [ '3 место Чемпионат России (2022)' ],
    level: 'russia',
  },
]

// SVG значки уровней
const BadgeElite = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="8" stroke="#FFD700" strokeWidth="1.5"/>
    <path d="M9 4l1.5 3h3l-2.5 2 1 3L9 10.5 6 12l1-3L4.5 7h3L9 4z" fill="#FFD700"/>
  </svg>
)

const BadgeWorld = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="8" stroke="#C0C0C0" strokeWidth="1.5"/>
    <path d="M9 4l1.5 3h3l-2.5 2 1 3L9 10.5 6 12l1-3L4.5 7h3L9 4z" fill="#C0C0C0"/>
  </svg>
)

const BadgeEurope = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="8" stroke="#CD7F32" strokeWidth="1.5"/>
    <path d="M9 4l1.5 3h3l-2.5 2 1 3L9 10.5 6 12l1-3L4.5 7h3L9 4z" fill="#CD7F32"/>
  </svg>
)

const BadgeRussia = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="1" y="4" width="16" height="4" rx="0" fill="#FFFFFF" stroke="#ccc" strokeWidth="0.5"/>
    <rect x="1" y="8" width="16" height="3" fill="#0039A6"/>
    <rect x="1" y="11" width="16" height="4" rx="0" fill="#D52B1E"/>
    <rect x="1" y="4" width="16" height="11" rx="2" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
  </svg>
)

const LEVEL_CONFIG = {
  elite:  { label: 'Чемпион мира и Европы', Icon: BadgeElite,  color: '#FFD700' },
  world:  { label: 'Чемпион мира',          Icon: BadgeWorld,  color: '#C0C0C0' },
  europe: { label: 'Призёр Европы',         Icon: BadgeEurope, color: '#CD7F32' },
  russia: { label: 'Чемпион / призёр России', Icon: BadgeRussia, color: '#ffffff' },
}

export default function Champions() {
  return (
    <main className="champions-page">
      <section className="champions-hero">
        <div className="container">
          <p className="section-label">Гордость города</p>
          <h1 className="champions-title">ЗАЛ СЛАВЫ</h1>
          <div className="divider" />
          <p className="champions-subtitle">
            Спортсмены г. Павловский Посад, завоевавшие награды на соревнованиях<br/>
            всероссийского и международного уровня в виде спорта тхэквондо
          </p>
        </div>
      </section>

      <section className="champions-grid-section">
        <div className="container">

          {/* Легенда */}
          <div className="champions-legend">
            {Object.entries(LEVEL_CONFIG).map(([key, cfg]) => (
              <div className="legend-item" key={key}>
                <cfg.Icon />
                <span style={{ color: cfg.color }}>{cfg.label}</span>
              </div>
            ))}
          </div>

          <div className="champions-grid">
            {CHAMPIONS.map((c, i) => {
              const cfg = LEVEL_CONFIG[c.level]
              return (
                <div className={`champion-card champion-card--${c.level}`} key={i}>
                  <div className="champion-img-placeholder">
                    <span>Фото</span>
                  </div>
                  <div className="champion-info">
                    <div className="champion-level">
                      <cfg.Icon />
                      <span style={{ color: cfg.color }}>{cfg.label}</span>
                    </div>
                    <h3 className="champion-name">{c.name}</h3>
                    <ul className="champion-achievements">
                      {c.achievements.map((a, j) => <li key={j}>{a}</li>)}
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="champions-back">
            <Link to="/" className="btn-outline">← На главную</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
