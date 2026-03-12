import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import './Navbar.css'

// Страницы по которым ищем
const SEARCH_INDEX = [
  { path: '/',          title: 'Главная',      keywords: 'главная клуб тайпан тхэквондо павловский посад' },
  { path: '/about',     title: 'О клубе',      keywords: 'о клубе тренер история эмблема обязанности сезон аттестация сборы семья' },
  { path: '/schedule',  title: 'Расписание',   keywords: 'расписание тренировки группа младшая старшая вторник четверг суббота время' },
  { path: '/calendar',  title: 'Календарь',    keywords: 'календарь события соревнования сборы турнир' },
  { path: '/apply',     title: 'Записаться',   keywords: 'записаться заявка вступление пробное занятие регистрация' },
  { path: '/champions', title: 'Зал славы',    keywords: 'зал славы чемпионы кабанова шамарин фуртаева андрюшин келим медведев козлов комаров коростелёва' },
  { path: '/groups/kids-6-10',  title: 'Группа 6–10 лет',  keywords: 'младшая группа дети 6 7 8 9 10 лет' },
  { path: '/groups/kids-11-16', title: 'Группа 10–18 лет', keywords: 'старшая группа подростки 11 12 13 14 15 16 17 18 лет' },
  { path: '/groups/adults',     title: 'Взрослая группа',  keywords: 'взрослые группа 18 лет' },
]

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M11.5 11.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export default function Navbar() {
  const [scrolled,     setScrolled]     = useState(false)
  const [menuOpen,     setMenuOpen]     = useState(false)
  const [searchOpen,   setSearchOpen]   = useState(false)
  const [searchQuery,  setSearchQuery]  = useState('')
  const [searchResult, setSearchResult] = useState([])
  const location = useLocation()
  const navigate = useNavigate()
  const searchRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setMenuOpen(false); closeSearch() }, [location])

  // Закрыть поиск при клике вне
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) closeSearch()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Фокус на инпут при открытии
  useEffect(() => {
    if (searchOpen && inputRef.current) inputRef.current.focus()
  }, [searchOpen])

  const closeSearch = () => { setSearchOpen(false); setSearchQuery(''); setSearchResult([]) }

  const handleSearch = (q) => {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResult([]); return }
    const low = q.toLowerCase()
    const results = SEARCH_INDEX.filter(p =>
      p.title.toLowerCase().includes(low) || p.keywords.includes(low)
    )
    setSearchResult(results)
  }

  const goTo = (path) => { closeSearch(); navigate(path) }

  const token   = localStorage.getItem('token')
  const role    = localStorage.getItem('role')
  const isAdmin = ['admin', 'manager'].includes(role)

  const links = [
    { to: '/',         label: 'Главная'    },
    { to: '/about',    label: 'О клубе'   },
    { to: '/schedule', label: 'Расписание' },
    { to: '/calendar', label: 'Календарь'  },
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
            <li><Link to="/cabinet" className={location.pathname === '/cabinet' ? 'active' : ''}>Панель</Link></li>
          )}
        </ul>

        <div className="navbar-actions">
          {/* Поиск */}
          <div className="navbar-search" ref={searchRef}>
            <button
              className={`navbar-search-btn ${searchOpen ? 'active' : ''}`}
              onClick={() => setSearchOpen(o => !o)}
              title="Поиск по сайту"
            >
              <SearchIcon />
            </button>

            {searchOpen && (
              <div className="navbar-search-dropdown">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Поиск по сайту..."
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                  className="navbar-search-input"
                />
                {searchResult.length > 0 && (
                  <ul className="navbar-search-results">
                    {searchResult.map(r => (
                      <li key={r.path}>
                        <button onClick={() => goTo(r.path)}>{r.title}</button>
                      </li>
                    ))}
                  </ul>
                )}
                {searchQuery && searchResult.length === 0 && (
                  <div className="navbar-search-empty">Ничего не найдено</div>
                )}
              </div>
            )}
          </div>

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
        {isAdmin && <Link to="/cabinet">Панель</Link>}
        {token ? <Link to="/cabinet">Кабинет</Link> : <Link to="/login">Войти</Link>}
      </div>
    </nav>
  )
}
