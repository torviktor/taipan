import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import './WhyTaipan.css'
import AchievementBadge, { ACHIEVEMENTS_CATALOG } from '../components/AchievementBadge'

const SHOWCASE_CODES = [
  'attendance_10',
  'attendance_50',
  'attendance_100',
  'competition_first',
  'competition_gold',
  'cert_advance',
  'loyalty_1year',
  'camp_member',
]

const RATING_MOCK = [
  { place: 1, name: 'Александр К.', age: 12, points: '142.5', cls: 'why-rating-row--gold' },
  { place: 2, name: 'Дмитрий П.',   age: 11, points: '118.3', cls: '' },
  { place: 3, name: 'Михаил С.',    age: 13, points: '97.8',  cls: 'why-rating-row--bronze' },
  { place: 4, name: 'Артём В.',     age: 12, points: '76.2',  cls: '' },
  { place: 5, name: 'Никита Л.',    age: 11, points: '54.1',  cls: '' },
]

const FEATURES = [
  {
    title: 'Личный кабинет',
    text: 'Посещаемость, рейтинг, ачивки и прогресс спортсмена — всё в реальном времени прямо на сайте.',
  },
  {
    title: 'Уведомления',
    text: 'О соревнованиях, сборах и аттестациях — сразу на телефон. Отвечайте на приглашения прямо из уведомления.',
  },
  {
    title: 'Страховка и документы',
    text: 'Система отслеживает сроки страховки и напоминает когда нужно её обновить. Ничего не потеряется.',
  },
  {
    title: 'Аттестации',
    text: 'Следите за прогрессом по поясам. Каждая аттестация фиксируется — виден путь от белого до чёрного пояса.',
  },
  {
    title: 'Telegram-канал',
    text: 'Все новости клуба, анонсы соревнований и сборов, календарь событий — в одном Telegram-канале. Подписался и всегда в курсе.',
  },
  {
    title: 'Честные взносы',
    text: 'Прозрачная система учёта оплаты. Менеджер ведёт список, вы видите статус — никакой путаницы с платежами.',
  },
]

