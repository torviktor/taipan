import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import axios from 'axios'
import App from './App'
import './index.css'
import { DEFAULT_TIMEOUT } from './utils/apiFetch'

// У axios по умолчанию таймаута нет: зависший запрос висит вечно, и кнопка
// навсегда остаётся в состоянии загрузки. Задаём глобально, чтобы не зависеть
// от того, вспомнил ли автор конкретного вызова про timeout.
axios.defaults.timeout = DEFAULT_TIMEOUT

// Тихое обновление SW: новый билд активируется молча, без модалки.
const updateSW = registerSW({
  onNeedRefresh() {
    updateSW(true)
  },
  onOfflineReady() {},
})

// Если динамический импорт чанка не загрузился (старая вкладка, чанк удалён
// после деплоя) — перезагружаемся, чтобы свежий SW отдал актуальные ассеты.
window.addEventListener('vite:preloadError', () => {
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
