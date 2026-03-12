import { Link } from 'react-router-dom'
import './GroupKids1.css'

export default function GroupKids2() {
  return (
    <main className="group-page">
      <section className="group-hero">
        <div className="container">
          <p className="section-label">Программа подготовки</p>
          <h1 className="group-title">ДЕТИ 11–16 ЛЕТ</h1>
          <p className="group-subtitle">Спортивная специализация, тактика, соревнования</p>
          <div className="divider" />
        </div>
      </section>

      <div className="container group-container">

        <div className="group-intro">
          <p>
            Этот этап является <strong>учебно-тренировочным (этапом спортивной специализации)</strong>.
            В возрасте 11–16 лет происходит переход от освоения основ к углублённому изучению техники
            и тактики поединка, формированию индивидуального стиля и активной соревновательной практике.
          </p>
        </div>

        <h2 className="group-section-title">Ключевые направления тренировочного процесса</h2>

        <div className="group-directions">

          <div className="group-direction">
            <div className="group-direction-num">01</div>
            <div className="group-direction-body">
              <h3>Спарринговая подготовка (Массоги)</h3>
              <p>
                Основной акцент смещается на <strong>свободный спарринг (джаю массоги)</strong>.
                Ученики осваивают сложные тактические модели: управление дистанцией, маневрирование
                (степы), использование финтов и «пассивных раскрытий» для провокации соперника.
              </p>
              <p>
                Особое внимание уделяется контратакующим действиям и умению мгновенно переходить
                от защиты к нападению. Поединки проводятся в полной защитной экипировке
                с использованием электронной системы судейства.
              </p>
            </div>
          </div>

          <div className="group-direction">
            <div className="group-direction-num">02</div>
            <div className="group-direction-body">
              <h3>Психологическая устойчивость и «Восточная психогогика»</h3>
              <p>
                На этом этапе формируется мотивация спортивного достижения. Мы обучаем методам
                саморегуляции и медитации для достижения состояния «не-сознания» — когда боец
                действует на уровне отточенных рефлексов, сохраняя хладнокровие в экстремальной
                ситуации боя.
              </p>
              <p>
                Воспитывается <strong>«неукротимый дух»</strong> и способность преодолевать стресс
                соревновательной деятельности.
              </p>
            </div>
          </div>

          <div className="group-direction">
            <div className="group-direction-num">03</div>
            <div className="group-direction-body">
              <h3>Специальная физическая подготовка (СФП)</h3>
              <p>
                Тренировки становятся более интенсивными и направлены на развитие взрывной силы,
                скоростной выносливости и координации. В программу входят упражнения на «закачку»
                мышечного корсета и достижение предельной амплитуды движений — продвинутый стретчинг
                для нанесения мощных ударов в прыжках и с разворота.
              </p>
            </div>
          </div>

          <div className="group-direction">
            <div className="group-direction-num">04</div>
            <div className="group-direction-body">
              <h3>Техническое совершенствование (Хъёнг / Туль)</h3>
              <p>
                Продолжается изучение сложных формальных комплексов, соответствующих квалификации —
                от синего до чёрного пояса. На этом уровне важно не просто повторение движений,
                а понимание <strong>«теории мощности»</strong>, контроль дыхания и безупречный баланс.
              </p>
            </div>
          </div>

          <div className="group-direction">
            <div className="group-direction-num">05</div>
            <div className="group-direction-body">
              <h3>Участие в официальных турнирах</h3>
              <p>
                Спортсмены этой возрастной группы (кадеты и юниоры) участвуют в региональных
                и всероссийских соревнованиях, разделяясь по весовым категориям. Это позволяет
                выполнить нормативы на спортивные разряды и подготовиться к переходу
                в категорию «взрослые».
              </p>
            </div>
          </div>

        </div>

        <div className="group-result">
          Программа обеспечивает комплексное развитие атлета, превращая тхэквондо из спортивного
          увлечения в стиль жизни — формируя сильную, дисциплинированную и уверенную в себе личность.
        </div>

        <div className="group-schedule-block">
          <h3>Расписание группы</h3>
          <div className="group-schedule-rows">
            <div className="group-schedule-row">
              <span className="group-schedule-day">Вторник, Четверг</span>
              <span className="group-schedule-time">19:00 — 21:00</span>
            </div>
            <div className="group-schedule-row">
              <span className="group-schedule-day">Суббота</span>
              <span className="group-schedule-time">13:00 — 15:00</span>
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
