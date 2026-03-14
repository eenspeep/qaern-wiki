import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

const TRACKER_DOC = 'tracker/state'
const ADMIN = 'speep'
const isAdmin = user => user?.displayName === ADMIN

// ─── Colour palette options ────────────────────────────────────────────────────
const PALETTES = [
  { label: 'Parchment',  fill: '#1b4f72', track: '#ddd8cc', text: '#222' },
  { label: 'Ember',      fill: '#b44', track: '#e8d8d0', text: '#222' },
  { label: 'Wyld',       fill: '#3a7a3a', track: '#d4e8d4', text: '#222' },
  { label: 'Ash',        fill: '#555', track: '#e0e0e0', text: '#222' },
  { label: 'Gold',       fill: '#a07020', track: '#f0e8cc', text: '#222' },
  { label: 'Violet',     fill: '#5a3a7a', track: '#e0d4f0', text: '#222' },
  { label: 'Night',      fill: '#223355', track: '#c8d0e0', text: '#222' },
  { label: 'Rust',       fill: '#8b4513', track: '#e8d8c8', text: '#222' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10)

function makePaletteFor(p) {
  return PALETTES[p] || PALETTES[0]
}

// ─── Clock SVG ────────────────────────────────────────────────────────────────
function Clock({ segments, filled, palette, size = 90, editable, onToggle }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 4
  const pal = makePaletteFor(palette)
  const wedges = []
  const gap = 0.04 // radians of gap between wedges

  for (let i = 0; i < segments; i++) {
    const startAngle = (i / segments) * 2 * Math.PI - Math.PI / 2 + gap / 2
    const endAngle = ((i + 1) / segments) * 2 * Math.PI - Math.PI / 2 - gap / 2
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0
    const isFilled = i < filled

    wedges.push(
      <path key={i}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
        fill={isFilled ? pal.fill : pal.track}
        stroke='#2a2a2a'
        strokeWidth='1.5'
        strokeLinejoin='round'
        style={{ cursor: editable ? 'pointer' : 'default', transition: 'fill 0.15s' }}
        onClick={() => editable && onToggle && onToggle(i)}
      />
    )
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.18))' }}>
      <circle cx={cx} cy={cy} r={r + 2} fill='none' stroke='#2a2a2a' strokeWidth='1.5'/>
      {wedges}
      <circle cx={cx} cy={cy} r={3} fill='#2a2a2a'/>
    </svg>
  )
}

