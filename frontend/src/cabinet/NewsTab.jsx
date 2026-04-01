import { useState, useEffect } from 'react'
import { API } from './constants'

export default function NewsTab({ token }) {
  const h   = { Authorization: `Bearer ${token}` }
  const hj  = { ...h, 'Content-Type': 'application/json' }

  const [items,        setItems]        = useState([])
  const [comps,        setComps]        = useState([])
  const [certs,        setCerts]        = useState([])
  const [camps,        setCamps]        = useState([])
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
  const [form, setForm] = useState({ title: '', body: '' })

  useEffect(() => { loadNews(); loadComps(); loadCerts(); loadCamps() }, [])

  const loadNews = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/news?limit=50`, { headers: h })
      if (r.ok) { const d = await r.json(); setItems(d.items) }
    } catch {}
    setLoading(false)
  }

  const loadComps = async () => {
    try {
      const r = await fetch(`${API}/competitions`, { headers: h })
      if (r.ok) setComps(await r.json())
    } catch {}
  }

  const loadCerts = async () => {
    try {
      const r = await fetch(`${API}/certifications`, { headers: h })
      if (r.ok) { const d = await r.json(); setCerts(d) }
    } catch {}
  }

  const loadCamps = async () => {
    try {
      const r = await fetch(`${API}/camps`, { headers: h })
      if (r.ok) { const d = await r.json(); setCamps(d) }
    } catch {}
  }

  const createNews = async () => {
    if (!form.title.trim() || !form.body.trim()) { setMsg('Заполните заголовок и текст'); return }
    setSaving(true); setMsg('')
    try {
      const r = await fetch(`${API}/news`, { method: 'POST', headers: hj, body: JSON.stringify(form) })
      if (!r.ok) { const d = await r.json(); setMsg(d.detail || 'Ошибка'); setSaving(false); return }
      const created = await r.json()
      if (photoFile) {
        const fd = new FormData(); fd.append('file', photoFile)
        await fetch(`${API}/news/${created.id}/photo`, { method: 'POST', headers: h, body: fd })
      }
      setShowForm(false); setForm({ title: '', body: '' }); setPhotoFile(null)
      setMsg('Новость опубликована'); await loadNews()
    } catch { setMsg('Ошибка') }
    setSaving(false)
  }

  const deleteNews = async (id) => {
    try {
      await fetch(`${API}/news/${id}`, { method: 'DELETE', headers: h })
      await loadNews(); setConfirm(null)
    } catch {}
  }

  const saveEdit = async () => {
    if (!editingId) return
    setSaving(true); setMsg('')
    try {
      const r = await fetch(`${API}/news/${editingId}`, {
        method: 'PATCH', headers: hj, body: JSON.stringify(editForm)
      })
      if (!r.ok) { setMsg('Ошибка сохранения'); setSaving(false); return }
      if (editPhoto) {
        const fd = new FormData(); fd.append('file', editPhoto)
        await fetch(`${API}/news/${editingId}/photo`, { method: 'POST', headers: h, body: fd })
      }
      setEditingId(null); setEditPhoto(null); await loadNews()
    } catch { setMsg('Ошибка') }
    setSaving(false)
  }

  const deletePhoto = async (newsId) => {
    try {
      await fetch(`${API}/news/${newsId}/photo`, { method: 'DELETE', headers: h })
      setEditHasPhoto(false); await loadNews()
    } catch {}
  }

  const generateWithGPT = async (compId) => {
    setSaving(true); setMsg('')
    try {
      const r = await fetch(`${API}/news-admin/generate-comp-news`, {
        method: 'POST', headers: hj, body: JSON.stringify({ comp_id: compId })
      })
      const d = await r.json()
      setMsg(d.message || (r.ok ? 'Готово' : 'Ошибка'))
      if (r.ok) await loadNews()
    } catch { setMsg('Ошибка') }
    setSaving(false)
  }

  const publishFromComp = async (compId) => {
    setSaving(true); setMsg('')
    try {
      const r = await fetch(`${API}/news/from-competition/${compId}`, { method: 'POST', headers: h })
      if (r.ok) { setMsg('Новость опубликована'); await loadNews() }
      else { const d = await r.json(); setMsg(d.detail || 'Ошибка') }
    } catch { setMsg('Ошибка') }
    setSaving(false)
  }

  const publishFromCert = async (certId, certName, certDate) => {
    setSaving(true); setMsg('')
    try {
      const dateStr = new Date(certDate).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })
      const title = `${certName} — ${dateStr}`
      const body  = `${dateStr} в клубе «Тайпан» прошла аттестация: ${certName}.\n\nПоздравляем всех участников с получением новых поясов! Каждый пояс — это результат упорного труда, дисциплины и преданности тхэквондо ГТФ.\n\nПродолжаем расти и совершенствоваться!`
      const r = await fetch(`${API}/news`, { method: 'POST', headers: hj, body: JSON.stringify({ title, body, certification_id: certId }) })
      if (r.ok) { setMsg('Новость об аттестации опубликована'); await loadNews() }
      else { const d = await r.json(); setMsg(d.detail || 'Ошибка') }
    } catch { setMsg('Ошибка') }
    setSaving(false)
  }


  const generateCertWithGPT = async (certId, certName, certDate) => {
    setSaving(true); setMsg('')
    try {
      const dateStr = new Date(certDate).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })
      const prompt = `Напиши новость об аттестации по тхэквондо ГТФ для сайта клуба «Тайпан».\n\nДанные:\nНазвание аттестации: ${certName}\nДата: ${dateStr}\nКлуб: Тайпан, г. Павловский Посад\nФедерация: ГТФ (GTF)\n\nСтиль — торжественный, поддерживающий, гордый. Не используй эмодзи. Зал называется доянг. Пояса — гыпы (ученические) и даны (мастерские).\nОбъём 100-180 слов.\nВерни:\nЗАГОЛОВОК: [заголовок]\nТЕКСТ: [текст]`
      const rGpt = await fetch(`${API}/ai/chat`, { method: 'POST', headers: hj, body: JSON.stringify({ message: prompt, history: [] }) })
      if (!rGpt.ok) { setMsg('Ошибка YandexGPT'); setSaving(false); return }
      const gptData = await rGpt.json()
      const reply = gptData.reply || ''
      let title = `${certName} — ${dateStr}`
      let body  = reply
      if (reply.includes('ЗАГОЛОВОК:') && reply.includes('ТЕКСТ:')) {
        const parts = reply.split('ТЕКСТ:')
        title = parts[0].replace('ЗАГОЛОВОК:', '').trim() || title
        body  = parts[1].trim()
      }
      const rSave = await fetch(`${API}/news`, { method: 'POST', headers: hj, body: JSON.stringify({ title: title.slice(0,255), body, certification_id: certId }) })
      if (rSave.ok) { setMsg('Новость об аттестации сгенерирована YandexGPT'); await loadNews() }
      else { const d = await rSave.json(); setMsg(d.detail || 'Ошибка') }
    } catch { setMsg('Ошибка') }
    setSaving(false)
  }


  const publishFromCamp = async (campId, campName, campDateStart, campDateEnd, campLocation) => {
    setSaving(true); setMsg('')
    try {
      const ds = new Date(campDateStart).toLocaleDateString('ru-RU', { day:'numeric', month:'long' })
      const de = new Date(campDateEnd).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })
      const loc = campLocation ? ` в ${campLocation}` : ''
      const title = `Учебно-тренировочные сборы «${campName}» — ${ds}–${de}`
      const body  = `С ${ds} по ${de} наши спортсмены приняли участие в учебно-тренировочных сборах «${campName}»${loc}.\n\nСборы — важная часть подготовки каждого спортсмена. Интенсивные тренировки, работа над техникой хъёнгов и массоги, командный дух и взаимная поддержка — всё это делает наших бойцов сильнее.\n\nБлагодарим всех участников за старание и самоотдачу!`
      const r = await fetch(`${API}/news`, { method: 'POST', headers: hj, body: JSON.stringify({ title, body, camp_id: campId }) })
      if (r.ok) { setMsg('Новость о сборах опубликована'); await loadNews() }
      else { const d = await r.json(); setMsg(d.detail || 'Ошибка') }
    } catch { setMsg('Ошибка') }
    setSaving(false)
  }


  const generateCampWithGPT = async (campId, campName, campDateStart, campDateEnd, campLocation) => {
    setSaving(true); setMsg('')
    try {
      const ds = new Date(campDateStart).toLocaleDateString('ru-RU', { day:'numeric', month:'long' })
      const de = new Date(campDateEnd).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })
      const loc = campLocation ? `, место: ${campLocation}` : ''
      const prompt = `Напиши новость об учебно-тренировочных сборах по тхэквондо ГТФ для сайта клуба «Тайпан».\n\nДанные:\nНазвание: ${campName}\nДаты: ${ds}–${de}${loc}\nКлуб: Тайпан, г. Павловский Посад\nФедерация: ГТФ (GTF)\n\nСтиль — живой, мотивирующий, командный. Не используй эмодзи. Зал называется доянг, техника — хъёнги и массоги.\nОбъём 120-200 слов.\nВерни:\nЗАГОЛОВОК: [заголовок]\nТЕКСТ: [текст]`
      const rGpt = await fetch(`${API}/ai/chat`, { method: 'POST', headers: hj, body: JSON.stringify({ message: prompt, history: [] }) })
      if (!rGpt.ok) { setMsg('Ошибка YandexGPT'); setSaving(false); return }
      const gptData = await rGpt.json()
      const reply = gptData.reply || ''
      let title = `Сборы «${campName}» — ${ds}–${de}`
      let body  = reply
      if (reply.includes('ЗАГОЛОВОК:') && reply.includes('ТЕКСТ:')) {
        const parts = reply.split('ТЕКСТ:')
        title = parts[0].replace('ЗАГОЛОВОК:', '').trim() || title
        body  = parts[1].trim()
      }
      const rSave = await fetch(`${API}/news`, { method: 'POST', headers: hj, body: JSON.stringify({ title: title.slice(0,255), body, camp_id: campId }) })
      if (rSave.ok) { setMsg('Новость о сборах сгенерирована YandexGPT'); await loadNews() }
      else { const d = await rSave.json(); setMsg(d.detail || 'Ошибка') }
    } catch { setMsg('Ошибка') }
    setSaving(false)
  }


  const publishedCompIds = new Set(items.filter(n => n.competition_id).map(n => n.competition_id))
  const compsWithoutNews = comps.filter(c => !publishedCompIds.has(c.id))
  const publishedCertIds = new Set(items.filter(n => n.certification_id).map(n => n.certification_id))
  const publishedCampIds = new Set(items.filter(n => n.camp_id).map(n => n.camp_id))
  const recentCerts = certs.filter(c => !publishedCertIds.has(c.id)).slice(0, 5)
  const recentCamps = camps.filter(c => !publishedCampIds.has(c.id)).slice(0, 5)

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
        <span style={{ fontFamily:'Bebas Neue', fontSize:'1.4rem', letterSpacing:'0.06em', color:'var(--white)' }}>
          Новости клуба
        </span>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="att-all-btn" style={{ fontSize:'13px' }}
            onClick={async () => {
              setSaving(true); setMsg('')
              try {
                const r = await fetch(`${API}/news-admin/generate-announcement`, { method:'POST', headers:hj })
                const d = await r.json()
                setMsg(d.message || 'Готово')
                if (r.ok) await loadNews()
              } catch { setMsg('Ошибка') }
              setSaving(false)
            }} disabled={saving}>
            Анонс соревнований
          </button>
          <button className="btn-primary" style={{ padding:'8px 18px', fontSize:'14px' }} onClick={() => setShowForm(true)}>
            + Новость
          </button>
        </div>
      </div>

      {msg && <div className="att-msg" style={{ marginBottom:12 }}>{msg}</div>}

      {/* Соревнования без новости */}
      {compsWithoutNews.length > 0 && (
        <div style={{ background:'var(--dark2)', border:'1px solid var(--gray-dim)', borderLeft:'3px solid var(--red)', padding:'16px 20px', marginBottom:12 }}>
          <div style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)', marginBottom:12 }}>
            Соревнования без новости
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {compsWithoutNews.slice(0, 5).map(c => (
              <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                <span style={{ color:'var(--white)', fontSize:'14px', flex:1, minWidth:0 }}>
                  {c.name} — {new Date(c.date).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}
                </span>
                <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                  <button className="att-all-btn" style={{ fontSize:'12px', whiteSpace:'nowrap' }}
                    onClick={() => publishFromComp(c.id)} disabled={saving}>Стандартная</button>
                  <button className="btn-primary" style={{ fontSize:'12px', padding:'6px 12px', whiteSpace:'nowrap' }}
                    onClick={() => generateWithGPT(c.id)} disabled={saving}>YandexGPT</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Аттестации */}
      {recentCerts.length > 0 && (
        <div style={{ background:'var(--dark2)', border:'1px solid var(--gray-dim)', borderLeft:'3px solid #c8962a', padding:'16px 20px', marginBottom:12 }}>
          <div style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)', marginBottom:12 }}>
            Аттестации без новости
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {recentCerts.map(c => (
              <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                <span style={{ color:'var(--white)', fontSize:'14px', flex:1, minWidth:0 }}>
                  {c.name} — {new Date(c.date).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}
                </span>
                <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                  <button className="att-all-btn" style={{ fontSize:'12px', whiteSpace:'nowrap' }}
                    onClick={() => publishFromCert(c.id, c.name, c.date)} disabled={saving}>Стандартная</button>
                  <button className="btn-primary" style={{ fontSize:'12px', padding:'6px 12px', whiteSpace:'nowrap' }}
                    onClick={() => generateCertWithGPT(c.id, c.name, c.date)} disabled={saving}>YandexGPT</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Сборы */}
      {recentCamps.length > 0 && (
        <div style={{ background:'var(--dark2)', border:'1px solid var(--gray-dim)', borderLeft:'3px solid #4caf50', padding:'16px 20px', marginBottom:20 }}>
          <div style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)', marginBottom:12 }}>
            Сборы без новости
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {recentCamps.map(c => (
              <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                <span style={{ color:'var(--white)', fontSize:'14px', flex:1, minWidth:0 }}>
                  {c.name} — {new Date(c.date_start).toLocaleDateString('ru-RU', { day:'numeric', month:'long' })}–{new Date(c.date_end).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}
                </span>
                <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                  <button className="att-all-btn" style={{ fontSize:'12px', whiteSpace:'nowrap' }}
                    onClick={() => publishFromCamp(c.id, c.name, c.date_start, c.date_end, c.location)} disabled={saving}>Стандартная</button>
                  <button className="btn-primary" style={{ fontSize:'12px', padding:'6px 12px', whiteSpace:'nowrap' }}
                    onClick={() => generateCampWithGPT(c.id, c.name, c.date_start, c.date_end, c.location)} disabled={saving}>YandexGPT</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && <div className="cabinet-loading">Загрузка...</div>}
      {!loading && items.length === 0 && <div className="cabinet-empty">Новостей пока нет</div>}

      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
        {items.map(n => (
          <div key={n.id} style={{ background:'var(--dark)', border:'1px solid var(--gray-dim)', padding:'16px 20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontFamily:'Barlow Condensed', fontSize:'11px', fontWeight:700, letterSpacing:'2px', color:'var(--red)', marginBottom:4 }}>
                  {new Date(n.published_at).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}
                  {n.competition_id && <span style={{ marginLeft:8, color:'var(--gray)' }}>· соревнование</span>}
                </div>
                <div style={{ fontWeight:600, color:'var(--white)', fontSize:'15px', marginBottom:4 }}>{n.title}</div>
                <div style={{ color:'var(--gray)', fontSize:'13px', lineHeight:1.5 }}>
                  {n.body.slice(0, 120).replace(/\n/g, ' ')}{n.body.length > 120 ? '…' : ''}
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0, alignItems:'flex-end' }}>
                {n.photo_url && <img src={n.photo_url} alt="" style={{ width:100, height:70, objectFit:'cover', borderRadius:2 }} />}
                <div style={{ display:'flex', gap:6 }}>
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
              <button className="btn-primary" onClick={createNews} disabled={saving}>{saving ? 'Публикация...' : 'Опубликовать'}</button>
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
