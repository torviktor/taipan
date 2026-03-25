#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# deploy-club-info.sh — Деплой feature/club-info-updates
# Запуск: cd /opt/taipan && sudo bash deploy-club-info.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -e
echo "═══ Деплой: feature/club-info-updates ═══"

FRONT="frontend/src"

# ── 1. Проверяем что мы в нужной директории ──────────────────────────────────
if [ ! -f "$FRONT/pages/Cabinet.jsx" ]; then
  echo "ОШИБКА: Cabinet.jsx не найден. Запустите из /opt/taipan"
  exit 1
fi

echo "[1/7] Бэкап существующих файлов..."
cp "$FRONT/pages/Cabinet.jsx" "$FRONT/pages/Cabinet.jsx.bak"
cp "$FRONT/App.jsx" "$FRONT/App.jsx.bak"
cp "$FRONT/components/Footer.jsx" "$FRONT/components/Footer.jsx.bak"

# ── 2. Создаём StrategyTab.jsx ───────────────────────────────────────────────
echo "[2/7] Создаём StrategyTab.jsx..."
cat > "$FRONT/pages/StrategyTab.jsx" << 'ENDOFFILE'
// ── ВКЛАДКА «СТРАТЕГИЯ» — кабинет тренера/администратора ─────────────────────
// Хранение: localStorage (ключ taipan_strategy_items)
// TODO: для синхронизации между устройствами — перенести в БД

import { useState, useCallback } from 'react'

const DEFAULT_ITEMS = [
  { id: 's01', text: 'Зарегистрироваться в ЕГРЮЛ как НКО / ИП', category: 'legal', done: false, custom: false },
  { id: 's02', text: 'Открыть расчётный счёт клуба', category: 'legal', done: false, custom: false },
  { id: 's03', text: 'Вступить в региональную федерацию тхэквондо WT', category: 'legal', done: false, custom: false },
  { id: 's04', text: 'Получить лицензию тренера (WT / национальная федерация)', category: 'legal', done: false, custom: false },
  { id: 's05', text: 'Оформить договор аренды зала', category: 'legal', done: false, custom: false },
  { id: 's06', text: 'Разработать и утвердить устав клуба', category: 'legal', done: false, custom: false },
  { id: 's07', text: 'Создать группу ВКонтакте', category: 'digital', done: false, custom: false },
  { id: 's08', text: 'Создать Telegram-канал клуба', category: 'digital', done: false, custom: false },
  { id: 's09', text: 'Настроить Telegram-бот для уведомлений платформы', category: 'digital', done: false, custom: false },
  { id: 's10', text: 'Разместить QR-код для записи на сайте и в зале', category: 'digital', done: false, custom: false },
  { id: 's11', text: 'Создать публичную страницу клуба на 2ГИС', category: 'digital', done: false, custom: false },
  { id: 's12', text: 'Подключить онлайн-оплату взносов (ЮКасса)', category: 'platform', done: false, custom: false },
  { id: 's13', text: 'Запустить PWA-версию сайта (мобильное приложение)', category: 'platform', done: false, custom: false },
  { id: 's14', text: 'Добавить публичный рейтинг на главную страницу', category: 'platform', done: false, custom: false },
  { id: 's15', text: 'Настроить рассылку уведомлений через Telegram-бот', category: 'platform', done: false, custom: false },
  { id: 's16', text: 'Добавить форму обратной связи на сайте', category: 'platform', done: false, custom: false },
  { id: 's17', text: 'Договориться о партнёрстве с 2-3 школами района', category: 'growth', done: false, custom: false },
  { id: 's18', text: 'Провести открытую тренировку для новичков', category: 'growth', done: false, custom: false },
  { id: 's19', text: 'Запустить таргетированную рекламу ВКонтакте', category: 'growth', done: false, custom: false },
  { id: 's20', text: 'Разместить объявления на районных досках / порталах', category: 'growth', done: false, custom: false },
  { id: 's21', text: 'Создать реферальную программу «приведи друга»', category: 'growth', done: false, custom: false },
  { id: 's22', text: 'Организовать выезд на межрегиональный турнир', category: 'sport', done: false, custom: false },
  { id: 's23', text: 'Провести внутриклубный турнир', category: 'sport', done: false, custom: false },
  { id: 's24', text: 'Пригласить судью WT на аттестацию', category: 'sport', done: false, custom: false },
  { id: 's25', text: 'Запустить программу «Чёрный пояс» (дорожная карта до 1 дана)', category: 'sport', done: false, custom: false },
  { id: 's26', text: 'Провести семинар с приглашённым тренером', category: 'sport', done: false, custom: false },
]

