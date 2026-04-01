import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { API, currentSeason, seasonLabel } from './constants'
import ConfirmModal from './ConfirmModal'

const CAMP_STATUS = {
  pending:   { label: 'Ожидает ответа', color: 'var(--gray)' },
  confirmed: { label: 'Едет',           color: '#6cba6c' },
  declined:  { label: 'Не едет',        color: 'var(--red)' },
  paid:      { label: 'Оплачено',       color: '#c8962a' },
}

export default function CampsTab({ token, athletes }) {
  const [camps,   setCamps]   = useState([])
  const [detail,  setDetail]  = useState(null)
  const [parts,   setParts]   = useState([])
  const [loading, setLoading] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showAdd,  setShowAdd]  = useState(false)
  const [msg,     setMsg]     = useState('')
  const [campConfirm, setCampConfirm] = useState(null)
  const [season, setSeason] = useState(currentSeason)
  const [seasons, setSeasons] = useState([currentSeason])
  const [form, setForm] = useState({ name:'', date_start:'', date_end:'', location:'', price:'', notes:'' })

  const h  = { Authorization: `Bearer ${token}` }
  const hj = { ...h, 'Content-Type': 'application/json' }

  useEffect(() => {
    fetch(`${API}/camps/seasons`, { headers: h })
      .then(r => r.ok ? r.json() : [currentSeason])
      .then(s => setSeasons(s.length ? s : [currentSeason]))
      .catch(() => {})
  }, [])

  useEffect(() => { loadCamps() }, [season])

  // Автообновление деталей каждые 15 сек — подхватывает ответы родителей
  useEffect(() => {
    if (!detail) return
    const campId = detail.id
    const hdr = { Authorization: `Bearer ${token}` }
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`${API}/camps/${campId}`, { headers: hdr })
        if (r.ok) {
          const d = await r.json()
          setDetail(d)
          setParts(d.participants || [])
        }
      } catch {}
    }, 15000)
    return () => clearInterval(interval)
  }, [detail?.id])

  const loadCamps = async () => {
    setLoading(true)
    try { const r = await fetch(`${API}/camps`, { headers: h }); if (r.ok) setCamps(await r.json()) } catch {}
    setLoading(false)
  }

  const openDetail = async (camp) => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/camps/${camp.id}`, { headers: h })
      if (r.ok) { const d = await r.json(); setDetail(d); setParts(d.participants || []) }
    } catch {}
    setLoading(false)
  }

  const createCamp = async () => {
    if (!form.name || !form.date_start || !form.date_end) { setMsg('Заполните название и даты'); return }
    try {
      const r = await fetch(`${API}/camps`, {
        method: 'POST', headers: hj,
        body: JSON.stringify({ name: form.name, date_start: form.date_start, date_end: form.date_end, location: form.location || null, price: form.price ? parseFloat(form.price) : null, notes: form.notes || null })
      })
      if (r.ok) {
        const created = await r.json()
        setShowForm(false)
        setForm({ name:'', date_start:'', date_end:'', location:'', price:'', notes:'' })
        await loadCamps()
        await openDetail(created)
      }
      else { const d = await r.json(); setMsg(d.detail || 'Ошибка') }
    } catch { setMsg('Ошибка') }
  }

  const deleteCamp = async (id, e) => {
    e.stopPropagation()
    setCampConfirm({
      message: 'Удалить сборы и все данные об участниках?',
      confirmText: 'Удалить',
      onConfirm: async () => {
        setCampConfirm(null)
        await fetch(`${API}/camps/${id}`, { method: 'DELETE', headers: h })
        if (detail?.id === id) { setDetail(null); setParts([]) }
        await loadCamps()
      }
    })
  }

  const saveParticipants = async () => {
    if (!detail) return
    setSaving(true)
    try {
      const r = await fetch(`${API}/camps/${detail.id}/participants`, {
        method: 'PUT', headers: hj,
        body: JSON.stringify({ athlete_ids: parts.map(p => p.athlete_id) })
      })
      if (r.ok) {
        // Не перезаписываем parts — статусы уже правильные в локальном стейте
        // Обновляем только detail (счётчики)
        const d = await (await fetch(`${API}/camps/${detail.id}`, { headers: h })).json()
        setDetail(d)
        setMsg('Список сохранён')
      }
    } catch { setMsg('Ошибка') }
    setSaving(false)
  }

  const exportCampXlsx = () => {
    if (!detail) return
    const wb = XLSX.utils.book_new()
    const STATUS_RU = { confirmed:'Едет', paid:'Оплачено', pending:'Ожидает', declined:'Не едет' }
    const going    = parts.filter(p => p.status === 'confirmed' || p.status === 'paid')
    const pending  = parts.filter(p => p.status === 'pending')
    const declined = parts.filter(p => p.status === 'declined')

    const toRows = (arr) => arr.map((p, i) => [
      i+1, p.full_name, p.group||'—', STATUS_RU[p.status]||p.status, p.paid ? 'Да' : 'Нет'
    ])
    const header = ['№', 'Спортсмен', 'Группа', 'Статус', 'Оплачено']

    // Один лист со всеми
    const allRows = [header, ...toRows(going), ...toRows(pending), ...toRows(declined)]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(allRows), 'Все участники')

    // Лист только едущих
    if (going.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...toRows(going)]), 'Едут')
    }

    XLSX.writeFile(wb, `${detail.name}_участники.xlsx`)
  }

  const updateStatus = async (athlete_id, status, paid) => {
    if (!detail) return
    try {
      const r = await fetch(`${API}/camps/${detail.id}/participants/${athlete_id}`, {
        method: 'PATCH', headers: hj,
        body: JSON.stringify({ status, paid: paid ?? undefined })
      })
      if (r.ok) setParts(prev => prev.map(p => p.athlete_id === athlete_id ? { ...p, status, paid: paid ?? p.paid } : p))
    } catch {}
  }

  const notifyCamp = async () => {
    if (!detail) return
    try {
      const r = await fetch(`${API}/camps/${detail.id}/notify`, { method: 'POST', headers: hj })
      if (r.ok) { const d = await r.json(); setMsg(`Уведомлений отправлено: ${d.sent}`) }
    } catch { setMsg('Ошибка') }
  }

  const addAthlete = (a) => {
    if (parts.find(p => p.athlete_id === a.id)) return
    setParts(prev => [...prev, { athlete_id: a.id, full_name: a.full_name, group: a.group || a.auto_group, status: 'pending', paid: false }])
    setShowAdd(false)
  }

  const removeParticipant = (id) => setParts(prev => prev.filter(p => p.athlete_id !== id))
  const notInList = athletes.filter(a => !parts.find(p => p.athlete_id === a.id))

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' }) : ''
  const confirmedCount = parts.filter(p => p.status === 'confirmed' || p.status === 'paid').length
  const paidCount      = parts.filter(p => p.paid).length

  return (
    <div className="comp-wrap">
      {campConfirm && <ConfirmModal message={campConfirm.message} confirmText={campConfirm.confirmText} danger={true} onConfirm={campConfirm.onConfirm} onCancel={() => setCampConfirm(null)}/>}
      <div className="comp-top">
        <div className="comp-top-left">
          {detail && <button className="att-all-btn" onClick={() => { setDetail(null); setParts([]); setMsg('') }}>← К списку</button>}
          {!detail && (
            <select className="att-date-input" value={season} onChange={e => setSeason(e.target.value === '' ? '' : Number(e.target.value))} style={{width:'auto'}}>
              <option value="">Все сезоны</option>
              {seasons.map(y=>(
                <option key={y} value={y}>{seasonLabel(y)}</option>
              ))}
            </select>
          )}
        </div>
        <div className="comp-top-right">
          {!detail && <button className="btn-primary" style={{ padding:'8px 18px', fontSize:'14px' }} onClick={() => { setShowForm(true); setMsg('') }}>+ Сборы</button>}
          {detail && (
            <>
              <button className="att-all-btn" onClick={notifyCamp}>Уведомить участников</button>
              <button className="att-all-btn" onClick={() => setShowAdd(true)}>+ Участник</button>
              <button className="att-all-btn" onClick={exportCampXlsx}>Экспорт xlsx</button>
              <button className="btn-primary" style={{ padding:'8px 18px', fontSize:'14px' }} onClick={saveParticipants} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить список'}
              </button>
            </>
          )}
        </div>
      </div>

      {msg && <div className="att-msg">{msg}</div>}
      {loading && <div className="cabinet-loading">Загрузка...</div>}

      {/* Список сборов */}
      {!loading && !detail && (
        <div className="comp-list">
          {camps.length === 0 && <div className="cabinet-empty">Сборов пока нет.</div>}
          {camps.map(c => (
            <div key={c.id} className="comp-card" onClick={() => openDetail(c)}>
              <div className="comp-card-body">
                <div className="comp-card-name">{c.name}</div>
                <div className="comp-card-meta">
                  <span className="comp-card-date">{formatDate(c.date_start)} — {formatDate(c.date_end)}</span>
                  {c.location && <span className="comp-card-date">/ {c.location}</span>}
                  {c.price && <span className="comp-badge">{c.price} руб.</span>}
                  <span className="comp-badge" style={{ color:'#6cba6c' }}>{c.confirmed}/{c.total} едут</span>
                  {c.paid > 0 && <span className="comp-badge" style={{ color:'#c8962a' }}>{c.paid} оплатили</span>}
                </div>
              </div>
              <div className="comp-card-right">
                <button className="td-btn td-btn-del" onClick={e => deleteCamp(c.id, e)}>Удал.</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Детальный вид */}
      {!loading && detail && (
        <div className="comp-detail">
          <div className="comp-detail-head">
            <div>
              <div className="comp-detail-name">{detail.name}</div>
              <div className="comp-card-meta" style={{ marginTop:4 }}>
                <span className="comp-card-date">{formatDate(detail.date_start)} — {formatDate(detail.date_end)}</span>
                {detail.location && <span className="comp-card-date">/ {detail.location}</span>}
                {detail.price && <span className="comp-badge">{detail.price} руб.</span>}
                <span className="comp-badge" style={{ color:'#6cba6c' }}>{confirmedCount} едут</span>
                <span className="comp-badge" style={{ color:'#c8962a' }}>{paidCount} оплатили</span>
              </div>
            </div>
          </div>

          {/* Блок едут */}
          {parts.filter(p => p.status === 'confirmed' || p.status === 'paid').length > 0 && (
            <div style={{ marginBottom:24 }}>
              <div style={{
                fontFamily:'Bebas Neue', fontSize:'1.1rem', letterSpacing:'0.12em',
                color:'#6cba6c', marginBottom:16, marginTop:8,
                paddingBottom:8, borderBottom:'1px solid #1a3a1a',
                textAlign:'center', textShadow:'0 0 12px rgba(108,186,108,0.4)'
              }}>
                ▸ ЕДУТ — {parts.filter(p => p.status === 'confirmed' || p.status === 'paid').length} чел.
              </div>
              <table className="athletes-table">
                <thead><tr>
                  <th style={{textAlign:'left'}}>Спортсмен</th>
                  <th>Группа</th>
                  <th>Статус</th>
                  <th>Оплата</th>
                  <th></th>
                </tr></thead>
                <tbody>
                  {parts.filter(p => p.status === 'confirmed' || p.status === 'paid').map(p => (
                    <tr key={p.athlete_id}>
                      <td className="td-name">{p.full_name}</td>
                      <td style={{fontSize:'0.82rem',color:'var(--gray)'}}>{p.group||'—'}</td>
                      <td>
                        <select className="td-input" value={p.status} onChange={e => updateStatus(p.athlete_id, e.target.value, undefined)}>
                          <option value="pending">Ожидает</option>
                          <option value="confirmed">Едет</option>
                          <option value="declined">Не едет</option>
                          <option value="paid">Оплачено</option>
                        </select>
                      </td>
                      <td>
                        <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',justifyContent:'center'}}>
                          <input type="checkbox" checked={p.paid} onChange={e => updateStatus(p.athlete_id, e.target.checked ? 'paid' : 'confirmed', e.target.checked)}/>
                          <span style={{fontSize:'0.8rem',color: p.paid ? '#c8962a' : 'var(--gray)'}}>{p.paid ? 'Оплачено' : 'Не оплачено'}</span>
                        </label>
                      </td>
                      <td><button className="td-btn td-btn-del" onClick={() => removeParticipant(p.athlete_id)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Блок ожидают ответа */}
          {parts.filter(p => p.status === 'pending').length > 0 && (
            <div style={{ marginBottom:20, opacity:0.6 }}>
              <div style={{
                fontFamily:'Bebas Neue', fontSize:'1.1rem', letterSpacing:'0.12em',
                color:'var(--gray)', marginBottom:16, marginTop:8,
                paddingBottom:8, borderBottom:'1px solid var(--gray-dim)',
                textAlign:'center'
              }}>
                ▸ ОЖИДАЮТ ОТВЕТА — {parts.filter(p => p.status === 'pending').length} чел.
              </div>
              <table className="athletes-table">
                <tbody>
                  {parts.filter(p => p.status === 'pending').map(p => (
                    <tr key={p.athlete_id}>
                      <td className="td-name">{p.full_name}</td>
                      <td style={{fontSize:'0.82rem',color:'var(--gray)'}}>{p.group||'—'}</td>
                      <td>
                        <select className="td-input" value={p.status} onChange={e => updateStatus(p.athlete_id, e.target.value, undefined)}>
                          <option value="pending">Ожидает</option>
                          <option value="confirmed">Едет</option>
                          <option value="declined">Не едет</option>
                          <option value="paid">Оплачено</option>
                        </select>
                      </td>
                      <td></td>
                      <td><button className="td-btn td-btn-del" onClick={() => removeParticipant(p.athlete_id)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Блок не едут */}
          {parts.filter(p => p.status === 'declined').length > 0 && (
            <div style={{ opacity:0.35 }}>
              <div style={{
                fontFamily:'Bebas Neue', fontSize:'1.1rem', letterSpacing:'0.12em',
                color:'var(--red)', marginBottom:16, marginTop:8,
                paddingBottom:8, borderBottom:'1px solid #3a1a1a',
                textAlign:'center'
              }}>
                ▸ НЕ ЕДУТ — {parts.filter(p => p.status === 'declined').length} чел.
              </div>
              <table className="athletes-table">
                <tbody>
                  {parts.filter(p => p.status === 'declined').map(p => (
                    <tr key={p.athlete_id}>
                      <td className="td-name" style={{color:'var(--gray)'}}>{p.full_name}</td>
                      <td style={{fontSize:'0.82rem',color:'var(--gray)'}}>{p.group||'—'}</td>
                      <td>
                        <select className="td-input" value={p.status} onChange={e => updateStatus(p.athlete_id, e.target.value, undefined)}>
                          <option value="pending">Ожидает</option>
                          <option value="confirmed">Едет</option>
                          <option value="declined">Не едет</option>
                        </select>
                      </td>
                      <td></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {parts.length === 0 && <div className="cabinet-empty">Список пуст.</div>}
        </div>
      )}

      {/* Модал создания */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box comp-modal" onClick={e => e.stopPropagation()} style={{ maxWidth:520 }}>
            <h3>Новые сборы</h3>
            <div className="comp-form-grid">
              <div className="comp-field comp-field-full"><label>Название *</label>
                <input type="text" className="modal-input" placeholder="Летние сборы 2026" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></div>
              <div className="comp-field"><label>Дата начала *</label>
                <input type="date" className="modal-input" value={form.date_start} onChange={e=>setForm(p=>({...p,date_start:e.target.value}))}/></div>
              <div className="comp-field"><label>Дата окончания *</label>
                <input type="date" className="modal-input" value={form.date_end} onChange={e=>setForm(p=>({...p,date_end:e.target.value}))}/></div>
              <div className="comp-field"><label>Место</label>
                <input type="text" className="modal-input" placeholder="Подмосковье, база «Олимп»" value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))}/></div>
              <div className="comp-field"><label>Стоимость (руб.)</label>
                <input type="number" className="modal-input" placeholder="5000" value={form.price} onChange={e=>setForm(p=>({...p,price:e.target.value}))}/></div>
              <div className="comp-field comp-field-full"><label>Примечание</label>
                <input type="text" className="modal-input" value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}/></div>
            </div>
            {msg && <div className="modal-msg">{msg}</div>}
            <div className="modal-msg" style={{ background:'#1a1200', border:'1px solid #c8962a', color:'#c8962a', marginBottom:8 }}>
              При создании все зарегистрированные пользователи получат уведомление с опросом об участии.
            </div>
            <div className="modal-btns-row">
              <button className="btn-primary" onClick={createCamp}>Создать и уведомить всех</button>
              <button className="btn-outline" onClick={() => setShowForm(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Модал добавления участника */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Добавить участника</h3>
            {notInList.length === 0
              ? <p style={{ color:'var(--gray)' }}>Все спортсмены уже в списке.</p>
              : notInList.map(a => (
                  <div key={a.id} className="att-athlete-row absent" style={{ cursor:'pointer' }} onClick={() => addAthlete(a)}>
                    <div className="att-athlete-name">{a.full_name}</div>
                    <div className="att-athlete-age">{a.age} лет · {a.group || a.auto_group}</div>
                  </div>
                ))
            }
            <div className="modal-btns-row" style={{ marginTop:12 }}>
              <button className="btn-outline" onClick={() => setShowAdd(false)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
