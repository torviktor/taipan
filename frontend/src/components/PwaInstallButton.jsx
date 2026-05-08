import { useState } from 'react'
import { usePwaInstall } from '../hooks/usePwaInstall'
import PwaIosGuide from './PwaIosGuide'
import './PWAInstallPrompt.css'

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="11" height="11" rx="1" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M7 4 L7 9 M4.5 6.5 L7 9 L9.5 6.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export default function PwaInstallButton({ variant = 'mobile' }) {
  const { isInstalled, isInstallable, promptInstall } = usePwaInstall()
  const [modalKind, setModalKind] = useState(null)

  if (isInstalled) return null
  if (!isInstallable) return null

  const handleClick = async (e) => {
    e.preventDefault()
    const result = await promptInstall()
    if (result === 'ios-safari') setModalKind('safari')
    else if (result === 'ios-other') setModalKind('other')
    // 'accepted' / 'dismissed' — нативный диалог уже отработал
  }

  const closeModal = () => setModalKind(null)

  return (
    <>
      <button
        type="button"
        className={`pwa-install-link pwa-install-link--${variant}`}
        onClick={handleClick}
      >
        <DownloadIcon />
        <span>Установить приложение</span>
      </button>

      {modalKind && (
        <div
          className="pwa-install-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Установить приложение"
          onClick={closeModal}
        >
          <div className="pwa-install-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="pwa-install-close"
              aria-label="Закрыть"
              onClick={closeModal}
            >
              <CloseIcon />
            </button>
            <PwaIosGuide kind={modalKind} onClose={closeModal} />
          </div>
        </div>
      )}
    </>
  )
}
