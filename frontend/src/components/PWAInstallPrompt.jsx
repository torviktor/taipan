import { useState, useEffect } from 'react'
import { usePwaInstall } from '../hooks/usePwaInstall'
import PwaIosGuide from './PwaIosGuide'
import './PWAInstallPrompt.css'

const STORAGE_DISMISSED = 'pwa_install_dismissed'
const STORAGE_POSTPONED = 'pwa_install_postponed'
const POSTPONE_MS = 7 * 24 * 60 * 60 * 1000
const SHOW_DELAY_MS = 2000

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
  const { isInstalled, isInstallable, iosKind, promptInstall } = usePwaInstall()
  const [visible, setVisible] = useState(false)
  const [animatedIn, setAnimatedIn] = useState(false)

  useEffect(() => {
    if (isInstalled || isSuppressed()) return
    if (!isInstallable) return
    const t = setTimeout(() => {
      setVisible(true)
      requestAnimationFrame(() => setAnimatedIn(true))
    }, SHOW_DELAY_MS)
    return () => clearTimeout(t)
  }, [isInstalled, isInstallable])

  useEffect(() => {
    if (isInstalled) setVisible(false)
  }, [isInstalled])

  const dismissForever = () => {
    try { localStorage.setItem(STORAGE_DISMISSED, '1') } catch {}
    setVisible(false)
  }

  const postpone = () => {
    setPostponed()
    setVisible(false)
  }

  const handleAndroidInstall = async () => {
    setVisible(false) // спрятать баннер немедленно — система покажет свой диалог поверх
    const result = await promptInstall()
    if (result === 'dismissed') setPostponed()
  }

  if (!visible) return null

  const isAndroid   = !iosKind
  const isIosSafari = iosKind === 'safari'
  const isIosOther  = iosKind === 'other'

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

      {isAndroid && (
        <>
          <div className="pwa-install-body">
            <img src="/icons/pwa-192.png" alt="" className="pwa-install-icon" />
            <div className="pwa-install-text">
              <p className="pwa-install-title">Установить приложение</p>
              <p className="pwa-install-sub">Быстрый доступ к личному кабинету с экрана Домой</p>
            </div>
          </div>
          <div className="pwa-install-actions">
            <button type="button" className="btn-primary pwa-install-btn" onClick={handleAndroidInstall}>
              Установить
            </button>
            <button type="button" className="btn-outline pwa-install-btn" onClick={postpone}>
              Не сейчас
            </button>
          </div>
        </>
      )}

      {(isIosSafari || isIosOther) && (
        <PwaIosGuide kind={iosKind} onClose={postpone} />
      )}
    </div>
  )
}
