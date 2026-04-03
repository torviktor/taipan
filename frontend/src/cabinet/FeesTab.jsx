import { useState, useEffect, useMemo } from 'react'
import { API } from './constants'

const STATUS = {
  paid:    { bg: '#1a2e1a', color: '#4caf50', label: 'ОПЛАЧЕНО' },
  due:     { bg: '#2a2410', color: '#f5c518', label: 'К ОПЛАТЕ' },
  overdue: { bg: '#2a1010', color: 'var(--red)', label: 'ПРОСРОЧЕНО' },
  pending: { bg: 'var(--dark2)', color: 'var(--gray)', label: 'ОЖИДАНИЕ' },
}

export default function FeesTab({ token }) {
  const [deadlines,     setDeadlines]     = useState([])
  const [fees,          setFees]          = useState([])
  const [summary,       setSummary]       = useState(null)
  const [selectedPeriod, setSelectedPeriod] = useState('')
  const [filterStatus,  setFilterStatus]  = useState('')
  const [filterGroup,   setFilterGroup]   = useState('')
  const [deadlineModal, setDeadlineModal] = useState(false)
  const [payModal,      setPayModal]      = useState(null) // fee object
  const [loading,       setLoading]       = useState(false)

  // New deadline form
  const [newPeriod,   setNewPeriod]   = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const [newAmount,   setNewAmount]   = useState('')
  const [saving,      setSaving]      = useState(false)

  // Pay form
  const [payAmount, setPayAmount] = useState('')
  const [payNote,   setPayNote]   = useState('')

  useEffect(() => { loadDeadlines() }, [])
  useEffect(() => { loadFees(); loadSummary() }, [selectedPeriod])

  const loadDeadlines = async () => {
    try {
      const r = await fetch(`${API}/fees/deadlines`, { headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) {
        const data = await r.json()
        setDeadlines(data)
        if (data.length > 0 && !selectedPeriod) {
          setSelectedPeriod(data[0].period)
        }
      }
    } catch {}
  }

  const loadFees = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/fees/`, { headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) setFees(await r.json())
    } catch {}
    setLoading(false)
  }

  const loadSummary = async () => {
    try {
      const url = selectedPeriod
        ? `${API}/fees/summary?period=${selectedPeriod}`
        : `${API}/fees/summary`
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) setSummary(await r.json())
    } catch {}
  }

  const createDeadline = async () => {
    if (!newPeriod || !newDeadline || !newAmount) return
    setSaving(true)
    try {
      // Convert month input (YYYY-MM) to first day of month
      const periodDate = newPeriod.length === 7 ? `${newPeriod}-01` : newPeriod
      const r = await fetch(`${API}/fees/deadlines`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: periodDate, deadline: newDeadline, amount_due: parseFloat(newAmount) }),
      })
      if (r.ok) {
        setDeadlineModal(false)
        setNewPeriod(''); setNewDeadline(''); setNewAmount('')
        await loadDeadlines()
        await loadFees()
        await loadSummary()
      } else {
        const err = await r.json()
        alert(err.detail || 'Ошибка')
      }
    } catch {}
    setSaving(false)
  }

  const openPayModal = (fee) => {
    setPayModal(fee)
    setPayAmount(String(fee.debt > 0 ? fee.debt : fee.amount_due))
    setPayNote(fee.note || '')
  }

  const submitPay = async () => {
    if (!payModal) return
    setSaving(true)
    try {
      const r = await fetch(`${API}/fees/${payModal.id}/pay`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_paid: parseFloat(payAmount), note: payNote }),
      })
      if (r.ok) {
        setPayModal(null)
        loadFees(); loadSummary()
      } else {
        const err = await r.json()
        alert(err.detail || 'Ошибка')
      }
    } catch {}
    setSaving(false)
  }

  const exportXlsx = async () => {
    try {
      const url = selectedPeriod
        ? `${API}/fees/export?period=${selectedPeriod}`
        : `${API}/fees/export`
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (!r.ok) { alert('Ошибка экспорта'); return }
      const blob = await r.blob()
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = `fees_${selectedPeriod || 'all'}.xlsx`
      a.click()
      URL.revokeObjectURL(objUrl)
    } catch { alert('Ошибка экспорта') }
  }

  const filteredFees = useMemo(() => fees.filter(f => {
    if (selectedPeriod && f.period !== selectedPeriod) return false
    if (filterStatus && f.status !== filterStatus) return false
    if (filterGroup && f.athlete_group !== filterGroup) return false
    return true
  }), [fees, selectedPeriod, filterStatus, filterGroup])

  const groups = useMemo(() => [...new Set(fees.map(f => f.athlete_group).filter(Boolean))].sort(), [fees])

  const fmt = (n) => Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

  return (
    <div>
      {/* ── Модал нового дедлайна ── */}
      {deadlineModal && (
        <div className="modal-overlay" onClick={() => setDeadlineModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 style={{ marginBottom: 16 }}>Новый дедлайн</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ color: 'var(--gray)', fontSize: '0.8rem', display: 'block', marginBottom: 4 }}>Период (месяц)</label>
                <input
                  type="month"
                  value={newPeriod}
                  onChange={e => setNewPeriod(e.target.value)}
                  className="td-input"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ color: 'var(--gray)', fontSize: '0.8rem', display: 'block', marginBottom: 4 }}>Дата дедлайна</label>
                <input
                  type="date"
                  value={newDeadline}
                  onChange={e => setNewDeadline(e.target.value)}
                  className="td-input"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ color: 'var(--gray)', fontSize: '0.8rem', display: 'block', marginBottom: 4 }}>Сумма (руб.)</label>
                <input
                  type="number"
                  value={newAmount}
                  onChange={e => setNewAmount(e.target.value)}
                  placeholder="3000"
                  className="td-input"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="btn-primary" style={{ padding: '8px 20px', fontSize: '13px' }} onClick={createDeadline} disabled={saving}>
                {saving ? 'Сохранение...' : 'Создать'}
              </button>
              <button className="btn-outline" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => setDeadlineModal(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Модал оплаты ── */}
      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <h3 style={{ marginBottom: 8 }}>Внести оплату</h3>
            <p style={{ color: 'var(--gray)', fontSize: '0.9rem', marginBottom: 16 }}>{payModal.athlete_name}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ color: 'var(--gray)', fontSize: '0.8rem', display: 'block', marginBottom: 4 }}>Сумма (руб.)</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="td-input"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ color: 'var(--gray)', fontSize: '0.8rem', display: 'block', marginBottom: 4 }}>Примечание</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                  placeholder="необязательно"
                  className="td-input"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button className="btn-primary" style={{ padding: '8px 20px', fontSize: '13px' }} onClick={submitPay} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button className="btn-outline" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => setPayModal(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Топ-бар ── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <select
          value={selectedPeriod}
          onChange={e => setSelectedPeriod(e.target.value)}
          className="td-input"
          style={{ minWidth: 160 }}
        >
          <option value="">Все периоды</option>
          {deadlines.map(d => (
            <option key={d.id} value={d.period}>{d.period}</option>
          ))}
        </select>
        <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => setDeadlineModal(true)}>
          + Новый дедлайн
        </button>
        <button className="btn-outline" style={{ padding: '8px 14px', fontSize: '13px' }} onClick={exportXlsx}>
          Экспорт xlsx
        </button>
      </div>

      {/* ── Карточки сводки ── */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Итого к оплате', value: fmt(summary.total_due), color: 'var(--white)' },
            { label: 'Получено',       value: fmt(summary.total_paid), color: '#4caf50' },
            { label: 'Долг',           value: fmt(summary.total_debt), color: 'var(--red)' },
            { label: 'Просрочено',     value: summary.count_overdue,   color: '#f5c518' },
          ].map(card => (
            <div key={card.label} style={{ background: 'var(--dark2)', borderRadius: 8, padding: '12px 16px', border: '1px solid var(--gray-dim)' }}>
              <div style={{ color: 'var(--gray)', fontSize: '0.75rem', fontFamily: 'Barlow Condensed', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{card.label}</div>
              <div style={{ color: card.color, fontSize: '1.3rem', fontFamily: 'Bebas Neue', letterSpacing: '0.04em' }}>{card.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Фильтры ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="td-input">
          <option value="">Все статусы</option>
          <option value="paid">Оплачено</option>
          <option value="pending">Ожидание</option>
          <option value="due">К оплате</option>
          <option value="overdue">Просрочено</option>
        </select>
        <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} className="td-input">
          <option value="">Все группы</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* ── Таблица ── */}
      {loading && <div className="cabinet-loading">Загрузка...</div>}
      {!loading && (
        <div className="athletes-table-wrap">
          <table className="athletes-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Спортсмен</th>
                <th>Группа</th>
                <th>Родитель</th>
                <th>Телефон</th>
                <th>К оплате</th>
                <th>Внесено</th>
                <th>Долг</th>
                <th>Дедлайн</th>
                <th>Статус</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {filteredFees.map(f => {
                const st = STATUS[f.status] || STATUS.pending
                return (
                  <tr key={f.id}>
                    <td className="td-name">{f.athlete_name}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--gray)' }}>{f.athlete_group}</td>
                    <td style={{ fontSize: '0.82rem' }}>{f.parent_name}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--gray)' }}>{f.parent_phone}</td>
                    <td>{fmt(f.amount_due)}</td>
                    <td style={{ color: f.amount_paid > 0 ? '#4caf50' : 'var(--gray)' }}>{fmt(f.amount_paid)}</td>
                    <td style={{ color: f.debt > 0 ? 'var(--red)' : 'var(--gray)' }}>{fmt(f.debt)}</td>
                    <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{f.deadline || '—'}</td>
                    <td>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 3,
                        fontSize: '0.72rem', fontFamily: 'Barlow Condensed', fontWeight: 700,
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                        background: st.bg, color: st.color,
                        border: `1px solid ${st.color}44`, whiteSpace: 'nowrap',
                      }}>
                        {st.label}
                      </span>
                    </td>
                    <td>
                      {f.status !== 'paid' && (
                        <button className="td-btn td-btn-edit" onClick={() => openPayModal(f)}>Внести</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredFees.length === 0 && <div className="cabinet-empty">Взносов не найдено</div>}
        </div>
      )}
    </div>
  )
}
