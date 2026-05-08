import { useState } from 'react'

export default function PwaIosGuide({ kind, onClose }) {
  const [copied, setCopied] = useState(false)

  const copyUrl = async () => {
    const url = (typeof window !== 'undefined' && window.location && window.location.origin) || 'https://taipan-tkd.ru'
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // navigator.clipboard может быть недоступен — молча игнорируем
    }
  }

  if (kind === 'safari') {
    return (
      <>
        <div className="pwa-install-body">
          <img src="/icons/pwa-192.png" alt="" className="pwa-install-icon" />
          <div className="pwa-install-text">
            <p className="pwa-install-title">Установить приложение</p>
            <p className="pwa-install-sub">Чтобы добавить иконку на экран Домой:</p>
          </div>
        </div>

        <div className="pwa-install-guide" aria-hidden="true">
          <svg className="pwa-install-guide-svg" viewBox="0 0 280 160" xmlns="http://www.w3.org/2000/svg">
            <text x="140" y="14" textAnchor="middle" className="ig-label" fontSize="11">
              НАЖМИТЕ ЗДЕСЬ
            </text>
            <path d="M 140 22 L 140 68" className="ig-pointer" strokeWidth="1.5" />
            <path d="M 134 62 L 140 70 L 146 62" className="ig-pointer" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />

            <rect x="10" y="80" width="260" height="60" rx="8" className="ig-bar" strokeWidth="1" />

            <g transform="translate(36, 110)">
              <path d="M 6 -8 L -6 0 L 6 8" className="ig-dim" strokeWidth="1.5" />
            </g>
            <g transform="translate(88, 110)">
              <path d="M -6 -8 L 6 0 L -6 8" className="ig-dim" strokeWidth="1.5" />
            </g>

            <rect x="126" y="96" width="28" height="28" rx="4" className="ig-highlight" strokeWidth="1.5" />

            <g transform="translate(140, 110)">
              <path d="M 0 -8 L 0 6" className="ig-share" strokeWidth="1.5" />
              <path d="M -4 -4 L 0 -8 L 4 -4" className="ig-share" strokeWidth="1.5" />
              <path d="M -7 -2 L -7 8 L 7 8 L 7 -2" className="ig-share" strokeWidth="1.5" />
            </g>

            <g transform="translate(192, 110)">
              <path d="M -5 -8 L -5 8 L 0 4 L 5 8 L 5 -8 Z" className="ig-dim" strokeWidth="1.5" />
            </g>

            <g transform="translate(244, 110)">
              <rect x="-7" y="-6" width="10" height="10" rx="1.5" className="ig-dim" strokeWidth="1.5" />
              <rect x="-3" y="-3" width="10" height="10" rx="1.5" className="ig-dim ig-tab-front" strokeWidth="1.5" />
            </g>
          </svg>
        </div>

        <ol className="pwa-install-steps">
          <li className="pwa-install-step">
            <span className="pwa-install-step-num">1</span>
            <span className="pwa-install-step-text">Нажмите кнопку «Поделиться» внизу экрана</span>
          </li>
          <li className="pwa-install-step">
            <span className="pwa-install-step-num">2</span>
            <span className="pwa-install-step-text">Прокрутите меню и выберите «На экран „Домой“»</span>
          </li>
          <li className="pwa-install-step">
            <span className="pwa-install-step-num">3</span>
            <span className="pwa-install-step-text">Нажмите «Добавить» в правом верхнем углу</span>
          </li>
        </ol>

        <div className="pwa-install-actions">
          <button type="button" className="btn-primary pwa-install-btn pwa-install-btn-wide" onClick={onClose}>
            Понятно
          </button>
        </div>
      </>
    )
  }

  if (kind === 'other') {
    return (
      <>
        <div className="pwa-install-body">
          <img src="/icons/pwa-192.png" alt="" className="pwa-install-icon" />
          <div className="pwa-install-text">
            <p className="pwa-install-title">Откройте в Safari</p>
            <p className="pwa-install-sub">
              Установка приложения работает только в Safari. Скопируйте адрес и откройте через Safari.
            </p>
          </div>
        </div>

        <div className="pwa-install-actions">
          <button type="button" className="btn-primary pwa-install-btn" onClick={copyUrl}>
            {copied ? 'Скопировано' : 'Скопировать адрес'}
          </button>
          <button type="button" className="btn-outline pwa-install-btn" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </>
    )
  }

  return null
}
