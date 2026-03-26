// frontend/src/pages/Antidoping.jsx
// Страница антидопинга — документы и ссылки ФТР ГТФ России

import { Link } from 'react-router-dom'
import './About.css'   // переиспользуем общие стили страниц

const DOCUMENTS = [
  {
    title: 'Запрещённый список 2026',
    desc: 'Актуальный список запрещённых субстанций и методов ВАДА',
    url: 'https://rusgtf.ru/wp-content/uploads/2025/12/Запрещенный-список-2026.pdf',
  },
  {
    title: 'Обзор изменений в Запрещённый список 2026',
    desc: 'Что нового по сравнению с предыдущим годом',
    url: 'https://rusgtf.ru/wp-content/uploads/2025/12/Обзор-основных-изменений-в-Запрещённый-список-2026.pdf',
  },
  {
    title: 'Разрешённый список 2026 (версия 8.0)',
    desc: 'Список препаратов, разрешённых ФМБА',
    url: 'https://rusgtf.ru/wp-content/uploads/2026/02/Разрешенный-список-ФМБА-2026.pdf',
  },
  {
    title: 'Антидопинговые правила ФТР ГТФ',
    desc: 'Официальные правила федерации по антидопингу',
    url: 'https://rusgtf.ru/wp-content/uploads/2025/12/Антидопинговые-правила.pdf',
  },
  {
    title: 'Всемирный антидопинговый кодекс',
    desc: 'Кодекс ВАДА 2020 года (действующая редакция)',
    url: 'https://rusgtf.ru/wp-content/uploads/2021/01/Всемирный-антидопинговый-кодекс_А5_2020-preview7_compressed.pdf',
  },
  {
    title: 'Федеральный закон № 329-ФЗ',
    desc: 'О физической культуре и спорте в Российской Федерации',
    url: 'https://rusgtf.ru/wp-content/uploads/2021/01/ФЗ-329.pdf',
  },
  {
    title: 'Антидопинг. Важные факты',
    desc: 'Краткая памятка с основными понятиями и принципами',
    url: 'https://rusgtf.ru/wp-content/uploads/2025/12/Антидопинг.-Важные-факты-и-основные-моменты.pdf',
  },
  {
    title: 'Важные вопросы о допинге',
    desc: 'Ответы на часто задаваемые вопросы спортсменов',
    url: 'https://rusgtf.ru/wp-content/uploads/2025/12/Важные-вопросы-о-допинге.pdf',
  },
  {
    title: 'Процедура допинг-контроля',
    desc: 'Как проходит допинг-контроль: шаг за шагом',
    url: 'https://rusgtf.ru/wp-content/uploads/2025/12/Процедура-допинг-контроля.pdf',
  },
  {
    title: 'Программа мониторинга 2026',
    desc: 'Субстанции под наблюдением (не запрещены, но мониторируются)',
    url: 'https://rusgtf.ru/wp-content/uploads/2025/12/Программа-мониторинга-2026.pdf',
  },
]

const MEMOS = [
  {
    title: 'Памятка для спортсменов',
    desc: 'Права спортсмена при допинг-контроле',
    url: 'https://rusgtf.ru/wp-content/uploads/2025/12/Памятка-по-правам-спортсменов.pdf',
  },
  {
    title: 'Памятка для родителей',
    desc: 'Что должны знать родители спортсмена',
    url: 'https://rusgtf.ru/wp-content/uploads/2025/12/Памятка-для-родителей.pdf',
  },
  {
    title: 'Памятка для родителей — соревнования',
    desc: 'Подготовка к соревнованиям и сборам',
    url: 'https://rusgtf.ru/wp-content/uploads/2025/12/Памятка-для-родителей-по-подготовке-к-соревнованиям-и-сборам.pdf',
  },
  {
    title: 'Памятка для тренеров',
    desc: 'Обязанности тренера в области антидопинга',
    url: 'https://rusgtf.ru/wp-content/uploads/2025/12/Памятка-для-тренеров.pdf',
  },
  {
    title: 'Образовательная антидопинговая стратегия ФТР ГТФ',
    desc: 'Программа образовательной работы федерации',
    url: 'https://rusgtf.ru/wp-content/uploads/2025/12/ОБРАЗОВАТЕЛЬНАЯ-АНТИДОПИНГОВАЯ-СТРАТЕГИЯ-ФТР-ГТФ.pdf',
  },
]

