import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'

// ── Колонки дисциплин ─────────────────────────────────────────────────────────
const DISCIPLINES = [
  { key: 'hyung',       label: 'Хъёнг (туль)',         type: 'plus' },
  { key: 'sparring',    label: 'Спарринг (массоги)',    type: 'weight' },
  { key: 'stopball',    label: 'Стоп-балл',             type: 'weight' },
  { key: 'tegtim',      label: 'Тег-тим',               type: 'weight' },
  { key: 'powerbreak',  label: 'Сил. разбивание',       type: 'plus' },
  { key: 'spectech',    label: 'Спец. техника',         type: 'plus' },
]

function calcAge(birthDate) {
  if (!birthDate) return null
  const today = new Date()
  const bd = new Date(birthDate)
  let age = today.getFullYear() - bd.getFullYear()
  if (today.getMonth() < bd.getMonth() || (today.getMonth() === bd.getMonth() && today.getDate() < bd.getDate())) age--
  return age
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`
}

function gupLabel(gup, dan) {
  if (dan) return `${dan} дан`
  if (gup === 0) return 'Б/п'
  if (gup) return `${gup} гып`
  return ''
}

function sportQualLabel(gup, dan) {
  if (!gup && !dan) return ''
  if (dan >= 1) return 'КМС'
  return 'б/р'
}

export default function CompApplicationMatrix({ rows, athletes, detail, token }) {
  // rows — участники соревнования (confirmed/paid)
  // athletes — полный список спортсменов с весом и доп данными

  const [hidden,   setHidden]   = useState({})      // { disciplineKey: true } — скрытые столбцы
  const [disabled, setDisabled] = useState({})      // { athleteId_disciplineKey: true } — затемнённые ячейки
  const [genMsg,   setGenMsg]   = useState('')
  const [genLoading, setGenLoading] = useState(false)

  // Строим список участников — только confirmed/paid
  const participants = rows
    .filter(r => r.status === 'confirmed' || r.status === 'paid')
    .map(r => {
      const a = athletes.find(a => a.id === r.athlete_id) || {}
      return {
        athlete_id:  r.athlete_id,
        full_name:   r.full_name,
        birth_date:  a.birth_date || '',
        gender:      a.gender || '',
        weight:      a.weight || null,
        gup:         a.gup,
        dan:         a.dan,
        group:       a.group || a.auto_group || '',
        sport_qual:  a.sport_qual || '',
      }
    })

  const toggleCol   = (key) => setHidden(h => ({ ...h, [key]: !h[key] }))
  const toggleCell  = (athleteId, key) => {
    const cellKey = `${athleteId}_${key}`
    setDisabled(d => ({ ...d, [cellKey]: !d[cellKey] }))
  }
  const isDisabled  = (athleteId, key) => !!disabled[`${athleteId}_${key}`]
  const visibleDisc = DISCIPLINES.filter(d => !hidden[d.key])

  // Значение ячейки для заявки
  const cellValue = (p, disc) => {
    if (isDisabled(p.athlete_id, disc.key)) return '-'
    if (disc.type === 'plus') return '+'
    // weight
    return p.weight ? String(p.weight) : '—'
  }

  // ── Генерация Excel ──────────────────────────────────────────────────────────
  const generateExcel = (type) => {
    const wb = XLSX.utils.book_new()

    if (type === 'cfo') {
      const wsData = [
        ['Заявка от клуба «Тайпан»'],
        ['на участие в ______________________________'],
        [''],
        ['№','Ф.И.О.','Дата Рождения','Вес','Спорт. Квал.','Тех. Квал.',
         'Субъект РФ, Город','ФО','Д.С.О., Ведомство','СК, ДЮСШ','Ф.И.О. Тренера',
         'Хъенг','Поединок','Стоп-Балл','Тег-тим','Сил. Разбив','Спец. Техн.','Виза Врача'],
      ]
      participants.forEach((p, i) => {
        wsData.push([
          i + 1,
          p.full_name,
          formatDate(p.birth_date),
          p.weight || '',
          sportQualLabel(p.gup, p.dan),
          gupLabel(p.gup, p.dan),
          'Московская область, Павловский Посад',
          'ЦФО',
          '',
          'Клуб «ТАЙПАН»',
          'Ротарь Екатерина Валерьевна',
          cellValue(p, DISCIPLINES[0]),  // хъёнг
          cellValue(p, DISCIPLINES[1]),  // спарринг
          cellValue(p, DISCIPLINES[2]),  // стоп-балл
          cellValue(p, DISCIPLINES[3]),  // тег-тим
          cellValue(p, DISCIPLINES[4]),  // сил. разбив
          cellValue(p, DISCIPLINES[5]),  // спец. техн
          '',
        ])
      })
      wsData.push([])
      wsData.push([`К соревнованиям допущено (${participants.length}) человек`])
      wsData.push(['Врач (ФИО) ______________________________'])
      wsData.push(['Представитель команды ______________________________'])

      const ws = XLSX.utils.aoa_to_sheet(wsData)
      if (!ws['!merges']) ws['!merges'] = []
      ws['!merges'].push(
        { s:{r:0,c:0}, e:{r:0,c:17} },
        { s:{r:1,c:0}, e:{r:1,c:17} },
      )
      ws['!cols'] = [
        {wch:5},{wch:30},{wch:15},{wch:10},{wch:12},{wch:12},
        {wch:30},{wch:8},{wch:20},{wch:20},{wch:30},
        {wch:10},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12},{wch:12}
      ]
      XLSX.utils.book_append_sheet(wb, ws, 'Заявка ЦФО')

    } else if (type === 'ivanteevo') {
      const wsData = [
        ['Заявка от клуба "Тайпан"'],
        ['на участие в Фестивале боевых искусств по тхэквондо и кикбоксингу'],
        ['«____ Кубок "СПЕКТРА" ___.___.20___г.»'],
        [''],
        ['№','ФИО','Пол','Дата рожд','Возраст','Спорт квал.','Техн квал.',
         'Формы','Массог / Лайт','Стоп-балл / поинт (реал. вес)','Мягкие палки (реал. рост)',
         'Сила удара','Клуб','Тренер / должность','Врач'],
      ]
      participants.forEach((p, i) => {
        wsData.push([
          i + 1,
          p.full_name,
          p.gender === 'male' ? 'м' : p.gender === 'female' ? 'ж' : '',
          formatDate(p.birth_date),
          calcAge(p.birth_date) || '',
          sportQualLabel(p.gup, p.dan),
          gupLabel(p.gup, p.dan),
          cellValue(p, DISCIPLINES[0]),  // хъёнг → формы
          cellValue(p, DISCIPLINES[1]),  // спарринг → массог
          cellValue(p, DISCIPLINES[2]),  // стоп-балл
          cellValue(p, DISCIPLINES[3]),  // тег-тим → мягкие палки / КСБ
          cellValue(p, DISCIPLINES[4]),  // сил. разбив → сила удара
          'Клуб «ТАЙПАН»',
          'Ротарь Екатерина Валерьевна',
          '',
        ])
      })
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      if (!ws['!merges']) ws['!merges'] = []
      ws['!merges'].push(
        { s:{r:0,c:0}, e:{r:0,c:14} },
        { s:{r:1,c:0}, e:{r:1,c:14} },
        { s:{r:2,c:0}, e:{r:2,c:14} },
      )
      ws['!cols'] = [
        {wch:5},{wch:30},{wch:6},{wch:12},{wch:8},{wch:12},{wch:12},
        {wch:10},{wch:14},{wch:22},{wch:22},{wch:12},{wch:20},{wch:30},{wch:10}
      ]
      XLSX.utils.book_append_sheet(wb, ws, 'Заявка Ивантеевка')
    }

    const fileName = `Заявка_ТАЙПАН_${type}_${detail?.name || ''}_${new Date().toISOString().slice(0,10)}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  // ── Генерация Word (docx через CDN) ──────────────────────────────────────────
  const generateWord = async (type) => {
    setGenLoading(true)
    setGenMsg('Генерация Word...')
    try {
      // Динамический импорт docx через unpkg
      const docxLib = await import('https://unpkg.com/docx@8.5.0/build/index.js')
      const {
        Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        WidthType, AlignmentType, VerticalAlign, BorderStyle, PageOrientation
      } = docxLib

      const headerRow = (cols) => new TableRow({
        children: cols.map(text => new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 18 })], alignment: AlignmentType.CENTER })],
          verticalAlign: VerticalAlign.CENTER,
        }))
      })

      const dataRow = (cells) => new TableRow({
        children: cells.map(text => new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: String(text || ''), size: 18 })], alignment: AlignmentType.CENTER })],
          verticalAlign: VerticalAlign.CENTER,
        }))
      })

      const borders = {
        top:             { style: BorderStyle.SINGLE, size: 6 },
        bottom:          { style: BorderStyle.SINGLE, size: 6 },
        left:            { style: BorderStyle.SINGLE, size: 6 },
        right:           { style: BorderStyle.SINGLE, size: 6 },
        insideHorizontal:{ style: BorderStyle.SINGLE, size: 4 },
        insideVertical:  { style: BorderStyle.SINGLE, size: 4 },
      }

      const titleBlock = (lines) => lines.map(({ text, bold, size, align }) =>
        new Paragraph({
          children: [new TextRun({ text, bold: bold || false, size: size || 24 })],
          alignment: align || AlignmentType.LEFT,
          spacing: { after: 80 },
        })
      )

      let sections

      if (type === 'cfo') {
        const tableRows = [
          headerRow(['№','Ф.И.О.','Дата рожд.','Вес','Спорт. квал.','Тех. квал.',
            'Субъект РФ, Город','ФО','Д.С.О.','СК, ДЮСШ','Тренер',
            'Хъёнг','Поединок','Стоп-балл','Тег-тим','Сил. разбив','Спец. техн.','Виза врача']),
          ...participants.map((p, i) => dataRow([
            i+1, p.full_name, formatDate(p.birth_date), p.weight||'',
            sportQualLabel(p.gup,p.dan), gupLabel(p.gup,p.dan),
            'Московская обл., Павловский Посад','ЦФО','','Клуб «ТАЙПАН»',
            'Ротарь Е.В.',
            cellValue(p,DISCIPLINES[0]),cellValue(p,DISCIPLINES[1]),
            cellValue(p,DISCIPLINES[2]),cellValue(p,DISCIPLINES[3]),
            cellValue(p,DISCIPLINES[4]),cellValue(p,DISCIPLINES[5]),'',
          ])),
        ]

        sections = [{
          properties: {
            page: {
              size: { width: 16838, height: 11906 },
              orientation: PageOrientation.LANDSCAPE,
              margin: { top: 800, bottom: 800, left: 800, right: 800 }
            }
          },
          children: [
            ...titleBlock([
              { text: '«Утверждаю»', bold: true, size: 24, align: AlignmentType.RIGHT },
              { text: 'Руководитель АНО «Спортивный клуб тхэквондо «Тайпан» г. Павловский Посад»', size: 20, align: AlignmentType.RIGHT },
              { text: 'Е.В. Ротарь', size: 20, align: AlignmentType.RIGHT },
              { text: '_________________20___ г.', size: 20, align: AlignmentType.RIGHT },
              { text: ' ' },
              { text: 'ЗАЯВКА', bold: true, size: 36, align: AlignmentType.CENTER },
              { text: `от клуба «Тайпан» на участие в ${detail?.name || '______________________________'}`, bold: true, size: 28, align: AlignmentType.CENTER },
              { text: ' ' },
            ]),
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows, borders }),
            new Paragraph({ text: ' ' }),
            new Paragraph({ children: [new TextRun({ text: `К соревнованиям допущено (${participants.length}) человек` })] }),
            new Paragraph({ children: [new TextRun({ text: 'Врач (ФИО) ______________________________' })] }),
            new Paragraph({ children: [new TextRun({ text: 'Представитель команды ______________________________' })] }),
          ]
        }]

      } else if (type === 'ivanteevo') {
        const tableRows = [
          headerRow(['№','ФИО','Пол','Дата рожд','Лет','Спорт квал.','Техн квал.',
            'Формы','Массог/Лайт','Стоп-балл (реал. вес)','Тег-тим (реал. вес)',
            'Сила удара','Клуб','Тренер','Врач']),
          ...participants.map((p, i) => dataRow([
            i+1, p.full_name,
            p.gender==='male'?'м':p.gender==='female'?'ж':'',
            formatDate(p.birth_date),
            calcAge(p.birth_date)||'',
            sportQualLabel(p.gup,p.dan),
            gupLabel(p.gup,p.dan),
            cellValue(p,DISCIPLINES[0]),
            cellValue(p,DISCIPLINES[1]),
            cellValue(p,DISCIPLINES[2]),
            cellValue(p,DISCIPLINES[3]),
            cellValue(p,DISCIPLINES[4]),
            'Клуб «ТАЙПАН»','Ротарь Е.В.','',
          ])),
        ]

        sections = [{
          properties: {
            page: {
              size: { width: 16838, height: 11906 },
              orientation: PageOrientation.LANDSCAPE,
              margin: { top: 800, bottom: 800, left: 800, right: 800 }
            }
          },
          children: [
            ...titleBlock([
              { text: '«Утверждаю»', bold: true, size: 24, align: AlignmentType.RIGHT },
              { text: 'Руководитель АНО «Спортивный клуб тхэквондо «Тайпан» г. Павловский Посад»', size: 20, align: AlignmentType.RIGHT },
              { text: 'Е.В. Ротарь', size: 20, align: AlignmentType.RIGHT },
              { text: '_________________20___ г.', size: 20, align: AlignmentType.RIGHT },
              { text: ' ' },
              { text: 'Заявка от клуба «Тайпан»', bold: true, size: 32, align: AlignmentType.CENTER },
              { text: 'на участие в Фестивале боевых искусств по тхэквондо и кикбоксингу', bold: true, size: 26, align: AlignmentType.CENTER },
              { text: '«____ Кубок "СПЕКТРА" ___.___.20___г.»', bold: true, size: 26, align: AlignmentType.CENTER },
              { text: ' ' },
            ]),
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows, borders }),
          ]
        }]
      }

      const doc = new Document({ creator: 'Клуб ТАЙПАН', sections })
      const blob = await Packer.toBlob(doc)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Заявка_ТАЙПАН_${type}_${detail?.name||''}_${new Date().toISOString().slice(0,10)}.docx`
      a.click()
      URL.revokeObjectURL(url)
      setGenMsg('Word создан!')
    } catch (e) {
      console.error(e)
      setGenMsg('Ошибка генерации Word: ' + e.message)
    }
    setGenLoading(false)
  }

  const generate = async (type) => {
    if (participants.length === 0) { setGenMsg('Нет участников со статусом «Участвует»'); return }
    generateExcel(type)
    await generateWord(type)
    setTimeout(() => setGenMsg(''), 4000)
  }

  if (participants.length === 0) return null

  return (
    <div style={{ marginTop:24, paddingTop:20, borderTop:'1px solid var(--gray-dim)' }}>

      {/* Заголовок */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:16 }}>
        <span style={{ fontFamily:'Barlow Condensed', fontSize:'13px', fontWeight:700, letterSpacing:'2px', textTransform:'uppercase', color:'var(--gray)' }}>
          Матрица участия · {participants.length} чел.
        </span>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="att-all-btn" onClick={() => generate('cfo')} disabled={genLoading}>
            Заявка ЦФО/Россия
          </button>
          <button className="att-all-btn" onClick={() => generate('ivanteevo')} disabled={genLoading}>
            Заявка Ивантеевка
          </button>
        </div>
      </div>

      {genMsg && (
        <div style={{ marginBottom:12, padding:'8px 14px', background:'rgba(76,175,80,0.1)', border:'1px solid #4caf50', color:'#4caf50', fontSize:'13px' }}>
          {genMsg}
        </div>
      )}

      {/* Таблица матрицы */}
      <div style={{ overflowX:'auto' }}>
        <table style={{ borderCollapse:'collapse', width:'100%', minWidth:500, fontSize:'13px' }}>
          <thead>
            <tr>
              <th style={{ padding:'8px 12px', textAlign:'left', background:'var(--dark2)', border:'1px solid var(--gray-dim)', color:'var(--white)', fontFamily:'Barlow Condensed', letterSpacing:'1px', whiteSpace:'nowrap' }}>
                Спортсмен
              </th>
              <th style={{ padding:'6px 10px', textAlign:'center', background:'var(--dark2)', border:'1px solid var(--gray-dim)', color:'var(--gray)', fontFamily:'Barlow Condensed', fontSize:'11px', letterSpacing:'1px' }}>
                Вес
              </th>
              {DISCIPLINES.map(d => (
                <th
                  key={d.key}
                  onClick={() => toggleCol(d.key)}
                  title={hidden[d.key] ? 'Показать столбец' : 'Скрыть столбец'}
                  style={{
                    padding:'6px 10px', textAlign:'center', cursor:'pointer',
                    background: hidden[d.key] ? 'rgba(0,0,0,0.5)' : 'var(--dark2)',
                    border:'1px solid var(--gray-dim)',
                    color: hidden[d.key] ? 'var(--gray-dim)' : 'var(--red)',
                    fontFamily:'Barlow Condensed', fontSize:'11px', letterSpacing:'1px',
                    whiteSpace:'nowrap', userSelect:'none',
                    transition:'all 0.2s',
                    textDecoration: hidden[d.key] ? 'line-through' : 'none',
                    minWidth: 80,
                  }}
                >
                  {d.label}
                  <div style={{ fontSize:'9px', color:'var(--gray-dim)', marginTop:2 }}>
                    {hidden[d.key] ? '▸ скрыт' : '▾ клик=скрыть'}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {participants.map((p, i) => (
              <tr key={p.athlete_id} style={{ background: i % 2 === 0 ? 'var(--dark)' : 'var(--dark2)' }}>
                <td style={{ padding:'8px 12px', border:'1px solid var(--gray-dim)', color:'var(--white)', whiteSpace:'nowrap' }}>
                  {p.full_name}
                </td>
                <td style={{ padding:'6px 10px', border:'1px solid var(--gray-dim)', color:'var(--gray)', textAlign:'center', whiteSpace:'nowrap' }}>
                  {p.weight ? `${p.weight} кг` : '—'}
                </td>
                {DISCIPLINES.map(d => {
                  const dis = isDisabled(p.athlete_id, d.key)
                  const isHidden = hidden[d.key]
                  return (
                    <td
                      key={d.key}
                      onClick={() => !isHidden && toggleCell(p.athlete_id, d.key)}
                      style={{
                        padding:'6px 10px',
                        border:'1px solid var(--gray-dim)',
                        textAlign:'center',
                        cursor: isHidden ? 'default' : 'pointer',
                        background: isHidden ? 'rgba(0,0,0,0.4)' : dis ? 'rgba(0,0,0,0.6)' : 'rgba(204,0,0,0.08)',
                        color: isHidden ? 'transparent' : dis ? 'var(--gray-dim)' : d.type === 'weight' ? '#c8962a' : '#4caf50',
                        fontWeight: 700,
                        fontSize: '14px',
                        transition:'all 0.15s',
                        userSelect:'none',
                        minWidth: 80,
                      }}
                    >
                      {isHidden ? '' : dis
                        ? '✕'
                        : d.type === 'weight'
                          ? (p.weight ? p.weight : '—')
                          : '+'
                      }
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop:10, color:'var(--gray)', fontSize:'12px', fontStyle:'italic' }}>
        Клик по ячейке — отметить «не участвует». Клик по заголовку столбца — скрыть дисциплину из заявки.
      </p>
    </div>
  )
}
