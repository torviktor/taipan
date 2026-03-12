import { useState } from 'react'
import { Link } from 'react-router-dom'
import './About.css'

const SECTIONS = [
  { id: 'about',       title: 'О НАС' },
  { id: 'members',     title: 'УЧАСТНИКИ КЛУБА И ИХ ОБЯЗАННОСТИ' },
  { id: 'structure',   title: 'СТРУКТУРА СЕЗОНА И ПОВСЕДНЕВНАЯ ДЕЯТЕЛЬНОСТЬ' },
  { id: 'attestation', title: 'АТТЕСТАЦИИ' },
  { id: 'camps',       title: 'УЧЕБНО-ТРЕНИРОВОЧНЫЕ СБОРЫ И СОРЕВНОВАНИЯ' },
  { id: 'family',      title: 'РОЛЬ СЕМЬИ И ОКРУЖЕНИЯ В ОБУЧЕНИИ ТХЭКВОНДО' },
]

// Контент — пока заглушки, будем заполнять по одному
const CONTENT = {
  about:       null,
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

      {/* Hero */}
      <section className="about-hero">
        <div className="container">
          <p className="section-label">Клуб тхэквондо</p>
          <h1 className="about-title">О КЛУБЕ</h1>
          <div className="divider" />
        </div>
      </section>

      <div className="container about-layout">

        {/* Боковое меню разделов */}
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

        {/* Контент раздела */}
        <div className="about-content">
          <h2 className="about-section-title">{section.title}</h2>
          <div className="about-divider" />

          {CONTENT[active] ? (
            <div className="about-body" dangerouslySetInnerHTML={{ __html: CONTENT[active] }} />
          ) : (
            <div className="about-coming">
              <p>Раздел находится в разработке.</p>
              <p>Скоро здесь появится подробная информация.</p>
            </div>
          )}
        </div>

      </div>
    </main>
  )
}
