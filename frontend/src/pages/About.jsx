import { useState } from 'react'
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

about: (
  <div className="about-body">

    <div className="about-lead">
      <p>Мы — официально зарегистрированная автономная некоммерческая организация</p>
      <p className="about-lead-name">Спортивный клуб тхэквондо «Тайпан» города Павловский Посад</p>
      <p>
        Здесь ваш ребёнок не просто «ходит на секцию». Здесь он растёт как личность:
        становится сильнее телом, увереннее характером и чище душой.
      </p>
      <p>
        Мы работаем полностью в правовом поле — у нас есть устав, свидетельство о государственной
        регистрации, ОГРН и все необходимые документы. Клуб создан не ради прибыли, а ради детей и спорта.
      </p>
    </div>

    <h3>Кто стоит за клубом</h3>
    <p>
      Клубом руководит и лично тренирует <strong>Ротарь Екатерина Валерьевна</strong> — мастер тхэквондо,
      опытный тренер и мама, которая понимает родителей с полуслова.
    </p>
    <p>
      Она решает все организационные и финансовые вопросы, отвечает за безопасность на каждой тренировке
      и следит, чтобы в клубе всегда была честная и уважительная атмосфера. Как тренер она проводит
      занятия, готовит спортсменов к аттестациям и соревнованиям, поддерживает каждого ребёнка и
      помогает ему раскрыться.
    </p>
    <p>
      Вы всегда можете написать или позвонить Екатерине Валерьевне — она отвечает лично и без «секретарей».
    </p>

    <h3>Дух тхэквондо — это главное, чему мы учим</h3>
    <p>
      Тхэквондо для нас — это не только удары и пояса. Это целая система воспитания личности.
    </p>
    <div className="about-quote">
      <p>
        «Тхэквондо — это путь физического, умственного и духовного развития человека, целью которого
        является формирование гармоничной личности с высокими моральными качествами».
      </p>
      <span>— Генерал Чой Хонг Хи, основатель тхэквондо</span>
    </div>
    <p>Именно эти ценности мы закладываем в каждого ученика. На тренировках и в повседневной жизни мы живём по пяти принципам тхэквондо:</p>

    <div className="about-principles">
      <div className="about-principle">
        <span className="about-principle-num">01</span>
        <div>
          <strong>Почтительность</strong>
          <p>Вежливость и уважение к старшим, тренеру, партнёрам</p>
        </div>
      </div>
      <div className="about-principle">
        <span className="about-principle-num">02</span>
        <div>
          <strong>Честность</strong>
          <p>Быть правдивым с собой и другими</p>
        </div>
      </div>
      <div className="about-principle">
        <span className="about-principle-num">03</span>
        <div>
          <strong>Настойчивость и терпение</strong>
          <p>Не сдаваться даже когда тяжело</p>
        </div>
      </div>
      <div className="about-principle">
        <span className="about-principle-num">04</span>
        <div>
          <strong>Самообладание и самоконтроль</strong>
          <p>Контролировать эмоции и тело</p>
        </div>
      </div>
      <div className="about-principle">
        <span className="about-principle-num">05</span>
        <div>
          <strong>Неукротимый Дух</strong>
          <p>Внутренняя сила и воля побеждать трудности</p>
        </div>
      </div>
    </div>
    <p>Эти принципы работают не только в зале. Они помогают детям в школе, в общении с друзьями и в жизни.</p>

    <h3>Откуда у клуба деньги</h3>
    <p>
      Клуб существует на средства, которые идут исключительно на развитие и детей.
      Прибыль не распределяется — это некоммерческая организация. Деньги поступают из:
    </p>
    <ul>
      <li>абонементов и оплаты тренировок (по договору оказания услуг)</li>
      <li>целевых взносов родителей — на пояса, соревнования, форму, сборы и поездки</li>
      <li>добровольных пожертвований и спонсорской помощи</li>
      <li>грантов и программ поддержки спорта</li>
    </ul>
    <p>Всё прозрачно. Родители всегда могут узнать, на что именно потрачены средства.</p>

    <h3>Почему мы — официальный клуб</h3>
    <p>
      Мы входим в структуру <strong>Федерации тхэквондо ГТФ России</strong>. Это значит:
    </p>
    <ul>
      <li>проводим официальные аттестации — пояса и сертификаты признаются по всей России и за рубежом</li>
      <li>наши спортсмены участвуют в официальных соревнованиях всех уровней</li>
      <li>получаем методическую поддержку, судей и развитие от федерации</li>
    </ul>

    <h3>Почему родителям спокойно с нами</h3>
    <p>
      Мы не просто тренируем удары ногами. Мы воспитываем характер. Здесь ребёнок учится уважать
      себя и других, не сдаваться, контролировать эмоции и идти к цели.
    </p>
    <p>
      Мы открыты для общения, всегда готовы ответить на вопросы и объяснить, почему делаем именно
      так. Но при этом просим одно — доверять. Мы работаем с детьми каждый день, видим их прогресс
      и знаем, как помочь каждому стать лучше.
    </p>
    <div className="about-cta">
      Если вы ищете для ребёнка не просто секцию, а место, где его вырастят сильным и достойным
      человеком — добро пожаловать в «Тайпан».
    </div>

  </div>
),

emblem: null,
members: null,
structure: null,
attestation: null,
camps: null,
family: null,
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

        <div className="about-content">
          <h2 className="about-section-title">{section.title}</h2>
          <div className="about-divider" />

          {active === 'emblem' && CONTENT.emblem === null && (
            <div className="about-emblem-preview">
              <img src="/logo.png" alt="Эмблема клуба Тайпан" className="about-emblem-img" />
              <div className="about-coming" style={{ marginTop: '24px' }}>
                <p>Описание эмблемы в разработке.</p>
              </div>
            </div>
          )}

          {active !== 'emblem' && CONTENT[active] === null && (
            <div className="about-coming">
              <p>Раздел находится в разработке.</p>
              <p>Скоро здесь появится подробная информация.</p>
            </div>
          )}

          {CONTENT[active] !== null && active !== 'emblem' && CONTENT[active]}
        </div>
      </div>
    </main>
  )
}
