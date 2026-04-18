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

const MOCK_RATING = [
  { place: 1, name: 'Соколов Артём',   age: 11, ageGroup: '10-11', group: 'Старшая группа (11+)',       gup: 7,  weight: '34 кг', sex: 'М', tournaments: 6, rating: 68.42 },
  { place: 2, name: 'Лебедев Никита',  age: 10, ageGroup: '10-11', group: 'Старшая группа (11+)',       gup: 8,  weight: '32 кг', sex: 'М', tournaments: 5, rating: 51.18 },
  { place: 3, name: 'Фролова Диана',   age: 9,  ageGroup: '8-9',   group: 'Младшая группа (6-10 лет)', gup: 9,  weight: '28 кг', sex: 'Ж', tournaments: 4, rating: 38.75 },
  { place: 4, name: 'Морозов Даниил',  age: 12, ageGroup: '12-14', group: 'Старшая группа (11+)',       gup: 6,  weight: '41 кг', sex: 'М', tournaments: 5, rating: 27.33 },
  { place: 5, name: 'Захарова Полина', age: 8,  ageGroup: '8-9',   group: 'Младшая группа (6-10 лет)', gup: 10, weight: '24 кг', sex: 'Ж', tournaments: 3, rating: 19.60 },
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
              <span>Группа</span>
              <span>Гып</span>
              <span>Вес</span>
              <span>Пол</span>
              <span>Турниров</span>
              <span>Рейтинг</span>
            </div>
            {MOCK_RATING.map(r => {
              const cls = r.place === 1 ? 'why-rating-row--gold' : r.place === 3 ? 'why-rating-row--bronze' : ''
              return (
                <div key={r.place} className={`why-rating-row ${cls}`}>
                  <span className="why-place">{r.place}</span>
                  <span>{r.name}</span>
                  <div>
                    <div>{r.age} лет</div>
                    <div className="why-rating-age-group">{r.ageGroup}</div>
                  </div>
                  <span className="why-rating-secondary">{r.group}</span>
                  <span>{r.gup}</span>
                  <span className="why-rating-secondary">{r.weight}</span>
                  <span className="why-rating-secondary">{r.sex}</span>
                  <span>{r.tournaments}</span>
                  <span className="why-rating-score">{r.rating.toFixed(2)}</span>
                </div>
              )
            })}
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