const CATEGORIES = [
  { id: 'legal',    label: 'Юридическое и организационное' },
  { id: 'digital',  label: 'Цифровые каналы' },
  { id: 'platform', label: 'Развитие платформы' },
  { id: 'growth',   label: 'Привлечение спортсменов' },
  { id: 'sport',    label: 'Спортивное развитие' },
  { id: 'custom',   label: 'Свои пункты' },
]

const LS_KEY = 'taipan_strategy_items'

function loadItems() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const saved = JSON.parse(raw)
      const savedMap = new Map(saved.map(i => [i.id, i]))
      const merged = DEFAULT_ITEMS.map(d => savedMap.has(d.id) ? { ...d, done: savedMap.get(d.id).done } : d)
      const customItems = saved.filter(i => i.custom)
      return [...merged, ...customItems]
    }
  } catch {}
  return DEFAULT_ITEMS.map(i => ({ ...i }))
}

export default function StrategyTab() {
  const [items, setItems] = useState(loadItems)
  const [newText, setNewText] = useState('')

  const save = useCallback((updated) => {
    setItems(updated)
    localStorage.setItem(LS_KEY, JSON.stringify(updated))
  }, [])

  const toggle = (id) => {
    save(items.map(i => i.id === id ? { ...i, done: !i.done } : i))
  }

  const addCustom = () => {
    const text = newText.trim()
    if (!text) return
    const id = 'c' + Date.now()
    save([...items, { id, text, category: 'custom', done: false, custom: true }])
    setNewText('')
  }

  const removeCustom = (id) => {
    save(items.filter(i => i.id !== id))
  }

  const total = items.length
  const doneCount = items.filter(i => i.done).length
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.05em', color: 'var(--white)', textTransform: 'uppercase' }}>
            Выполнено {doneCount} из {total} пунктов
          </span>
          <span style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '1.6rem', color: pct === 100 ? '#4caf50' : 'var(--red)', letterSpacing: '0.05em' }}>
            {pct}%
          </span>
        </div>
        <div style={{ background: 'var(--dark2)', borderRadius: 4, height: 10, overflow: 'hidden', border: '1px solid var(--gray-dim)' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#4caf50' : 'var(--red)', borderRadius: 4, transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {CATEGORIES.map(cat => {
        const catItems = items.filter(i => i.category === cat.id)
        if (cat.id !== 'custom' && catItems.length === 0) return null
        return (
          <div key={cat.id} style={{ marginBottom: 28 }}>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid var(--gray-dim)' }}>
              {cat.label}
            </div>
            {catItems.map(item => (
              <label key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 0', cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={item.done} onChange={() => toggle(item.id)}
                  style={{ accentColor: 'var(--red)', width: 18, height: 18, marginTop: 2, cursor: 'pointer', flexShrink: 0 }} />
                <span style={{ color: item.done ? 'var(--gray)' : 'var(--white)', textDecoration: item.done ? 'line-through' : 'none', fontSize: '0.95rem', lineHeight: 1.5, transition: 'color 0.15s' }}>
                  {item.text}
                </span>
                {item.custom && (
                  <button onClick={(e) => { e.preventDefault(); removeCustom(item.id) }}
                    style={{ background: 'none', border: 'none', color: 'var(--gray)', cursor: 'pointer', fontSize: '1rem', padding: '0 4px', marginLeft: 'auto', flexShrink: 0, opacity: 0.6 }}
                    title="Удалить">✕</button>
                )}
              </label>
            ))}
            {cat.id === 'custom' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <input type="text" value={newText} onChange={e => setNewText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustom()} placeholder="Новый пункт..."
                  style={{ flex: 1, background: 'var(--dark)', border: '1px solid var(--gray-dim)', color: 'var(--white)', padding: '10px 14px', fontSize: '0.9rem', fontFamily: 'Barlow, sans-serif', borderRadius: 4 }} />
                <button className="btn-outline" onClick={addCustom} style={{ padding: '8px 18px', fontSize: '13px', whiteSpace: 'nowrap' }}>+ Добавить</button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
ENDOFFILE

# ── 3. Создаём InsuranceTab.jsx ──────────────────────────────────────────────
echo "[3/7] Создаём InsuranceTab.jsx..."
cat > "$FRONT/pages/InsuranceTab.jsx" << 'ENDOFFILE'
import { useState, useEffect } from 'react'

function getInsuranceDate(athleteId) {
  try { return localStorage.getItem(`taipan_insurance_${athleteId}`) || '' } catch { return '' }
}

function setInsuranceDateLS(athleteId, date) {
  try {
    if (date) localStorage.setItem(`taipan_insurance_${athleteId}`, date)
    else localStorage.removeItem(`taipan_insurance_${athleteId}`)
  } catch {}
}

function getInsuranceStatus(dateStr) {
  if (!dateStr) return { text: 'Полис не указан', color: 'var(--gray)', icon: false }
  const end = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
  if (diff <= 0) return { text: 'Истекла', color: 'var(--gray)', icon: true, strikethrough: true }
  if (diff <= 30) return { text: `Истекает через ${diff} дн.`, color: 'var(--red)', icon: true }
  return { text: `Активна (осталось ${diff} дн.)`, color: '#4caf50', icon: true }
}

export function InsuranceIndicator({ athleteId }) {
  const dateStr = getInsuranceDate(athleteId)
  const status = getInsuranceStatus(dateStr)
  const formatted = dateStr ? new Date(dateStr).toLocaleDateString('ru-RU') : null
  return (
    <div style={{ fontSize: '0.8rem', color: status.color, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
      {status.icon && <span style={{ width: 7, height: 7, borderRadius: '50%', background: status.color, display: 'inline-block', flexShrink: 0 }} />}
      <span style={{ textDecoration: status.strikethrough ? 'line-through' : 'none' }}>
        Страховка: {formatted ? (status.text.toLowerCase().startsWith('активна') ? 'активна до ' + formatted : status.text.toLowerCase()) : 'не указана'}
      </span>
    </div>
  )
}

export default function InsuranceTab({ myAthletes }) {
  const [dates, setDates] = useState({})
  const [saved, setSaved] = useState({})

  useEffect(() => {
    const initial = {}
    ;(myAthletes || []).forEach(a => { initial[a.id] = getInsuranceDate(a.id) })
    setDates(initial)
    setSaved({})
  }, [myAthletes])

  const handleSave = (athleteId) => {
    setInsuranceDateLS(athleteId, dates[athleteId] || '')
    setSaved(s => ({ ...s, [athleteId]: true }))
    setTimeout(() => setSaved(s => ({ ...s, [athleteId]: false })), 2000)
  }

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '1.6rem', letterSpacing: '0.06em', color: 'var(--white)', marginBottom: 16 }}>СТРАХОВАНИЕ СПОРТСМЕНА</h3>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 8 }}>Зачем нужна страховка</div>
          <p style={{ color: 'var(--gray)', fontSize: '0.92rem', lineHeight: 1.7 }}>Участие в официальных соревнованиях по тхэквондо WT без действующего страхового полиса — невозможно. Это требование федерации, а не рекомендация. Полис оформляется один раз в год и распространяется на все официальные турниры в течение сезона.</p>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 8 }}>Что покрывает полис</div>
          <p style={{ color: 'var(--gray)', fontSize: '0.92rem', lineHeight: 1.7 }}>
            {'\u2014'} Несчастные случаи на тренировках и соревнованиях<br/>
            {'\u2014'} Травмы, полученные в рамках спортивной деятельности<br/>
            {'\u2014'} Медицинские расходы, связанные со спортивной травмой
          </p>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 8 }}>Как оформить</div>
          <p style={{ color: 'var(--gray)', fontSize: '0.92rem', lineHeight: 1.7 }}>Страховка оформляется через официальный портал федерации. Это занимает несколько минут.</p>
        </div>
        <a href="https://xn--80aajoeciepghn7cl4g.xn--p1ai/federation007822-105" target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: 'inline-block', fontSize: '0.9rem', padding: '10px 24px', marginBottom: 20 }}>Оформить полис →</a>
        <div style={{ borderLeft: '3px solid var(--red)', paddingLeft: 16, paddingTop: 10, paddingBottom: 10, background: 'rgba(200,30,30,0.06)', borderRadius: '0 6px 6px 0' }}>
          <p style={{ color: 'var(--white)', fontSize: '0.9rem', lineHeight: 1.6, fontWeight: 600 }}>Оформите страховку до начала соревновательного сезона — не в день турнира.</p>
        </div>
      </div>

      {(!myAthletes || myAthletes.length === 0) ? (
        <div className="cabinet-empty">Нет спортсменов для отображения.</div>
      ) : (
        <div>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 16, paddingBottom: 6, borderBottom: '1px solid var(--gray-dim)' }}>Страховки моих спортсменов</div>
          {myAthletes.map(a => {
            const dateVal = dates[a.id] || ''
            const status = getInsuranceStatus(dateVal)
            return (
              <div key={a.id} style={{ background: 'var(--dark2)', border: '1px solid var(--gray-dim)', borderRadius: 8, padding: '14px 18px', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--white)', letterSpacing: '0.04em' }}>{a.full_name}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--gray)' }}>{a.group || a.auto_group}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--gray)', whiteSpace: 'nowrap' }}>Дата окончания полиса:</span>
                  <input type="date" value={dateVal} onChange={e => setDates(d => ({ ...d, [a.id]: e.target.value }))} className="att-date-input" style={{ width: 'auto' }} />
                  <button className="btn-outline" onClick={() => handleSave(a.id)} style={{ padding: '6px 14px', fontSize: '12px' }}>{saved[a.id] ? 'Сохранено' : 'Сохранить'}</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--gray)', marginRight: 4 }}>Статус:</span>
                  {status.icon && <span style={{ width: 8, height: 8, borderRadius: '50%', background: status.color, display: 'inline-block', flexShrink: 0 }} />}
                  <span style={{ fontSize: '0.85rem', color: status.color, fontWeight: 600, textDecoration: status.strikethrough ? 'line-through' : 'none' }}>{status.text}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
ENDOFFILE

# ── 4. Создаём UsefulTab.jsx ─────────────────────────────────────────────────
echo "[4/7] Создаём UsefulTab.jsx..."
cat > "$FRONT/pages/UsefulTab.jsx" << 'ENDOFFILE'
export default function UsefulTab() {
  return (
    <div>
      <div style={{ marginBottom: 40 }}>
        <h3 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '1.6rem', letterSpacing: '0.06em', color: 'var(--white)', marginBottom: 16 }}>ОФИЦИАЛЬНАЯ ЭКИПИРОВКА</h3>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 8 }}>Почему только Forte</div>
          <p style={{ color: 'var(--gray)', fontSize: '0.92rem', lineHeight: 1.7 }}>Тхэквондо WT — олимпийский вид спорта с жёсткими требованиями к снаряжению. На официальных соревнованиях допускается только сертифицированная экипировка с маркировкой WT. Forte — официальный поставщик, сертифицированный Всемирной федерацией тхэквондо.</p>
          <p style={{ color: 'var(--gray)', fontSize: '0.92rem', lineHeight: 1.7, marginTop: 10 }}>Использование несертифицированной экипировки на турнире означает отстранение от участия. Это не формальность — это условие допуска.</p>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 8 }}>Что входит в обязательный комплект</div>
          <p style={{ color: 'var(--gray)', fontSize: '0.92rem', lineHeight: 1.7 }}>
            {'\u2014'} Добок (форма) с маркировкой WT<br/>
            {'\u2014'} Шлем с сенсорной системой (для соревнований с PSS)<br/>
            {'\u2014'} Жилет с электронными датчиками (PSS-жилет)<br/>
            {'\u2014'} Защита предплечий, голени, паховая защита<br/>
            {'\u2014'} Капа
          </p>
        </div>
        <a href="https://fortec.ru" target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: 'inline-block', fontSize: '0.9rem', padding: '10px 24px', marginBottom: 20 }}>Перейти в магазин Forte →</a>
        <div style={{ borderLeft: '3px solid var(--red)', paddingLeft: 16, paddingTop: 10, paddingBottom: 10, background: 'rgba(200,30,30,0.06)', borderRadius: '0 6px 6px 0' }}>
          <p style={{ color: 'var(--white)', fontSize: '0.9rem', lineHeight: 1.6, fontWeight: 600 }}>Покупайте экипировку заранее — PSS-жилеты под конкретного спортсмена иногда требуют настройки и проверки.</p>
        </div>
      </div>
    </div>
  )
}
ENDOFFILE

