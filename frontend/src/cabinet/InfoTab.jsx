import { useState } from 'react'
import InsuranceTab from '../pages/InsuranceTab'
import StrategyTab from '../pages/StrategyTab'

export default function InfoTab({ isAdmin, token }) {
  const [section, setSection] = useState('rating')

  const SectionBtn = ({ id, label }) => (
    <button
      onClick={() => setSection(id)}
      style={{
        fontFamily: 'Barlow Condensed', fontWeight: 700, fontSize: '0.9rem',
        letterSpacing: '0.08em', textTransform: 'uppercase',
        padding: '9px 20px', borderRadius: 6, cursor: 'pointer',
        background: section === id ? 'var(--red)' : 'transparent',
        color: section === id ? 'var(--white)' : 'var(--gray)',
        border: section === id ? '1px solid var(--red)' : '1px solid var(--gray-dim)',
        transition: 'all 0.15s',
      }}
    >{label}</button>
  )

  const H2 = ({ children }) => (
    <div style={{ fontFamily:'Bebas Neue', fontSize:'1.7rem', letterSpacing:'0.08em', color:'var(--white)', marginTop:32, marginBottom:12, borderBottom:'1px solid var(--gray-dim)', paddingBottom:8 }}>
      {children}
    </div>
  )
  const H3 = ({ children }) => (
    <div style={{ fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'1.05rem', letterSpacing:'0.06em', color:'var(--red)', marginTop:20, marginBottom:8, textTransform:'uppercase' }}>
      {children}
    </div>
  )
  const P = ({ children, style: s }) => (
    <p style={{ color:'var(--gray)', fontSize:'0.95rem', lineHeight:1.7, marginBottom:12, ...s }}>{children}</p>
  )
  const Hl = ({ children }) => (
    <span style={{ color:'var(--white)', fontWeight:600 }}>{children}</span>
  )

  return (
    <div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:28 }}>
        <SectionBtn id="rating"       label="Рейтинг"/>
        <SectionBtn id="achievements" label="Ачивки"/>
        <SectionBtn id="attendance"   label="Посещаемость"/>
        <SectionBtn id="seasons"      label="Сезоны"/>
        <SectionBtn id="equipment"    label="Экипировка"/>
        <SectionBtn id="antidoping"   label="Антидопинг"/>
        {isAdmin && <SectionBtn id="strategy"   label="Стратегия"/>}
        {isAdmin && <SectionBtn id="admin"      label="Памятка тренера"/>}
      </div>

      {/* ── РЕЙТИНГ ── */}
      {section === 'rating' && (
        <div>
          <div style={{ background:'var(--dark2)', border:'1px solid var(--gray-dim)', borderRadius:10, padding:'18px 22px', marginBottom:24 }}>
            <P>Добрый день, уважаемые родители и ученики клуба! Рейтинг помогает определить лучших спортсменов в категории — по возрасту, весу и уровню — по итогам сезона. Мы учитываем не только победы, но и <Hl>активность</Hl> (количество боёв и выступлений), чтобы поощрять старания даже без медалей.</P>
          </div>

          <H2>1. Основная формула</H2>
          <div style={{ background:'#0a0a14', border:'1px solid var(--red)', borderRadius:8, padding:'16px 20px', marginBottom:18, fontFamily:'monospace', fontSize:'1rem', color:'#c8962a' }}>
            Очки = Значимость × ln(Спарринг + Стоп-балл + Тег-тим + Тули + Медали + 1)
          </div>
          <P><Hl>Натуральный логарифм (ln)</Hl> — математическая функция, которая сжимает большие числа, чтобы разница в очках была разумной. Например: если сумма = 10, то ln(11) ≈ 2.4; если 100, то ln(101) ≈ 4.6. Победитель не выглядит «в 10 раз лучше» участника без медалей.</P>

          <H2>2. Значимость турнира</H2>
          <P>Базовый коэффициент, отражающий уровень соревнований. Чем престижнее — тем больше очков за те же достижения.</P>
          <div style={{ overflowX:'auto', marginBottom:18 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.92rem' }}>
              <thead>
                <tr style={{ background:'var(--dark2)' }}>
                  {['Уровень','Турнир','Фестиваль','Первенство','Чемпионат'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', color:'var(--gray)', fontFamily:'Barlow Condensed', letterSpacing:'0.05em', borderBottom:'1px solid var(--gray-dim)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Клубный / Местный',    '1.0–1.5','1.0','—','—'],
                  ['Городской / Региональный','3.0','3.5','4.0','5.0'],
                  ['Окружной',             '5.0',   '5.0','5.5','6.0'],
                  ['Всероссийский',        '7.0',   '7.0','8.0','9.0'],
                  ['Международный',        '10.0',  '10.0','11.0','12.0'],
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom:'1px solid var(--gray-dim)', background: i%2===0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    {row.map((cell, j) => (
                      <td key={j} style={{ padding:'10px 14px', color: j===0 ? 'var(--white)' : 'var(--gray)' }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <H2>3. Очки за дисциплины</H2>
          <H3>Спарринг, Стоп-балл, Тег-тим (контактные)</H3>
          <P>Очки = <Hl>кол-во боёв × 3</Hl> + бонус за место (1-е: +40, 2-е: +24, 3-е: +14). Коэффициент ×3 выше — контактная дисциплина, требует большего мастерства и риска. Бонус только за топ-3.</P>
          <H3>Тули / Хъенг (бесконтактные)</H3>
          <P>Очки = <Hl>кол-во выступлений × 2</Hl> + бонус за место (1-е: +25, 2-е: +15, 3-е: +9). Техническая дисциплина без контакта — коэффициент ×2.</P>
          <H3>Медальный бонус</H3>
          <P>Применяется один раз: 2+ золота → +55, 1 золото + другие медали → +40, 1 золото → +30, 2+ медали (без золота) → +40, 1 серебро → +18, 1 бронза → +10.</P>

          <H2>4. Пример расчёта</H2>
          <P>Всероссийский фестиваль (значимость = 7). Иван: спарринг 4 боя, 1 место; тули 2 выступления, без места; 1 золото.</P>
          <div style={{ background:'var(--dark2)', borderRadius:8, padding:'16px 20px', fontFamily:'monospace', fontSize:'0.92rem', color:'var(--gray)', lineHeight:1.9, marginBottom:18 }}>
            <div>Спарринг = (4 × 3) + 40 = <span style={{color:'#c8962a'}}>52</span></div>
            <div>Тули = (2 × 2) + 0 = <span style={{color:'#c8962a'}}>4</span></div>
            <div>Медали = <span style={{color:'#c8962a'}}>30</span> (1 золото)</div>
            <div>Сумма = 52 + 4 + 30 = <span style={{color:'#c8962a'}}>86</span></div>
            <div>ln(86 + 1) ≈ <span style={{color:'#c8962a'}}>4.465</span></div>
            <div style={{color:'var(--white)', fontWeight:700, marginTop:6}}>Итог = 7 × 4.465 ≈ 31.26 очков</div>
          </div>

          <H2>5. Итоговый рейтинг за сезон</H2>
          <P>Очки за все турниры <Hl>суммируются</Hl>. Рейтинги ведутся отдельно по возрастным категориям: 6–7, 8–9, 10–11, 12–14, 15–17 лет. При равных очках спортсмены делят место.</P>

          <div style={{ margin:'28px 0 4px', padding:'20px 24px', borderTop:'1px solid var(--gray-dim)', borderRight:'1px solid var(--gray-dim)', borderBottom:'1px solid var(--gray-dim)', borderLeft:'3px solid var(--red)', borderRadius:10, background:'var(--dark2)', textAlign:'center' }}>
            <p style={{ fontStyle:'italic', color:'var(--gray)', fontSize:'0.95rem', lineHeight:1.7, margin:0 }}>
              Эта система справедлива и мотивирующая.<br/>
              <span style={{color:'var(--white)'}}>Удачи на турнирах — мы гордимся каждым!</span>
            </p>
          </div>
        </div>
      )}

      {/* ── АЧИВКИ ── */}
      {section === 'achievements' && (
        <div>
          <H2>Система ачивок</H2>
          <P>Ачивки — награды за достижения в клубе. Выдаются автоматически при выполнении условий и обнуляются каждый новый сезон (1 сентября). Всего 18 ачивок трёх уровней редкости.</P>

          <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap' }}>
            {[
              { label:'Обычная',     color:'#888',       desc:'Первые шаги в любой активности' },
              { label:'Редкая',      color:'var(--red)', desc:'Стабильные результаты и участие' },
              { label:'Легендарная', color:'#c8962a',    desc:'Выдающиеся достижения' },
            ].map(t => (
              <div key={t.label} style={{ flex:1, minWidth:140, background:'var(--dark2)', border:`1px solid ${t.color}`, borderRadius:8, padding:'14px 16px' }}>
                <div style={{ fontFamily:'Bebas Neue', color:t.color, fontSize:'1.1rem', marginBottom:4 }}>{t.label}</div>
                <div style={{ color:'var(--gray)', fontSize:'0.88rem' }}>{t.desc}</div>
              </div>
            ))}
          </div>

          <H3>Посещаемость</H3>
          {[
            ['Первый шаг',       'common',    'Первая тренировка в сезоне'],
            ['Стабильный',       'common',    '30 тренировок за сезон'],
            ['Железный',         'rare',      '60 тренировок за сезон'],
            ['Легенда зала',     'legendary', '90 тренировок за сезон'],
            ['Отличник',         'rare',      '100% посещаемость за любой месяц сезона'],
          ].map(([name, tier, cond]) => (
            <div key={name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--gray-dim)', fontSize:'0.92rem' }}>
              <span style={{color: tier==='legendary'?'#c8962a': tier==='rare'?'var(--red)':'var(--white)'}}>{name}</span>
              <span style={{color:'var(--gray)'}}>{cond}</span>
            </div>
          ))}

          <H3>Соревнования</H3>
          {[
            ['Боевое крещение',  'common',    'Первое соревнование в сезоне'],
            ['Медалист',         'rare',      'Любой призовой результат в сезоне'],
            ['Призёр',           'rare',      '1-е место на соревновании в сезоне'],
            ['Многоборец',       'rare',      'Участие в 3+ видах на одном соревновании'],
            ['Турнирный боец',   'rare',      '3 и более соревнований за сезон'],
          ].map(([name, tier, cond]) => (
            <div key={name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--gray-dim)', fontSize:'0.92rem' }}>
              <span style={{color: tier==='legendary'?'#c8962a': tier==='rare'?'var(--red)':'var(--white)'}}>{name}</span>
              <span style={{color:'var(--gray)'}}>{cond}</span>
            </div>
          ))}

          <H3>Аттестация</H3>
          {[
            ['Новый пояс',    'common', 'Прошёл аттестацию в сезоне'],
            ['Двойной рост',  'rare',   'Повысил пояс дважды за сезон'],
          ].map(([name, tier, cond]) => (
            <div key={name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--gray-dim)', fontSize:'0.92rem' }}>
              <span style={{color: tier==='rare'?'var(--red)':'var(--white)'}}>{name}</span>
              <span style={{color:'var(--gray)'}}>{cond}</span>
            </div>
          ))}

          <H3>Сборы</H3>
          {[
            ['Полевой боец',    'common', 'Участие в спортивных сборах в сезоне'],
            ['Ветеран сборов',  'rare',   '2 и более сборов за сезон'],
          ].map(([name, tier, cond]) => (
            <div key={name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--gray-dim)', fontSize:'0.92rem' }}>
              <span style={{color: tier==='rare'?'var(--red)':'var(--white)'}}>{name}</span>
              <span style={{color:'var(--gray)'}}>{cond}</span>
            </div>
          ))}

          <H3>Комбо и мета-ачивки</H3>
          {[
            ['Полное комбо',            'legendary', 'Соревнование + аттестация + сборы в одном сезоне'],
            ['Коллекционер',            'common',    '5 ачивок за сезон'],
            ['Охотник за наградами',    'rare',      '10 ачивок за сезон'],
            ['Абсолютный чемпион',      'legendary', '15 ачивок за сезон'],
          ].map(([name, tier, cond]) => (
            <div key={name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid var(--gray-dim)', fontSize:'0.92rem' }}>
              <span style={{color: tier==='legendary'?'#c8962a': tier==='rare'?'var(--red)':'var(--white)'}}>{name}</span>
              <span style={{color:'var(--gray)'}}>{cond}</span>
            </div>
          ))}

          <div style={{ margin:'28px 0 4px', padding:'20px 24px', borderTop:'1px solid var(--gray-dim)', borderRight:'1px solid var(--gray-dim)', borderBottom:'1px solid var(--gray-dim)', borderLeft:'3px solid var(--red)', borderRadius:10, background:'var(--dark2)', textAlign:'center' }}>
            <p style={{ fontStyle:'italic', color:'var(--gray)', fontSize:'0.95rem', lineHeight:1.7, margin:0 }}>
              Ачивки начисляются автоматически и обнуляются каждый сезон 1 сентября — стремитесь собрать все 18!
            </p>
          </div>
        </div>
      )}

      {/* ── ПОСЕЩАЕМОСТЬ ── */}
      {section === 'attendance' && (
        <div>
          <H2>Журнал посещаемости</H2>
          <P>Посещаемость фиксируется тренером после каждой тренировки. В клубе три группы, однако на практике старшая группа и взрослые часто занимаются совместно — у взрослых небольшой состав и нерегулярное расписание.</P>

          <H3>Группы</H3>
          {[
            ['Младшая группа',  '6–10 лет',  'Базовые техники, игровые упражнения, развитие координации и ловкости'],
            ['Старшая группа',  '11–17 лет', 'Углублённая техника, соревновательная подготовка, работа в парах'],
            ['Взрослые',        '18+ лет',   'Самостоятельная программа; группа номинально существует и при небольшом составе совмещается со старшей'],
          ].map(([name, age, desc]) => (
            <div key={name} style={{ background:'var(--dark2)', border:'1px solid var(--gray-dim)', borderRadius:8, padding:'14px 18px', marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontFamily:'Barlow Condensed', fontWeight:700, color:'var(--white)', fontSize:'1rem' }}>{name}</span>
                <span style={{ color:'var(--red)', fontSize:'0.9rem' }}>{age}</span>
              </div>
              <div style={{ color:'var(--gray)', fontSize:'0.9rem' }}>{desc}</div>
            </div>
          ))}

          <H3>Как читать статистику</H3>
          <P><Hl>70% и выше</Hl> — отличный показатель. <Hl>50–70%</Hl> — средний уровень. <Hl>Ниже 50%</Hl> — стоит уделить тренировкам больше внимания.</P>
          <P>График по месяцам показывает динамику посещаемости — можно отследить периоды активности и пропусков по каждому спортсмену.</P>

          <div style={{ margin:'28px 0 4px', padding:'20px 24px', borderTop:'1px solid var(--gray-dim)', borderRight:'1px solid var(--gray-dim)', borderBottom:'1px solid var(--gray-dim)', borderLeft:'3px solid var(--red)', borderRadius:10, background:'var(--dark2)', textAlign:'center' }}>
            <p style={{ fontStyle:'italic', color:'var(--gray)', fontSize:'0.95rem', lineHeight:1.7, margin:0 }}>
              Регулярные тренировки — основа успеха в тхэквондо.<br/>
              <span style={{color:'var(--white)'}}>Каждое занятие приближает вас к новым достижениям!</span>
            </p>
          </div>
        </div>
      )}

      {/* ── СЕЗОНЫ ── */}
      {section === 'seasons' && (
        <div>
          <H2>Спортивные сезоны</H2>
          <P>В клубе используется <Hl>спортивный сезон</Hl>, который начинается в сентябре и заканчивается в августе следующего года. Например, сезон 2025/2026 — с 1 сентября 2025 по 31 августа 2026. Это стандарт для спортивных клубов — совпадает с учебным годом и удобен для планирования турниров и аттестаций.</P>

          <H3>Фильтрация по сезонам</H3>
          <P>Во всех вкладках кабинета (соревнования, рейтинг, посещаемость, аттестация, сборы, ачивки) есть фильтр по сезону. По умолчанию показывается <Hl>текущий сезон</Hl>. Переключитесь на «Все сезоны» чтобы увидеть полную историю.</P>

          <H3>Итоги сезона</H3>
          <P>В конце каждого сезона подводятся итоги: определяются лучшие спортсмены по рейтингу в каждой возрастной категории, вручаются награды и ачивки. Лучшие попадают в Зал Славы клуба.</P>

          <div style={{ margin:'28px 0 4px', padding:'20px 24px', borderTop:'1px solid var(--gray-dim)', borderRight:'1px solid var(--gray-dim)', borderBottom:'1px solid var(--gray-dim)', borderLeft:'3px solid var(--red)', borderRadius:10, background:'var(--dark2)', textAlign:'center' }}>
            <p style={{ fontStyle:'italic', color:'var(--gray)', fontSize:'0.95rem', lineHeight:1.7, margin:0 }}>
              Новый сезон — новые цели и новые возможности.
            </p>
          </div>
        </div>
      )}

            {section === 'insurance' && isAdmin && (<InsuranceTab token={token} />)}

      {section === 'strategy' && isAdmin && (<StrategyTab token={token} />)}


      {/* ── СТРАХОВАНИЕ ── */}
      {section === 'insurance' && (
        <div>
          <div style={{ fontFamily:'Bebas Neue', fontSize:'1.7rem', letterSpacing:'0.08em', color:'var(--white)', marginTop:0, marginBottom:12, borderBottom:'1px solid var(--gray-dim)', paddingBottom:8 }}>Страхование спортсменов</div>
          <P>Спортивное страхование от несчастных случаев — обязательное условие допуска к соревнованиям <Hl>ГТФ России</Hl>. Страховой полис оформляется на каждого спортсмена индивидуально и должен покрывать период проведения соревнования.</P>
          <div style={{ background:'var(--dark)', borderLeft:'3px solid var(--red)', padding:'16px 20px', marginBottom:16 }}>
            <div style={{ fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.78rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--red)', marginBottom:8 }}>Требования ФТР ГТФ</div>
            <div style={{ color:'var(--gray)', fontSize:'0.9rem', lineHeight:1.7 }}>
              {[
                'Полис оформляется на каждого спортсмена индивидуально',
                'Период страхования должен покрывать дату соревнования',
                'Полис предъявляется при регистрации на соревнование или сбор',
                'Допуск без действующего полиса не осуществляется',
              ].map((item, i) => (
                <div key={i} style={{ display:'flex', gap:10, marginBottom:6 }}>
                  <span style={{ color:'var(--red)', flexShrink:0 }}>—</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:20 }}>
            <a href="https://спортстрахование.рф/federation007822-105" target="_blank" rel="noopener noreferrer"
              style={{ display:'inline-block', background:'var(--red)', color:'var(--white)', fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.9rem', letterSpacing:'0.08em', textTransform:'uppercase', padding:'10px 22px', textDecoration:'none' }}>
              Оформить страховку онлайн
            </a>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:2, marginBottom:16 }}>
            {[
              { title:'Федерация ТКД ГТФ России', desc:'Официальный сайт, документы, правила', url:'https://rusgtf.ru' },
              { title:'Памятка для родителей', desc:'PDF — подготовка к соревнованиям и сборам', url:'https://rusgtf.ru/wp-content/uploads/2025/12/Памятка-для-родителей-по-подготовке-к-соревнованиям-и-сборам.pdf' },
            ].map(link => (
              <a key={link.title} href={link.url} target="_blank" rel="noopener noreferrer"
                style={{ display:'block', background:'var(--dark)', padding:'14px 18px', textDecoration:'none', borderBottom:'2px solid transparent', transition:'border-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderBottomColor='var(--red)'}
                onMouseLeave={e => e.currentTarget.style.borderBottomColor='transparent'}>
                <div style={{ fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.92rem', letterSpacing:'0.04em', textTransform:'uppercase', color:'var(--white)', marginBottom:3 }}>{link.title}</div>
                <div style={{ color:'var(--gray)', fontSize:'0.82rem' }}>{link.desc}</div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── ЭКИПИРОВКА ── */}
      {section === 'equipment' && (
        <div>
          <div style={{ fontFamily:'Bebas Neue', fontSize:'1.7rem', letterSpacing:'0.08em', color:'var(--white)', marginTop:0, marginBottom:12, borderBottom:'1px solid var(--gray-dim)', paddingBottom:8 }}>Экипировка тхэквондо ГТФ</div>

          {/* Добок */}
          <div style={{ background:'var(--dark)', borderLeft:'3px solid var(--red)', padding:'18px 22px', marginBottom:14 }}>
            <div style={{ fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.9rem', letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--white)', marginBottom:8 }}>Добок — форма тхэквондо ГТФ</div>
            <P>Добок — это не просто спортивная форма, это символ чистоты намерений и равенства всех практикующих. Белый цвет добока в традиции боевых искусств означает чистоту духа, открытость к обучению и отсутствие предрассудков. Одевая добок, спортсмен мысленно оставляет за порогом зала всё лишнее и сосредотачивается на пути совершенствования.</P>
            <P>Добок для тхэквондо ГТФ производится в России компанией <Hl>ООО «ФОРТЭК»</Hl> и соответствует стандартам, утверждённым ОСОО «Российская Ассоциация тхэквондо (ГТФ)». Покрой соответствует корейским традициям: куртка на завязках, штаны на резинке со шнурком — лёгкость и прочность одновременно. <Hl>Пояс в комплект не входит</Hl> и заказывается отдельно.</P>
          </div>

          {/* Почему только Фортек */}
          <div style={{ background:'var(--dark)', borderLeft:'3px solid #c8962a', padding:'18px 22px', marginBottom:14 }}>
            <div style={{ fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.9rem', letterSpacing:'0.06em', textTransform:'uppercase', color:'#c8962a', marginBottom:8 }}>Почему в федерации только Fortek Sport</div>
            <P>ФТР ГТФ России официально утвердила <Hl>Fortek Sport</Hl> как единственного поставщика сертифицированной экипировки для соревнований федерации. Это гарантирует соответствие добоков и защитного снаряжения единым стандартам, принятым в GTF — как по качеству пошива, так и по цветовым требованиям к перчаткам и футам (красный/синий). На официальных соревнованиях допускается только сертифицированная экипировка.</P>
            <a href="https://fortek-sport.ru/" target="_blank" rel="noopener noreferrer"
              style={{ display:'inline-block', background:'var(--red)', color:'var(--white)', fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.88rem', letterSpacing:'0.1em', textTransform:'uppercase', padding:'10px 22px', textDecoration:'none', marginTop:8 }}>
              Перейти в магазин Fortek Sport
            </a>
          </div>

          {/* Защитная экипировка */}
          <div style={{ fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.88rem', letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--white)', marginBottom:10, marginTop:4 }}>Комплект защитной экипировки GTF</div>
          <div style={{ display:'flex', flexDirection:'column', gap:2, marginBottom:14 }}>
            {[
              ['Капа', 'Рекомендуются термопластичные одинарные капы — фиксируются на верхнем ряду зубов, не затрудняют дыхание и речь. Двойные капы обеспечивают максимальную защиту, но сложнее в использовании.'],
              ['Шлем', 'Закрывает теменную и лобную часть, фиксируется ремешком на подбородке. Должен сидеть плотно, но не давить. Обязателен для всех возрастных категорий.'],
              ['Перчатки', 'В GTF — красного или синего цвета с закрытыми пальцами. Вес до 10 унций в зависимости от весовой категории спортсмена.'],
              ['Футы', 'Накладки из пенного материала красного или синего цвета, закрывают подъём стопы и пятку. Обязательны на спаррингах.'],
              ['Щитки для ног', 'Дополнительная защита голени при необходимости — по требованию организаторов соревнований.'],
              ['Бандаж (защита паха)', 'Эластичный бандаж, защищающий область паха от случайных ударов. Есть мужской и женский варианты.'],
              ['Защита грудной клетки', 'Обязательна для девочек на соревнованиях.'],
            ].map(([name, desc]) => (
              <div key={name} style={{ background:'var(--dark)', padding:'12px 16px', borderBottom:'1px solid var(--gray-dim)' }}>
                <span style={{ color:'var(--white)', fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.9rem', textTransform:'uppercase', display:'block', marginBottom:3 }}>{name}</span>
                <span style={{ color:'var(--gray)', fontSize:'0.86rem', lineHeight:1.6 }}>{desc}</span>
              </div>
            ))}
          </div>

          <div style={{ padding:'14px 18px', borderLeft:'3px solid #c8962a', background:'var(--dark)', fontSize:'0.88rem', color:'var(--gray)', lineHeight:1.7 }}>
            <span style={{ color:'#c8962a', fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.75rem', letterSpacing:'0.12em', textTransform:'uppercase', display:'block', marginBottom:4 }}>Важно</span>
            Перед покупкой уточните у тренера — требования к экипировке могут отличаться в зависимости от возраста ребёнка и предстоящих соревнований.
          </div>
        </div>
      )}

      {/* ── АНТИДОПИНГ ── */}
      {section === 'antidoping' && (
        <div>
          <div style={{ fontFamily:'Bebas Neue', fontSize:'1.7rem', letterSpacing:'0.08em', color:'var(--white)', marginTop:0, marginBottom:12, borderBottom:'1px solid var(--gray-dim)', paddingBottom:8 }}>Антидопинг</div>

          <P>Чистый спорт — основа честной конкуренции. <Hl>Федерация тхэквондо ГТФ России</Hl> ведёт системную антидопинговую работу со спортсменами, тренерами и родителями. Знание антидопинговых правил защищает вашего ребёнка от случайных нарушений.</P>

          {/* Зачем это знать родителям */}
          <div style={{ background:'var(--dark)', borderLeft:'3px solid var(--red)', padding:'18px 22px', marginBottom:14 }}>
            <div style={{ fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.78rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--red)', marginBottom:10 }}>Зачем это знать родителям</div>
            <P style={{ marginBottom:8 }}>Многие привычные лекарства — от насморка, кашля, аллергии — могут содержать запрещённые вещества. Именно родители обычно дают ребёнку препараты, не подозревая, что это может стать нарушением антидопинговых правил. <Hl>Незнание правил не освобождает от ответственности</Hl> — ответственность за здоровье и «чистоту» спортсмена несут и он сам, и его тренер, и родители.</P>
            <P style={{ margin:0 }}>Перед любым соревнованием проверяйте все принимаемые препараты на сайте РУСАДА. Это занимает 2 минуты и может уберечь от серьёзных последствий.</P>
          </div>

          {/* С какого возраста */}
          <div style={{ background:'var(--dark)', borderLeft:'3px solid var(--red)', padding:'18px 22px', marginBottom:14 }}>
            <div style={{ fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.78rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--red)', marginBottom:10 }}>С какого возраста актуально</div>
            <P style={{ marginBottom:8 }}><Hl>С любого возраста участия в соревнованиях.</Hl> Формально допинг-контроль проводится с юношеского уровня (обычно с 14–16 лет), однако антидопинговое образование рекомендуется начинать значительно раньше. РУСАДА рекомендует вводить антидопинговое просвещение с <Hl>12 лет</Hl> — именно тогда дети начинают активнее участвовать в соревнованиях.</P>
            <P style={{ margin:0 }}>До 12 лет ответственность полностью лежит на родителях — они должны контролировать все препараты, которые получает ребёнок в период соревнований.</P>
          </div>

          {/* Горячая линия */}
          <div style={{ background:'var(--dark)', borderLeft:'3px solid var(--red)', padding:'14px 18px', marginBottom:16 }}>
            <div style={{ fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.78rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'var(--red)', marginBottom:6 }}>Горячая линия РУСАДА</div>
            <div style={{ color:'var(--gray)', fontSize:'0.9rem' }}>По всем вопросам антидопинга: <a href="tel:+74992717761" style={{ color:'var(--white)', textDecoration:'none' }}>+7 (499) 271-77-61</a></div>
          </div>

          {/* Ссылки */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:2, marginBottom:20 }}>
            {[
              { title:'Проверка препаратов', desc:'list.rusada.ru', url:'http://list.rusada.ru/', bg:'var(--red)' },
              { title:'Онлайн-обучение РУСАДА', desc:'Курсы и тесты для спортсменов', url:'https://www.rusada.ru/education/online-training/', bg:'var(--dark)' },
              { title:'Антидопинг ФТР ГТФ', desc:'Официальная страница федерации', url:'https://rusgtf.ru/antidoping/', bg:'var(--dark)' },
            ].map(link => (
              <a key={link.title} href={link.url} target="_blank" rel="noopener noreferrer"
                style={{ background:link.bg, color:'var(--white)', padding:'16px 20px', textDecoration:'none', display:'block', border: link.bg !== 'var(--red)' ? '1px solid var(--gray-dim)' : 'none' }}>
                <div style={{ fontFamily:'Bebas Neue', fontSize:'1rem', letterSpacing:'0.06em', marginBottom:4 }}>{link.title}</div>
                <div style={{ fontSize:'0.8rem', color: link.bg === 'var(--red)' ? 'rgba(255,255,255,0.85)' : 'var(--gray)' }}>{link.desc}</div>
              </a>
            ))}
          </div>

          {/* Документы */}
          <div style={{ fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.88rem', letterSpacing:'0.06em', textTransform:'uppercase', color:'var(--white)', marginBottom:10 }}>Документы ФТР ГТФ</div>
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {[
              ['Запрещённый список 2026','https://rusgtf.ru/wp-content/uploads/2025/12/Запрещенный-список-2026.pdf'],
              ['Разрешённый список 2026 (ФМБА)','https://rusgtf.ru/wp-content/uploads/2026/02/Разрешенный-список-ФМБА-2026.pdf'],
              ['Памятка для родителей','https://rusgtf.ru/wp-content/uploads/2025/12/Памятка-для-родителей.pdf'],
              ['Памятка для спортсменов (права)','https://rusgtf.ru/wp-content/uploads/2025/12/Памятка-по-правам-спортсменов.pdf'],
              ['Важные вопросы о допинге','https://rusgtf.ru/wp-content/uploads/2025/12/Важные-вопросы-о-допинге.pdf'],
              ['Процедура допинг-контроля','https://rusgtf.ru/wp-content/uploads/2025/12/Процедура-допинг-контроля.pdf'],
            ].map(([title, url]) => (
              <a key={title} href={url} target="_blank" rel="noopener noreferrer"
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 14px', background:'var(--dark)', borderBottom:'1px solid var(--gray-dim)', textDecoration:'none', transition:'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background='var(--dark2)'}
                onMouseLeave={e => e.currentTarget.style.background='var(--dark)'}>
                <span style={{ color:'var(--white)', fontSize:'0.88rem' }}>{title}</span>
                <span style={{ color:'var(--red)', fontSize:'0.78rem', fontFamily:'Barlow Condensed', fontWeight:700 }}>PDF</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── ПАМЯТКА ТРЕНЕРА ── */}
      {section === 'admin' && isAdmin && (
        <div>
          <H2>Памятка тренера</H2>

          <H3>Соревнования — полный цикл</H3>
          <P><Hl>Создание:</Hl> нажмите «+ Соревнование», заполните название, дату, место, уровень и тип. При создании система автоматически добавляет всех активных спортсменов в список участников со статусом «Ожидает» и рассылает уведомления всем родителям.</P>
          <P><Hl>Опрос участников:</Hl> родители получают уведомление и отвечают «Участвую» / «Не участвую» прямо из личного кабинета. Ответы мгновенно отображаются в карточке соревнования — спортсмены разбиты на три блока: «Участвуют», «Ожидают ответа», «Не участвуют».</P>
          <P><Hl>Результаты:</Hl> после турнира заполните места и количество боёв/выступлений для каждого участника. Нажмите «Сохранить» — рейтинг пересчитается автоматически, ачивки начислятся тем, кто их заработал.</P>
          <P><Hl>Оплата взноса:</Hl> отметьте галочкой «Взнос» напротив каждого участника. Это только для вашего учёта, родителям не отображается.</P>

          <H3>Сборы — полный цикл</H3>
          <P><Hl>Создание:</Hl> нажмите «+ Сборы», укажите название, даты, место и стоимость. Все спортсмены добавляются автоматически, родители получают уведомление.</P>
          <P><Hl>Опрос участников:</Hl> аналогично соревнованиям — родители отвечают «Еду» / «Не еду». Список в карточке сборов обновляется автоматически каждые 15 секунд — можно не обновлять страницу вручную.</P>
          <P><Hl>Добавление участника вручную:</Hl> кнопка «+ Участник» — можно добавить спортсмена, если родитель не ответил, но договорились лично.</P>
          <P><Hl>Экспорт:</Hl> кнопка «Экспорт xlsx» формирует два листа: полный список и только едущие — удобно для передачи организаторам.</P>

          <H3>Аттестация — полный цикл</H3>
          <P><Hl>Создание:</Hl> нажмите «+ Аттестация», укажите название и дату. Добавьте участников через кнопку «+ Добавить».</P>
          <P><Hl>Уведомление:</Hl> нажмите «Уведомить» — родители участников получат уведомление о предстоящей аттестации. Уведомление отправляется только по вашему запросу, не автоматически.</P>
          <P><Hl>Завершение:</Hl> заполните результаты (новый гып или дан), нажмите «Завершить аттестацию» — гыпы спортсменов обновятся автоматически, ачивки начислятся сразу.</P>

          <H3>Уведомления</H3>
          <P>Уведомления отправляются автоматически при создании соревнований и сборов. Для аттестаций — только по кнопке «Уведомить». Родители видят все уведомления в разделе «Уведомления» личного кабинета и могут ответить прямо оттуда. Непрочитанные уведомления отмечаются счётчиком на вкладке.</P>

          <H3>Журнал посещаемости</H3>
          <P>Нажмите «+ Новая тренировка», выберите дату и группу, отметьте присутствующих. После сохранения ачивки за посещаемость начисляются автоматически. История тренировок фильтруется по сезону — выберите нужный сезон в верхнем фильтре.</P>

          <H3>Архив спортсменов</H3>
          <P>Спортсмен в архиве не отображается в списках посещаемости, соревнований и рейтинга. При архивировании система спросит, нужно ли также заблокировать кабинет родителя. Восстановить спортсмена и родителя можно в любой момент из вкладки «Архив».</P>

          <H3>Календарь</H3>
          <P>При создании соревнования можно поставить галочку «Добавить в календарь» — событие автоматически появится в общем календаре клуба на главной странице сайта. Это удобно для информирования всех участников и гостей сайта о предстоящих турнирах.</P>

          <H3>Новости клуба</H3>
          <P>Вкладка <Hl>«Новости»</Hl> находится в разделе <Hl>«События»</Hl>. В ней три блока автоматических новостей — по соревнованиям, аттестациям и сборам — и кнопки ручного создания.</P>
          <P><Hl>Автоновости о событиях:</Hl> система автоматически определяет, прошло ли событие по дате. Если событие ещё не состоялось — новость будет анонсом. Если уже прошло — репортажем с результатами. Если событие сегодня — система спросит, завершилось ли оно.</P>
          <P>У каждого события две кнопки: <Hl>«Стандартная»</Hl> — формирует новость автоматически из данных системы, быстро и бесплатно. <Hl>«YandexGPT»</Hl> — генерирует живой уникальный текст на основе тех же данных, каждый раз разный.</P>
          <P>Опубликованные события исчезают из списка автоновостей — повторная публикация заблокирована.</P>
          <P><Hl>Анонс соревнований</Hl> — кнопка в шапке вкладки. Генерирует через YandexGPT анонс всех соревнований на ближайшие две недели.</P>
          <P><Hl>Ручная новость</Hl> — кнопка «+ Новость». Можно написать любой текст и прикрепить фото.</P>
          <P><Hl>Редактирование</Hl> — кнопка «Ред.» у каждой новости в списке. Можно исправить заголовок, текст и заменить или удалить фото.</P>

          <H3>Технические вопросы</H3>
          <P>По всем техническим вопросам, связанным с работой сайта, обращайтесь к <Hl>системному администратору</Hl>.</P>

          <div style={{ margin:'28px 0 4px', padding:'20px 24px', borderTop:'1px solid var(--gray-dim)', borderRight:'1px solid var(--gray-dim)', borderBottom:'1px solid var(--gray-dim)', borderLeft:'3px solid var(--red)', borderRadius:10, background:'var(--dark2)', textAlign:'center' }}>
            <p style={{ fontStyle:'italic', color:'var(--gray)', fontSize:'0.95rem', lineHeight:1.7, margin:0 }}>
              Система создана для того, чтобы вы тратили меньше времени на администрирование<br/>
              <span style={{color:'var(--white)'}}>и больше — на тренировки.</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
