import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import './Login.css'

export default function Login() {
  const [phone,    setPhone]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const form = new FormData()
      form.append('username', phone)
      form.append('password', password)

      const r = await axios.post('/api/auth/login', form)
      localStorage.setItem('token',     r.data.access_token)
      localStorage.setItem('role',      r.data.role)
      localStorage.setItem('full_name', r.data.full_name)

      if (r.data.role === 'admin' || r.data.role === 'manager') {
        navigate('/admin')
      } else {
        navigate('/cabinet')
      }
    } catch (err) {
      setError('Неверный телефон или пароль')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-box">
        <div className="login-logo">ТАЙПАН</div>
        <h1 className="login-title">ВХОД</h1>
        <div className="divider" />

        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Телефон</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+7 (999) 000-00-00"
              required
            />
          </div>
          <div className="form-group">
            <label>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className="btn-primary login-btn" disabled={loading}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <p className="login-footer">
          Нет аккаунта? <Link to="/apply">Запишитесь на пробное занятие</Link>
        </p>
      </div>
    </main>
  )
}
