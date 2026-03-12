import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Cabinet.css'

const API = '/api'

export default function Cabinet() {
  const navigate  = useNavigate()
  const token     = localStorage.getItem('token')
  const role      = localStorage.getItem('role')
  const name      = localStorage.getItem('full_name')
  const isAdmin   = ['admin', 'manager'].includes(role)

  const [athletes, setAthletes]   = useState([])
  const [loading,  setLoading]    = useState(false)
  const [editing,  setEditing]    = useState(null)   // id редактируемого
  const [editData, setEditData]   = useState({})
  const [filter,   setFilter]     = useState('')
  const [view,     setView]       = useState('athletes') // athletes | parents

  useEffect(() => {
    if (!token) { navigate('/login'); return }
    if (isAdmin) loadAthletes()
  }, [])

  const loadAthletes = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/users/athletes`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await r.json()
      setAthletes(data)
    } catch { }
    setLoading(false)
  }

  const startEdit = (a) => {
    setEditing(a.id)
    setEditData({ weight: a.weight || '', group: a.group || '', gup: a.gup || '', dan: a.dan || '' })
  }

  const saveEdit = async (id) => {
    const body = {}
    if (editData.weight) body.weight = parseFloat(editData.weight)
    if (editData.group)  body.group  = editData.group
    if (editData.gup)    body.gup    = parseInt(editData.gup)
    if (editData.dan)    body.dan    = parseInt(editData.dan)
    await fetch(`${API}/users/athletes/${id}`, {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    setEditing(null)
    loadAthletes()
  }

  const deleteAthlete = async (id) => {
    if (!window.confirm('Удалить спортсмена?')) return
    await fetch(`${API}/users/athletes/${id}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    loadAthletes()
  }

  const filtered = athletes.filter(a =>
    a.full_name.toLowerCase().includes(filter.toLowerCase()) ||
    (a.parent_name || '').toLowerCase().includes(filter.toLowerCase())
  )

  const logout = () => {
    localStorage.clear()
    navigate('/login')
  }

  // ── Обычный пользователь ──────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <main className="cabinet-page">
        <div className="container cabinet-container">
          <div className="cabinet-header">
            <div>
              <p className="section-label">Личный кабинет</p>
              <h1 className="cabinet-title">{name}</h1>
            </div>
            <button className="btn-outline cabinet-logout" onClick={logout}>Выйти</button>
          </div>
          <div className="cabinet-coming">
            <p>Личный кабинет в разработке.</p>
            <p>Скоро здесь появится информация о прогрессе, расписание и уведомления.</p>
          </div>
        </div>
      </main>
    )
  }

  // ── Админ / тренер ────────────────────────────────────────────────────────
  return (
    <main className="cabinet-page">
      <div className="container cabinet-container">

        <div className="cabinet-header">
          <div>
            <p className="section-label">Панель управления</p>
            <h1 className="cabinet-title">{name}</h1>
            <span className="cabinet-role-badge">{role === 'admin' ? 'Администратор' : 'Тренер'}</span>
          </div>
          <button className="btn-outline cabinet-logout" onClick={logout}>Выйти</button>
        </div>

        {/* Вкладки */}
        <div className="cabinet-tabs">
          <button
            className={`cabinet-tab ${view === 'athletes' ? 'active' : ''}`}
            onClick={() => setView('athletes')}
          >
            Спортсмены ({athletes.length})
          </button>
          <button
            className={`cabinet-tab ${view === 'parents' ? 'active' : ''}`}
            onClick={() => setView('parents')}
          >
            Родители
          </button>
        </div>

        {/* Поиск */}
        <div className="cabinet-search">
          <input
            type="text"
            placeholder="Поиск по имени..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>

        {loading && <div className="cabinet-loading">Загрузка...</div>}

        {/* ── Список спортсменов ── */}
        {view === 'athletes' && (
          <div className="athletes-table-wrap">
            <table className="athletes-table">
              <thead>
                <tr>
                  <th>ФИО</th>
                  <th>Дата рожд.</th>
                  <th>Возраст</th>
                  <th>Пол</th>
                  <th>Группа</th>
                  <th>Гып / Дан</th>
                  <th>Вес (кг)</th>
                  <th>Родитель</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id}>
                    <td className="td-name">{a.full_name}</td>
                    <td>{a.birth_date}</td>
                    <td>{a.age}</td>
                    <td>{a.gender === 'male' ? 'М' : 'Ж'}</td>
                    <td>
                      {editing === a.id ? (
                        <input
                          value={editData.group}
                          onChange={e => setEditData(d => ({ ...d, group: e.target.value }))}
                          className="td-input"
                        />
                      ) : (
                        a.group || a.auto_group
                      )}
                    </td>
                    <td>
                      {editing === a.id ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <input
                            placeholder="Гып"
                            value={editData.gup}
                            onChange={e => setEditData(d => ({ ...d, gup: e.target.value, dan: '' }))}
                            className="td-input td-input-sm"
                          />
                          <input
                            placeholder="Дан"
                            value={editData.dan}
                            onChange={e => setEditData(d => ({ ...d, dan: e.target.value, gup: '' }))}
                            className="td-input td-input-sm"
                          />
                        </div>
                      ) : (
                        a.dan ? `${a.dan} дан` : a.gup ? `${a.gup} гып` : '—'
                      )}
                    </td>
                    <td>
                      {editing === a.id ? (
                        <input
                          value={editData.weight}
                          onChange={e => setEditData(d => ({ ...d, weight: e.target.value }))}
                          className="td-input td-input-sm"
                          placeholder="кг"
                        />
                      ) : (
                        a.weight ? `${a.weight} кг` : '—'
                      )}
                    </td>
                    <td className="td-parent">
                      <div>{a.parent_name}</div>
                      <div className="td-phone">{a.parent_phone}</div>
                    </td>
                    <td className="td-actions">
                      {editing === a.id ? (
                        <>
                          <button className="td-btn td-btn-save" onClick={() => saveEdit(a.id)}>✓</button>
                          <button className="td-btn td-btn-cancel" onClick={() => setEditing(null)}>✕</button>
                        </>
                      ) : (
                        <>
                          <button className="td-btn td-btn-edit" onClick={() => startEdit(a)}>Ред.</button>
                          <button className="td-btn td-btn-del" onClick={() => deleteAthlete(a.id)}>Удал.</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && !loading && (
              <div className="cabinet-empty">Спортсменов не найдено</div>
            )}
          </div>
        )}

        {/* ── Список родителей ── */}
        {view === 'parents' && (
          <div className="athletes-table-wrap">
            <table className="athletes-table">
              <thead>
                <tr>
                  <th>ФИО родителя</th>
                  <th>Телефон</th>
                  <th>Email</th>
                  <th>Спортсмены</th>
                </tr>
              </thead>
              <tbody>
                {[...new Map(
                  filtered
                    .filter(a => a.parent_name)
                    .map(a => [a.parent_phone, a])
                ).values()].map((a, i) => (
                  <tr key={i}>
                    <td>{a.parent_name}</td>
                    <td>{a.parent_phone}</td>
                    <td>—</td>
                    <td>{filtered.filter(x => x.parent_phone === a.parent_phone).map(x => x.full_name).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </main>
  )
}