export default function WhyTaipan() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('visible')
      }),
      { threshold: 0.15 }
    )
    document.querySelectorAll('.why-fade-in').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <>
      {/* БЛОК 1: HERO */}
      <section className="why-hero">
        <div className="container">
          <p className="section-label">Клуб тхэквондо «Тайпан»</p>
          <h1 className="why-title">ПОЧЕМУ ТАЙПАН?</h1>
          <p className="why-subtitle">
            Это не просто секция. Это система, которая делает из детей чемпионов —
            и они сами этого хотят.
          </p>
        </div>
      </section>

      {/* БЛОК 2: ТРИ ПРИЧИНЫ */}
      <section className="why-section why-fade-in">
        <div className="container">
          <div className="why-three-grid">
            <div className="why-reason-card">
              <h3>РАСТЁТ</h3>
              <p>
                Физически, технически, характером. Каждая тренировка — шаг вперёд
                который виден родителям в личном кабинете.
              </p>
            </div>
            <div className="why-reason-card">
              <h3>СОРЕВНУЕТСЯ</h3>
              <p>
                Реальные турниры, реальные соперники, реальные победы.
                Рейтинг обновляется после каждого соревнования автоматически.
              </p>
            </div>
            <div className="why-reason-card">
              <h3>ГОРДИТСЯ</h3>
              <p>
                Ачивки, рейтинг, Зал Славы — система наград которую видит вся семья
                и которую хочется заслужить.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* БЛОК 3: АЧИВКИ */}
      <section className="why-section why-section--dark why-fade-in">
        <div className="container">
          <p className="section-label">Геймификация</p>
          <h2 className="why-section-title">АЧИВКИ — НАГРАДЫ ЗА РЕАЛЬНЫЕ ДОСТИЖЕНИЯ</h2>
          <p className="why-text">
            Каждый спортсмен зарабатывает значки за победы на турнирах, посещаемость,
            сданные аттестации и участие в сборах. Не абстрактная похвала —
            конкретный значок который навсегда остаётся в профиле.
          </p>
          <div className="why-achievements-grid">
            {SHOWCASE_CODES.map(code => (
              <div key={code} className="why-ach-card">
                <AchievementBadge ach={{ code, granted: true }} size={80} />
                <div className="why-ach-desc">{(ACHIEVEMENTS_CATALOG[code] || {}).desc}</div>
              </div>
            ))}
          </div>
          <p className="why-hook">
            Дети сами просятся на тренировку — чтобы не потерять серию посещаемости.
          </p>
        </div>
      </section>

      {/* БЛОК 4: РЕЙТИНГ */}
      <section className="why-section why-fade-in">
        <div className="container">
          <p className="section-label">Спортивная система</p>
          <h2 className="why-section-title">ЖИВОЙ РЕЙТИНГ — КАЖДЫЙ ТУРНИР МЕНЯЕТ ТАБЛИЦУ</h2>
          <p className="why-text">
            Рейтинг считается автоматически после каждого соревнования.
            Учитывается значимость турнира, количество боёв и занятое место.
            Честно, прозрачно, без ручного вмешательства.
            Каждый соревнуется в своей возрастной категории: 6–7, 8–9, 10–11, 12–14, 15–17 лет.
          </p>
          <div className="why-rating-mock">
            <div className="why-rating-header">
              <span>Место</span>
              <span>Спортсмен</span>
              <span>Возраст</span>
              <span>Очки</span>
            </div>
            {RATING_MOCK.map(r => (
              <div key={r.place} className={`why-rating-row ${r.cls}`}>
                <span className="why-place">{r.place}</span>
                <span>{r.name}</span>
                <span>{r.age} лет</span>
                <span>{r.points}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* БЛОК 5: ЗАЛ СЛАВЫ */}
      <section className="why-section why-section--dark why-fade-in">
        <div className="container">
          <p className="section-label">Признание</p>
          <h2 className="why-section-title">ЛУЧШИЕ ПОЛУЧАЮТ ПРИЗНАНИЕ</h2>
          <p className="why-text">
            Каждый сезон (сентябрь–август) лучшие спортсмены по рейтингу и ачивкам
            в каждой возрастной категории занимают место в Зале Славы клуба.
            Их фото и достижения — на сайте весь сезон.
            Новый сезон — новые герои, новые цели.
          </p>
          <p className="why-hook">
            Родители приводят друзей посмотреть на фото своего ребёнка на сайте клуба.
          </p>
          <div style={{ marginTop: 24 }}>
            <Link
              to="/champions"
              className="btn-primary"
              style={{
                padding: '12px 32px',
                fontSize: '1rem',
                fontFamily: 'Bebas Neue',
                letterSpacing: '0.1em',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Зал Славы →
            </Link>
          </div>
        </div>
      </section>

      {/* БЛОК 6: ПРОЗРАЧНОСТЬ */}
      <section className="why-section why-fade-in">
        <div className="container">
          <p className="section-label">Для родителей</p>
          <h2 className="why-section-title">ВЫ ВСЕГДА ЗНАЕТЕ ЧТО ПРОИСХОДИТ</h2>
          <div className="why-features-grid">
            {FEATURES.map(f => (
              <div key={f.title} className="why-feature-card">
                <h4>{f.title}</h4>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* БЛОК 7: ФИНАЛЬНЫЙ CTA */}
      <section className="why-cta">
        <div className="container">
          <h2 className="why-cta-title">ПЕРВОЕ ЗАНЯТИЕ — БЕСПЛАТНО</h2>
          <p className="why-cta-sub">Запишитесь прямо сейчас — убедитесь сами.</p>
          <Link
            to="/apply"
            className="btn-primary"
            style={{
              padding: '16px 48px',
              fontSize: '1.3rem',
              fontFamily: 'Bebas Neue',
              letterSpacing: '0.1em',
              textDecoration: 'none',
              display: 'inline-block',
              marginTop: 8,
            }}
          >
            ЗАПИСАТЬСЯ
          </Link>
        </div>
      </section>
    </>
  )
}
