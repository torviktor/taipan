const BELT_CONFIG = {
  // gup: { label, colors: [основной, полоска] }
  null: { label: 'Без пояса',     colors: ['#888888', null] },
  0:    { label: 'Без пояса',     colors: ['#888888', null] },
  11:   { label: '11 гып',        colors: ['#FF8C00', null] },         // оранжевый
  10:   { label: '10 гып',        colors: ['#f0f0f0', null] },         // белый
  9:    { label: '9 гып',         colors: ['#f0f0f0', '#FFD700'] },    // белый/жёлтый
  8:    { label: '8 гып',         colors: ['#FFD700', null] },         // жёлтый
  7:    { label: '7 гып',         colors: ['#FFD700', '#3a9a3a'] },    // жёлтый/зелёный
  6:    { label: '6 гып',         colors: ['#3a9a3a', null] },         // зелёный
  5:    { label: '5 гып',         colors: ['#3a9a3a', '#1a6ab5'] },    // зелёный/синий
  4:    { label: '4 гып',         colors: ['#1a6ab5', null] },         // синий
  3:    { label: '3 гып',         colors: ['#1a6ab5', '#CC0000'] },    // синий/красный
  2:    { label: '2 гып',         colors: ['#CC0000', null] },         // красный
  1:    { label: '1 гып',         colors: ['#CC0000', '#111111'] },    // красный/чёрный
}

export function BeltSVG({ colors, stripes = 0, width = 220, height = 32 }) {
  const [main, stripe] = colors
  const r = 6 // corner radius

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))'}}>
      <defs>
        <linearGradient id={`belt-grad-${main}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={main} stopOpacity="1"/>
          <stop offset="40%" stopColor={main} stopOpacity="0.85"/>
          <stop offset="100%" stopColor={main} stopOpacity="0.7"/>
        </linearGradient>
        {/* Stitching texture */}
        <pattern id="stitch" x="0" y="0" width="16" height={height} patternUnits="userSpaceOnUse">
          <line x1="8" y1="4" x2="8" y2={height-4} stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="3,3"/>
        </pattern>
      </defs>

      {/* Основной пояс */}
      <rect x="0" y="0" width={width} height={height} rx={r} ry={r} fill={`url(#belt-grad-${main})`}/>
      {/* Текстура */}
      <rect x="0" y="0" width={width} height={height} rx={r} ry={r} fill="url(#stitch)" opacity="0.6"/>
      {/* Блик сверху */}
      <rect x={r} y="1" width={width - r*2} height={height/3} rx={r/2} fill="rgba(255,255,255,0.12)"/>
      {/* Обводка */}
      <rect x="0.5" y="0.5" width={width-1} height={height-1} rx={r} ry={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>

      {/* Полоска если есть */}
      {stripe && (
        <>
          <rect x={0} y={height*0.35} width={width} height={height*0.3} fill={stripe} opacity="0.9"/>
          <rect x={0} y={height*0.35} width={width} height={height*0.3} fill="url(#stitch)" opacity="0.4"/>
        </>
      )}

      {/* Насечки для данов (на черном поясе) */}
      {stripes > 0 && Array.from({length: stripes}).map((_, i) => (
        <rect key={i} x={width - 28 - i*16} y={4} width={10} height={height-8} rx={2} fill="#FFD700" opacity="0.9"/>
      ))}
    </svg>
  )
}

export default function BeltDisplay({ gup, dan }) {
  if (dan) {
    // Чёрный пояс с насечками
    return (
      <div style={{ marginTop:16, display:'flex', alignItems:'center', gap:16 }}>
        <div>
          <div style={{ fontFamily:'Bebas Neue', fontSize:'1.4rem', color:'#FFD700', letterSpacing:'0.05em', textShadow:'0 0 12px rgba(200,150,42,0.6)', marginBottom:6 }}>
            {dan} ДАН
          </div>
          <BeltSVG colors={['#111111', null]} stripes={dan}/>
        </div>
      </div>
    )
  }

  const cfg = BELT_CONFIG[gup] || BELT_CONFIG[null]

  return (
    <div style={{ marginTop:16, display:'flex', alignItems:'center', gap:16 }}>
      <div>
        <div style={{ fontFamily:'Bebas Neue', fontSize:'1.2rem', letterSpacing:'0.05em', marginBottom:6,
          color: gup !== null && gup !== undefined && gup !== 0 ? '#c8962a' : 'var(--gray)',
          textShadow: gup ? '0 0 10px rgba(200,150,42,0.5)' : 'none'
        }}>
          {cfg.label}
        </div>
        <BeltSVG colors={cfg.colors}/>
      </div>
    </div>
  )
}
