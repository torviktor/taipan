import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { API } from '../cabinet/constants'

export default function InvitePage() {
  const { token } = useParams()
  const navigate  = useNavigate()

  const [invite,   setInvite]   = useState(null)   // { athlete_name, token }
  const [status,   setStatus]   = useState('loading') // loading | valid | invalid | accepted
  const [view,     setView]     = useState(null)    // null | 'login' | 'register'
  const [msg,      setMsg]      = useState('')
  const [loading,  setLoading]  = useState(false)

  // login form
  const [phone,    setPhone]    = useState('')
  const [password, setPassword] = useState('')

  // register form
  const [regName,  setRegName]  = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regPass,  setRegPass]  = useState('')

  useEffect(() => {
    const existingToken = localStorage.getItem('token')

    fetch(`${API}/invite/${token}`)
      .then(r => r.ok ? r.json() : null)
      .then(async data => {
        if (!data) { setStatus('invalid'); return }
        setInvite(data)

        if (existingToken) {
          // Уже авторизован — сразу принять
          try {
            const r = await fetch(`${API}/invite/accept`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${existingToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ token }),
            })
            if (r.ok) { setStatus('accepted'); setTimeout(() => navigate('/cabinet'), 1500) }
            else { setStatus('valid') }
          } catch { setStatus('valid') }
        } else {
          setStatus('valid')
        }
      })
      .catch(() => setStatus('invalid'))
  }, [token])

  const handleLogin = async (e) => {
    e.preventDefault()
    setMsg(''); setLoading(true)
    try {
      const fd = new FormData()
      fd.append('username', phone)
      fd.append('password', password)
      const r = await fetch(`${API}/auth/login`, { method: 'POST', body: fd })
      if (!r.ok) { setMsg('Неверный телефон или пароль'); setLoading(false); return }
      const data = await r.json()
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('role',  data.role)
      localStorage.setItem('name',  data.full_name)

      const r2 = await fetch(`${API}/invite/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (r2.ok) { navigate('/cabinet') }
      else { setMsg('Не удалось принять приглашение'); setLoading(false) }
    } catch { setMsg('Ошибка сети'); setLoading(false) }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setMsg(''); setLoading(true)
    try {
      const r = await fetch(`${API}/auth/register-by-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, full_name: regName, phone: regPhone, password: regPass }),
      })
      const data = await r.json()
      if (!r.ok) { setMsg(data.detail || 'Ошибка регистрации'); setLoading(false); return }
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('role',  data.role)
      localStorage.setItem('name',  data.full_name)
      navigate('/cabinet')
    } catch { setMsg('Ошибка сети'); setLoading(false) }
  }

  const inputStyle = {
    width: '100%', background: 'var(--dark2)', border: '1px solid var(--gray-dim)',
    borderRadius: 6, padding: '11px 14px', color: 'var(--white)',
    fontFamily: 'Barlow', fontSize: '15px', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle = { display: 'block', color: 'var(--gray)', fontSize: '0.8rem',
    fontFamily: 'Barlow Condensed', fontWeight: 700, letterSpacing: '0.06em',
    textTransform: 'uppercase', marginBottom: 6 }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--black)', padding: '40px 16px' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {status === 'loading' && (
          <div style={{ textAlign: 'center', color: 'var(--gray)' }}>Проверяем ссылку...</div>
        )}

        {status === 'invalid' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--red)', fontFamily: 'Bebas Neue', fontSize: '2rem',
              letterSpacing: '0.1em', marginBottom: 12 }}>Ссылка недействительна</div>
            <p style={{ color: 'var(--gray)' }}>Ссылка истекла или была отозвана.</p>
          </div>
        )}

        {status === 'accepted' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#6cba6c', fontFamily: 'Bebas Neue', fontSize: '2rem',
              letterSpacing: '0.1em', marginBottom: 12 }}>Доступ получен!</div>
            <p style={{ color: 'var(--gray)' }}>Переходим в кабинет...</p>
          </div>
        )}

        {status === 'valid' && invite && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <p style={{ color: 'var(--gray)', fontSize: '0.85rem', marginBottom: 8,
                fontFamily: 'Barlow Condensed', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Вас пригласили посмотреть профиль спортсмена
              </p>
              <div style={{ fontFamily: 'Bebas Neue', fontSize: '2.2rem', color: 'var(--white)',
                letterSpacing: '0.06em' }}>
                {invite.athlete_name}
              </div>
            </div>

            {!view && (
              <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
                <button className="btn-primary" style={{ padding: '13px', fontSize: '1rem' }}
                  onClick={() => setView('register')}>
                  Зарегистрироваться
                </button>
                <button className="btn-outline" style={{ padding: '13px', fontSize: '1rem' }}
                  onClick={() => setView('login')}>
                  Войти в существующий аккаунт
                </button>
              </div>
            )}

            {view === 'login' && (
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Телефон</label>
                  <input style={inputStyle} type="tel" placeholder="+7 999 123-45-67"
                    value={phone} onChange={e => setPhone(e.target.value)} required />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Пароль</label>
                  <input style={inputStyle} type="password"
                    value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                {msg && <p style={{ color: 'var(--red)', marginBottom: 12, fontSize: '0.88rem' }}>{msg}</p>}
                <button className="btn-primary" style={{ width: '100%', padding: '13px' }}
                  type="submit" disabled={loading}>
                  {loading ? 'Вход...' : 'Войти и принять приглашение'}
                </button>
                <button type="button" className="btn-outline"
                  style={{ width: '100%', padding: '11px', marginTop: 10 }}
                  onClick={() => { setView(null); setMsg('') }}>
                  ← Назад
                </button>
              </form>
            )}

            {view === 'register' && (
              <form onSubmit={handleRegister}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Ваше имя</label>
                  <input style={inputStyle} type="text" placeholder="Иванов Иван Иванович"
                    value={regName} onChange={e => setRegName(e.target.value)} required />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Телефон</label>
                  <input style={inputStyle} type="tel" placeholder="+7 999 123-45-67"
                    value={regPhone} onChange={e => setRegPhone(e.target.value)} required />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={labelStyle}>Пароль</label>
                  <input style={inputStyle} type="password" placeholder="Минимум 6 символов"
                    value={regPass} onChange={e => setRegPass(e.target.value)} required />
                </div>
                {msg && <p style={{ color: 'var(--red)', marginBottom: 12, fontSize: '0.88rem' }}>{msg}</p>}
                <button className="btn-primary" style={{ width: '100%', padding: '13px' }}
                  type="submit" disabled={loading}>
                  {loading ? 'Регистрация...' : 'Зарегистрироваться'}
                </button>
                <button type="button" className="btn-outline"
                  style={{ width: '100%', padding: '11px', marginTop: 10 }}
                  onClick={() => { setView(null); setMsg('') }}>
                  ← Назад
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