# ── 5. Создаём Antidoping.jsx + Antidoping.css ──────────────────────────────
echo "[5/7] Создаём Antidoping..."
cat > "$FRONT/pages/Antidoping.css" << 'ENDOFFILE'
.antidoping-page { min-height: 100vh; background: var(--dark); padding: 120px 0 80px; }
.antidoping-container { max-width: 800px; }
.antidoping-title { font-family: 'Bebas Neue', sans-serif; font-size: 48px; letter-spacing: 6px; color: var(--white); margin-bottom: 8px; }
.antidoping-section { padding: 24px 0; }
.antidoping-h2 { font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--red); margin-bottom: 12px; }
.antidoping-text { color: var(--gray); font-size: 15px; line-height: 1.8; margin-bottom: 12px; }
.antidoping-text:last-child { margin-bottom: 0; }
.antidoping-divider { height: 1px; background: var(--gray-dim); }
.antidoping-accent { border-left: 3px solid var(--red); padding: 12px 16px; margin-top: 16px; background: rgba(200,30,30,0.06); border-radius: 0 6px 6px 0; }
.antidoping-accent p { color: var(--white); font-size: 14px; line-height: 1.7; font-weight: 600; margin: 0; }
.antidoping-buttons { display: flex; gap: 12px; margin-top: 16px; flex-wrap: wrap; }
.antidoping-buttons .btn-outline { font-size: 13px; padding: 10px 20px; }
@media (max-width: 600px) {
  .antidoping-title { font-size: 32px; letter-spacing: 3px; }
  .antidoping-buttons { flex-direction: column; }
  .antidoping-buttons .btn-outline { text-align: center; }
}
ENDOFFILE

