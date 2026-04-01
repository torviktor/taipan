import { useState, useEffect } from 'react'
import { API, currentSeason, seasonLabel } from './constants'

const LEVEL_BADGE = {
  'Местный':       'cbadge-local',
  'Региональный':  'cbadge-regional',
  'Окружной':      'cbadge-district',
  'Всероссийский': 'cbadge-national',
  'Международный': 'cbadge-international',
}

function CompFilesBlock({ token, compId }) {
  const [files, setFiles] = useState([])
  useEffect(() => {
    fetch(`${API}/competitions/${compId}/files`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(setFiles)
      .catch(() => {})
  }, [compId])

  if (!files.length) return null

  return (
    <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid var(--gray-dim)' }}>
      <div style={{ fontFamily:'Barlow Condensed', fontSize:'11px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)', marginBottom:6 }}>
        Документы
      </div>
      {files.map(f => (
        <a key={f.id} href={f.file_url} target="_blank" rel="noreferrer"
          style={{ display:'flex', alignItems:'center', gap:8, color:'var(--white)', fontSize:'13px', textDecoration:'none', padding:'4px 0' }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{flexShrink:0}}>
            <path d="M8 1v9M4 7l4 4 4-4M2 13h12" stroke="var(--red)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {f.filename}
        </a>
      ))}
    </div>
  )
}

export default function ParentCompetitionsTab({ token, athletes }) {
  const [data,    setData]    = useState([])
  const [loading, setLoading] = useState(false)
  const [season,  setSeason]  = useState(currentSeason)
  const [seasons, setSeasons] = useState([currentSeason])

  useEffect(() => {
    fetch(`${API}/competitions/seasons`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [currentSeason])
      .then(s => { const list = s.length ? s : [currentSeason]; setSeasons(list); if (list.includes(currentSeason)) setSeason(currentSeason); else setSeason(list[0]) })
      .catch(() => {})
  }, [])

  useEffect(() => { loadAll() }, [season])

  const loadAll = async () => {
    setLoading(true)
    const results = []
    for (const a of athletes) {
      try {
        const url = season !== '' ? `${API}/competitions/rating/athlete/${a.id}?season=${season}` : `${API}/competitions/rating/athlete/${a.id}`
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        if (r.ok) results.push(await r.json())
      } catch {}
    }
    setData(results)
    setLoading(false)
  }

  const placeLabel = (p) => p === 1 ? '1 место' : p === 2 ? '2 место' : p === 3 ? '3 место' : null
  const placeColor = (p) => p === 1 ? '#c8962a' : p === 2 ? '#aaaaaa' : p === 3 ? '#c87833' : 'var(--gray)'

  if (loading) return <div className="cabinet-loading">Загрузка...</div>

  return (
    <div>
      <div style={{marginBottom:12}}>
        <select className="att-date-input" value={season} onChange={e => setSeason(e.target.value === '' ? '' : Number(e.target.value))} style={{width:'auto'}}>
          <option value="">Все сезоны</option>
          {seasons.map(y => <option key={y} value={y}>{seasonLabel(y)}</option>)}
        </select>
      </div>
      {data.length === 0 && <div className="cabinet-empty">Данных о соревнованиях за этот сезон нет.</div>}
      {data.map(a => (
        <div key={a.athlete_id} style={{ marginBottom: 24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div className="my-athlete-name">{a.full_name}</div>
            <div style={{ fontFamily:'Bebas Neue', fontSize:'1.2rem', color:'var(--red)' }}>
              {a.total_rating} pts
            </div>
          </div>

          {a.results.length === 0 && (
            <div style={{ color:'var(--gray)', fontSize:'0.85rem', padding:'12px 0' }}>
              Соревнований пока нет.
            </div>
          )}

          {a.results.map((r, i) => (
            <div key={i} style={{
              background:'var(--dark2)', border:'1px solid var(--gray-dim)',
              borderRadius:8, padding:'14px 16px', marginBottom:8
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, marginBottom:8 }}>
                <div>
                  <div style={{ fontWeight:600, color:'var(--white)', marginBottom:4 }}>{r.competition_name}</div>
                  <div style={{ fontSize:'0.8rem', color:'var(--gray)', display:'flex', gap:10, flexWrap:'wrap' }}>
                    <span>{new Date(r.competition_date).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' })}</span>
                    <span className={`comp-badge ${LEVEL_BADGE[r.level]||''}`}>{r.level}</span>
                    <span className="comp-badge">{r.comp_type}</span>
                  </div>
                </div>
                <div style={{ fontFamily:'Bebas Neue', fontSize:'1.4rem', color:'var(--red)', flexShrink:0 }}>{r.rating} pts</div>
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[
                  { label:'Спарринг', place: r.sparring_place, fights: r.sparring_fights, unit:'боёв' },
                  { label:'Стоп-балл', place: r.stopball_place, fights: r.stopball_fights, unit:'боёв' },
                  { label:'Тег-тим', place: r.tegtim_place, fights: r.tegtim_fights, unit:'боёв' },
                  { label:'Тули', place: r.tuli_place, fights: r.tuli_perfs, unit:'выст.' },
                ].filter(d => d.place || d.fights > 0).map((d, j) => (
                  <div key={j} style={{
                    background:'var(--dark)', border:`1px solid ${d.place ? placeColor(d.place) : 'var(--gray-dim)'}`,
                    borderRadius:6, padding:'6px 12px', minWidth:80, textAlign:'center'
                  }}>
                    <div style={{ fontSize:'0.72rem', color:'var(--gray)', marginBottom:3 }}>{d.label}</div>
                    {d.place && <div style={{ fontFamily:'Bebas Neue', fontSize:'1.1rem', color: placeColor(d.place) }}>{placeLabel(d.place)}</div>}
                    {d.fights > 0 && <div style={{ fontSize:'0.78rem', color:'var(--gray)' }}>{d.fights} {d.unit}</div>}
                  </div>
                ))}
              </div>
              <CompFilesBlock token={token} compId={r.competition_id} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
