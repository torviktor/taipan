import { useState, useEffect } from 'react'
import './PWAInstallPrompt.css'

const STORAGE_DISMISSED = 'pwa_install_dismissed'
const STORAGE_POSTPONED = 'pwa_install_postponed'
const POSTPONE_MS = 7 * 24 * 60 * 60 * 1000
const SHOW_DELAY_MS = 2000

function detectIos() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return null
  const ua = navigator.userAgent || ''
  const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
  if (!isIos) return null
  const isNonSafari = /CriOS|FxiOS|YaBrowser|OPiOS|EdgiOS/.test(ua)
  return isNonSafari ? 'other' : 'safari'
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true
  if (typeof navigator !== 'undefined' && navigator.standalone) return true
  return false
}

function isSuppressed() {
  try {
    if (localStorage.getItem(STORAGE_DISMISSED) === '1') return true
    const ts = parseInt(localStorage.getItem(STORAGE_POSTPONED) || '0', 10)
    if (ts && Date.now() - ts < POSTPONE_MS) return true
  } catch {
    // localStorage unavailable — treat as not suppressed
  }
  return false
}

function setPostponed() {
  try { localStorage.setItem(STORAGE_POSTPONED, String(Date.now())) } catch {}
}

export default function PWAInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null)
  const [iosKind, setIosKind] = useState(null) // null | 'safari' | 'other'
  const [visible, setVisible] = useState(false)
  const [animatedIn, setAnimatedIn] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isStandalone() || isSuppressed()) return

    const handleBeforeInstall = (e) => {
      e.preventDefault()
      setPromptEvent(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    const handleInstalled = () => {
      setVisible(false)
      setPromptEvent(null)
    }
    window.addEventListener('appinstalled', handleInstalled)

    setIosKind(detectIos())

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  useEffect(() => {
    if (!promptEvent && !iosKind) return
    const t = setTimeout(() => {
      setVisible(true)
      requestAnimationFrame(() => setAnimatedIn(true))
    }, SHOW_DELAY_MS)
    return () => clearTimeout(t)
  }, [promptEvent, iosKind])

  const dismissForever = () => {
    try { localStorage.setItem(STORAGE_DISMISSED, '1') } catch {}
    setVisible(false)
  }

  const postpone = () => {
    setPostponed()
    setVisible(false)
  }

  const install = () => {
    const evt = promptEvent
    if (!evt) return
    // Спрятать баннер немедленно — система покажет свой диалог поверх
    setVisible(false)
    setPromptEvent(null)
    try {
      evt.prompt()
      Promise.resolve(evt.userChoice).then((choice) => {
        if (choice && choice.outcome === 'dismissed') setPostponed()
      }).catch(() => {})
    } catch {
      setPostponed()
    }
  }

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

  if (!visible) return null

  const isAndroid    = !iosKind && !!promptEvent
  const isIosSafari  = iosKind === 'safari'
  const isIosOther   = iosKind === 'other'

  return (
    <div
      className={`pwa-install-prompt${animatedIn ? ' is-in' : ''}${isIosSafari ? ' is-tall' : ''}`}
      role="dialog"
      aria-label="Установить приложение"
    >
      <button
        type="button"
        className="pwa-install-close"
        aria-label="Закрыть и больше не показывать"
        onClick={dismissForever}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      <div className="pwa-install-body">
        <img src="/icons/pwa-192.png" alt="" className="pwa-install-icon" />
        <div className="pwa-install-text">
          <p className="pwa-install-title">
            {isIosOther ? 'Откройте в Safari' : 'Установить приложение'}
          </p>
          <p className="pwa-install-sub">
            {isAndroid   && 'Быстрый доступ к личному кабинету с экрана Домой'}
            {isIosSafari && 'Чтобы добавить иконку на экран Домой:'}
            {isIosOther  && 'Установка приложения работает только в Safari. Скопируйте адрес и откройте через Safari.'}
          </p>
        </div>
      </div>

      {isIosSafari && (
        <>
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
            <button type="button" className="btn-primary pwa-install-btn pwa-install-btn-wide" onClick={postpone}>
              Понятно
            </button>
          </div>
        </>
      )}

      {isAndroid && (
        <div className="pwa-install-actions">
          <button type="button" className="btn-primary pwa-install-btn" onClick={install}>
            Установить
          </button>
          <button type="button" className="btn-outline pwa-install-btn" onClick={postpone}>
            Не сейчас
          </button>
        </div>
      )}

      {isIosOther && (
        <div className="pwa-install-actions">
          <button type="button" className="btn-primary pwa-install-btn" onClick={copyUrl}>
            {copied ? 'Скопировано' : 'Скопировать адрес'}
          </button>
          <button type="button" className="btn-outline pwa-install-btn" onClick={postpone}>
            Закрыть
          </button>
        </div>
      )}
    </div>
  )
}
