import { Link } from 'react-router-dom'
import './Coming.css'

export default function GroupKids2() {
  return (
    <main className="coming-page">
      <div className="coming-content">
        <p className="section-label">Наши группы</p>
        <h1 className="coming-title">ДЕТИ 11–16 ЛЕТ</h1>
        <div className="coming-line" />
        <p className="coming-desc">
          Соревновательная подготовка, спарринги.<br/>
          Программа подготовки и расписание занятий появятся здесь совсем скоро.
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/apply" className="btn-primary">Записаться</Link>
          <Link to="/" className="btn-outline">← На главную</Link>
        </div>
      </div>
    </main>
  )
}