cat > "$FRONT/pages/Antidoping.jsx" << 'ENDOFFILE'
import './Antidoping.css'

export default function Antidoping() {
  return (
    <main className="antidoping-page">
      <div className="container antidoping-container">
        <h1 className="antidoping-title">АНТИДОПИНГ В ТХЭКВОНДО</h1>
        <div className="divider" />

        <section className="antidoping-section">
          <h2 className="antidoping-h2">Что такое допинг</h2>
          <p className="antidoping-text">Допинг — применение запрещённых веществ или методов для искусственного улучшения спортивных результатов. В тхэквондо, как в олимпийском виде спорта, действуют правила Всемирного антидопингового агентства (ВАДА) и Кодекс WT.</p>
        </section>
        <div className="antidoping-divider" />

        <section className="antidoping-section">
          <h2 className="antidoping-h2">Кто подпадает под контроль</h2>
          <p className="antidoping-text">Антидопинговые правила распространяются на всех спортсменов, участвующих в официальных соревнованиях WT — включая юниоров и кадетов. Возраст не освобождает от ответственности.</p>
        </section>
        <div className="antidoping-divider" />

        <section className="antidoping-section">
          <h2 className="antidoping-h2">Запрещённые вещества</h2>
          <p className="antidoping-text">Полный список запрещённых веществ публикуется ВАДА ежегодно. Список включает: анаболические стероиды, стимуляторы, гормоны, диуретики, бета-блокаторы, наркотические анальгетики и ряд других.</p>
          <div className="antidoping-accent">
            <p>Некоторые лекарства из свободной продажи (противопростудные, обезболивающие) могут содержать запрещённые вещества. Перед приёмом любого препарата в соревновательный период — консультируйтесь с врачом и проверяйте состав.</p>
          </div>
        </section>
        <div className="antidoping-divider" />

        <section className="antidoping-section">
          <h2 className="antidoping-h2">Что нельзя давать спортсмену без проверки</h2>
          <p className="antidoping-text">Родителям важно знать: следующие категории препаратов требуют проверки перед применением в соревновательный период:</p>
          <p className="antidoping-text">
            — Сосудосуживающие капли и спреи (псевдоэфедрин)<br/>
            — Ряд противовирусных препаратов<br/>
            — Энергетики и предтренировочные комплексы<br/>
            — Некоторые витаминные комплексы с адаптогенами
          </p>
        </section>
        <div className="antidoping-divider" />

        <section className="antidoping-section">
          <h2 className="antidoping-h2">Как проверить препарат</h2>
          <p className="antidoping-text">Официальный сервис проверки: Global DRO (globaldro.com). Российская база: rusada.ru — раздел «Проверка препаратов».</p>
          <div className="antidoping-buttons">
            <a href="https://rusada.ru" target="_blank" rel="noopener noreferrer" className="btn-outline">Проверить препарат на РУСАДА →</a>
            <a href="https://www.globaldro.com" target="_blank" rel="noopener noreferrer" className="btn-outline">Global DRO →</a>
          </div>
        </section>
        <div className="antidoping-divider" />

        <section className="antidoping-section">
          <h2 className="antidoping-h2">Процедура допинг-контроля</h2>
          <p className="antidoping-text">На крупных соревнованиях спортсмен может быть выбран для сдачи пробы. Это стандартная процедура. Спортсмен имеет право: знать причину отбора, иметь представителя при процедуре, задокументировать все принятые препараты в форме допинг-контроля.</p>
          <div className="antidoping-accent">
            <p>Незнание состава препарата не освобождает от ответственности. Проверяйте всё, что принимает спортсмен в период соревнований.</p>
          </div>
        </section>
      </div>
    </main>
  )
}
ENDOFFILE

