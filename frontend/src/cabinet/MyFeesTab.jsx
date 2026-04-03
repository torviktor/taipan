import { useState, useEffect } from 'react'
import { API } from './constants'

const STATUS = {
  paid:    { bg: '#1a2e1a', color: '#4caf50', label: 'ОПЛАЧЕНО' },
  due:     { bg: '#2a2410', color: '#f5c518', label: 'К ОПЛАТЕ' },
  overdue: { bg: '#2a1010', color: 'var(--red)', label: 'ПРОСРОЧЕНО' },
  pending: { bg: 'var(--dark2)', color: 'var(--gray)', label: 'ОЖИДАНИЕ' },
}

export default function MyFeesTab({ token }) {
  const [fees,    setFees]    = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadFees() }, [])

  const loadFees = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/fees/my`, { headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) setFees(await r.json())
    } catch {}
    setLoading(false)
  }

  const fmt = (n) => Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

  return (
    <div>
      <p className="section-label" style={{ marginBottom: 16 }}>Клубные взносы</p>

      {loading && <div className="cabinet-loading">Загрузка...</div>}

      {!loading && fees.length === 0 && (
        <div className="cabinet-empty">Данные о взносах появятся в начале месяца.</div>
      )}

      {!loading && fees.length > 0 && (
        <div className="athletes-table-wrap">
          <table className="athletes-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Период</th>
                <th>К оплате</th>
                <th>Внесено</th>
                <th>Долг</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {fees.map(f => {
                const st = STATUS[f.status] || STATUS.pending
                return (
                  <tr key={f.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{f.period_label || f.period}</td>
                    <td>{fmt(f.amount_due)}</td>
                    <td style={{ color: f.amount_paid > 0 ? '#4caf50' : 'var(--gray)' }}>{fmt(f.amount_paid)}</td>
                    <td style={{ color: f.debt > 0 ? 'var(--red)' : 'var(--gray)' }}>{fmt(f.debt)}</td>
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
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
