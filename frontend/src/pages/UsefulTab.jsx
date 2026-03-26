// ── ВКЛАДКА «ПОЛЕЗНОЕ» — кабинет родителя ────────────────────────────────────

export default function UsefulTab() {
  return (
    <div>
      {/* Блок «Экипировка Forte» */}
      <div style={{ marginBottom: 40 }}>
        <h3 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '1.6rem', letterSpacing: '0.06em', color: 'var(--white)', marginBottom: 16 }}>
          ОФИЦИАЛЬНАЯ ЭКИПИРОВКА
        </h3>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 8 }}>
            Почему только Forte
          </div>
          <p style={{ color: 'var(--gray)', fontSize: '0.92rem', lineHeight: 1.7 }}>
            Тхэквондо WT — олимпийский вид спорта с жёсткими требованиями к снаряжению. На официальных соревнованиях допускается только сертифицированная экипировка с маркировкой WT. Forte — официальный поставщик, сертифицированный Всемирной федерацией тхэквондо.
          </p>
          <p style={{ color: 'var(--gray)', fontSize: '0.92rem', lineHeight: 1.7, marginTop: 10 }}>
            Использование несертифицированной экипировки на турнире означает отстранение от участия. Это не формальность — это условие допуска.
          </p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 8 }}>
            Что входит в обязательный комплект
          </div>
          <p style={{ color: 'var(--gray)', fontSize: '0.92rem', lineHeight: 1.7 }}>
            — Добок (форма) с маркировкой WT<br/>
            — Шлем с сенсорной системой (для соревнований с PSS)<br/>
            — Жилет с электронными датчиками (PSS-жилет)<br/>
            — Защита предплечий, голени, паховая защита<br/>
            — Капа
          </p>
        </div>

        <a
          href="https://fortec.ru"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{ display: 'inline-block', fontSize: '0.9rem', padding: '10px 24px', marginBottom: 20 }}
        >
          Перейти в магазин Forte →
        </a>

        <div style={{
          borderLeft: '3px solid var(--red)', paddingLeft: 16, paddingTop: 10, paddingBottom: 10,
          background: 'rgba(200,30,30,0.06)', borderRadius: '0 6px 6px 0'
        }}>
          <p style={{ color: 'var(--white)', fontSize: '0.9rem', lineHeight: 1.6, fontWeight: 600 }}>
            Покупайте экипировку заранее — PSS-жилеты под конкретного спортсмена иногда требуют настройки и проверки.
          </p>
        </div>
      </div>
    </div>
  )
}
