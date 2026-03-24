// ════════════════════════════════════════════════════════════════════════════
// ФАЙЛ 1: frontend/src/pages/AnalyticsTab.jsx
// Три компонента: AnalyticsInfoBlock, ParentAnalyticsTab, AnalyticsAdminTab
// Импортировать в Cabinet.jsx и встроить по инструкции ниже.
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'

const API = '/api'

// ─── Вспомогательные стили-компоненты (аналог InfoTab) ───────────────────────

const H3 = ({ children }) => (
  <div style={{
    fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '1.05rem',
    letterSpacing: '0.06em', color: 'var(--red)', marginTop: 20, marginBottom: 8,
    textTransform: 'uppercase',
  }}>{children}</div>
)

const P = ({ children }) => (
  <p style={{ color: 'var(--gray)', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: 12 }}>
    {children}
  </p>
)

const Hl = ({ children }) => (
  <span style={{ color: 'var(--white)', fontWeight: 600 }}>{children}</span>
)

const AccentBlock = ({ children }) => (
  <div style={{
    borderLeft: '3px solid var(--red)', background: 'var(--dark2)',
    padding: '14px 20px', marginBottom: 18,
  }}>{children}</div>
)

// ─── Метки статусов ──────────────────────────────────────────────────────────

const REQ_STATUS = {
  new:         { label: 'Новая',      color: '#FFD700' },
  in_progress: { label: 'В работе',   color: '#4caf50' },
  done:        { label: 'Завершена',  color: 'var(--gray)' },
}

const REP_STATUS = {
  in_progress: { label: 'В работе',  color: '#FFD700' },
  ready:       { label: 'Готова',    color: '#4caf50' },
}

// ════════════════════════════════════════════════════════════════════════════
// КОМПОНЕНТ A — статический информационный блок
// ════════════════════════════════════════════════════════════════════════════

export function AnalyticsInfoBlock() {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        fontFamily: 'Bebas Neue', fontSize: '1.7rem', letterSpacing: '0.08em',
        color: 'var(--white)', marginBottom: 12, borderBottom: '1px solid var(--gray-dim)',
        paddingBottom: 8,
      }}>
        Аналитика спортсмена
      </div>

      <P>
        Платформа накапливает данные по каждому спортсмену с первого дня: посещаемость тренировок,
        результаты соревнований, прогресс по аттестациям, участие в сборах. Большинство платформ
        на этом останавливаются — данные просто хранятся. Мы идём дальше: эти данные можно и нужно
        читать. Из них складывается реальная картина развития бойца — не ощущение, а факты.
      </P>

      <H3>Что входит в аналитику</H3>
      {[
        ['Посещаемость', 'динамика активности по сезонам, характер пропусков, тренды нагрузки'],
        ['Соревнования', 'частота участия, результативность, динамика мест, сравнение внутри возрастной категории'],
        ['Сборы', 'периодичность участия, связь с последующими результатами'],
        ['Аттестации', 'темп продвижения по поясам, интервалы между аттестациями, соответствие норме'],
        ['Связи и зависимости', 'как посещаемость влияет на результат, как сборы связаны с ростом уровня'],
        ['Антропометрия и весовая категория', 'соответствие возрасту и физическим показателям, рекомендации по категории на соревнованиях'],
        ['Индивидуальные рекомендации', 'конкретные выводы под возраст, текущий уровень и цели спортсмена'],
      ].map(([name, desc]) => (
        <div key={name} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <span style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }}>—</span>
          <P><Hl>{name}</Hl> — {desc}</P>
        </div>
      ))}

      <H3>Как часто проводить аналитику</H3>
      <P>
        Аналитика — не еженедельный дашборд. Смысл появляется тогда, когда данных накоплено
        достаточно для выводов. Делать её чаще — значит анализировать одно и то же.
      </P>
      <P>
        Рекомендация: <Hl>раз в год</Hl> — для всех активных спортсменов.{' '}
        <Hl>Раз в полгода</Hl> — для тех, кто регулярно участвует в соревнованиях и выездных
        сборах: там динамика быстрее, и промежуточный срез имеет смысл.
      </P>

      <H3>Почему это платно</H3>
      <P>
        Каждая аналитика — это ручная работа, а не автоматический отчёт. Аналитик —
        сертифицированный специалист (Яндекс Практикум), при этом глубоко интегрированный
        в тхэквондо: знает специфику тренировочного процесса, структуру соревнований, систему
        поясов и возрастных категорий. Это не взгляд стороннего консультанта — это взгляд
        изнутри, переведённый в цифры.
      </P>
      <P>
        Бесплатно — значит «когда успею». Платный формат — это гарантия срока, структуры
        и реальной пользы. Иначе очередь запросов просто утонет.
      </P>
      <P>
        <Hl>Стоимость одной аналитики — 1500 рублей.</Hl>
      </P>
      <P>
        Все средства направляются исключительно на поддержание инфраструктуры платформы
        и её дальнейшее развитие. Никаких личных заработков: это инструмент клуба,
        и деньги работают на клуб.
      </P>

      <AccentBlock>
        <P style={{ margin: 0, fontStyle: 'italic' }}>
          <Hl>Ваши данные уже накоплены.</Hl>{' '}
          <span style={{ color: 'var(--gray)' }}>Осталось их прочитать.</span>
        </P>
      </AccentBlock>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// КОМПОНЕНТ B — кабинет родителя/спортсмена
