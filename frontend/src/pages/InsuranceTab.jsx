// frontend/src/pages/InsuranceTab.jsx
// Вкладка «Страхование» — данные ГТФ России, хранение в БД

import { useState, useEffect } from 'react'

const API = '/api'

export default function InsuranceTab({ token, athletes: propAthletes }) {
  const [athletes, setAthletes]   = useState([])
  const [loading,  setLoading]    = useState(false)
  const [saving,   setSaving]     = useState(null) // athlete_id сохраняемого
  const [msg,      setMsg]        = useState('')
  const [search,   setSearch]     = useState('')

  const h  = { Authorization: `Bearer ${token}` }
  const hj = { ...h, 'Content-Type': 'application/json' }

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/insurance-strategy/insurance`, { headers: h })
      if (r.ok) {
        const data = await r.json()
        setAthletes(data)
      }
    } catch {}
    setLoading(false)
  }

  const save = async (athleteId, expiry) => {
    setSaving(athleteId)
    try {
      const r = await fetch(`${API}/insurance-strategy/insurance`, {
        method: 'PATCH',
        headers: hj,
        body: JSON.stringify({ athlete_id: athleteId, insurance_expiry: expiry || null })
      })
      if (r.ok) {
        setAthletes(prev => prev.map(a =>
          a.athlete_id === athleteId ? { ...a, insurance_expiry: expiry || null } : a
        ))
        setMsg('Сохранено')
        setTimeout(() => setMsg(''), 2000)
      }
    } catch {}
    setSaving(null)
  }

  const today = new Date().toISOString().slice(0, 10)

  const getStatus = (expiry) => {
    if (!expiry) return { label: 'Не указана', color: 'var(--gray)' }
    if (expiry < today) return { label: 'Истекла', color: 'var(--red)' }
    const diff = Math.floor((new Date(expiry) - new Date(today)) / 86400000)
    if (diff <= 30) return { label: `Истекает через ${diff} дн.`, color: '#c8962a' }
    return { label: 'Действует', color: '#6cba6c' }
  }

  const filtered = athletes.filter(a =>
    a.full_name.toLowerCase().includes(search.toLowerCase())
  )

  // Стиль блоков информации
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

      {/* ── Заголовок ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '1.8rem', letterSpacing: '0.06em', color: 'var(--white)', marginBottom: 4 }}>
          Страхование спортсменов
        </div>
        <div style={{ color: 'var(--gray)', fontSize: '0.88rem', lineHeight: 1.6 }}>
          Спортивное страхование от несчастных случаев — обязательное условие допуска к соревнованиям ГТФ России.
        </div>
      </div>

      {/* ── Блок: оформление страховки ── */}
      <InfoBlock title="Оформление страховки">
        Страховка оформляется через официального страхового партнёра федерации.
        Полис должен покрывать несчастные случаи в период соревновательной деятельности.
        <div style={{ marginTop: 12 }}>
          <a
            href="https://спортстрахование.рф/federation007822-105"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              background: 'var(--red)', color: 'var(--white)',
              fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.9rem',
              letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '10px 22px', textDecoration: 'none',
              transition: 'background 0.2s'
            }}
          >
            Оформить страховку онлайн
          </a>
        </div>
      </InfoBlock>

      {/* ── Блок: требования ГТФ ── */}
      <InfoBlock title="Требования ФТР ГТФ к страхованию">
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {[
            'Страховой полис оформляется на каждого спортсмена индивидуально',
            'Период страхования должен покрывать дату проведения соревнования',
            'Полис предъявляется при регистрации на соревнование или сбор',
            'Допуск к соревнованиям без действующего полиса не осуществляется',
            'Страховая сумма — не менее установленной федерацией нормы',
          ].map((item, i) => (
            <li key={i} style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
              <span style={{ color: 'var(--red)', flexShrink: 0 }}>—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </InfoBlock>

      {/* ── Блок: полезные ссылки ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 2, marginBottom: 28 }}>
        {[
          {
            title: 'Федерация ТКД ГТФ России',
            desc: 'Официальный сайт федерации, документы, правила',
            url: 'https://rusgtf.ru'
          },
          {
            title: 'Спортстрахование.рф',
            desc: 'Онлайн-оформление полиса для членов ФТР ГТФ',
            url: 'https://спортстрахование.рф/federation007822-105'
          },
          {
            title: 'Памятка для родителей',
            desc: 'PDF — подготовка к соревнованиям и сборам',
            url: 'https://rusgtf.ru/wp-content/uploads/2025/12/Памятка-для-родителей-по-подготовке-к-соревнованиям-и-сборам.pdf'
          },
        ].map(link => (
          <a
            key={link.title}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block', background: 'var(--dark)', padding: '16px 20px',
              textDecoration: 'none', transition: 'background 0.2s',
              borderBottom: '2px solid transparent',
            }}
            onMouseEnter={e => e.currentTarget.style.borderBottomColor = 'var(--red)'}
            onMouseLeave={e => e.currentTarget.style.borderBottomColor = 'transparent'}
          >
            <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--white)', marginBottom: 4 }}>
              {link.title}
            </div>
            <div style={{ color: 'var(--gray)', fontSize: '0.82rem' }}>{link.desc}</div>
          </a>
        ))}
      </div>

      {/* ── Таблица сроков страховок ── */}
      <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--white)' }}>
          Сроки страховок
        </div>
        <input
          type="text"
          placeholder="Поиск по имени..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: 'var(--dark)', border: '1px solid var(--gray-dim)', color: 'var(--white)',
            padding: '7px 14px', fontSize: '0.88rem', fontFamily: 'Barlow', outline: 'none', minWidth: 200
          }}
        />
        {msg && <span style={{ color: '#6cba6c', fontSize: '0.85rem', fontFamily: 'Barlow Condensed', fontWeight: 700 }}>{msg}</span>}
      </div>

      {loading ? (
        <div style={{ color: 'var(--gray)', padding: '20px 0' }}>Загрузка...</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: 'var(--gray)', padding: '20px 0' }}>Нет спортсменов</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--gray-dim)' }}>
                {['Спортсмен', 'Дата окончания полиса', 'Статус', ''].map(h => (
                  <th key={h} style={{
                    fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.72rem',
                    letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gray)',
                    padding: '8px 12px', textAlign: 'left'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const status = getStatus(a.insurance_expiry)
                return (
                  <tr key={a.athlete_id} style={{ borderBottom: '1px solid var(--gray-dim)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--white)', fontWeight: 600 }}>
                      {a.full_name}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <input
                        type="date"
                        className="att-date-input"
                        style={{ width: 160 }}
                        value={a.insurance_expiry || ''}
                        onChange={e => {
                          const val = e.target.value
                          setAthletes(prev => prev.map(x =>
                            x.athlete_id === a.athlete_id ? { ...x, insurance_expiry: val } : x
                          ))
                        }}
                        onBlur={e => save(a.athlete_id, e.target.value)}
                      />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.85rem',
                        color: status.color
                      }}>{status.label}</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {saving === a.athlete_id && (
                        <span style={{ color: 'var(--gray)', fontSize: '0.8rem' }}>Сохранение...</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Легенда статусов ── */}
      <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
        {[
          { color: '#6cba6c', label: 'Действует (более 30 дней)' },
          { color: '#c8962a', label: 'Истекает в течение 30 дней' },
          { color: 'var(--red)', label: 'Истекла' },
          { color: 'var(--gray)', label: 'Не указана' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--gray)' }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
