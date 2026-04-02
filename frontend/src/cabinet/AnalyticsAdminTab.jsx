import { useState, useEffect } from 'react'
import { API } from './constants'
import ConfirmModal from './ConfirmModal'
import AnalyticsModal from './AnalyticsModal'

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
      const tok = localStorage.getItem('token')
      const r = await fetch(`${API}/analytics/export/${athleteId}`, { headers: { Authorization: `Bearer ${tok}` } })
      if (!r.ok) { let msg = 'Ошибка'; try { const d = await r.json(); msg = d.detail || msg } catch {} alert(msg); setExporting(null); return }
      const data = await r.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const safeName = athleteName.replace(/\s+/g, '_')
      link.download = `analytics_${safeName}_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
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
                      try {
                        const tok = localStorage.getItem('token')
                        const filename = r.file_path.split('/').pop()
                        const res = await fetch(`${API}/analytics/download/${filename}`, { headers: { Authorization: `Bearer ${tok}` } })
                        if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.detail || 'Ошибка загрузки файла'); return }
                        const blob = await res.blob()
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = r.file_name || filename
                        document.body.appendChild(a); a.click(); document.body.removeChild(a)
                        setTimeout(() => URL.revokeObjectURL(url), 100)
                      } catch { alert('Ошибка загрузки файла') }
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