# ── 6. Патчим Cabinet.jsx ────────────────────────────────────────────────────
echo "[6/7] Патчим Cabinet.jsx..."

CABINET="$FRONT/pages/Cabinet.jsx"

# 6a. Добавить импорты после строки с './Competitions.css'
sed -i "/import '\.\/Competitions\.css'/a\\
import StrategyTab from './StrategyTab'\\
import InsuranceTab, { InsuranceIndicator } from './InsuranceTab'\\
import UsefulTab from './UsefulTab'" "$CABINET"

# 6b. Добавить вкладки Страхование и Полезное в кабинет родителя
# Ищем вкладку «Информация» в кабинете родителя (parentView==='info')
# и вставляем перед ней две новых вкладки
sed -i "s|<button className={\`cabinet-tab \${parentView==='info'?'active':''}\`} style={{color: parentView==='info' ? undefined : 'var(--gray)'}} onClick={() => setParentView('info')}>Информация</button>|<button className={\`cabinet-tab \${parentView==='insurance'?'active':''}\`} onClick={() => setParentView('insurance')}>Страхование</button>\n            <button className={\`cabinet-tab \${parentView==='useful'?'active':''}\`} onClick={() => setParentView('useful')}>Полезное</button>\n            <button className={\`cabinet-tab \${parentView==='info'?'active':''}\`} style={{color: parentView==='info' ? undefined : 'var(--gray)'}} onClick={() => setParentView('info')}>Информация</button>|" "$CABINET"

