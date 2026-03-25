import { useState, useRef, useEffect } from 'react'
import { doc, setDoc, addDoc, getDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

const ADMIN_USERNAME = 'speep'
const HISTORY_DOC = 'keeper_history/speep'

export function isAdmin(user) {
  return user?.displayName === ADMIN_USERNAME
}

// Parse wiki action blocks — supports single <wiki_action> and multi <wiki_actions>
// Returns an array of action objects, or null if none found, or [{_parseError}] on failure
function parseWikiAction(text) {
  // Try multi-action format first
  const multiMatch = text.match(/<wiki_actions>\s*([\s\S]*?)\s*<\/wiki_actions>/)
  if (multiMatch) {
    try {
      const parsed = JSON.parse(multiMatch[1])
      return Array.isArray(parsed) ? parsed : [parsed]
    } catch(e) {
      try {
        const fixed = multiMatch[1].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')
        const parsed = JSON.parse(fixed)
        return Array.isArray(parsed) ? parsed : [parsed]
      } catch {}
      return [{ _parseError: true, _raw: multiMatch[1].slice(0, 120), _message: e.message }]
    }
  }
  // Fall back to single action
  const match = text.match(/<wiki_action>\s*([\s\S]*?)\s*<\/wiki_action>/)
  if (!match) return null
  try {
    return [JSON.parse(match[1])]
  } catch (e) {
    try { return [JSON.parse(match[1].replace(/,\s*}/, '}').replace(/,\s*]/, ']'))] } catch {}
    return [{ _parseError: true, _raw: match[1].slice(0, 120), _message: e.message }]
  }
}

function stripWikiAction(text) {
  return text
    .replace(/<wiki_actions>[\s\S]*?<\/wiki_actions>/, '')
    .replace(/<wiki_action>[\s\S]*?<\/wiki_action>/, '')
    .trim()
}

