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
    achievements: [
      '1 место командное масоги (2021)',
    ],
    level: 'russia',
  },
  {
    name: 'Медведев Илья',
    achievements: [
      '2, 3 места Первенство России (2020–2022)',
    ],
    level: 'russia',
  },
  {
    name: 'Медведева Анастасия',
    achievements: [
      '3 место Первенство России (2020–2022)',
    ],
    level: 'russia',
  },
  {
    name: 'Козлов Иван',
    achievements: [
      '3 место Первенство России (2020)',
    ],
    level: 'russia',
  },
  {
    name: 'Комаров Константин',
    achievements: [
      '3 место командное масоги, Первенство России (2022)',
    ],
    level: 'russia',
  },
  {
    name: 'Коростелёва Мария',
    achievements: [
      '3 место Чемпионат России (2022)',
    ],
    level: 'russia',
  },
]

const LEVEL_LABEL = {
  elite:  '🌍 Чемпион мира и Европы',
  world:  '🌍 Чемпион мира',
  europe: '🥉 Призёр Европы',
  russia: '🇷🇺 Чемпион / призёр России',
}

export default function Champions() {
  return (
    <main className="champions-page">
      <section className="champions-hero">
        <div className="container">
          <p className="section-label">Гордость клуба</p>
          <h1 className="champions-title">ЗАЛ СЛАВЫ</h1>
          <div className="divider" />
          <p className="champions-subtitle">
            Спортсмены клуба «Тайпан», завоевавшие награды на соревнованиях<br/>
            всероссийского и международного уровня
          </p>
        </div>
      </section>

      <section className="champions-grid-section">
        <div className="container">
          <div className="champions-grid">
            {CHAMPIONS.map((c, i) => (
              <div className={`champion-card champion-card--${c.level}`} key={i}>
                <div className="champion-img-placeholder">
                  <span>Фото</span>
                </div>
                <div className="champion-info">
                  <div className="champion-level">{LEVEL_LABEL[c.level]}</div>
                  <h3 className="champion-name">{c.name}</h3>
                  <ul className="champion-achievements">
                    {c.achievements.map((a, j) => (
                      <li key={j}>{a}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="champions-back">
            <Link to="/" className="btn-outline">← На главную</Link>
          </div>
        </div>
      </section>
    </main>
  )
}
