// frontend/src/pages/EquipmentTab.jsx
// Вкладка «Экипировка» — ссылка на магазин Fortek Sport

export default function EquipmentTab() {

  const InfoBlock = ({ title, children }) => (
    <div style={{
      background: 'var(--dark)', borderLeft: '3px solid var(--red)',
      padding: '16px 20px', marginBottom: 12
    }}>
      <div style={{
        fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.78rem',
        letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 8
      }}>{title}</div>
      <div style={{ color: 'var(--gray)', fontSize: '0.9rem', lineHeight: 1.7 }}>{children}</div>
    </div>
  )

  return (
    <div style={{ padding: '0 0 40px' }}>

      {/* Заголовок */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '1.8rem', letterSpacing: '0.06em', color: 'var(--white)', marginBottom: 4 }}>
          Экипировка
        </div>
        <div style={{ color: 'var(--gray)', fontSize: '0.88rem', lineHeight: 1.6 }}>
          Рекомендованный магазин спортивной экипировки для тхэквондо ГТФ.
        </div>
      </div>

      {/* Главный баннер — Fortek Sport */}
      <div style={{
        background: 'var(--dark)', border: '1px solid var(--gray-dim)',
        padding: '28px 32px', marginBottom: 24,
        borderTop: '3px solid var(--red)'
      }}>
        <div style={{
          fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.5rem',
          letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--white)', marginBottom: 8
        }}>
          Fortek Sport
        </div>
        <div style={{ color: 'var(--gray)', fontSize: '0.92rem', lineHeight: 1.7, marginBottom: 20 }}>
          Специализированный магазин экипировки и инвентаря для тхэквондо. Доги, защитные шлемы,
          жилеты, перчатки, футы, щитки, экипировка для туль — всё необходимое для тренировок
          и соревнований.
        </div>
        <a
          href="https://fortek-sport.ru/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            background: 'var(--red)', color: 'var(--white)',
            fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.95rem',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '12px 28px', textDecoration: 'none',
            transition: 'background 0.2s'
          }}
        >
          Перейти в магазин
        </a>
      </div>

      {/* Что нужно для тренировок */}
      <InfoBlock title="Базовая экипировка для тренировок">
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {[
            ['Доги (добок)', 'Официальная форма для тхэквондо ГТФ. Для начинающих — белый добок.'],
            ['Пояс', 'Цвет соответствует текущему гыпу или дану спортсмена.'],
            ['Капа', 'Обязательна на контактных тренировках и соревнованиях.'],
            ['Раковина (для мальчиков)', 'Обязательна на спаррингах.'],
          ].map(([name, desc]) => (
            <li key={name} style={{ marginBottom: 10, paddingLeft: 16, borderLeft: '2px solid var(--gray-dim)' }}>
              <span style={{ color: 'var(--white)', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>{name}</span>
              <span style={{ color: 'var(--gray)', fontSize: '0.85rem' }}>{desc}</span>
            </li>
          ))}
        </ul>
      </InfoBlock>

      {/* Что нужно для соревнований */}
      <InfoBlock title="Экипировка для соревнований ГТФ">
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {[
            ['Шлем', 'Защитный шлем с забралом. Обязателен для всех возрастных категорий.'],
            ['Жилет (хогу)', 'Электронный или обычный — зависит от регламента соревнования.'],
            ['Перчатки', 'Стандартные перчатки для тхэквондо.'],
            ['Футы (защита стопы)', 'Обязательны на спаррингах.'],
            ['Щитки на предплечья и голень', 'По требованию организаторов.'],
            ['Добок с нашивкой клуба', 'На официальных соревнованиях выступают в форме клуба.'],
          ].map(([name, desc]) => (
            <li key={name} style={{ marginBottom: 10, paddingLeft: 16, borderLeft: '2px solid var(--gray-dim)' }}>
              <span style={{ color: 'var(--white)', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.04em', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>{name}</span>
              <span style={{ color: 'var(--gray)', fontSize: '0.85rem' }}>{desc}</span>
            </li>
          ))}
        </ul>
      </InfoBlock>

      {/* Уточнить у тренера */}
      <div style={{
        padding: '16px 20px', borderLeft: '3px solid #c8962a',
        background: 'var(--dark)', fontSize: '0.9rem', color: 'var(--gray)', lineHeight: 1.7
      }}>
        <span style={{ color: '#c8962a', fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Важно</span>
        Перед покупкой уточните у тренера, какая экипировка нужна именно сейчас — требования
        могут отличаться в зависимости от возраста, уровня и предстоящих соревнований.
      </div>
    </div>
  )
}
