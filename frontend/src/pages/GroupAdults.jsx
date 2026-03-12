import { Link } from 'react-router-dom'
import './GroupKids1.css'

export default function GroupAdults() {
  return (
    <main className="group-page">
      <section className="group-hero">
        <div className="container">
          <p className="section-label">Программа подготовки</p>
          <h1 className="group-title">ВЗРОСЛЫЕ 18+</h1>
          <p className="group-subtitle">Боевое тхэквондо, самозащита, стиль жизни</p>
          <div className="divider" />
        </div>
      </section>

      <div className="container group-container">

        <div className="group-intro">
          <p>
            Для взрослых тхэквондо — это не просто спорт, а <strong>научно обоснованный способ
            использования своего тела</strong>, образ мышления и стиль жизни. Программа разработана
            так, чтобы быть одинаково эффективной как для молодых людей, так и для лиц старшего
            возраста, независимо от начальной физической формы.
          </p>
        </div>

        <h2 className="group-section-title">Ключевые направления тренировочного процесса</h2>

        <div className="group-directions">

          <div className="group-direction">
            <div className="group-direction-num">01</div>
            <div className="group-direction-body">
              <h3>Оздоровительный аспект и фитнес-эффект</h3>
              <p>
                Тхэквондо является мощным средством укрепления здоровья: интенсивные тренировки
                создают аэробный эффект, улучшают работу сердца, лёгких и нормализуют вес тела
                (сжигается около <strong>600 калорий в час</strong>). Занятия способствуют развитию
                «змеиной» тонкой мускулатуры, повышают гибкость и общую работоспособность организма.
              </p>
            </div>
          </div>

          <div className="group-direction">
            <div className="group-direction-num">02</div>
            <div className="group-direction-body">
              <h3>Боевое тхэквондо и самозащита (Хосинсуль)</h3>
              <p>
                Основной упор для взрослых делается на прикладной аспект — <strong>искусство
                самообороны без оружия</strong>. Ученики осваивают технику нейтрализации агрессора,
                используя его же силу, изучают уязвимые точки тела (купсо) и методы освобождения
                от захватов.
              </p>
              <p>
                Обучение включает работу с «теорией мощности», позволяющей даже физически более
                слабому человеку нанести сокрушительный удар за счёт биомеханики и концентрации.
              </p>
            </div>
          </div>

          <div className="group-direction">
            <div className="group-direction-num">03</div>
            <div className="group-direction-body">
              <h3>Психоэмоциональная разгрузка и медитация</h3>
              <p>
                В условиях современного стресса тхэквондо помогает очистить сознание. Мы используем
                методы восточной психогогики и медитации — пассивной и активной, — которые позволяют
                переключиться с повседневных забот, развить самообладание и обрести уверенность
                в себе.
              </p>
              <p>
                Тхэквондо воспитывает <strong>«неукротимый дух»</strong>, помогающий справляться
                с любыми жизненными трудностями.
              </p>
            </div>
          </div>

          <div className="group-direction">
            <div className="group-direction-num">04</div>
            <div className="group-direction-body">
              <h3>Поэтапное обучение для всех уровней</h3>
              <ul className="group-list">
                <li><strong>Новички</strong> начинают с «Первого курса»: освоение базовых стоек (соги), культуры дыхания и простых технических комплексов.</li>
                <li><strong>Продвинутые ученики</strong> переходят к изучению сложных форм (туль / хъёнг), спаррингам (массоги) и технике разбивания предметов (кёкпа / вирек) — высшему тесту на точность и силу.</li>
              </ul>
            </div>
          </div>

          <div className="group-direction">
            <div className="group-direction-num">05</div>
            <div className="group-direction-body">
              <h3>Дисциплина и этикет</h3>
              <p>
                Даже во «взрослых» группах соблюдаются строгие традиции: уважение к инструктору,
                чистота формы (добок) и соблюдение пяти принципов тхэквондо.
              </p>
            </div>
          </div>

        </div>

        <div className="group-result">
          Программа позволяет каждому найти свой путь в тхэквондо: от поддержания отличной
          физической формы и снятия стресса — до достижения уровня чёрного пояса и глубокого
          постижения боевого искусства.
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
