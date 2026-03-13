import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './Home.css'

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


function IconLocation() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="map-svg-icon">
      <path d="M9 1C6.24 1 4 3.24 4 6c0 4 5 11 5 11s5-7 5-11c0-2.76-2.24-5-5-5z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <circle cx="9" cy="6" r="1.8" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    </svg>
  )
}
function IconPhone() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="map-svg-icon">
      <path d="M3 3h4l1.5 3.5-2 1.2a9 9 0 004.8 4.8l1.2-2L16 11v4a1 1 0 01-1 1C7.16 16 2 10.84 2 4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}
function IconMail() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="map-svg-icon">
      <rect x="2" y="4" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <path d="M2 5l7 5 7-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  )
}

const TRAINER = {
  name:  'Ротарь Екатерина Валерьевна',
  rank:  '3 дан по тхэквондо ГТФ',
  bio:   'Тренер клуба тхэквондо г. Павловский Посад. Призёр чемпионатов России и Всероссийских соревнований, многократный призёр первенств Москвы, Московской области и ЦФО. Выпускница Российской государственной академии физической культуры (2005). Высшее профессиональное образование в области физической культуры и спорта.',
  quote: '«Прежде чем стать сильным, стань дисциплинированным»',
}

const SECTIONS = [
  { title: 'Дети 6–10 лет',  desc: 'Базовая техника, дисциплина, координация', link: '/groups/kids-6-10' },
  { title: 'Дети 11–16 лет', desc: 'Соревновательная подготовка, спарринги',   link: '/groups/kids-11-16' },
  { title: 'Взрослые',        desc: 'Все уровни. Фитнес и боевой тхэквондо',    link: '/groups/adults' },
  { title: 'Зал славы',       desc: 'Наши чемпионы и призёры',                  link: '/champions' },
]

const STATS = [
  { target: 10,  suffix: '+', label: 'лет тхэквондо в городе' },
  { target: 50,  suffix: '+', label: 'спортсменов сегодня' },
  { target: 4,   suffix: '',  label: 'чемпиона Европы и мира' },
  { target: 9,   suffix: '+', label: 'чемпионов и призёров России' },
  { target: 14,  suffix: '',  label: 'чёрных поясов' },
  { target: 7,   suffix: '',  label: 'МС и КМС' },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <main className="home">

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-bg">
          <img src="https://images.unsplash.com/photo-1555597673-b21d5c935865?w=1600&fit=crop" alt="Тхэквондо" />
          <div className="hero-overlay" />
        </div>
        <div className="container hero-content">
          <div className="hero-text animate-fade-up">
            <div className="hero-brand">
              <img src="/logo.png" alt="Тайпан" className="hero-logo" />
              <div className="hero-brand-text">
                <h1 className="hero-title">ТАЙПАН</h1>
                <p className="hero-subtitle">Клуб тхэквондо · Павловский Посад</p>
              </div>
            </div>
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
      </section>

      {/* ── СЧЁТЧИКИ ─────────────────────────────────────────────── */}
      <section className="stats">
        <div className="container stats-grid">
          {STATS.map((s, i) => (
            <div key={i} className="stat-row">
              {i > 0 && <div className="stat-divider" />}
              <div className="stat-item">
                <div className="stat-number"><Counter target={s.target} suffix={s.suffix} /></div>
                <div className="stat-label">{s.label}</div>
              </div>
            </div>
          ))}
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
              <div
                className="section-card"
                key={i}
                style={{ animationDelay: `${i * 0.1}s` }}
                onClick={() => navigate(s.link)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && navigate(s.link)}
              >
                <div className="section-card-num">{String(i + 1).padStart(2, '0')}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <div className="section-card-line" />
                <div className="section-card-arrow">→</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ФОТО БЛОК ────────────────────────────────────────────── */}
      <section className="photo-block">
        <div className="photo-grid">
          <div className="photo-main photo-placeholder">
            <div className="photo-caption">
              <span>ТРЕНИРОВКИ</span>
              <p>Тренировки в группах, индивидуальные занятия</p>
            </div>
          </div>
          <div className="photo-side">
            <div className="photo-placeholder-sm" />
            <div className="photo-placeholder-sm" />
          </div>
        </div>
        <div className="photo-label">
          <span className="section-label">Зал в центре города</span>
          <h2 className="section-title">МЕСТО ГДЕ<br/>РОЖДАЮТСЯ<br/>ЧЕМПИОНЫ</h2>
          <p className="photo-label-desc">Скоро здесь появятся фотографии с наших тренировок и соревнований</p>
          <Link to="/apply" className="btn-primary">Первое занятие бесплатно</Link>
        </div>
      </section>

      {/* ── ТРЕНЕР ───────────────────────────────────────────────── */}
      <section className="section trainers-section">
        <div className="container">
          <p className="section-label">Профессионал своего дела</p>
          <h2 className="section-title">ТРЕНЕР</h2>
          <div className="divider" />
          <div className="trainer-single">
            <div className="trainer-img-wrap">
              <div className="trainer-img-placeholder"><span>Фото тренера</span></div>
              <div className="trainer-overlay" />
            </div>
            <div className="trainer-info">
              <div className="trainer-rank">{TRAINER.rank}</div>
              <h3 className="trainer-name">{TRAINER.name}</h3>
              <p className="trainer-bio">{TRAINER.bio}</p>
              <blockquote className="trainer-quote">{TRAINER.quote}</blockquote>
            </div>
          </div>
        </div>
      </section>

      {/* ── КАРТА ────────────────────────────────────────────────── */}
      <section className="section map-section">
        <div className="container">
          <p className="section-label">Мы находимся</p>
          <h2 className="section-title">КАК НАС НАЙТИ</h2>
          <div className="divider" />
          <div className="map-wrap">
            <div className="map-address">
              <div className="map-address-item">
                <IconLocation />
                <div>
                  <strong>Адрес</strong>
                  <p>Павловский Посад, ул. Кирова, 95</p>
                </div>
              </div>
              <div className="map-address-item">
                <IconPhone />
                <div>
                  <strong>Телефон</strong>
                  <p><a href="tel:+79091652800">+7 (909) 165-28-00</a></p>
                </div>
              </div>
              <div className="map-address-item">
                <IconMail />
                <div>
                  <strong>Email</strong>
                  <p><a href="mailto:Bliznec.ket@mail.ru">Bliznec.ket@mail.ru</a></p>
                </div>
              </div>
              <a
                href="https://yandex.ru/maps/?text=Павловский+Посад,+ул.+Кирова,+95"
                target="_blank"
                rel="noreferrer"
                className="btn-primary map-btn"
              >
                Открыть в Яндекс Картах →
              </a>
            </div>
            <iframe
              src="https://yandex.ru/map-widget/v1/?ll=38.6572%2C55.7697&z=16&pt=38.6572%2C55.7697%2Cpm2rdm"
              width="100%"
              height="400"
              style={{ border: 'none' }}
              allowFullScreen
              title="Карта клуба Тайпан"
            />
          </div>
        </div>
      </section>

    </main>
  )
}
