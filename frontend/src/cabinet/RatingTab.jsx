import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { API, currentSeason, seasonLabel } from './constants'

export default function RatingTab({ token, myAthleteIds = [] }) {
  const [rating,       setRating]       = useState([])
  const [seasons,      setSeasons]      = useState([])
  const [season,       setSeason]       = useState('')  // текущий спортивный сезон
  const [ratingFilter, setRatingFilter] = useState('all')
  const [loading,      setLoading]      = useState(false)

  const h = { Authorization: `Bearer ${token}` }

  useEffect(() => { loadSeasons(); }, [])
  useEffect(() => { loadRating() }, [season])

  const loadSeasons = async () => {
    try {
      const r = await fetch(`${API}/competitions/seasons`, { headers: h })
      if (r.ok) {
        const years = await r.json()
        setSeasons(years)
        // Устанавливаем текущий сезон если он есть в списке, иначе первый доступный
        if (years.includes(currentSeason)) setSeason(currentSeason)
        else if (years.length > 0) setSeason(years[0])
      }
    } catch {}
  }

  const loadRating = async () => {
    setLoading(true)
    try {
      const url = season !== '' ? `${API}/competitions/rating/overall?season=${season}` : `${API}/competitions/rating/overall`
      const r = await fetch(url, { headers: h }); if (r.ok) setRating(await r.json())
    } catch {}
    setLoading(false)
  }

  const exportXlsx = () => {
    const wb = XLSX.utils.book_new()
    const header = ['Место','ФИО','Возраст','Возр. кат.','Группа','Гып','Пол','Вес','Турниров','Рейтинг']
    const toRows = (data) => data.map((r,i) => [i+1, r.full_name, r.age||'', r.age_category||'', r.group||'', r.gup||'', r.gender||'', r.weight||'', r.tournaments_count, r.total_rating])
    // Общий лист
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...toRows(rating)]), 'Общий рейтинг')
    // Все категории отдельными листами
    const filters = [
      { key:'age_category', label:'Возраст' },
      { key:'group',        label:'Группа' },
      { key:'gender',       label:'Пол' },
      { key:'gup',          label:'Гып' },
    ]
    filters.forEach(f => {
      const groups = {}
      rating.forEach(r => { const k = String(r[f.key]||'Не указано'); if (!groups[k]) groups[k]=[]; groups[k].push(r) })
      Object.entries(groups).forEach(([key, rows_g]) => {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...toRows(rows_g)]), `${f.label} ${key}`.substring(0,31))
      })
    })
    XLSX.writeFile(wb, `Рейтинг_Тайпан_${season||'все'}.xlsx`)
  }

  const getRatingGroups = () => {
    const groups = {}
    rating.forEach(r => { const k = String(r[ratingFilter]||'Не указано'); if (!groups[k]) groups[k]=[]; groups[k].push(r) })
    return groups
  }

  const renderTable = (data) => (
    <div className="athletes-table-wrap">
      <table className="athletes-table">
        <thead><tr>
          <th style={{width:50}}>Место</th>
          <th style={{textAlign:'left'}}>Спортсмен</th>
          <th>Возраст</th><th>Группа</th><th>Гып</th><th>Вес</th><th>Пол</th><th>Турниров</th><th>Рейтинг</th>
        </tr></thead>
        <tbody>
          {data.map((r,i) => {
            const isMyChild = myAthleteIds.includes(r.athlete_id)
            return (
            <tr key={r.athlete_id} style={isMyChild ? { background:'#1a1500', outline:'1px solid #c8962a' } : {}}>
              <td style={{textAlign:'center',fontWeight:700,fontFamily:'Bebas Neue'}}>{i+1}</td>
              <td className="td-name">
                {isMyChild && <span style={{color:'#c8962a',fontWeight:700,marginRight:6}}>▶</span>}
                {r.full_name}
              </td>
              <td style={{textAlign:'center'}}>{r.age||'—'}<br/><span style={{fontSize:'0.72rem',color:'var(--gray)'}}>{r.age_category}</span></td>
              <td>{r.group||'—'}</td>
              <td style={{textAlign:'center'}}>{r.gup||'—'}</td>
              <td style={{textAlign:'center'}}>{r.weight?`${r.weight} кг`:'—'}</td>
              <td style={{textAlign:'center'}}>{r.gender==='male'?'М':r.gender==='female'?'Ж':'—'}</td>
              <td style={{textAlign:'center'}}>{r.tournaments_count}</td>
              <td className="comp-rating-val">{r.total_rating}</td>
            </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="comp-wrap">
      <div className="comp-top">
        <div className="comp-top-left">
          <select className="att-date-input" value={season} onChange={e => setSeason(e.target.value === '' ? '' : Number(e.target.value))} style={{width:'auto'}}>
            <option value="">Все сезоны</option>
            {seasons.map(s => <option key={s} value={s}>{seasonLabel(s)}</option>)}
          </select>
        </div>
        <div className="comp-top-right">
          <button className="att-all-btn" onClick={exportXlsx}>Экспорт xlsx</button>
        </div>
      </div>

      <div className="comp-rating-filters">
        {[
          {key:'all',          label:'Общий'},
          {key:'age_category', label:'По возрасту'},
          {key:'group',        label:'По группе'},
          {key:'gender',       label:'По полу'},
          {key:'gup',          label:'По гыпу'},
        ].map(f => (
          <button key={f.key} className={`att-group-btn ${ratingFilter===f.key?'active':''}`} onClick={() => setRatingFilter(f.key)}>{f.label}</button>
        ))}
      </div>

      {loading && <div className="cabinet-loading">Загрузка...</div>}
      {!loading && rating.length === 0 && <div className="cabinet-empty">Результатов пока нет{season?` за ${season} год`:''}.</div>}
      {!loading && rating.length > 0 && (
        ratingFilter === 'all'
          ? renderTable(rating)
          : Object.entries(getRatingGroups()).map(([grp, rows_g]) => (
              <div key={grp} style={{marginBottom:28}}>
                <div className="comp-group-label">{grp}</div>
                {renderTable(rows_g)}
              </div>
            ))
      )}
    </div>
  )
}
