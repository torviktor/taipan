import { useState } from 'react'
import { Link } from 'react-router-dom'
import './About.css'

const SECTIONS = [
  { id: 'about',       title: 'О НАС' },
  { id: 'emblem',      title: 'ЭМБЛЕМА КЛУБА' },
  { id: 'members',     title: 'УЧАСТНИКИ КЛУБА И ИХ ОБЯЗАННОСТИ' },
  { id: 'structure',   title: 'СТРУКТУРА СЕЗОНА И ПОВСЕДНЕВНАЯ ДЕЯТЕЛЬНОСТЬ' },
  { id: 'attestation', title: 'АТТЕСТАЦИИ' },
  { id: 'camps',       title: 'УЧЕБНО-ТРЕНИРОВОЧНЫЕ СБОРЫ И СОРЕВНОВАНИЯ' },
  { id: 'family',      title: 'РОЛЬ СЕМЬИ И ОКРУЖЕНИЯ В ОБУЧЕНИИ ТХЭКВОНДО' },
]

const CONTENT = {
  about:       null,
  emblem:      null,
  members:     null,
  structure:   null,
  attestation: null,
  camps:       null,
  family:      null,
}

export default function About() {
  const [active, setActive] = useState('about')
  const section = SECTIONS.find(s => s.id === active)

  return (
    <main className="about-page">

      <section className="about-hero">
        <div className="container">
          <p className="section-label">Клуб тхэквондо</p>
          <h1 className="about-title">О КЛУБЕ</h1>
          <div className="divider" />
        </div>
      </section>

      <div className="container about-layout">

        {/* Боковое меню */}
        <nav className="about-nav">
          {SECTIONS.map((s, i) => (
            <button
              key={s.id}
              className={`about-nav-item ${active === s.id ? 'active' : ''}`}
              onClick={() => setActive(s.id)}
            >
              <span className="about-nav-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="about-nav-title">{s.title}</span>
            </button>
          ))}
        </nav>

        {/* Контент */}
        <div className="about-content">
          <h2 className="about-section-title">{section.title}</h2>
          <div className="about-divider" />

          {/* Эмблема — особый блок с логотипом */}
          {active === 'emblem' && CONTENT.emblem === null && (
            <div className="about-emblem-preview">
              <img src="/logo.png" alt="Эмблема клуба Тайпан" className="about-emblem-img" />
              <div className="about-coming" style={{ marginTop: '24px' }}>
                <p>Описание эмблемы в разработке.</p>
                <p>Скоро здесь появится подробная информация.</p>
              </div>
            </div>
          )}

          {active !== 'emblem' && CONTENT[active] === null && (
            <div className="about-coming">
              <p>Раздел находится в разработке.</p>
              <p>Скоро здесь появится подробная информация.</p>
            </div>
          )}

          {CONTENT[active] !== null && (
            <div className="about-body" dangerouslySetInnerHTML={{ __html: CONTENT[active] }} />
          )}
        </div>

      </div>
    </main>
  )
}
