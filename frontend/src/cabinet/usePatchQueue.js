import { useEffect, useRef, useState } from 'react'

// Per-athlete batched PATCH queue for competition matrix autosave.
// One in-flight PATCH per athleteId at a time; new fields accumulate while a
// flush is pending. Replaces the old PUT-based "Сохранить" button + localStorage
// drafts. MIGRATION 2025-05-03 (commit 2/3).
//
// API:
//   const { enqueue, status, retryFailed } = usePatchQueue({
//     apiBase, compId, token,
//     onSuccess: (updatedResult) => {...},   // applies _result_out from server
//     onError:   (athleteId, fields, err) => {...},
//   })
//
//   enqueue(athleteId, { field: value, ... }, { immediate: true|false })
//     immediate=true bypasses the 700 ms debounce (use for toggles).
//
//   status: 'idle' | 'saving' | 'saved' | 'error'
//     'saved' auto-fades to 'idle' after 2 s.
//   retryFailed(): re-enqueues all failed payloads (immediate=true).

const DEBOUNCE_MS = 700
const SAVED_FADE_MS = 2000

export function usePatchQueue({ apiBase, compId, token, onSuccess, onError }) {
  const queueRef    = useRef(new Map())  // athleteId -> { fields, timer, compId }
  const inFlightRef = useRef(new Map())  // athleteId -> Promise (serialization guard)
  const failedRef   = useRef([])         // [{ athleteId, compId, fields }]
  const compIdRef   = useRef(compId)
  const isMountedRef = useRef(true)
  const [status, setStatus] = useState('idle')

  useEffect(() => { compIdRef.current = compId }, [compId])

  const recomputeStatus = () => {
    if (!isMountedRef.current) return
    if (failedRef.current.length > 0) { setStatus('error'); return }
    if (inFlightRef.current.size > 0 || queueRef.current.size > 0) { setStatus('saving'); return }
    setStatus(prev => prev === 'saving' ? 'saved' : prev)
  }

  const flush = (athleteId) => {
    const entry = queueRef.current.get(athleteId)
    if (!entry || Object.keys(entry.fields).length === 0) return
    if (inFlightRef.current.has(athleteId)) return // already running for this athlete

    const fields = entry.fields
    const cId    = entry.compId
    queueRef.current.delete(athleteId)
    if (entry.timer) clearTimeout(entry.timer)

    const promise = (async () => {
      try {
        const r = await fetch(`${apiBase}/competitions/${cId}/results/${athleteId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(fields),
        })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const updated = await r.json()
        if (onSuccess) onSuccess(updated)
      } catch (e) {
        failedRef.current.push({ athleteId, compId: cId, fields })
        if (onError) onError(athleteId, fields, e)
      } finally {
        inFlightRef.current.delete(athleteId)
        const next = queueRef.current.get(athleteId)
        if (next && Object.keys(next.fields).length > 0) {
          // New changes accumulated during the in-flight request — flush again.
          flush(athleteId)
        } else {
          recomputeStatus()
        }
      }
    })()
    inFlightRef.current.set(athleteId, promise)
    recomputeStatus()
  }

  const enqueue = (athleteId, fields, opts = {}) => {
    const immediate = !!opts.immediate
    const cId = compIdRef.current
    if (!cId) return

    const existing = queueRef.current.get(athleteId) || { fields: {}, timer: null, compId: cId }
    Object.assign(existing.fields, fields)
    existing.compId = cId

    if (existing.timer) { clearTimeout(existing.timer); existing.timer = null }
    queueRef.current.set(athleteId, existing)

    // Serialization: never start a second PATCH for the same athlete.
    // If one is already in flight, accumulate; the finally block will re-flush.
    if (inFlightRef.current.has(athleteId)) {
      recomputeStatus()
      return
    }

    if (immediate) {
      flush(athleteId)
    } else {
      existing.timer = setTimeout(() => flush(athleteId), DEBOUNCE_MS)
      recomputeStatus()
    }
  }

  const retryFailed = () => {
    const failed = failedRef.current
    failedRef.current = []
    recomputeStatus()
    failed.forEach(({ athleteId, fields }) => enqueue(athleteId, fields, { immediate: true }))
  }

  // Unmount cleanup: clear timers; in-flight requests resolve naturally
  // (their setStatus calls are guarded by isMountedRef).
  useEffect(() => () => {
    isMountedRef.current = false
    queueRef.current.forEach(e => e.timer && clearTimeout(e.timer))
    queueRef.current.clear()
  }, [])

  useEffect(() => {
    if (status !== 'saved') return
    const t = setTimeout(() => { if (isMountedRef.current) setStatus('idle') }, SAVED_FADE_MS)
    return () => clearTimeout(t)
  }, [status])

  return { enqueue, status, retryFailed }
}
