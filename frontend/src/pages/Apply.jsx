import { useState } from 'react'
import './Apply.css'

const API = '/api'

const formatPhone = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 1) return d ? '+7' : ''
  if (d.length <= 4) return `+7 (${d.slice(1)}`
  if (d.length <= 7) return `+7 (${d.slice(1,4)}) ${d.slice(4)}`
  if (d.length <= 9) return `+7 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`
  return `+7 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7,9)}-${d.slice(9)}`
}

export default function Apply() {
  const [form, setForm] = useState({
    child_name:  '',
    birth_date:  '',
    gender:      'male',
    phone:       '',
    comment:     '',
  })
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)
  const [error,   setError]   = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    setError('')
    if (!form.child_name || !form.birth_date || !form.phone) {
      setError('Заполните все обязательные поля')
      return
    }
    const phone = form.phone.replace(/\D/g, '')
    if (phone.length < 11) { setError('Введите корректный номер телефона'); return }

    // Считаем возраст для удобства тренера
    const today = new Date()
    const birth = new Date(form.birth_date)
    const age = today.getFullYear() - birth.getFullYear()
      - ((today.getMonth(), today.getDate()) < (birth.getMonth(), birth.getDate()) ? 1 : 0)

    const genderLabel = form.gender === 'male' ? 'Мужской' : 'Женский'
    const birthLabel  = new Date(form.birth_date).toLocaleDateString('ru-RU')

    const commentLines = [
      `Дата рождения: ${birthLabel} (${age} лет)`,
      `Пол: ${genderLabel}`,
      form.comment ? `Комментарий: ${form.comment}` : '',
    ].filter(Boolean).join('\n')

    setLoading(true)
    try {
      const res = await fetch(`${API}/applications/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.child_name,
          phone,
          comment: commentLines,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.detail || 'Ошибка отправки')
        return
      }
      setDone(true)
    } catch {
      setError('Ошибка соединения с сервером')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <main className="apply-page">
        <div className="apply-success">
          <div className="apply-success-icon">
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
              <circle cx="28" cy="28" r="26" stroke="#4caf50" strokeWidth="2"/>
              <path d="M16 28l8 8 16-16" stroke="#4caf50" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1>Заявка отправлена!</h1>
          <p>Мы свяжемся с вами в ближайшее время для подтверждения записи.</p>
          <p className="apply-success-contact">
            Если у вас есть вопросы — звоните:<br/>
            <a href="tel:+79091652800">+7 (909) 165-28-00</a>
          </p>
          <button className="btn-outline" onClick={() => { setDone(false); setForm({ child_name:'', birth_date:'', gender:'male', phone:'', comment:'' }) }}>
            Отправить ещё заявку
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="apply-page">
      <section className="apply-hero">
        <div className="container">
          <p className="section-label">Вступление в клуб</p>
          <h1 className="apply-title">ЗАПИСАТЬСЯ</h1>
          <div className="divider" />
          <p className="apply-sub">Первое занятие — бесплатно</p>
        </div>
      </section>

      <div className="container apply-body">
        <div className="apply-form-wrap">

          <div className="apply-form-header">
            <h2>Заявка на вступление</h2>
            <p>Заполните данные ребёнка или взрослого участника. Тренер свяжется с вами для согласования времени пробного занятия.</p>
          </div>

          {error && <div className="apply-error">{error}</div>}

          <div className="apply-fields">
            <div className="apply-field">
              <label>ФИО ребёнка / участника <span>*</span></label>
              <input type="text" placeholder="Иванов Иван Иванович"
                value={form.child_name} onChange={e => set('child_name', e.target.value)} />
            </div>

            <div className="apply-row">
              <div className="apply-field">
                <label>Дата рождения <span>*</span></label>
                <input type="date" value={form.birth_date}
                  onChange={e => set('birth_date', e.target.value)} />
              </div>
              <div className="apply-field">
                <label>Пол</label>
                <select value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="male">Мужской</option>
                  <option value="female">Женский</option>
                </select>
              </div>
            </div>

            <div className="apply-field">
              <label>Телефон для связи <span>*</span></label>
              <input type="tel" placeholder="+7 (___) ___-__-__"
                value={form.phone}
                onChange={e => set('phone', formatPhone(e.target.value))} />
              <p className="apply-field-hint">Мы позвоним на этот номер для подтверждения</p>
            </div>

            <div className="apply-field">
              <label>Комментарий (необязательно)</label>
              <textarea rows={3} placeholder="Например: опыт в спорте, вопросы к тренеру..."
                value={form.comment} onChange={e => set('comment', e.target.value)} />
            </div>
          </div>

          <button className="btn-primary apply-submit" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Отправка...' : 'Отправить заявку'}
          </button>

          <p className="apply-note">
            Или позвоните напрямую: <a href="tel:+79091652800">+7 (909) 165-28-00</a>
          </p>
        </div>

        <div className="apply-info">
          <div className="apply-info-card">
            <h3>Что дальше?</h3>
            <div className="apply-steps">
              <div className="apply-step">
                <div className="apply-step-num">01</div>
                <div>
                  <strong>Звонок тренера</strong>
                  <p>Свяжемся с вами в течение дня для согласования времени</p>
                </div>
              </div>
              <div className="apply-step">
                <div className="apply-step-num">02</div>
                <div>
                  <strong>Пробное занятие</strong>
                  <p>Первая тренировка бесплатно — посмотрите и попробуйте</p>
                </div>
              </div>
              <div className="apply-step">
                <div className="apply-step-num">03</div>
                <div>
                  <strong>Вступление в клуб</strong>
                  <p>Оформление документов и начало регулярных тренировок</p>
                </div>
              </div>
            </div>
          </div>

          <div className="apply-info-card">
            <h3>С собой на первое занятие</h3>
            <ul>
              <li>Спортивная форма и обувь</li>
              <li>Медицинская справка (форма 086/у)</li>
              <li>Свидетельство о рождении / паспорт</li>
              <li>Хорошее настроение</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}
