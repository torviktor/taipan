import { useState } from 'react'
import { API } from './constants'

export default function ResetPasswordModal({ user, token, onClose }) {
  const [pwd, setPwd] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const save = async () => {
    if (pwd.length < 4) { setMsg('Минимум 4 символа'); return }
    setLoading(true)
    const r = await fetch(`${API}/users/${user.user_id}/reset-password`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_password: pwd }),
    })
    setLoading(false)
    if (r.ok) { setMsg('Пароль изменён'); setTimeout(onClose, 1200) }
    else { const d = await r.json(); setMsg(d.detail || 'Ошибка') }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <h3>Сброс пароля</h3>
        <p>{user.parent_name}</p>
        <input type="text" placeholder="Новый пароль" value={pwd}
          onChange={e => setPwd(e.target.value)} className="modal-input" />
        {msg && <div className="modal-msg">{msg}</div>}
        <div className="modal-btns-row">
          <button className="btn-primary" onClick={save} disabled={loading}>{loading ? '...' : 'Сохранить'}</button>
          <button className="btn-outline" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  )
}
