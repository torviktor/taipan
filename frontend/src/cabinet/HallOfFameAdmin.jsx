import { useState, useEffect, useRef } from 'react'
import { API } from './constants'
import ConfirmModal from './ConfirmModal'

function PhotoPositioner({ item, onClose, onSave }) {
  // Позиционирование через transform: translate — фото двигается свободно за пределы контейнера
  // Сохраняем формат: "Xpx Ypx / zoom%"
  const containerRef = useRef(null)

  const parseState = (str) => {
    // Формат: "Xpx Ypx / zoom%" или старый "X% Y%"
    if (!str || str === '50% 20%') return { tx: 0, ty: 0, zoom: 100 }
    const [posStr, zoomStr] = str.split('/')
    if (!zoomStr) return { tx: 0, ty: 0, zoom: 100 }
    const parts = posStr.trim().split(' ')
    return {
      tx:   parseFloat(parts[0]) || 0,
      ty:   parseFloat(parts[1]) || 0,
      zoom: parseFloat(zoomStr)  || 100,
    }
  }

  const initial = parseState(item.photo_position)
  const [tx,   setTx]   = useState(initial.tx)
  const [ty,   setTy]   = useState(initial.ty)
  const [zoom, setZoom] = useState(initial.zoom)

  const dragging   = useRef(false)
  const startMouse = useRef({ x:0, y:0 })
  const startTrans = useRef({ tx:0, ty:0 })

  const onMouseDown = (e) => {
    e.preventDefault()
    dragging.current   = true
    startMouse.current = { x: e.clientX, y: e.clientY }
    startTrans.current = { tx, ty }
  }
  const onMouseMove = (e) => {
    if (!dragging.current) return
    setTx(startTrans.current.tx + (e.clientX - startMouse.current.x))
    setTy(startTrans.current.ty + (e.clientY - startMouse.current.y))
  }
  const onMouseUp = () => { dragging.current = false }

  const onTouchStart = (e) => {
    const t = e.touches[0]
    dragging.current   = true
    startMouse.current = { x: t.clientX, y: t.clientY }
    startTrans.current = { tx, ty }
  }
  const onTouchMove = (e) => {
    if (!dragging.current) return
    const t = e.touches[0]
    setTx(startTrans.current.tx + (t.clientX - startMouse.current.x))
    setTy(startTrans.current.ty + (t.clientY - startMouse.current.y))
  }

  const handleSave = () => onSave(`${tx.toFixed(1)}px ${ty.toFixed(1)}px / ${zoom}%`)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}
        style={{ maxWidth:460, width:'92vw', boxSizing:'border-box', padding:24 }}>
        <div style={{ fontFamily:'Bebas Neue', fontSize:'1.4rem', letterSpacing:'0.06em', color:'var(--white)', marginBottom:4 }}>
          Кадрирование фото
        </div>
        <div style={{ color:'var(--gray)', fontSize:'0.82rem', marginBottom:16 }}>
          {item.full_name} — перетащи фото в нужное положение
        </div>

        <div
          ref={containerRef}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onMouseUp}
          style={{ position:'relative', height:260, overflow:'hidden', cursor:'grab',
            borderRadius:8, border:'2px solid var(--red)', background:'var(--dark)', userSelect:'none' }}>
          <img src={item.photo_url} alt="" draggable={false}
            style={{
              position:'absolute',
              width:'auto', height:`${zoom}%`,
              top:'50%', left:'50%',
              transform:`translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`,
              pointerEvents:'none',
              maxWidth:'none',
            }}
          />
          <div style={{ position:'absolute', inset:0, pointerEvents:'none',
            backgroundImage:'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
            backgroundSize:'33.33% 33.33%' }}/>
        </div>

        <div style={{ marginTop:16, display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ color:'var(--gray)', fontSize:'0.78rem', fontFamily:'Barlow Condensed',
            fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', whiteSpace:'nowrap' }}>
            Масштаб
          </span>
          <input type="range" min={50} max={200} step={5} value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            style={{ flex:1, accentColor:'var(--red)' }}
          />
          <span style={{ color:'var(--white)', fontSize:'0.85rem', minWidth:38, textAlign:'right' }}>
            {zoom}%
          </span>
        </div>

        <div style={{ color:'var(--gray-dim)', fontSize:'0.72rem', marginTop:8, textAlign:'center' }}>
          X: {tx.toFixed(0)}px  Y: {ty.toFixed(0)}px  /  {zoom}%
        </div>
        <div style={{ display:'flex', gap:10, marginTop:16 }}>
          <button className="btn-primary" style={{ flex:1, padding:'9px 0', fontSize:'13px' }} onClick={handleSave}>Сохранить</button>
          <button className="btn-outline"  style={{ flex:1, padding:'9px 0', fontSize:'13px' }} onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

export default function HallOfFameAdmin({ token }) {
  const [items,     setItems]     = useState([])
  const [loading,   setLoading]   = useState(false)
  const [showForm,  setShowForm]  = useState(false)
  const [editing,   setEditing]   = useState(null)
  const [msg,       setMsg]       = useState('')
  const [uploading, setUploading] = useState(null)
  const [confirm,   setConfirm]   = useState(null)
  const [posEditor, setPosEditor] = useState(null)

  const h  = { Authorization: `Bearer ${token}` }
  const hj = { ...h, 'Content-Type': 'application/json' }
  const emptyForm = { full_name:'', achievements:'', gup:'', dan:'', sort_order:0, is_featured:false }

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try { const r = await fetch(`${API}/hall-of-fame`, { headers: h }); if (r.ok) setItems(await r.json()) } catch {}
    setLoading(false)
  }

  const openNew  = () => { setEditing({ ...emptyForm }); setShowForm(true); setMsg('') }
  const openEdit = (item) => { setEditing({ ...item, gup: item.gup||'', dan: item.dan||'' }); setShowForm(true); setMsg('') }

  const save = async () => {
    if (!editing?.full_name?.trim()) { setMsg('Введите ФИО'); return }
    try {
      const method = editing.id ? 'PATCH' : 'POST'
      const url    = editing.id ? `${API}/hall-of-fame/${editing.id}` : `${API}/hall-of-fame`
      const r = await fetch(url, { method, headers: hj, body: JSON.stringify({
        full_name:    editing.full_name.trim(),
        achievements: editing.achievements || null,
        gup:          (editing.gup !== '' && !isNaN(Number(editing.gup)) && Number(editing.gup) > 0) ? Number(editing.gup) : 0,
        dan:          (editing.dan !== '' && !isNaN(Number(editing.dan)) && Number(editing.dan) > 0) ? Number(editing.dan) : 0,
        sort_order:   Number(editing.sort_order) || 0,
        is_featured:  !!editing.is_featured,
      })})
      if (r.ok) { setShowForm(false); setEditing(null); setMsg(''); await load() }
      else setMsg('Ошибка сохранения')
    } catch { setMsg('Ошибка') }
  }

  const remove = (item) => {
    setConfirm({
      message: `Удалить ${item.full_name} из Зала Славы?`,
      confirmText: 'Удалить',
      danger: true,
      onConfirm: async () => {
        setConfirm(null)
        await fetch(`${API}/hall-of-fame/${item.id}`, { method: 'DELETE', headers: h })
        await load()
      }
    })
  }

  const uploadPhoto = async (id, file) => {
    setUploading(id)
    const fd = new FormData(); fd.append('file', file)
    try {
      const r = await fetch(`${API}/hall-of-fame/${id}/photo`, { method: 'POST', headers: h, body: fd })
      if (r.ok) await load()
    } catch {}
    setUploading(null)
  }

  const savePosition = async (id, position) => {
    try {
      const r = await fetch(`${API}/hall-of-fame/${id}/position`, {
        method: 'PATCH',
        headers: hj,
        body: JSON.stringify({ photo_position: position })
      })
      if (r.ok) {
        // Обновляем items И posEditor — чтобы при повторном открытии читалась новая позиция
        setItems(prev => prev.map(i => i.id === id ? { ...i, photo_position: position } : i))
        setPosEditor(prev => prev && prev.id === id ? { ...prev, photo_position: position } : prev)
      }
    } catch {}
  }

  const belt = (gup, dan) => {
    if (dan) return `${dan} дан`
    if (gup === 0) return 'Без пояса'
    if (gup) return `${gup} гып`
    return '—'
  }

  return (
    <div>
      {confirm && <ConfirmModal message={confirm.message} confirmText={confirm.confirmText} danger={confirm.danger} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)}/>}
      {posEditor && (
        <PhotoPositioner
          item={posEditor}
          onClose={() => setPosEditor(null)}
          onSave={async (posStr) => {
            await savePosition(posEditor.id, posStr)
            setPosEditor(null)
          }}
        />
      )}

      {/* Модальная форма */}
      {showForm && editing && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{maxWidth:480, width:'90vw', boxSizing:'border-box'}}>
            <h3 style={{marginBottom:20}}>{editing.id ? 'Редактировать запись' : 'Добавить в Зал Славы'}</h3>

            <div style={{marginBottom:14}}>
              <label style={{color:'var(--gray)', fontSize:'0.78rem', letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:6}}>ФИО *</label>
              <input value={editing.full_name}
                onChange={e => setEditing(p=>({...p, full_name:e.target.value}))}
                placeholder="Иванов Иван Иванович"
                style={{width:'100%', boxSizing:'border-box', background:'var(--dark)', border:'1px solid var(--gray-dim)', borderRadius:6, padding:'9px 12px', color:'var(--white)', fontSize:'0.9rem'}}/>
            </div>

            <div style={{display:'flex', gap:10, marginBottom:14, flexWrap:'wrap'}}>
              <div style={{flex:'1 1 80px'}}>
                <label style={{color:'var(--gray)', fontSize:'0.78rem', letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:6}}>Гып (1–11)</label>
                <input type="number" min="1" max="11"
                  value={editing.gup}
                  onChange={e => setEditing(p=>({...p, gup:e.target.value, dan:''}))}
                  placeholder="—"
                  style={{width:'100%', boxSizing:'border-box', background:'var(--dark)', border:'1px solid var(--gray-dim)', borderRadius:6, padding:'9px 12px', color:'var(--white)', fontSize:'0.9rem'}}/>
              </div>
              <div style={{flex:'1 1 80px'}}>
                <label style={{color:'var(--gray)', fontSize:'0.78rem', letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:6}}>Дан (1–9)</label>
                <input type="number" min="1" max="9"
                  value={editing.dan}
                  onChange={e => setEditing(p=>({...p, dan:e.target.value, gup:''}))}
                  placeholder="—"
                  style={{width:'100%', boxSizing:'border-box', background:'var(--dark)', border:'1px solid var(--gray-dim)', borderRadius:6, padding:'9px 12px', color:'var(--white)', fontSize:'0.9rem'}}/>
              </div>
              <div style={{flex:'1 1 80px'}}>
                <label style={{color:'var(--gray)', fontSize:'0.78rem', letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:6}}>Порядок</label>
                <input type="number"
                  value={editing.sort_order}
                  onChange={e => setEditing(p=>({...p, sort_order:e.target.value}))}
                  placeholder="0"
                  style={{width:'100%', boxSizing:'border-box', background:'var(--dark)', border:'1px solid var(--gray-dim)', borderRadius:6, padding:'9px 12px', color:'var(--white)', fontSize:'0.9rem'}}/>
              </div>
            </div>

            <div style={{marginBottom:18}}>
              <label style={{color:'var(--gray)', fontSize:'0.78rem', letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:6}}>Достижения (каждое с новой строки)</label>
              <textarea rows={5}
                value={editing.achievements}
                onChange={e => setEditing(p=>({...p, achievements:e.target.value}))}
                placeholder={'Чемпион России 2024\nПризёр первенства ЦФО 2023'}
                style={{width:'100%', boxSizing:'border-box', resize:'vertical', background:'var(--dark)', border:'1px solid var(--gray-dim)', borderRadius:6, padding:'9px 12px', color:'var(--white)', fontSize:'0.9rem'}}/>
            </div>

            {msg && <div style={{color:'var(--red)', marginBottom:12, fontSize:'0.88rem'}}>{msg}</div>}

            <div style={{marginBottom:18, display:'flex', alignItems:'center', gap:10}}>
              <input type="checkbox" id="hof-featured" checked={!!editing.is_featured}
                onChange={e => setEditing(p=>({...p, is_featured: e.target.checked}))}
                style={{width:16, height:16, accentColor:'#c8962a', cursor:'pointer'}}/>
              <label htmlFor="hof-featured" style={{cursor:'pointer', fontSize:'0.9rem', color:'var(--white)'}}>
                Золотая рамка <span style={{color:'#c8962a', fontSize:'0.8rem'}}>(чемпионы мира и Европы)</span>
              </label>
            </div>

            <div style={{display:'flex', gap:10, flexWrap:'wrap'}}>
              <button className="btn-primary" style={{padding:'9px 20px', fontSize:'13px', flex:'0 0 auto'}} onClick={save}>
                {editing.id ? 'Сохранить' : 'Добавить'}
              </button>
              <button className="btn-outline" style={{padding:'9px 20px', fontSize:'13px', flex:'0 0 auto'}} onClick={() => { setShowForm(false); setMsg('') }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
        <span style={{color:'var(--gray)', fontSize:'0.9rem'}}>Записей в Зале Славы: {items.length}</span>
        <button className="btn-primary" style={{padding:'8px 18px', fontSize:'14px'}} onClick={openNew}>
          + Добавить
        </button>
      </div>

      {loading && <div className="cabinet-loading">Загрузка...</div>}
      {!loading && items.length === 0 && (
        <div className="cabinet-empty">Зал Славы пока пуст. Нажмите «+ Добавить».</div>
      )}

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16}}>
        {items.map(item => (
          <div key={item.id} style={{
            background:'var(--dark2)',
            border: item.is_featured ? '2px solid #c8962a' : '1px solid var(--gray-dim)',
            borderRadius:10, overflow:'hidden',
            boxShadow: item.is_featured ? '0 0 16px rgba(200,150,42,0.3)' : 'none'
          }}>
            {/* Фото */}
            <div style={{position:'relative', height:220, background:'var(--dark)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden'}}>
              {item.photo_url
                ? (() => {
                    const ps = item.photo_position || '0px 0px / 100%'
                    const [posStr, zoomStr] = ps.split('/')
                    const parts = posStr.trim().split(' ')
                    const ptx = parseFloat(parts[0]) || 0
                    const pty = parseFloat(parts[1]) || 0
                    const pzoom = parseFloat(zoomStr) || 100
                    return <img src={item.photo_url} alt={item.full_name} style={{
                      position:'absolute', width:'auto', height:`${pzoom}%`,
                      top:'50%', left:'50%', maxWidth:'none',
                      transform:`translate(calc(-50% + ${ptx}px), calc(-50% + ${pty}px))`,
                    }}/>
                  })()
                : <div style={{color:'var(--gray-dim)', fontFamily:'Bebas Neue', fontSize:'1rem', letterSpacing:'0.1em'}}>НЕТ ФОТО</div>
              }
              {/* Кнопка загрузки фото */}
              <label style={{
                position:'absolute', bottom:8, right:8, cursor:'pointer',
                background:'rgba(0,0,0,0.75)', border:'1px solid var(--gray-dim)',
                borderRadius:6, padding:'5px 12px', fontSize:'0.78rem', color:'var(--white)',
                fontFamily:'Barlow Condensed', letterSpacing:'0.05em'
              }}>
                {uploading === item.id ? 'Загрузка...' : '+ Фото'}
                <input type="file" accept="image/*" style={{display:'none'}}
                  onChange={e => e.target.files[0] && uploadPhoto(item.id, e.target.files[0])}/>
              </label>
              {item.photo_url && (
                <button
                  onClick={() => setPosEditor(items.find(i => i.id === item.id) || item)}
                  style={{
                    position:'absolute', bottom:8, left:8, cursor:'pointer',
                    background:'rgba(0,0,0,0.75)', border:'1px solid var(--gray-dim)',
                    borderRadius:6, padding:'5px 10px', fontSize:'0.78rem',
                    color:'var(--white)', fontFamily:'Barlow Condensed', letterSpacing:'0.05em',
                  }}>
                  Кадр
                </button>
              )}
            </div>
            {/* Данные */}
            <div style={{padding:'14px 16px'}}>
              <div style={{fontFamily:'Bebas Neue', fontSize:'1.2rem', letterSpacing:'0.05em', color:'var(--white)', marginBottom:2}}>
                {item.full_name}
              </div>
              <div style={{color:'#c8962a', fontSize:'0.82rem', marginBottom:8, fontFamily:'Barlow Condensed', fontWeight:700}}>
                {belt(item.gup, item.dan)}
              </div>
              {item.achievements && (
                <div style={{color:'var(--gray)', fontSize:'0.82rem', lineHeight:1.55, marginBottom:12, whiteSpace:'pre-line'}}>
                  {item.achievements}
                </div>
              )}
              <div style={{display:'flex', gap:8}}>
                <button className="td-btn td-btn-edit" onClick={() => openEdit(item)}>Ред.</button>
                <button className="td-btn td-btn-del" onClick={() => remove(item)}>Удал.</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
