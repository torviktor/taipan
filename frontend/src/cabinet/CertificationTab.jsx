import { useState, useEffect } from 'react'
import { API, currentSeason, seasonRange, seasonLabel } from './constants'
import ConfirmModal from './ConfirmModal'

export default function CertificationTab({ token, athletes }) {
  const [certs,       setCerts]       = useState([])
  const [detail,      setDetail]      = useState(null)
  const [rows,        setRows]        = useState([])
  const [loading,     setLoading]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [showForm,    setShowForm]    = useState(false)
  const [showAdd,     setShowAdd]     = useState(false)
  const [msg,         setMsg]         = useState('')
  const [confirm,     setConfirm]     = useState(null)
  const [season,      setSeason]      = useState(currentSeason)
  const [seasons,     setSeasons]     = useState([currentSeason])
  const [form, setForm] = useState({ name: '', date: '', location: '', notes: '' })

  const h  = { Authorization: `Bearer ${token}` }
  const hj = { ...h, 'Content-Type': 'application/json' }

  useEffect(() => {
    fetch(`${API}/certifications/seasons`, { headers: h })
      .then(r => r.ok ? r.json() : [currentSeason])
      .then(s => { setSeasons(s.length ? s : [currentSeason]) })
      .catch(() => {})
  }, [])

  useEffect(() => { loadCerts() }, [season])

  const loadCerts = async () => {
    setLoading(true)
    try {
      const url = season !== '' ? (() => { const {start,end} = seasonRange(season); return `${API}/certifications?date_from=${start}&date_to=${end}` })() : `${API}/certifications`
      const r = await fetch(url, { headers: h })
      if (r.ok) setCerts(await r.json())
    } catch {}
    setLoading(false)
  }

  const openDetail = async (cert) => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/certifications/${cert.id}`, { headers: h })
      if (!r.ok) return
      const d = await r.json()
      setDetail(d)
      const existingMap = {}
      ;(d.results || []).forEach(res => { existingMap[res.athlete_id] = res })
      setRows(Object.values(existingMap))
    } catch {}
    setLoading(false)
  }

  const saveRows = async () => {
    if (!detail) return
    setSaving(true); setMsg('')
    try {
      const payload = rows.map(r => ({
        athlete_id: r.athlete_id,
        target_gup: r.target_gup || null,
        target_dan: r.target_dan || null,
        passed:     r.passed ?? null,
      }))
      const r = await fetch(`${API}/certifications/${detail.id}/results`, {
        method: 'PUT', headers: hj, body: JSON.stringify({ results: payload })
      })
      if (r.ok) { setMsg('Список сохранён'); await openDetail(detail) }
      else setMsg('Ошибка сохранения')
    } catch { setMsg('Ошибка сохранения') }
    setSaving(false)
  }

  const finalize = () => {
    setConfirm({
      message: 'Завершить аттестацию? Гыпы и даны будут автоматически обновлены у всех сдавших спортсменов.',
      confirmText: 'Завершить',
      danger: true,
      onConfirm: async () => {
        setConfirm(null)
        try {
          const r = await fetch(`${API}/certifications/${detail.id}/finalize`, { method: 'POST', headers: hj })
          if (r.ok) {
            const d = await r.json()
            setMsg(`Завершено. Обновлено спортсменов: ${d.updated_athletes}`)
            await loadCerts(); await openDetail(detail)
          }
        } catch { setMsg('Ошибка') }
      }
    })
  }

  const sendNotify = async () => {
    if (!detail) return
    try {
      const r = await fetch(`${API}/certifications/${detail.id}/notify`, { method: 'POST', headers: hj })
      if (r.ok) { const d = await r.json(); setMsg(`Уведомлений отправлено: ${d.sent}`) }
    } catch { setMsg('Ошибка отправки') }
  }

  const createCert = async () => {
    if (!form.name.trim() || !form.date) { setMsg('Заполните название и дату'); return }
    try {
      const r = await fetch(`${API}/certifications`, {
        method: 'POST', headers: hj,
        body: JSON.stringify({ name: form.name, date: form.date, location: form.location || null, notes: form.notes || null })
      })
      if (r.ok) {
        setShowForm(false)
        setForm({ name: '', date: '', location: '', notes: '' })
        await loadCerts()
      } else { const d = await r.json(); setMsg(d.detail || 'Ошибка') }
    } catch { setMsg('Ошибка создания') }
  }

  const deleteCert = (id, e) => {
    e.stopPropagation()
    setConfirm({
      message: 'Удалить аттестацию и все её результаты?',
      confirmText: 'Удалить',
      danger: true,
      onConfirm: async () => {
        setConfirm(null)
        await fetch(`${API}/certifications/${id}`, { method: 'DELETE', headers: h })
        if (detail?.id === id) { setDetail(null); setRows([]) }
        await loadCerts()
      }
    })
  }

  const addAthlete = (a) => {
    if (rows.find(r => r.athlete_id === a.id)) return
    const nextGup = a.gup && a.gup > 1 ? a.gup - 1 : null
    setRows(prev => [...prev, {
      athlete_id: a.id, full_name: a.full_name, group: a.group || a.auto_group,
      current_gup: a.gup, current_dan: a.dan,
      target_gup: nextGup, target_dan: null, passed: null
    }])
    setShowAdd(false)
  }

  const removeRow = (id) => setRows(prev => prev.filter(r => r.athlete_id !== id))
  const updateRow = (id, field, val) => setRows(prev => prev.map(r => r.athlete_id === id ? { ...r, [field]: val } : r))

  const notInList = athletes.filter(a => !rows.find(r => r.athlete_id === a.id))

  const statusLabel = (s) => s === 'planned' ? 'Планируется' : s === 'active' ? 'Идёт' : 'Завершена'
  const statusColor = (s) => s === 'completed' ? '#6cba6c' : s === 'active' ? '#c8962a' : 'var(--gray)'

  return (
    <div className="comp-wrap">
      {confirm && <ConfirmModal message={confirm.message} confirmText={confirm.confirmText} danger={confirm.danger} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)}/>}
      <div className="comp-top">
        <div className="comp-top-left">
          {detail && <button className="att-all-btn" onClick={() => { setDetail(null); setRows([]); setMsg('') }}>← К списку</button>}
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
          {!detail && <button className="btn-primary" style={{ padding:'8px 18px', fontSize:'14px' }} onClick={() => { setShowForm(true); setMsg('') }}>+ Аттестация</button>}
          {detail && detail.status !== 'completed' && (
            <>
              <button className="att-all-btn" onClick={sendNotify} title={detail.notify_sent ? 'Уведомления уже отправлены' : 'Уведомить родителей'}>
                {detail.notify_sent ? 'Уведомлено' : 'Уведомить'}
              </button>
              <button className="att-all-btn" onClick={() => setShowAdd(true)}>+ Добавить</button>
              <button className="att-all-btn" onClick={finalize}>Завершить аттестацию</button>
              <button className="btn-primary" style={{ padding:'8px 18px', fontSize:'14px' }} onClick={saveRows} disabled={saving}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </>
          )}
        </div>
      </div>

      {msg && <div className="att-msg">{msg}</div>}
      {loading && <div className="cabinet-loading">Загрузка...</div>}

      {/* Список аттестаций */}
      {!loading && !detail && (
        <div className="comp-list">
          {certs.length === 0 && <div className="cabinet-empty">Аттестаций пока нет.</div>}
          {certs.map(c => (
            <div key={c.id} className="comp-card" onClick={() => openDetail(c)}>
              <div className="comp-card-body">
                <div className="comp-card-name">{c.name}</div>
                <div className="comp-card-meta">
                  <span className="comp-card-date">{new Date(c.date).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}</span>
                  {c.location && <span className="comp-card-date">/ {c.location}</span>}
                  <span style={{ fontSize:'0.75rem', color: statusColor(c.status), fontWeight:600 }}>{statusLabel(c.status)}</span>
                  {c.notify_sent && <span className="comp-badge" style={{ background:'#1a2a1a', color:'#6cba6c' }}>Уведомлено</span>}
                </div>
              </div>
              <div className="comp-card-right">
                <button className="td-btn td-btn-del" onClick={e => deleteCert(c.id, e)}>Удал.</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Список кандидатов */}
      {!loading && detail && (
        <div className="comp-detail">
          <div className="comp-detail-head">
            <div>
              <div className="comp-detail-name">{detail.name}</div>
              <div className="comp-card-meta" style={{ marginTop:4 }}>
                <span className="comp-card-date">{new Date(detail.date).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}</span>
                {detail.location && <span className="comp-card-date">/ {detail.location}</span>}
                <span style={{ fontSize:'0.75rem', color: statusColor(detail.status), fontWeight:600 }}>{statusLabel(detail.status)}</span>
              </div>
            </div>
          </div>
          <div className="athletes-table-wrap">
            <table className="athletes-table">
              <thead><tr>
                <th style={{ textAlign:'left' }}>Спортсмен</th>
                <th>Группа</th>
                <th>Текущий</th>
                <th>Целевой гып/дан</th>
                <th>Результат</th>
                <th>Оплата</th>
                <th></th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.athlete_id} style={r.passed === true ? { background:'#0d1f0d' } : r.passed === false ? { background:'#1f0d0d' } : {}}>
                    <td className="td-name">{r.full_name}</td>
                    <td style={{ fontSize:'0.82rem', color:'var(--gray)' }}>{r.group || '—'}</td>
                    <td style={{ textAlign:'center' }}>
                      {r.current_dan ? `${r.current_dan} дан` : r.current_gup ? `${r.current_gup} гып` : '—'}
                    </td>
                    <td>
                      {detail.status !== 'completed' ? (
                        <div style={{ display:'flex', gap:4 }}>
                          <input type="number" min="1" max="10" placeholder="гып" className="td-input td-input-sm"
                            value={r.target_gup || ''} onChange={e => updateRow(r.athlete_id, 'target_gup', e.target.value ? parseInt(e.target.value) : null)} style={{ width:52 }}/>
                          <input type="number" min="1" max="9" placeholder="дан" className="td-input td-input-sm"
                            value={r.target_dan || ''} onChange={e => updateRow(r.athlete_id, 'target_dan', e.target.value ? parseInt(e.target.value) : null)} style={{ width:52 }}/>
                        </div>
                      ) : (
                        r.target_dan ? `${r.target_dan} дан` : r.target_gup ? `${r.target_gup} гып` : '—'
                      )}
                    </td>
                    <td>
                      {detail.status !== 'completed' ? (
                        <select className="td-input" value={r.passed === null ? '' : r.passed ? 'true' : 'false'}
                          onChange={e => updateRow(r.athlete_id, 'passed', e.target.value === '' ? null : e.target.value === 'true')}>
                          <option value="">Не отмечено</option>
                          <option value="true">Сдал</option>
                          <option value="false">Не сдал</option>
                        </select>
                      ) : (
                        <span style={{ color: r.passed ? '#6cba6c' : 'var(--red)', fontWeight:600 }}>
                          {r.passed === null ? '—' : r.passed ? 'Сдал' : 'Не сдал'}
                        </span>
                      )}
                    </td>
                    <td style={{textAlign:'center'}}>
                      <input type="checkbox" checked={r.paid||false}
                        onChange={async e => {
                          const paid = e.target.checked
                          updateRow(r.athlete_id, 'paid', paid)
                          await fetch(`${API}/certifications/${detail.id}/results/${r.athlete_id}/paid?paid=${paid}`, {
                            method:'PATCH', headers:{Authorization:`Bearer ${token}`}
                          })
                        }}
                        title={r.paid ? 'Оплачено' : 'Не оплачено'}
                      />
                    </td>
                    <td>{detail.status !== 'completed' && <button className="td-btn td-btn-del" onClick={() => removeRow(r.athlete_id)}>✕</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && <div className="cabinet-empty">Нет кандидатов. Нажмите «+ Добавить».</div>}
          </div>
        </div>
      )}

      {/* Модал создания */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box comp-modal" onClick={e => e.stopPropagation()}>
            <h3>Новая аттестация</h3>
            <div className="comp-form-grid">
              <div className="comp-field comp-field-full"><label>Название *</label>
                <input type="text" className="modal-input" placeholder="Аттестация апрель 2026" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}/>
              </div>
              <div className="comp-field"><label>Дата *</label>
                <input type="date" className="modal-input" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}/>
              </div>
              <div className="comp-field"><label>Место</label>
                <input type="text" className="modal-input" placeholder="Зал клуба" value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}/>
              </div>
              <div className="comp-field comp-field-full"><label>Примечание</label>
                <input type="text" className="modal-input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}/>
              </div>
            </div>
            {msg && <div className="modal-msg">{msg}</div>}
            <div className="modal-btns-row">
              <button className="btn-primary" onClick={createCert}>Создать</button>
              <button className="btn-outline" onClick={() => setShowForm(false)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Модал добавления спортсмена */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Добавить кандидата</h3>
            {notInList.length === 0
              ? <p style={{ color:'var(--gray)' }}>Все спортсмены уже в списке.</p>
              : notInList.map(a => (
                  <div key={a.id} className="att-athlete-row absent" style={{ cursor:'pointer' }} onClick={() => addAthlete(a)}>
                    <div className="att-athlete-name">{a.full_name}</div>
                    <div className="att-athlete-age">
                      {a.age} лет · {a.dan ? `${a.dan} дан` : a.gup === 0 ? 'Без пояса' : a.gup ? `${a.gup} гып` : 'пояс не указан'}
                    </div>
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
