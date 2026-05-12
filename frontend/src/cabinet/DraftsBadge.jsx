import { useState, useEffect } from 'react'
import { API } from './constants'
import { apiFetch } from '../utils/apiFetch'

// TODO (Сессия 6, задачи 4.2/4.3): диспатчить window.dispatchEvent(new Event('news-drafts-changed'))
// из NewsTab после publish/delete/create черновика, чтобы счётчик обновлялся
// без ожидания 5-минутного polling. Сейчас событие диспатчится только при
// переходе на вкладку «Новости» (Cabinet.jsx, useEffect [view]).

export default function DraftsBadge({ token }) {
  const [count, setCount] = useState(0)
  const load = async () => {
    try {
      const r = await apiFetch(`${API}/news/drafts/count`, { headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) { const d = await r.json(); setCount(d.count) }
    } catch {}
  }
  useEffect(() => {
    load()
    const interval = setInterval(load, 300000)
    window.addEventListener('news-drafts-changed', load)
    return () => { clearInterval(interval); window.removeEventListener('news-drafts-changed', load) }
  }, [token])
  if (count === 0) return null
  return <span className="tab-badge">{count}</span>
}
