import Adventures from './Adventures'
import { useState, useEffect, useRef, useCallback } from 'react'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

const BOARD_DOC = 'bulletin/board'
const ADMIN = 'speep'
const isAdmin = user => user?.displayName === ADMIN

const NOTE_TYPES = {
  adventure: { label: 'Adventure', color: '#c8a86b', bg: '#fdf3dc', pin: '#c0392b' },
  rumour:    { label: 'Rumour',    color: '#7a9e7e', bg: '#eef6ee', pin: '#27ae60' },
  bounty:    { label: 'Bounty',    color: '#c06a3a', bg: '#fdeede', pin: '#e67e22' },
  notice:    { label: 'Notice',    color: '#7a7a9e', bg: '#eeeefc', pin: '#8e44ad' },
}

const uid = () => Math.random().toString(36).slice(2, 10)

const noteRotation = (id) => {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0
  return ((h % 7) - 3) * 0.8
}

// ─── Top pin ──────────────────────────────────────────────────────────────────
function Pin({ color }) {
  return (
    <div style={{
      position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
      width: 16, height: 16, borderRadius: '50%',
      background: `radial-gradient(circle at 35% 35%, #fff8, ${color} 60%)`,
      boxShadow: `0 2px 4px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.3)`,
      zIndex: 2, cursor: 'default',
    }}/>
  )
}

