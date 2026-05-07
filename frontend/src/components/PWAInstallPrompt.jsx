import { useState, useEffect } from 'react'
import './PWAInstallPrompt.css'

const STORAGE_DISMISSED = 'pwa_install_dismissed'
const STORAGE_POSTPONED = 'pwa_install_postponed'
const POSTPONE_MS = 7 * 24 * 60 * 60 * 1000
const SHOW_DELAY_MS = 2000

function isIosSafari() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
  if (!isIos) return false
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return isSafari
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

export default function PWAInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null)
  const [showIos, setShowIos] = useState(false)
  const [visible, setVisible] = useState(false)
  const [animatedIn, setAnimatedIn] = useState(false)

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

    if (isIosSafari()) setShowIos(true)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  useEffect(() => {
    if (!promptEvent && !showIos) return
    const t = setTimeout(() => {
      setVisible(true)
      requestAnimationFrame(() => setAnimatedIn(true))
    }, SHOW_DELAY_MS)
    return () => clearTimeout(t)
  }, [promptEvent, showIos])

  const dismissForever = () => {
    try { localStorage.setItem(STORAGE_DISMISSED, '1') } catch {}
    setVisible(false)
  }

  const postpone = () => {
    try { localStorage.setItem(STORAGE_POSTPONED, String(Date.now())) } catch {}
    setVisible(false)
  }

  const install = async () => {
    if (!promptEvent) return
    try {
      promptEvent.prompt()
      const choice = await promptEvent.userChoice
      if (choice && choice.outcome === 'accepted') {
        setVisible(false)
        setPromptEvent(null)
      }
    } catch {
      // ignore — баннер останется, пользователь сможет закрыть вручную
    }
  }

  if (!visible) return null

  return (
    <div className={`pwa-install-prompt${animatedIn ? ' is-in' : ''}`} role="dialog" aria-label="Установить приложение">
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
          <p className="pwa-install-title">Установить приложение</p>
          <p className="pwa-install-sub">
            {showIos && !promptEvent
              ? 'Нажмите кнопку «Поделиться» внизу экрана и выберите «На экран Домой»'
              : 'Быстрый доступ к личному кабинету с экрана Домой'}
          </p>
        </div>
      </div>

      {!showIos && promptEvent && (
        <div className="pwa-install-actions">
          <button type="button" className="btn-primary pwa-install-btn" onClick={install}>
            Установить
          </button>
          <button type="button" className="btn-outline pwa-install-btn" onClick={postpone}>
            Не сейчас
          </button>
        </div>
      )}

      {showIos && !promptEvent && (
        <div className="pwa-install-actions">
          <button type="button" className="btn-outline pwa-install-btn pwa-install-btn-wide" onClick={postpone}>
            Понятно
          </button>
        </div>
      )}
    </div>
  )
}
