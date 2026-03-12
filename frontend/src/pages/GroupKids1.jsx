import { Link } from 'react-router-dom'
import './GroupKids1.css'

export default function GroupKids1() {
  return (
    <main className="group-page">
      <section className="group-hero">
        <div className="container">
          <p className="section-label">Программа подготовки</p>
          <h1 className="group-title">ДЕТИ 6–10 ЛЕТ</h1>
          <p className="group-subtitle">Базовая техника, дисциплина, координация</p>
          <div className="divider" />
        </div>
      </section>

      <div className="container group-container">

        <div className="group-intro">
          <p>
            Этот возрастной период является <strong>развивающим и адаптационным</strong>,
            закладывающим фундамент для будущего спортивного мастерства. Наша программа
            для детей 6–10 лет ориентирована на всестороннее гармоничное развитие,
            укрепление здоровья и формирование интереса к регулярным занятиям спортом.
          </p>
        </div>

        <h2 className="group-section-title">Ключевые направления тренировочного процесса</h2>

        <div className="group-directions">

          <div className="group-direction">
            <div className="group-direction-num">01</div>
            <div className="group-direction-body">
              <h3>Игровая методика и развитие координации</h3>
              <p>
                Для младших учеников основным является <strong>игровой метод обучения</strong>.
                Через специализированные игровые комплексы дети развивают ловкость, чувство ритма
                и дистанции, а также учатся взаимодействию в команде. Это позволяет сформировать
                необходимые двигательные навыки в «здоровьесберегающем» режиме, избегая
                преждевременных стрессовых нагрузок.
              </p>
            </div>
          </div>

          <div className="group-direction">
            <div className="group-direction-num">02</div>
            <div className="group-direction-body">
              <h3>Дисциплина и этикет</h3>
              <p>
                С самых первых занятий ученики погружаются в атмосферу тхэквондо-среды, где важную
                роль играет соблюдение правил этикета и пяти принципов тхэквондо:
                почтительности, честности, настойчивости, самообладания и неукротимого духа.
                Тхэквондо — это не просто спорт, а путь духовного воспитания, формирующий волевые
                качества и уважение к старшим.
              </p>
            </div>
          </div>

          <div className="group-direction">
            <div className="group-direction-num">03</div>
            <div className="group-direction-body">
              <h3>Освоение базовой техники</h3>
              <p>
                Обучение начинается с постановки правильной осанки и изучения основных стоек (соги),
                перемещений (степов) и базовых ударов. В программу входят подготовительные комплексы:
              </p>
              <ul className="group-list">
                <li><strong>Сачжу Чируги</strong> — удары в четыре стороны</li>
                <li><strong>Сачжу Макги</strong> — защита в четыре стороны</li>
              </ul>
              <p>
                Особое внимание уделяется <strong>культуре дыхания</strong>, от которой напрямую
                зависит сила удара, выносливость и координация движений.
              </p>
            </div>
          </div>

          <div className="group-direction">
            <div className="group-direction-num">04</div>
            <div className="group-direction-body">
              <h3>Общая физическая подготовка (ОФП)</h3>
              <p>
                Занятия включают упражнения на развитие гибкости (шпагаты), прыгучести
                и укрепление основных мышечных групп.
              </p>
            </div>
          </div>

        </div>

        <div className="group-result">
          Программа обеспечивает плавный переход от игры к систематическим тренировкам,
          создавая надёжную базу для перехода на учебно-тренировочный этап
          и участия в первых соревнованиях.
        </div>

        <div className="group-schedule-block">
          <h3>Расписание группы</h3>
          <div className="group-schedule-rows">
            <div className="group-schedule-row">
              <span className="group-schedule-day">Вторник, Четверг</span>
              <span className="group-schedule-time">17:30 — 19:00</span>
            </div>
            <div className="group-schedule-row">
              <span className="group-schedule-day">Суббота</span>
              <span className="group-schedule-time">11:30 — 13:00</span>
            </div>
          </div>
          <Link to="/apply" className="btn-primary" style={{display:'inline-block', marginTop:'24px'}}>
            Записаться в группу
          </Link>
        </div>

      </div>
    </main>
  )
}
