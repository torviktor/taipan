import { useState, useEffect, useMemo } from 'react'
import './FeesTab.css'
import { API } from './constants'

const MONTHS_RU = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                   'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

const GROUP_LABELS = { junior: 'Младшая', senior: 'Старшая' }

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
  const currentYear  = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const [config,      setConfig]      = useState({ payment_day: 1, fee_amount: 2000 })
  const [configDirty, setConfigDirty] = useState(false)
  const [year,        setYear]        = useState(now.getFullYear())
  const [month,       setMonth]       = useState(now.getMonth() + 1)
  const isPast = year < currentYear || (year === currentYear && month < currentMonth)
  const [periods,     setPeriods]     = useState([])
  const [localNotes,  setLocalNotes]  = useState({})
  const [groupFilter, setGroupFilter] = useState('all')
  const [groupSaving,       setGroupSaving]       = useState(false)
  const [showGroupChange,   setShowGroupChange]   = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [notifying,   setNotifying]   = useState(false)
  const [msg,         setMsg]         = useState('')

  const h  = { Authorization: `Bearer ${token}` }
  const hj = { ...h, 'Content-Type': 'application/json' }

  useEffect(() => {
    fetch(`${API}/fees/config`, { headers: h })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setConfig(d) })
      .catch(() => {})

    if (role === 'manager') {
      fetch(`${API}/users/me`, { headers: h })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.manager_group) setGroupFilter(d.manager_group) })
        .catch(() => {})
    }
  }, [])

  const loadAndInit = async () => {
    setLoading(true)
    setMsg('')
    try {
      // Backend идемпотентен: если записи уже есть — пропустит, если нет — создаст.
      // Это гарантирует что недавно добавленные спортсмены попадут в текущий период.
      const initRes = await fetch(
        `${API}/fees/periods/init?year=${year}&month=${month}`,
        { method: 'POST', headers: h }
      )
      if (!initRes.ok) {
        const initText = await initRes.text()
        setMsg('Ошибка инициализации: ' + initText)
      }

      const res = await fetch(
        `${API}/fees/periods?year=${year}&month=${month}`,
        { headers: h }
      )
      if (res.ok) {
        const data = await res.json()
        setPeriods(data)
        if (data.length === 0) setMsg('Нет спортсменов в вашей группе')
      } else {
        setPeriods([])
        setMsg('Ошибка загрузки данных')
      }
    } catch (e) {
      console.error('loadAndInit error:', e)
      setPeriods([])
    }
    setLoading(false)
  }

  useEffect(() => { loadAndInit() }, [year, month])

  const saveConfig = async () => {
    try {
      const r = await fetch(`${API}/fees/config`, {
        method: 'POST',
        headers: hj,
        body: JSON.stringify({ fee_amount: config.fee_amount }),
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

  const saveNote = async (periodId, note) => {
    try {
      const r = await fetch(`${API}/fees/periods/${periodId}`, {
        method: 'PATCH',
        headers: hj,
        body: JSON.stringify({ note }),
      })
      if (r.ok) {
        const updated = await r.json()
        setPeriods(prev => prev.map(p => p.id === periodId ? updated : p))
      }
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

  const toggleBudget = async (periodId, isBudget) => {
    try {
      const r = await fetch(`${API}/fees/periods/${periodId}`, {
        method: 'PATCH',
        headers: hj,
        body: JSON.stringify({ is_budget: isBudget }),
      })
      if (r.ok) {
        const updated = await r.json()
        setPeriods(prev => prev.map(p => p.id === periodId ? updated : p))
      }
    } catch {}
  }

  const changeGroup = async (gid) => {
    setGroupFilter(gid)
    setGroupSaving(true)
    try {
      await fetch(`${API}/users/me/group`, {
        method: 'PATCH',
        headers: hj,
        body: JSON.stringify({ manager_group: gid === 'all' ? null : gid }),
      })
    } catch {}
    setGroupSaving(false)
  }

  const filteredPeriods = useMemo(() => {
    const list = periods || []
    if (groupFilter === 'all') return list
    if (groupFilter === 'junior') return list.filter(p =>
      p.group === 'junior' ||
      p.group === 'Младшая группа (6–10 лет)' ||
      p.group === 'Младшая группа (6-10 лет)'
    )
    if (groupFilter === 'senior') return list.filter(p =>
      p.group === 'senior' ||
      p.group === 'Старшая группа (11+)'
    )
    if (groupFilter === 'adults') return list.filter(p =>
      p.group === 'adults' ||
      p.group === 'Взрослые' ||
      p.group === 'Взрослые (18+)'
    )
    return list
  }, [periods, groupFilter])

  // Алфавитная сортировка по ФИО
  const byName = (a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'ru')

  // Три списка — по состоянию галочек
  const debtors = useMemo(
    () => (filteredPeriods || []).filter(p => !p.is_budget && !p.paid).sort(byName),
    [filteredPeriods]
  )
  const paidList = useMemo(
    () => (filteredPeriods || []).filter(p => !p.is_budget && p.paid).sort(byName),
    [filteredPeriods]
  )
  const budgetList = useMemo(
    () => (filteredPeriods || []).filter(p => p.is_budget).sort(byName),
    [filteredPeriods]
  )

  const notifyDebtors = async () => {
    setNotifying(true)
    try {
      const r = await fetch(`${API}/fees/periods/save-and-notify?year=${year}&month=${month}`, {
        method: 'POST',
        headers: hj,
        body: JSON.stringify([]),  // пустой массив — ничего не меняем, только шлём уведомления
      })
      if (r.ok) {
        const result = await r.json()
        setMsg(`Напоминание отправлено: ${result.notified} чел.`)
      }
    } catch {}
    setNotifying(false)
  }

  const countDebtors  = (filteredPeriods || []).filter(p => !p.is_budget && !p.paid).length
  const countPaid     = (filteredPeriods || []).filter(p => !p.is_budget && p.paid).length
  const countBudget   = (filteredPeriods || []).filter(p =>  p.is_budget).length

  // Денежные счётчики (только для платящих клубу)
  const moneyDue   = (filteredPeriods || []).filter(p => !p.is_budget).reduce((s, p) => s + (config.fee_amount + (p.debt || 0)), 0)
  const moneyPaid  = (filteredPeriods || []).filter(p => !p.is_budget && p.paid).reduce((s, p) => s + (config.fee_amount + (p.debt || 0)), 0)
  const moneyDebt  = (filteredPeriods || []).filter(p => !p.is_budget && !p.paid).reduce((s, p) => s + (config.fee_amount + (p.debt || 0)), 0)

  // Рендер одной строки таблицы (общий для всех трёх списков)
  const renderRow = (p) => {
    const isBudget = p.is_budget
    return (
      <tr key={p.id} style={{ borderBottom: '1px solid var(--gray-dim)' }}>
        <td style={{...tdStyle, color:'var(--white)'}}>{p.full_name}</td>
        <td style={{...tdStyle, textAlign:'center', color:'var(--gray)', fontSize:'0.85rem'}}>
          {p.group || '—'}
        </td>
        <td style={{...tdStyle, textAlign:'center'}}>
          {(role === 'admin' || isPast) ? (
            <span style={{fontSize:'0.82rem', color: isBudget ? 'var(--gray)' : 'var(--white)'}}>
              {isBudget ? 'Абонемент' : 'Платит клубу'}
            </span>
          ) : (
            <input type="checkbox" checked={isBudget}
              onChange={e => toggleBudget(p.id, e.target.checked)}
              style={{width:16, height:16, accentColor:'var(--red)', cursor:'pointer'}}/>
          )}
        </td>
        <td style={{...tdStyle, textAlign:'center'}}>
          {!isBudget && (
            (role === 'admin' || isPast) ? (
              <span style={{fontSize:'0.82rem', color: p.paid ? '#6cba6c' : 'var(--red)'}}>
                {p.paid ? 'Оплачено' : 'Не оплачено'}
              </span>
            ) : (
              <input type="checkbox" checked={p.paid}
                onChange={e => togglePaid(p.id, e.target.checked)}
                style={{width:16, height:16, accentColor:'#6cba6c', cursor:'pointer'}}/>
            )
          )}
        </td>
        <td style={{...tdStyle, textAlign:'center'}}>
          {!isBudget && p.paid && (
            <span style={{color:'#6cba6c', fontSize:'1.1rem'}}>✓</span>
          )}
          {!isBudget && !p.paid && (
            <div>
              <span style={{color:'var(--red)', fontWeight:700, fontSize:'0.85rem'}}>
                {config.fee_amount + p.debt} руб.
              </span>
              {p.debt > 0 && (
                <div style={{color:'var(--gray)', fontSize:'0.78rem'}}>
                  {config.fee_amount} + {p.debt} долг
                </div>
              )}
            </div>
          )}
        </td>
        <td style={tdStyle}>
          {(role === 'admin' || isPast) ? (
            <span style={{color:'var(--gray)', fontSize:'0.85rem'}}>
              {p.note || ''}
            </span>
          ) : (
            <input
              type="text"
              className="td-input"
              placeholder="Комментарий..."
              value={localNotes[p.id] ?? p.note ?? ''}
              onChange={e => setLocalNotes(prev => ({...prev, [p.id]: e.target.value}))}
              onBlur={e => saveNote(p.id, e.target.value)}
              style={{width:'100%', minWidth:120}}
            />
          )}
        </td>
      </tr>
    )
  }

  // Рендер заголовка таблицы (общий для всех трёх списков)
  const renderTableHead = () => (
    <thead>
      <tr style={{borderBottom:'1px solid var(--gray-dim)'}}>
        <th style={{...thStyle, textAlign:'left'}}>Спортсмен</th>
        <th style={thStyle}>Группа</th>
        <th style={thStyle}>Абонемент</th>
        <th style={thStyle}>Оплачено</th>
        <th style={thStyle}>Долг</th>
        <th style={{...thStyle, textAlign:'left'}}>Комментарий</th>
      </tr>
    </thead>
  )

  // Рендер одного из трёх списков с заголовком
  const renderList = (variant, title, rows) => (
    <div className={`fees-list fees-list-${variant}`}>
      <h3 className="fees-list-title">
        {title}
        <span className="fees-list-title-count">({rows.length})</span>
      </h3>
      {rows.length === 0 ? (
        <div className="fees-list-empty">Пусто</div>
      ) : (
        <div className="athletes-table-wrap fees-list-rows">
          <table style={{width:'100%', borderCollapse:'collapse'}}>
            {renderTableHead()}
            <tbody>{rows.map(renderRow)}</tbody>
          </table>
        </div>
      )}
    </div>
  )

  return (
    <div>
      {/* Настройки */}
      <div style={{ display:'flex', gap:16, alignItems:'center', flexWrap:'wrap',
        background:'var(--dark2)', border:'1px solid var(--gray-dim)',
        borderRadius:8, padding:'14px 18px', marginBottom:20 }}>
        <span style={{color:'var(--gray)', fontSize:'0.85rem'}}>Сумма взноса (руб.):</span>
        <input type="number" min="0" value={config.fee_amount}
          onChange={e => { setConfig(p => ({...p, fee_amount: +e.target.value})); setConfigDirty(true) }}
          className="td-input" style={{width:100}} />
        {configDirty ? (
          <button className="btn-primary" style={{padding:'6px 16px', fontSize:'13px'}} onClick={saveConfig}>
            Сохранить
          </button>
        ) : (
          <span style={{color:'#6cba6c', fontSize:'0.82rem'}}>✓ Сохранено</span>
        )}
        <span style={{color:'var(--gray)', fontSize:'0.78rem', marginLeft:'auto'}}>
          Дедлайн оплаты — 25 число каждого месяца
        </span>
      </div>

      {/* Фильтр по группе */}
      {role === 'manager' && groupFilter === 'all' ? (
        <div style={{
          background:'var(--dark2)', border:'1px solid var(--gray-dim)',
          borderRadius:8, padding:'24px', marginBottom:20,
        }}>
          <p style={{color:'var(--white)', fontFamily:'Barlow Condensed', fontSize:'1.1rem',
            fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:16}}>
            Выберите вашу группу
          </p>
          <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
            {[
              { id:'junior', label:'Младшая (6–10 лет)' },
              { id:'senior', label:'Старшая (11+)' },
              { id:'adults', label:'Взрослые' },
            ].map(g => (
              <button key={g.id} className="btn-primary" disabled={groupSaving}
                style={{padding:'9px 20px', fontSize:'0.85rem'}}
                onClick={() => changeGroup(g.id)}>
                {groupSaving ? '...' : g.label}
              </button>
            ))}
          </div>
        </div>
      ) : role === 'manager' ? (
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <span style={{color:'var(--gray)', fontSize:'0.85rem'}}>
            Ваша группа: <strong style={{color:'var(--white)'}}>
              {groupFilter === 'junior' ? 'Младшая' : groupFilter === 'senior' ? 'Старшая' : groupFilter === 'adults' ? 'Взрослые' : groupFilter}
            </strong>
          </span>
          {!showGroupChange && (
            <button className="btn-outline" style={{padding:'4px 12px', fontSize:'0.78rem'}}
              onClick={() => setShowGroupChange(true)}>
              Изменить
            </button>
          )}
          {showGroupChange && (
            <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
              {[
                { id:'junior', label:'Младшая' },
                { id:'senior', label:'Старшая' },
                { id:'adults', label:'Взрослые' },
              ].map(g => (
                <button key={g.id}
                  style={{
                    fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.8rem',
                    letterSpacing:'0.06em', textTransform:'uppercase',
                    padding:'5px 14px', borderRadius:6, cursor:'pointer',
                    background: groupFilter === g.id ? 'var(--red)' : 'transparent',
                    color: groupFilter === g.id ? 'var(--white)' : 'var(--gray)',
                    border: groupFilter === g.id ? '1px solid var(--red)' : '1px solid var(--gray-dim)',
                  }}
                  disabled={groupSaving}
                  onClick={() => { changeGroup(g.id); setShowGroupChange(false) }}>
                  {g.label}
                </button>
              ))}
              <button className="btn-outline" style={{padding:'5px 10px', fontSize:'0.78rem'}}
                onClick={() => setShowGroupChange(false)}>✕</button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
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
      )}

      {/* Переключатель месяца */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <button className="btn-outline" style={{padding:'6px 14px'}} onClick={prevMonth}>←</button>
        <span style={{fontFamily:'Bebas Neue', fontSize:'1.3rem', color:'var(--white)', minWidth:160, textAlign:'center'}}>
          {MONTHS_RU[month]} {year}
        </span>
        <button
          onClick={nextMonth}
          disabled={year === currentYear && month === currentMonth}
          className="btn-outline"
          style={{
            padding:'6px 14px',
            opacity: year === currentYear && month === currentMonth ? 0.3 : 1,
            cursor: year === currentYear && month === currentMonth ? 'not-allowed' : 'pointer',
          }}>→</button>
      </div>

      {msg && <div style={{color:'#6cba6c', marginBottom:12, fontSize:'0.88rem'}}>{msg}</div>}

      {loading && <div className="cabinet-loading">Загрузка...</div>}

      {!loading && !msg && periods.length > 0 && filteredPeriods.length === 0 && (
        <div style={{color:'var(--gray)', fontSize:'0.9rem', padding:'24px 0'}}>
          Нет спортсменов в вашей группе за этот период
        </div>
      )}

      {!loading && periods.length > 0 && filteredPeriods.length > 0 && (
        <>
          {isPast && (
            <div style={{
              background:'var(--dark2)', border:'1px solid var(--gray-dim)',
              borderRadius:6, padding:'8px 16px', marginBottom:12,
              color:'var(--gray)', fontSize:'0.85rem',
            }}>
              Период закрыт — только просмотр
            </div>
          )}

          {/* Статистика — люди */}
          <div style={{ display:'flex', gap:20, marginBottom:8, flexWrap:'wrap' }}>
            <span style={{color:'var(--gray)', fontSize:'0.85rem'}}>
              Должников: <strong style={{color:'var(--red)'}}>{countDebtors}</strong>
            </span>
            <span style={{color:'var(--gray)', fontSize:'0.85rem'}}>
              Сдали взносы: <strong style={{color:'#6cba6c'}}>{countPaid}</strong>
            </span>
            <span style={{color:'var(--gray)', fontSize:'0.85rem'}}>
              Абонемент: <strong style={{color:'var(--white)'}}>{countBudget}</strong>
            </span>
          </div>

          {/* Статистика — деньги */}
          <div style={{ display:'flex', gap:20, marginBottom:12, flexWrap:'wrap' }}>
            <span style={{color:'var(--gray)', fontSize:'0.85rem'}}>
              Сумма к сбору: <strong style={{color:'var(--white)'}}>{moneyDue.toLocaleString('ru-RU')} руб.</strong>
            </span>
            <span style={{color:'var(--gray)', fontSize:'0.85rem'}}>
              Получено: <strong style={{color:'#6cba6c'}}>{moneyPaid.toLocaleString('ru-RU')} руб.</strong>
            </span>
            <span style={{color:'var(--gray)', fontSize:'0.85rem'}}>
              Долг: <strong style={{color:'var(--red)'}}>{moneyDebt.toLocaleString('ru-RU')} руб.</strong>
            </span>
          </div>

          {/* Три списка */}
          {renderList('debtors', 'Ждём оплаты',  debtors)}
          {renderList('paid',    'Оплатили',     paidList)}
          {renderList('budget',  'По абонементу', budgetList)}

          {/* Кнопка уведомления */}
          {role !== 'admin' && !isPast && countDebtors > 0 && (
            <div style={{ display:'flex', gap:12, marginTop:20, flexWrap:'wrap' }}>
              <button className="btn-primary" style={{padding:'9px 20px'}}
                onClick={notifyDebtors} disabled={notifying}>
                {notifying ? 'Отправка...' : `Напомнить должникам (${countDebtors})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
