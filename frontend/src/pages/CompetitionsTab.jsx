// frontend/src/pages/CompetitionsTab.jsx
// Вкладка «Соревнования» — встраивается в Cabinet.jsx

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './Competitions.css';

// ─── Константы ───────────────────────────────────────────────────────────────

const SIGNIFICANCE_FALLBACK = {
  'Местный':        { 'Фестиваль': 1.0, 'Турнир': 1.2, 'Кубок': 1.5, 'Первенство': 1.5, 'Чемпионат': 1.5 },
  'Региональный':   { 'Фестиваль': 2.0, 'Турнир': 2.5, 'Кубок': 2.8, 'Первенство': 2.8, 'Чемпионат': 3.0 },
  'Окружной':       { 'Фестиваль': 4.0, 'Турнир': 4.5, 'Кубок': 5.0, 'Первенство': 5.0, 'Чемпионат': 6.0 },
  'Всероссийский':  { 'Фестиваль': 7.0, 'Турнир': 8.0, 'Кубок': 9.0, 'Первенство': 10.0, 'Чемпионат': 11.0 },
  'Международный':  { 'Фестиваль': 15.0, 'Турнир': 17.0, 'Кубок': 20.0, 'Первенство': 21.0, 'Чемпионат': 24.0 },
};

const LEVELS    = Object.keys(SIGNIFICANCE_FALLBACK);
const ALL_TYPES = ['Фестиваль', 'Турнир', 'Кубок', 'Первенство', 'Чемпионат'];

const LEVEL_BADGE = {
  'Местный':       'comp-badge-local',
  'Региональный':  'comp-badge-regional',
  'Окружной':      'comp-badge-district',
  'Всероссийский': 'comp-badge-national',
  'Международный': 'comp-badge-international',
};

const PLACE_OPTIONS = [
  { value: '', label: '—' },
  { value: 1, label: '🥇 1' },
  { value: 2, label: '🥈 2' },
  { value: 3, label: '🥉 3' },
];

// ─── Вспомогательная функция расчёта рейтинга (дублируем для preview) ────────

function calcRatingPreview(row, sig) {
  const placeBns = (p, b1, b2, b3) =>
    p === 1 ? b1 : p === 2 ? b2 : p === 3 ? b3 : 0;

  const sp  = Number(row.sparring_place)  || 0;
  const sf  = Number(row.sparring_fights) || 0;
  const sbp = Number(row.stopball_place)  || 0;
  const sbf = Number(row.stopball_fights) || 0;
  const tp  = Number(row.tuli_place)      || 0;
  const tf  = Number(row.tuli_perfs)      || 0;

  const spts  = sf  * 3   + placeBns(sp,  40, 24, 14);
  const sbpts = sbf * 2.5 + placeBns(sbp, 40, 24, 14);
  const tpts  = tf  * 2   + placeBns(tp,  25, 15,  9);

  let gold = 0, silver = 0, bronze = 0;
  [sp, sbp, tp].forEach(p => {
    if (p === 1) gold++;
    else if (p === 2) silver++;
    else if (p === 3) bronze++;
  });
  const total = gold + silver + bronze;
  let mb = 0;
  if (gold >= 2)                          mb = 55;
  else if (gold === 1 && total === 1)     mb = 30;
  else if (total >= 2)                    mb = 40;
  else if (silver === 1 && total === 1)   mb = 18;
  else if (bronze === 1 && total === 1)   mb = 10;

  const raw = spts + sbpts + tpts + mb;
  return raw > 0 ? (sig * Math.log(raw + 1)).toFixed(2) : '—';
}

// ─── Иконки ──────────────────────────────────────────────────────────────────

const IconTrophy   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M6 9V4h12v5M6 9v6a6 6 0 0 0 12 0V9"/><path d="M12 18v4M9 22h6"/></svg>;
const IconPlus     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IconEdit     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>;
const IconTrash    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
const IconSave     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
const IconDownload = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>;
const IconX        = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconChevron  = ({ up }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: up ? 'rotate(180deg)' : 'none' }}><polyline points="6 9 12 15 18 9"/></svg>;

