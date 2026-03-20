import { useState } from 'react'
import * as XLSX from 'xlsx'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, VerticalAlign, BorderStyle, PageOrientation
} from 'docx'

const DISC = [
  { key: 'hyung',      label: 'Хъёнг',      resultKeys: ['tuli_place','tuli_perfs'],     type: 'plus'   },
  { key: 'sparring',   label: 'Спарринг',    resultKeys: ['sparring_place','sparring_fights'], type: 'weight' },
  { key: 'stopball',   label: 'Стоп-балл',   resultKeys: ['stopball_place','stopball_fights'], type: 'weight' },
  { key: 'tegtim',     label: 'Тег-тим',     resultKeys: ['tegtim_place','tegtim_fights'],     type: 'weight' },
  { key: 'powerbreak', label: 'Сил. разбив', resultKeys: [],                              type: 'plus'   },
  { key: 'spectech',   label: 'Спец. техн.', resultKeys: [],                              type: 'plus'   },
]

const PLACE_OPTS = [
  { label:'—',   value:'' },
  { label:'1',   value:'1' },
  { label:'2',   value:'2' },
  { label:'3',   value:'3' },
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

  const [hiddenCols,  setHiddenCols]  = useState({})
  const [disabledCells, setDisabledCells] = useState({})
  const [genMsg,  setGenMsg]  = useState('')
  const [genLoad, setGenLoad] = useState(false)

  const going = rows.filter(r => r.status === 'confirmed' || r.status === 'paid')

  // Строим участников с данными из athletes
  const participants = going.map(r => {
    const a = athletes.find(a => a.id === r.athlete_id) || {}
    return { ...r, weight: a.weight||null, birth_date: a.birth_date||'', dan: a.dan, auto_group: a.auto_group||'' }
  })

  const toggleCol  = (key) => setHiddenCols(h => ({ ...h, [key]: !h[key] }))
  const toggleCell = (aid, key) => {
    if (readOnly) return
    const k = `${aid}_${key}`
    setDisabledCells(d => ({ ...d, [k]: !d[k] }))
  }
  const isCellOff  = (aid, key) => !!disabledCells[`${aid}_${key}`]

  const cellExportVal = (p, disc) => {
    if (isCellOff(p.athlete_id, disc.key)) return '-'
    if (disc.type === 'plus') return '+'
    return p.weight ? String(p.weight) : '—'
  }

  // ── Excel ──────────────────────────────────────────────────────────────────
  const genExcel = (type) => {
    const wb = XLSX.utils.book_new()
    if (type === 'cfo') {
      const data = [
        ['Заявка от клуба «Тайпан»'],
        [`на участие в ${detail?.name || '______________________________'}`],
        [''],
        ['№','Ф.И.О.','Дата рожд.','Вес','Спорт. квал.','Тех. квал.',
         'Субъект РФ, Город','ФО','Д.С.О., Ведомство','СК, ДЮСШ','Ф.И.О. Тренера',
         'Хъёнг','Поединок','Стоп-Балл','Тег-тим','Сил. Разбив','Спец. Техн.','Виза Врача'],
        ...participants.map((p,i) => [
          i+1, p.full_name, fmtDate(p.birth_date), p.weight||'',
          sportQual(p.gup,p.dan), gupLabel(p.gup,p.dan),
          'Московская область, Павловский Посад','ЦФО','','Клуб «ТАЙПАН»','Ротарь Екатерина Валерьевна',
          cellExportVal(p,DISC[0]), cellExportVal(p,DISC[1]), cellExportVal(p,DISC[2]),
          cellExportVal(p,DISC[3]), cellExportVal(p,DISC[4]), cellExportVal(p,DISC[5]), '',
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
          cellExportVal(p,DISC[0]), cellExportVal(p,DISC[1]),
          cellExportVal(p,DISC[2]), cellExportVal(p,DISC[3]),
          cellExportVal(p,DISC[4]),
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

  // ── Word ───────────────────────────────────────────────────────────────────
  const genWord = async (type) => {
    try {
      
      const borders = {
        top:             {style:BorderStyle.SINGLE,size:6},
        bottom:          {style:BorderStyle.SINGLE,size:6},
        left:            {style:BorderStyle.SINGLE,size:6},
        right:           {style:BorderStyle.SINGLE,size:6},
        insideHorizontal:{style:BorderStyle.SINGLE,size:4},
        insideVertical:  {style:BorderStyle.SINGLE,size:4},
      }

      const cell = (text, bold=false) => new TableCell({
        children:[new Paragraph({children:[new TextRun({text:String(text||''),bold,size:18})],alignment:AlignmentType.CENTER})],
        verticalAlign:VerticalAlign.CENTER,
      })

      const hrow = (cols) => new TableRow({ children: cols.map(c => cell(c, true)) })
      const drow = (cols) => new TableRow({ children: cols.map(c => cell(c)) })

      const right = (text, bold=false, size=22) => new Paragraph({
        children:[new TextRun({text,bold,size})], alignment:AlignmentType.RIGHT, spacing:{after:80}
      })
      const center = (text, bold=false, size=24) => new Paragraph({
        children:[new TextRun({text,bold,size})], alignment:AlignmentType.CENTER, spacing:{after:80}
      })
      const sp = () => new Paragraph({text:' ',spacing:{after:200}})

      let tableRows, extraChildren=[]

      if (type === 'cfo') {
        tableRows = [
          hrow(['№','Ф.И.О.','Дата рожд.','Вес','Спорт. квал.','Тех. квал.',
            'Субъект РФ, Город','ФО','Д.С.О.','СК, ДЮСШ','Тренер',
            'Хъёнг','Поединок','Стоп-балл','Тег-тим','Сил. разбив','Спец. техн.','Виза врача']),
          ...participants.map((p,i) => drow([
            i+1, p.full_name, fmtDate(p.birth_date), p.weight||'',
            sportQual(p.gup,p.dan), gupLabel(p.gup,p.dan),
            'Московская обл., Павловский Посад','ЦФО','','Клуб «ТАЙПАН»','Ротарь Е.В.',
            cellExportVal(p,DISC[0]),cellExportVal(p,DISC[1]),cellExportVal(p,DISC[2]),
            cellExportVal(p,DISC[3]),cellExportVal(p,DISC[4]),cellExportVal(p,DISC[5]),'',
          ])),
        ]
        extraChildren = [
          sp(),
          new Paragraph({children:[new TextRun({text:`К соревнованиям допущено (${participants.length}) человек`,size:22})]}),
          new Paragraph({children:[new TextRun({text:'Врач (ФИО) ______________________________',size:22})]}),
          new Paragraph({children:[new TextRun({text:'Представитель команды ______________________________',size:22})]}),
        ]
      } else {
        tableRows = [
          hrow(['№','ФИО','Пол','Дата рожд','Лет','Спорт квал.','Техн квал.',
            'Формы','Массог/Лайт','Стоп-балл (реал. вес)','Тег-тим (реал. вес)',
            'Сила удара','Клуб','Тренер','Врач']),
          ...participants.map((p,i) => drow([
            i+1, p.full_name,
            p.gender==='male'?'м':p.gender==='female'?'ж':'',
            fmtDate(p.birth_date), calcAge(p.birth_date)||'',
            sportQual(p.gup,p.dan), gupLabel(p.gup,p.dan),
            cellExportVal(p,DISC[0]),cellExportVal(p,DISC[1]),
            cellExportVal(p,DISC[2]),cellExportVal(p,DISC[3]),
            cellExportVal(p,DISC[4]),
            'Клуб «ТАЙПАН»','Ротарь Е.В.','',
          ])),
        ]
      }

      const compName = detail?.name || '______________________________'
      const doc = new Document({
        creator:'Клуб ТАЙПАН',
        sections:[{
          properties:{
            page:{
              size:{width:16838,height:11906},
              orientation:PageOrientation.LANDSCAPE,
              margin:{top:800,bottom:800,left:800,right:800}
            }
          },
          children:[
            right('«Утверждаю»', true, 26),
            right('Руководитель АНО «Спортивный клуб тхэквондо «Тайпан» г. Павловский Посад»', false, 20),
            right('Е.В. Ротарь', false, 20),
            right('_________________20___ г.', false, 20),
            right('М.П.', false, 20),
            sp(),
            center('ЗАЯВКА', true, 36),
            center(`от клуба «Тайпан» на участие в ${compName}`, true, 28),
            sp(),
            new Table({width:{size:100,type:WidthType.PERCENTAGE}, rows:tableRows, borders}),
            ...extraChildren,
          ]
        }]
      })

      const blob = await Packer.toBlob(doc)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `Заявка_ТАЙПАН_${type}_${detail?.name||''}_${new Date().toISOString().slice(0,10)}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch(e) {
      throw e
    }
  }

  const generate = async (type) => {
    if (participants.length === 0) { setGenMsg('Нет участников со статусом «Участвует»'); return }
    setGenLoad(true)
    setGenMsg('Генерация...')
    try {
      genExcel(type)
      await genWord(type)
      setGenMsg('Готово — Word + Excel скачаны')
    } catch(e) {
      setGenMsg('Ошибка: ' + e.message)
    }
    setGenLoad(false)
    setTimeout(() => setGenMsg(''), 5000)
  }

  if (going.length === 0) return null

  // Видимые дисциплины
  const visDisc = DISC.filter(d => !hiddenCols[d.key])

  return (
    <div style={{ marginTop:24 }}>

      {/* Шапка с кнопками */}
      {!readOnly && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, marginBottom:12 }}>
          <span style={{ fontFamily:'Barlow Condensed', fontSize:'12px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)' }}>
            Матрица участия · {going.length} чел.
          </span>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button className="att-all-btn" onClick={() => generate('cfo')} disabled={genLoad}>
              Заявка ЦФО/Россия
            </button>
            <button className="att-all-btn" onClick={() => generate('ivanteevo')} disabled={genLoad}>
              Заявка Ивантеевка
            </button>
          </div>
        </div>
      )}

      {genMsg && (
        <div style={{ marginBottom:10, padding:'8px 14px', background:'rgba(76,175,80,0.1)', border:'1px solid #4caf50', color:'#4caf50', fontSize:'13px' }}>
          {genMsg}
        </div>
      )}

      {/* Таблица */}
      <div className="athletes-table-wrap">
        <table className="athletes-table comp-results-table">
          <thead>
            <tr>
              <th rowSpan="2" style={{textAlign:'left'}}>Спортсмен</th>
              {visDisc.map(d => (
                <th
                  key={d.key}
                  colSpan={d.resultKeys.length > 0 ? 2 : 1}
                  onClick={() => toggleCol(d.key)}
                  title="Клик — скрыть дисциплину"
                  style={{
                    cursor:'pointer', userSelect:'none',
                    background: 'var(--dark2)',
                    color: 'var(--red)',
                    fontFamily:'Barlow Condensed', fontSize:'12px', letterSpacing:'1px',
                    borderBottom:'1px solid var(--gray-dim)',
                    transition:'all 0.2s',
                  }}
                >
                  {d.label} ▾
                </th>
              ))}
              {/* Скрытые дисциплины — показать кнопку */}
              {DISC.filter(d => hiddenCols[d.key]).map(d => (
                <th key={d.key} onClick={() => toggleCol(d.key)}
                  title="Показать дисциплину"
                  style={{ cursor:'pointer', color:'var(--gray-dim)', fontSize:'11px', fontFamily:'Barlow Condensed', letterSpacing:'1px', background:'rgba(0,0,0,0.3)', padding:'4px 8px', userSelect:'none' }}>
                  {d.label} ▸
                </th>
              ))}
              <th rowSpan="2">Рейтинг</th>
              <th rowSpan="2">Взнос</th>
              {!readOnly && <th rowSpan="2">Статус</th>}
              {!readOnly && <th rowSpan="2"></th>}
            </tr>
            <tr>
              {visDisc.map(d =>
                d.resultKeys.length > 0
                  ? [<th key={d.key+'_p'} style={{fontSize:'11px',color:'var(--gray)'}}>Место</th>,
                     <th key={d.key+'_f'} style={{fontSize:'11px',color:'var(--gray)'}}>{d.key==='hyung'?'Выст.':'Бои'}</th>]
                  : [<th key={d.key+'_s'} style={{fontSize:'11px',color:'var(--gray)'}}>+/−</th>]
              )}
              {DISC.filter(d => hiddenCols[d.key]).map(d => <th key={d.key+'_h'}></th>)}
            </tr>
          </thead>
          <tbody>
            {going.map(r => {
              const p = participants.find(p => p.athlete_id === r.athlete_id) || r
              return (
                <tr key={r.athlete_id}>
                  <td className="td-name">{r.full_name}</td>

                  {visDisc.map(d => {
                    const off = isCellOff(r.athlete_id, d.key)
                    const cellStyle = {
                      background: off ? 'rgba(0,0,0,0.5)' : undefined,
                      opacity: off ? 0.4 : 1,
                      transition: 'all 0.2s',
                      cursor: readOnly ? 'default' : 'pointer',
                      userSelect: 'none',
                    }

                    if (d.resultKeys.length === 0) {
                      // Дисциплины без результата (сил. разбив, спец. техн.)
                      return (
                        <td key={d.key} style={{...cellStyle, textAlign:'center'}}
                          onClick={() => toggleCell(r.athlete_id, d.key)}>
                          {off ? <span style={{color:'var(--gray-dim)'}}>✕</span> : <span style={{color:'#4caf50', fontWeight:700}}>+</span>}
                        </td>
                      )
                    }

                    // Дисциплины с результатом — 2 ячейки
                    const [placeKey, fightsKey] = d.resultKeys
                    return [
                      <td key={d.key+'_p'} style={cellStyle} onClick={() => toggleCell(r.athlete_id, d.key)}>
                        {off
                          ? <span style={{color:'var(--gray-dim)',fontSize:'11px'}}>✕</span>
                          : readOnly
                            ? (r[placeKey] || '—')
                            : <select className="td-input td-input-sm" value={r[placeKey]||''}
                                onClick={e => e.stopPropagation()}
                                onChange={e => updateRow(r.athlete_id, placeKey, e.target.value)}>
                                {PLACE_OPTS.map(o=><option key={o.label} value={o.value}>{o.label}</option>)}
                              </select>
                        }
                      </td>,
                      <td key={d.key+'_f'} style={cellStyle} onClick={() => toggleCell(r.athlete_id, d.key)}>
                        {off
                          ? ''
                          : readOnly
                            ? (r[fightsKey] || 0)
                            : <input type="number" min="0" max="99" className="td-input td-input-sm"
                                value={r[fightsKey]||0}
                                onClick={e => e.stopPropagation()}
                                onChange={e => updateRow(r.athlete_id, fightsKey, e.target.value)}/>
                        }
                      </td>
                    ]
                  })}

                  {/* Скрытые дисциплины */}
                  {DISC.filter(d => hiddenCols[d.key]).map(d => <td key={d.key+'_h'} style={{background:'rgba(0,0,0,0.3)'}}></td>)}

                  <td className="comp-rating-val">{calcRatingPreview(r, detail?.significance||1)}</td>
                  <td style={{textAlign:'center'}}>
                    {!readOnly && <input type="checkbox" checked={r.paid||false}
                      onChange={async e => {
                        const paid = e.target.checked
                        updateRow(r.athlete_id,'paid',paid)
                        await fetch(`/api/competitions/${detail.id}/results/${r.athlete_id}/paid?paid=${paid}`, {method:'PATCH',headers:{Authorization:`Bearer ${token}`}})
                      }}/>}
                    {readOnly && <span style={{color:r.paid?'#6cba6c':'var(--gray)',fontSize:'0.8rem'}}>{r.paid?'✓':'—'}</span>}
                  </td>
                  {!readOnly && (
                    <td>
                      <select className="td-input td-input-sm" value={r.status||'confirmed'}
                        onChange={e => updateRowStatus(r.athlete_id, e.target.value)}
                        style={{color:'#6cba6c'}}>
                        <option value="pending">Ожидает</option>
                        <option value="confirmed">Участвует</option>
                        <option value="declined">Не участвует</option>
                      </select>
                    </td>
                  )}
                  {!readOnly && <td><button className="td-btn td-btn-del" onClick={() => removeRow(r.athlete_id)}>✕</button></td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <p style={{ marginTop:8, color:'var(--gray)', fontSize:'12px', fontStyle:'italic' }}>
          Клик по ячейке — отметить «не участвует». Клик по заголовку дисциплины — скрыть столбец.
        </p>
      )}
    </div>
  )
}
