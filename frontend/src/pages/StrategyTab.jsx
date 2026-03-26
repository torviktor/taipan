// frontend/src/pages/StrategyTab.jsx
// Вкладка «Стратегия» — чеклист тренера, хранение в БД (не localStorage)

import { useState, useEffect, useRef } from 'react'

const API = '/api'

export default function StrategyTab({ token }) {
  const [items,   setItems]   = useState([])
  const [newText, setNewText] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const saveTimer = useRef(null)

  const h  = { Authorization: `Bearer ${token}` }
  const hj = { ...h, 'Content-Type': 'application/json' }

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/insurance-strategy/strategy`, { headers: h })
      if (r.ok) {
        const d = await r.json()
        setItems(d.items || [])
      }
    } catch {}
    setLoading(false)
  }

  const persist = (newItems) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        await fetch(`${API}/insurance-strategy/strategy`, {
          method: 'PUT',
          headers: hj,
          body: JSON.stringify({ items: newItems })
        })
      } catch {}
      setSaving(false)
    }, 800)
  }

  const addItem = () => {
    const text = newText.trim()
    if (!text) return
    const updated = [...items, { id: Date.now(), text, done: false }]
    setItems(updated)
    persist(updated)
    setNewText('')
  }

  const toggle = (id) => {
    const updated = items.map(i => i.id === id ? { ...i, done: !i.done } : i)
    setItems(updated)
    persist(updated)
  }

  const remove = (id) => {
    const updated = items.filter(i => i.id !== id)
    setItems(updated)
    persist(updated)
  }

  const clearDone = () => {
    const updated = items.filter(i => !i.done)
    setItems(updated)
    persist(updated)
  }

  const doneCount = items.filter(i => i.done).length

  return (
    <div style={{ padding: '0 0 40px' }}>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'Bebas Neue', fontSize: '1.8rem', letterSpacing: '0.06em', color: 'var(--white)', marginBottom: 4 }}>
          Стратегия тренера
        </div>
        <div style={{ color: 'var(--gray)', fontSize: '0.88rem' }}>
          Личный чеклист задач и планов. Сохраняется в базе данных — доступен с любого устройства.
          {saving && <span style={{ marginLeft: 12, color: '#c8962a', fontSize: '0.82rem' }}>Сохранение...</span>}
        </div>
      </div>

      {/* Прогресс */}
      {items.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: 'var(--gray)', fontSize: '0.85rem' }}>
              Выполнено: {doneCount} / {items.length}
            </span>
            {doneCount > 0 && (
              <button
                onClick={clearDone}
                style={{
                  background: 'none', border: 'none', color: 'var(--red)',
                  fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'Barlow Condensed',
                  fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase'
                }}
              >
                Удалить выполненные
              </button>
            )}
          </div>
          <div style={{ height: 4, background: 'var(--gray-dim)', borderRadius: 2 }}>
            <div style={{
              height: '100%', background: 'var(--red)', borderRadius: 2,
              width: `${items.length ? (doneCount / items.length * 100) : 0}%`,
              transition: 'width 0.3s'
            }} />
          </div>
        </div>
      )}

      {/* Форма добавления */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          type="text"
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
          placeholder="Новый пункт стратегии..."
          style={{
            flex: 1, background: 'var(--dark)', border: '1px solid var(--gray-dim)',
            color: 'var(--white)', padding: '10px 14px', fontSize: '0.9rem',
            fontFamily: 'Barlow', outline: 'none'
          }}
          onFocus={e => e.target.style.borderColor = 'var(--red)'}
          onBlur={e => e.target.style.borderColor = 'var(--gray-dim)'}
        />
        <button className="btn-primary" onClick={addItem} style={{ flexShrink: 0 }}>
          + Добавить
        </button>
      </div>

      {/* Список */}
      {loading ? (
        <div style={{ color: 'var(--gray)', padding: '20px 0' }}>Загрузка...</div>
      ) : items.length === 0 ? (
        <div style={{
          color: 'var(--gray)', padding: '32px 24px', textAlign: 'center',
          border: '1px dashed var(--gray-dim)', fontSize: '0.9rem'
        }}>
          Чеклист пуст. Добавьте первый пункт стратегии выше.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map(item => (
            <div
              key={item.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', background: 'var(--dark)',
                transition: 'background 0.2s',
                opacity: item.done ? 0.6 : 1
              }}
            >
              <button
                onClick={() => toggle(item.id)}
                style={{
                  width: 22, height: 22, flexShrink: 0,
                  border: `2px solid ${item.done ? 'var(--red)' : 'var(--gray-dim)'}`,
                  background: item.done ? 'var(--red)' : 'transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 2, transition: 'all 0.2s'
                }}
              >
                {item.done && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
              <span style={{
                flex: 1, color: 'var(--white)', fontSize: '0.9rem',
                textDecoration: item.done ? 'line-through' : 'none',
                color: item.done ? 'var(--gray)' : 'var(--white)'
              }}>
                {item.text}
              </span>
              <button
                onClick={() => remove(item.id)}
                style={{
                  background: 'none', border: 'none', color: 'var(--gray)',
                  cursor: 'pointer', padding: '2px 6px', fontSize: '1rem',
                  lineHeight: 1, transition: 'color 0.2s'
                }}
                onMouseEnter={e => e.target.style.color = 'var(--red)'}
                onMouseLeave={e => e.target.style.color = 'var(--gray)'}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
