import { useState } from 'react'
import { API } from './constants'

export default function AnalyticsModal({ token, athletes, preselectedAthleteId, preselectedAthleteName, applicationId, onClose, onSuccess }) {
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
