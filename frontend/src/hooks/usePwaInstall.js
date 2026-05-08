import { useEffect, useState } from 'react'

let _promptEvent = null
let _isInstalled = false
let _initialized = false
const _subscribers = new Set()

function _notify() {
  _subscribers.forEach((cb) => cb())
}

function detectIos() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return null
  const ua = navigator.userAgent || ''
  const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
  if (!isIos) return null
  const isNonSafari = /CriOS|FxiOS|YaBrowser|OPiOS|EdgiOS/.test(ua)
  return isNonSafari ? 'other' : 'safari'
}

function _initOnce() {
  if (_initialized || typeof window === 'undefined') return
  _initialized = true

  if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) _isInstalled = true
  if (typeof navigator !== 'undefined' && navigator.standalone) _isInstalled = true

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    _promptEvent = e
    _notify()
  })

  window.addEventListener('appinstalled', () => {
    _isInstalled = true
    _promptEvent = null
    _notify()
  })
}

const _iosKind = (typeof window !== 'undefined') ? detectIos() : null

export function usePwaInstall() {
  _initOnce()
  const [, setTick] = useState(0)

  useEffect(() => {
    const cb = () => setTick((t) => t + 1)
    _subscribers.add(cb)
    return () => { _subscribers.delete(cb) }
  }, [])

  const promptInstall = async () => {
    if (_iosKind === 'safari') return 'ios-safari'
    if (_iosKind === 'other') return 'ios-other'
    if (_promptEvent) {
      const evt = _promptEvent
      _promptEvent = null
      _notify()
      try {
        evt.prompt()
        const choice = await evt.userChoice
        return choice && choice.outcome === 'accepted' ? 'accepted' : 'dismissed'
      } catch {
        return 'dismissed'
      }
    }
    return 'dismissed'
  }

  return {
    isInstalled: _isInstalled,
    isInstallable: !!_promptEvent || _iosKind !== null,
    iosKind: _iosKind,
    promptInstall,
  }
}
