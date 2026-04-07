import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, addDoc, deleteDoc,
  doc, serverTimestamp, updateDoc, setDoc,
} from 'firebase/firestore'
import { db } from './firebase'

const ADMIN = 'speep'
const isAdmin = u => u?.displayName === ADMIN
const BLANK = { name: '', portrait: '', description: '', details: '', category: '' }

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

function useIsMobile(bp = 680) {
  const [m, setM] = useState(() => window.innerWidth < bp)
  useEffect(() => {
    const h = () => setM(window.innerWidth < bp)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [bp])
  return m
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ person, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <img src={person.portrait} alt={person.name}
          style={{ maxWidth: '88vw', maxHeight: '78vh', objectFit: 'contain', borderRadius: 6, boxShadow: '0 8px 48px rgba(0,0,0,0.7)' }}/>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'IM Fell English',serif", fontSize: '1.4rem', color: '#f0ead8' }}>{person.name}</div>
          {person.description && <div style={{ fontSize: '0.86rem', color: '#bbb', fontStyle: 'italic', marginTop: 4 }}>{person.description}</div>}
        </div>
        <button onClick={onClose}
          style={{ position: 'absolute', top: -12, right: -12, width: 28, height: 28, borderRadius: '50%', background: '#333', border: '1px solid #666', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', lineHeight: 1 }}>
          ✕
        </button>
      </div>
    </div>
  )
}

// ─── NPC card ─────────────────────────────────────────────────────────────────
function NpcCard({ person, admin, onEdit, onDelete, onLightbox }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 10, overflow: 'hidden',
        border: '1px solid #ccc9c0',
        background: '#faf9f6',
        boxShadow: hovered ? '0 6px 20px rgba(0,0,0,0.13)' : '0 1px 4px rgba(0,0,0,0.07)',
        transition: 'box-shadow 0.18s, transform 0.18s',
        transform: hovered ? 'translateY(-2px)' : 'none',
        position: 'relative', userSelect: 'none',
      }}>
      {/* Portrait area */}
      <div style={{ position: 'relative', width: '100%', paddingBottom: '100%', background: '#e8e4de', overflow: 'hidden', cursor: person.portrait ? 'zoom-in' : 'default' }}
        onClick={() => person.portrait && onLightbox(person)}>
        {person.portrait
          ? <img src={person.portrait} alt={person.name}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}/>
          : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '4rem', color: '#c0bab0', fontFamily: "'IM Fell English',serif" }}>
                {person.name?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
        }
        {/* Hover details overlay */}
        {hovered && person.details && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(12,9,6,0.8)',
            display: 'flex', alignItems: 'flex-end', padding: '0.75rem',
            backdropFilter: 'blur(1px)',
          }}>
            <p style={{ color: '#f0ead8', fontSize: '0.8rem', lineHeight: 1.55, fontFamily: "'Source Serif 4',Georgia,serif", margin: 0, fontStyle: 'italic' }}>
              {person.details}
            </p>
          </div>
        )}
      </div>

      {/* Name + short description */}
      <div style={{ padding: '0.5rem 0.7rem 0.6rem' }}>
        <div style={{ fontFamily: "'IM Fell English',serif", fontSize: '0.97rem', color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {person.name}
        </div>
        {person.description && (
          <div style={{ fontSize: '0.72rem', color: '#888', fontStyle: 'italic', lineHeight: 1.4, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {person.description}
          </div>
        )}
      </div>

      {/* Admin controls — float top-right, visible on hover */}
      {admin && hovered && (
        <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 3 }}
          onClick={e => e.stopPropagation()}>
          <button type='button' onClick={() => onEdit(person)}
            style={{ padding: '2px 7px', border: '1px solid rgba(255,255,255,0.5)', borderRadius: 3, background: 'rgba(0,0,0,0.55)', cursor: 'pointer', fontSize: '0.7rem', color: '#eee' }}>✎</button>
          <button type='button' onClick={() => onDelete(person.id)}
            style={{ padding: '2px 7px', border: '1px solid rgba(255,80,80,0.4)', borderRadius: 3, background: 'rgba(0,0,0,0.55)', cursor: 'pointer', fontSize: '0.7rem', color: '#f99' }}>✕</button>
        </div>
      )}
    </div>
  )
}

