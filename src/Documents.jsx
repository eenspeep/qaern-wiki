import { useState, useEffect, useRef } from 'react'
import {
  collection, onSnapshot, addDoc, deleteDoc,
  doc, serverTimestamp, updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'

const ADMIN = 'speep'
const isAdmin = u => u?.displayName === ADMIN

// Convert any Google Drive share/view URL → embed preview URL
function toEmbedUrl(raw) {
  const m = raw.match(/\/file\/d\/([^/?&#\s]+)/)
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`
  if (raw.startsWith('https://')) return raw
  return `https://drive.google.com/file/d/${raw.trim()}/preview`
}

function useIsMobile(bp = 680) {
  const [m, setM] = useState(() => window.innerWidth < bp)
  useEffect(() => {
    const h = () => setM(window.innerWidth < bp)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [bp])
  return m
}

const BLANK = { title: '', description: '', url: '' }

// ─── Individual document card ─────────────────────────────────────────────────
function DocCard({ item, admin, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false)
  const isMobile = useIsMobile()

  return (
    <div style={{
      border: '1px solid #ccc9c0', borderRadius: 5, overflow: 'hidden',
      marginBottom: '0.75rem', background: '#faf9f6',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* Card header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0.6rem 0.9rem', cursor: 'pointer', userSelect: 'none',
        background: expanded ? '#f0eeea' : '#faf9f6',
        borderBottom: expanded ? '1px solid #ccc9c0' : 'none',
        transition: 'background 0.15s',
      }} onClick={() => setExpanded(e => !e)}>
        <span style={{ fontSize: '1rem', flexShrink: 0 }}>
          {expanded ? '▼' : '▶'}
        </span>
        <span style={{ fontFamily: "'IM Fell English',serif", fontSize: '1.05rem', color: '#1a1a1a', flex: 1 }}>
          {item.title}
        </span>
        {item.description && !expanded && (
          <span style={{ fontSize: '0.78rem', color: '#888', fontStyle: 'italic', maxWidth: isMobile ? 100 : 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.description}
          </span>
        )}
        {admin && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => onEdit(item)}
              style={{ padding: '2px 7px', border: '1px solid #ccc9c0', borderRadius: 3, background: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#666' }}>
              ✎
            </button>
            <button onClick={() => onDelete(item.id)}
              style={{ padding: '2px 7px', border: '1px solid #e0b0b0', borderRadius: 3, background: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#b44' }}>
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div>
          {item.description && (
            <div style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem', color: '#555', fontStyle: 'italic', borderBottom: '1px solid #e8e5e0' }}>
              {item.description}
            </div>
          )}
          <div style={{ position: 'relative', width: '100%', paddingBottom: isMobile ? '140%' : '75%', background: '#222' }}>
            <iframe
              src={item.url}
              title={item.title}
              allow="autoplay"
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                border: 'none',
              }}
            />
          </div>
          <div style={{ padding: '4px 10px 5px', background: '#f0eeea', fontSize: '0.7rem', color: '#aaa', textAlign: 'right' }}>
            <a href={item.url.replace('/preview', '/view')} target='_blank' rel='noreferrer'
              style={{ color: '#1b4f72', textDecoration: 'none' }}>
              Open in Google Drive ↗
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Add / Edit form ──────────────────────────────────────────────────────────
function DocForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || BLANK)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const valid = form.title.trim() && form.url.trim()

  return (
    <div style={{
      background: '#f8f7f4', border: '1px solid #ccc9c0', borderRadius: 5,
      padding: '1rem', marginBottom: '1rem',
    }}>
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'block', fontSize: '0.67rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', marginBottom: 3 }}>
          Title *
        </label>
        <input value={form.title} onChange={e => f('title', e.target.value)}
          placeholder='e.g. Session 1 Notes'
          style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc9c0', borderRadius: 3, fontSize: '0.88rem', fontFamily: "'Source Serif 4',Georgia,serif", background: '#fff', color: '#222', boxSizing: 'border-box' }}/>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'block', fontSize: '0.67rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', marginBottom: 3 }}>
          Description
        </label>
        <input value={form.description} onChange={e => f('description', e.target.value)}
          placeholder='Optional short description'
          style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc9c0', borderRadius: 3, fontSize: '0.88rem', fontFamily: "'Source Serif 4',Georgia,serif", background: '#fff', color: '#222', boxSizing: 'border-box' }}/>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: '0.67rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', marginBottom: 3 }}>
          Google Drive URL *
        </label>
        <input value={form.url} onChange={e => f('url', e.target.value)}
          placeholder='https://drive.google.com/file/d/…/view'
          style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc9c0', borderRadius: 3, fontSize: '0.82rem', fontFamily: 'monospace', background: '#fff', color: '#222', boxSizing: 'border-box' }}/>
        <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: 3 }}>
          Paste any Google Drive share link — the file must be shared as "Anyone with the link can view".
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => valid && onSave(form)} disabled={!valid}
          style={{ padding: '5px 14px', border: 'none', borderRadius: 3, background: valid ? '#1b4f72' : '#ccc', color: '#fff', cursor: valid ? 'pointer' : 'default', fontSize: '0.83rem', fontFamily: "'Source Serif 4',Georgia,serif" }}>
          Save
        </button>
        <button onClick={onCancel}
          style={{ padding: '5px 10px', border: '1px solid #ccc9c0', borderRadius: 3, background: 'none', cursor: 'pointer', fontSize: '0.83rem', color: '#666' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Documents modal ──────────────────────────────────────────────────────────
export default function Documents({ user, onClose }) {
  const [docs, setDocs] = useState([])
  const [adding, setAdding] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const admin = isAdmin(user)

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'documents'), snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      items.sort((a, b) =>
        (a.order ?? 9999) - (b.order ?? 9999) ||
        (a.addedAt?.seconds ?? 0) - (b.addedAt?.seconds ?? 0)
      )
      setDocs(items)
    })
    return unsub
  }, [])

  const saveNew = async (form) => {
    await addDoc(collection(db, 'documents'), {
      title: form.title.trim(),
      description: form.description.trim(),
      url: toEmbedUrl(form.url.trim()),
      order: docs.length,
      addedBy: user.displayName || user.email,
      addedAt: serverTimestamp(),
    })
    setAdding(false)
  }

  const saveEdit = async (form) => {
    await updateDoc(doc(db, 'documents', editItem.id), {
      title: form.title.trim(),
      description: form.description.trim(),
      url: toEmbedUrl(form.url.trim()),
    })
    setEditItem(null)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this document?')) return
    await deleteDoc(doc(db, 'documents', id))
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#f8f7f4', display: 'flex', flexDirection: 'column',
      fontFamily: "'Source Serif 4',Georgia,serif",
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 1rem', height: 50, flexShrink: 0,
        borderBottom: '1px solid #ccc9c0', background: '#f0eeea',
      }}>
        <span style={{ fontFamily: "'IM Fell English',serif", fontSize: '1.2rem', color: '#1b4f72', flex: 1 }}>
          📄 Documents
        </span>
        {admin && !adding && !editItem && (
          <button onClick={() => setAdding(true)}
            style={{ padding: '4px 12px', border: 'none', borderRadius: 3, background: '#1b4f72', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontFamily: "'Source Serif 4',Georgia,serif" }}>
            + Add Document
          </button>
        )}
        <button onClick={onClose}
          style={{ padding: '4px 10px', border: '1px solid #ccc9c0', borderRadius: 3, background: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#666' }}>
          ✕ Close
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem', maxWidth: 900, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {adding && (
          <DocForm onSave={saveNew} onCancel={() => setAdding(false)} />
        )}
        {editItem && (
          <DocForm initial={editItem} onSave={saveEdit} onCancel={() => setEditItem(null)} />
        )}

        {docs.length === 0 && !adding && (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: '#aaa', fontSize: '0.9rem', fontStyle: 'italic' }}>
            No documents yet.{admin && ' Use "+ Add Document" to embed a Google Drive PDF.'}
          </div>
        )}

        {docs.map(item => (
          <DocCard
            key={item.id}
            item={item}
            admin={admin}
            onDelete={handleDelete}
            onEdit={i => { setEditItem(i); setAdding(false) }}
          />
        ))}
      </div>
    </div>
  )
}