// ════════════════════════════════════════════════════════════════════════════

export function ParentAnalyticsTab({ token, athletes }) {
  const [reports,     setReports]     = useState([])
  const [requests,    setRequests]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [openReport,  setOpenReport]  = useState(null) // id раскрытой аналитики
  const [selectedId,  setSelectedId]  = useState(athletes.length === 1 ? athletes[0].id : '')
  const [comment,     setComment]     = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [submitted,   setSubmitted]   = useState(false)
  const [submitError, setSubmitError] = useState('')

  const h  = { Authorization: `Bearer ${token}` }
  const hj = { ...h, 'Content-Type': 'application/json' }

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [rRep, rReq] = await Promise.all([
          fetch(`${API}/analytics/reports/my/`, { headers: h }),
          fetch(`${API}/analytics/requests/my/`, { headers: h }),
        ])
        if (rRep.ok) setReports(await rRep.json())
        if (rReq.ok) setRequests(await rReq.json())
      } catch {}
      setLoading(false)
    }
    load()
  }, [])

  // Есть ли активная заявка по выбранному спортсмену
  const hasActiveRequest = selectedId
    ? requests.some(r => r.athlete_id === Number(selectedId) && ['new', 'in_progress'].includes(r.status))
    : false

  const submit = async () => {
    if (!selectedId) return
    setSubmitting(true); setSubmitError('')
    try {
      const r = await fetch(`${API}/analytics/requests/`, {
        method: 'POST', headers: hj,
        body: JSON.stringify({ athlete_id: Number(selectedId), comment }),
      })
      const d = await r.json()
      if (r.ok) {
        setSubmitted(true)
        setRequests(prev => [d, ...prev])
        setComment('')
      } else {
        setSubmitError(d.detail || 'Ошибка при отправке заявки')
      }
    } catch { setSubmitError('Ошибка соединения') }
    setSubmitting(false)
  }

  return (
    <div>
      {/* Секция A — информационный блок */}
      <AnalyticsInfoBlock />

      {/* Секция B — мои аналитики */}
      <div style={{
        fontFamily: 'Bebas Neue', fontSize: '1.4rem', letterSpacing: '0.08em',
        color: 'var(--white)', marginBottom: 12, borderBottom: '1px solid var(--gray-dim)',
        paddingBottom: 8,
      }}>
        Мои аналитики
      </div>

      {loading && <div className="cabinet-loading">Загрузка...</div>}

      {!loading && reports.length === 0 && (
        <div className="cabinet-empty">Аналитика пока не проводилась.</div>
      )}

      {!loading && reports.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
          {reports.map(rep => {
            const st = REP_STATUS[rep.status] || {}
            const open = openReport === rep.id
            return (
              <div key={rep.id} style={{
                background: 'var(--dark)', border: '1px solid var(--gray-dim)',
                borderLeft: '3px solid var(--red)',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 20px', flexWrap: 'wrap', gap: 10,
                }}>
                  <div>
                    <div style={{ color: 'var(--white)', fontWeight: 600, fontSize: '0.95rem' }}>
                      {rep.athlete_name}
                    </div>
                    <div style={{ color: 'var(--gray)', fontSize: '0.85rem', marginTop: 2 }}>
                      {rep.title} · {new Date(rep.created_at).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                      fontFamily: 'Barlow Condensed', fontSize: '0.78rem', fontWeight: 700,
                      letterSpacing: '0.05em', textTransform: 'uppercase', color: st.color,
                    }}>{st.label}</span>
                    {rep.status === 'ready' && (
                      <button className="btn-outline" style={{ padding: '5px 14px', fontSize: '12px' }}
                        onClick={() => setOpenReport(open ? null : rep.id)}>
                        {open ? 'Свернуть' : 'Открыть'}
                      </button>
                    )}
                  </div>
                </div>
                {open && (
                  <div style={{
                    padding: '0 20px 18px', color: 'var(--gray)',
                    fontSize: '0.9rem', lineHeight: 1.7, whiteSpace: 'pre-wrap',
                    borderTop: '1px solid var(--gray-dim)',
                    paddingTop: 14,
                  }}>
                    {rep.content}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Секция C — заявка на аналитику */}
      <div style={{
        fontFamily: 'Bebas Neue', fontSize: '1.4rem', letterSpacing: '0.08em',
        color: 'var(--white)', marginBottom: 16, borderBottom: '1px solid var(--gray-dim)',
        paddingBottom: 8,
      }}>
        Заявка на аналитику
      </div>

      {submitted ? (
        <div style={{
          padding: '16px 20px', background: 'rgba(76,175,80,0.08)',
          border: '1px solid #4caf50', color: '#4caf50', fontSize: '0.95rem',
        }}>
          Заявка принята. Мы свяжемся с вами.
        </div>
      ) : (
        <div style={{ maxWidth: 480 }}>
          {athletes.length > 1 && (
            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: 'block', marginBottom: 6, fontFamily: 'Barlow Condensed',
                fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--gray)',
              }}>Спортсмен</label>
              <select
                className="td-status-select"
                value={selectedId}
                onChange={e => { setSelectedId(e.target.value); setSubmitted(false) }}
                style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem' }}
              >
                <option value="">Выберите спортсмена</option>
                {athletes.map(a => (
                  <option key={a.id} value={a.id}>{a.full_name}</option>
                ))}
              </select>
            </div>
          )}

          {athletes.length === 1 && (
            <P>Спортсмен: <Hl>{athletes[0].full_name}</Hl></P>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{
              display: 'block', marginBottom: 6, fontFamily: 'Barlow Condensed',
              fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--gray)',
            }}>Комментарий / пожелания</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Например: интересует динамика посещаемости и рост результатов за последние два сезона..."
              rows={4}
              style={{
                width: '100%', boxSizing: 'border-box', background: 'var(--dark)',
                border: '1px solid var(--gray-dim)', color: 'var(--white)',
                fontFamily: 'Barlow', fontSize: '0.9rem', padding: '10px 14px',
                resize: 'vertical', outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--red)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--gray-dim)' }}
            />
          </div>

          {hasActiveRequest && (
            <div style={{ color: '#FFD700', fontSize: '0.87rem', marginBottom: 12 }}>
              По этому спортсмену уже есть активная заявка. Повторная подача недоступна.
            </div>
          )}

          {submitError && (
            <div style={{ color: 'var(--red)', fontSize: '0.87rem', marginBottom: 12 }}>
              {submitError}
            </div>
          )}

          <button
            className="btn-primary"
            disabled={!selectedId || hasActiveRequest || submitting}
            onClick={submit}
            style={{ padding: '12px 28px' }}
          >
            {submitting ? 'Отправка...' : 'Отправить заявку'}
          </button>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// КОМПОНЕНТ C — кабинет тренера/администратора
// ════════════════════════════════════════════════════════════════════════════

export function AnalyticsAdminTab({ token, athletes }) {
  const [requests,   setRequests]   = useState([])
  const [reports,    setReports]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [reqFilter,  setReqFilter]  = useState('')     // new | in_progress | done | ''
  const [reqSearch,  setReqSearch]  = useState('')
  const [showModal,  setShowModal]  = useState(false)
  const [editRep,    setEditRep]    = useState(null)   // null = создание, объект = редактирование
  const [form,       setForm]       = useState({ athlete_id: '', title: '', content: '', status: 'in_progress' })
  const [saving,     setSaving]     = useState(false)
  const [msg,        setMsg]        = useState('')

  const h  = { Authorization: `Bearer ${token}` }
  const hj = { ...h, 'Content-Type': 'application/json' }

  const load = async () => {
    setLoading(true)
    try {
      const [rReq, rRep] = await Promise.all([
        fetch(`${API}/analytics/requests/`, { headers: h }),
        fetch(`${API}/analytics/reports/`, { headers: h }),
      ])
      if (rReq.ok) setRequests(await rReq.json())
      if (rRep.ok) setReports(await rRep.json())
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const setReqStatus = async (id, status) => {
    const r = await fetch(`${API}/analytics/requests/${id}/status`, {
      method: 'PATCH', headers: hj, body: JSON.stringify({ status }),
    })
    if (r.ok) setRequests(prev => prev.map(x => x.id === id ? { ...x, status } : x))
  }

  const openNew = () => {
    setEditRep(null)
    setForm({ athlete_id: '', title: '', content: '', status: 'in_progress' })
    setMsg(''); setShowModal(true)
  }

  const openEdit = (rep) => {
    setEditRep(rep)
    setForm({ athlete_id: rep.athlete_id, title: rep.title, content: rep.content, status: rep.status })
    setMsg(''); setShowModal(true)
  }

  const saveReport = async () => {
    if (!form.athlete_id || !form.title.trim() || !form.content.trim()) {
      setMsg('Заполните все поля'); return
    }
    setSaving(true); setMsg('')
    try {
      const method = editRep ? 'PATCH' : 'POST'
      const url    = editRep
        ? `${API}/analytics/reports/${editRep.id}/`
        : `${API}/analytics/reports/`
      const r = await fetch(url, {
        method, headers: hj,
        body: JSON.stringify({
          athlete_id: Number(form.athlete_id),
          title:   form.title,
          content: form.content,
          status:  form.status,
        }),
      })
      if (r.ok) { setShowModal(false); await load() }
      else { const d = await r.json(); setMsg(d.detail || 'Ошибка') }
    } catch { setMsg('Ошибка соединения') }
    setSaving(false)
  }

  const deleteReport = async (id) => {
    if (!window.confirm('Удалить аналитику?')) return
    await fetch(`${API}/analytics/reports/${id}/`, { method: 'DELETE', headers: h })
    setReports(prev => prev.filter(r => r.id !== id))
  }

  const filteredReqs = requests.filter(r => {
    if (reqFilter && r.status !== reqFilter) return false
    if (reqSearch && !r.athlete_name?.toLowerCase().includes(reqSearch.toLowerCase())) return false
    return true
  })

  const newCount = requests.filter(r => r.status === 'new').length

  return (
    <div>
      {/* ── Блок 1 — Заявки ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{
          fontFamily: 'Bebas Neue', fontSize: '1.4rem', letterSpacing: '0.08em',
          color: 'var(--white)',
        }}>
          Заявки на аналитику
          {newCount > 0 && (
            <span className="tab-badge" style={{ marginLeft: 8 }}>{newCount}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text" placeholder="Поиск по имени..."
            value={reqSearch} onChange={e => setReqSearch(e.target.value)}
            className="att-date-input" style={{ width: 180 }}
          />
          <select className="td-status-select" value={reqFilter}
            onChange={e => setReqFilter(e.target.value)}>
            <option value="">Все статусы</option>
            <option value="new">Новая</option>
            <option value="in_progress">В работе</option>
            <option value="done">Завершена</option>
          </select>
        </div>
      </div>

      {loading && <div className="cabinet-loading">Загрузка...</div>}

      {!loading && filteredReqs.length === 0 && (
        <div className="cabinet-empty" style={{ marginBottom: 32 }}>Заявок нет.</div>
      )}

      {!loading && filteredReqs.length > 0 && (
        <div className="athletes-table-wrap" style={{ marginBottom: 40 }}>
          <table className="athletes-table">
            <thead>
              <tr>
                <th>Спортсмен</th>
                <th>Родитель</th>
                <th>Дата заявки</th>
                <th>Комментарий</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredReqs.map(r => {
                const st = REQ_STATUS[r.status] || {}
                return (
                  <tr key={r.id}>
                    <td className="td-name">{r.athlete_name}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--gray)' }}>{r.parent_name || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(r.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--gray)', maxWidth: 220 }}>
                      {r.comment || '—'}
                    </td>
                    <td>
                      <span style={{
                        fontFamily: 'Barlow Condensed', fontSize: '0.78rem', fontWeight: 700,
                        letterSpacing: '0.04em', textTransform: 'uppercase', color: st.color,
                      }}>{st.label}</span>
                    </td>
                    <td className="td-actions" style={{ whiteSpace: 'nowrap' }}>
                      {r.status === 'new' && (
                        <button className="td-btn td-btn-edit"
                          onClick={() => setReqStatus(r.id, 'in_progress')}>В работу</button>
                      )}
                      {r.status === 'in_progress' && (
                        <button className="td-btn td-btn-save"
                          onClick={() => setReqStatus(r.id, 'done')}>Готово</button>
                      )}
                      {r.status === 'done' && (
                        <span style={{ color: 'var(--gray)', fontSize: '0.8rem' }}>завершена</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Блок 2 — Готовые аналитики ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{
          fontFamily: 'Bebas Neue', fontSize: '1.4rem', letterSpacing: '0.08em',
          color: 'var(--white)',
        }}>
          Готовые аналитики
        </div>
        <button className="btn-primary" style={{ padding: '8px 18px', fontSize: '14px' }}
          onClick={openNew}>
          + Добавить аналитику
        </button>
      </div>

      {!loading && reports.length === 0 && (
        <div className="cabinet-empty">Аналитик пока нет.</div>
      )}

      {!loading && reports.length > 0 && (
        <div className="athletes-table-wrap">
          <table className="athletes-table">
            <thead>
              <tr>
                <th>Спортсмен</th>
                <th>Название</th>
                <th>Дата</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(rep => {
                const st = REP_STATUS[rep.status] || {}
                return (
                  <tr key={rep.id}>
                    <td className="td-name">{rep.athlete_name}</td>
                    <td style={{ color: 'var(--gray)', fontSize: '0.9rem' }}>{rep.title}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(rep.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td>
                      <span style={{
                        fontFamily: 'Barlow Condensed', fontSize: '0.78rem', fontWeight: 700,
                        letterSpacing: '0.04em', textTransform: 'uppercase', color: st.color,
                      }}>{st.label}</span>
                    </td>
                    <td className="td-actions">
                      <button className="td-btn td-btn-edit" onClick={() => openEdit(rep)}>Ред.</button>
                      <button className="td-btn td-btn-del" onClick={() => deleteReport(rep.id)}>Удал.</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Модалка создания/редактирования аналитики ── */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-box" style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: 20 }}>
              {editRep ? 'Редактировать аналитику' : 'Добавить аналитику'}
            </h3>

            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: 'block', marginBottom: 6, fontFamily: 'Barlow Condensed',
                fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--gray)',
              }}>Спортсмен</label>
              <select
                className="td-status-select"
                value={form.athlete_id}
                onChange={e => setForm(f => ({ ...f, athlete_id: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem' }}
                disabled={!!editRep}
              >
                <option value="">Выберите спортсмена</option>
                {athletes.map(a => (
                  <option key={a.id} value={a.id}>{a.full_name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: 'block', marginBottom: 6, fontFamily: 'Barlow Condensed',
                fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--gray)',
              }}>Название / тип</label>
              <input
                type="text" placeholder="Например: Аналитика за сезон 2025/2026"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="modal-input" style={{ marginBottom: 0 }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: 'block', marginBottom: 6, fontFamily: 'Barlow Condensed',
                fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--gray)',
              }}>Текст аналитики</label>
              <textarea
                rows={10}
                placeholder="Подробный анализ..."
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                style={{
                  width: '100%', boxSizing: 'border-box', background: 'var(--black)',
                  border: '1px solid var(--gray-dim)', color: 'var(--white)',
                  fontFamily: 'Barlow', fontSize: '0.9rem', padding: '10px 14px',
                  resize: 'vertical', outline: 'none', transition: 'border-color 0.2s',
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--red)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--gray-dim)' }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: 'block', marginBottom: 6, fontFamily: 'Barlow Condensed',
                fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--gray)',
              }}>Статус</label>
              <select
                className="td-status-select"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                style={{ width: '100%', padding: '10px 14px', fontSize: '0.9rem' }}
              >
                <option value="in_progress">В работе</option>
                <option value="ready">Готова</option>
              </select>
            </div>

            {msg && <div style={{ color: 'var(--red)', fontSize: '0.87rem', marginBottom: 12 }}>{msg}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-primary" onClick={saveReport} disabled={saving}
                style={{ padding: '10px 24px' }}>
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button className="btn-outline" onClick={() => setShowModal(false)}
                style={{ padding: '10px 24px' }}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ════════════════════════════════════════════════════════════════════════════
// ИНСТРУКЦИЯ ПО ВСТРОЙКЕ В Cabinet.jsx
// ════════════════════════════════════════════════════════════════════════════
//
// 1. Добавить импорт в начало Cabinet.jsx:
//    import { AnalyticsInfoBlock, ParentAnalyticsTab, AnalyticsAdminTab } from './AnalyticsTab'
//
// 2. В кабинете РОДИТЕЛЯ — добавить вкладку после «Информация»:
//    В массив кнопок <div className="cabinet-tabs">:
//      <button className={`cabinet-tab ${parentView==='analytics'?'active':''}`}
//        onClick={() => setParentView('analytics')}>Аналитика</button>
//
//    В рендер ниже (после {parentView === 'info' ...}):
//      {parentView === 'analytics' && !loading &&
//        <ParentAnalyticsTab token={token} athletes={myAthletes}/>}
//
// 3. В кабинете ТРЕНЕРА — добавить вкладку в группу «Результаты»:
//    После кнопки «Ачивки»:
//      <button className={`cabinet-tab ${view==='analytics'?'active':''}`}
//        onClick={() => setView('analytics')}>Аналитика</button>
//
//    В блок рендера (рядом с другими view ===):
//      {view === 'analytics' &&
//        <AnalyticsAdminTab token={token} athletes={athletes.filter(a=>!a.is_archived)}/>}
//
//    Также добавить 'analytics' в условие скрытия тулбара поиска:
//    view !== 'analytics' &&   (добавить в длинное условие перед <div className="cabinet-toolbar">)
// ════════════════════════════════════════════════════════════════════════════
