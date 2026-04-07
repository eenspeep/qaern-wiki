import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, addDoc, deleteDoc,
  doc, serverTimestamp, updateDoc, setDoc,
} from 'firebase/firestore'
import { db } from './firebase'

const ADMIN = 'speep'
const isAdmin = u => u?.displayName === ADMIN
const BLANK = { title: '', description: '', url: '', category: '', gmOnly: false }
const GM_HASH = btoa('Mnemovex') // trivial obfuscation; this is a casual lock not a security boundary
const checkGmPassword = pw => btoa(pw) === GM_HASH

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

// ─── Category tree helpers ────────────────────────────────────────────────────
function flattenCategories(cats, prefix = '') {
  const result = []
  cats.forEach(c => {
    const path = prefix ? `${prefix} > ${c.name}` : c.name
    result.push(path)
    if (c.subcategories?.length) result.push(...flattenCategories(c.subcategories, path))
  })
  return result
}
function cloneCatNode(c) {
  return { name: c.name, subcategories: (c.subcategories || []).map(cloneCatNode) }
}
function insertCatPath(nodes, parts) {
  if (!parts.length) return
  let node = nodes.find(n => n.name === parts[0])
  if (!node) { node = { name: parts[0], subcategories: [] }; nodes.push(node) }
  insertCatPath(node.subcategories, parts.slice(1))
}
function removeCatFromTree(nodes, parts) {
  if (parts.length === 1) {
    const idx = nodes.findIndex(n => n.name === parts[0])
    if (idx >= 0) nodes.splice(idx, 1)
    return
  }
  const node = nodes.find(n => n.name === parts[0])
  if (node) removeCatFromTree(node.subcategories, parts.slice(1))
}

// ─── Fullscreen overlay ───────────────────────────────────────────────────────
function FullscreenViewer({ item, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: '#111', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 1rem', height: 44, flexShrink: 0, background: '#1a1a1a', borderBottom: '1px solid #333' }}>
        <span style={{ fontFamily: "'IM Fell English',serif", color: '#ddd', flex: 1, fontSize: '1rem' }}>{item.title}</span>
        <a href={item.url.replace('/preview', '/view')} target='_blank' rel='noreferrer'
          style={{ color: '#aaa', fontSize: '0.78rem', textDecoration: 'none' }}>Open in Drive ↗</a>
        <button type='button' onClick={onClose}
          style={{ padding: '4px 10px', border: '1px solid #555', borderRadius: 3, background: 'none', cursor: 'pointer', color: '#ccc', fontSize: '0.85rem' }}>
          ✕ Close
        </button>
      </div>
      <iframe src={item.url} title={item.title} allow="autoplay"
        style={{ flex: 1, border: 'none', width: '100%' }}/>
    </div>
  )
}

