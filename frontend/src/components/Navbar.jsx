import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './Navbar.css'

export default function Navbar() {
  const [scrolled,  setScrolled]  = useState(false)
  const [menuOpen,  setMenuOpen]  = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setMenuOpen(false), [location])

  const token = localStorage.getItem('token')
  const role  = localStorage.getItem('role')
  const isAdmin = ['admin', 'manager'].includes(role)

  const links = [
    { to: '/',         label: 'Главная' },
    { to: '/about',    label: 'О клубе' },
    { to: '/schedule', label: 'Расписание' },
    { to: '/calendar', label: 'Календарь' },
    { to: '/apply',    label: 'Записаться' },
  ]

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="container navbar-inner">

        <Link to="/" className="navbar-logo">
          <img src="/logo.png" alt="Тайпан" className="navbar-logo-img" />
        </Link>

        <ul className="navbar-links">
          {links.map(l => (
            <li key={l.to}>
              <Link to={l.to} className={location.pathname === l.to ? 'active' : ''}>{l.label}</Link>
            </li>
          ))}
          {isAdmin && (
            <li><Link to="/admin" className={location.pathname === '/admin' ? 'active' : ''}>Панель</Link></li>
          )}
        </ul>

        <div className="navbar-actions">
          {token ? (
            <Link to="/cabinet" className="btn-primary">Кабинет</Link>
          ) : (
            <Link to="/login" className="btn-primary">Войти</Link>
          )}
        </div>

        <button className={`burger ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(!menuOpen)}>
          <span/><span/><span/>
        </button>
      </div>

      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
        {links.map(l => <Link key={l.to} to={l.to}>{l.label}</Link>)}
        {isAdmin && <Link to="/admin">Панель</Link>}
        {token ? <Link to="/cabinet">Кабинет</Link> : <Link to="/login">Войти</Link>}
      </div>
    </nav>
  )
}
