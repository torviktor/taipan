export const DEFAULT_TIMEOUT = 15000

/**
 * fetch с таймаутом.
 *
 * У штатного fetch таймаута нет вообще: если сервер принял соединение и молчит,
 * промис не разрешится никогда, кнопка навсегда останется в состоянии загрузки,
 * а finally с setLoading(false) не выполнится. Ровно это наблюдали 14.08.2026.
 *
 * По истечении timeout вылетает AbortError — его ловит isOfflineError()
 * из utils/apiError.js.
 */
export async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    return await fetch(url, { ...options, signal: options.signal || controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function apiFetch(url, options = {}) {
  const { skipAuthRedirect, timeout, ...fetchOptions } = options
  const r = await fetchWithTimeout(url, fetchOptions, timeout)
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
