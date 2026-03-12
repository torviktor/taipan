import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import './Register.css'

const API = '/api'

export default function Register() {
  const navigate = useNavigate()
  const [step, setStep]       = useState('preview') // preview → form → done
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const [form, setForm] = useState({
    full_name:  '',
    phone:      '',
    password:   '',
    password2:  '',
    email:      '',
    role:       'parent',
    // спортсмен
    athlete_name:       '',
    athlete_birth_date: '',
    athlete_gender:     'male',
    athlete_gup:        '',
    athlete_dan:        '',
    has_dan:            false,
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const formatPhone = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 1) return d ? '+7' : ''
    if (d.length <= 4) return `+7 (${d.slice(1)}`
    if (d.length <= 7) return `+7 (${d.slice(1,4)}) ${d.slice(4)}`
    if (d.length <= 9) return `+7 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`
    return `+7 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7,9)}-${d.slice(9)}`
  }

  const handleSubmit = async () => {
    setError('')
    if (form.password !== form.password2) { setError('Пароли не совпадают'); return }
    if (form.password.length < 6) { setError('Пароль минимум 6 символов'); return }
    if (!form.athlete_name || !form.athlete_birth_date) { setError('Заполните данные спортсмена'); return }

    const phone = form.phone.replace(/\D/g, '')

    const body = {
      full_name: form.full_name,
      phone,
      password:  form.password,
      email:     form.email || undefined,
      role:      form.role,
      athlete: {
        full_name:  form.athlete_name,
        birth_date: form.athlete_birth_date,
        gender:     form.athlete_gender,
        gup:        form.has_dan ? null : (form.athlete_gup ? parseInt(form.athlete_gup) : null),
        dan:        form.has_dan ? (form.athlete_dan ? parseInt(form.athlete_dan) : 1) : null,
      }
    }

    setLoading(true)
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || 'Ошибка регистрации'); return }
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('role', data.role)
      localStorage.setItem('name', data.full_name)
      navigate('/cabinet')
    } catch {
      setError('Ошибка соединения с сервером')
    } finally {
      setLoading(false)
    }
  }

  // ── ПРЕВЬЮ ────────────────────────────────────────────────────────────────
  if (step === 'preview') {
    return (
      <main className="register-page">
        <div className="register-preview">
          <div className="register-preview-icon">🥋</div>
          <h1 className="register-preview-title">Регистрация в клубе</h1>
          <div className="register-preview-body">
            <p>Регистрация на сайте предназначена <strong>только для участников клуба «Тайпан»</strong>.</p>
            <p>После регистрации вы получите доступ к:</p>
            <ul>
              <li>Личному кабинету</li>
              <li>Календарю событий и соревнований</li>
              <li>Уведомлениям через Telegram-бот</li>
              <li>Информации о прогрессе спортсмена</li>
            </ul>
            <p className="register-preview-note">
              Если вы ещё не являетесь участником клуба — сначала{' '}
              <Link to="/apply">запишитесь на пробное занятие</Link>.
            </p>
          </div>
          <div className="register-preview-btns">
            <button className="btn-primary" onClick={() => setStep('form')}>
              Я участник клуба — зарегистрироваться
            </button>
            <Link to="/login" className="btn-outline">Уже есть аккаунт → Войти</Link>
          </div>
        </div>
      </main>
    )
  }

  // ── ФОРМА ─────────────────────────────────────────────────────────────────
  return (
    <main className="register-page">
      <div className="register-form-wrap">
        <div className="register-header">
          <Link to="/" className="register-logo">
            <img src="/logo.png" alt="Тайпан" />
          </Link>
          <h1>Регистрация</h1>
          <p>Клуб тхэквондо «Тайпан»</p>
        </div>

        {error && <div className="register-error">{error}</div>}

        {/* ── Кто регистрируется ── */}
        <div className="register-section">
          <h3>Кто регистрируется?</h3>
          <div className="register-role-btns">
            <button
              className={`role-btn ${form.role === 'parent' ? 'active' : ''}`}
              onClick={() => set('role', 'parent')}
            >
              <span>👨‍👩‍👧</span>
              <strong>Родитель</strong>
              <small>Регистрирую ребёнка</small>
            </button>
            <button
              className={`role-btn ${form.role === 'athlete' ? 'active' : ''}`}
              onClick={() => set('role', 'athlete')}
            >
              <span>🥋</span>
              <strong>Спортсмен клуба</strong>
              <small>Взрослый участник</small>
            </button>
          </div>
        </div>

        {/* ── Данные пользователя ── */}
        <div className="register-section">
          <h3>{form.role === 'parent' ? 'Данные родителя' : 'Ваши данные'}</h3>
          <div className="register-fields">
            <div className="register-field">
              <label>ФИО</label>
              <input
                type="text"
                placeholder="Иванов Иван Иванович"
                value={form.full_name}
                onChange={e => set('full_name', e.target.value)}
              />
            </div>
            <div className="register-field">
              <label>Телефон</label>
              <input
                type="tel"
                placeholder="+7 (___) ___-__-__"
                value={form.phone}
                onChange={e => set('phone', formatPhone(e.target.value))}
              />
            </div>
            <div className="register-field">
              <label>Email (необязательно)</label>
              <input
                type="email"
                placeholder="example@mail.ru"
                value={form.email}
                onChange={e => set('email', e.target.value)}
              />
            </div>
            <div className="register-field">
              <label>Пароль</label>
              <input
                type="password"
                placeholder="Минимум 6 символов"
                value={form.password}
                onChange={e => set('password', e.target.value)}
              />
            </div>
            <div className="register-field">
              <label>Повторите пароль</label>
              <input
                type="password"
                placeholder="Повторите пароль"
                value={form.password2}
                onChange={e => set('password2', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Данные спортсмена ── */}
        <div className="register-section">
          <h3>{form.role === 'parent' ? 'Данные ребёнка' : 'Данные спортсмена'}</h3>
          <div className="register-fields">
            <div className="register-field">
              <label>ФИО {form.role === 'parent' ? 'ребёнка' : 'спортсмена'}</label>
              <input
                type="text"
                placeholder="Иванов Иван Иванович"
                value={form.athlete_name}
                onChange={e => set('athlete_name', e.target.value)}
              />
            </div>
            <div className="register-field">
              <label>Дата рождения</label>
              <input
                type="date"
                value={form.athlete_birth_date}
                onChange={e => set('athlete_birth_date', e.target.value)}
              />
            </div>
            <div className="register-field">
              <label>Пол</label>
              <select value={form.athlete_gender} onChange={e => set('athlete_gender', e.target.value)}>
                <option value="male">Мужской</option>
                <option value="female">Женский</option>
              </select>
            </div>
            <div className="register-field">
              <label>Пояс</label>
              <div className="register-belt">
                <label className="register-check">
                  <input
                    type="checkbox"
                    checked={form.has_dan}
                    onChange={e => set('has_dan', e.target.checked)}
                  />
                  Чёрный пояс (дан)
                </label>
                {form.has_dan ? (
                  <select value={form.athlete_dan} onChange={e => set('athlete_dan', e.target.value)}>
                    <option value="">Выберите дан</option>
                    {[1,2,3,4,5,6,7,8,9].map(d => (
                      <option key={d} value={d}>{d} дан</option>
                    ))}
                  </select>
                ) : (
                  <select value={form.athlete_gup} onChange={e => set('athlete_gup', e.target.value)}>
                    <option value="">Выберите гып</option>
                    {[10,9,8,7,6,5,4,3,2,1].map(g => (
                      <option key={g} value={g}>{g} гып</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>

        <button
          className="btn-primary register-submit"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Регистрация...' : 'Зарегистрироваться'}
        </button>

        <p className="register-login-link">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </div>
    </main>
  )
}
