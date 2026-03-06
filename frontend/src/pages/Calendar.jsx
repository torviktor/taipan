import { useState, useEffect, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import ruLocale from '@fullcalendar/core/locales/ru'
import axios from 'axios'
import './Calendar.css'

const API = '/api/events'
const token = () => localStorage.getItem('token')
const isAdmin = () => ['manager','admin'].includes(localStorage.getItem('role'))

const NOTIFY_OPTIONS = [
  { label: 'В день события',  days: 0  },
  { label: 'За 1 день',       days: 1  },
  { label: 'За 2 дня',        days: 2  },
  { label: 'За 3 дня',        days: 3  },
  { label: 'За 5 дней',       days: 5  },
  { label: 'За неделю',       days: 7  },
  { label: 'За 2 недели',     days: 14 },
  { label: 'За месяц',        days: 30 },
]

const EMPTY_FORM = {
  title:              '',
  description:        '',
  event_date:         '',
  event_time:         '',
  location:           '',
  notify_before_days: [1],
  notify_everyone:    true,
}

export default function CalendarPage() {
  const [events,      setEvents]      = useState([])
  const [modal,       setModal]       = useState(false)
  const [editEvent,   setEditEvent]   = useState(null)   // null = создание
  const [form,        setForm]        = useState(EMPTY_FORM)
  const [loading,     setLoading]     = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const calendarRef = useRef(null)

  useEffect(() => { loadEvents() }, [])

  // ── Загрузить события ─────────────────────────────────────────────
  async function loadEvents() {
    try {
      const r = await axios.get(API)
      const mapped = r.data.map(e => ({
        id:    e.id,
        title: e.title,
        start: e.event_date,
        extendedProps: e,
        backgroundColor: '#CC0000',
        borderColor:     '#990000',
      }))
      setEvents(mapped)
    } catch {
      setEvents([])
    }
  }

  // ── Открыть форму создания ────────────────────────────────────────
  function openCreate(dateInfo) {
    if (!isAdmin()) return
    const date = dateInfo?.dateStr || new Date().toISOString().split('T')[0]
    setForm({ ...EMPTY_FORM, event_date: date, event_time: '10:00' })
    setEditEvent(null)
    setModal(true)
  }

  // ── Открыть форму редактирования ──────────────────────────────────
  function openEdit(clickInfo) {
    const e = clickInfo.event.extendedProps
    const dt = new Date(e.event_date)
    setForm({
      title:              e.title,
      description:        e.description || '',
      event_date:         dt.toISOString().split('T')[0],
      event_time:         dt.toTimeString().slice(0,5),
      location:           e.location || '',
      notify_before_days: e.notify_before_days || [1],
      notify_everyone:    e.notify_everyone ?? true,
    })
    setEditEvent(e)
    setModal(true)
  }

  // ── Сохранить событие ─────────────────────────────────────────────
  async function saveEvent(e) {
    e.preventDefault()
    setLoading(true)
    const payload = {
      title:              form.title,
      description:        form.description,
      event_date:         `${form.event_date}T${form.event_time}:00`,
      location:           form.location,
      notify_before_days: form.notify_before_days,
      notify_everyone:    form.notify_everyone,
    }
    const headers = { Authorization: `Bearer ${token()}` }
    try {
      if (editEvent) {
        await axios.patch(`${API}/${editEvent.id}`, payload, { headers })
      } else {
        await axios.post(API, payload, { headers })
      }
      setModal(false)
      loadEvents()
    } catch (err) {
      alert('Ошибка сохранения: ' + (err.response?.data?.detail || err.message))
    } finally {
      setLoading(false)
    }
  }

  // ── Удалить событие ───────────────────────────────────────────────
  async function deleteEvent() {
    const headers = { Authorization: `Bearer ${token()}` }
    try {
      await axios.delete(`${API}/${deleteConfirm}`, { headers })
      setDeleteConfirm(null)
      setModal(false)
      loadEvents()
    } catch (err) {
      alert('Ошибка удаления')
    }
  }

  // ── Переключить день уведомления ──────────────────────────────────
  function toggleNotifyDay(days) {
    setForm(f => ({
      ...f,
      notify_before_days: f.notify_before_days.includes(days)
        ? f.notify_before_days.filter(d => d !== days)
        : [...f.notify_before_days, days]
    }))
  }

  return (
    <main className="calendar-page">

      {/* Заголовок */}
      <section className="calendar-hero">
        <div className="container">
          <p className="section-label">Расписание событий</p>
          <h1 className="section-title">КАЛЕНДАРЬ</h1>
          <div className="divider" />
          <p className="calendar-sub">
            Тренировки, соревнования, сборы — все события клуба в одном месте
          </p>
        </div>
      </section>

      <div className="container calendar-body">

        {/* Кнопка добавить (только для админа) */}
        {isAdmin() && (
          <div className="calendar-toolbar">
            <button className="btn-primary" onClick={() => openCreate(null)}>
              + Создать событие
            </button>
            <span className="calendar-hint">
              Кликни на дату в календаре чтобы создать событие
            </span>
          </div>
        )}

        {/* Календарь */}
        <div className="calendar-wrap">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={ruLocale}
            headerToolbar={{
              left:   'prev,next today',
              center: 'title',
              right:  'dayGridMonth,timeGridWeek'
            }}
            events={events}
            dateClick={isAdmin() ? openCreate : undefined}
            eventClick={openEdit}
            height="auto"
            editable={false}
            selectable={isAdmin()}
          />
        </div>

        {/* Подсказка для подписки */}
        <div className="subscribe-hint">
          <span>🔔</span>
          <div>
            <strong>Получай уведомления о событиях</strong>
            <p>Напиши боту <a href="https://t.me/taipan_tkd_bot" target="_blank" rel="noreferrer">@taipan_tkd_bot</a> в Telegram — нажми /start</p>
          </div>
        </div>

      </div>

      {/* ── Модальное окно создания / редактирования ─────────────── */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>{editEvent ? 'Редактировать событие' : 'Новое событие'}</h2>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>

            <form className="modal-form" onSubmit={saveEvent}>

              {/* Название */}
              <div className="form-group">
                <label>Наименование *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({...f, title: e.target.value}))}
                  placeholder="Например: Открытый турнир по тхэквондо"
                  required
                />
              </div>

              {/* Дата и время */}
              <div className="form-row">
                <div className="form-group">
                  <label>Дата *</label>
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={e => setForm(f => ({...f, event_date: e.target.value}))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Время *</label>
                  <input
                    type="time"
                    value={form.event_time}
                    onChange={e => setForm(f => ({...f, event_time: e.target.value}))}
                    required
                  />
                </div>
              </div>

              {/* Место */}
              <div className="form-group">
                <label>Место проведения</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm(f => ({...f, location: e.target.value}))}
                  placeholder="Например: Зал №1, ул. Примерная 1"
                />
              </div>

              {/* Описание */}
              <div className="form-group">
                <label>Описание</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({...f, description: e.target.value}))}
                  placeholder="Дополнительная информация о событии..."
                  rows={3}
                />
              </div>

              {/* Уведомить за */}
              <div className="form-group">
                <label>Уведомить подписчиков за</label>
                <div className="notify-options">
                  {NOTIFY_OPTIONS.map(opt => (
                    <button
                      key={opt.days}
                      type="button"
                      className={`notify-btn ${form.notify_before_days.includes(opt.days) ? 'active' : ''}`}
                      onClick={() => toggleNotifyDay(opt.days)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="form-hint">
                  Выбрано: {form.notify_before_days.length === 0
                    ? 'без напоминаний'
                    : form.notify_before_days
                        .sort((a,b) => b-a)
                        .map(d => NOTIFY_OPTIONS.find(o => o.days === d)?.label)
                        .join(', ')
                  }
                </p>
              </div>

              {/* Кого уведомлять */}
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.notify_everyone}
                    onChange={e => setForm(f => ({...f, notify_everyone: e.target.checked}))}
                  />
                  Уведомить всех подписчиков
                </label>
              </div>

              {/* Кнопки */}
              <div className="modal-actions">
                {editEvent && (
                  <button
                    type="button"
                    className="btn-delete"
                    onClick={() => setDeleteConfirm(editEvent.id)}
                  >
                    Удалить
                  </button>
                )}
                <button type="button" className="btn-outline" onClick={() => setModal(false)}>
                  Отмена
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Сохранение...' : editEvent ? 'Сохранить' : 'Создать'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ── Подтверждение удаления ────────────────────────────────── */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal modal-small">
            <div className="modal-header">
              <h2>Удалить событие?</h2>
            </div>
            <p style={{color:'var(--gray)', padding:'0 0 24px'}}>
              Это действие нельзя отменить. Все напоминания для этого события будут отменены.
            </p>
            <div className="modal-actions">
              <button className="btn-outline" onClick={() => setDeleteConfirm(null)}>Отмена</button>
              <button className="btn-delete" onClick={deleteEvent}>Да, удалить</button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}
