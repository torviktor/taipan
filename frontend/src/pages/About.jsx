import { Link } from 'react-router-dom'
import './Coming.css'

export default function About() {
  return (
    <main className="coming-page">
      <div className="coming-content">
        <p className="section-label">Скоро</p>
        <h1 className="coming-title">О КЛУБЕ</h1>
        <div className="coming-line" />
        <p className="coming-desc">
          Здесь появится подробная информация о клубе, его истории,
          философии и методах подготовки спортсменов.
        </p>
        <Link to="/" className="btn-outline">← На главную</Link>
      </div>
    </main>
  )
}
