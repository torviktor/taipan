import { Link } from 'react-router-dom'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">

        <div className="footer-brand">
          <div className="footer-logo">ТАЙПАН</div>
          <p>Спортивный клуб тхэквондо<br/>г. Павловский Посад</p>
          <p className="footer-dev">
            Сайт разработан и принадлежит<br/>
            клубу «Тайпан» и его основателям.<br/>
            <a href="https://github.com/torviktor/taipan" target="_blank" rel="noreferrer">
              github.com/torviktor/taipan
            </a>
          </p>
        </div>

        <div className="footer-links">
          <h4>Навигация</h4>
          <Link to="/">Главная</Link>
          <Link to="/about">О клубе</Link>
          <Link to="/schedule">Расписание</Link>
          <Link to="/calendar">Календарь</Link>
          <Link to="/apply">Записаться</Link>
          <Link to="/login">Личный кабинет</Link>
        </div>

        <div className="footer-contacts">
          <h4>Контакты</h4>
          <p>📍 Павловский Посад, ул. Кирова, 95</p>
          <p>📞 +7 (909) 165-28-00</p>
          <p>✉️ Bliznec.ket@mail.ru</p>
          <a
            href="https://yandex.ru/maps/?text=Павловский+Посад,+ул.+Кирова,+95"
            target="_blank"
            rel="noreferrer"
            className="footer-map-link"
          >
            Открыть на карте →
          </a>
        </div>

      </div>

      {/* Рекламный баннер */}
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
          <span>Тхэквондо · Павловский Посад · с 2008 года</span>
        </div>
      </div>
    </footer>
  )
}
