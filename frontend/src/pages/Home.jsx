import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import './Home.css'

/* ── COUNTER ─────────────────────────────────────────────────────────── */
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

/* ── HOOK: useInView ────────────────────────────────────────────────── */
function useInView(threshold = 0.12) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [threshold])
  return [ref, visible]
}

/* ── ИКОНКИ ─────────────────────────────────────────────────────────── */
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

/* ── ДАННЫЕ ──────────────────────────────────────────────────────────── */
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

/* ── КОМПОНЕНТ ───────────────────────────────────────────────────────── */
export default function Home() {
  const navigate = useNavigate()

  /* cursor glow */
  const glowRef = useRef(null)
  useEffect(() => {
    const move = (e) => {
      if (glowRef.current) {
        glowRef.current.style.left = e.clientX + 'px'
        glowRef.current.style.top  = e.clientY + 'px'
      }
    }
    window.addEventListener('mousemove', move)
    return () => window.removeEventListener('mousemove', move)
  }, [])

  /* scroll reveal refs */
  const [statsRef,   statsVis]   = useInView(0.1)
  const [groupsRef,  groupsVis]  = useInView(0.1)
  const [photoRef,   photoVis]   = useInView(0.1)
  const [trainerRef, trainerVis] = useInView(0.1)
  const [mapRef,     mapVis]     = useInView(0.1)

  return (
    <main className="home">

      {/* cursor glow */}
      <div className="cursor-glow" ref={glowRef} />

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-bg">
          <img src="https://images.unsplash.com/photo-1555597673-b21d5c935865?w=1600&fit=crop" alt="Тхэквондо" />
          <div className="hero-overlay" />
        </div>

        {/* пульсирующая вертикальная линия */}
        <div className="hero-pulse-line" />

        <div className="container hero-content">
          <div className="hero-text">
            {/* stagger по аналогии с портфолио: brand 0.1s, desc 0.3s, btns 0.5s */}
            <div className="hero-brand hero-stagger-1">
              <img src="/logo.png" alt="Тайпан" className="hero-logo" />
              <div className="hero-brand-text">
                <h1 className="hero-title">
                  <span className="hero-title-shimmer">ТАЙПАН</span>
                </h1>
                <p className="hero-subtitle">Клуб тхэквондо · Павловский Посад</p>
              </div>
            </div>
            <p className="hero-desc hero-stagger-2">
              Профессиональные тренировки для детей и взрослых.<br/>
              Первое занятие — <strong>бесплатно.</strong>
            </p>
            <div className="hero-btns hero-stagger-3">
              <Link to="/apply"     className="btn-primary btn-cta">Записаться</Link>
              <Link to="/schedule"  className="btn-outline btn-cta">Расписание</Link>
              <Link to="/about/why" className="btn-outline btn-cta">Почему мы</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── СЧЁТЧИКИ ─────────────────────────────────────────────── */}
      <section
        className={`stats reveal-section${statsVis ? ' is-visible' : ''}`}
        ref={statsRef}
      >
        <div className="container stats-grid">
          {STATS.map((s, i) => (
            <div key={i} className="stat-row">
              {i > 0 && <div className="stat-divider" />}
              <div className="stat-item" style={{ transitionDelay: `${i * 0.07}s` }}>
                <div className="stat-number"><Counter target={s.target} suffix={s.suffix} /></div>
                <div className="stat-label">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── СЕКЦИИ ───────────────────────────────────────────────── */}
      <section
        className={`section sections-block reveal-section${groupsVis ? ' is-visible' : ''}`}
        ref={groupsRef}
      >
        <div className="container">
          <p className="section-label reveal-child" style={{ transitionDelay: '0.05s' }}>Для всех возрастов</p>
          <h2 className="section-title reveal-child" style={{ transitionDelay: '0.12s' }}>НАШИ ГРУППЫ</h2>
          <div className="sections-grid">
            {SECTIONS.map((s, i) => (
              <div
                className="section-card reveal-child"
                key={i}
                style={{ transitionDelay: `${0.22 + i * 0.08}s` }}
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
      <section
        className={`photo-block reveal-section${photoVis ? ' is-visible' : ''}`}
        ref={photoRef}
      >
        <div className="photo-grid">
          <div className="photo-main">
            <img src="/photo1.webp" alt="Тренировки" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
            <div className="photo-caption">
              <span>ТРЕНИРОВКИ</span>
              <p>Тренировки в группах, индивидуальные занятия</p>
            </div>
          </div>
          <div className="photo-side">
            <div style={{flex:1,overflow:'hidden'}}>
              <img src="/photo2.webp" alt="Команда" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
            </div>
            <div style={{flex:1,overflow:'hidden'}}>
              <img src="/photo3.webp" alt="Соревнования" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
            </div>
          </div>
        </div>
        <div className="photo-label">
          <span className="section-label">Зал в центре города</span>
          <h2 className="section-title">МЕСТО ГДЕ<br/>РОЖДАЮТСЯ<br/>ЧЕМПИОНЫ</h2>
          <p className="photo-label-desc">Фотографии с наших тренировок и соревнований</p>
          <Link to="/apply" className="btn-primary btn-cta">Первое занятие бесплатно</Link>
        </div>
      </section>

      {/* ── ТРЕНЕР ───────────────────────────────────────────────── */}
      <section
        className={`section trainers-section reveal-section${trainerVis ? ' is-visible' : ''}`}
        ref={trainerRef}
      >
        <div className="container">
          <p className="section-label reveal-child" style={{ transitionDelay: '0.05s' }}>Профессионал своего дела</p>
          <h2 className="section-title reveal-child" style={{ transitionDelay: '0.12s' }}>ТРЕНЕР</h2>
          <div className="divider reveal-child" style={{ transitionDelay: '0.18s' }} />
          <div className="trainer-single">
            <div className="trainer-img-wrap">
              <img src="/coach.webp" alt="Ротарь Екатерина Валерьевна" className="trainer-photo" />
            </div>
            <div className="trainer-info reveal-child" style={{ transitionDelay: '0.34s' }}>
              <div className="trainer-rank">{TRAINER.rank}</div>
              <h3 className="trainer-name">{TRAINER.name}</h3>
              <p className="trainer-bio">{TRAINER.bio}</p>
              <blockquote className="trainer-quote">{TRAINER.quote}</blockquote>
            </div>
          </div>
        </div>
      </section>

      {/* ── КАРТА ────────────────────────────────────────────────── */}
      <section
        className={`section map-section reveal-section${mapVis ? ' is-visible' : ''}`}
        ref={mapRef}
      >
        <div className="container">
          <p className="section-label reveal-child" style={{ transitionDelay: '0.05s' }}>Мы находимся</p>
          <h2 className="section-title reveal-child" style={{ transitionDelay: '0.12s' }}>КАК НАС НАЙТИ</h2>
          <div className="divider reveal-child" style={{ transitionDelay: '0.18s' }} />
          <div className="map-wrap">
            <div className="map-address">
              <div className="map-address-item reveal-child" style={{ transitionDelay: '0.22s' }}>
                <IconLocation />
                <div>
                  <strong>Адрес</strong>
                  <p>Павловский Посад, ул. Кирова, 95</p>
                </div>
              </div>
              <div className="map-address-item reveal-child" style={{ transitionDelay: '0.30s' }}>
                <IconPhone />
                <div>
                  <strong>Телефон</strong>
                  <p><a href="tel:+79091652800">+7 (909) 165-28-00</a></p>
                </div>
              </div>
              <div className="map-address-item reveal-child" style={{ transitionDelay: '0.38s' }}>
                <IconMail />
                <div>
                  <strong>Email</strong>
                  <p><a href="mailto:Bliznec.ket@mail.ru">Bliznec.ket@mail.ru</a></p>
                </div>
              </div>
              <a
                href="https://yandex.ru/maps/?text=Павловский+Посад,+ул.+Кирова,+95&ll=38.673440,55.781140&z=16"
                target="_blank"
                rel="noreferrer"
                className="btn-primary map-btn btn-cta reveal-child"
                style={{ transitionDelay: '0.46s' }}
              >
                Открыть в Яндекс Картах →
              </a>
            </div>
            <iframe
              src="https://yandex.ru/map-widget/v1/?ll=38.673440%2C55.781140&z=16&pt=38.673440%2C55.781140%2Cpm2rdm"
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
