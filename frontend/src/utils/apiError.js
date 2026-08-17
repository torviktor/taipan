/**
 * Единый разбор ошибок API в текст для пользователя.
 *
 * Появилось после инцидента 14.08.2026: в Login.jsx стоял один общий catch,
 * показывавший «Неверный телефон или пароль» вообще на всё — включая 502, 504
 * и таймаут. Сайт лежал трое суток, а сообщение уверенно указывало на неверный
 * пароль, и диагностика несколько часов шла не туда.
 *
 * Правило: инфраструктурный сбой нельзя показывать как ошибку пользователя.
 */

const DEFAULTS = {
  400: 'Проверьте правильность заполнения формы',
  401: 'Требуется вход',
  403: 'Доступ запрещён',
  404: 'Не найдено',
  409: 'Такая запись уже существует',
  429: 'Слишком много попыток. Подождите минуту.',
  server: 'Сервис недоступен, попробуйте позже',
  offline: 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.',
  fallback: 'Не удалось выполнить запрос. Попробуйте ещё раз.',
}

/** Ошибка сети/таймаута, а не ответ сервера. */
export function isOfflineError(err) {
  if (!err) return false
  // axios: таймаут — ECONNABORTED, обрыв — нет err.response
  if (err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK') return true
  if (err.isAxiosError && !err.response) return true
  // fetch: AbortController по таймауту, TypeError при обрыве соединения
  if (err.name === 'AbortError' || err.name === 'TimeoutError') return true
  if (err instanceof TypeError) return true
  return false
}

/**
 * Текст по коду ответа.
 * @param status  HTTP-код
 * @param detail  detail из тела ответа, если он есть и осмыслен
 * @param texts   переопределения под конкретную форму, напр. { 401: '...' }
 */
export function statusText(status, detail, texts = {}) {
  const t = { ...DEFAULTS, ...texts }
  if (status >= 500) return t.server
  if (t[status]) {
    // Для 400/403/404/409 сообщение бэкенда обычно точнее общего текста.
    if (detail && status !== 401 && status !== 429) return detail
    return t[status]
  }
  return detail || t.fallback
}

/** Разбор ошибки axios. */
export function apiErrorText(err, texts = {}) {
  const t = { ...DEFAULTS, ...texts }
  if (isOfflineError(err)) return t.offline
  if (!err || !err.response) return t.offline
  const { status, data } = err.response
  const detail = typeof data?.detail === 'string' ? data.detail : null
  return statusText(status, detail, texts)
}

/**
 * Разбор неуспешного Response из fetch. Асинхронный — читает тело.
 * Тело может быть не JSON (502 от nginx отдаёт HTML) — это не должно ломать
 * обработку, поэтому парсинг обёрнут.
 */
export async function responseErrorText(res, texts = {}) {
  let detail = null
  try {
    const data = await res.clone().json()
    if (typeof data?.detail === 'string') detail = data.detail
  } catch {
    // не JSON — значит отвечал не наш бэкенд, а прокси; detail не нужен
  }
  return statusText(res.status, detail, texts)
}

/** Текст для исключения, вылетевшего из fetch (сеть/таймаут/прочее). */
export function thrownErrorText(err, texts = {}) {
  const t = { ...DEFAULTS, ...texts }
  return isOfflineError(err) ? t.offline : t.fallback
}
