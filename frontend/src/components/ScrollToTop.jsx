import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// При каждом переходе на новую страницу — скролл наверх
export default function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}
