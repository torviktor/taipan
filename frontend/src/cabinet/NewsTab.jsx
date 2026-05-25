import { useState, useEffect } from 'react'
import { API } from './constants'
import { apiFetch } from '../utils/apiFetch'

const SOURCE_LABELS = {
  nadezhda:                  'Дворец Надежда',
  auto_weekly_digest:        'Авто-сводка',
  auto_competition_anons:    'Анонс соревнования',
  auto_competition_report:   'Репортаж соревнования',
  auto_certification_anons:  'Анонс аттестации',
  auto_certification_report: 'Репортаж аттестации',
  auto_camp_anons:           'Анонс сборов',
  auto_camp_report:          'Репортаж сборов',
  ai:                        'AI-генерация',
  vk:                        'VK',
  gtf_telegram:              'Telegram ГТФ',
}

export default function NewsTab({ token }) {
  const h   = { Authorization: `Bearer ${token}` }
  const hj  = { ...h, 'Content-Type': 'application/json' }

  const [items,        setItems]        = useState([])
  const [loading,      setLoading]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [msg,          setMsg]          = useState('')
  const [showForm,     setShowForm]     = useState(false)
  const [photoFile,    setPhotoFile]    = useState(null)
  const [editingId,    setEditingId]    = useState(null)
  const [editForm,     setEditForm]     = useState({ title: '', body: '' })
  const [editPhoto,    setEditPhoto]    = useState(null)
  const [editHasPhoto, setEditHasPhoto] = useState(false)
  const [confirm,      setConfirm]      = useState(null)
  const [tab,          setTab]          = useState('drafts')  // 'drafts' | 'published'
  const [form, setForm] = useState({ title: '', body: '' })

  useEffect(() => { loadNews() }, [tab])

  const loadNews = async () => {
    setLoading(true)
    try {
      const url = tab === 'drafts'
        ? `${API}/news/drafts?limit=50`
        : `${API}/news?limit=50`
      const r = await apiFetch(url, { headers: h })
      if (r.ok) { const d = await r.json(); setItems(d.items) }
    } catch {}
    setLoading(false)
  }

  const createNews = async () => {
    if (!form.title.trim() || !form.body.trim()) { setMsg('Заполните заголовок и текст'); return }
    setSaving(true); setMsg('')
    try {
      const r = await apiFetch(`${API}/news`, { method: 'POST', headers: hj, body: JSON.stringify(form) })
      if (!r.ok) { const d = await r.json(); setMsg(d.detail || 'Ошибка'); setSaving(false); return }
      const created = await r.json()
      if (photoFile) {
        const fd = new FormData(); fd.append('file', photoFile)
        await apiFetch(`${API}/news/${created.id}/photo`, { method: 'POST', headers: h, body: fd })
      }
      setShowForm(false); setForm({ title: '', body: '' }); setPhotoFile(null)
      setMsg('Черновик создан'); await loadNews()
      window.dispatchEvent(new Event('news-drafts-changed'))
    } catch { setMsg('Ошибка') }
    setSaving(false)
  }

  const deleteNews = async (id) => {
    try {
      await apiFetch(`${API}/news/${id}`, { method: 'DELETE', headers: h })
      await loadNews()
      setConfirm(null)
      window.dispatchEvent(new Event('news-drafts-changed'))
    } catch {}
  }

  const publishDraft = async (id) => {
    setSaving(true); setMsg('')
    try {
      const r = await apiFetch(`${API}/news/${id}/publish`, { method: 'POST', headers: h })
      if (r.ok) {
        setMsg('Новость опубликована')
        await loadNews()
        window.dispatchEvent(new Event('news-drafts-changed'))
      } else {
        const d = await r.json().catch(() => ({}))
        setMsg(d.detail || 'Ошибка публикации')
      }
    } catch { setMsg('Ошибка') }
    setSaving(false)
  }

  const saveEdit = async () => {
    if (!editingId) return
    setSaving(true); setMsg('')
    try {
      const r = await apiFetch(`${API}/news/${editingId}`, {
        method: 'PATCH', headers: hj, body: JSON.stringify(editForm)
      })
      if (!r.ok) { setMsg('Ошибка сохранения'); setSaving(false); return }
      if (editPhoto) {
        const fd = new FormData(); fd.append('file', editPhoto)
        await apiFetch(`${API}/news/${editingId}/photo`, { method: 'POST', headers: h, body: fd })
      }
      setEditingId(null); setEditPhoto(null); await loadNews()
      window.dispatchEvent(new Event('news-drafts-changed'))
    } catch { setMsg('Ошибка') }
    setSaving(false)
  }

  const deletePhoto = async (newsId) => {
    try {
      await apiFetch(`${API}/news/${newsId}/photo`, { method: 'DELETE', headers: h })
      setEditHasPhoto(false); await loadNews()
    } catch {}
  }

  return (
    <div>
      {confirm && (
        <div className="modal-overlay" onClick={() => setConfirm(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Удалить новость?</h3>
            <p style={{ color:'var(--gray)', marginBottom:20 }}>Это действие необратимо.</p>
            <div className="modal-btns-row">
              <button className="btn-primary" style={{ background:'var(--red)' }} onClick={() => deleteNews(confirm)}>Удалить</button>
              <button className="btn-outline" onClick={() => setConfirm(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <span style={{ fontFamily:'Bebas Neue', fontSize:'1.4rem', letterSpacing:'0.06em', color:'var(--white)' }}>
            Новости клуба
          </span>
          <div style={{ display:'flex', gap:0, border:'1px solid var(--gray-dim)' }}>
            <button
              onClick={() => setTab('drafts')}
              style={{
                padding:'6px 14px', fontSize:'13px',
                background: tab === 'drafts' ? 'var(--red)' : 'transparent',
                color: tab === 'drafts' ? 'var(--white)' : 'var(--gray)',
                border:'none', cursor:'pointer',
                fontFamily:'Barlow Condensed', letterSpacing:'1px', textTransform:'uppercase'
              }}>
              Черновики
            </button>
            <button
              onClick={() => setTab('published')}
              style={{
                padding:'6px 14px', fontSize:'13px',
                background: tab === 'published' ? 'var(--red)' : 'transparent',
                color: tab === 'published' ? 'var(--white)' : 'var(--gray)',
                border:'none', cursor:'pointer',
                fontFamily:'Barlow Condensed', letterSpacing:'1px', textTransform:'uppercase'
              }}>
              Опубликованные
            </button>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="btn-primary" style={{ padding:'8px 18px', fontSize:'14px' }} onClick={() => setShowForm(true)}>
            + Новость
          </button>
        </div>
      </div>

      {msg && <div className="att-msg" style={{ marginBottom:12 }}>{msg}</div>}

      {loading && <div className="cabinet-loading">Загрузка...</div>}
      {!loading && items.length === 0 && (
        <div className="cabinet-empty">
          {tab === 'drafts' ? 'Черновиков нет — всё разобрано' : 'Опубликованных новостей пока нет'}
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        {items.map(n => (
          <div key={n.id} style={{ background:'var(--dark)', border:'1px solid var(--gray-dim)', padding:'16px 20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:'Barlow Condensed', fontSize:'11px', fontWeight:700, letterSpacing:'2px', marginBottom:4, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  <span style={{ color:'var(--red)' }}>
                    {new Date(n.published_at).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}
                  </span>
                  {n.needs_review && (
                    <span style={{
                      color:'var(--white)',
                      background:'var(--red)',
                      padding:'2px 8px',
                      letterSpacing:'1px',
                      fontSize:'10px'
                    }}>
                      Требует проверки
                    </span>
                  )}
                  {n.source && SOURCE_LABELS[n.source] && (
                    <span style={{ color:'var(--gray)', textTransform:'none', letterSpacing:'1px' }}>· {SOURCE_LABELS[n.source]}</span>
                  )}
                  {n.competition_id && <span style={{ color:'var(--gray)' }}>· соревнование</span>}
                </div>
                <div style={{ fontWeight:600, color:'var(--white)', fontSize:'15px', marginBottom:4 }}>{n.title}</div>
                {n.quality_notes && (
                  <div style={{
                    fontSize:'12px',
                    color:'var(--gray-dim)',
                    fontStyle:'italic',
                    marginBottom:6,
                  }}>
                    {n.quality_notes}
                  </div>
                )}
                <div style={{ color:'var(--gray)', fontSize:'13px', lineHeight:1.5 }}>
                  {n.body.slice(0, 120).replace(/\n/g, ' ')}{n.body.length > 120 ? '…' : ''}
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0, alignItems:'flex-end' }}>
                {n.photo_url && <img src={n.photo_url} alt="" style={{ width:100, height:70, objectFit:'cover', borderRadius:2 }} />}
                <div style={{ display:'flex', gap:6 }}>
                  {tab === 'drafts' && (
                    <button className="btn-primary" style={{ fontSize:'11px', padding:'4px 10px' }}
                      onClick={() => publishDraft(n.id)} disabled={saving}>
                      Опубликовать
                    </button>
                  )}
                  <button className="att-all-btn" style={{ fontSize:'11px', padding:'4px 10px' }}
                    onClick={() => { setEditingId(n.id); setEditForm({ title: n.title, body: n.body }); setEditPhoto(null); setEditHasPhoto(!!n.photo_url) }}>
                    Ред.
                  </button>
                  <button className="td-btn td-btn-del" onClick={() => setConfirm(n.id)}>✕</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box" style={{ maxWidth:600 }} onClick={e => e.stopPropagation()}>
            <h3>Новая новость</h3>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)', display:'block', marginBottom:6 }}>Заголовок</label>
              <input className="modal-input" placeholder="Заголовок новости..." value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)', display:'block', marginBottom:6 }}>Текст</label>
              <textarea style={{ width:'100%', minHeight:160, background:'var(--dark2)', border:'1px solid var(--gray-dim)', color:'var(--white)', padding:'10px 14px', fontSize:'14px', fontFamily:'Barlow, sans-serif', resize:'vertical', boxSizing:'border-box' }}
                placeholder="Текст новости..." value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)', display:'block', marginBottom:6 }}>Фото (необязательно)</label>
              <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files[0])} />
              {photoFile && <div style={{ color:'var(--gray)', fontSize:'12px', marginTop:4 }}>{photoFile.name}</div>}
            </div>
            {msg && <div className="modal-msg" style={{ marginBottom:8 }}>{msg}</div>}
            <div className="modal-btns-row">
              <button className="btn-primary" onClick={createNews} disabled={saving}>{saving ? 'Создание...' : 'Создать черновик'}</button>
              <button className="btn-outline" onClick={() => { setShowForm(false); setMsg('') }}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {editingId && (
        <div className="modal-overlay" onClick={() => setEditingId(null)}>
          <div className="modal-box" style={{ maxWidth:600 }} onClick={e => e.stopPropagation()}>
            <h3>Редактировать новость</h3>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)', display:'block', marginBottom:6 }}>Заголовок</label>
              <input className="modal-input" value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)', display:'block', marginBottom:6 }}>Текст</label>
              <textarea style={{ width:'100%', minHeight:200, background:'var(--dark2)', border:'1px solid var(--gray-dim)', color:'var(--white)', padding:'10px 14px', fontSize:'14px', fontFamily:'Barlow, sans-serif', resize:'vertical', boxSizing:'border-box' }}
                value={editForm.body} onChange={e => setEditForm(p => ({ ...p, body: e.target.value }))} />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)', display:'block', marginBottom:6 }}>Фото</label>
              {editHasPhoto && (
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  <span style={{ color:'var(--gray)', fontSize:'13px' }}>Фото прикреплено</span>
                  <button className="td-btn td-btn-del" style={{ fontSize:'11px' }} onClick={() => deletePhoto(editingId)}>Удалить фото</button>
                </div>
              )}
              <input type="file" accept="image/*" onChange={e => setEditPhoto(e.target.files[0])} />
              {editPhoto && <div style={{ color:'var(--gray)', fontSize:'12px', marginTop:4 }}>{editPhoto.name}</div>}
            </div>
            <div className="modal-btns-row">
              <button className="btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
              <button className="btn-outline" onClick={() => setEditingId(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
