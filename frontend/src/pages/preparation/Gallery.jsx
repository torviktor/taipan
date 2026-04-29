import { Link } from 'react-router-dom'
import './Preparation.css'

/**
 * Галерея техники — пока заглушка с одной тестовой карточкой.
 * На этапе 3 сюда добавится 173 элемента и фильтры по разделам.
 */
export default function Gallery() {
  // Временные тестовые данные — будут заменены реальными из БД на этапе 3
  const items = [
    {
      id: 1,
      title: 'Чарёт соги',
      category: 'Стойки',
      description: 'Стойка готовности',
    },
  ]

  return (
    <div className="prep-page">
      <div className="container">
        <Link to="/preparation" className="prep-back-link">← К разделу</Link>

        <h1 className="prep-title">Галерея техники</h1>
        <p className="prep-lead">
          Раздел в разработке. Скоро здесь появится полная галерея техники
          с фильтрами по разделам.
        </p>

        {/* Заглушки фильтров — на будущее */}
        <div className="prep-filters">
          <button className="btn-outline prep-filter-btn prep-filter-active">Все</button>
          <button className="btn-outline prep-filter-btn" disabled>Стойки</button>
          <button className="btn-outline prep-filter-btn" disabled>Удары руками</button>
          <button className="btn-outline prep-filter-btn" disabled>Удары ногами</button>
          <button className="btn-outline prep-filter-btn" disabled>Блоки</button>
          <button className="btn-outline prep-filter-btn" disabled>Тули</button>
        </div>

        <div className="prep-gallery-grid">
          {items.map(item => (
            <div key={item.id} className="prep-gallery-item">
              <div className="prep-gallery-img-placeholder">
                <span>Изображение</span>
              </div>
              <h3 className="prep-gallery-item-title">{item.title}</h3>
              <p className="prep-gallery-item-cat">{item.category}</p>
              <p className="prep-gallery-item-desc">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