// ─── GM password modal ───────────────────────────────────────────────────────
function GmPasswordModal({ onUnlock, onCancel }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  const submit = () => {
    if (checkGmPassword(value)) { onUnlock() }
    else { setError(true); setValue('') }
  }

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onCancel])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#f8f7f4', border: '1px solid #ccc9c0', borderRadius: 6, padding: '1.5rem', width: 300, fontFamily: "'Source Serif 4',Georgia,serif", boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ fontFamily: "'IM Fell English',serif", fontSize: '1.1rem', color: '#1a1a1a', marginBottom: '0.4rem' }}>🔒 GM Only</div>
        <div style={{ fontSize: '0.84rem', color: '#666', marginBottom: '1rem', lineHeight: 1.5 }}>This document is restricted to the GM. Enter the password to view it.</div>
        <input autoFocus type='password' value={value}
          onChange={e => { setValue(e.target.value); setError(false) }}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder='Password…'
          style={{ width: '100%', padding: '6px 8px', border: `1px solid ${error ? '#e0b0b0' : '#ccc9c0'}`, borderRadius: 3, fontSize: '0.88rem', fontFamily: "'Source Serif 4',Georgia,serif", background: '#fff', color: '#222', boxSizing: 'border-box' }}/>
        {error && <div style={{ fontSize: '0.74rem', color: '#b44', marginTop: 4 }}>Incorrect password.</div>}
        <div style={{ display: 'flex', gap: 6, marginTop: '0.9rem' }}>
          <button type='button' onClick={submit}
            style={{ padding: '5px 14px', border: 'none', borderRadius: 3, background: '#1b4f72', color: '#fff', cursor: 'pointer', fontSize: '0.83rem', fontFamily: "'Source Serif 4',Georgia,serif" }}>
            Unlock
          </button>
          <button type='button' onClick={onCancel}
            style={{ padding: '5px 10px', border: '1px solid #ccc9c0', borderRadius: 3, background: 'none', cursor: 'pointer', fontSize: '0.83rem', color: '#666' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Document card ────────────────────────────────────────────────────────────
function DocCard({ item, admin, gmUnlocked, onDelete, onEdit, onGmRequest, onOpen }) {
  const locked = item.gmOnly && !gmUnlocked
  const open = () => locked ? onGmRequest(item) : onOpen(item)

  return (
    <>
      <div style={{ border: `1px solid ${locked ? '#c8b8a8' : '#ccc9c0'}`, borderRadius: 5, overflow: 'hidden', marginBottom: '0.6rem', background: locked ? '#fdf8f4' : '#faf9f6', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.55rem 0.85rem' }}>
          {item.gmOnly && (
            <span title='GM only' style={{ fontSize: '0.72rem', flexShrink: 0, opacity: locked ? 1 : 0.4 }}>🔒</span>
          )}
          <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={open}>
            <div style={{ fontFamily: "'IM Fell English',serif", fontSize: '1rem', color: locked ? '#8a6a5a' : '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {item.title}
            </div>
            {item.description && (
              <div style={{ fontSize: '0.74rem', color: '#888', fontStyle: 'italic', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.description}
              </div>
            )}
          </div>
          <button type='button' onClick={open} title={locked ? 'GM only — enter password' : 'Open document'}
            style={{ background: 'none', border: `1px solid ${locked ? '#c8b8a8' : '#ccc9c0'}`, cursor: 'pointer', fontSize: '0.82rem', color: locked ? '#a08060' : '#888', padding: '2px 7px', borderRadius: 3, flexShrink: 0 }}>
            {locked ? '🔒' : '⛶'}
          </button>
          {admin && (
            <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
              <button type='button' onClick={() => onEdit(item)}
                style={{ padding: '2px 6px', border: '1px solid #ccc9c0', borderRadius: 3, background: 'none', cursor: 'pointer', fontSize: '0.7rem', color: '#666' }}>✎</button>
              <button type='button' onClick={() => onDelete(item.id)}
                style={{ padding: '2px 6px', border: '1px solid #e0b0b0', borderRadius: 3, background: 'none', cursor: 'pointer', fontSize: '0.7rem', color: '#b44' }}>✕</button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Add / Edit form ──────────────────────────────────────────────────────────
function DocForm({ initial, allCategories, defaultCategory, onSave, onCancel }) {
  const [form, setForm] = useState(() => initial
    ? { title: initial.title, description: initial.description || '', url: initial.url, category: initial.category || '' }
    : { ...BLANK, category: defaultCategory || '' }
  )
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const valid = form.title.trim() && form.url.trim()
  const lbl = { display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', marginBottom: 3 }
  const inp = { width: '100%', padding: '6px 8px', border: '1px solid #ccc9c0', borderRadius: 3, fontSize: '0.87rem', fontFamily: "'Source Serif 4',Georgia,serif", background: '#fff', color: '#222', boxSizing: 'border-box' }

  return (
    <div style={{ background: '#f0eeea', border: '1px solid #ccc9c0', borderRadius: 5, padding: '1rem', marginBottom: '1rem' }}>
      <div style={{ marginBottom: 8 }}>
        <label style={lbl}>Title *</label>
        <input value={form.title} onChange={e => f('title', e.target.value)} placeholder='e.g. Session 1 Notes' style={inp}/>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={lbl}>Description</label>
        <input value={form.description} onChange={e => f('description', e.target.value)} placeholder='Optional short description' style={inp}/>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={lbl}>Category</label>
        <select value={form.category} onChange={e => f('category', e.target.value)} style={inp}>
          <option value=''>— Uncategorised —</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.84rem', color: '#555' }}>
          <input type='checkbox' checked={!!form.gmOnly} onChange={e => f('gmOnly', e.target.checked)}/>
          🔒 GM only — require password to open
        </label>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Google Drive URL *</label>
        <input value={form.url} onChange={e => f('url', e.target.value)} placeholder='https://drive.google.com/file/d/…/view'
          style={{ ...inp, fontFamily: 'monospace', fontSize: '0.82rem' }}/>
        <div style={{ fontSize: '0.68rem', color: '#aaa', marginTop: 3 }}>File must be shared as "Anyone with the link can view".</div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type='button' onClick={() => valid && onSave(form)} disabled={!valid}
          style={{ padding: '5px 14px', border: 'none', borderRadius: 3, background: valid ? '#1b4f72' : '#ccc', color: '#fff', cursor: valid ? 'pointer' : 'default', fontSize: '0.83rem', fontFamily: "'Source Serif 4',Georgia,serif" }}>
          Save
        </button>
        <button type='button' onClick={onCancel}
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
  const [categories, setCategories] = useState([])
  const [selectedCat, setSelectedCat] = useState(null) // null = All
  const [collapsedCats, setCollapsedCats] = useState({})
  const [editingCat, setEditingCat] = useState(null)   // { path, value }
  const [addingSubTo, setAddingSubTo] = useState(null) // path string
  const [newCatInput, setNewCatInput] = useState('')
  const [showNewCatInput, setShowNewCatInput] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [gmUnlocked, setGmUnlocked] = useState(false)
  const [pendingGmDoc, setPendingGmDoc] = useState(null)
  const [viewingDoc, setViewingDoc] = useState(null)
  const admin = isAdmin(user)
  const isMobile = useIsMobile()

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

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'documents_meta', 'config'), snap => {
      if (snap.exists()) setCategories(snap.data().categories || [])
    })
    return unsub
  }, [])

  const persistCategories = tree => {
    setCategories(tree)
    setDoc(doc(db, 'documents_meta', 'config'), { categories: tree })
  }

  // Merge stored tree with any category paths that exist on docs
  const catTree = (() => {
    const cloned = categories.map(cloneCatNode)
    docs.forEach(d => { if (d.category) insertCatPath(cloned, d.category.split(' > ')) })
    return cloned
  })()

  const allFlatCategories = flattenCategories(catTree)
  const toggleCat = path => setCollapsedCats(c => ({ ...c, [path]: !c[path] }))

  const addTopCategory = () => {
    const name = newCatInput.trim()
    if (!name) return
    const cloned = categories.map(cloneCatNode)
    if (!cloned.find(n => n.name === name)) cloned.push({ name, subcategories: [] })
    persistCategories(cloned)
    setNewCatInput('')
    setShowNewCatInput(false)
  }

  const addSubcategory = (parentPath, childName) => {
    const name = childName.trim()
    if (!name) return
    const cloned = categories.map(cloneCatNode)
    let nodes = cloned
    for (const part of parentPath.split(' > ')) {
      let node = nodes.find(n => n.name === part)
      if (!node) { node = { name: part, subcategories: [] }; nodes.push(node) }
      nodes = node.subcategories
    }
    if (!nodes.find(n => n.name === name)) nodes.push({ name, subcategories: [] })
    persistCategories(cloned)
  }

  const renameCategory = async (oldPath, newName) => {
    const trimmed = newName.trim()
    if (!trimmed) return
    const parts = oldPath.split(' > ')
    const newPath = [...parts.slice(0, -1), trimmed].join(' > ')
    if (newPath === oldPath) return

    await Promise.all(docs
      .filter(d => d.category === oldPath || d.category?.startsWith(oldPath + ' > '))
      .map(d => updateDoc(doc(db, 'documents', d.id), {
        category: d.category === oldPath ? newPath : newPath + d.category.slice(oldPath.length),
      }))
    )

    const cloned = categories.map(cloneCatNode)
    let nodes = cloned
    for (let i = 0; i < parts.length - 1; i++) {
      const node = nodes.find(n => n.name === parts[i])
      if (!node) return
      nodes = node.subcategories
    }
    const node = nodes.find(n => n.name === parts[parts.length - 1])
    if (node) node.name = trimmed
    persistCategories(cloned)
    if (selectedCat === oldPath || selectedCat?.startsWith(oldPath + ' > '))
      setSelectedCat(newPath)
  }

  const deleteCategory = async path => {
    const affected = docs.filter(d => d.category === path || d.category?.startsWith(path + ' > '))
    const msg = affected.length
      ? `Delete "${path}"? ${affected.length} document(s) will become uncategorised.`
      : `Delete "${path}"?`
    if (!window.confirm(msg)) return
    await Promise.all(affected.map(d => updateDoc(doc(db, 'documents', d.id), { category: '' })))
    const cloned = categories.map(cloneCatNode)
    removeCatFromTree(cloned, path.split(' > '))
    persistCategories(cloned)
    if (selectedCat === path || selectedCat?.startsWith(path + ' > ')) setSelectedCat(null)
  }

  const saveNew = async form => {
    await addDoc(collection(db, 'documents'), {
      title: form.title.trim(), description: form.description.trim(),
      url: toEmbedUrl(form.url.trim()), category: form.category || '',
      gmOnly: !!form.gmOnly, order: docs.length,
      addedBy: user.displayName || user.email, addedAt: serverTimestamp(),
    })
    setAdding(false)
  }

  const saveEdit = async form => {
    await updateDoc(doc(db, 'documents', editItem.id), {
      title: form.title.trim(), description: form.description.trim(),
      url: toEmbedUrl(form.url.trim()), category: form.category || '',
      gmOnly: !!form.gmOnly,
    })
    setEditItem(null)
  }

  const handleDelete = async id => {
    if (!window.confirm('Remove this document?')) return
    await deleteDoc(doc(db, 'documents', id))
  }

  const visibleDocs = selectedCat === null ? docs : docs.filter(d => d.category === selectedCat)

  // ─── Recursive category sidebar renderer ─────────────────────────────────────
  const renderCatNode = (node, parentPath, depth) => {
    const path = parentPath ? `${parentPath} > ${node.name}` : node.name
    const collapsed = !!collapsedCats[path]
    const isSelected = selectedCat === path
    const isEditing = editingCat?.path === path
    const isAddingSub = addingSubTo === path
    const indent = 10 + depth * 12

    return (
      <div key={path}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: `${depth ? 3 : 4}px 6px 2px ${indent}px` }}>
          <button type='button' onClick={() => toggleCat(path)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '0.5rem', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>
            {collapsed ? '▶' : '▼'}
          </button>
          {isEditing
            ? <input autoFocus value={editingCat.value}
                onChange={e => setEditingCat(p => ({ ...p, value: e.target.value }))}
                onBlur={() => { renameCategory(path, editingCat.value); setEditingCat(null) }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { renameCategory(path, editingCat.value); setEditingCat(null) }
                  if (e.key === 'Escape') setEditingCat(null)
                }}
                style={{ flex: 1, fontSize: '0.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '1px 4px', border: '1px solid #1b4f72', borderRadius: 2, background: '#fff', color: '#222', minWidth: 0 }}/>
            : <button type='button' onClick={() => setSelectedCat(isSelected ? null : path)}
                style={{ flex: 1, background: isSelected ? '#e2dfd8' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '2px 4px', borderRadius: 3,
                  fontSize: '0.63rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700,
                  color: isSelected ? '#1b4f72' : depth ? '#888' : '#666' }}>
                {depth > 0 && '↳ '}{node.name}
              </button>
          }
          {admin && !isEditing && (
            <>
              <button type='button' onClick={() => setEditingCat({ path, value: node.name })} title='Rename'
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '0.55rem', padding: '0 1px', lineHeight: 1, flexShrink: 0, opacity: 0.8 }}>✎</button>
              <button type='button' onClick={() => setAddingSubTo(isAddingSub ? null : path)} title='Add subcategory'
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '0.68rem', padding: '0 1px', lineHeight: 1, flexShrink: 0, opacity: 0.8 }}>⊕</button>
              <button type='button' onClick={() => deleteCategory(path)} title='Delete'
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '0.58rem', padding: '0 1px', lineHeight: 1, flexShrink: 0, opacity: 0.8 }}>✕</button>
            </>
          )}
        </div>
        {isAddingSub && (
          <div style={{ display: 'flex', gap: 3, padding: `3px 8px 3px ${indent + 18}px` }}>
            <input autoFocus placeholder='Subcategory name…'
              onKeyDown={e => {
                if (e.key === 'Enter' && e.target.value.trim()) { addSubcategory(path, e.target.value); setAddingSubTo(null) }
                if (e.key === 'Escape') setAddingSubTo(null)
              }}
              style={{ flex: 1, padding: '2px 5px', border: '1px solid #ccc9c0', borderRadius: 3, fontSize: '0.73rem', fontFamily: "'Source Serif 4',Georgia,serif", background: '#f8f7f4', color: '#222', minWidth: 0 }}/>
            <button type='button' onClick={e => { const inp = e.target.previousSibling; if (inp.value.trim()) { addSubcategory(path, inp.value); setAddingSubTo(null) } }}
              style={{ padding: '2px 6px', border: 'none', borderRadius: 3, background: '#1b4f72', color: '#fff', cursor: 'pointer', fontSize: '0.72rem' }}>+</button>
          </div>
        )}
        {!collapsed && node.subcategories?.map(sub => renderCatNode(sub, path, depth + 1))}
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#f8f7f4', display: 'flex', flexDirection: 'column', fontFamily: "'Source Serif 4',Georgia,serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 1rem', height: 50, flexShrink: 0, borderBottom: '1px solid #ccc9c0', background: '#f0eeea' }}>
        <span style={{ fontFamily: "'IM Fell English',serif", fontSize: '1.2rem', color: '#1b4f72', flex: 1 }}>📄 Documents</span>
        {admin && !adding && !editItem && (
          <button type='button' onClick={() => setAdding(true)}
            style={{ padding: '4px 12px', border: 'none', borderRadius: 3, background: '#1b4f72', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontFamily: "'Source Serif 4',Georgia,serif" }}>
            + Add Document
          </button>
        )}
        <button type='button' onClick={onClose}
          style={{ padding: '4px 10px', border: '1px solid #ccc9c0', borderRadius: 3, background: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#666' }}>
          ✕ Close
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Sidebar */}
        {!isMobile && (
          <div style={{ width: 210, flexShrink: 0, borderRight: '1px solid #ccc9c0', background: '#f0eeea', overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '0.4rem 0' }}>
            <button type='button' onClick={() => setSelectedCat(null)}
              style={{ display: 'block', width: '100%', padding: '5px 14px', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem', fontFamily: "'Source Serif 4',Georgia,serif",
                background: selectedCat === null ? '#e2dfd8' : 'none', color: selectedCat === null ? '#1b4f72' : '#555', fontWeight: selectedCat === null ? 700 : 400, borderRadius: 0 }}>
              All Documents
            </button>
            <div style={{ flex: 1, marginTop: 4 }}>
              {catTree.map(node => renderCatNode(node, '', 0))}
            </div>
            <div style={{ borderTop: '1px solid #ccc9c0', padding: '6px 8px' }}>
              {admin && (showNewCatInput
                ? <div style={{ display: 'flex', gap: 3 }}>
                    <input autoFocus value={newCatInput} onChange={e => setNewCatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addTopCategory(); if (e.key === 'Escape') { setShowNewCatInput(false); setNewCatInput('') } }}
                      placeholder='Category name…'
                      style={{ flex: 1, padding: '3px 5px', border: '1px solid #ccc9c0', borderRadius: 3, fontSize: '0.75rem', fontFamily: "'Source Serif 4',Georgia,serif", background: '#f8f7f4', color: '#222', minWidth: 0 }}/>
                    <button type='button' onClick={addTopCategory}
                      style={{ padding: '3px 6px', border: 'none', borderRadius: 3, background: '#1b4f72', color: '#fff', cursor: 'pointer', fontSize: '0.72rem' }}>+</button>
                    <button type='button' onClick={() => { setShowNewCatInput(false); setNewCatInput('') }}
                      style={{ padding: '3px 5px', border: '1px solid #ccc9c0', borderRadius: 3, background: 'none', cursor: 'pointer', fontSize: '0.72rem', color: '#888' }}>✕</button>
                  </div>
                : <button type='button' onClick={() => setShowNewCatInput(true)}
                    style={{ width: '100%', padding: '4px 8px', border: '1px dashed #ccc9c0', borderRadius: 3, background: 'none', cursor: 'pointer', fontSize: '0.73rem', color: '#888', textAlign: 'left', fontFamily: "'Source Serif 4',Georgia,serif" }}>
                    + New Category
                  </button>
              )}
            </div>
          </div>
        )}

        {/* Main content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '1rem' : '1.25rem 1.75rem' }}>

          {/* Mobile: category dropdown */}
          {isMobile && (
            <select value={selectedCat ?? ''} onChange={e => setSelectedCat(e.target.value || null)}
              style={{ width: '100%', marginBottom: '0.75rem', padding: '6px 8px', border: '1px solid #ccc9c0', borderRadius: 3, fontSize: '0.87rem', fontFamily: "'Source Serif 4',Georgia,serif", background: '#f8f7f4', color: '#222' }}>
              <option value=''>All Documents</option>
              {allFlatCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          {/* Add / Edit form */}
          {(adding || editItem) && (
            <DocForm
              initial={editItem || null}
              allCategories={allFlatCategories}
              defaultCategory={selectedCat || ''}
              onSave={adding ? saveNew : saveEdit}
              onCancel={() => { setAdding(false); setEditItem(null) }}
            />
          )}

          {/* Category breadcrumb */}
          {selectedCat && (
            <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#aaa', marginBottom: '0.75rem' }}>
              {selectedCat}
            </div>
          )}

          {/* Empty state */}
          {visibleDocs.length === 0 && !adding && (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: '#aaa', fontSize: '0.9rem', fontStyle: 'italic' }}>
              {selectedCat ? `No documents in "${selectedCat}".` : 'No documents yet.'}
              {admin && ' Use "+ Add Document" to add one.'}
            </div>
          )}

          {/* Document cards */}
          {visibleDocs.map(item => (
            <DocCard key={item.id} item={item} admin={admin} gmUnlocked={gmUnlocked}
              onDelete={handleDelete}
              onEdit={i => { setEditItem(i); setAdding(false) }}
              onOpen={i => setViewingDoc(i)}
              onGmRequest={i => setPendingGmDoc(i)}
            />
          ))}
        </div>
      </div>

      {viewingDoc && <FullscreenViewer item={viewingDoc} onClose={() => setViewingDoc(null)}/>}

      {pendingGmDoc && (
        <GmPasswordModal
          onUnlock={() => { setGmUnlocked(true); setViewingDoc(pendingGmDoc); setPendingGmDoc(null) }}
          onCancel={() => setPendingGmDoc(null)}
        />
      )}
    </div>
  )
}
