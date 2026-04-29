import { Navigate, useLocation } from 'react-router-dom'

/**
 * Guard для закрытых разделов сайта.
 * Пускает только если в localStorage есть token.
 * Проверка is_active делается на бэкенде через get_current_user —
 * если пользователь архивный, любой защищённый запрос вернёт 401/403,
 * и компоненты внутри сами обработают это редиректом.
 */
export default function PrivateRoute({ children }) {
  const token = localStorage.getItem('token')
  const location = useLocation()

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
