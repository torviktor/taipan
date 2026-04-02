import { useState, useEffect } from 'react'
import { API } from './constants'

export function InsuranceStatus({ athleteId, token }) {
  const [expiry, setExpiry] = useState(null)
  const today = new Date().toISOString().slice(0,10)

  useEffect(() => {
    fetch(`${API}/insurance-strategy/insurance`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const found = data.find(x => x.athlete_id === athleteId)
        if (found) setExpiry(found.insurance_expiry)
      })
      .catch(() => {})
  }, [athleteId])

  if (expiry === null) return null
  const diff = Math.floor((new Date(expiry) - new Date(today)) / 86400000)
  const expired = expiry < today
  const soon = (expired === false) && diff <= 30
  const color = expired ? 'var(--red)' : soon ? '#c8962a' : '#6cba6c'
  const label = expired ? 'Страховка истекла' : soon ? `Страховка истекает через ${diff} дн.` : 'Страховка действует'

  return (
    <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }} />
      <span style={{ color, fontSize:'0.82rem', fontFamily:'Barlow Condensed', fontWeight:700 }}>{label}</span>
      <span style={{ color:'var(--gray)', fontSize:'0.78rem' }}>{expiry}</span>
    </div>
  )
}

function ParentInsuranceDates({ token, athletes }) {
  const [data, setData]     = useState([])
  const [saving, setSaving] = useState(null)
  const [msg, setMsg]       = useState('')
  const h  = { Authorization: `Bearer ${token}` }
  const hj = { ...h, 'Content-Type': 'application/json' }
  const today = new Date().toISOString().slice(0,10)

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const r = await fetch(`${API}/insurance-strategy/insurance`, { headers: h })
      if (r.ok) {
        const server = await r.json()
        const merged = athletes.map(a => {
          const found = server.find(x => x.athlete_id === a.id)
          return { athlete_id: a.id, full_name: a.full_name, insurance_expiry: found ? found.insurance_expiry : null }
        })
        setData(merged)
      } else {
        setData(athletes.map(a => ({ athlete_id: a.id, full_name: a.full_name, insurance_expiry: null })))
      }
    } catch {
      setData(athletes.map(a => ({ athlete_id: a.id, full_name: a.full_name, insurance_expiry: null })))
    }
  }

  const save = async (athleteId, expiry) => {
    setSaving(athleteId)
    try {
      const r = await fetch(`${API}/insurance-strategy/insurance`, {
        method: 'PATCH', headers: hj,
        body: JSON.stringify({ athlete_id: athleteId, insurance_expiry: expiry || null })
      })
      if (r.ok) {
        setData(prev => prev.map(x => x.athlete_id === athleteId ? { ...x, insurance_expiry: expiry || null } : x))
        setMsg('Сохранено'); setTimeout(() => setMsg(''), 2000)
      }
    } catch {}
    setSaving(null)
  }

  const getStatus = (expiry) => {
    if (expiry < today) return { label: 'Истекла', color: 'var(--red)' }
    const diff = Math.floor((new Date(expiry) - new Date(today)) / 86400000)
    if (diff <= 30) return { label: `Истекает через ${diff} дн.`, color: '#c8962a' }
    return { label: 'Действует', color: '#6cba6c' }
  }

  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.88rem', letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--white)', marginBottom:12 }}>Сроки страховок</div>
      {msg && <div style={{ color:'#6cba6c', fontSize:'0.85rem', marginBottom:8 }}>{msg}</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        {data.map(a => {
          const status = getStatus(a.insurance_expiry)
          return (
            <div key={a.athlete_id} style={{ background:'var(--dark)', padding:'14px 16px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
              <span style={{ color:'var(--white)', fontWeight:600, minWidth:160 }}>{a.full_name}</span>
              <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, flexWrap:'wrap' }}>
                <input type="date" className="att-date-input" style={{ width:160 }}
                  value={a.insurance_expiry || ''}
                  onChange={e => setData(prev => prev.map(x => x.athlete_id === a.athlete_id ? { ...x, insurance_expiry: e.target.value } : x))}
                  onBlur={e => save(a.athlete_id, e.target.value)} />
                {a.insurance_expiry && <span style={{ fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.85rem', color:status.color }}>{status.label}</span>}
                {saving === a.athlete_id && <span style={{ color:'var(--gray)', fontSize:'0.8rem' }}>Сохранение...</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ParentInsuranceTab({ token, athletes }) {
  return (
    <div style={{ padding:'0 0 40px' }}>
      <div style={{ fontFamily:'Bebas Neue', fontSize:'1.8rem', letterSpacing:'0.06em', color:'var(--white)', marginBottom:4 }}>Страхование</div>
      <div style={{ color:'var(--gray)', fontSize:'0.88rem', lineHeight:1.6, marginBottom:24 }}>
        Спортивное страхование от несчастных случаев — обязательное условие допуска к соревнованиям ГТФ России.
      </div>

      {/* Даты страховок спортсменов */}
      {athletes && athletes.length > 0 && <ParentInsuranceDates token={token} athletes={athletes} />}

      {/* Что такое страховка и зачем */}
      <div style={{ background:'var(--dark)', borderLeft:'3px solid var(--red)', padding:'18px 22px', marginBottom:16 }}>
        <div style={{ fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.78rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--red)', marginBottom:10 }}>Что такое спортивная страховка</div>
        <div style={{ color:'var(--gray)', fontSize:'0.92rem', lineHeight:1.8 }}>
          Спортивная страховка — это полис страхования от несчастных случаев, который защищает спортсмена во время тренировок и соревнований. В случае травмы страховая компания компенсирует расходы на лечение. Для участия в официальных соревнованиях <span style={{ color:'var(--white)', fontWeight:600 }}>ФТР ГТФ России</span> наличие действующего полиса обязательно — без него организаторы не допустят ребёнка к участию.
        </div>
      </div>

      {/* Как оформить */}
      <div style={{ background:'var(--dark)', borderLeft:'3px solid var(--red)', padding:'18px 22px', marginBottom:16 }}>
        <div style={{ fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.78rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--red)', marginBottom:10 }}>Как оформить</div>
        <div style={{ color:'var(--gray)', fontSize:'0.92rem', lineHeight:1.8 }}>
          {[
            'Перейдите на сайт официального страхового партнёра федерации по кнопке ниже',
            'Заполните данные спортсмена: ФИО, дата рождения',
            'Выберите период страхования — он должен покрывать даты всех соревнований сезона',
            'Оплатите полис онлайн и получите документ на e-mail',
            'Распечатайте или сохраните полис на телефоне — он потребуется при регистрации на соревнование',
          ].map((item, i) => (
            <div key={i} style={{ display:'flex', gap:12, marginBottom:8 }}>
              <span style={{ color:'var(--red)', fontFamily:'Bebas Neue', fontSize:'1.1rem', lineHeight:1, flexShrink:0, minWidth:20 }}>{i+1}</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop:16 }}>
          <a href="https://спортстрахование.рф/federation007822-105" target="_blank" rel="noopener noreferrer"
            style={{ display:'inline-block', background:'var(--red)', color:'var(--white)', fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.9rem', letterSpacing:'0.08em', textTransform:'uppercase', padding:'11px 24px', textDecoration:'none' }}>
            Оформить страховку онлайн
          </a>
        </div>
      </div>

      {/* Требования */}
      <div style={{ background:'var(--dark)', borderLeft:'3px solid var(--red)', padding:'18px 22px', marginBottom:16 }}>
        <div style={{ fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.78rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--red)', marginBottom:10 }}>Требования ФТР ГТФ</div>
        <div style={{ color:'var(--gray)', fontSize:'0.92rem', lineHeight:1.8 }}>
          {[
            'Полис оформляется на каждого спортсмена индивидуально',
            'Период страхования должен покрывать дату проведения каждого соревнования',
            'Полис предъявляется при регистрации — в бумажном виде или на экране телефона',
            'Без действующего полиса допуск к соревнованиям невозможен',
            'Рекомендуем оформлять полис на весь соревновательный сезон (сентябрь–август)',
          ].map((item, i) => (
            <div key={i} style={{ display:'flex', gap:10, marginBottom:6 }}>
              <span style={{ color:'var(--red)', flexShrink:0 }}>—</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Вопросы */}
      <div style={{ background:'var(--dark)', borderLeft:'3px solid #c8962a', padding:'16px 20px', fontSize:'0.9rem', color:'var(--gray)', lineHeight:1.7 }}>
        <span style={{ color:'#c8962a', fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.75rem', letterSpacing:'0.12em', textTransform:'uppercase', display:'block', marginBottom:6 }}>Есть вопросы?</span>
        Обратитесь к тренеру — он поможет разобраться с оформлением и подскажет оптимальный срок страхования для вашего ребёнка.
      </div>
    </div>
  )
}
