import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import './Register.css'
const API = '/api'
const emptyAthlete = () => ({
  full_name: '', birth_date: '', gender: 'male', gup: '', dan: '', has_dan: false
})
const IconParent = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <circle cx="11" cy="9" r="4" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M3 26c0-5 3.6-8 8-8s8 3 8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="22" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M17 26c0-3.5 2.2-6 5-6s5 2.5 5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)
const IconAthlete = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M8 28l3-8 5 4 5-4 3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 16l2-4h8l2 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M6 20l4-4M26 20l-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)
function AthleteForm({ data, onChange, index, isParent }) {
  const set = (k, v) => onChange({ ...data, [k]: v })
  return (
    <div className="athlete-form-block">
      {index > 0 && <div className="athlete-form-sep">Ребёнок #{index + 1}</div>}
      <div className="register-fields">
        <div className="register-field">
          <label>ФИО {isParent ? 'ребёнка' : 'спортсмена'}</label>
          <input type="text" placeholder="Иванов Иван Иванович"
            value={data.full_name} onChange={e => set('full_name', e.target.value)} />
        </div>
        <div className="register-field">
          <label>Дата рождения</label>
          <input type="date" value={data.birth_date} onChange={e => set('birth_date', e.target.value)} />
        </div>
        <div className="register-field">
          <label>Пол</label>
          <select value={data.gender} onChange={e => set('gender', e.target.value)}>
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
          </select>
        </div>
        <div className="register-field">
          <label>Пояс</label>
          <div className="register-belt">
            <label className="register-check">
              <input type="checkbox" checked={data.has_dan}
                onChange={e => set('has_dan', e.target.checked)} />
              Чёрный пояс (дан)
            </label>
            {data.has_dan ? (
              <select value={data.dan} onChange={e => set('dan', e.target.value)}>
                <option value="">Выберите дан</option>
                {[1,2,3,4,5,6,7,8,9].map(d => <option key={d} value={d}>{d} дан</option>)}
              </select>
            ) : (
              <select value={data.gup} onChange={e => set('gup', e.target.value)}>
                <option value="">Выберите гып</option>
                {[10,9,8,7,6,5,4,3,2,1].map(g => <option key={g} value={g}>{g} гып</option>)}
              </select>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
export default function Register() {
  const navigate  = useNavigate()
  const [step, setStep]       = useState('preview')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [modal, setModal]     = useState(null)
  const [consent, setConsent] = useState(false)   // ← согласие с ПД
  const [form, setForm] = useState({
    full_name: '', phone: '', password: '', password2: '', email: '', role: 'parent',
  })
  const [athletes, setAthletes] = useState([emptyAthlete()])
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const formatPhone = (v) => {
    const d = v.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 1) return d ? '+7' : ''
    if (d.length <= 4) return `+7 (${d.slice(1)}`
    if (d.length <= 7) return `+7 (${d.slice(1,4)}) ${d.slice(4)}`
    if (d.length <= 9) return `+7 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`
    return `+7 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7,9)}-${d.slice(9)}`
  }
  const buildAthletePayload = (a) => ({
    full_name:  a.full_name,
    birth_date: a.birth_date,
    gender:     a.gender,
    gup:  a.has_dan ? null : (a.gup  ? parseInt(a.gup)  : null),
    dan:  a.has_dan ? (a.dan  ? parseInt(a.dan)  : 1)   : null,
  })
  const handlePhoneBlur = async () => {
    const phone = form.phone.replace(/\D/g, '')
    if (phone.length < 11 || form.role !== 'parent') return
    try {
      const r = await fetch(`${API}/auth/check-phone/${phone}`)
      const data = await r.json()
      if (data.exists && data.athletes_count > 0) {
        setForm(f => ({ ...f, _existing: data }))
      } else {
        setForm(f => ({ ...f, _existing: null }))
      }
    } catch { }
  }
  const handleSubmit = async () => {
    setError('')
    if (!form.full_name) { setError('Введите ваше ФИО'); return }
    if (form.password !== form.password2) { setError('Пароли не совпадают'); return }
    if (form.password.length < 6) { setError('Пароль минимум 6 символов'); return }
    if (form.role === 'athlete' && !athletes[0].birth_date) { setError('Укажите дату рождения'); return }
    if (form.role === 'parent') {
      for (const a of athletes) {
        if (!a.full_name || !a.birth_date) { setError('Заполните данные всех детей'); return }
      }
    }
    if (!consent) { setError('Необходимо согласие на обработку персональных данных'); return }
    const phone = form.phone.replace(/\D/g, '')
    if (form._existing?.exists) {
      setModal({ existingChildren: form._existing.athletes, athletes, phone, password: form.password })
      return
    }
    setLoading(true)
    try {
      const body = {
        full_name: form.full_name, phone, password: form.password,
        email: form.email || undefined, role: form.role,
        athlete: buildAthletePayload(form.role === 'athlete'
          ? { ...athletes[0], full_name: form.full_name }
          : athletes[0]
        ),
      }
      const res  = await fetch(`${API}/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail || 'Ошибка регистрации'); return }
      for (let i = 1; i < athletes.length; i++) {
        await fetch(`${API}/auth/add-athlete`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, password: form.password, athlete: buildAthletePayload(athletes[i]) }),
        })
      }
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('role',  data.role)
      localStorage.setItem('full_name', data.full_name)
      navigate('/cabinet')
    } catch {
      setError('Ошибка соединения с сервером')
    } finally {
      setLoading(false)
    }
  }
  const confirmAddAthlete = async () => {
    setLoading(true)
    setModal(null)
    try {
      for (const a of modal.athletes) {
        const res = await fetch(`${API}/auth/add-athlete`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: modal.phone, password: modal.password, athlete: buildAthletePayload(a) }),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.detail || 'Ошибка'); setLoading(false); return }
        localStorage.setItem('token', data.access_token)
        localStorage.setItem('role',  data.role)
        localStorage.setItem('full_name', data.full_name)
      }
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
          <div className="register-preview-emblem">
            <img src="/logo.png" alt="Тайпан" />
          </div>
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
  // ── МОДАЛЬНОЕ ОКНО ────────────────────────────────────────────────────────
  if (modal) {
    const n = modal.existingChildren.length + 1
    return (
      <main className="register-page">
        <div className="register-modal">
          <div className="register-modal-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" stroke="#CC0000" strokeWidth="2"/>
              <path d="M24 14v14M24 34v2" stroke="#CC0000" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h2>Этот телефон уже зарегистрирован</h2>
          <p>На этот номер уже зарегистрирован{modal.existingChildren.length > 1 ? 'ы' : ''}{' '}
            {modal.existingChildren.length === 1 ? 'один спортсмен' : `${modal.existingChildren.length} спортсмена`}:</p>
          <ul className="modal-children-list">
            {modal.existingChildren.map((name, i) => <li key={i}>{name}</li>)}
          </ul>
          <p className="modal-question">
            Вы хотите добавить <strong>{n === 2 ? 'второго' : n === 3 ? 'третьего' : `${n}-го`} ребёнка</strong>?
          </p>
          <p className="modal-note">Если вы не планировали добавлять нового ребёнка — нажмите «Отмена» и проверьте введённые данные.</p>
          <div className="modal-btns">
            <button className="btn-primary" onClick={confirmAddAthlete} disabled={loading}>
              {loading ? 'Добавление...' : 'Да, добавить ребёнка'}
            </button>
            <button className="btn-outline" onClick={() => setModal(null)}>Отмена</button>
          </div>
        </div>
      </main>
    )
  }
  // ── ФОРМА РЕГИСТРАЦИИ ─────────────────────────────────────────────────────
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
        <div className="register-section">
          <h3>Кто регистрируется?</h3>
          <div className="register-role-btns">
            <button className={`role-btn ${form.role === 'parent' ? 'active' : ''}`}
              onClick={() => { set('role', 'parent'); setAthletes([emptyAthlete()]) }}>
              <span className="role-btn-icon"><IconParent /></span>
              <strong>Родитель</strong>
              <small>Регистрирую ребёнка</small>
            </button>
            <button className={`role-btn ${form.role === 'athlete' ? 'active' : ''}`}
              onClick={() => { set('role', 'athlete'); setAthletes([emptyAthlete()]) }}>
              <span className="role-btn-icon"><IconAthlete /></span>
              <strong>Спортсмен клуба</strong>
              <small>Взрослый участник</small>
            </button>
          </div>
        </div>
        <div className="register-section">
          <h3>{form.role === 'parent' ? 'Данные родителя' : 'Ваши данные'}</h3>
          <div className="register-fields">
            <div className="register-field">
              <label>ФИО</label>
              <input type="text" placeholder="Иванов Иван Иванович"
                value={form.full_name} onChange={e => set('full_name', e.target.value)} />
            </div>
            <div className="register-field">
              <label>Телефон</label>
              <input type="tel" placeholder="+7 (___) ___-__-__"
                value={form.phone}
                onChange={e => set('phone', formatPhone(e.target.value))}
                onBlur={handlePhoneBlur}
              />
              {form._existing?.exists && (
                <div className="field-hint field-hint-warn">
                  Этот номер уже зарегистрирован. При сохранении вы добавите нового ребёнка к существующему аккаунту.
                </div>
              )}
            </div>
            <div className="register-field">
              <label>Email (необязательно)</label>
              <input type="email" placeholder="example@mail.ru"
                value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="register-field">
              <label>Пароль</label>
              <input type="password" placeholder="Минимум 6 символов"
                value={form.password} onChange={e => set('password', e.target.value)} />
            </div>
            <div className="register-field">
              <label>Повторите пароль</label>
              <input type="password" placeholder="Повторите пароль"
                value={form.password2} onChange={e => set('password2', e.target.value)} />
            </div>
            {/* Для спортсмена — поля прямо здесь */}
            {form.role === 'athlete' && (
              <>
                <div className="register-field">
                  <label>Дата рождения</label>
                  <input type="date" value={athletes[0].birth_date}
                    onChange={e => setAthletes([{ ...athletes[0], birth_date: e.target.value }])} />
                </div>
                <div className="register-field">
                  <label>Пол</label>
                  <select value={athletes[0].gender}
                    onChange={e => setAthletes([{ ...athletes[0], gender: e.target.value }])}>
                    <option value="male">Мужской</option>
                    <option value="female">Женский</option>
                  </select>
                </div>
                <div className="register-field">
                  <label>Пояс</label>
                  <div className="register-belt">
                    <label className="register-check">
                      <input type="checkbox" checked={athletes[0].has_dan}
                        onChange={e => setAthletes([{ ...athletes[0], has_dan: e.target.checked }])} />
                      Чёрный пояс (дан)
                    </label>
                    {athletes[0].has_dan ? (
                      <select value={athletes[0].dan}
                        onChange={e => setAthletes([{ ...athletes[0], dan: e.target.value }])}>
                        <option value="">Выберите дан</option>
                        {[1,2,3,4,5,6,7,8,9].map(d => <option key={d} value={d}>{d} дан</option>)}
                      </select>
                    ) : (
                      <select value={athletes[0].gup}
                        onChange={e => setAthletes([{ ...athletes[0], gup: e.target.value }])}>
                        <option value="">Выберите гып</option>
                        {[10,9,8,7,6,5,4,3,2,1].map(g => <option key={g} value={g}>{g} гып</option>)}
                      </select>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        {/* Для родителя — отдельная секция с детьми */}
        {form.role === 'parent' && (
        <div className="register-section">
          <h3>Данные детей</h3>
          {athletes.map((a, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <AthleteForm
                data={a} index={i} isParent={true}
                onChange={v => setAthletes(arr => arr.map((x, j) => j === i ? v : x))}
              />
              {athletes.length > 1 && (
                <button className="athlete-remove-btn"
                  onClick={() => setAthletes(arr => arr.filter((_, j) => j !== i))}>
                  Удалить
                </button>
              )}
            </div>
          ))}
          {athletes.length < 5 && (
            <button className="athlete-add-btn"
              onClick={() => setAthletes(arr => [...arr, emptyAthlete()])}>
              + Добавить ещё ребёнка
            </button>
          )}
        </div>
        )}

        {/* ── Согласие на обработку персональных данных ── */}
        <div className="register-consent">
          <label className={`consent-label ${!consent && error.includes('согласие') ? 'consent-label--error' : ''}`}>
            <input
              type="checkbox"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              className="consent-checkbox"
            />
            <span>
              Я даю согласие на обработку персональных данных в соответствии с{' '}
              <Link to="/privacy" target="_blank" rel="noreferrer">
                политикой конфиденциальности
              </Link>{' '}
              клуба «Тайпан» и требованиями Федерального закона № 152-ФЗ «О персональных данных».
              {form.role === 'parent' && ' Как законный представитель несовершеннолетнего, я также даю согласие на обработку персональных данных ребёнка.'}
            </span>
          </label>
        </div>

        <button className="btn-primary register-submit" onClick={handleSubmit} disabled={loading || !consent}>
          {loading ? 'Регистрация...' : 'Зарегистрироваться'}
        </button>
        <p className="register-login-link">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </div>
    </main>
  )
}
