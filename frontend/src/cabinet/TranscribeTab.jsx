import { useState, useEffect, useRef } from 'react'
import { API } from './constants'
import { apiFetch } from '../utils/apiFetch'
import ConfirmModal from './ConfirmModal'

const ACTIVE_STATUSES = ['uploaded', 'processing']
const POLL_INTERVAL = 5000

const STATUS_LABEL = {
  uploaded:   'В очереди',
  processing: 'Распознаётся',
  done:       'Готово',
  error:      'Ошибка',
}

export default function TranscribeTab({ token }) {
  const [jobs, setJobs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [confirm, setConfirm]   = useState(null)
  const fileInputRef = useRef(null)
  const h = { Authorization: `Bearer ${token}` }

  useEffect(() => { load() }, [])

  // Поллинг, только пока есть незакрытое задание — как только всё
  // done/error, интервал гасим (в проекте нет общей абстракции поллинга,
  // и заводить её ради одной вкладки не стали, см. задачу 30).
  useEffect(() => {
    if (!jobs.some(j => ACTIVE_STATUSES.includes(j.status))) return
    const interval = setInterval(load, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [jobs])

  async function load() {
    try {
      const r = await apiFetch(`${API}/transcribe/jobs`, { headers: h })
      if (r.ok) setJobs(await r.json())
    } catch {}
    setLoading(false)
  }

  function pickFile() {
    fileInputRef.current?.click()
  }

  function onFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) upload(file)
  }

  function upload(file) {
    setUploadError('')
    setUploading(true)
    setProgress(0)

    // XMLHttpRequest, а не fetch: на гигабайтном файле пользователю нужен
    // виден прогресс — у fetch нет onUploadProgress, у XHR есть.
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API}/transcribe/upload`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      setUploading(false)
      if (xhr.status >= 200 && xhr.status < 300) {
        load()
      } else {
        let msg = 'Не удалось загрузить файл'
        try { msg = JSON.parse(xhr.responseText)?.detail || msg } catch {}
        setUploadError(msg)
      }
    }
    xhr.onerror = () => { setUploading(false); setUploadError('Сбой сети при загрузке') }

    const fd = new FormData()
    fd.append('file', file)
    xhr.send(fd)
  }

  function remove(job) {
    setConfirm({
      message: `Удалить задание «${job.original_name}»?`,
      confirmText: 'Удалить', danger: true,
      onConfirm: async () => {
        setConfirm(null)
        await apiFetch(`${API}/transcribe/jobs/${job.id}`, { method: 'DELETE', headers: h })
        await load()
      }
    })
  }

  function copyText(text) {
    navigator.clipboard?.writeText(text || '').catch(() => {})
  }

  function downloadTxt(job) {
    const blob = new Blob([job.text || ''], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${(job.original_name || 'transcript').replace(/\.[^.]+$/, '')}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const hasActiveJob = jobs.some(j => ACTIVE_STATUSES.includes(j.status))

  if (loading) return <div className="cabinet-loading">Загрузка...</div>

  return (
    <div>
      {confirm && <ConfirmModal message={confirm.message} confirmText={confirm.confirmText} danger={confirm.danger} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)}/>}

      <div style={{ fontFamily:'Bebas Neue', fontSize:'1.7rem', letterSpacing:'0.08em', color:'var(--white)', marginBottom:12, borderBottom:'1px solid var(--gray-dim)', paddingBottom:8 }}>
        Транскрибация совещаний
      </div>
      <div style={{ color:'var(--gray)', fontSize:'0.9rem', lineHeight:1.6, marginBottom:20 }}>
        Загрузите запись совещания — текст появится здесь, когда бот-транскрайбер её обработает.
        Сам файл нигде не хранится, только распознанный текст. Одновременно обрабатывается одно задание.
      </div>

      <input ref={fileInputRef} type="file" accept="audio/*,video/*" style={{ display:'none' }} onChange={onFileChange} />
      <button
        style={{
          fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.9rem', letterSpacing:'0.06em', textTransform:'uppercase',
          background:'var(--red)', color:'var(--white)', border:'none', borderRadius:6, padding:'10px 22px',
          cursor: (uploading || hasActiveJob) ? 'not-allowed' : 'pointer', opacity: (uploading || hasActiveJob) ? 0.5 : 1,
        }}
        disabled={uploading || hasActiveJob}
        onClick={pickFile}
      >
        {uploading ? `Загрузка… ${progress}%` : 'Загрузить запись'}
      </button>
      {hasActiveJob && !uploading && (
        <span style={{ color:'var(--gray)', fontSize:'0.85rem', marginLeft:12 }}>
          Дождитесь завершения текущего задания
        </span>
      )}
      {uploadError && <div style={{ color:'var(--red)', fontSize:'0.88rem', marginTop:10 }}>{uploadError}</div>}

      <div style={{ marginTop:28 }}>
        {jobs.length === 0 ? (
          <div className="cabinet-empty">Заданий пока нет.</div>
        ) : jobs.map(job => (
          <div key={job.id} style={{ background:'var(--dark2)', border:'1px solid var(--gray-dim)', borderRadius:8, padding:'14px 18px', marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, flexWrap:'wrap', gap:8 }}>
              <div>
                <div style={{ color:'var(--white)', fontWeight:600 }}>{job.original_name}</div>
                <div style={{ color:'var(--gray)', fontSize:'0.82rem' }}>
                  {new Date(job.created_at).toLocaleString('ru-RU')}
                  {job.duration_sec != null && ` · ${Math.round(job.duration_sec / 60)} мин`}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{
                  fontFamily:'Barlow Condensed', fontWeight:700, fontSize:'0.8rem', letterSpacing:'0.06em', textTransform:'uppercase',
                  color: job.status === 'error' ? 'var(--red)' : job.status === 'done' ? '#4caf50' : 'var(--gray)',
                }}>
                  {STATUS_LABEL[job.status] || job.status}
                </span>
                <button onClick={() => remove(job)} style={{ background:'transparent', border:'1px solid var(--gray-dim)', color:'var(--gray)', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:'0.8rem' }}>Удалить</button>
              </div>
            </div>

            {job.status === 'error' && job.error && (
              <div style={{ color:'var(--red)', fontSize:'0.86rem' }}>{job.error}</div>
            )}

            {job.status === 'done' && (
              <div>
                <div style={{ whiteSpace:'pre-wrap', color:'var(--gray)', fontSize:'0.9rem', lineHeight:1.6, maxHeight:260, overflowY:'auto', background:'var(--dark)', borderRadius:6, padding:'10px 14px', marginBottom:10 }}>
                  {job.text || '(текст не распознан)'}
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button onClick={() => copyText(job.text)} style={{ background:'transparent', border:'1px solid var(--gray-dim)', color:'var(--white)', borderRadius:6, padding:'6px 14px', cursor:'pointer', fontSize:'0.85rem' }}>Копировать</button>
                  <button onClick={() => downloadTxt(job)} style={{ background:'transparent', border:'1px solid var(--gray-dim)', color:'var(--white)', borderRadius:6, padding:'6px 14px', cursor:'pointer', fontSize:'0.85rem' }}>Скачать .txt</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
