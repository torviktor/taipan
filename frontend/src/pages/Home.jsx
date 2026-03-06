import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import './Home.css'

// ── Счётчик цифр ─────────────────────────────────────────────────────────────
function Counter({ target, suffix = '', duration = 2000 }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true
        const step = target / (duration / 16)
        let current = 0
        const timer = setInterval(() => {
          current = Math.min(current + step, target)
          setCount(Math.floor(current))
          if (current >= target) clearInterval(timer)
        }, 16)
      }
    }, { threshold: 0.5 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target, duration])

  return <span ref={ref}>{count}{suffix}</span>
}

// ── Тренеры ───────────────────────────────────────────────────────────────────
const TRAINERS = [
  {
    name: 'Александр Воронов',
    rank: 'Мастер спорта, 4 дан',
    bio: 'Главный тренер клуба. 20 лет в тхэквондо. Воспитал 15 чемпионов России.',
    img: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=400&h=500&fit=crop',
  },
  {
    name: 'Дмитрий Савельев',
    rank: 'КМС, 3 дан',
    bio: 'Тренер детских групп. Специализация — техника и дисциплина.',
    img: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=500&fit=crop',
  },
  {
    name: 'Ирина Козлова',
    rank: 'КМС, 2 дан',
    bio: 'Тренер женских групп. Чемпионка МО по тхэквондо 2019.',
    img: 'https://images.unsplash.com/photo-1594381898411-846e7d193883?w=400&h=500&fit=crop',
  },
]

// ── Секции клуба ─────────────────────────────────────────────────────────────
const SECTIONS = [
  { icon: '🥋', title: 'Дети 6–10 лет',   desc: 'Базовая техника, дисциплина, координация' },
  { icon: '⚡', title: 'Дети 11–16 лет',  desc: 'Соревновательная подготовка, спарринги' },
  { icon: '🔥', title: 'Взрослые',         desc: 'Все уровни. Фитнес и боевой тхэквондо' },
  { icon: '🏆', title: 'Спортсмены',       desc: 'Сборы, турниры, углублённая работа' },
]

export default function Home() {
  return (
    <main className="home">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-bg">
          <img
            src="https://images.unsplash.com/photo-1555597673-b21d5c935865?w=1600&fit=crop"
            alt="Тхэквондо"
          />
          <div className="hero-overlay" />
        </div>

        <div className="container hero-content">
          <div className="hero-text animate-fade-up">
            <p className="section-label">Павловский Посад • с 2008 года</p>
            <h1 className="hero-title">
              КЛУБ<br/>
              <span className="hero-title-red">ТХЭ<br/>КВОН<br/>ДО</span>
            </h1>
            <div className="hero-name">ТАЙПАН</div>
            <p className="hero-desc">
              Профессиональные тренировки для детей и взрослых.<br/>
              Первое занятие — <strong>бесплатно.</strong>
            </p>
            <div className="hero-btns">
              <Link to="/apply" className="btn-primary">Записаться</Link>
              <Link to="/schedule" className="btn-outline">Расписание</Link>
            </div>
          </div>
        </div>

        {/* Диагональная полоса внизу */}
        <div className="hero-slash" />
      </section>

      {/* ── СЧЁТЧИКИ ─────────────────────────────────────────────── */}
      <section className="stats">
        <div className="container stats-grid">
          <div className="stat-item">
            <div className="stat-number"><Counter target={16} suffix="+" /></div>
            <div className="stat-label">лет клубу</div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <div className="stat-number"><Counter target={300} suffix="+" /></div>
            <div className="stat-label">учеников</div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <div className="stat-number"><Counter target={120} suffix="+" /></div>
            <div className="stat-label">побед на турнирах</div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <div className="stat-number"><Counter target={15} /></div>
            <div className="stat-label">чемпионов России</div>
          </div>
        </div>
      </section>

      {/* ── СЕКЦИИ ───────────────────────────────────────────────── */}
      <section className="section sections-block">
        <div className="container">
          <p className="section-label">Для всех возрастов</p>
          <h2 className="section-title">НАШИ ГРУППЫ</h2>
          <div className="divider" />
          <div className="sections-grid">
            {SECTIONS.map((s, i) => (
              <div className="section-card" key={i} style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="section-card-icon">{s.icon}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <div className="section-card-line" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ФОТО БЛОК ────────────────────────────────────────────── */}
      <section className="photo-block">
        <div className="photo-grid">
          <div className="photo-main">
            <img src="https://images.unsplash.com/photo-1566577134770-3d85bb3a9cc4?w=800&fit=crop" alt="Тренировка" />
            <div className="photo-caption">
              <span>ТРЕНИРОВКИ</span>
              <p>Каждый день кроме воскресенья</p>
            </div>
          </div>
          <div className="photo-side">
            <img src="https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&fit=crop" alt="Спарринг" />
            <img src="https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=400&fit=crop" alt="Победа" />
          </div>
        </div>
        <div className="photo-label">
          <span className="section-label">Зал в центре города</span>
          <h2 className="section-title">МЕСТО ГДЕ<br/>РОЖДАЮТСЯ<br/>ЧЕМПИОНЫ</h2>
          <Link to="/apply" className="btn-primary">Первое занятие бесплатно</Link>
        </div>
      </section>

      {/* ── ТРЕНЕРЫ ──────────────────────────────────────────────── */}
      <section className="section trainers-section">
        <div className="container">
          <p className="section-label">Профессионалы своего дела</p>
          <h2 className="section-title">ТРЕНЕРЫ</h2>
          <div className="divider" />
          <div className="trainers-grid">
            {TRAINERS.map((t, i) => (
              <div className="trainer-card" key={i}>
                <div className="trainer-img-wrap">
                  <img src={t.img} alt={t.name} />
                  <div className="trainer-overlay" />
                </div>
                <div className="trainer-info">
                  <div className="trainer-rank">{t.rank}</div>
                  <h3 className="trainer-name">{t.name}</h3>
                  <p className="trainer-bio">{t.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="cta-section">
        <div className="cta-bg" />
        <div className="container cta-content">
          <p className="section-label">Не откладывай</p>
          <h2 className="section-title">НАЧНИ<br/>СЕГОДНЯ</h2>
          <p className="cta-desc">Запишись на пробное занятие — это бесплатно и ни к чему не обязывает</p>
          <Link to="/apply" className="btn-primary">Записаться на пробное</Link>
        </div>
      </section>

    </main>
  )
}
