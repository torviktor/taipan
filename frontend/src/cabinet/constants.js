export const API = '/api'

// ── Спортивный сезон (сентябрь–август) ────────────────────────────────────────
// Сезон 2025/2026 = сен 2025 – авг 2026
export const getSeason = (d) => {
  const date = d ? new Date(d) : new Date()
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 1-12
  return month >= 9 ? year : year - 1  // начало сезона
}

export const seasonLabel = (y) => `${y}/${y+1}`
export const currentSeason = getSeason()
export const currentSeasonLabel = seasonLabel(currentSeason)

// Диапазон дат сезона
export const seasonRange = (y) => {
  if (!y && y !== 0) return { start: '2000-01-01', end: '2099-12-31' }
  return {
    start: `${y}-09-01`,
    end:   `${y+1}-08-31`
  }
}

export const GROUPS = ['Младшая группа (6–10 лет)', 'Старшая группа (11+)', 'Взрослые (18+)']