// ─── Главный компонент ───────────────────────────────────────────────────────

export default function CompetitionsTab({ user, athletes }) {
  /**
   * Props:
   *   user     — текущий пользователь (из Cabinet state)
   *   athletes — список спортсменов (уже загружен в Cabinet)
   */

  const isManager = ['manager', 'admin'].includes(user?.role);
  const isParent  = user?.role === 'parent';
  const isAthlete = user?.role === 'athlete';

  // ── state ──────────────────────────────────────────────────────────────────
  const [view,         setView]        = useState('list');       // 'list' | 'detail' | 'rating'
  const [competitions, setCompetitions]= useState([]);
  const [seasons,      setSeasons]     = useState([]);
  const [selectedSeason, setSelectedSeason] = useState('');
  const [selectedComp, setSelectedComp] = useState(null);       // объект {id, name, ...}
  const [detail,       setDetail]      = useState(null);        // {comp, results}
  const [rows,         setRows]        = useState([]);           // редактируемые строки
  const [rating,       setRating]      = useState([]);
  const [ratingFilter, setRatingFilter]= useState('all');
  const [loading,      setLoading]     = useState(false);
  const [saving,       setSaving]      = useState(false);
  const [showForm,     setShowForm]    = useState(false);
  const [sigTable,     setSigTable]    = useState(SIGNIFICANCE_FALLBACK);

  // Форма создания соревнования
  const [form, setForm] = useState({
    name: '', date: '', location: '', level: 'Местный',
    comp_type: 'Турнир', notes: ''
  });

  // ── Загрузка при монтировании ──────────────────────────────────────────────
  useEffect(() => {
    loadSeasons();
    loadSigTable();
    loadCompetitions();
  }, []);

  useEffect(() => {
    loadCompetitions();
  }, [selectedSeason]);

  // ── API ────────────────────────────────────────────────────────────────────

  const api = useCallback(async (method, url, data) => {
    const token = localStorage.getItem('token');
    const cfg   = { headers: { Authorization: `Bearer ${token}` } };
    if (method === 'get') return axios.get(url, cfg);
    if (method === 'post') return axios.post(url, data, cfg);
    if (method === 'put')  return axios.put(url, data, cfg);
    if (method === 'patch') return axios.patch(url, data, cfg);
    if (method === 'delete') return axios.delete(url, cfg);
  }, []);

  async function loadSeasons() {
    try {
      const res = await api('get', '/api/competitions/seasons');
      setSeasons(res.data);
    } catch {}
  }

  async function loadSigTable() {
    try {
      const res = await api('get', '/api/competitions/significance-table');
      setSigTable(res.data);
    } catch {}
  }

  async function loadCompetitions() {
    setLoading(true);
    try {
      const url = selectedSeason
        ? `/api/competitions?season=${selectedSeason}`
        : '/api/competitions';
      const res = await api('get', url);
      setCompetitions(res.data);
    } catch (e) {
      console.error('Ошибка загрузки соревнований', e);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(comp) {
    setLoading(true);
    try {
      const res = await api('get', `/api/competitions/${comp.id}`);
      const d   = res.data;
      setDetail(d);

      // Готовим строки: все спортсмены клуба, накладываем уже сохранённые результаты
      const existingMap = {};
      (d.results || []).forEach(r => { existingMap[r.athlete_id] = r; });

      const athleteList = isManager
        ? athletes                                     // менеджер видит всех
        : athletes.filter(a =>
            isAthlete ? a.user_id === user.id :
            isParent  ? a.user_id === user.id : false
          );

      const newRows = athleteList.map(a => {
        const ex = existingMap[a.id] || {};
        return {
          athlete_id:      a.id,
          full_name:       a.full_name,
          sparring_place:  ex.sparring_place  ?? '',
          sparring_fights: ex.sparring_fights ?? 0,
          stopball_place:  ex.stopball_place  ?? '',
          stopball_fights: ex.stopball_fights ?? 0,
          tuli_place:      ex.tuli_place      ?? '',
          tuli_perfs:      ex.tuli_perfs      ?? 0,
          _saved_rating:   ex.rating          ?? null,
        };
      });
      setRows(newRows);
      setSelectedComp(comp);
      setView('detail');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveResults() {
    if (!detail) return;
    setSaving(true);
    try {
      const payload = rows
        .filter(r => {
          // Пропускаем строки где вообще ничего не указано
          return r.sparring_place !== '' || r.sparring_fights > 0 ||
                 r.stopball_place !== '' || r.stopball_fights > 0 ||
                 r.tuli_place     !== '' || r.tuli_perfs > 0;
        })
        .map(r => ({
          athlete_id:      r.athlete_id,
          sparring_place:  r.sparring_place  !== '' ? Number(r.sparring_place)  : null,
          sparring_fights: Number(r.sparring_fights) || 0,
          stopball_place:  r.stopball_place  !== '' ? Number(r.stopball_place)  : null,
          stopball_fights: Number(r.stopball_fights) || 0,
          tuli_place:      r.tuli_place      !== '' ? Number(r.tuli_place)      : null,
          tuli_perfs:      Number(r.tuli_perfs) || 0,
        }));

      await api('put', `/api/competitions/${detail.id}/results`, { results: payload });
      await loadDetail(selectedComp);
      alert('Результаты сохранены!');
    } catch (e) {
      alert('Ошибка сохранения');
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function loadRating() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedSeason) params.set('season', selectedSeason);
      const res = await api('get', `/api/competitions/rating/overall?${params}`);
      setRating(res.data);
      setView('rating');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function createCompetition() {
    if (!form.name.trim() || !form.date) {
      alert('Заполните название и дату');
      return;
    }
    try {
      await api('post', '/api/competitions', {
        name:      form.name,
        date:      form.date,
        location:  form.location || null,
        level:     form.level,
        comp_type: form.comp_type,
        notes:     form.notes || null,
      });
      setShowForm(false);
      setForm({ name: '', date: '', location: '', level: 'Местный', comp_type: 'Турнир', notes: '' });
      await loadCompetitions();
      await loadSeasons();
    } catch (e) {
      alert('Ошибка создания');
      console.error(e);
    }
  }

  async function deleteCompetition(id, e) {
    e.stopPropagation();
    if (!window.confirm('Удалить соревнование и все результаты?')) return;
    try {
      await api('delete', `/api/competitions/${id}`);
      await loadCompetitions();
      if (selectedComp?.id === id) { setView('list'); setDetail(null); }
    } catch { alert('Ошибка удаления'); }
  }

  async function exportRating() {
    // Формируем CSV-строку для выгрузки
    const rows_exp = getRatingRows();
    const headers  = ['Место', 'ФИО', 'Группа', 'Гып', 'Пол', 'Турниров', 'Золото', 'Серебро', 'Бронза', 'Рейтинг'];
    const lines    = [headers.join(';')];
    rows_exp.forEach((r, i) => {
      lines.push([
        i + 1, r.full_name, r.group || '', r.gup || '', r.gender || '',
        r.tournaments_count, r.gold, r.silver, r.bronze,
        r.total_rating
      ].join(';'));
    });
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `Рейтинг_Тайпан_${selectedSeason || 'все'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Вычисляемые данные ────────────────────────────────────────────────────

  const getSig = (level, type) =>
    (sigTable[level] || {})[type] || 1.0;

  const formSig = getSig(form.level, form.comp_type);

  function updateRow(athleteId, field, value) {
    setRows(prev => prev.map(r =>
      r.athlete_id === athleteId ? { ...r, [field]: value } : r
    ));
  }

  function getRatingRows() {
    if (ratingFilter === 'all') return rating;
    const field = ratingFilter;
    // Группируем и возвращаем отсортированные подгруппы в плоском массиве с разделителями
    // (для рендера используем отдельный метод)
    return rating;
  }

  function getRatingGroups() {
    if (ratingFilter === 'all') return null;
    const groups = {};
    rating.forEach(r => {
      const key = r[ratingFilter] || 'Не указано';
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return groups;
  }

  // ── Рендер ────────────────────────────────────────────────────────────────

  const typesForLevel = (level) =>
    Object.keys(sigTable[level] || SIGNIFICANCE_FALLBACK[level] || {});

  function renderCompCard(comp) {
    const badgeClass = LEVEL_BADGE[comp.level] || 'comp-badge';
    const isActive   = selectedComp?.id === comp.id && view === 'detail';
    return (
      <div
        key={comp.id}
        className={`comp-card ${isActive ? 'active' : ''}`}
        onClick={() => loadDetail(comp)}
      >
        <div className="comp-card-left">
          <div className="comp-card-name">{comp.name}</div>
          <div className="comp-card-meta">
            <span className="comp-card-date">
              {new Date(comp.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            {comp.location && <span className="comp-card-date">📍 {comp.location}</span>}
            <span className={`comp-badge ${badgeClass}`}>{comp.level}</span>
            <span className="comp-badge">{comp.comp_type}</span>
          </div>
        </div>
        <div className="comp-card-sig">
          {comp.significance}
          <span>значимость</span>
        </div>
        {isManager && (
          <div className="comp-card-actions" onClick={e => e.stopPropagation()}>
            <button
              className="comp-btn comp-btn-danger"
              onClick={e => deleteCompetition(comp.id, e)}
              title="Удалить"
            >
              <IconTrash />
            </button>
          </div>
        )}
      </div>
    );
  }

  function renderDetailTable() {
    if (!detail) return null;
    return (
      <div className="comp-table-wrap">
        <table className="comp-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Спортсмен</th>
              {/* Спарринг */}
              <th colSpan="2">Спарринг</th>
              {/* Стоп-балл */}
              <th colSpan="2">Стоп-балл</th>
              {/* Тули */}
              <th colSpan="2">Тули</th>
              <th>Рейтинг</th>
            </tr>
            <tr>
              <th style={{ textAlign: 'left' }}></th>
              <th>Место</th><th>Бои</th>
              <th>Место</th><th>Бои</th>
              <th>Место</th><th>Выст.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const preview = calcRatingPreview(r, detail.significance || 1);
              return (
                <tr key={r.athlete_id}>
                  <td style={{ fontWeight: 600 }}>{r.full_name}</td>

                  {/* Спарринг */}
                  <td>
                    {isManager ? (
                      <select value={r.sparring_place} onChange={e => updateRow(r.athlete_id, 'sparring_place', e.target.value)}>
                        {PLACE_OPTIONS.map(o => <option key={o.label} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (
                      r._saved_rating !== null ? (r.sparring_place || '—') : '—'
                    )}
                  </td>
                  <td>
                    {isManager ? (
                      <input type="number" min="0" max="99" value={r.sparring_fights}
                        onChange={e => updateRow(r.athlete_id, 'sparring_fights', e.target.value)} />
                    ) : r.sparring_fights || 0}
                  </td>

                  {/* Стоп-балл */}
                  <td>
                    {isManager ? (
                      <select value={r.stopball_place} onChange={e => updateRow(r.athlete_id, 'stopball_place', e.target.value)}>
                        {PLACE_OPTIONS.map(o => <option key={o.label} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (r.stopball_place || '—')}
                  </td>
                  <td>
                    {isManager ? (
                      <input type="number" min="0" max="99" value={r.stopball_fights}
                        onChange={e => updateRow(r.athlete_id, 'stopball_fights', e.target.value)} />
                    ) : r.stopball_fights || 0}
                  </td>

                  {/* Тули */}
                  <td>
                    {isManager ? (
                      <select value={r.tuli_place} onChange={e => updateRow(r.athlete_id, 'tuli_place', e.target.value)}>
                        {PLACE_OPTIONS.map(o => <option key={o.label} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : (r.tuli_place || '—')}
                  </td>
                  <td>
                    {isManager ? (
                      <input type="number" min="0" max="99" value={r.tuli_perfs}
                        onChange={e => updateRow(r.athlete_id, 'tuli_perfs', e.target.value)} />
                    ) : r.tuli_perfs || 0}
                  </td>

                  <td className="comp-rating-cell">
                    {isManager ? preview : (r._saved_rating?.toFixed(2) ?? '—')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  function renderRatingTable(data, startPlace = 1) {
    return (
      <table className="comp-table">
        <thead>
          <tr>
            <th style={{ width: 60 }}>Место</th>
            <th style={{ textAlign: 'left' }}>Спортсмен</th>
            <th>Группа</th>
            <th>Гып</th>
            <th>Медали</th>
            <th>Турниров</th>
            <th>Рейтинг</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => {
            const place = startPlace + i;
            const placeClass =
              place === 1 ? 'comp-place-gold'   :
              place === 2 ? 'comp-place-silver'  :
              place === 3 ? 'comp-place-bronze'  : '';
            return (
              <tr key={r.athlete_id}>
                <td>
                  <span className={`comp-place-cell ${placeClass}`}>
                    {place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : place}
                  </span>
                </td>
                <td style={{ textAlign: 'left', fontWeight: 600 }}>{r.full_name}</td>
                <td>{r.group || '—'}</td>
                <td>{r.gup || '—'}</td>
                <td>
                  <div className="comp-medals-cell">
                    {r.gold   > 0 && <span>🥇{r.gold}</span>}
                    {r.silver > 0 && <span>🥈{r.silver}</span>}
                    {r.bronze > 0 && <span>🥉{r.bronze}</span>}
                    {r.gold + r.silver + r.bronze === 0 && '—'}
                  </div>
                </td>
                <td>{r.tournaments_count}</td>
                <td className="comp-rating-cell">{r.total_rating}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Шапка ── */}
      <div className="comp-header">
        <h2><IconTrophy /> Соревнования</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {isManager && (
            <button className="comp-btn comp-btn-primary" onClick={() => setShowForm(true)}>
              <IconPlus /> Новое соревнование
            </button>
          )}
          <button
            className="comp-btn comp-btn-secondary"
            onClick={loadRating}
          >
            🏆 Рейтинг сезона
          </button>
        </div>
      </div>

      {/* ── Фильтр сезона ── */}
      <div className="comp-filters">
        <select
          className="comp-season-select"
          value={selectedSeason}
          onChange={e => setSelectedSeason(e.target.value)}
        >
          <option value="">Все сезоны</option>
          {seasons.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {view !== 'list' && (
          <button className="comp-btn comp-btn-ghost" onClick={() => { setView('list'); setDetail(null); setSelectedComp(null); }}>
            ← К списку
          </button>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray)' }}>Загрузка…</div>
      )}

      {/* ══ Список соревнований ══════════════════════════════════ */}
      {!loading && view === 'list' && (
        <>
          {competitions.length === 0 ? (
            <div className="comp-empty">
              <IconTrophy />
              <p>Соревнований пока нет{selectedSeason ? ` в ${selectedSeason} году` : ''}.</p>
              {isManager && (
                <button className="comp-btn comp-btn-primary" style={{ marginTop: 16 }} onClick={() => setShowForm(true)}>
                  <IconPlus /> Добавить первое
                </button>
              )}
            </div>
          ) : (
            <div className="comp-list">
              {competitions.map(renderCompCard)}
            </div>
          )}
        </>
      )}

      {/* ══ Детальный вид турнира ════════════════════════════════ */}
      {!loading && view === 'detail' && detail && (
        <div className="comp-detail">
          <div className="comp-detail-header">
            <div>
              <div className="comp-detail-title">{detail.name}</div>
              <div className="comp-card-meta" style={{ marginTop: 4 }}>
                <span className="comp-card-date">
                  {new Date(detail.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                {detail.location && <span className="comp-card-date">📍 {detail.location}</span>}
                <span className={`comp-badge ${LEVEL_BADGE[detail.level] || 'comp-badge'}`}>{detail.level}</span>
                <span className="comp-badge">{detail.comp_type}</span>
                <span style={{ color: 'var(--red)', fontFamily: 'Bebas Neue', fontSize: '1rem' }}>
                  ×{detail.significance}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {isManager && (
                <>
                  <button className="comp-btn comp-btn-primary" onClick={saveResults} disabled={saving}>
                    <IconSave /> {saving ? 'Сохранение…' : 'Сохранить'}
                  </button>
                  <button className="comp-btn comp-btn-ghost" onClick={exportRating} title="Экспорт CSV">
                    <IconDownload />
                  </button>
                </>
              )}
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="comp-empty"><p>Нет спортсменов для отображения.</p></div>
          ) : renderDetailTable()}
        </div>
      )}

      {/* ══ Общий рейтинг ═══════════════════════════════════════ */}
      {!loading && view === 'rating' && (
        <div>
          <div className="comp-rating-header">
            <span style={{ color: 'var(--gray)', fontSize: '0.9rem' }}>
              Фильтр:
            </span>
            {[
              { key: 'all',    label: 'Общий' },
              { key: 'group',  label: 'По группе' },
              { key: 'gender', label: 'По полу' },
              { key: 'gup',    label: 'По гыпу' },
            ].map(f => (
              <button
                key={f.key}
                className={`comp-filter-btn ${ratingFilter === f.key ? 'active' : ''}`}
                onClick={() => setRatingFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
            <button className="comp-btn comp-btn-ghost" onClick={exportRating} title="Экспорт CSV">
              <IconDownload /> CSV
            </button>
          </div>

          {rating.length === 0 ? (
            <div className="comp-empty">
              <p>Результатов пока нет{selectedSeason ? ` за ${selectedSeason} год` : ''}.</p>
            </div>
          ) : ratingFilter === 'all' ? (
            <div className="comp-table-wrap">{renderRatingTable(rating)}</div>
          ) : (
            Object.entries(getRatingGroups() || {}).map(([group, rows_g]) => (
              <div key={group} style={{ marginBottom: 28 }}>
                <div style={{
                  fontFamily: 'Bebas Neue', fontSize: '1.2rem', letterSpacing: '0.06em',
                  color: 'var(--white)', padding: '8px 0 10px 0',
                  borderBottom: '1px solid var(--gray-dim)', marginBottom: 10
                }}>
                  {group}
                </div>
                <div className="comp-table-wrap">{renderRatingTable(rows_g)}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ══ Модальное окно создания соревнования ════════════════ */}
      {showForm && (
        <div className="comp-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="comp-modal" onClick={e => e.stopPropagation()}>
            <h3>Новое соревнование</h3>
            <div className="comp-form-grid">
              <div className="comp-field full-width">
                <label>Название *</label>
                <input
                  type="text"
                  placeholder="Открытое первенство Московской области..."
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="comp-field">
                <label>Дата *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                />
              </div>
              <div className="comp-field">
                <label>Место проведения</label>
                <input
                  type="text"
                  placeholder="Москва, СК «Олимп»"
                  value={form.location}
                  onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                />
              </div>
              <div className="comp-field">
                <label>Уровень</label>
                <select
                  value={form.level}
                  onChange={e => {
                    const newLevel = e.target.value;
                    const types    = typesForLevel(newLevel);
                    setForm(p => ({
                      ...p, level: newLevel,
                      comp_type: types.includes(p.comp_type) ? p.comp_type : types[0]
                    }));
                  }}
                >
                  {LEVELS.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="comp-field">
                <label>Тип</label>
                <select
                  value={form.comp_type}
                  onChange={e => setForm(p => ({ ...p, comp_type: e.target.value }))}
                >
                  {typesForLevel(form.level).map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="comp-field">
                <label>Коэффициент значимости</label>
                <div className="comp-sig-preview">
                  <span style={{ color: 'var(--gray)', fontSize: '0.85rem' }}>
                    {form.level} · {form.comp_type}
                  </span>
                  <span className="sig-val">×{formSig}</span>
                </div>
              </div>
              <div className="comp-field full-width">
                <label>Примечание</label>
                <textarea
                  rows={2}
                  placeholder="Дополнительная информация..."
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="comp-modal-actions">
              <button className="comp-btn comp-btn-ghost" onClick={() => setShowForm(false)}>
                Отмена
              </button>
              <button className="comp-btn comp-btn-primary" onClick={createCompetition}>
                <IconPlus /> Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
