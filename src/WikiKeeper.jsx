import { useState, useRef, useEffect } from 'react'
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

const ADMIN_USERNAME = 'speep'

export function isAdmin(user) {
  return user?.displayName === ADMIN_USERNAME
}

// Parse a <wiki_action> block out of Claude's response if present
function parseWikiAction(text) {
  const match = text.match(/<wiki_action>\s*([\s\S]*?)\s*<\/wiki_action>/)
  if (!match) return null
  try { return JSON.parse(match[1]) } catch { return null }
}

// Strip the <wiki_action> block from displayed text
function stripWikiAction(text) {
  return text.replace(/<wiki_action>[\s\S]*?<\/wiki_action>/, '').trim()
}

export default function WikiKeeper({ articles, user, onArticleChanged }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      if (messages.length === 0) {
        setMessages([{
          role: 'assistant',
          text: 'The candles are lit. The inkwells are full. What does the Library require of me this evening, Archivist-in-Chief?',
          ts: Date.now(),
        }])
      }
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const slugify = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const executeAction = async (action) => {
    const id = action.id || slugify(action.title)
    // Try exact ID match first, then fall back to matching by title
    const existing = articles[id] ||
      Object.values(articles).find(a => a.title.toLowerCase() === action.title.toLowerCase())
    const finalId = existing ? existing.id : id
    const articleData = {
      id: finalId,
      title: action.title,
      category: action.category || existing?.category || 'Lore & History',
      subtitle: action.subtitle !== undefined ? action.subtitle : (existing?.subtitle || ''),
      infobox: action.infobox !== undefined ? action.infobox : (existing?.infobox || {}),
      content: action.content !== undefined ? action.content : (existing?.content || ''),
      portrait: existing?.portrait || '',
      updatedAt: serverTimestamp(),
      updatedBy: 'Archivist Mnemovex',
      ...(existing ? {} : { createdAt: serverTimestamp() }),
    }
    await setDoc(doc(db, 'articles', finalId), articleData)
    await addDoc(collection(db, 'changelog'), {
      action: existing ? 'edited' : 'created',
      articleTitle: action.title,
      summary: 'Written by Archivist Mnemovex',
      userName: 'Archivist Mnemovex',
      userId: 'wiki-keeper',
      timestamp: serverTimestamp(),
    })
    onArticleChanged?.(finalId)
    return existing ? 'edited' : 'created'
  }

  const send = async (overrideText) => {
    const text = (overrideText ?? input).trim()
    if (!text || loading) return
    setInput('')

    const userMsg = { role: 'user', text, ts: Date.now() }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setLoading(true)

    // Convert to Anthropic message format
    const apiMessages = nextMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.role === 'assistant' ? (m.rawText || m.text) : m.text }))

    try {
      const res = await fetch('/api/keeper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, articles }),
      })
      const data = await res.json()
      const rawText = data.content?.[0]?.text || '(No response.)'
      const action = parseWikiAction(rawText)
      const displayText = stripWikiAction(rawText)

      if (action) {
        setPendingAction(action)
        setMessages(prev => [...prev, {
          role: 'assistant',
          text: displayText,
          rawText,
          ts: Date.now(),
          pendingAction: action,
        }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', text: displayText, rawText, ts: Date.now() }])
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: `*A quill snaps. An inkwell overturns.* (Error: ${err.message})`, ts: Date.now() }])
    }
    setLoading(false)
  }

  const confirmAction = async () => {
    if (!pendingAction) return
    setLoading(true)
    try {
      const result = await executeAction(pendingAction)
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `*The quill scratches across parchment. A new entry takes its place in the stacks.* Article **${pendingAction.title}** has been ${result} in the Library.`,
        ts: Date.now(),
        isConfirmation: true,
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `*The ink runs. Something has gone wrong.* (${err.message})`,
        ts: Date.now(),
      }])
    }
    setPendingAction(null)
    setLoading(false)
  }

  const dismissAction = () => {
    setPendingAction(null)
    setMessages(prev => [...prev, {
      role: 'assistant',
      text: '*Very well. The parchment is set aside. What else?*',
      ts: Date.now(),
    }])
  }

  if (!isAdmin(user)) return null

  return (
    <>
      {/* Floating toggle button */}
      <button onClick={() => setOpen(o => !o)}
        title="Wiki Keeper"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 200,
          width: 52, height: 52, borderRadius: '50%',
          background: open ? '#1b4f72' : '#2c3e50',
          border: '2px solid #4a6fa5', cursor: 'pointer',
          boxShadow: '0 4px 18px rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.4rem', transition: 'background 0.2s',
        }}>
        {open ? '✕' : '📜'}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 86, right: 24, zIndex: 199,
          width: 380, height: 520,
          background: '#1a1a2e', border: '1px solid #4a6fa5',
          borderRadius: 8, display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          fontFamily: "'Source Serif 4', Georgia, serif",
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid #2a3a5a',
            background: '#141428',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: '1.1rem' }}>📜</span>
            <div>
              <div style={{ color: '#c8b87a', fontFamily: "'IM Fell English', serif", fontSize: '0.95rem', fontWeight: 600 }}>
                Archivist Mnemovex
              </div>
              <div style={{ color: '#6a7fa5', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Neverending Library · Wiki Keeper
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: loading ? '#f5a623' : '#4caf50',
              boxShadow: `0 0 6px ${loading ? '#f5a623' : '#4caf50'}`,
            }} />
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '88%', padding: '8px 12px', borderRadius: 8,
                  fontSize: '0.84rem', lineHeight: 1.6,
                  background: m.role === 'user' ? '#1b4f72' : m.isConfirmation ? '#1a3a1a' : '#252540',
                  color: m.role === 'user' ? '#e8f0ff' : '#c8c0b0',
                  border: m.role === 'user' ? 'none' : m.isConfirmation ? '1px solid #2d5a2d' : '1px solid #2a3a5a',
                  fontStyle: m.role === 'assistant' ? 'normal' : 'normal',
                }}>
                  {/* Render simple markdown-ish: **bold** and *italic* */}
                  {m.text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((chunk, ci) => {
                    if (chunk.startsWith('**') && chunk.endsWith('**'))
                      return <strong key={ci}>{chunk.slice(2,-2)}</strong>
                    if (chunk.startsWith('*') && chunk.endsWith('*'))
                      return <em key={ci}>{chunk.slice(1,-1)}</em>
                    return chunk
                  })}
                </div>
                {/* Pending action confirmation buttons */}
                {m.pendingAction && pendingAction && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button onClick={confirmAction} disabled={loading}
                      style={{ padding: '5px 14px', border: 'none', borderRadius: 4, background: '#2e7d32', color: '#fff', cursor: 'pointer', fontSize: '0.78rem', fontFamily: "'Source Serif 4', Georgia, serif" }}>
                      ✓ Commit to the Library
                    </button>
                    <button onClick={dismissAction} disabled={loading}
                      style={{ padding: '5px 10px', border: '1px solid #4a3a3a', borderRadius: 4, background: 'none', color: '#a08080', cursor: 'pointer', fontSize: '0.78rem', fontFamily: "'Source Serif 4', Georgia, serif" }}>
                      Discard
                    </button>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6a7fa5', fontSize: '0.8rem', fontStyle: 'italic' }}>
                <span style={{ animation: 'none' }}>✦</span> The Archivist considers…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #2a3a5a', background: '#141428', display: 'flex', gap: 8 }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Speak to the Archivist…"
              disabled={loading}
              style={{
                flex: 1, padding: '7px 10px',
                background: '#252540', border: '1px solid #2a3a5a', borderRadius: 4,
                color: '#c8c0b0', fontSize: '0.84rem',
                fontFamily: "'Source Serif 4', Georgia, serif",
                outline: 'none',
              }} />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              style={{
                padding: '7px 14px', border: 'none', borderRadius: 4,
                background: input.trim() && !loading ? '#1b4f72' : '#2a3a5a',
                color: '#fff', cursor: input.trim() && !loading ? 'pointer' : 'default',
                fontSize: '0.82rem', fontFamily: "'Source Serif 4', Georgia, serif",
                transition: 'background 0.15s',
              }}>
              Send
            </button>
          </div>
        </div>
      )}
    </>
  )
}