// ─── Add / Edit form (modal) ──────────────────────────────────────────────────
function PersonForm({ initial, allCategories, defaultCategory, onSave, onCancel }) {
  const [form, setForm] = useState(initial ? { ...BLANK, ...initial } : { ...BLANK, category: defaultCategory || '' })
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const valid = form.name.trim()
  const lbl = { display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', marginBottom: 3 }
  const inp = { width: '100%', padding: '6px 8px', border: '1px solid #ccc9c0', borderRadius: 3, fontSize: '0.87rem', fontFamily: "'Source Serif 4',Georgia,serif", background: '#fff', color: '#222', boxSizing: 'border-box' }

  return (
    <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#f8f7f4', border: '1px solid #ccc9c0', borderRadius: 8, padding: '1.5rem', width: '100%', maxWidth: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', fontFamily: "'Source Serif 4',Georgia,serif" }}>
        <div style={{ fontFamily: "'IM Fell English',serif", fontSize: '1.1rem', color: '#1b4f72', marginBottom: '1rem' }}>
          {initial ? 'Edit Person' : 'New Person'}
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={lbl}>Name *</label>
          <input value={form.name} onChange={e => f('name', e.target.value)} placeholder='e.g. Aldric the Pale' style={inp}/>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={lbl}>Portrait URL</label>
          <input value={form.portrait} onChange={e => f('portrait', e.target.value)} placeholder='https://…' style={inp}/>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={lbl}>Category</label>
          <select value={form.category} onChange={e => f('category', e.target.value)} style={inp}>
            <option value=''>— Uncategorised —</option>
            {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={lbl}>Short description <span style={{ fontWeight: 400, textTransform: 'none' }}>(shown on card)</span></label>
          <input value={form.description} onChange={e => f('description', e.target.value)} placeholder='e.g. Innkeeper of the Saltmarsh' style={inp}/>
        </div>
        <div style={{ marginBottom: '1.1rem' }}>
          <label style={lbl}>Details <span style={{ fontWeight: 400, textTransform: 'none' }}>(shown on hover)</span></label>
          <textarea value={form.details} onChange={e => f('details', e.target.value)}
            placeholder='Longer notes visible on hover — personality, secrets, connections…'
            rows={4}
            style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}/>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type='button' onClick={() => valid && onSave(form)} disabled={!valid}
            style={{ padding: '5px 16px', border: 'none', borderRadius: 3, background: valid ? '#1b4f72' : '#ccc', color: '#fff', cursor: valid ? 'pointer' : 'default', fontSize: '0.85rem', fontFamily: "'Source Serif 4',Georgia,serif" }}>
            Save
          </button>
          <button type='button' onClick={onCancel}
            style={{ padding: '5px 12px', border: '1px solid #ccc9c0', borderRadius: 3, background: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#666' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── People page ──────────────────────────────────────────────────────────────
export default function People({ user, onClose }) {
  const [people, setPeople] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCat, setSelectedCat] = useState(null)
  const [collapsedCats, setCollapsedCats] = useState({})
  const [editingCat, setEditingCat] = useState(null)
  const [addingSubTo, setAddingSubTo] = useState(null)
  const [newCatInput, setNewCatInput] = useState('')
  const [showNewCatInput, setShowNewCatInput] = useState(false)
  const [search, setSearch] = useState('')
  const [lightboxPerson, setLightboxPerson] = useState(null)
  const [formPerson, setFormPerson] = useState(null)
  const [adding, setAdding] = useState(false)
  const admin = isAdmin(user)
  const isMobile = useIsMobile()

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'people'), snap => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      items.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      setPeople(items)
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'people_meta', 'config'), snap => {
      if (snap.exists()) setCategories(snap.data().categories || [])
    })
    return unsub
  }, [])

  const persistCategories = tree => {
    setCategories(tree)
    setDoc(doc(db, 'people_meta', 'config'), { categories: tree })
  }

  const catTree = (() => {
    const cloned = categories.map(cloneCatNode)
    people.forEach(p => { if (p.category) insertCatPath(cloned, p.category.split(' > ')) })
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
    setNewCatInput(''); setShowNewCatInput(false)
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
    await Promise.all(people
      .filter(p => p.category === oldPath || p.category?.startsWith(oldPath + ' > '))
      .map(p => updateDoc(doc(db, 'people', p.id), {
        category: p.category === oldPath ? newPath : newPath + p.category.slice(oldPath.length),
      }))
    )
    const cloned = categories.map(cloneCatNode)
    let nodes = cloned
    for (let i = 0; i < parts.length - 1; i++) { const n = nodes.find(n => n.name === parts[i]); if (!n) return; nodes = n.subcategories }
    const node = nodes.find(n => n.name === parts[parts.length - 1])
    if (node) node.name = trimmed
    persistCategories(cloned)
    if (selectedCat === oldPath || selectedCat?.startsWith(oldPath + ' > ')) setSelectedCat(newPath)
  }

  const deleteCategory = async path => {
    const affected = people.filter(p => p.category === path || p.category?.startsWith(path + ' > '))
    const msg = affected.length
      ? `Delete "${path}"? ${affected.length} person(s) will become uncategorised.`
      : `Delete "${path}"?`
    if (!window.confirm(msg)) return
    await Promise.all(affected.map(p => updateDoc(doc(db, 'people', p.id), { category: '' })))
    const cloned = categories.map(cloneCatNode)
    removeCatFromTree(cloned, path.split(' > '))
    persistCategories(cloned)
    if (selectedCat === path || selectedCat?.startsWith(path + ' > ')) setSelectedCat(null)
  }

  const saveNew = async form => {
    await addDoc(collection(db, 'people'), {
      name: form.name.trim(), portrait: form.portrait.trim(),
      description: form.description.trim(), details: form.details.trim(),
      category: form.category || '',
      addedBy: user.displayName || user.email, addedAt: serverTimestamp(),
    })
    setAdding(false)
  }

  const saveEdit = async form => {
    await updateDoc(doc(db, 'people', formPerson.id), {
      name: form.name.trim(), portrait: form.portrait.trim(),
      description: form.description.trim(), details: form.details.trim(),
      category: form.category || '',
    })
    setFormPerson(null)
  }

  const handleDelete = async id => {
    if (!window.confirm('Remove this person?')) return
    await deleteDoc(doc(db, 'people', id))
  }

  const visible = people.filter(p => {
    if (selectedCat && p.category !== selectedCat) return false
    if (!search) return true
    const q = search.toLowerCase()
    return p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.details?.toLowerCase().includes(q)
  })

  const cardMin = isMobile ? 140 : 170

  // ─── Recursive sidebar category renderer ─────────────────────────────────────
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
        <span style={{ fontFamily: "'IM Fell English',serif", fontSize: '1.2rem', color: '#1b4f72', flexShrink: 0 }}>👤 People</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder='Search…'
          style={{ flex: 1, padding: '4px 10px', border: '1px solid #ccc9c0', borderRadius: 3, fontSize: '0.84rem', fontFamily: "'Source Serif 4',Georgia,serif", background: '#f8f7f4', color: '#222', maxWidth: 280 }}/>
        <div style={{ flex: 1 }}/>
        {admin && (
          <button type='button' onClick={() => setAdding(true)}
            style={{ padding: '4px 12px', border: 'none', borderRadius: 3, background: '#1b4f72', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontFamily: "'Source Serif 4',Georgia,serif", flexShrink: 0 }}>
            + Add Person
          </button>
        )}
        <button type='button' onClick={onClose}
          style={{ padding: '4px 10px', border: '1px solid #ccc9c0', borderRadius: 3, background: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#666', flexShrink: 0 }}>
          ✕ Close
        </button>
      </div>

      {/* Body: sidebar + main */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Sidebar */}
        {!isMobile && (
          <div style={{ width: 210, flexShrink: 0, borderRight: '1px solid #ccc9c0', background: '#f0eeea', overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '0.4rem 0' }}>
            <button type='button' onClick={() => setSelectedCat(null)}
              style={{ display: 'block', width: '100%', padding: '5px 14px', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '0.8rem', fontFamily: "'Source Serif 4',Georgia,serif",
                background: selectedCat === null ? '#e2dfd8' : 'none', color: selectedCat === null ? '#1b4f72' : '#555', fontWeight: selectedCat === null ? 700 : 400 }}>
              All People
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

        {/* Main: card grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '1rem' : '1.25rem 1.5rem' }}>
          {isMobile && (
            <select value={selectedCat ?? ''} onChange={e => setSelectedCat(e.target.value || null)}
              style={{ width: '100%', marginBottom: '0.75rem', padding: '6px 8px', border: '1px solid #ccc9c0', borderRadius: 3, fontSize: '0.87rem', fontFamily: "'Source Serif 4',Georgia,serif", background: '#f8f7f4', color: '#222' }}>
              <option value=''>All People</option>
              {allFlatCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {selectedCat && (
            <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#aaa', marginBottom: '0.75rem' }}>{selectedCat}</div>
          )}
          {visible.length === 0 && (
            <div style={{ textAlign: 'center', padding: '5rem 0', color: '#aaa', fontSize: '0.9rem', fontStyle: 'italic' }}>
              {search ? `No results for "${search}".` : selectedCat ? `No people in "${selectedCat}".` : `No people yet.${admin ? ' Use "+ Add Person" to add someone.' : ''}`}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${cardMin}px, 1fr))`, gap: isMobile ? '0.75rem' : '1rem' }}>
            {visible.map(person => (
              <NpcCard key={person.id} person={person} admin={admin}
                onEdit={p => setFormPerson(p)}
                onDelete={handleDelete}
                onLightbox={p => setLightboxPerson(p)}
              />
            ))}
          </div>
        </div>
      </div>

      {lightboxPerson && <Lightbox person={lightboxPerson} onClose={() => setLightboxPerson(null)}/>}
      {adding && <PersonForm allCategories={allFlatCategories} defaultCategory={selectedCat || ''} onSave={saveNew} onCancel={() => setAdding(false)}/>}
      {formPerson && <PersonForm initial={formPerson} allCategories={allFlatCategories} defaultCategory={selectedCat || ''} onSave={saveEdit} onCancel={() => setFormPerson(null)}/>}
    </div>
  )
}