function DocCard({ title, desc, url }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 16,
        padding: '16px 20px', background: 'var(--dark)',
        textDecoration: 'none', transition: 'background 0.2s',
        borderBottom: '1px solid var(--gray-dim)'
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--dark2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--dark)'}
    >
      {/* Иконка PDF */}
      <div style={{
        flexShrink: 0, width: 36, height: 36,
        background: 'rgba(204,0,0,0.15)', borderRadius: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
          <polyline points="10 9 9 9 8 9"/>
        </svg>
      </div>
      <div>
        <div style={{
          fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.92rem',
          letterSpacing: '0.04em', color: 'var(--white)', marginBottom: 3
        }}>{title}</div>
        <div style={{ color: 'var(--gray)', fontSize: '0.82rem' }}>{desc}</div>
      </div>
      {/* Стрелка */}
      <div style={{ marginLeft: 'auto', color: 'var(--red)', flexShrink: 0, paddingTop: 2 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
      </div>
    </a>
  )
}

export default function Antidoping() {
  return (
    <main style={{ background: 'var(--black)', minHeight: '100vh' }}>

      {/* Шапка */}
      <section style={{ padding: '80px 0 40px', background: 'var(--dark)' }}>
        <div className="container">
          <p className="section-label">ФТР ГТФ России</p>
          <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 'clamp(48px, 8vw, 96px)', letterSpacing: '6px', color: 'var(--white)', margin: '0 0 12px' }}>
            АНТИДОПИНГ
          </h1>
          <div className="divider" />
          <p style={{ color: 'var(--gray)', fontSize: '1rem', lineHeight: 1.7, maxWidth: 640, marginTop: 16 }}>
            Чистый спорт — фундамент честной конкуренции. Федерация тхэквондо ГТФ России ведёт системную
            работу по антидопинговому просвещению спортсменов, тренеров и родителей.
          </p>
        </div>
      </section>

      <div className="container" style={{ padding: '40px 24px' }}>

        {/* Горячие ссылки */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 2, marginBottom: 40 }}>
          <a
            href="http://list.rusada.ru/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'var(--red)', color: 'var(--white)', padding: '20px 24px',
              textDecoration: 'none', transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#aa0000'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--red)'}
          >
            <div style={{ fontFamily: 'Bebas Neue', fontSize: '1.2rem', letterSpacing: '0.06em', marginBottom: 4 }}>
              Проверка препаратов РУСАДА
            </div>
            <div style={{ fontSize: '0.82rem', opacity: 0.85 }}>
              list.rusada.ru — проверьте любой препарат перед применением
            </div>
          </a>
          <a
            href="https://www.rusada.ru/education/online-training/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'var(--dark)', color: 'var(--white)', padding: '20px 24px',
              textDecoration: 'none', border: '1px solid var(--gray-dim)', transition: 'border-color 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--red)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--gray-dim)'}
          >
            <div style={{ fontFamily: 'Bebas Neue', fontSize: '1.2rem', letterSpacing: '0.06em', marginBottom: 4 }}>
              Онлайн-обучение РУСАДА
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--gray)' }}>
              rusada.ru — портал образования, тесты, курсы для спортсменов
            </div>
          </a>
          <a
            href="https://rusgtf.ru/antidoping/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'var(--dark)', color: 'var(--white)', padding: '20px 24px',
              textDecoration: 'none', border: '1px solid var(--gray-dim)', transition: 'border-color 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--red)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--gray-dim)'}
          >
            <div style={{ fontFamily: 'Bebas Neue', fontSize: '1.2rem', letterSpacing: '0.06em', marginBottom: 4 }}>
              Антидопинг ФТР ГТФ
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--gray)' }}>
              rusgtf.ru — официальная страница антидопингового комитета федерации
            </div>
          </a>
        </div>

        {/* Горячая линия */}
        <div style={{
          background: 'var(--dark)', borderLeft: '3px solid var(--red)',
          padding: '16px 20px', marginBottom: 40
        }}>
          <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 8 }}>
            Горячая линия РУСАДА
          </div>
          <div style={{ color: 'var(--gray)', fontSize: '0.9rem', lineHeight: 1.7 }}>
            По вопросам антидопинга звоните на горячую линию РУСАДА:&nbsp;
            <a href="tel:+74992717761" style={{ color: 'var(--white)', textDecoration: 'none' }}>
              +7 (499) 271-77-61
            </a>
          </div>
        </div>

        {/* Документы */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'Bebas Neue', fontSize: '1.6rem', letterSpacing: '0.06em', color: 'var(--white)', marginBottom: 4 }}>
            Документы
          </h2>
          <p style={{ color: 'var(--gray)', fontSize: '0.88rem', marginBottom: 16 }}>
            Актуальные документы антидопингового комитета ФТР ГТФ России
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {DOCUMENTS.map(doc => <DocCard key={doc.title} {...doc} />)}
          </div>
        </div>

        {/* Памятки */}
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ fontFamily: 'Bebas Neue', fontSize: '1.6rem', letterSpacing: '0.06em', color: 'var(--white)', marginBottom: 4 }}>
            Памятки
          </h2>
          <p style={{ color: 'var(--gray)', fontSize: '0.88rem', marginBottom: 16 }}>
            Для спортсменов, родителей и тренеров
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {MEMOS.map(doc => <DocCard key={doc.title} {...doc} />)}
          </div>
        </div>

        {/* Контакты антидопингового комитета */}
        <div style={{ background: 'var(--dark)', border: '1px solid var(--gray-dim)', padding: '24px 28px' }}>
          <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 14 }}>
            Антидопинговый комитет ФТР ГТФ
          </div>
          <div style={{ color: 'var(--gray)', fontSize: '0.9rem', lineHeight: 1.8 }}>
            <div><strong style={{ color: 'var(--white)' }}>Председатель:</strong> Мирзоев Гамид Коммунарович</div>
            <div>тел. <a href="tel:+79163574511" style={{ color: 'var(--gray)' }}>8 916 357 45 11</a></div>
            <div style={{ marginTop: 10 }}><strong style={{ color: 'var(--white)' }}>Ответственная за взаимодействие с Минспортом:</strong> Халилова Лейсан Рякибовна</div>
            <div>тел. <a href="tel:+79033051080" style={{ color: 'var(--gray)' }}>8 903 305 10 80</a></div>
          </div>
        </div>

        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <Link to="/" className="btn-outline">На главную</Link>
        </div>

      </div>
    </main>
  )
}
