import { useState, useRef, useEffect } from 'react'
import './TaipanGPT.css'

const SUGGESTIONS = [
  'Как записаться на первое занятие?',
  'Какое расписание тренировок?',
  'Сколько стоит абонемент?',
  'С какого возраста берёте детей?',
]

function TIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M4 5h12M10 5v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M2 9l14-7-7 14V9H2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export default function TaipanGPT() {
  const [open,     setOpen]     = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Привет! Я TaipanGPT — помощник клуба тхэквондо «Тайпан». Спрашивай про расписание, запись, группы — отвечу быстро.' }
  ])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [shown,    setShown]    = useState(false)
  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => setShown(true), 3000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      inputRef.current?.focus()
    }
  }, [open, messages])

  const send = async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')

    const userMsg = { role: 'user', content: msg }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)

    const history = newMessages
      .slice(1)
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: history.slice(0, -1) }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Что-то пошло не так. Позвоните нам: +7 (909) 165-28-00' }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Нет связи с сервером. Позвоните: +7 (909) 165-28-00' }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <>
      <button
        className={`taipan-gpt-fab ${shown ? 'shown' : ''} ${open ? 'hidden' : ''}`}
        onClick={() => setOpen(true)}
        aria-label="TaipanGPT — помощник клуба"
      >
        <TIcon />
        <span className="taipan-gpt-fab-label">TaipanGPT</span>
        <span className="taipan-gpt-fab-pulse" />
      </button>

      {open && (
        <div className="taipan-gpt-window">
          <div className="taipan-gpt-header">
            <div className="taipan-gpt-header-info">
              <div className="taipan-gpt-avatar"><TIcon /></div>
              <div>
                <div className="taipan-gpt-name">TaipanGPT</div>
                <div className="taipan-gpt-status">
                  <span className="taipan-gpt-dot" />
                  Помощник клуба «Тайпан»
                </div>
              </div>
            </div>
            <button className="taipan-gpt-close" onClick={() => setOpen(false)}><CloseIcon /></button>
          </div>

          <div className="taipan-gpt-messages">
            {messages.map((m, i) => (
              <div key={i} className={`taipan-gpt-msg taipan-gpt-msg--${m.role}`}>
                {m.role === 'assistant' && (
                  <div className="taipan-gpt-msg-avatar"><TIcon /></div>
                )}
                <div className="taipan-gpt-bubble">{m.content}</div>
              </div>
            ))}
            {loading && (
              <div className="taipan-gpt-msg taipan-gpt-msg--assistant">
                <div className="taipan-gpt-msg-avatar"><TIcon /></div>
                <div className="taipan-gpt-bubble taipan-gpt-typing">
                  <span/><span/><span/>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {messages.length === 1 && (
            <div className="taipan-gpt-suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} className="taipan-gpt-suggestion" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="taipan-gpt-input-row">
            <input
              ref={inputRef}
              type="text"
              placeholder="Напишите вопрос..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
              maxLength={500}
              className="taipan-gpt-input"
            />
            <button
              className="taipan-gpt-send"
              onClick={() => send()}
              disabled={loading || !input.trim()}
            >
              <SendIcon />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
