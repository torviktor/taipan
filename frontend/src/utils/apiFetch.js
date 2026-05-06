export async function apiFetch(url, options = {}) {
  const { skipAuthRedirect, ...fetchOptions } = options
  const r = await fetch(url, fetchOptions)
  if (r.status === 401 && !skipAuthRedirect) {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('full_name')
    localStorage.removeItem('user_id')
    alert('Сессия истекла, войдите снова')
    window.location.href = '/login'
    throw new Error('Session expired')
  }
  return r
}