// ─── Tracker Bar ──────────────────────────────────────────────────────────────
function TrackerBar({ item, editable, onChange, onDelete }) {
  const pal = makePaletteFor(item.palette)
  const pct = item.max > 0 ? Math.min(100, (item.current / item.max) * 100) : 0
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)

  const startEdit = () => { setDraft({ ...item }); setEditing(true) }
  const cancel = () => setEditing(false)
  const save = () => { onChange(draft); setEditing(false) }

  if (editing && editable) {
    return (
      <div style={{ border: '1px solid #ccc9c0', borderRadius: 6, padding: '12px 14px', background: '#faf9f6', marginBottom: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', marginBottom: 8 }}>
          <div>
            <label style={lb}>Label</label>
            <input style={inp} value={draft.label} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} placeholder='e.g. Survival'/>
          </div>
          <div>
            <label style={lb}>Image URL (optional)</label>
            <input style={inp} value={draft.image || ''} onChange={e => setDraft(d => ({ ...d, image: e.target.value }))} placeholder='https://…'/>
          </div>
          <div>
            <label style={lb}>Current</label>
            <input style={inp} type='number' value={draft.current} onChange={e => setDraft(d => ({ ...d, current: Number(e.target.value) }))}/>
          </div>
          <div>
            <label style={lb}>Max</label>
            <input style={inp} type='number' value={draft.max} onChange={e => setDraft(d => ({ ...d, max: Number(e.target.value) }))}/>
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={lb}>Colour</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PALETTES.map((p, i) => (
              <div key={i} onClick={() => setDraft(d => ({ ...d, palette: i }))}
                style={{ width: 22, height: 22, borderRadius: '50%', background: p.fill, cursor: 'pointer',
                  border: draft.palette === i ? '2px solid #222' : '2px solid transparent',
                  boxShadow: draft.palette === i ? '0 0 0 1px #888' : 'none' }}
                title={p.label}/>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={save} style={btnPrimary}>Save</button>
          <button onClick={cancel} style={btnSecondary}>Cancel</button>
          {onDelete && <button onClick={onDelete} style={btnDanger}>Delete</button>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 6, background: '#faf9f6', border: '1px solid #e8e5e0', display: 'flex', alignItems: 'center', gap: 12 }}>
      {item.image && (
        <img src={item.image} alt='' style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover', flexShrink: 0, border: '1px solid #ddd' }}/>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
          <span style={{ fontFamily: "'IM Fell English', serif", fontSize: '0.92rem', color: '#222', fontWeight: 600 }}>{item.label}</span>
          <span style={{ fontSize: '0.75rem', color: '#888', flexShrink: 0, marginLeft: 8 }}>
            {item.current.toLocaleString()} / {item.max.toLocaleString()}
            {item.max > 0 && <span style={{ marginLeft: 4, color: '#aaa' }}>({pct.toFixed(1)}%)</span>}
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: pal.track, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: pct + '%', background: pal.fill, borderRadius: 4, transition: 'width 0.3s' }}/>
        </div>
        {editable && (
          <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
            <input type='range' min={0} max={item.max} value={item.current}
              onChange={e => onChange({ ...item, current: Number(e.target.value) })}
              style={{ flex: 1, accentColor: pal.fill }}/>
            <button onClick={startEdit} style={{ ...btnSecondary, padding: '2px 8px', fontSize: '0.72rem' }}>✎ Edit</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tracker Clock ─────────────────────────────────────────────────────────────
function TrackerClock({ item, editable, onChange, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(null)

  const startEdit = () => { setDraft({ ...item }); setEditing(true) }
  const cancel = () => setEditing(false)
  const save = () => { onChange(draft); setEditing(false) }

  const toggleWedge = (i) => {
    if (!editable) return
    // Click filled wedge = unfill from that wedge onward; click empty = fill up to and including it
    const newFilled = i < item.filled ? i : i + 1
    onChange({ ...item, filled: newFilled })
  }

  if (editing && editable) {
    return (
      <div style={{ border: '1px solid #ccc9c0', borderRadius: 6, padding: '12px 14px', background: '#faf9f6', marginBottom: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', marginBottom: 8 }}>
          <div>
            <label style={lb}>Label</label>
            <input style={inp} value={draft.label} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} placeholder='e.g. Rebuild the Gate'/>
          </div>
          <div>
            <label style={lb}>Image URL (optional)</label>
            <input style={inp} value={draft.image || ''} onChange={e => setDraft(d => ({ ...d, image: e.target.value }))} placeholder='https://…'/>
          </div>
          <div>
            <label style={lb}>Segments</label>
            <select style={inp} value={draft.segments} onChange={e => setDraft(d => ({ ...d, segments: Number(e.target.value), filled: Math.min(d.filled, Number(e.target.value)) }))}>
              {[2,3,4,5,6,7,8,10,12].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label style={lb}>Filled wedges</label>
            <input style={inp} type='number' min={0} max={draft.segments} value={draft.filled}
              onChange={e => setDraft(d => ({ ...d, filled: Math.max(0, Math.min(d.segments, Number(e.target.value))) }))}/>
          </div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={lb}>Colour</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PALETTES.map((p, i) => (
              <div key={i} onClick={() => setDraft(d => ({ ...d, palette: i }))}
                style={{ width: 22, height: 22, borderRadius: '50%', background: p.fill, cursor: 'pointer',
                  border: draft.palette === i ? '2px solid #222' : '2px solid transparent',
                  boxShadow: draft.palette === i ? '0 0 0 1px #888' : 'none' }}
                title={p.label}/>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={save} style={btnPrimary}>Save</button>
          <button onClick={cancel} style={btnSecondary}>Cancel</button>
          {onDelete && <button onClick={onDelete} style={btnDanger}>Delete</button>}
        </div>
      </div>
    )
  }

  const pal = makePaletteFor(item.palette)
  return (
    <div style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 6, background: '#faf9f6', border: '1px solid #e8e5e0', display: 'flex', alignItems: 'center', gap: 14 }}>
      {item.image && (
        <img src={item.image} alt='' style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover', flexShrink: 0, border: '1px solid #ddd' }}/>
      )}
      <Clock segments={item.segments} filled={item.filled} palette={item.palette} size={80} editable={editable} onToggle={toggleWedge}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'IM Fell English', serif", fontSize: '0.92rem', color: '#222', fontWeight: 600, marginBottom: 3 }}>{item.label}</div>
        <div style={{ fontSize: '0.75rem', color: '#888' }}>{item.filled} / {item.segments} wedges</div>
        {editable && (
          <button onClick={startEdit} style={{ ...btnSecondary, padding: '2px 8px', fontSize: '0.72rem', marginTop: 6 }}>✎ Edit</button>
        )}
      </div>
    </div>
  )
}

// ─── Shared styles ─────────────────────────────────────────────────────────────
const lb = { display: 'block', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', marginBottom: 3 }
const inp = { width: '100%', padding: '5px 8px', border: '1px solid #ccc9c0', borderRadius: 3, fontSize: '0.83rem', fontFamily: "'Source Serif 4', Georgia, serif", background: '#f8f7f4', color: '#222', boxSizing: 'border-box' }
const btnPrimary = { padding: '5px 14px', border: 'none', borderRadius: 3, background: '#1b4f72', color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontFamily: "'Source Serif 4', Georgia, serif" }
const btnSecondary = { padding: '5px 10px', border: '1px solid #ccc9c0', borderRadius: 3, background: '#f0eeea', color: '#444', cursor: 'pointer', fontSize: '0.8rem', fontFamily: "'Source Serif 4', Georgia, serif" }
const btnDanger = { padding: '5px 10px', border: '1px solid #e0b0b0', borderRadius: 3, background: 'none', color: '#b44', cursor: 'pointer', fontSize: '0.8rem', fontFamily: "'Source Serif 4', Georgia, serif" }

// ─── Main Tracker Page ─────────────────────────────────────────────────────────
export default function Tracker({ user, onClose }) {
  const admin = isAdmin(user)
  const [state, setState] = useState(null)   // { tabs: [{id, name, items:[]}] }
  const [activeTab, setActiveTab] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [addingTab, setAddingTab] = useState(false)
  const [newTabName, setNewTabName] = useState('')
  const [editingTabName, setEditingTabName] = useState(null) // tab id
  const [editingTabNameVal, setEditingTabNameVal] = useState('')
  const newTabRef = useRef(null)

  // Real-time Firestore sync
  useEffect(() => {
    const unsub = onSnapshot(doc(db, TRACKER_DOC), snap => {
      if (snap.exists()) {
        const data = snap.data()
        setState(data)
        setActiveTab(prev => prev || (data.tabs?.[0]?.id || null))
      } else {
        const initial = {
          tabs: [
            { id: uid(), name: 'Melphö', items: [] },
            { id: uid(), name: 'Attitan', items: [] },
          ]
        }
        setState(initial)
        setActiveTab(initial.tabs[0].id)
        if (admin) persist(initial)
      }
      setLoaded(true)
    }, err => {
      console.error('Tracker Firestore error:', err.code, err.message)
      setLoaded(true)
      setState({ _error: err.message, tabs: [] })
    })
    return unsub
  }, [])

  useEffect(() => {
    if (addingTab) setTimeout(() => newTabRef.current?.focus(), 40)
  }, [addingTab])

  const [dragId, setDragId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)

  const persist = async (newState) => {
    await setDoc(doc(db, TRACKER_DOC), { ...newState, updatedAt: serverTimestamp() })
  }

  const update = (newState) => {
    setState(newState)
    persist(newState)
  }

  const updateItems = (tabId, newItems) => {
    const newState = { ...state, tabs: state.tabs.map(t => t.id === tabId ? { ...t, items: newItems } : t) }
    update(newState)
  }

  const onItemDragStart = (e, itemId) => {
    setDragId(itemId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', itemId)
  }

  const onItemDragOver = (e, itemId) => {
    e.preventDefault()
    if (itemId !== dragId) setDragOverId(itemId)
  }

  const onItemDrop = (e, targetId) => {
    e.preventDefault()
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return }
    const tab = state.tabs.find(t => t.id === activeTab)
    if (!tab) return
    const items = [...tab.items]
    const fromIdx = items.findIndex(i => i.id === dragId)
    const toIdx = items.findIndex(i => i.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return
    const [moved] = items.splice(fromIdx, 1)
    items.splice(toIdx, 0, moved)
    setDragId(null); setDragOverId(null)
    updateItems(activeTab, items)
  }

  const onItemDragEnd = () => { setDragId(null); setDragOverId(null) }

  const addTab = () => {
    const name = newTabName.trim()
    if (!name) return
    const newTab = { id: uid(), name, items: [] }
    const newState = { ...state, tabs: [...state.tabs, newTab] }
    update(newState)
    setActiveTab(newTab.id)
    setNewTabName('')
    setAddingTab(false)
  }

  const renameTab = (tabId) => {
    const name = editingTabNameVal.trim()
    if (!name) { setEditingTabName(null); return }
    const newState = { ...state, tabs: state.tabs.map(t => t.id === tabId ? { ...t, name } : t) }
    update(newState)
    setEditingTabName(null)
  }

  const deleteTab = (tabId) => {
    if (!confirm('Delete this tab and all its trackers?')) return
    const newTabs = state.tabs.filter(t => t.id !== tabId)
    const newState = { ...state, tabs: newTabs }
    update(newState)
    if (activeTab === tabId) setActiveTab(newTabs[0]?.id || null)
  }

  const addItem = (tabId, type) => {
    const tab = state.tabs.find(t => t.id === tabId)
    if (!tab) return
    const newItem = type === 'bar'
      ? { id: uid(), type: 'bar', label: 'New Tracker', current: 0, max: 100, palette: 0, image: '' }
      : { id: uid(), type: 'clock', label: 'New Clock', segments: 6, filled: 0, palette: 0, image: '' }
    updateItems(tabId, [...tab.items, newItem])
  }

  const updateItem = (tabId, itemId, newItem) => {
    const tab = state.tabs.find(t => t.id === tabId)
    if (!tab) return
    updateItems(tabId, tab.items.map(it => it.id === itemId ? newItem : it))
  }

  const deleteItem = (tabId, itemId) => {
    const tab = state.tabs.find(t => t.id === tabId)
    if (!tab) return
    updateItems(tabId, tab.items.filter(it => it.id !== itemId))
  }

  const activeTabData = state?.tabs?.find(t => t.id === activeTab)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: '#f8f7f4', display: 'flex', flexDirection: 'column',
      fontFamily: "'Source Serif 4', Georgia, serif",
    }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #ccc9c0', padding: '0 1.5rem', height: 50, display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0, background: '#f8f7f4' }}>
        <span style={{ fontFamily: "'IM Fell English', serif", fontSize: '1.1rem', color: '#1b4f72' }}>Tracker</span>
        <div style={{ flex: 1 }}/>
        <button onClick={onClose} style={{ ...btnSecondary, padding: '4px 12px' }}>← Back to Wiki</button>
      </div>

      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid #ccc9c0', background: '#f0eeea', display: 'flex', alignItems: 'flex-end', padding: '0 1.5rem', gap: 2, flexShrink: 0, overflowX: 'auto' }}>
        {loaded && state?.tabs?.map(tab => (
          <div key={tab.id}
            style={{
              padding: '8px 18px 6px', cursor: 'pointer', userSelect: 'none', position: 'relative',
              borderRadius: '4px 4px 0 0', border: '1px solid transparent',
              borderBottom: activeTab === tab.id ? '1px solid #f8f7f4' : '1px solid #ccc9c0',
              background: activeTab === tab.id ? '#f8f7f4' : 'transparent',
              fontFamily: "'IM Fell English', serif", fontSize: '0.92rem',
              color: activeTab === tab.id ? '#1b4f72' : '#666',
              fontWeight: activeTab === tab.id ? 600 : 400,
              display: 'flex', alignItems: 'center', gap: 6,
              marginBottom: activeTab === tab.id ? -1 : 0,
            }}
            onClick={() => setActiveTab(tab.id)}>
            {editingTabName === tab.id && admin
              ? <input autoFocus value={editingTabNameVal}
                  onChange={e => setEditingTabNameVal(e.target.value)}
                  onBlur={() => renameTab(tab.id)}
                  onKeyDown={e => { if (e.key === 'Enter') renameTab(tab.id); if (e.key === 'Escape') setEditingTabName(null) }}
                  onClick={e => e.stopPropagation()}
                  style={{ width: 90, padding: '1px 4px', border: '1px solid #1b4f72', borderRadius: 2, fontSize: '0.88rem', fontFamily: "'IM Fell English', serif" }}/>
              : <span onDoubleClick={() => { if (admin) { setEditingTabName(tab.id); setEditingTabNameVal(tab.name) } }}>{tab.name}</span>
            }
            {admin && activeTab === tab.id && state.tabs.length > 1 && (
              <span onClick={e => { e.stopPropagation(); deleteTab(tab.id) }}
                style={{ fontSize: '0.65rem', color: '#bbb', cursor: 'pointer', lineHeight: 1 }} title='Delete tab'>✕</span>
            )}
          </div>
        ))}
        {admin && (
          addingTab
            ? <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px' }}>
                <input ref={newTabRef} value={newTabName} onChange={e => setNewTabName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addTab(); if (e.key === 'Escape') { setAddingTab(false); setNewTabName('') } }}
                  placeholder='Tab name…'
                  style={{ width: 110, padding: '3px 6px', border: '1px solid #ccc9c0', borderRadius: 3, fontSize: '0.82rem', fontFamily: "'Source Serif 4', Georgia, serif" }}/>
                <button onClick={addTab} style={{ ...btnPrimary, padding: '3px 8px' }}>+</button>
                <button onClick={() => { setAddingTab(false); setNewTabName('') }} style={{ ...btnSecondary, padding: '3px 6px' }}>✕</button>
              </div>
            : <button onClick={() => setAddingTab(true)}
                style={{ padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1.1rem', marginBottom: 2 }} title='Add tab'>+</button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
        {loaded && state?._error && (
          <div style={{ background: '#fff0f0', border: '1px solid #f5c6cb', borderRadius: 6, padding: '12px 16px', color: '#b44', fontSize: '0.85rem', maxWidth: 500 }}>
            <strong>Firestore error:</strong> {state._error}
            <div style={{ marginTop: 6, color: '#888', fontSize: '0.78rem' }}>Check that firestore rules have been deployed via <code>firebase deploy --only firestore:rules</code></div>
          </div>
        )}

        {!loaded && <div style={{ color: '#aaa', fontStyle: 'italic' }}>Loading…</div>}

        {loaded && !activeTabData && (
          <div style={{ color: '#aaa', fontStyle: 'italic' }}>No tabs yet. {admin ? 'Use + to add one.' : ''}</div>
        )}

        {loaded && activeTabData && (
          <>
            {/* Items */}
            <div style={{ maxWidth: 560 }}>
              {activeTabData.items.length === 0 && (
                <div style={{ color: '#aaa', fontStyle: 'italic', marginBottom: 16, fontSize: '0.88rem' }}>
                  No trackers yet.{admin ? ' Add one below.' : ''}
                </div>
              )}
              {activeTabData.items.map(item => (
                <div key={item.id}
                  draggable={admin}
                  onDragStart={admin ? e => onItemDragStart(e, item.id) : undefined}
                  onDragOver={admin ? e => onItemDragOver(e, item.id) : undefined}
                  onDrop={admin ? e => onItemDrop(e, item.id) : undefined}
                  onDragEnd={admin ? onItemDragEnd : undefined}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 4,
                    opacity: dragId === item.id ? 0.35 : 1,
                    borderTop: dragOverId === item.id ? '2px solid #1b4f72' : '2px solid transparent',
                    transition: 'opacity 0.15s, border-color 0.1s',
                  }}>
                  {admin && (
                    <div style={{ paddingTop: 14, color: '#ccc', fontSize: '0.75rem', cursor: 'grab', userSelect: 'none', flexShrink: 0 }} title='Drag to reorder'>⠿</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {item.type === 'bar'
                      ? <TrackerBar item={item} editable={admin}
                          onChange={newItem => updateItem(activeTab, item.id, newItem)}
                          onDelete={() => deleteItem(activeTab, item.id)}/>
                      : <TrackerClock item={item} editable={admin}
                          onChange={newItem => updateItem(activeTab, item.id, newItem)}
                          onDelete={() => deleteItem(activeTab, item.id)}/>
                    }
                  </div>
                </div>
              ))}
            </div>

            {/* Add buttons — admin only */}
            {admin && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={() => addItem(activeTab, 'bar')}
                  style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.85rem' }}>▬</span> Add Tracker Bar
                </button>
                <button onClick={() => addItem(activeTab, 'clock')}
                  style={{ ...btnSecondary, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.85rem' }}>◕</span> Add Clock
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
