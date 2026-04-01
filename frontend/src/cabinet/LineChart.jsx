export default function LineChart({ data, xKey, yKey, color = 'var(--red)', height = 180 }) {
  if (!data || data.length === 0) return <div className="cabinet-empty">Нет данных</div>
  const vals = data.map(d => d[yKey])
  const max  = Math.max(...vals, 1)
  const W = 620, H = height
  // Увеличиваем нижний отступ если много точек — для диагональных подписей
  const bottomPad = data.length > 6 ? 60 : 36
  const PAD = { t: 20, r: 20, b: bottomPad, l: 36 }
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const px = i => PAD.l + (i / (data.length - 1 || 1)) * iw
  const py = v => PAD.t + ih - (v / max) * ih
  const pts = data.map((d, i) => `${px(i)},${py(d[yKey])}`).join(' ')
  const area = `M${px(0)},${py(0)} ` + data.map((d,i) => `L${px(i)},${py(d[yKey])}`).join(' ') + ` L${px(data.length-1)},${PAD.t+ih} L${px(0)},${PAD.t+ih} Z`
  const diagonal = data.length > 6
  return (
    <svg viewBox={`0 0 ${W} ${H + (diagonal ? 20 : 0)}`} style={{ width:'100%', maxWidth:W, display:'block' }}>
      {[0,0.5,1].map(f => <line key={f} x1={PAD.l} x2={W-PAD.r} y1={PAD.t+ih*(1-f)} y2={PAD.t+ih*(1-f)} stroke="var(--gray-dim)" strokeDasharray="4 3"/>)}
      <path d={area} fill={color} fillOpacity="0.1"/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={px(i)} cy={py(d[yKey])} r="4" fill={color}/>
          <text x={px(i)} y={py(d[yKey])-8} textAnchor="middle" fontSize="11" fill="var(--white)">{d[yKey]}</text>
          {diagonal
            ? <text
                transform={`translate(${px(i)}, ${H - bottomPad + 14}) rotate(-40)`}
                textAnchor="end" fontSize="10" fill="var(--gray)"
              >{d[xKey]}</text>
            : <text x={px(i)} y={H - bottomPad + 16} textAnchor="middle" fontSize="10" fill="var(--gray)">{d[xKey]}</text>
          }
        </g>
      ))}
      {[0, Math.round(max/2), max].map(v => <text key={v} x={PAD.l-4} y={py(v)+4} textAnchor="end" fontSize="10" fill="var(--gray)">{v}</text>)}
    </svg>
  )
}
