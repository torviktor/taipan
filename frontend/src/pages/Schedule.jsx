import { Link } from 'react-router-dom'
import './Schedule.css'

const SCHEDULE = [
  {
    group: 'Младшая группа',
    age:   '6–10 лет',
    color: 'junior',
    days: [
      { day: 'Вторник / Четверг', time: '17:30 – 19:00' },
      { day: 'Суббота',           time: '11:30 – 13:00' },
    ],
  },
  {
    group: 'Старшая группа',
    age:   '10–18+ лет',
    color: 'senior',
    days: [
      { day: 'Вторник / Четверг', time: '19:00 – 21:00' },
      { day: 'Суббота',           time: '13:00 – 15:00' },
    ],
  },
]

const DAYS_GRID = [
  { label: 'Пн', key: 'mon' },
  { label: 'Вт', key: 'tue' },
  { label: 'Ср', key: 'wed' },
  { label: 'Чт', key: 'thu' },
  { label: 'Пт', key: 'fri' },
  { label: 'Сб', key: 'sat' },
  { label: 'Вс', key: 'sun' },
]

// Какие дни активны для каждой группы
const ACTIVE_DAYS = {
  junior: ['tue', 'thu', 'sat'],
  senior: ['tue', 'thu', 'sat'],
}

export default function Schedule() {
  return (
    <main className="schedule-page">

      <section className="schedule-hero">
        <div className="container">
          <p className="section-label">Тренировки</p>
          <h1 className="schedule-title">РАСПИСАНИЕ</h1>
          <div className="divider" />
          <p className="schedule-sub">
            Зал: г. Павловский Посад, ул. Кирова, 95
          </p>
        </div>
      </section>

      <section className="schedule-body">
        <div className="container">

          {/* Карточки групп */}
          <div className="schedule-cards">
            {SCHEDULE.map((s, i) => (
              <div className={`schedule-card schedule-card--${s.color}`} key={i}>
                <div className="schedule-card-header">
                  <div className="schedule-card-num">{String(i + 1).padStart(2, '0')}</div>
                  <div>
                    <h2 className="schedule-card-title">{s.group}</h2>
                    <p className="schedule-card-age">{s.age}</p>
                  </div>
                </div>

                {/* Дни недели — визуальная полоса */}
                <div className="schedule-days-row">
                  {DAYS_GRID.map(d => (
                    <div
                      key={d.key}
                      className={`schedule-day-pill ${ACTIVE_DAYS[s.color].includes(d.key) ? 'active' : ''}`}
                    >
                      {d.label}
                    </div>
                  ))}
                </div>

                {/* Расписание по дням */}
                <div className="schedule-times">
                  {s.days.map((row, j) => (
                    <div className="schedule-time-row" key={j}>
                      <span className="schedule-time-day">{row.day}</span>
                      <span className="schedule-time-val">{row.time}</span>
                    </div>
                  ))}
                </div>

                <div className="schedule-card-footer">
                  <Link to="/apply" className="btn-primary">Записаться</Link>
                </div>
              </div>
            ))}
          </div>

          {/* Доп. инфо */}
          <div className="schedule-note">
            <div className="schedule-note-item">
              <span>📍</span>
              <div>
                <strong>Адрес зала</strong>
                <p>Павловский Посад, ул. Кирова, 95</p>
              </div>
            </div>
            <div className="schedule-note-item">
              <span>📞</span>
              <div>
                <strong>Запись и вопросы</strong>
                <p><a href="tel:+79091652800">+7 (909) 165-28-00</a></p>
              </div>
            </div>
            <div className="schedule-note-item">
              <span>🥋</span>
              <div>
                <strong>Первое занятие</strong>
                <p>Бесплатно для новых участников</p>
              </div>
            </div>
          </div>

        </div>
      </section>

    </main>
  )
}