// ─── RSVP pin slot ────────────────────────────────────────────────────────────
function RsvpPin({ filled, name, isMe, onClick, disabled }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <div
        onClick={disabled ? undefined : onClick}
        title={filled ? name : 'Claim spot'}
        style={{
          width: 14, height: 14, borderRadius: '50%',
          background: filled
            ? `radial-gradient(circle at 35% 35%, #fff6, ${isMe ? '#1b4f72' : '#8b3a3a'} 60%)`
            : 'rgba(0,0,0,0.12)',
          border: filled
            ? `1.5px solid ${isMe ? '#1b4f72' : '#8b3a3a'}`
            : '1.5px dashed rgba(0,0,0,0.25)',
          boxShadow: filled ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
          cursor: disabled ? 'default' : filled && isMe ? 'pointer' : !filled ? 'pointer' : 'default',
          transition: 'background 0.15s, transform 0.1s',
          transform: hovered && !disabled ? 'scale(1.2)' : 'scale(1)',
        }}/>
      {/* Tooltip */}
      {hovered && filled && (
        <div style={{
          position: 'fixed',
          transform: 'translate(-50%, -120%)',
          background: '#1a1a1a', color: '#e8e4dc',
          padding: '3px 8px', borderRadius: 4,
          fontSize: '0.68rem', whiteSpace: 'nowrap',
          pointerEvents: 'none', zIndex: 9999,
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
          ref={el => {
            if (el) {
              const parent = el.parentElement?.getBoundingClientRect()
              if (parent) {
                el.style.left = parent.left + parent.width / 2 + 'px'
                el.style.top = parent.top + 'px'
              }
            }
          }}>
          {name}
        </div>
      )}
    </div>
  )
}

// ─── RSVP row ─────────────────────────────────────────────────────────────────
function RsvpRow({ note, user, onRsvpChange }) {
  if (!note.maxPlayers || note.maxPlayers < 1) return null
  const max = parseInt(note.maxPlayers) || 0
  const rsvps = note.rsvps || []
  const myRsvp = rsvps.find(r => r.uid === user?.uid)
  const isFull = rsvps.length >= max && !myRsvp

  const handleClick = (slotIdx) => {
    const slotRsvp = rsvps[slotIdx]
    if (slotRsvp) {
      // Only the owner or admin can unclaim
      if (slotRsvp.uid === user?.uid || isAdmin(user)) {
        onRsvpChange(rsvps.filter((_, i) => i !== slotIdx))
      }
    } else if (!myRsvp && !isFull) {
      // Claim this slot
      const name = user?.displayName || user?.email || 'Anonymous'
      onRsvpChange([...rsvps, { uid: user.uid, name }])
    }
  }

  return (
    <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
      <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.07em',
        color: 'rgba(0,0,0,0.4)', marginBottom: 5 }}>
        Players {rsvps.length}/{max}
      </div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
        {Array.from({ length: max }).map((_, i) => {
          const rsvp = rsvps[i]
          const isMe = rsvp?.uid === user?.uid
          const canInteract = rsvp
            ? (isMe || isAdmin(user))  // can unclaim own or admin can remove any
            : !myRsvp && !isFull       // can claim if no spot yet and not full
          return (
            <RsvpPin
              key={i}
              filled={!!rsvp}
              name={rsvp?.name || ''}
              isMe={isMe}
              disabled={!canInteract}
              onClick={() => handleClick(i)}
            />
          )
        })}
        {!myRsvp && !isFull && (
          <span style={{ fontSize: '0.62rem', color: 'rgba(0,0,0,0.3)', fontStyle: 'italic' }}>
            click to join
          </span>
        )}
        {myRsvp && (
          <span style={{ fontSize: '0.62rem', color: '#1b4f72', fontStyle: 'italic' }}>
            ✓ you're in
          </span>
        )}
        {isFull && !myRsvp && (
          <span style={{ fontSize: '0.62rem', color: '#b44', fontStyle: 'italic' }}>
            full
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Note card ────────────────────────────────────────────────────────────────
function NoteCard({ note, admin, user, onEdit, onDelete, onDragStart, isDragging, onRsvpChange }) {
  const [expanded, setExpanded] = useState(false)
  const type = NOTE_TYPES[note.type] || NOTE_TYPES.notice
  const rot = noteRotation(note.id)

  return (
    <div
      onMouseDown={admin ? onDragStart : undefined}
      style={{
        position: 'absolute',
        left: note.x, top: note.y,
        width: 190,
        background: type.bg,
        borderRadius: 2,
        padding: '18px 12px 12px',
        boxShadow: isDragging
          ? '0 16px 40px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)'
          : '2px 4px 12px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.15)',
        transform: `rotate(${rot}deg) scale(${isDragging ? 1.05 : 1})`,
        transition: isDragging ? 'none' : 'box-shadow 0.2s, transform 0.15s',
        cursor: admin ? 'grab' : 'default',
        userSelect: 'none',
        zIndex: isDragging ? 1000 : 1,
        backgroundImage: `
          linear-gradient(${type.bg} 0%, ${type.bg} 100%),
          repeating-linear-gradient(
            0deg, transparent, transparent 24px,
            rgba(0,0,0,0.04) 24px, rgba(0,0,0,0.04) 25px
          )
        `,
        backgroundBlendMode: 'multiply',
      }}>
      <Pin color={type.pin}/>

      <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: '0.1em', color: type.color, marginBottom: 5, opacity: 0.85 }}>
        {type.label}
      </div>

      <div style={{ fontFamily: "'IM Fell English', serif", fontSize: '0.88rem', fontWeight: 600,
        color: '#2a1f0e', lineHeight: 1.3, marginBottom: 6 }}>
        {note.title}
      </div>

      {note.body && (
        <div style={{ fontSize: '0.72rem', color: '#4a3a28', lineHeight: 1.55,
          fontFamily: "'Source Serif 4', Georgia, serif",
          maxHeight: expanded ? 'none' : '3.1em', overflow: 'hidden', cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}>
          {note.body}
        </div>
      )}
      {note.body && note.body.length > 80 && (
        <div onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
          style={{ fontSize: '0.65rem', color: type.color, marginTop: 2, cursor: 'pointer', opacity: 0.8 }}>
          {expanded ? '▲ less' : '▼ more'}
        </div>
      )}

      {note.type === 'adventure' && (note.rewards || note.level || note.length) && (
        <div style={{ marginTop: 7, paddingTop: 6, borderTop: '1px solid rgba(0,0,0,0.08)',
          fontSize: '0.67rem', color: '#5a4a30', fontFamily: "'Source Serif 4', Georgia, serif", lineHeight: 1.6 }}>
          {note.rewards && <div><span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6rem', opacity: 0.7 }}>Rewards </span>{note.rewards}</div>}
          {note.level  && <div><span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6rem', opacity: 0.7 }}>Level </span>{note.level}</div>}
          {note.length && <div><span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.6rem', opacity: 0.7 }}>Length </span>{note.length}</div>}
        </div>
      )}

      {/* RSVP pins */}
      <div onMouseDown={e => e.stopPropagation()}>
        <RsvpRow note={note} user={user} onRsvpChange={onRsvpChange}/>
      </div>

      {admin && (
        <div style={{ display: 'flex', gap: 4, marginTop: 8, justifyContent: 'flex-end' }}>
          <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onEdit() }}
            style={{ background: 'none', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 3,
              fontSize: '0.62rem', color: '#666', cursor: 'pointer', padding: '2px 6px' }}>✎</button>
          <button onMouseDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onDelete() }}
            style={{ background: 'none', border: '1px solid rgba(180,0,0,0.2)', borderRadius: 3,
              fontSize: '0.62rem', color: '#b44', cursor: 'pointer', padding: '2px 6px' }}>✕</button>
        </div>
      )}
    </div>
  )
}

// ─── Note editor ──────────────────────────────────────────────────────────────
function NoteEditor({ note, onSave, onCancel }) {
  const [draft, setDraft] = useState(note || {
    type: 'adventure', title: '', body: '',
    rewards: '', level: '', length: '', maxPlayers: '',
  })
  const inp = { width: '100%', padding: '6px 8px', border: '1px solid #ccc9c0', borderRadius: 3,
    fontSize: '0.85rem', fontFamily: "'Source Serif 4', Georgia, serif",
    background: '#faf8f4', color: '#222', boxSizing: 'border-box', marginBottom: 8 }
  const lb = { display: 'block', fontSize: '0.67rem', textTransform: 'uppercase',
    letterSpacing: '0.07em', color: '#888', marginBottom: 3 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
      onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fdf8f0', borderRadius: 6, padding: '1.5rem',
        width: 380, maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        fontFamily: "'Source Serif 4', Georgia, serif",
      }}>
        <div style={{ fontFamily: "'IM Fell English', serif", fontSize: '1.1rem', color: '#1b4f72', marginBottom: '1rem' }}>
          {note ? 'Edit Notice' : 'Post a Notice'}
        </div>

        <label style={lb}>Type</label>
        <select style={{ ...inp }} value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value }))}>
          {Object.entries(NOTE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <label style={lb}>Title</label>
        <input style={inp} value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
          placeholder='e.g. Missing Merchant on the Spine Road'/>

        <label style={lb}>Body</label>
        <textarea style={{ ...inp, minHeight: 80, resize: 'vertical', lineHeight: 1.6 }}
          value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))}
          placeholder='Details, contacts, background…'/>

        {draft.type === 'adventure' && (<>
          <label style={lb}>Possible Rewards</label>
          <input style={inp} value={draft.rewards||''} onChange={e => setDraft(d => ({ ...d, rewards: e.target.value }))}
            placeholder='e.g. 200gp, rare components, favour of the Amber Ceremony'/>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 10px' }}>
            <div>
              <label style={lb}>Level Recommendation</label>
              <input style={inp} value={draft.level||''} onChange={e => setDraft(d => ({ ...d, level: e.target.value }))}
                placeholder='e.g. 3–5'/>
            </div>
            <div>
              <label style={lb}>Length</label>
              <input style={inp} value={draft.length||''} onChange={e => setDraft(d => ({ ...d, length: e.target.value }))}
                placeholder='e.g. One session'/>
            </div>
          </div>
        </>)}

        <label style={lb}>Maximum Players <span style={{ opacity: 0.5, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0 }}>(leave blank for no RSVP)</span></label>
        <input style={inp} type='number' min='1' max='20' value={draft.maxPlayers||''}
          onChange={e => setDraft(d => ({ ...d, maxPlayers: e.target.value }))}
          placeholder='e.g. 4'/>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onCancel}
            style={{ padding: '6px 14px', border: '1px solid #ccc9c0', borderRadius: 3,
              background: '#f0eeea', cursor: 'pointer', fontSize: '0.82rem', fontFamily: "'Source Serif 4', Georgia, serif" }}>
            Cancel
          </button>
          <button onClick={() => onSave(draft)} disabled={!draft.title.trim()}
            style={{ padding: '6px 16px', border: 'none', borderRadius: 3,
              background: draft.title.trim() ? '#1b4f72' : '#aaa',
              color: '#fff', cursor: draft.title.trim() ? 'pointer' : 'default',
              fontSize: '0.82rem', fontFamily: "'Source Serif 4', Georgia, serif" }}>
            {note ? 'Save' : 'Pin to Board'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BulletinBoard({ user, onClose }) {
  const admin = isAdmin(user)
  const [mainTab, setMainTab] = useState('notices')  // 'notices' | 'adventures'
  const [notes, setNotes] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(null)
  const [dragging, setDragging] = useState(null)
  const boardRef = useRef(null)
  const writing = useRef(false)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, BOARD_DOC), snap => {
      if (writing.current) return
      if (snap.exists()) setNotes(snap.data().notes || [])
      else setNotes([])
      setLoaded(true)
    }, err => { console.error('Bulletin error:', err); setLoaded(true) })
    return unsub
  }, [])

  const persist = async (newNotes) => {
    writing.current = true
    try {
      await setDoc(doc(db, BOARD_DOC), { notes: newNotes, updatedAt: serverTimestamp() })
    } finally {
      writing.current = false
    }
  }

  const saveNote = (draft) => {
    let newNotes
    if (editing === 'new') {
      const board = boardRef.current
      const w = board?.offsetWidth || 800
      const h = board?.offsetHeight || 600
      newNotes = [...notes, {
        ...draft, id: uid(), rsvps: [],
        x: 60 + Math.floor(Math.random() * (w - 280)),
        y: 40 + Math.floor(Math.random() * (h - 220)),
      }]
    } else {
      // Preserve existing rsvps when editing
      newNotes = notes.map(n => n.id === editing.id ? { ...n, ...draft, rsvps: n.rsvps || [] } : n)
    }
    setNotes(newNotes)
    persist(newNotes)
    setEditing(null)
  }

  const deleteNote = (id) => {
    if (!confirm('Remove this notice from the board?')) return
    const newNotes = notes.filter(n => n.id !== id)
    setNotes(newNotes)
    persist(newNotes)
  }

  const updateRsvp = (noteId, newRsvps) => {
    const newNotes = notes.map(n => n.id === noteId ? { ...n, rsvps: newRsvps } : n)
    setNotes(newNotes)
    persist(newNotes)
  }

  const onNoteMouseDown = useCallback((e, note) => {
    if (!admin) return
    e.preventDefault()
    const board = boardRef.current.getBoundingClientRect()
    setDragging({ id: note.id, offsetX: e.clientX - board.left - note.x, offsetY: e.clientY - board.top - note.y })
  }, [admin])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => {
      const board = boardRef.current?.getBoundingClientRect()
      if (!board) return
      const x = Math.max(0, Math.min(e.clientX - board.left - dragging.offsetX, board.width - 200))
      const y = Math.max(0, Math.min(e.clientY - board.top - dragging.offsetY, board.height - 160))
      setNotes(prev => prev.map(n => n.id === dragging.id ? { ...n, x, y } : n))
    }
    const onUp = () => { setNotes(prev => { persist(prev); return prev }); setDragging(null) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column',
      fontFamily: "'Source Serif 4', Georgia, serif" }}>
      <div style={{ background: '#2a1f0e', borderBottom: '2px solid #5a3e1e',
        padding: '0 1.5rem', height: 50, display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
        <span style={{ fontFamily: "'IM Fell English', serif", fontSize: '1.15rem', color: '#c8a86b' }}>Town Bulletin</span>
        <div style={{ flex: 1 }}/>
        {admin && (
          <button onClick={() => setEditing('new')} style={{ padding: '5px 14px', border: '1px solid #c8a86b',
            borderRadius: 3, background: 'transparent', color: '#c8a86b', cursor: 'pointer',
            fontSize: '0.82rem', fontFamily: "'Source Serif 4', Georgia, serif" }}>+ Post Notice</button>
        )}
        <button onClick={onClose} style={{ padding: '5px 12px', border: '1px solid #5a3e1e', borderRadius: 3,
          background: 'transparent', color: '#9a8a7a', cursor: 'pointer',
          fontSize: '0.82rem', fontFamily: "'Source Serif 4', Georgia, serif" }}>← Back</button>
      </div>

      {/* Tab bar */}
      <div style={{ background: '#231a0e', borderBottom: '1px solid #5a3e1e',
        display: 'flex', padding: '0 1.5rem', gap: 2, flexShrink: 0 }}>
        {[['notices','📌 Notices'],['adventures','⚔ Adventures']].map(([id, label]) => (
          <button key={id} onClick={() => setMainTab(id)}
            style={{ padding: '8px 16px 6px', border: 'none', background: 'none', cursor: 'pointer',
              fontFamily: "'IM Fell English', serif", fontSize: '0.88rem',
              color: mainTab === id ? '#c8a86b' : '#6a5a4a',
              borderBottom: mainTab === id ? '2px solid #c8a86b' : '2px solid transparent',
              transition: 'color 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Adventures tab */}
      {mainTab === 'adventures' && (
        <div style={{ flex: 1, overflow: 'hidden', background: '#fdf8f0', display: 'flex', flexDirection: 'column' }}>
          <Adventures user={user}/>
        </div>
      )}

      {/* Notices corkboard */}
      {mainTab === 'notices' && <>
        <div ref={boardRef} style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          background: '#c4924a',
          backgroundImage: `
            radial-gradient(ellipse at 20% 30%, rgba(180,120,40,0.4) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 70%, rgba(140,80,20,0.3) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(200,150,80,0.2) 0%, transparent 70%),
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect width='4' height='4' fill='%23c4924a'/%3E%3Ccircle cx='1' cy='1' r='0.5' fill='rgba(0,0,0,0.07)'/%3E%3Ccircle cx='3' cy='3' r='0.4' fill='rgba(0,0,0,0.05)'/%3E%3C/svg%3E")
          `,
        }}>
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
            boxShadow: 'inset 0 0 60px rgba(0,0,0,0.35)' }}/>
          {!loaded && (
            <div style={{ color: '#8a6a3a', fontSize: '0.9rem', fontStyle: 'italic',
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
              Reading the board…
            </div>
          )}
          {loaded && notes.length === 0 && (
            <div style={{ color: '#8a6a3a', fontSize: '0.9rem', fontStyle: 'italic',
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              textAlign: 'center', pointerEvents: 'none' }}>
              {admin ? 'The board is empty. Post a notice to get started.' : 'No notices posted yet.'}
            </div>
          )}
          {notes.map(note => (
            <NoteCard key={note.id} note={note} admin={admin} user={user}
              isDragging={dragging?.id === note.id}
              onDragStart={(e) => onNoteMouseDown(e, note)}
              onEdit={() => setEditing(note)}
              onDelete={() => deleteNote(note.id)}
              onRsvpChange={(newRsvps) => updateRsvp(note.id, newRsvps)}/>
          ))}
        </div>
        {editing && (
          <NoteEditor note={editing === 'new' ? null : editing}
            onSave={saveNote} onCancel={() => setEditing(null)}/>
        )}
      </>}
    </div>
  )
}
