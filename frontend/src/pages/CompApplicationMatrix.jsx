import { useState } from 'react'
import * as XLSX from 'xlsx'

const DISC = [
  { key: 'hyung',      label: 'Хъёнг',      resultKeys: ['tuli_place','tuli_perfs'],          type: 'plus'   },
  { key: 'sparring',   label: 'Спарринг',    resultKeys: ['sparring_place','sparring_fights'],  type: 'weight' },
  { key: 'stopball',   label: 'Стоп-балл',   resultKeys: ['stopball_place','stopball_fights'],  type: 'weight' },
  { key: 'tegtim',     label: 'Тег-тим',     resultKeys: ['tegtim_place','tegtim_fights'],      type: 'weight' },
  { key: 'powerbreak', label: 'Сил. разбив', resultKeys: [],                                    type: 'plus'   },
  { key: 'spectech',   label: 'Спец. техн.', resultKeys: [],                                    type: 'plus'   },
]

const PLACE_OPTS = [
  { label:'—', value:'' },
  { label:'1', value:'1' },
  { label:'2', value:'2' },
  { label:'3', value:'3' },
]

function calcAge(bd) {
  if (!bd) return null
  const t = new Date(), b = new Date(bd)
  let a = t.getFullYear() - b.getFullYear()
  if (t.getMonth() < b.getMonth() || (t.getMonth()===b.getMonth() && t.getDate()<b.getDate())) a--
  return a
}

