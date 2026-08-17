import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import './Login.css'
import { formatPhone, normalizePhone } from '../utils/phone'

// Разбирает ошибку axios в текст для пользователя.
// Без этого любой сбой (502, таймаут, обрыв сети) выглядел как «неверный пароль»
// и уводил диагностику в сторону.
function loginErrorText(err) {
  // Ответа от сервера нет вообще: таймаут, обрыв, DNS, сервер недоступен.
  if (err.code === 'ECONNABORTED' || !err.response) {
    return 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.'
  }
  const { status, data } = err.response
  if (status === 401) return 'Неверный телефон или пароль'
  if (status === 403) return data?.detail || 'Доступ запрещён'
  if (status === 429) return 'Слишком много попыток входа. Подождите минуту.'
  if (status >= 500)  return 'Сервис недоступен, попробуйте позже'
  return data?.detail || 'Не удалось войти. Попробуйте ещё раз.'
}

export default function Login() {
  const [phone,        setPhone]        = useState('+7 (')
  const [password,     setPassword]     = useState('')
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [forgotShown,  setForgotShown]  = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const form = new FormData()
      form.append('username', normalizePhone(phone))
      form.append('password', password)
      const r = await axios.post('/api/auth/login', form, { timeout: 15000 })
      localStorage.setItem('token',     r.data.access_token)
      localStorage.setItem('role',      r.data.role)
      localStorage.setItem('full_name', r.data.full_name)
      localStorage.setItem('phone',     normalizePhone(phone))
      if (['admin', 'manager'].includes(r.data.role)) {
        navigate('/admin')
      } else {
        navigate('/cabinet')
      }
    } catch (err) {
      setError(loginErrorText(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-box">
        <Link to="/" className="login-logo-img">
          <img src="/logo.png" alt="Тайпан" />
        </Link>
        <h1 className="login-title">ВХОД</h1>
        <div className="divider" />

        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label>Телефон</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(formatPhone(e.target.value))}
              placeholder="+7 (999) 000-00-00"
              required
            />
          </div>
          <div className="login-field">
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

        <div className="login-forgot">
          <button className="login-forgot-btn" onClick={() => setForgotShown(!forgotShown)}>
            Забыли пароль?
          </button>
          {forgotShown && (
            <div className="login-forgot-msg">
              Восстановление пароля через SMS не предусмотрено.<br/>
              Обратитесь к администратору клуба:<br/>
              <a href="tel:+79091652800">+7 (909) 165-28-00</a>
            </div>
          )}
        </div>

        <div className="login-divider"><span>или</span></div>

        <Link to="/register" className="btn-outline login-register-btn">
          Зарегистрироваться
        </Link>

        <p className="login-footer">
          Ещё не в клубе? <Link to="/apply">Запишитесь на пробное занятие</Link>
        </p>
      </div>
    </main>
  )
}
