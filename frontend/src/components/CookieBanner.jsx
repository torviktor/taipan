import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './CookieBanner.css'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const accepted = localStorage.getItem('cookie_accepted')
    if (!accepted) setTimeout(() => setVisible(true), 1000)
  }, [])

  const accept = () => {
    localStorage.setItem('cookie_accepted', '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="cookie-banner">
      <div className="cookie-banner-inner">
        <div className="cookie-text-wrap">
          <p className="cookie-title">Мы используем файлы cookie</p>
          <p className="cookie-text">
            Сайт использует cookie для авторизации и корректной работы сервисов.
            Продолжая использовать сайт, вы соглашаетесь с{' '}
            <Link to="/privacy">политикой конфиденциальности</Link>{' '}
            и обработкой персональных данных в соответствии с ФЗ-152.
          </p>
        </div>
        <div className="cookie-actions">
          <button className="btn-primary cookie-btn" onClick={accept}>Принять и продолжить</button>
          <Link to="/privacy" className="cookie-link">Подробнее</Link>
        </div>
      </div>
    </div>
  )
}