function fmtDate(s) {
  if (!s) return ''
  const d = new Date(s)
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`
}

function gupLabel(gup, dan) {
  if (dan) return `${dan} дан`
  if (gup === 0) return 'б/п'
  if (gup) return `${gup} гып`
  return ''
}

function sportQual(gup, dan) {
  if (dan >= 1) return 'КМС'
  return 'б/р'
}

export default function CompApplicationMatrix({ rows, athletes, detail, token, readOnly,
  updateRow, updateRowStatus, removeRow, calcRatingPreview }) {

  const [hiddenCols,    setHiddenCols]    = useState({})
  const [disabledCells, setDisabledCells] = useState({})
  const [genMsg,        setGenMsg]        = useState('')
  const [genLoad,       setGenLoad]       = useState(false)

  const going = rows.filter(r => r.status === 'confirmed' || r.status === 'paid')

  const participants = going.map(r => {
    const a = athletes.find(a => a.id === r.athlete_id) || {}
    return {
      ...r,
      weight:     a.weight||null,
      birth_date: a.birth_date||'',
      dan:        a.dan,
      gender:     a.gender,
      gup:        a.gup,
      auto_group: a.auto_group||'',
    }
  })

  const toggleCol  = (key) => setHiddenCols(h => ({ ...h, [key]: !h[key] }))
  const toggleCell = (aid, key) => {
    if (readOnly) return
    const k = `${aid}_${key}`
    setDisabledCells(d => ({ ...d, [k]: !d[k] }))
  }
  const isCellOff = (aid, key) => !!disabledCells[`${aid}_${key}`]

  const cellVal = (p, disc) => {
    if (isCellOff(p.athlete_id, disc.key)) return '-'
    if (disc.type === 'plus') return '+'
    return p.weight ? String(p.weight) : '—'
  }

  // ── Excel ──────────────────────────────────────────────────────────────────
  const genExcel = (type) => {
    const wb = XLSX.utils.book_new()
    const name = detail?.name || '______________________________'

    if (type === 'cfo') {
      const data = [
        ['Заявка от клуба «Тайпан»'],
        [`на участие в ${name}`],
        [''],
        ['№','Ф.И.О.','Дата рожд.','Вес','Спорт. квал.','Тех. квал.',
         'Субъект РФ, Город','ФО','Д.С.О., Ведомство','СК, ДЮСШ','Ф.И.О. Тренера',
         'Хъёнг','Поединок','Стоп-Балл','Тег-тим','Сил. Разбив','Спец. Техн.','Виза Врача'],
        ...participants.map((p,i) => [
          i+1, p.full_name, fmtDate(p.birth_date), p.weight||'',
          sportQual(p.gup,p.dan), gupLabel(p.gup,p.dan),
          'Московская область, Павловский Посад','ЦФО','','Клуб «ТАЙПАН»','Ротарь Екатерина Валерьевна',
          cellVal(p,DISC[0]),cellVal(p,DISC[1]),cellVal(p,DISC[2]),
          cellVal(p,DISC[3]),cellVal(p,DISC[4]),cellVal(p,DISC[5]),'',
        ]),
        [],
        [`К соревнованиям допущено (${participants.length}) человек`],
        ['Врач (ФИО) ______________________________'],
        ['Представитель команды ______________________________'],
      ]
      const ws = XLSX.utils.aoa_to_sheet(data)
      if (!ws['!merges']) ws['!merges'] = []
      ws['!merges'].push({s:{r:0,c:0},e:{r:0,c:17}},{s:{r:1,c:0},e:{r:1,c:17}})
      ws['!cols'] = [{wch:5},{wch:30},{wch:15},{wch:10},{wch:12},{wch:12},{wch:30},{wch:8},{wch:20},{wch:20},{wch:30},{wch:10},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12}]
      XLSX.utils.book_append_sheet(wb, ws, 'Заявка ЦФО')
    } else {
      const data = [
        ['Заявка от клуба "Тайпан"'],
        ['на участие в Фестивале боевых искусств по тхэквондо и кикбоксингу'],
        ['«____ Кубок "СПЕКТРА" ___.___.20___г.»'],
        [''],
        ['№','ФИО','Пол','Дата рожд','Лет','Спорт квал.','Техн квал.',
         'Формы','Массог/Лайт','Стоп-балл (реал. вес)','Тег-тим (реал. вес)','Сила удара','Клуб','Тренер','Врач'],
        ...participants.map((p,i) => [
          i+1, p.full_name,
          p.gender==='male'?'м':p.gender==='female'?'ж':'',
          fmtDate(p.birth_date), calcAge(p.birth_date)||'',
          sportQual(p.gup,p.dan), gupLabel(p.gup,p.dan),
          cellVal(p,DISC[0]),cellVal(p,DISC[1]),
          cellVal(p,DISC[2]),cellVal(p,DISC[3]),
          cellVal(p,DISC[4]),
          'Клуб «ТАЙПАН»','Ротарь Екатерина Валерьевна','',
        ]),
      ]
      const ws = XLSX.utils.aoa_to_sheet(data)
      if (!ws['!merges']) ws['!merges'] = []
      ws['!merges'].push({s:{r:0,c:0},e:{r:0,c:14}},{s:{r:1,c:0},e:{r:1,c:14}},{s:{r:2,c:0},e:{r:2,c:14}})
      ws['!cols'] = [{wch:5},{wch:30},{wch:6},{wch:12},{wch:8},{wch:12},{wch:12},{wch:10},{wch:14},{wch:22},{wch:22},{wch:12},{wch:20},{wch:30},{wch:10}]
      XLSX.utils.book_append_sheet(wb, ws, 'Заявка Ивантеевка')
    }
    XLSX.writeFile(wb, `Заявка_ТАЙПАН_${type}_${detail?.name||''}_${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  const generate = (type) => {
    if (participants.length === 0) { setGenMsg('Нет участников со статусом «Участвует»'); return }
    setGenLoad(true)
    setGenMsg('Генерация Excel...')
    try {
      genExcel(type)
      setGenMsg('Excel скачан. Word — в разработке.')
    } catch(e) {
      setGenMsg('Ошибка: ' + e.message)
    }
    setGenLoad(false)
    setTimeout(() => setGenMsg(''), 5000)
  }

  if (going.length === 0) return null

  return (
    <div style={{ marginTop:24 }}>

      {!readOnly && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:12 }}>
          <span style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)' }}>
            Матрица участия · {going.length} чел.
          </span>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button className="att-all-btn" onClick={() => generate('cfo')} disabled={genLoad}>
              Заявка ЦФО/Россия (xlsx)
            </button>
            <button className="att-all-btn" onClick={() => generate('ivanteevo')} disabled={genLoad}>
              Заявка Ивантеевка (xlsx)
            </button>
          </div>
        </div>
      )}

      {genMsg && (
        <div style={{ marginBottom:10, padding:'8px 14px', background:'rgba(76,175,80,0.1)', border:'1px solid #4caf50', color:'#4caf50', fontSize:'13px' }}>
          {genMsg}
        </div>
      )}

      <div className="athletes-table-wrap">
        <table className="athletes-table comp-results-table">
          <thead>
            <tr>
              <th rowSpan="2" style={{textAlign:'left'}}>Спортсмен</th>
              {DISC.map(d => {
                const isHidden = hiddenCols[d.key]
                if (isHidden) return (
                  <th key={d.key} onClick={() => toggleCol(d.key)}
                    title="Показать дисциплину"
                    style={{ cursor:'pointer', color:'var(--gray-dim)', fontSize:'10px',
                      fontFamily:'Barlow Condensed', letterSpacing:'1px',
                      background:'rgba(0,0,0,0.4)', padding:'4px 6px', userSelect:'none',
                      writingMode:'vertical-rl', minWidth:20 }}>
                    {d.label}
                  </th>
                )
                return (
                  <th key={d.key}
                    colSpan={d.resultKeys.length > 0 ? 2 : 1}
                    onClick={() => toggleCol(d.key)}
                    title="Клик — скрыть дисциплину"
                    style={{ cursor:'pointer', userSelect:'none', background:'var(--dark2)',
                      color:'var(--red)', fontFamily:'Barlow Condensed', fontSize:'11px',
                      letterSpacing:'1px', transition:'all 0.2s', whiteSpace:'nowrap' }}>
                    {d.label} ▾
                  </th>
                )
              })}
              <th rowSpan="2">Рейтинг</th>
              <th rowSpan="2">Взнос</th>
              {!readOnly && <th rowSpan="2">Статус</th>}
              {!readOnly && <th rowSpan="2"></th>}
            </tr>
            <tr>
              {DISC.map(d => {
                if (hiddenCols[d.key]) return <th key={d.key+'_s'}></th>
                if (d.resultKeys.length === 0) return <th key={d.key+'_s'} style={{fontSize:'10px',color:'var(--gray)'}}>+/−</th>
                return [
                  <th key={d.key+'_p'} style={{fontSize:'10px',color:'var(--gray)'}}>Место</th>,
                  <th key={d.key+'_f'} style={{fontSize:'10px',color:'var(--gray)'}}>{d.key==='hyung'?'Выст.':'Бои'}</th>
                ]
              })}
            </tr>
          </thead>
          <tbody>
            {going.map(r => {
              const p = participants.find(p => p.athlete_id === r.athlete_id) || r
              return (
                <tr key={r.athlete_id}>
                  <td className="td-name">{r.full_name}</td>
                  {DISC.map(d => {
                    const isHidden = hiddenCols[d.key]
                    const off = isCellOff(r.athlete_id, d.key)
                    const cellSt = {
                      background: isHidden ? 'rgba(0,0,0,0.4)' : off ? 'rgba(0,0,0,0.55)' : undefined,
                      opacity: off ? 0.45 : 1,
                      transition:'all 0.2s',
                      cursor: (readOnly || isHidden) ? 'default' : 'pointer',
                      userSelect:'none',
                    }

                    if (isHidden) return <td key={d.key} style={cellSt}></td>

                    if (d.resultKeys.length === 0) {
                      return (
                        <td key={d.key} style={{...cellSt, textAlign:'center'}}
                          onClick={() => toggleCell(r.athlete_id, d.key)}>
                          {off
                            ? <span style={{color:'var(--gray-dim)'}}>✕</span>
                            : <span style={{color:'#4caf50',fontWeight:700}}>+</span>}
                        </td>
                      )
                    }

                    const [placeKey, fightsKey] = d.resultKeys
                    return [
                      <td key={d.key+'_p'} style={cellSt} onClick={() => toggleCell(r.athlete_id, d.key)}>
                        {off
                          ? <span style={{color:'var(--gray-dim)',fontSize:'11px'}}>✕</span>
                          : readOnly
                            ? (r[placeKey]||'—')
                            : <select className="td-input td-input-sm" value={r[placeKey]||''}
                                onClick={e=>e.stopPropagation()}
                                onChange={e=>updateRow(r.athlete_id,placeKey,e.target.value)}>
                                {PLACE_OPTS.map(o=><option key={o.label} value={o.value}>{o.label}</option>)}
                              </select>
                        }
                      </td>,
                      <td key={d.key+'_f'} style={cellSt} onClick={() => toggleCell(r.athlete_id, d.key)}>
                        {off ? '' : readOnly
                          ? (r[fightsKey]||0)
                          : <input type="number" min="0" max="99" className="td-input td-input-sm"
                              value={r[fightsKey]||0}
                              onClick={e=>e.stopPropagation()}
                              onChange={e=>updateRow(r.athlete_id,fightsKey,e.target.value)}/>
                        }
                      </td>
                    ]
                  })}
                  <td className="comp-rating-val">{calcRatingPreview(r, detail?.significance||1)}</td>
                  <td style={{textAlign:'center'}}>
                    {!readOnly && <input type="checkbox" checked={r.paid||false}
                      onChange={async e => {
                        const paid = e.target.checked
                        updateRow(r.athlete_id,'paid',paid)
                        await fetch(`/api/competitions/${detail.id}/results/${r.athlete_id}/paid?paid=${paid}`,
                          {method:'PATCH',headers:{Authorization:`Bearer ${token}`}})
                      }}/>}
                    {readOnly && <span style={{color:r.paid?'#6cba6c':'var(--gray)',fontSize:'0.8rem'}}>{r.paid?'✓':'—'}</span>}
                  </td>
                  {!readOnly && (
                    <td>
                      <select className="td-input td-input-sm" value={r.status||'confirmed'}
                        onChange={e=>updateRowStatus(r.athlete_id,e.target.value)}
                        style={{color:'#6cba6c'}}>
                        <option value="pending">Ожидает</option>
                        <option value="confirmed">Участвует</option>
                        <option value="declined">Не участвует</option>
                      </select>
                    </td>
                  )}
                  {!readOnly && <td><button className="td-btn td-btn-del" onClick={()=>removeRow(r.athlete_id)}>✕</button></td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <p style={{ marginTop:8, color:'var(--gray)', fontSize:'12px', fontStyle:'italic' }}>
          Клик по ячейке — не участвует. Клик по заголовку столбца — скрыть дисциплину.
        </p>
      )}
    </div>
  )
}