export default function WikiKeeper({ articles, user, onArticleChanged }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])   // display messages
  const [history, setHistory] = useState([])     // raw Anthropic-format history
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [pendingActions, setPendingActions] = useState(null)  // array of actions or null
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Load conversation history from Firestore on mount
  useEffect(() => {
    if (!isAdmin(user)) return
    getDoc(doc(db, HISTORY_DOC)).then(snap => {
      if (snap.exists()) {
        const data = snap.data()
        setHistory(data.history || [])
        setMessages(data.display || [])
      } else {
        // First ever open — set greeting
        setMessages([{
          role: 'assistant',
          text: 'The candles are lit. The inkwells are full. What does the Library require of me this evening, Archivist-in-Chief?',
          ts: Date.now(),
        }])
      }
      setHistoryLoaded(true)
    }).catch(() => {
      setHistoryLoaded(true)
      setMessages([{
        role: 'assistant',
        text: 'The candles are lit. The inkwells are full. What does the Library require of me this evening, Archivist-in-Chief?',
        ts: Date.now(),
      }])
    })
  }, [user])

  // Save history to Firestore whenever it changes
  const saveHistory = async (newHistory, newDisplay) => {
    try {
      await setDoc(doc(db, HISTORY_DOC), {
        history: newHistory,
        // Only save last 60 display messages to keep doc size reasonable
        display: newDisplay.slice(-60),
        updatedAt: serverTimestamp(),
      })
    } catch (e) {
      console.warn('Failed to save keeper history:', e)
    }
  }

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const slugify = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const executeAction = async (action) => {
    const id = action.id || slugify(action.title)
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
    const newDisplay = [...messages, userMsg]
    setMessages(newDisplay)
    setLoading(true)

    // Build Anthropic history — strip wiki_action blocks from assistant turns
    // so Claude doesn't re-execute old actions, and use stripped text for history
    const newHistory = [...history, { role: 'user', content: text }]

    try {
      // Build slim payload — only include full HTML for articles mentioned in this message
      // This keeps the request body small regardless of wiki size
      const msgLower = text.toLowerCase()
      const articlesPayload = Object.fromEntries(
        Object.entries(articles).map(([id, a]) => {
          const mentioned = msgLower.includes(a.title.toLowerCase()) ||
                            msgLower.includes(a.id.toLowerCase())
          return [id, {
            id: a.id, title: a.title, category: a.category,
            subtitle: a.subtitle || '', infobox: a.infobox || {},
            content: mentioned ? (a.content || '') : '',
          }]
        })
      )
      const res = await fetch('/api/keeper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newHistory, articles: articlesPayload }),
      })
      const data = await res.json()

      if (!res.ok) {
        const errMsg = data?.error?.message || data?.error || `API error ${res.status}`
        throw new Error(errMsg)
      }

      const rawText = data.content?.[0]?.text || '(No response.)'
      const action = parseWikiAction(rawText)
      const displayText = stripWikiAction(rawText)

      // Check if the action block was found but failed to parse (truncated response)
      if (action?.[0]?._parseError) {
        const assistantMsg = { role: 'assistant', text: displayText, rawText, ts: Date.now() }
        const errorMsg = {
          role: 'assistant',
          text: `*The manuscript is incomplete — the ink runs off the page.* The edit was written but the action block was malformed, likely because the response was too long. Try asking Mnemovex to edit a smaller section, or break the task into parts.`,
          ts: Date.now(),
          isConfirmation: false,
        }
        const updatedDisplay = [...newDisplay, assistantMsg, errorMsg]
        const updatedHistory = [...newHistory, { role: 'assistant', content: stripWikiAction(rawText) }]
        setHistory(updatedHistory)
        setMessages(updatedDisplay)
        await saveHistory(updatedHistory, updatedDisplay)
        setLoading(false)
        return
      }

      // For history, store the stripped version so Claude doesn't see old wiki_action blocks
      const assistantHistoryEntry = { role: 'assistant', content: stripWikiAction(rawText) }
      const updatedHistory = [...newHistory, assistantHistoryEntry]

      const assistantDisplayMsg = {
        role: 'assistant',
        text: displayText,
        rawText,
        ts: Date.now(),
        pendingActions: action || undefined,
      }
      const updatedDisplay = [...newDisplay, assistantDisplayMsg]

      setHistory(updatedHistory)
      setMessages(updatedDisplay)

      if (action) {
        // Check for autoCommit flag — present on any action in the array
        const autoCommit = action.some(a => a.autoCommit)
        if (autoCommit) {
          // Execute immediately without queuing
          setPendingActions(null)
          const results = []
          for (const a of action) {
            const result = await executeAction(a)
            results.push(`**${a.title}** (${result})`)
          }
          const autoMsg = {
            role: 'assistant',
            text: action.length === 1
              ? `*The quill moves without hesitation.* ${results[0]} has been committed to the Library.`
              : `*The quill moves without hesitation across ${action.length} folios.* Committed:\n${results.map(r => `- ${r}`).join('\n')}`,
            ts: Date.now(),
            isConfirmation: true,
          }
          const updatedDisplay = [...newDisplay, assistantDisplayMsg, autoMsg]
          const updatedHistory2 = [...updatedHistory, { role: 'assistant', content: autoMsg.text }]
          setHistory(updatedHistory2)
          setMessages(updatedDisplay)
          await saveHistory(updatedHistory2, updatedDisplay)
        } else {
          setPendingActions(action)
        }
      }

      await saveHistory(updatedHistory, updatedDisplay)
    } catch (err) {
      const errDisplay = {
        role: 'assistant',
        text: `*A quill snaps. An inkwell overturns.* (${err.message})`,
        ts: Date.now(),
      }
      const updatedDisplay = [...newDisplay, errDisplay]
      setMessages(updatedDisplay)
      await saveHistory(newHistory, updatedDisplay)
    }
    setLoading(false)
  }

  const confirmAction = async () => {
    if (!pendingActions?.length) return
    setLoading(true)
    try {
      const results = []
      for (const action of pendingActions) {
        const result = await executeAction(action)
        results.push(`**${action.title}** (${result})`)
      }
      const confirmMsg = {
        role: 'assistant',
        text: pendingActions.length === 1
          ? `*The quill scratches across parchment.* Article ${results[0]} has been committed to the Library.`
          : `*The quill moves swiftly across ${pendingActions.length} folios.* The following have been committed to the Library:\n${results.map(r => `- ${r}`).join('\n')}`,
        ts: Date.now(),
        isConfirmation: true,
      }
      const updatedDisplay = [...messages, confirmMsg]
      setMessages(updatedDisplay)
      await saveHistory(history, updatedDisplay)
    } catch (err) {
      const errMsg = {
        role: 'assistant',
        text: `*The ink runs. Something has gone wrong.* (${err.message})`,
        ts: Date.now(),
      }
      const updatedDisplay = [...messages, errMsg]
      setMessages(updatedDisplay)
      await saveHistory(history, updatedDisplay)
    }
    setPendingActions(null)
    setLoading(false)
  }

  const dismissAction = () => {
    setPendingActions(null)
    const dismissMsg = {
      role: 'assistant',
      text: '*Very well. The parchment is set aside. What else?*',
      ts: Date.now(),
    }
    const updatedDisplay = [...messages, dismissMsg]
    setMessages(updatedDisplay)
    saveHistory(history, updatedDisplay)
  }

  const clearHistory = async () => {
    if (!confirm('Clear all conversation history with Mnemovex?')) return
    const greeting = {
      role: 'assistant',
      text: 'The slates are wiped clean. A fresh ledger lies open. What does the Library require?',
      ts: Date.now(),
    }
    setHistory([])
    setMessages([greeting])
    setPendingActions(null)
    await saveHistory([], [greeting])
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
            background: '#141428', display: 'flex', alignItems: 'center', gap: 10,
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
            <button onClick={clearHistory} title="Clear conversation history"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4a5a7a', fontSize: '0.75rem', padding: '2px 4px' }}>
              🗑
            </button>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', marginLeft: 4,
              background: loading ? '#f5a623' : '#4caf50',
              boxShadow: `0 0 6px ${loading ? '#f5a623' : '#4caf50'}`,
            }} />
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!historyLoaded && (
              <div style={{ color: '#6a7fa5', fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'center', marginTop: 20 }}>
                Consulting the archives…
              </div>
            )}
            {historyLoaded && messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '88%', padding: '8px 12px', borderRadius: 8,
                  fontSize: '0.84rem', lineHeight: 1.6,
                  background: m.role === 'user' ? '#1b4f72' : m.isConfirmation ? '#1a3a1a' : '#252540',
                  color: m.role === 'user' ? '#e8f0ff' : '#c8c0b0',
                  border: m.role === 'user' ? 'none' : m.isConfirmation ? '1px solid #2d5a2d' : '1px solid #2a3a5a',
                }}>
                  {m.text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((chunk, ci) => {
                    if (chunk.startsWith('**') && chunk.endsWith('**'))
                      return <strong key={ci}>{chunk.slice(2, -2)}</strong>
                    if (chunk.startsWith('*') && chunk.endsWith('*'))
                      return <em key={ci}>{chunk.slice(1, -1)}</em>
                    return chunk
                  })}
                </div>
                {m.pendingActions && pendingActions && (
                  <div style={{ marginTop: 8 }}>
                    {/* Article queue preview */}
                    <div style={{ background: '#1a2a1a', border: '1px solid #2d5a2d',
                      borderRadius: 4, padding: '6px 10px', marginBottom: 6 }}>
                      <div style={{ fontSize: '0.68rem', textTransform: 'uppercase',
                        letterSpacing: '0.08em', color: '#4a7a4a', marginBottom: 4 }}>
                        {pendingActions.length === 1 ? '1 article queued' : `${pendingActions.length} articles queued`}
                      </div>
                      {pendingActions.map((a, i) => (
                        <div key={i} style={{ fontSize: '0.78rem', color: '#8ab88a',
                          display: 'flex', gap: 6, alignItems: 'center', padding: '1px 0' }}>
                          <span style={{ color: a.action === 'create' ? '#4caf50' : '#c8b87a',
                            fontSize: '0.65rem', textTransform: 'uppercase', flexShrink: 0 }}>
                            {a.action}
                          </span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.title}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={confirmAction} disabled={loading}
                        style={{ padding: '5px 14px', border: 'none', borderRadius: 4,
                          background: '#2e7d32', color: '#fff', cursor: 'pointer',
                          fontSize: '0.78rem', fontFamily: "'Source Serif 4', Georgia, serif" }}>
                        ✓ Commit {pendingActions.length > 1 ? `All ${pendingActions.length}` : ''} to the Library
                      </button>
                      <button onClick={dismissAction} disabled={loading}
                        style={{ padding: '5px 10px', border: '1px solid #4a3a3a', borderRadius: 4,
                          background: 'none', color: '#a08080', cursor: 'pointer',
                          fontSize: '0.78rem', fontFamily: "'Source Serif 4', Georgia, serif" }}>
                        Discard
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6a7fa5', fontSize: '0.8rem', fontStyle: 'italic' }}>
                <span>✦</span> The Archivist considers…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #2a3a5a', background: '#141428', display: 'flex', gap: 8 }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Speak to the Archivist…"
              disabled={loading || !historyLoaded}
              style={{
                flex: 1, padding: '7px 10px',
                background: '#252540', border: '1px solid #2a3a5a', borderRadius: 4,
                color: '#c8c0b0', fontSize: '0.84rem',
                fontFamily: "'Source Serif 4', Georgia, serif",
                outline: 'none',
              }} />
            <button onClick={() => send()} disabled={loading || !input.trim() || !historyLoaded}
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
