import { Link } from 'react-router-dom'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <div className="footer-logo">ТАЙПАН</div>
          <p>Спортивный клуб тхэквондо<br/>г. Павловский Посад</p>
        </div>
        <div className="footer-links">
          <h4>Навигация</h4>
          <Link to="/">Главная</Link>
          <Link to="/schedule">Расписание</Link>
          <Link to="/apply">Записаться</Link>
          <Link to="/login">Личный кабинет</Link>
        </div>
        <div className="footer-contacts">
          <h4>Контакты</h4>
          <p>📍 Павловский Посад, ул. Примерная, 1</p>
          <p>📞 +7 (496) 000-00-00</p>
          <p>✉️ info@taipan-tkd.ru</p>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container">
          <span>© 2025 Тайпан. Все права защищены.</span>
          <span>Тхэквондо · Павловский Посад</span>
        </div>
      </div>
    </footer>
  )
}
