import { useState, useEffect } from 'react'
import { API } from './constants'
import ConfirmModal from './ConfirmModal'

function AnalyticsModal({ token, athletes, preselectedAthleteId, preselectedAthleteName, applicationId, onClose, onSuccess }) {
  const [athleteId, setAthleteId] = useState(preselectedAthleteId || '')
  const [title, setTitle]         = useState('')
  const [comment, setComment]     = useState('')
  const [file, setFile]           = useState(null)
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState('')

  const submit = async () => {
    if (!athleteId) { setMsg('Выберите спортсмена'); return }
    if (!title.trim()) { setMsg('Введите название'); return }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('athlete_id', athleteId)
      fd.append('title', title.trim())
      if (comment.trim()) fd.append('comment', comment.trim())
      if (applicationId) fd.append('application_id', applicationId)
      if (file) fd.append('file', file)

      const r = await fetch(`${API}/analytics`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      if (r.ok) {
        onSuccess()
      } else {
        const d = await r.json()
        setMsg(d.detail || 'Ошибка')
      }
    } catch { setMsg('Ошибка отправки') }
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{maxWidth:520, width:'90vw', boxSizing:'border-box'}}>
        <h3 style={{marginBottom:20}}>Новая аналитика</h3>
        <div className="comp-form-grid">
          <div className="comp-field comp-field-full">
            <label>Спортсмен *</label>
            {preselectedAthleteId ? (
              <input type="text" className="modal-input" value={preselectedAthleteName || ''} disabled style={{opacity:0.7, cursor:'not-allowed'}}/>
            ) : (
              <select className="modal-input" value={athleteId} onChange={e => setAthleteId(e.target.value)}>
                <option value="">-- Выберите спортсмена --</option>
                {athletes.filter(a=>!a.is_archived).map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
              </select>
            )}
          </div>
          <div className="comp-field comp-field-full">
            <label>Название *</label>
            <input type="text" className="modal-input" placeholder="Аналитика за март 2026" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="comp-field comp-field-full">
            <label>Комментарий</label>
            <textarea className="modal-input" rows={3} placeholder="Краткий комментарий..." value={comment} onChange={e => setComment(e.target.value)} style={{resize:'vertical', minHeight:60}} />
          </div>
          <div className="comp-field comp-field-full">
            <label>Файл (PDF, Excel, изображение и т.д.)</label>
            <input type="file" onChange={e => setFile(e.target.files[0] || null)} style={{color:'var(--gray)', fontSize:'13px'}} />
            {file && <div style={{fontSize:'12px', color:'var(--gray)', marginTop:4}}>Выбран: {file.name}</div>}
          </div>
        </div>
        {msg && <div className="att-msg" style={{marginTop:8}}>{msg}</div>}
        <div className="modal-btns-row" style={{marginTop:16}}>
          <button className="btn-primary" onClick={submit} disabled={saving}>{saving ? 'Отправка...' : 'Отправить'}</button>
          <button className="btn-outline" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

export default function AnalyticsAdminTab({ token, athletes }) {
  const [records, setRecords]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [confirm, setConfirm]     = useState(null)
  const [exporting, setExporting] = useState(null)

  const h = { Authorization: `Bearer ${token}` }
  const userPhone = (localStorage.getItem('phone') || '').replace(/[\+\s\-\(\)]/g, '')
  const isDataAdmin = userPhone === '79253653597'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`${API}/analytics`, { headers: h })
      if (r.ok) setRecords(await r.json())
    } catch {}
    setLoading(false)
  }

  function remove(item) {
    setConfirm({
      message: `Удалить аналитику "${item.title}"?`,
      confirmText: 'Удалить', danger: true,
      onConfirm: async () => {
        setConfirm(null)
        await fetch(`${API}/analytics/${item.id}`, { method: 'DELETE', headers: h })
        await load()
      }
    })
  }

  async function exportData(athleteId, athleteName) {
    setExporting(athleteId)
    try {
      const r = await fetch(`${API}/analytics/export/${athleteId}`, { headers: h })
      if (!r.ok) { const d = await r.json(); alert(d.detail || 'Ошибка'); setExporting(null); return }
      const data = await r.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const safeName = athleteName.replace(/\s+/g, '_')
      link.download = `analytics_${safeName}_${new Date().toISOString().split('T')[0]}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch { alert('Ошибка выгрузки') }
    setExporting(null)
  }

  if (loading) return <div className="cabinet-loading">Загрузка...</div>

  return (
    <div>
      {confirm && <ConfirmModal message={confirm.message} confirmText={confirm.confirmText} danger={confirm.danger} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)}/>}

      {showModal && <AnalyticsModal
        token={token} athletes={athletes}
        preselectedAthleteId={null} preselectedAthleteName={null} applicationId={null}
        onClose={() => setShowModal(false)}
        onSuccess={() => { setShowModal(false); load() }}
      />}

      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16}}>
        <div style={{color:'var(--gray)', fontSize:'0.85rem'}}>
          Аналитические отчёты для спортсменов. Родители получают уведомление и могут скачать файл.
        </div>
        <button className="btn-primary" style={{padding:'8px 18px', fontSize:'14px', whiteSpace:'nowrap'}}
          onClick={() => setShowModal(true)}>+ Аналитика</button>
      </div>

      {records.length === 0 && <div className="cabinet-empty">Аналитических отчётов пока нет.</div>}

      {records.length > 0 && (
        <div className="athletes-table-wrap">
          <table className="athletes-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th style={{textAlign:'left'}}>Спортсмен</th>
                <th style={{textAlign:'left'}}>Название</th>
                <th style={{textAlign:'left'}}>Комментарий</th>
                <th>Файл</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td style={{whiteSpace:'nowrap'}}>{new Date(r.created_at).toLocaleDateString('ru')}</td>
                  <td className="td-name">{r.athlete_name || '--'}</td>
                  <td>{r.title}</td>
                  <td style={{fontSize:'13px', color:'var(--gray)', maxWidth:'200px'}}>{r.comment || '--'}</td>
                  <td style={{textAlign:'center'}}>
                    {r.file_path
                      ? <button style={{color:'var(--red)', fontSize:'13px', fontWeight:700, background:'none', border:'none', cursor:'pointer', padding:0}}
                    onClick={async () => {
                      const filename = r.file_path.split('/').pop()
                      const res = await fetch(`/api/analytics/download/${filename}`, { headers: { Authorization: `Bearer ${token}` } })
                      if (res.ok) { const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url) }
                    }}>Скачать</button>
                      : <span style={{color:'var(--gray-dim)'}}>--</span>}
                  </td>
                  <td>
                    <button className="td-btn td-btn-del" onClick={() => remove(r)}>Удал.</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Выгрузка данных — только для аналитика */}
      {isDataAdmin && (
        <div style={{marginTop:32, borderTop:'1px solid var(--gray-dim)', paddingTop:20}}>
          <div style={{ fontFamily:'Bebas Neue', fontSize:'1.2rem', letterSpacing:'0.06em', color:'var(--white)', marginBottom:12 }}>Выгрузка данных для Claude</div>
          <div style={{color:'var(--gray)', fontSize:'0.85rem', marginBottom:12}}>Выберите спортсмена для выгрузки полного досье (JSON с промтом для Claude).</div>
          <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
            {athletes.filter(a=>!a.is_archived).map(a => (
              <button key={a.id} className="td-btn td-btn-edit"
                style={{padding:'6px 12px', fontSize:'12px'}}
                disabled={exporting === a.id}
                onClick={() => exportData(a.id, a.full_name)}>
                {exporting === a.id ? '...' : a.full_name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
