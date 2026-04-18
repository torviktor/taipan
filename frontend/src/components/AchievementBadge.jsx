export const TIER_STYLES = {
  common:    { border: '#555555', bg: '#111111', glow: 'none',                           label: 'Обычная' },
  rare:      { border: '#CC0000', bg: '#180000', glow: '0 0 14px rgba(204,0,0,0.5)',     label: 'Редкая' },
  legendary: { border: '#c8962a', bg: '#1a1200', glow: '0 0 18px rgba(200,150,42,0.6)', label: 'Легендарная' },
}

export const TIER_LABEL = { common: 'Обычная', rare: 'Редкая', legendary: 'Легендарная' }

export const CATEGORY_LABEL = {
  attendance:    'Посещаемость',
  competition:   'Соревнования',
  certification: 'Аттестация',
  camp:          'Сборы',
}

export const ACHIEVEMENTS_CATALOG = {
  attendance_10:     { name: 'Первые 10',       desc: '10 тренировок посещено',    tier: 'common',    category: 'attendance' },
  attendance_50:     { name: 'Полсотни',        desc: '50 тренировок посещено',    tier: 'rare',      category: 'attendance' },
  attendance_100:    { name: 'Сотня',           desc: '100 тренировок посещено',   tier: 'legendary', category: 'attendance' },
  competition_first: { name: 'Боевое крещение', desc: 'Первое соревнование',       tier: 'common',    category: 'competition' },
  competition_gold:  { name: 'Золото',          desc: '1 место на турнире',        tier: 'legendary', category: 'competition' },
  cert_advance:      { name: 'Новый пояс',      desc: 'Аттестация пройдена',       tier: 'rare',      category: 'certification' },
  loyalty_1year:     { name: 'Год в клубе',     desc: '1 год тренировок',          tier: 'legendary', category: 'meta' },
  camp_member:       { name: 'Боец сборов',     desc: 'Участие в сборах',          tier: 'rare',      category: 'camp' },
}

export default function AchievementBadge({ ach, size = 'normal' }) {
  const info  = ACHIEVEMENTS_CATALOG[ach.code] || {}
  const tier  = ach.tier  || info.tier  || 'common'
  const name  = ach.name  || info.name  || ach.code
  const style = TIER_STYLES[tier] || TIER_STYLES.common
  const dim   = typeof size === 'number' ? size : (size === 'small' ? 80 : 110)
  const opacity = ach.granted ? 1 : 0.2

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, opacity, transition:'opacity 0.2s', width: dim + 20 }}>
      <div style={{
        width: dim, height: dim,
        border: `2px solid ${style.border}`,
        borderRadius: 8,
        background: style.bg,
        boxShadow: ach.granted ? style.glow : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <img src="/logo.png" alt="" style={{
          width: '82%', height: '82%',
          objectFit: 'contain',
          opacity: ach.granted ? 0.9 : 0.15,
          filter: ach.granted
            ? (tier === 'legendary'
                ? 'drop-shadow(0 0 8px rgba(200,150,42,0.8))'
                : tier === 'rare'
                ? 'drop-shadow(0 0 6px rgba(204,0,0,0.8))'
                : 'none')
            : 'grayscale(1)',
          transition: 'all 0.2s',
          position: 'relative', zIndex: 1,
        }}/>
        {ach.granted && (
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: 0, height: 0,
            borderStyle: 'solid',
            borderWidth: '0 22px 22px 0',
            borderColor: `transparent ${style.border} transparent transparent`,
          }}/>
        )}
      </div>
      <div style={{
        fontFamily: 'Bebas Neue, sans-serif',
        fontSize: dim <= 80 ? '0.7rem' : '0.78rem',
        letterSpacing: '0.05em',
        color: ach.granted ? style.border : '#333',
        textAlign: 'center', lineHeight: 1.2,
        maxWidth: dim + 10,
      }}>{name}</div>
      {ach.granted && (
        <div style={{ fontSize: '0.65rem', color: 'var(--gray)', textAlign: 'center' }}>
          {TIER_LABEL[tier]}
        </div>
      )}
    </div>
  )
}