# 6c. Добавить рендер вкладок Insurance и Useful в родительском кабинете
# После строки с parentView === 'notifications'
sed -i "/{parentView === 'notifications' && <NotificationsTab token={token}\/>}/a\\
          {parentView === 'insurance'     \&\& <InsuranceTab myAthletes={myAthletes}\/>}\\
          {parentView === 'useful'        \&\& <UsefulTab\/>}" "$CABINET"

# 6d. Добавить InsuranceIndicator после BeltDisplay в карточке спортсмена родителя
# Ищем <BeltDisplay gup={a.gup} dan={a.dan}/> в блоке myAthletes.map
# Нужно вставить после этой строки InsuranceIndicator
sed -i '0,/<BeltDisplay gup={a.gup} dan={a.dan}\/>/s|<BeltDisplay gup={a.gup} dan={a.dan}\/>|<BeltDisplay gup={a.gup} dan={a.dan}/>\n                      <InsuranceIndicator athleteId={a.id}/>|' "$CABINET"

# 6e. Добавить вкладку «Стратегия» в кабинет тренера (группа Результаты)
# Вставить кнопку перед «Информация» в группе Результаты админа
# Ищем строку с view==='info' в кабинете админа (это вторая такая строка)
# Используем python для более точного патча
python3 << 'PYEOF'
import re

