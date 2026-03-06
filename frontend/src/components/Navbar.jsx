import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './Navbar.css'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setMenuOpen(false), [location])

  const token = localStorage.getItem('token')
  const role  = localStorage.getItem('role')

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="container navbar-inner">

        {/* Логотип */}
        <Link to="/" className="navbar-logo">
          <span className="logo-taipan">ТАЙПАН</span>
          <span className="logo-sub">ТХЭКВОНДО</span>
        </Link>

        {/* Десктоп меню */}
        <ul className="navbar-links">
          <li><Link to="/" className={location.pathname === '/' ? 'active' : ''}>Главная</Link></li>
          <li><Link to="/schedule" className={location.pathname === '/schedule' ? 'active' : ''}>Расписание</Link></li>
          <li><Link to="/apply" className={location.pathname === '/apply' ? 'active' : ''}>Записаться</Link></li>
          {token && role === 'manager' && (
            <li><Link to="/admin" className={location.pathname === '/admin' ? 'active' : ''}>Панель</Link></li>
          )}
        </ul>

        {/* Кнопка входа */}
        <div className="navbar-actions">
          {token ? (
            <Link to="/cabinet" className="btn-primary">Кабинет</Link>
          ) : (
            <Link to="/login" className="btn-primary">Войти</Link>
          )}
        </div>

        {/* Бургер */}
        <button className={`burger ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(!menuOpen)}>
          <span/><span/><span/>
        </button>
      </div>

      {/* Мобильное меню */}
      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
        <Link to="/">Главная</Link>
        <Link to="/schedule">Расписание</Link>
        <Link to="/apply">Записаться</Link>
        {token ? (
          <Link to="/cabinet">Кабинет</Link>
        ) : (
          <Link to="/login">Войти</Link>
        )}
      </div>
    </nav>
  )
}
