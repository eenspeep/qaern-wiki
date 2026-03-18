import { useState, useEffect, useRef } from 'react'
import {
  collection, doc, onSnapshot, addDoc, setDoc, deleteDoc,
  query, orderBy, serverTimestamp, updateDoc, getDoc,
} from 'firebase/firestore'
import { db } from './firebase'

const ADMIN = 'speep'
const isAdmin = u => u?.displayName === ADMIN

const uid = () => Math.random().toString(36).slice(2, 10)

const REACTION_EMOJIS = ['👍','❤️','😂','😮','😢','⚔️','🎲','🌿']

const timeAgo = (ts) => {
  if (!ts?.seconds) return ''
  const s = Math.floor(Date.now() / 1000 - ts.seconds)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s/60)}m ago`
  if (s < 86400) return `${Math.floor(s/3600)}h ago`
  if (s < 604800) return `${Math.floor(s/86400)}d ago`
  return new Date(ts.seconds * 1000).toLocaleDateString()
}

// Simple markdown: **bold**, *italic*, inline `code`
const renderText = (text) => {
  if (!text) return null
  const parts = []
  let remaining = text
  let key = 0
  const patterns = [
    { re: /\*\*(.+?)\*\*/g, render: (m) => <strong key={key++}>{m[1]}</strong> },
    { re: /\*(.+?)\*/g,     render: (m) => <em key={key++}>{m[1]}</em> },
    { re: /`(.+?)`/g,       render: (m) => <code key={key++} style={{ background:'#f0eeea', padding:'1px 4px', borderRadius:3, fontSize:'0.88em', fontFamily:'monospace' }}>{m[1]}</code> },
  ]
  // Simple sequential replacement
  let html = text
    .replace(/\*\*(.+?)\*\*/g, '~~BOLD~~$1~~ENDBOLD~~')
    .replace(/\*(.+?)\*/g, '~~ITALIC~~$1~~ENDITALIC~~')
    .replace(/`(.+?)`/g, '~~CODE~~$1~~ENDCODE~~')
  const segments = html.split(/(~~BOLD~~|~~ENDBOLD~~|~~ITALIC~~|~~ENDITALIC~~|~~CODE~~|~~ENDCODE~~)/)
  let bold = false, italic = false, code = false
  return segments.map((seg, i) => {
    if (seg === '~~BOLD~~') { bold = true; return null }
    if (seg === '~~ENDBOLD~~') { bold = false; return null }
    if (seg === '~~ITALIC~~') { italic = true; return null }
    if (seg === '~~ENDITALIC~~') { italic = false; return null }
    if (seg === '~~CODE~~') { code = true; return null }
    if (seg === '~~ENDCODE~~') { code = false; return null }
    if (!seg) return null
    if (code) return <code key={i} style={{ background:'#f0eeea', padding:'1px 4px', borderRadius:3, fontSize:'0.88em', fontFamily:'monospace' }}>{seg}</code>
    if (bold) return <strong key={i}>{seg}</strong>
    if (italic) return <em key={i}>{seg}</em>
    // Preserve newlines
    return seg.split('\n').map((line, j, arr) => (
      <span key={`${i}-${j}`}>{line}{j < arr.length - 1 ? <br/> : null}</span>
    ))
  })
}

// ─── Reaction bar ──────────────────────────────────────────────────────────────
function ReactionBar({ reactions = {}, onReact, user }) {
  const [showPicker, setShowPicker] = useState(false)
  const uid_ = user?.uid

  const myReactions = Object.entries(reactions)
    .filter(([, users]) => users.includes(uid_))
    .map(([emoji]) => emoji)

  const toggle = (emoji) => {
    onReact(emoji)
    setShowPicker(false)
  }

  const counts = Object.entries(reactions).filter(([, u]) => u.length > 0)

  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:4, alignItems:'center', marginTop:6 }}>
      {counts.map(([emoji, users]) => (
        <button key={emoji} onClick={() => toggle(emoji)}
          title={users.join(', ')}
          style={{ padding:'2px 7px', borderRadius:12, border:'1px solid',
            borderColor: myReactions.includes(emoji) ? '#1b4f72' : '#e0ddd8',
            background: myReactions.includes(emoji) ? '#e8f0f8' : '#f8f7f4',
            cursor:'pointer', fontSize:'0.82rem', display:'flex', alignItems:'center', gap:3 }}>
          {emoji} <span style={{ fontSize:'0.72rem', color:'#666' }}>{users.length}</span>
        </button>
      ))}
      <div style={{ position:'relative' }}>
        <button onClick={() => setShowPicker(p => !p)}
          style={{ padding:'2px 7px', borderRadius:12, border:'1px dashed #ccc9c0',
            background:'none', cursor:'pointer', fontSize:'0.8rem', color:'#aaa' }}>
          + 😀
        </button>
        {showPicker && (
          <div style={{ position:'absolute', bottom:'100%', left:0, background:'#fff',
            border:'1px solid #e0ddd8', borderRadius:8, padding:'6px 8px',
            display:'flex', gap:4, flexWrap:'wrap', width:200, zIndex:50,
            boxShadow:'0 4px 16px rgba(0,0,0,0.12)' }}>
            {REACTION_EMOJIS.map(e => (
              <div key={e} onClick={() => toggle(e)}
                style={{ fontSize:'1.2rem', cursor:'pointer', padding:'2px',
                  borderRadius:4, transition:'background 0.1s' }}
                onMouseEnter={ev => ev.currentTarget.style.background='#f0eeea'}
                onMouseLeave={ev => ev.currentTarget.style.background='transparent'}>
                {e}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Post component ────────────────────────────────────────────────────────────
function Post({ post, user, threadId, catId, onDelete, onReact }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(post.body)
  const isMe = post.uid === user?.uid
  const canEdit = isMe || isAdmin(user)
  const canDelete = isMe || isAdmin(user)

  const saveEdit = async () => {
    if (!draft.trim()) return
    await updateDoc(doc(db, `chat/${catId}/threads/${threadId}/posts/${post.id}`), {
      body: draft.trim(), edited: true, editedAt: serverTimestamp()
    })
    setEditing(false)
  }

  return (
    <div style={{ padding:'12px 0', borderBottom:'1px solid #f0eeea' }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
        {/* Avatar */}
        <div style={{ width:32, height:32, borderRadius:'50%', flexShrink:0,
          background: post.authorColor || '#888',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:'0.7rem', fontWeight:700, color:'#fff' }}>
          {(post.author||'?').slice(0,2).toUpperCase()}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:4, flexWrap:'wrap' }}>
            <span style={{ fontFamily:"'IM Fell English',serif", fontSize:'0.88rem',
              color: isMe ? '#1b4f72' : '#333', fontWeight:600 }}>
              {post.author}
            </span>
            <span style={{ fontSize:'0.68rem', color:'#bbb' }}>{timeAgo(post.createdAt)}</span>
            {post.edited && <span style={{ fontSize:'0.65rem', color:'#ccc', fontStyle:'italic' }}>edited</span>}
          </div>
          {/* Body */}
          {editing ? (
            <div>
              <textarea value={draft} onChange={e => setDraft(e.target.value)}
                rows={3} autoFocus
                style={{ width:'100%', padding:'6px 8px', border:'1px solid #1b4f72', borderRadius:3,
                  fontSize:'0.85rem', fontFamily:"'Source Serif 4',Georgia,serif",
                  resize:'vertical', lineHeight:1.6, boxSizing:'border-box', outline:'none' }}/>
              <div style={{ display:'flex', gap:6, marginTop:4 }}>
                <button onClick={saveEdit}
                  style={{ padding:'4px 12px', border:'none', borderRadius:3, background:'#1b4f72',
                    color:'#fff', cursor:'pointer', fontSize:'0.78rem',
                    fontFamily:"'Source Serif 4',Georgia,serif" }}>Save</button>
                <button onClick={() => { setEditing(false); setDraft(post.body) }}
                  style={{ padding:'4px 10px', border:'1px solid #ccc9c0', borderRadius:3,
                    background:'none', cursor:'pointer', fontSize:'0.78rem',
                    fontFamily:"'Source Serif 4',Georgia,serif", color:'#666' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize:'0.85rem', color:'#333', lineHeight:1.7,
              fontFamily:"'Source Serif 4',Georgia,serif" }}>
              {renderText(post.body)}
            </div>
          )}
          {/* Reactions */}
          <ReactionBar reactions={post.reactions || {}} user={user}
            onReact={(emoji) => onReact(post.id, emoji)}/>
        </div>
        {/* Actions */}
        {canEdit && !editing && (
          <div style={{ display:'flex', gap:4, flexShrink:0 }}>
            {isMe && (
              <button onClick={() => setEditing(true)}
                style={{ background:'none', border:'none', cursor:'pointer',
                  fontSize:'0.72rem', color:'#bbb', padding:'2px 4px' }}>✎</button>
            )}
            {canDelete && (
              <button onClick={() => onDelete(post.id)}
                style={{ background:'none', border:'none', cursor:'pointer',
                  fontSize:'0.72rem', color:'#dbb', padding:'2px 4px' }}>🗑</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Thread view ───────────────────────────────────────────────────────────────
function ThreadView({ catId, thread, user, onBack }) {
  const [posts, setPosts] = useState([])
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    const q = query(collection(db, `chat/${catId}/threads/${thread.id}/posts`), orderBy('createdAt','asc'))
    const unsub = onSnapshot(q, snap => {
      setPosts(snap.docs.map(d => ({ id:d.id, ...d.data() })))
    })
    return unsub
  }, [catId, thread.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [posts.length])

  const submit = async () => {
    const text = body.trim()
    if (!text || posting) return
    setPosting(true)
    try {
      const color = `hsl(${[...user.uid].reduce((n,c)=>n+c.charCodeAt(0),0)%360},45%,42%)`
      await addDoc(collection(db, `chat/${catId}/threads/${thread.id}/posts`), {
        body: text, author: user.displayName || user.email,
        authorColor: color, uid: user.uid,
        reactions: {}, createdAt: serverTimestamp(),
      })
      // Update thread lastPost
      await updateDoc(doc(db, `chat/${catId}/threads/${thread.id}`), {
        lastPost: serverTimestamp(), postCount: (thread.postCount||0) + 1,
      })
      setBody('')
    } finally { setPosting(false) }
  }

  const deletePost = async (postId) => {
    if (!confirm('Delete this post?')) return
    await deleteDoc(doc(db, `chat/${catId}/threads/${thread.id}/posts/${postId}`))
  }

  const reactToPost = async (postId, emoji) => {
    const ref = doc(db, `chat/${catId}/threads/${thread.id}/posts/${postId}`)
    const snap = await getDoc(ref)
    if (!snap.exists()) return
    const reactions = snap.data().reactions || {}
    const users = reactions[emoji] || []
    const hasReacted = users.includes(user.uid)
    await updateDoc(ref, {
      [`reactions.${emoji}`]: hasReacted
        ? users.filter(u => u !== user.uid)
        : [...users, user.uid]
    })
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Thread header */}
      <div style={{ padding:'10px 16px', borderBottom:'1px solid #e8e5e0',
        background:'#f8f7f4', flexShrink:0, display:'flex', alignItems:'center', gap:10 }}>
        <button onClick={onBack}
          style={{ background:'none', border:'none', cursor:'pointer', color:'#888',
            fontSize:'0.85rem', padding:'2px 6px', flexShrink:0 }}>← Back</button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:"'IM Fell English',serif", fontSize:'1rem', color:'#1a1a1a',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {thread.title}
          </div>
          {thread.description && (
            <div style={{ fontSize:'0.72rem', color:'#888', marginTop:1 }}>{thread.description}</div>
          )}
        </div>
        {isAdmin(user) && (
          <button onClick={async () => {
            if (!confirm('Delete this thread and all its posts?')) return
            // Firestore doesn't cascade-delete subcollections from client, so mark deleted
            await updateDoc(doc(db, `chat/${catId}/threads/${thread.id}`), { deleted: true })
            onBack()
          }} style={{ background:'none', border:'none', cursor:'pointer', color:'#ccc', fontSize:'0.8rem' }}>🗑</button>
        )}
      </div>

      {/* Posts */}
      <div style={{ flex:1, overflowY:'auto', padding:'4px 16px 8px' }}>
        {posts.length === 0 && (
          <div style={{ textAlign:'center', color:'#bbb', fontStyle:'italic',
            fontSize:'0.85rem', marginTop:40 }}>No posts yet. Be the first to reply.</div>
        )}
        {posts.map(p => (
          <Post key={p.id} post={p} user={user}
            threadId={thread.id} catId={catId}
            onDelete={deletePost} onReact={reactToPost}/>
        ))}
        <div ref={bottomRef}/>
      </div>

      {/* Compose */}
      <div style={{ padding:'10px 16px 14px', borderTop:'1px solid #e8e5e0',
        background:'#faf9f6', flexShrink:0 }}>
        <div style={{ fontSize:'0.62rem', color:'#bbb', marginBottom:4 }}>
          **bold** *italic* `code`
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
          <textarea value={body} onChange={e => setBody(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter' && (e.ctrlKey||e.metaKey)) submit() }}
            placeholder='Write a reply… (Ctrl+Enter to post)'
            rows={3}
            style={{ flex:1, padding:'8px 10px', border:'1px solid #ccc9c0', borderRadius:4,
              fontSize:'0.85rem', fontFamily:"'Source Serif 4',Georgia,serif",
              resize:'vertical', lineHeight:1.6, outline:'none', background:'#f8f7f4' }}/>
          <button onClick={submit} disabled={!body.trim() || posting}
            style={{ padding:'8px 16px', border:'none', borderRadius:4,
              background: body.trim() ? '#1b4f72' : '#ccc',
              color:'#fff', cursor: body.trim() ? 'pointer' : 'default',
              fontSize:'0.82rem', fontFamily:"'Source Serif 4',Georgia,serif",
              flexShrink:0, alignSelf:'flex-end' }}>
            Post
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Category view ─────────────────────────────────────────────────────────────
function CategoryView({ catId, cat, user, onBack }) {
  const [threads, setThreads] = useState([])
  const [activeThread, setActiveThread] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')

  useEffect(() => {
    const q = query(collection(db, `chat/${catId}/threads`), orderBy('lastPost','desc'))
    const unsub = onSnapshot(q, snap => {
      setThreads(snap.docs.map(d => ({ id:d.id, ...d.data() })).filter(t => !t.deleted))
    })
    return unsub
  }, [catId])

  const createThread = async () => {
    if (!newTitle.trim()) return
    const ref = await addDoc(collection(db, `chat/${catId}/threads`), {
      title: newTitle.trim(), description: newDesc.trim(),
      author: user.displayName || user.email, uid: user.uid,
      postCount: 0, createdAt: serverTimestamp(), lastPost: serverTimestamp(),
    })
    setNewTitle(''); setNewDesc(''); setShowNew(false)
    setActiveThread({ id: ref.id, title: newTitle.trim(), description: newDesc.trim(), postCount: 0 })
  }

  if (activeThread) {
    return <ThreadView catId={catId} thread={activeThread} user={user} onBack={() => setActiveThread(null)}/>
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Header */}
      <div style={{ padding:'10px 16px', borderBottom:'1px solid #e8e5e0',
        background:'#f8f7f4', flexShrink:0, display:'flex', alignItems:'center', gap:10 }}>
        <button onClick={onBack}
          style={{ background:'none', border:'none', cursor:'pointer', color:'#888', fontSize:'0.85rem', padding:'2px 6px' }}>
          ← Back
        </button>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"'IM Fell English',serif", fontSize:'1rem', color:'#1b4f72' }}>{cat.name}</div>
          {cat.description && <div style={{ fontSize:'0.72rem', color:'#888' }}>{cat.description}</div>}
        </div>
        <button onClick={() => setShowNew(v => !v)}
          style={{ padding:'5px 12px', border:'1px solid #1b4f72', borderRadius:3,
            background:'transparent', color:'#1b4f72', cursor:'pointer',
            fontSize:'0.78rem', fontFamily:"'Source Serif 4',Georgia,serif" }}>
          + New Thread
        </button>
      </div>

      {/* New thread form */}
      {showNew && (
        <div style={{ padding:'12px 16px', borderBottom:'1px solid #e8e5e0', background:'#eef4f8', flexShrink:0 }}>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder='Thread title…' autoFocus
            style={{ width:'100%', padding:'6px 8px', border:'1px solid #ccc9c0', borderRadius:3,
              fontSize:'0.85rem', fontFamily:"'Source Serif 4',Georgia,serif",
              background:'#f8f7f4', marginBottom:6, boxSizing:'border-box' }}/>
          <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
            placeholder='Short description (optional)…'
            style={{ width:'100%', padding:'6px 8px', border:'1px solid #ccc9c0', borderRadius:3,
              fontSize:'0.82rem', fontFamily:"'Source Serif 4',Georgia,serif",
              background:'#f8f7f4', marginBottom:6, boxSizing:'border-box' }}/>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={createThread} disabled={!newTitle.trim()}
              style={{ padding:'5px 14px', border:'none', borderRadius:3,
                background: newTitle.trim() ? '#1b4f72' : '#aaa',
                color:'#fff', cursor: newTitle.trim() ? 'pointer' : 'default',
                fontSize:'0.8rem', fontFamily:"'Source Serif 4',Georgia,serif" }}>Create</button>
            <button onClick={() => { setShowNew(false); setNewTitle(''); setNewDesc('') }}
              style={{ padding:'5px 10px', border:'1px solid #ccc9c0', borderRadius:3,
                background:'none', cursor:'pointer', fontSize:'0.8rem',
                fontFamily:"'Source Serif 4',Georgia,serif", color:'#666' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Thread list */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {threads.length === 0 && (
          <div style={{ textAlign:'center', color:'#bbb', fontStyle:'italic',
            fontSize:'0.85rem', marginTop:40 }}>No threads yet. Start a conversation.</div>
        )}
        {threads.map(t => (
          <div key={t.id} onClick={() => setActiveThread(t)}
            style={{ padding:'12px 16px', borderBottom:'1px solid #f0eeea',
              cursor:'pointer', display:'flex', alignItems:'center', gap:12,
              transition:'background 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.background='#f4f2ef'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:"'IM Fell English',serif", fontSize:'0.95rem',
                color:'#1a1a1a', marginBottom:2 }}>{t.title}</div>
              {t.description && (
                <div style={{ fontSize:'0.72rem', color:'#888', overflow:'hidden',
                  textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.description}</div>
              )}
              <div style={{ fontSize:'0.68rem', color:'#bbb', marginTop:2 }}>
                by {t.author} · {timeAgo(t.lastPost)}
              </div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0 }}>
              <div style={{ fontSize:'0.8rem', color:'#888', fontWeight:600 }}>{t.postCount || 0}</div>
              <div style={{ fontSize:'0.62rem', color:'#bbb' }}>posts</div>
            </div>
            <span style={{ color:'#ccc', fontSize:'0.85rem' }}>›</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Chat page ────────────────────────────────────────────────────────────
export default function Chat({ user, onClose }) {
  const admin = isAdmin(user)
  const [categories, setCategories] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [activecat, setActiveCat] = useState(null)
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatDesc, setNewCatDesc] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'chat'), orderBy('order','asc'))
    const unsub = onSnapshot(q, snap => {
      setCategories(snap.docs.map(d => ({ id:d.id, ...d.data() })).filter(c => !c.deleted))
      setLoaded(true)
    }, err => { console.error('Chat error:', err); setLoaded(true) })
    return unsub
  }, [])

  const createCategory = async () => {
    if (!newCatName.trim()) return
    await addDoc(collection(db, 'chat'), {
      name: newCatName.trim(), description: newCatDesc.trim(),
      order: categories.length, createdAt: serverTimestamp(),
    })
    setNewCatName(''); setNewCatDesc(''); setShowNewCat(false)
  }

  const deleteCategory = async (catId) => {
    if (!confirm('Delete this category and all its threads?')) return
    await updateDoc(doc(db, 'chat', catId), { deleted: true })
    if (activecat?.id === catId) setActiveCat(null)
  }

  if (activecat) {
    return (
      <div style={{ position:'fixed', inset:0, zIndex:300, background:'#faf9f6',
        display:'flex', flexDirection:'column', fontFamily:"'Source Serif 4',Georgia,serif" }}>
        <div style={{ background:'#1b4f72', padding:'0 1rem', height:50, flexShrink:0,
          display:'flex', alignItems:'center', gap:'0.8rem', borderBottom:'2px solid #14395a' }}>
          <span style={{ fontFamily:"'IM Fell English',serif", fontSize:'1.1rem', color:'#e8f4ff' }}>
            💬 {activecat.name}
          </span>
          <div style={{ flex:1 }}/>
          <button onClick={onClose}
            style={{ padding:'4px 12px', border:'1px solid #4a7fa5', borderRadius:3,
              background:'transparent', color:'#a8d0e8', cursor:'pointer',
              fontSize:'0.82rem', fontFamily:"'Source Serif 4',Georgia,serif" }}>← Back</button>
        </div>
        <div style={{ flex:1, overflow:'hidden' }}>
          <CategoryView catId={activecat.id} cat={activecat} user={user} onBack={() => setActiveCat(null)}/>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'#faf9f6',
      display:'flex', flexDirection:'column', fontFamily:"'Source Serif 4',Georgia,serif" }}>

      {/* Header */}
      <div style={{ background:'#1b4f72', padding:'0 1.2rem', height:50, flexShrink:0,
        display:'flex', alignItems:'center', gap:'1rem', borderBottom:'2px solid #14395a' }}>
        <span style={{ fontFamily:"'IM Fell English',serif", fontSize:'1.1rem', color:'#e8f4ff' }}>
          💬 Forum
        </span>
        <div style={{ flex:1 }}/>
        {admin && (
          <button onClick={() => setShowNewCat(v => !v)}
            style={{ padding:'5px 12px', border:'1px solid #a8d0e8', borderRadius:3,
              background:'transparent', color:'#a8d0e8', cursor:'pointer',
              fontSize:'0.8rem', fontFamily:"'Source Serif 4',Georgia,serif" }}>
            + Category
          </button>
        )}
        <button onClick={onClose}
          style={{ padding:'4px 12px', border:'1px solid #4a7fa5', borderRadius:3,
            background:'transparent', color:'#a8d0e8', cursor:'pointer',
            fontSize:'0.82rem', fontFamily:"'Source Serif 4',Georgia,serif" }}>← Back</button>
      </div>

      {/* New category form */}
      {showNewCat && admin && (
        <div style={{ padding:'12px 16px', borderBottom:'1px solid #e8e5e0',
          background:'#eef4f8', flexShrink:0 }}>
          <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
            placeholder='Category name…' autoFocus
            style={{ width:'100%', padding:'6px 8px', border:'1px solid #ccc9c0', borderRadius:3,
              fontSize:'0.85rem', fontFamily:"'Source Serif 4',Georgia,serif",
              background:'#f8f7f4', marginBottom:6, boxSizing:'border-box' }}/>
          <input value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)}
            placeholder='Description (optional)…'
            style={{ width:'100%', padding:'6px 8px', border:'1px solid #ccc9c0', borderRadius:3,
              fontSize:'0.82rem', fontFamily:"'Source Serif 4',Georgia,serif",
              background:'#f8f7f4', marginBottom:6, boxSizing:'border-box' }}/>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={createCategory} disabled={!newCatName.trim()}
              style={{ padding:'5px 14px', border:'none', borderRadius:3,
                background: newCatName.trim() ? '#1b4f72' : '#aaa',
                color:'#fff', cursor: newCatName.trim() ? 'pointer' : 'default',
                fontSize:'0.8rem', fontFamily:"'Source Serif 4',Georgia,serif" }}>Create</button>
            <button onClick={() => { setShowNewCat(false); setNewCatName(''); setNewCatDesc('') }}
              style={{ padding:'5px 10px', border:'1px solid #ccc9c0', borderRadius:3,
                background:'none', cursor:'pointer', fontSize:'0.8rem',
                fontFamily:"'Source Serif 4',Georgia,serif", color:'#666' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Category list */}
      <div style={{ flex:1, overflowY:'auto', maxWidth:680, width:'100%', margin:'0 auto', boxSizing:'border-box' }}>
        {!loaded && <div style={{ textAlign:'center', color:'#bbb', fontStyle:'italic', marginTop:40 }}>Loading…</div>}
        {loaded && categories.length === 0 && (
          <div style={{ textAlign:'center', color:'#bbb', fontStyle:'italic', marginTop:60, fontSize:'0.9rem' }}>
            {admin ? 'No categories yet. Create one to get started.' : 'Nothing here yet.'}
          </div>
        )}
        {categories.map(cat => (
          <div key={cat.id} onClick={() => setActiveCat(cat)}
            style={{ padding:'16px 20px', borderBottom:'1px solid #e8e5e0',
              cursor:'pointer', display:'flex', alignItems:'center', gap:14,
              transition:'background 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.background='#f4f2ef'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
            <div style={{ width:44, height:44, borderRadius:8, background:'#1b4f72',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:'1.3rem', flexShrink:0, color:'#fff', fontFamily:"'IM Fell English',serif" }}>
              {cat.name.slice(0,1).toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:"'IM Fell English',serif", fontSize:'1.05rem',
                color:'#1a1a1a', marginBottom:2 }}>{cat.name}</div>
              {cat.description && (
                <div style={{ fontSize:'0.76rem', color:'#888', overflow:'hidden',
                  textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cat.description}</div>
              )}
            </div>
            {admin && (
              <button onClick={e => { e.stopPropagation(); deleteCategory(cat.id) }}
                style={{ background:'none', border:'none', cursor:'pointer',
                  color:'#ccc', fontSize:'0.8rem', padding:'2px 4px', flexShrink:0 }}>🗑</button>
            )}
            <span style={{ color:'#ccc', fontSize:'0.9rem', flexShrink:0 }}>›</span>
          </div>
        ))}
      </div>
    </div>
  )
}
