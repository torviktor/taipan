import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import './Navbar.css'

const STATIC_INDEX = [
  { path: '/',          title: 'Главная',           keywords: 'главная клуб тайпан тхэквондо павловский посад' },
  { path: '/about',     title: 'О клубе',           keywords: 'о клубе тренер ротарь екатерина история эмблема обязанности сезон аттестация сборы семья' },
  { path: '/schedule',  title: 'Расписание',         keywords: 'расписание тренировки группа младшая старшая вторник четверг суббота время 17:30 19:00' },
  { path: '/calendar',  title: 'Календарь событий',  keywords: 'календарь события соревнования сборы турнир' },
  { path: '/apply',     title: 'Записаться',         keywords: 'записаться заявка вступление пробное занятие регистрация' },
  { path: '/champions', title: 'Зал славы',          keywords: 'зал славы чемпионы кабанова шамарин фуртаева андрюшин келим медведев козлов комаров коростелёва дорофеев ротарь' },
  { path: '/groups/kids-6-10',  title: 'Группа 6–10 лет',  keywords: 'младшая группа дети 6 7 8 9 10 лет' },
  { path: '/groups/kids-11-16', title: 'Группа 11–16 лет', keywords: 'старшая группа дети 11 12 13 14 15 16 лет' },
  { path: '/groups/adults',     title: 'Взрослая группа',  keywords: 'взрослые группа 16 лет' },
]

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10.5 10.5L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export default function Navbar() {
  const [scrolled,   setScrolled]   = useState(false)
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query,      setQuery]      = useState('')
  const [results,    setResults]    = useState([])
  const [searching,  setSearching]  = useState(false)

  const location    = useLocation()
  const navigate    = useNavigate()
  const searchRef   = useRef(null)
  const inputRef    = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setMenuOpen(false); closeSearch() }, [location])

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) closeSearch()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (searchOpen && inputRef.current) inputRef.current.focus()
  }, [searchOpen])

  const closeSearch = () => { setSearchOpen(false); setQuery(''); setResults([]) }

  const doSearch = async (q) => {
    if (!q.trim()) { setResults([]); return }
    const low = q.toLowerCase()
    const staticHits = STATIC_INDEX
      .filter(p => p.title.toLowerCase().includes(low) || p.keywords.includes(low))
      .map(p => ({ path: p.path, title: p.title, sub: 'Страница' }))
    setSearching(true)
    let eventHits = []
    try {
      const r = await fetch('/api/events/')
      if (r.ok) {
        const events = await r.json()
        eventHits = events
          .filter(e =>
            e.title.toLowerCase().includes(low) ||
            (e.description || '').toLowerCase().includes(low) ||
            (e.location || '').toLowerCase().includes(low)
          )
          .slice(0, 4)
          .map(e => ({
            path: '/calendar',
            title: e.title,
            sub: new Date(e.event_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }),
          }))
      }
    } catch {}
    setSearching(false)
    setResults([...staticHits, ...eventHits])
  }

  const handleQuery = (q) => {
    setQuery(q)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(q), 250)
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
          {/* Панель убрана — кнопка Кабинет одна для всех */}
        </ul>

        <div className="navbar-actions">
          <div className="navbar-search" ref={searchRef}>
            <button
              className={`navbar-search-btn ${searchOpen ? 'active' : ''}`}
              onClick={() => setSearchOpen(o => !o)}
              title="Поиск по сайту"
              aria-label="Поиск"
            >
              <SearchIcon />
            </button>
            {searchOpen && (
              <div className="navbar-search-dropdown">
                <div className="navbar-search-field">
                  <SearchIcon />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Поиск по сайту..."
                    value={query}
                    onChange={e => handleQuery(e.target.value)}
                    className="navbar-search-input"
                  />
                  {searching && <span className="navbar-search-spin">...</span>}
                </div>
                {results.length > 0 && (
                  <ul className="navbar-search-results">
                    {results.map((r, i) => (
                      <li key={i}>
                        <button onClick={() => goTo(r.path)}>
                          <span className="search-result-title">{r.title}</span>
                          <span className="search-result-sub">{r.sub}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {query && !searching && results.length === 0 && (
                  <div className="navbar-search-empty">Ничего не найдено</div>
                )}
                {!query && (
                  <div className="navbar-search-hint">Введите запрос — страницы или события</div>
                )}
              </div>
            )}
          </div>

          {token
            ? <Link to="/cabinet" className="btn-primary">Кабинет</Link>
            : <Link to="/login"   className="btn-primary">Войти</Link>
          }
        </div>

        <button className={`burger ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(!menuOpen)}>
          <span/><span/><span/>
        </button>
      </div>

      {/* Мобильное меню */}
      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
        {links.map(l => <Link key={l.to} to={l.to}>{l.label}</Link>)}
        {token
          ? <Link to="/cabinet" className="mobile-menu-cabinet">Кабинет</Link>
          : <Link to="/login"   className="mobile-menu-cabinet">Войти</Link>
        }
      </div>
    </nav>
  )
}
