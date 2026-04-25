// Утилиты для работы с днями рождения спортсменов

// Возвращает 'today' | 'tomorrow' | null
export function getBirthdayStatus(birthDateStr) {
  if (!birthDateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const b = new Date(birthDateStr)
  const thisYear = new Date(today.getFullYear(), b.getMonth(), b.getDate())
  const nextYear = new Date(today.getFullYear() + 1, b.getMonth(), b.getDate())

  const isToday = thisYear.getTime() === today.getTime() || nextYear.getTime() === today.getTime()
  const isTomorrow = thisYear.getTime() === tomorrow.getTime() || nextYear.getTime() === tomorrow.getTime()

  if (isToday) return 'today'
  if (isTomorrow) return 'tomorrow'
  return null
}

// Дней до ближайшего ДР
export function daysUntilBirthday(birthDateStr) {
  if (!birthDateStr) return Number.MAX_SAFE_INTEGER
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const b = new Date(birthDateStr)
  let next = new Date(today.getFullYear(), b.getMonth(), b.getDate())
  if (next < today) next = new Date(today.getFullYear() + 1, b.getMonth(), b.getDate())
  return Math.round((next - today) / 86400000)
}

// Возраст, который исполнится в ближайший ДР
export function ageOnNextBirthday(birthDateStr) {
  if (!birthDateStr) return null
  const today = new Date()
  const b = new Date(birthDateStr)
  let nextYear = today.getFullYear()
  const thisYearBday = new Date(today.getFullYear(), b.getMonth(), b.getDate())
  if (thisYearBday < new Date(today.getFullYear(), today.getMonth(), today.getDate())) nextYear += 1
  return nextYear - b.getFullYear()
}
