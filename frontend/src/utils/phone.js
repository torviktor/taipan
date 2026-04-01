export function formatPhone(value) {
  const digits = value.replace(/\D/g, '')
  let local = digits
  if (local.startsWith('8')) local = local.slice(1)
  if (local.startsWith('7')) local = local.slice(1)
  local = local.slice(0, 10)
  let result = '+7'
  if (local.length > 0) result += ' (' + local.slice(0, 3)
  if (local.length >= 3) result += ') ' + local.slice(3, 6)
  if (local.length >= 6) result += '-' + local.slice(6, 8)
  if (local.length >= 8) result += '-' + local.slice(8, 10)
  return result
}

export function normalizePhone(formatted) {
  const digits = formatted.replace(/\D/g, '')
  if (digits.startsWith('8')) return '7' + digits.slice(1)
  if (digits.startsWith('7')) return digits
  return '7' + digits
}
