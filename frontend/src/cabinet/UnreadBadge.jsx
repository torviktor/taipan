import { useState, useEffect } from 'react'
import { API } from './constants'

export default function UnreadBadge({ token }) {
  const [count, setCount] = useState(0)
  const load = async () => {
    try {
      const r = await fetch(`${API}/notifications/unread-count`, { headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) { const d = await r.json(); setCount(d.count) }
    } catch {}
  }
  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    // Обновляем когда пользователь читает уведомления
    window.addEventListener('notifications-read', load)
    return () => { clearInterval(interval); window.removeEventListener('notifications-read', load) }
  }, [token])
  if (count === 0) return null
  return <span className="tab-badge">{count}</span>
}
