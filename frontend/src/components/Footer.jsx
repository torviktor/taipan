import { Link } from 'react-router-dom'
import './Footer.css'

function IconLocation() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" className="footer-svg-icon">
      <path d="M9 1C6.24 1 4 3.24 4 6c0 4 5 11 5 11s5-7 5-11c0-2.76-2.24-5-5-5z" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <circle cx="9" cy="6" r="1.8" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    </svg>
  )
}
function IconPhone() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" className="footer-svg-icon">
      <path d="M3 3h4l1.5 3.5-2 1.2a9 9 0 004.8 4.8l1.2-2L16 11v4a1 1 0 01-1 1C7.16 16 2 10.84 2 4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}
function IconMail() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" className="footer-svg-icon">
      <rect x="2" y="4" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <path d="M2 5l7 5 7-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  )
}

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <div className="footer-logo">ТАЙПАН</div>
          <p>Спортивный клуб тхэквондо<br/>г. Павловский Посад</p>
          <p className="footer-dev">
            Сайт разработан{' '}
            <a href="https://t.me/TORVIKTOR" target="_blank" rel="noreferrer">t.me/TORVIKTOR</a>
            {' '}(<a href="https://github.com/torviktor/taipan" target="_blank" rel="noreferrer">github.com/torviktor/taipan</a>).<br/>
            Собственность клуба «Тайпан»
          </p>
        </div>
        <div className="footer-links">
          <h4>Навигация</h4>
          <Link to="/">Главная</Link>
          <Link to="/about">О клубе</Link>
          <Link to="/schedule">Расписание</Link>
          <Link to="/news">Новости</Link>
          <Link to="/calendar">Календарь</Link>
          <Link to="/champions">Зал Славы</Link>
          <Link to="/quiz">Тест</Link>
          <Link to="/apply">Записаться</Link>
          <Link to="/cabinet">Личный кабинет</Link>
        </div>
        <div className="footer-contacts">
          <h4>Контакты</h4>
          <div className="footer-contact-item">
            <IconLocation />
            <span>Павловский Посад, ул. Кирова, 95</span>
          </div>
          <div className="footer-contact-item">
            <IconPhone />
            <a href="tel:+79091652800">+7 (909) 165-28-00</a>
          </div>
          <div className="footer-contact-item">
            <IconMail />
            <a href="mailto:Bliznec.ket@mail.ru">Bliznec.ket@mail.ru</a>
          </div>
          <a
            href="https://yandex.ru/maps/?text=Павловский+Посад,+ул.+Кирова,+95"
            target="_blank" rel="noreferrer" className="footer-map-link"
          >
            Открыть на карте →
          </a>
        </div>
      </div>
      <div className="footer-ad">
        <div className="container">
          <div className="ad-banner">
            <div className="ad-label">РЕКЛАМА</div>
            <p className="ad-text">Здесь могла бы быть ваша реклама</p>
            <p className="ad-sub">Размещение рекламы на сайте клуба тхэквондо «Тайпан»</p>
            <a href="mailto:Bliznec.ket@mail.ru" className="ad-btn">Связаться →</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container">
          <span>© 2025–2026 Клуб тхэквондо «Тайпан», Павловский Посад. Все права защищены.</span>
          <span>Тхэквондо · Павловский Посад · с 2025 года</span>
        </div>
      </div>
    </footer>
  )
}
