import { useState, useEffect } from 'react'
import { API } from './constants'

export default function ParentAnalyticsTab({ token, athletes: myAthletes }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(myAthletes.length === 1 ? myAthletes[0].id : '')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitErr, setSubmitErr] = useState('')

  const h = { Authorization: `Bearer ${token}` }
  const hj = { ...h, 'Content-Type': 'application/json' }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`${API}/analytics`, { headers: h })
      if (r.ok) setRecords(await r.json())
    } catch {}
    setLoading(false)
  }

  async function submitRequest() {
    if (!selectedId) { setSubmitErr('Выберите спортсмена'); return }
    setSubmitErr(''); setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('athlete_id', selectedId)
      fd.append('title', `Заявка на аналитику`)
      fd.append('comment', comment || 'Запрос от родителя')
      const r = await fetch(`${API}/applications/`, {
        method: 'POST', headers: hj,
        body: JSON.stringify({
          full_name: myAthletes.find(a => a.id === Number(selectedId))?.full_name || '',
          phone: localStorage.getItem('phone') || '',
          comment: comment || 'Заявка на аналитику',
        })
      })
      if (r.ok) { setSubmitted(true); setComment('') }
      else { const d = await r.json(); setSubmitErr(d.detail || 'Ошибка') }
    } catch { setSubmitErr('Ошибка сети') }
    setSubmitting(false)
  }

  const fmtDate = s => s ? new Date(s).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' }) : '--'

  const H3 = ({ children }) => <div style={{ fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'1.05rem', letterSpacing:'0.06em', color:'var(--red)', marginTop:20, marginBottom:8, textTransform:'uppercase' }}>{children}</div>
  const P = ({ children }) => <p style={{ color:'var(--gray)', fontSize:'0.95rem', lineHeight:1.7, marginBottom:12 }}>{children}</p>
  const Hl = ({ children }) => <span style={{ color:'var(--white)', fontWeight:600 }}>{children}</span>
  const Li = ({ children }) => <div style={{ display:'flex', gap:10, marginBottom:6 }}><span style={{ color:'var(--red)', flexShrink:0, marginTop:2 }}>--</span><span style={{ color:'var(--gray)', fontSize:'0.95rem', lineHeight:1.6 }}>{children}</span></div>

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:40, paddingTop:24 }}>

      {/* Мои аналитики */}
      <div>
        <div style={{ fontFamily:'Bebas Neue', fontSize:'1.4rem', letterSpacing:'0.08em', color:'var(--white)', marginBottom:16, borderBottom:'1px solid var(--gray-dim)', paddingBottom:8 }}>Мои аналитики</div>
        {loading && <div className="cabinet-loading">Загрузка...</div>}
        {!loading && records.length === 0 && <div className="cabinet-coming">Аналитика пока не проводилась.</div>}
        {!loading && records.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {records.map(rep => (
              <div key={rep.id} style={{ background:'var(--dark)', border:'1px solid var(--gray-dim)', borderLeft:'3px solid var(--red)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', flexWrap:'wrap', gap:12 }}>
                  <div>
                    <div style={{ fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'1rem', letterSpacing:'1px', color:'var(--white)', textTransform:'uppercase' }}>{rep.athlete_name}</div>
                    <div style={{ color:'var(--gray)', fontSize:'0.88rem', marginTop:3 }}>{rep.title} / {fmtDate(rep.created_at)}</div>
                    {rep.comment && <div style={{ color:'var(--gray)', fontSize:'0.85rem', marginTop:4 }}>{rep.comment}</div>}
                  </div>
                  {rep.file_path && (
                    <button className="btn-outline" style={{ padding:'6px 16px', fontSize:'13px', cursor:'pointer' }}
                      onClick={async () => {
                        const filename = rep.file_path.split('/').pop()
                        const r = await fetch(`/api/analytics/download/${filename}`, { headers: { Authorization: `Bearer ${token}` } })
                        if (r.ok) { const blob = await r.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url) }
                      }}>
                      Скачать файл
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Заявка на аналитику */}
      <div>
        <div style={{ fontFamily:'Bebas Neue', fontSize:'1.4rem', letterSpacing:'0.08em', color:'var(--white)', marginBottom:16, borderBottom:'1px solid var(--gray-dim)', paddingBottom:8 }}>Заявка на аналитику</div>
        {submitted ? (
          <div className="att-msg" style={{ maxWidth:480 }}>Заявка принята. Мы свяжемся с вами.</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:14, maxWidth:480 }}>
            {myAthletes.length > 1 && (
              <div>
                <label style={{ color:'var(--gray)', fontSize:'0.78rem', letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:6 }}>Спортсмен</label>
                <select value={selectedId} onChange={e => { setSelectedId(e.target.value); setSubmitted(false) }} className="att-date-input" style={{ width:'100%' }}>
                  <option value="">Выберите спортсмена</option>
                  {myAthletes.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                </select>
              </div>
            )}
            {myAthletes.length === 1 && (
              <div style={{ color:'var(--gray)', fontSize:'0.9rem' }}>Спортсмен: <span style={{ color:'var(--white)', fontWeight:600 }}>{myAthletes[0].full_name}</span></div>
            )}
            <div>
              <label style={{ color:'var(--gray)', fontSize:'0.78rem', letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:6 }}>Комментарий / пожелания</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} rows={4} placeholder="Что вас интересует? Какой период? Есть ли конкретные вопросы?" className="att-notes-input" style={{ width:'100%', resize:'vertical' }} />
            </div>
            {submitErr && <div style={{ color:'var(--red)', fontSize:'0.88rem' }}>{submitErr}</div>}
            <button className="btn-primary" style={{ alignSelf:'flex-start', padding:'12px 28px' }} onClick={submitRequest} disabled={submitting}>
              {submitting ? 'Отправка...' : 'Отправить заявку'}
            </button>
          </div>
        )}
      </div>

      {/* Информационный блок */}
      <div>
        <div style={{ background:'var(--dark2)', border:'1px solid var(--gray-dim)', borderRadius:10, padding:'18px 22px', marginBottom:24 }}>
          <P>Платформа накапливает данные по каждому спортсмену: посещаемость тренировок, результаты соревнований, прогресс по аттестациям, участие в сборах. Это не просто архив -- это основа для осмысленных выводов о развитии бойца.</P>
        </div>
        <H3>Что входит в аналитику</H3>
        <div style={{ marginBottom:18 }}>
          <Li><Hl>Посещаемость</Hl> -- динамика по месяцам и сравнение со средним показателем по клубу</Li>
          <Li><Hl>Соревнования и рейтинг</Hl> -- результаты турниров, позиция в 5 рейтингах (общий, по возрасту, по группе, по полу, по гыпу), распределение очков по дисциплинам</Li>
          <Li><Hl>Аттестации</Hl> -- хронология поясов, темп продвижения относительно среднего по клубу</Li>
          <Li><Hl>Сборы</Hl> -- участие и корреляция с результатами соревнований</Li>
          <Li><Hl>Ачивки</Hl> -- место в топе клуба, какие награды ещё доступны</Li>
          <Li><Hl>Корреляции</Hl> -- как посещаемость влияет на рейтинг, как сборы связаны с ростом, сильные стороны и зоны роста</Li>
          <Li><Hl>Персональные рекомендации</Hl> -- конкретные выводы и советы по развитию спортсмена</Li>
        </div>
        <H3>Как часто проводить аналитику</H3>
        <P>Рекомендация: <Hl>раз в год -- всем</Hl> активным спортсменам. <Hl>Раз в полгода</Hl> -- тем, кто регулярно участвует в соревнованиях и сборах.</P>
        <H3>Почему это платно</H3>
        <P>Каждая аналитика -- это ручная работа сертифицированного специалиста, который глубоко интегрирован в тхэквондо: знает специфику тренировочного процесса, структуру соревнований, систему поясов и возрастных категорий. Это не сторонний взгляд -- это взгляд изнутри, переведённый в цифры.</P>
        <H3>Куда идут средства</H3>
        <P>Все средства от аналитики направляются на поддержание и развитие платформы клуба: оплата сервера, техническая поддержка, услуги машинного обучения (Yandex ML), резервное копирование данных, обновление функционала сайта. Это не коммерческий проект -- это инструмент для клуба.</P>
        <div style={{ margin:'24px 0 4px', padding:'18px 22px', borderLeft:'3px solid var(--red)', background:'var(--dark2)', borderRadius:'0 6px 6px 0' }}>
          <P>Ваши данные уже накоплены. Осталось их прочитать.</P>
        </div>
      </div>
    </div>
  )
}
