import { Link } from 'react-router-dom'
import './Champions.css'

// Иерархия: elite > world > europe > russia (алфавит)
const CHAMPIONS = [
  {
    level: 'elite',
    name: 'Кабанова Ольга',
    achievements: [
      'Чемпион Мира',
      'Чемпион Европы',
      'Чемпион России',
    ],
  },
  {
    level: 'world',
    name: 'Шамарин Глеб',
    achievements: [
      'Чемпион Мира',
      'Чемпион России',
    ],
  },
  {
    level: 'europe',
    name: 'Фуртаева Анастасия',
    achievements: [
      'Призёр чемпионата Европы',
      'Призёр чемпионата России',
    ],
  },
  // Россия — по алфавиту
  {
    level: 'russia',
    name: 'Андрюшин Кирилл',
    achievements: [
      'Призёр чемпионата России',
    ],
  },
  {
    level: 'russia',
    name: 'Дорофеев Максим',
    achievements: [
      'Призёр чемпионата России',
    ],
  },
  {
    level: 'russia',
    name: 'Келим Анастасия',
    achievements: [
      'Призёр чемпионата России',
    ],
  },
  {
    level: 'russia',
    name: 'Козлов Иван',
    achievements: [
      'Призёр чемпионата России',
    ],
  },
  {
    level: 'russia',
    name: 'Комаров Константин',
    achievements: [
      'Призёр чемпионата России',
    ],
  },
  {
    level: 'russia',
    name: 'Коростелёва Мария',
    achievements: [
      'Призёр чемпионата России',
    ],
  },
  {
    level: 'russia',
    name: 'Медведев Илья',
    achievements: [
      'Призёр чемпионата России',
    ],
  },
  {
    level: 'russia',
    name: 'Медведева Анастасия',
    achievements: [
      'Призёр чемпионата России',
    ],
  },
  {
    level: 'russia',
    name: 'Ротарь Екатерина',
    achievements: [
      'Призёр чемпионатов России',
      'Призёр Всероссийских соревнований',
      'Тренер клуба «Тайпан»',
    ],
  },
]

const LEVEL_CONFIG = {
  elite:  { label: 'Чемпион Мира и Европы', color: '#FFD700' },
  world:  { label: 'Чемпион Мира',          color: '#C0C0C0' },
  europe: { label: 'Призёр Европы',         color: '#cc4444' },
  russia: { label: 'Призёр России',         color: 'var(--red)' },
}

function GoldIcon()   { return <svg width="16" height="16" viewBox="0 0 16 16"><polygon points="8,1 10,6 15,6 11,9.5 12.5,15 8,11.5 3.5,15 5,9.5 1,6 6,6" fill="#FFD700"/></svg> }
function SilverIcon() { return <svg width="16" height="16" viewBox="0 0 16 16"><polygon points="8,1 10,6 15,6 11,9.5 12.5,15 8,11.5 3.5,15 5,9.5 1,6 6,6" fill="#C0C0C0"/></svg> }
function BronzeIcon() { return <svg width="16" height="16" viewBox="0 0 16 16"><polygon points="8,1 10,6 15,6 11,9.5 12.5,15 8,11.5 3.5,15 5,9.5 1,6 6,6" fill="#cc4444"/></svg> }
function RussiaIcon() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14">
      <rect width="20" height="4.67" y="0"    fill="#ffffff"/>
      <rect width="20" height="4.67" y="4.67" fill="#0039A6"/>
      <rect width="20" height="4.67" y="9.33" fill="#D52B1E"/>
    </svg>
  )
}

function LevelIcon({ level }) {
  if (level === 'elite')  return <GoldIcon />
  if (level === 'world')  return <SilverIcon />
  if (level === 'europe') return <BronzeIcon />
  return <RussiaIcon />
}

export default function Champions() {
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

          <div className="champions-legend">
            {Object.entries(LEVEL_CONFIG).map(([key, cfg]) => (
              <div className="legend-item" key={key} style={{color: cfg.color}}>
                <LevelIcon level={key} />
                {cfg.label}
              </div>
            ))}
          </div>

          <div className="champions-grid">
            {CHAMPIONS.map((c) => {
              const cfg = LEVEL_CONFIG[c.level]
              return (
                <div key={c.name} className={`champion-card champion-card--${c.level}`}>
                  <div className="champion-img-placeholder">
                    <span>Фото</span>
                  </div>
                  <div className="champion-info">
                    <div className="champion-level" style={{color: cfg.color}}>
                      <LevelIcon level={c.level} />
                      {cfg.label}
                    </div>
                    <div className="champion-name">{c.name}</div>
                    <ul className="champion-achievements">
                      {c.achievements.map((a, i) => <li key={i}>{a}</li>)}
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