with open('frontend/src/pages/Cabinet.jsx', 'r') as f:
    content = f.read()

# Добавить кнопку Стратегия перед кнопкой Информация в кабинете админа
# Это вторая группа вкладок (admin), после "Результаты" label
# Ищем паттерн: view==='info' в admin-части (после "Результаты")
admin_info_btn = """<button className={`cabinet-tab ${view==='info'?'active':''}`} style={{color: view==='info' ? undefined : 'var(--gray)'}} onClick={() => setView('info')}>Информация</button>"""
strategy_btn = """<button className={`cabinet-tab ${view==='strategy'?'active':''}`} onClick={() => setView('strategy')}>Стратегия</button>
            <button className={`cabinet-tab ${view==='info'?'active':''}`} style={{color: view==='info' ? undefined : 'var(--gray)'}} onClick={() => setView('info')}>Информация</button>"""

# Заменяем только последнее вхождение (admin, не parent)
# Найдём все вхождения
parts = content.split(admin_info_btn)
if len(parts) >= 3:
    # Третий кусок и дальше — admin часть, заменяем последнее
    content = admin_info_btn.join(parts[:-1]) + strategy_btn + parts[-1]
elif len(parts) == 2:
    # Только одно вхождение — в admin
    content = parts[0] + strategy_btn + parts[1]

# Добавить рендер StrategyTab после InfoTab isAdmin={true}
content = content.replace(
    "{view === 'info'          && <InfoTab isAdmin={true} />}",
    "{view === 'info'          && <InfoTab isAdmin={true} />}\n        {view === 'strategy'      && <StrategyTab />}"
)

# Исключить strategy из toolbar condition
old_toolbar = "view !== 'archive' && ("
new_toolbar = "view !== 'archive' && view !== 'strategy' && view !== 'info' && ("
# Более точный поиск - ищем полное условие
old_cond = "view !== 'camps' && view !== 'archive' && ("
new_cond = "view !== 'camps' && view !== 'archive' && view !== 'strategy' && ("
content = content.replace(old_cond, new_cond, 1)

with open('frontend/src/pages/Cabinet.jsx', 'w') as f:
    f.write(content)

print("  Cabinet.jsx patched successfully")
PYEOF

# ── 7. Патчим App.jsx и Footer.jsx ──────────────────────────────────────────
echo "[7/7] Патчим App.jsx и Footer.jsx..."

APP="$FRONT/App.jsx"
FOOTER="$FRONT/components/Footer.jsx"

# App.jsx: добавить импорт Antidoping
sed -i "/import Privacy from '\.\/pages\/Privacy'/a\\
import Antidoping from './pages/Antidoping'" "$APP"

# App.jsx: добавить роут /antidoping
sed -i '/<Route path="\/privacy"/a\
        <Route path="/antidoping"        element={<Antidoping />} />' "$APP"

# Footer.jsx: добавить ссылку «Антидопинг» после «Личный кабинет»
sed -i '/<Link to="\/cabinet">Личный кабинет<\/Link>/a\
          <Link to="/antidoping">Антидопинг</Link>' "$FOOTER"

# ── Проверка баланса скобок ──────────────────────────────────────────────────
echo ""
echo "═══ Проверка баланса скобок Cabinet.jsx ═══"
node -e "const fs=require('fs');const c=fs.readFileSync('$CABINET','utf8');let d=0;for(const ch of c){if(ch==='{')d++;if(ch==='}')d--;}console.log('depth:',d)"

echo ""
echo "═══ Готово! ═══"
echo "Бэкапы: Cabinet.jsx.bak, App.jsx.bak, Footer.jsx.bak"
echo ""
echo "Для деплоя:"
echo "  sudo docker compose build --no-cache frontend && sudo docker compose up -d frontend"
