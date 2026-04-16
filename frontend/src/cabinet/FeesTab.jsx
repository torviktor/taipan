import { useState, useEffect } from 'react'
import { API } from './constants'

const MONTHS_RU = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                   'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

const thStyle = {
  padding: '8px 12px',
  color: 'var(--gray)',
  fontSize: '0.78rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  fontFamily: 'Barlow Condensed',
  fontWeight: 700,
}
const tdStyle = { padding: '10px 12px' }

export default function FeesTab({ token, role }) {
  const now = new Date()
  const [config,      setConfig]      = useState({ payment_day: 1, fee_amount: 2000 })
  const [configDirty, setConfigDirty] = useState(false)
  const [year,        setYear]        = useState(now.getFullYear())
  const [month,       setMonth]       = useState(now.getMonth() + 1)
  const [periods,     setPeriods]     = useState([])
  const [localBudget, setLocalBudget] = useState({})
  const [groupFilter, setGroupFilter] = useState('all')
  const [loading,     setLoading]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [notifying,   setNotifying]   = useState(false)
  const [msg,         setMsg]         = useState('')

  const h  = { Authorization: `Bearer ${token}` }
  const hj = { ...h, 'Content-Type': 'application/json' }

  useEffect(() => {
    fetch(`${API}/fees/config`, { headers: h })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setConfig(d) })
      .catch(() => {})
  }, [])

  useEffect(() => { loadPeriods() }, [year, month])

  const loadPeriods = async () => {
    setLoading(true)
    setLocalBudget({})
    setMsg('')
    try {
      const r = await fetch(`${API}/fees/periods?year=${year}&month=${month}`, { headers: h })
      if (r.ok) setPeriods(await r.json())
      else setPeriods([])
    } catch { setPeriods([]) }
    setLoading(false)
  }

  const saveConfig = async () => {
    try {
      const r = await fetch(`${API}/fees/config`, {
        method: 'POST',
        headers: hj,
        body: JSON.stringify({ payment_day: config.payment_day, fee_amount: config.fee_amount }),
      })
      if (r.ok) { setConfigDirty(false); setMsg('Настройки сохранены') }
    } catch {}
  }

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const initPeriods = async () => {
    try {
      await fetch(`${API}/fees/periods/init?year=${year}&month=${month}`, {
        method: 'POST', headers: h,
      })
      await loadPeriods()
    } catch {}
  }

  const togglePaid = async (periodId, paid) => {
    try {
      const r = await fetch(`${API}/fees/periods/${periodId}`, {
        method: 'PATCH',
        headers: hj,
        body: JSON.stringify({ paid }),
      })
      if (r.ok) {
        const updated = await r.json()
        setPeriods(prev => prev.map(p => p.id === periodId ? updated : p))
      }
    } catch {}
  }

  const filteredPeriods = groupFilter === 'all'
    ? periods
    : periods.filter(p => p.group === groupFilter)

  const getBody = () => filteredPeriods.map(p => ({
    athlete_id: p.athlete_id,
    is_budget:  localBudget[p.athlete_id] ?? p.is_budget,
  }))

  const saveList = async () => {
    setSaving(true)
    try {
      await fetch(`${API}/fees/periods/save-and-notify?year=${year}&month=${month}&notify=false`, {
        method: 'POST',
        headers: hj,
        body: JSON.stringify(getBody()),
      })
      await loadPeriods()
      setMsg('Список сохранён')
    } catch {}
    setSaving(false)
  }

  const saveAndNotify = async () => {
    setNotifying(true)
    try {
      const r = await fetch(`${API}/fees/periods/save-and-notify?year=${year}&month=${month}`, {
        method: 'POST',
        headers: hj,
        body: JSON.stringify(getBody()),
      })
      if (r.ok) {
        const result = await r.json()
        await loadPeriods()
        setMsg(`Уведомлено: ${result.notified} чел.`)
      }
    } catch {}
    setNotifying(false)
  }

  const countNonBudget = filteredPeriods.filter(p => !(localBudget[p.athlete_id] ?? p.is_budget)).length
  const countPaid      = filteredPeriods.filter(p => !(localBudget[p.athlete_id] ?? p.is_budget) && p.paid).length
  const countDebt      = filteredPeriods.filter(p => !(localBudget[p.athlete_id] ?? p.is_budget) && !p.paid && p.debt > 0).length

  return (
    <div>
      {/* Настройки */}
      <div style={{ display:'flex', gap:16, alignItems:'center', flexWrap:'wrap',
        background:'var(--dark2)', border:'1px solid var(--gray-dim)',
        borderRadius:8, padding:'14px 18px', marginBottom:20 }}>
        <span style={{color:'var(--gray)', fontSize:'0.85rem'}}>День сбора взносов:</span>
        <input type="number" min="1" max="28" value={config.payment_day}
          onChange={e => { setConfig(p => ({...p, payment_day: +e.target.value})); setConfigDirty(true) }}
          className="td-input" style={{width:60}} />
        <span style={{color:'var(--gray)', fontSize:'0.85rem'}}>Сумма (руб.):</span>
        <input type="number" min="0" value={config.fee_amount}
          onChange={e => { setConfig(p => ({...p, fee_amount: +e.target.value})); setConfigDirty(true) }}
          className="td-input" style={{width:100}} />
        {configDirty ? (
          <button className="btn-primary" style={{padding:'6px 16px', fontSize:'13px'}} onClick={saveConfig}>
            Сохранить настройки
          </button>
        ) : (
          <span style={{color:'#6cba6c', fontSize:'0.82rem'}}>✓ Сохранено</span>
        )}
      </div>

      {/* Фильтр по группе */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {[
          { id:'all',    label:'Все группы' },
          { id:'junior', label:'Младшая' },
          { id:'senior', label:'Старшая' },
          { id:'adults', label:'Взрослые' },
        ].map(g => (
          <button key={g.id}
            onClick={() => setGroupFilter(g.id)}
            style={{
              fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.85rem',
              letterSpacing:'0.06em', textTransform:'uppercase',
              padding:'7px 16px', borderRadius:6, cursor:'pointer',
              background: groupFilter === g.id ? 'var(--red)' : 'transparent',
              color: groupFilter === g.id ? 'var(--white)' : 'var(--gray)',
              border: groupFilter === g.id ? '1px solid var(--red)' : '1px solid var(--gray-dim)',
            }}>
            {g.label}
          </button>
        ))}
      </div>

      {/* Переключатель месяца */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <button className="btn-outline" style={{padding:'6px 14px'}} onClick={prevMonth}>←</button>
        <span style={{fontFamily:'Bebas Neue', fontSize:'1.3rem', color:'var(--white)', minWidth:160, textAlign:'center'}}>
          {MONTHS_RU[month]} {year}
        </span>
        <button className="btn-outline" style={{padding:'6px 14px'}} onClick={nextMonth}>→</button>
      </div>

      {msg && <div style={{color:'#6cba6c', marginBottom:12, fontSize:'0.88rem'}}>{msg}</div>}

      {loading && <div className="cabinet-loading">Загрузка...</div>}

      {!loading && periods.length === 0 && (
        <div>
          <button className="btn-primary" onClick={initPeriods}>
            Сформировать список на {MONTHS_RU[month]} {year}
          </button>
          <p style={{color:'var(--gray)', fontSize:'0.85rem', marginTop:8}}>
            Список ещё не сформирован. Нажмите чтобы автоматически добавить всех активных спортсменов.
          </p>
        </div>
      )}

      {!loading && periods.length > 0 && (
        <>
          {/* Статистика */}
          <div style={{ display:'flex', gap:20, marginBottom:12, flexWrap:'wrap' }}>
            <span style={{color:'var(--gray)', fontSize:'0.85rem'}}>
              Внебюджетников: <strong style={{color:'var(--white)'}}>{countNonBudget}</strong>
            </span>
            <span style={{color:'var(--gray)', fontSize:'0.85rem'}}>
              Оплатили: <strong style={{color:'#6cba6c'}}>{countPaid}</strong> из {countNonBudget}
            </span>
            {countDebt > 0 && (
              <span style={{color:'var(--gray)', fontSize:'0.85rem'}}>
                Должников: <strong style={{color:'var(--red)'}}>{countDebt}</strong>
              </span>
            )}
          </div>

          {/* Таблица */}
          <div className="athletes-table-wrap">
            <table style={{width:'100%', borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'1px solid var(--gray-dim)'}}>
                  <th style={{...thStyle, textAlign:'left'}}>Спортсмен</th>
                  <th style={thStyle}>Группа</th>
                  <th style={thStyle}>Бюджетник</th>
                  <th style={thStyle}>Оплачено</th>
                  <th style={thStyle}>Долг</th>
                </tr>
              </thead>
              <tbody>
                {filteredPeriods.map(p => {
                  const isBudget = localBudget[p.athlete_id] ?? p.is_budget
                  return (
                    <tr key={p.id} style={{
                      borderBottom: '1px solid var(--gray-dim)',
                      opacity: isBudget ? 0.5 : 1,
                    }}>
                      <td style={{...tdStyle, color:'var(--white)'}}>{p.full_name}</td>
                      <td style={{...tdStyle, textAlign:'center', color:'var(--gray)', fontSize:'0.85rem'}}>
                        {p.group || '—'}
                      </td>
                      <td style={{...tdStyle, textAlign:'center'}}>
                        <input type="checkbox" checked={isBudget}
                          onChange={e => setLocalBudget(prev => ({...prev, [p.athlete_id]: e.target.checked}))}
                          style={{width:16, height:16, accentColor:'var(--red)', cursor:'pointer'}}/>
                      </td>
                      <td style={{...tdStyle, textAlign:'center'}}>
                        {!isBudget && (
                          <input type="checkbox" checked={p.paid}
                            onChange={e => togglePaid(p.id, e.target.checked)}
                            style={{width:16, height:16, accentColor:'#6cba6c', cursor:'pointer'}}/>
                        )}
                      </td>
                      <td style={{...tdStyle, textAlign:'center'}}>
                        {p.debt > 0 && !isBudget && (
                          <span style={{color:'var(--red)', fontSize:'0.85rem', fontWeight:700}}>
                            +{p.debt} руб.
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Кнопки */}
          <div style={{ display:'flex', gap:12, marginTop:20, flexWrap:'wrap' }}>
            <button className="btn-outline" style={{padding:'9px 20px'}}
              onClick={saveList} disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить список'}
            </button>
            <button className="btn-primary" style={{padding:'9px 20px'}}
              onClick={saveAndNotify} disabled={notifying}>
              {notifying ? 'Отправка...' : 'Сохранить и уведомить внебюджетников'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
