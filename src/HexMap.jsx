import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

const ADMIN = 'speep'
const isAdmin = u => u?.displayName === ADMIN

// ─── Hex geometry (flat-top) ──────────────────────────────────────────────────
const HEX_SIZE = 32        // radius in px
const HEX_W    = HEX_SIZE * 2
const HEX_H    = Math.sqrt(3) * HEX_SIZE
const HEX_VERT_SPACING = HEX_H
const HEX_HORIZ_SPACING = HEX_W * 0.75

// Flat-top hex corner points
const hexPoints = (cx, cy) => {
  const pts = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i)
    pts.push(`${cx + HEX_SIZE * Math.cos(angle)},${cy + HEX_SIZE * Math.sin(angle)}`)
  }
  return pts.join(' ')
}

// Center pixel of hex at (col, row)
const hexCenter = (col, row) => {
  const x = col * HEX_HORIZ_SPACING + HEX_SIZE
  const y = row * HEX_VERT_SPACING + HEX_H / 2 + (col % 2 === 1 ? HEX_H / 2 : 0)
  return { x, y }
}

// Column label: 0→A, 25→Z, 26→AA etc.
const colLabel = (col) => {
  let s = ''
  let n = col
  do {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - (s.length > 1 ? 0 : 1)
    if (n < 0) break
  } while (n >= 0 && s.length < 3)
  return s || 'A'
}
const hexCoordLabel = (col, row) => `${colLabel(col)}${row + 1}`

// ─── Marker options ───────────────────────────────────────────────────────────
const MARKERS = [
  { id: 'none',       label: 'None',          emoji: '' },
  { id: 'settlement', label: 'Settlement',    emoji: '🏰' },
  { id: 'village',    label: 'Village',       emoji: '🏠' },
  { id: 'dungeon',    label: 'Dungeon',       emoji: '🗝' },
  { id: 'ruins',      label: 'Ruins',         emoji: '🪨' },
  { id: 'forest',     label: 'Forest',        emoji: '🌲' },
  { id: 'mountain',   label: 'Mountain',      emoji: '⛰' },
  { id: 'water',      label: 'Water/River',   emoji: '🌊' },
  { id: 'danger',     label: 'Danger',        emoji: '💀' },
  { id: 'poi',        label: 'Point of Interest', emoji: '❓' },
  { id: 'camp',       label: 'Camp',          emoji: '🔥' },
  { id: 'npc',        label: 'NPC',           emoji: '👤' },
  { id: 'event',      label: 'Event',         emoji: '⚡' },
  { id: 'road',       label: 'Road',          emoji: '🛤' },
  { id: 'swamp',      label: 'Swamp',         emoji: '🌿' },
  { id: 'portal',     label: 'Portal/Magic',  emoji: '🔮' },
]

const DANGER_LABELS = ['Safe', 'Low', 'Moderate', 'High', 'Deadly', 'Legendary']
const DANGER_COLORS = ['#3a7a3a', '#7a9a3a', '#c8a020', '#c06020', '#b44', '#6a0a6a']

// ─── Hex editor panel ─────────────────────────────────────────────────────────
function HexEditor({ hexKey, hexData, coordLabel, isCenter, centerName, onSave, onClose, admin }) {
  const [draft, setDraft] = useState({
    name: hexData?.name || coordLabel,
    description: hexData?.description || '',
    explored: hexData?.explored || false,
    danger: hexData?.danger ?? 0,
    marker: hexData?.marker || 'none',
  })
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }))
  const inp = { width: '100%', padding: '6px 8px', border: '1px solid #ccc9c0', borderRadius: 3,
    fontSize: '0.84rem', fontFamily: "'Source Serif 4', Georgia, serif",
    background: '#f8f7f4', color: '#222', boxSizing: 'border-box' }
  const lb = { display: 'block', fontSize: '0.67rem', textTransform: 'uppercase',
    letterSpacing: '0.07em', color: '#888', marginBottom: 3 }

  return (
    <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 280,
      background: '#fdf8f0', borderLeft: '1px solid #ccc9c0', zIndex: 10,
      display: 'flex', flexDirection: 'column', fontFamily: "'Source Serif 4', Georgia, serif",
      boxShadow: '-4px 0 16px rgba(0,0,0,0.1)' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #e8e5e0',
        display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: "'IM Fell English', serif", fontSize: '1rem', color: '#1b4f72', flex: 1 }}>
          {coordLabel}{isCenter ? ` · ${centerName}` : ''}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer',
          color: '#aaa', fontSize: '1rem', lineHeight: 1 }}>✕</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        <label style={lb}>Hex Name</label>
        <input style={{ ...inp, marginBottom: 10 }} value={draft.name}
          onChange={e => set('name', e.target.value)} disabled={!admin}/>

        <label style={lb}>Description</label>
        <textarea value={draft.description} onChange={e => set('description', e.target.value)}
          disabled={!admin} rows={3}
          style={{ ...inp, resize: 'vertical', lineHeight: 1.6, marginBottom: 10 }}/>

        <label style={{ ...lb, marginBottom: 6 }}>Marker</label>
        <div style={{ marginBottom: 10 }}>
          {/* Current marker display + direct emoji input */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, border: '1px solid #ccc9c0', borderRadius: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem', background: '#f8f7f4', flexShrink: 0,
              filter: 'grayscale(1)' }}>
              {draft.marker || '○'}
            </div>
            <input value={draft.marker === '○' || !draft.marker ? '' : draft.marker}
              onChange={e => admin && set('marker', e.target.value.slice(-2) || '○')}
              disabled={!admin}
              placeholder='Paste any emoji…'
              style={{ ...inp, flex: 1, fontSize: '1rem' }}/>
            {admin && draft.marker && draft.marker !== '○' && (
              <button onClick={() => set('marker', '○')}
                style={{ padding: '4px 8px', border: '1px solid #e0ddd8', borderRadius: 3,
                  background: '#f8f7f4', cursor: 'pointer', fontSize: '0.72rem', color: '#aaa', flexShrink: 0 }}>
                Clear
              </button>
            )}
          </div>
          {/* Quick-pick common symbols */}
          {admin && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {['🏰','🏠','🗝','🪨','🌲','⛰','🌊','💀','❓','🔥','👤','⚡','🛤','🌿','🔮',
                '🐉','⚔','🛡','🌙','☀','❄','🌋','🏔','🕯','📜','💎','🐺','🦅','🐍','🌾',
                '🗡','🏹','🎯','🧿','⚗','🔔','🌑','🌕','🌫','🌪'].map(em => (
                <div key={em} onClick={() => set('marker', em)}
                  style={{ width: 28, height: 28, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', borderRadius: 3, cursor: 'pointer',
                    fontSize: '1rem', border: `1px solid ${draft.marker===em?'#1b4f72':'#e0ddd8'}`,
                    background: draft.marker===em?'#e8f0f8':'#f8f7f4',
                    filter: 'grayscale(1)' }}>
                  {em}
                </div>
              ))}
            </div>
          )}
        </div>

        <label style={{ ...lb, marginBottom: 6 }}>
          Danger Level —{' '}
          <span style={{ color: DANGER_COLORS[draft.danger], fontWeight: 600, textTransform: 'none', letterSpacing: 0, fontSize: '0.75rem' }}>
            {DANGER_LABELS[draft.danger]}
          </span>
        </label>
        <input type='range' min={0} max={5} value={draft.danger}
          onChange={e => admin && set('danger', Number(e.target.value))}
          disabled={!admin}
          style={{ width: '100%', accentColor: DANGER_COLORS[draft.danger], marginBottom: 10 }}/>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: admin ? 'pointer' : 'default',
          fontSize: '0.84rem', color: '#444', userSelect: 'none' }}>
          <input type='checkbox' checked={draft.explored} onChange={e => admin && set('explored', e.target.checked)}
            disabled={!admin} style={{ accentColor: '#1b4f72', width: 14, height: 14 }}/>
          Explored
        </label>
      </div>

      {admin && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid #e8e5e0', display: 'flex', gap: 6 }}>
          <button onClick={() => onSave(draft)}
            style={{ flex: 1, padding: '6px', border: 'none', borderRadius: 3,
              background: '#1b4f72', color: '#fff', cursor: 'pointer',
              fontSize: '0.82rem', fontFamily: "'Source Serif 4', Georgia, serif" }}>
            Save
          </button>
          <button onClick={onClose}
            style={{ padding: '6px 12px', border: '1px solid #ccc9c0', borderRadius: 3,
              background: '#f0eeea', color: '#444', cursor: 'pointer',
              fontSize: '0.82rem', fontFamily: "'Source Serif 4', Georgia, serif" }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Single hex map tab ────────────────────────────────────────────────────────
function HexMapTab({ mapId, centerName, user, cols, rows }) {
  const admin = isAdmin(user)
  const [hexData, setHexData] = useState({})   // { 'col,row': hexObj }
  const [showLabels, setShowLabels] = useState(false)
  const [selectedHex, setSelectedHex] = useState(null)  // {col, row}
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [loaded, setLoaded] = useState(false)
  const containerRef = useRef(null)
  const isPanning = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const writing = useRef(0)

  const centerCol = Math.floor(cols / 2)
  const centerRow = Math.floor(rows / 2)

  // Canvas dimensions
  const canvasW = (cols - 1) * HEX_HORIZ_SPACING + HEX_W + 4
  const canvasH = rows * HEX_VERT_SPACING + HEX_H / 2 + 4

  useEffect(() => {
    const unsub = onSnapshot(doc(db, `hexmap/${mapId}`), snap => {
      if (Date.now() - writing.current < 500) return
      setHexData(snap.exists() ? (snap.data().hexes || {}) : {})
      setLoaded(true)
    }, err => { console.error('Hexmap error:', err); setLoaded(true) })
    return unsub
  }, [mapId])

  // Center the view on mount
  useEffect(() => {
    if (!containerRef.current) return
    const { x: cx, y: cy } = hexCenter(centerCol, centerRow)
    const { offsetWidth: vw, offsetHeight: vh } = containerRef.current
    setPan({ x: vw / 2 - cx * zoom, y: vh / 2 - cy * zoom })
  }, [loaded, cols, rows])

  const saveHex = useCallback(async (col, row, data) => {
    const key = `${col},${row}`
    const newHexes = { ...hexData, [key]: { ...data, col, row } }
    setHexData(newHexes)
    writing.current = Date.now()
    await setDoc(doc(db, `hexmap/${mapId}`), { hexes: newHexes, updatedAt: serverTimestamp() })
    setSelectedHex(null)
  }, [hexData, mapId])

  // Pan handlers
  const onMouseDown = (e) => {
    if (e.button !== 1 && !(e.button === 0 && e.altKey)) return
    e.preventDefault()
    isPanning.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseMove = useCallback((e) => {
    if (!isPanning.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }
    setPan(p => ({ x: p.x + dx, y: p.y + dy }))
  }, [])
  const onMouseUp = () => { isPanning.current = false }

  // Touch pan
  const lastTouch = useRef(null)
  const onTouchStart = (e) => {
    if (e.touches.length === 1) lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchMove = (e) => {
    if (e.touches.length !== 1 || !lastTouch.current) return
    const dx = e.touches[0].clientX - lastTouch.current.x
    const dy = e.touches[0].clientY - lastTouch.current.y
    lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    setPan(p => ({ x: p.x + dx, y: p.y + dy }))
  }

  // Zoom
  const onWheel = useCallback((e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    // Mouse position relative to container
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    // Zoom toward mouse: adjust pan so the point under cursor stays fixed
    setZoom(prevZoom => {
      const newZoom = Math.max(0.3, Math.min(3, prevZoom * delta))
      setPan(prevPan => ({
        x: mx - (mx - prevPan.x) * (newZoom / prevZoom),
        y: my - (my - prevPan.y) * (newZoom / prevZoom),
      }))
      return newZoom
    })
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onWheel, onMouseMove])

  // Viewport culling — only render visible hexes
  const visibleHexes = useMemo(() => {
    if (!containerRef.current) return []
    const vw = containerRef.current?.offsetWidth || 800
    const vh = containerRef.current?.offsetHeight || 600
    const margin = HEX_W * 2
    const minX = (-pan.x - margin) / zoom
    const minY = (-pan.y - margin) / zoom
    const maxX = (vw - pan.x + margin) / zoom
    const maxY = (vh - pan.y + margin) / zoom
    const result = []
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const { x, y } = hexCenter(c, r)
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
          result.push({ col: c, row: r })
        }
      }
    }
    return result
  }, [pan, zoom, cols, rows])

  const selKey = selectedHex ? `${selectedHex.col},${selectedHex.row}` : null
  const selData = selKey ? hexData[selKey] : null
  const selLabel = selectedHex ? hexCoordLabel(selectedHex.col, selectedHex.row) : ''
  const selIsCenter = selectedHex?.col === centerCol && selectedHex?.row === centerRow

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* Controls bar */}
      <div style={{ padding: '6px 14px', borderBottom: '1px solid #e8e5e0', background: '#f8f7f4',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem',
          color: '#555', cursor: 'pointer', userSelect: 'none' }}>
          <input type='checkbox' checked={showLabels} onChange={e => setShowLabels(e.target.checked)}
            style={{ accentColor: '#1b4f72' }}/>
          Show coordinate labels
        </label>
        <div style={{ fontSize: '0.72rem', color: '#aaa' }}>
          Alt+drag or middle-click to pan · scroll to zoom
        </div>
        <div style={{ flex: 1 }}/>
        <button onClick={() => setZoom(z => Math.min(3, z * 1.2))}
          style={{ padding: '3px 8px', border: '1px solid #ccc9c0', borderRadius: 3, background: '#f0eeea',
            cursor: 'pointer', fontSize: '0.8rem' }}>+</button>
        <span style={{ fontSize: '0.75rem', color: '#888', minWidth: 36, textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={() => setZoom(z => Math.max(0.3, z * 0.8))}
          style={{ padding: '3px 8px', border: '1px solid #ccc9c0', borderRadius: 3, background: '#f0eeea',
            cursor: 'pointer', fontSize: '0.8rem' }}>−</button>
        <button onClick={() => {
          const el = containerRef.current
          if (!el) return
          const { x: cx, y: cy } = hexCenter(centerCol, centerRow)
          setZoom(1)
          setPan({ x: el.offsetWidth / 2 - cx, y: el.offsetHeight / 2 - cy })
        }} style={{ padding: '3px 8px', border: '1px solid #ccc9c0', borderRadius: 3, background: '#f0eeea',
          cursor: 'pointer', fontSize: '0.75rem' }}>⌂ Center</button>
      </div>

      {/* Map canvas */}
      <div ref={containerRef}
        style={{ flex: 1, overflow: 'hidden', cursor: 'crosshair', position: 'relative', background: '#f0f0f0' }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}>
        <svg
          width={canvasW} height={canvasH}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0', position: 'absolute', top: 0, left: 0 }}>

          {visibleHexes.map(({ col, row }) => {
            const { x, y } = hexCenter(col, row)
            const key = `${col},${row}`
            const data = hexData[key]
            const isCenter = col === centerCol && row === centerRow
            const isSel = col === selectedHex?.col && row === selectedHex?.row
            const marker = MARKERS.find(m => m.id === (data?.marker || 'none'))
            const explored = data?.explored
            const danger = data?.danger ?? 0
            const label = hexCoordLabel(col, row)

            let fill = '#fff'
            if (isCenter) fill = '#e8f0f8'
            else if (!explored && data) fill = '#f4f2ee'
            else if (explored) fill = '#fafff8'

            let stroke = '#ccc'
            if (isCenter) stroke = '#1b4f72'
            if (isSel) stroke = '#f5a623'

            return (
              <g key={key} onClick={() => setSelectedHex({ col, row })}
                style={{ cursor: 'pointer' }}>
                <polygon points={hexPoints(x, y)}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSel ? 2.5 : isCenter ? 2 : 1}
                  style={{ transition: 'fill 0.1s' }}/>

                {/* Danger tint */}
                {danger > 0 && (
                  <polygon points={hexPoints(x, y)}
                    fill={DANGER_COLORS[danger]}
                    opacity={0.08 + danger * 0.04}
                    stroke='none'/>
                )}

                {/* Center settlement */}
                {isCenter && (
                  <>
                    <text x={x} y={y - 6} textAnchor='middle' fontSize={18} style={{ userSelect: 'none', filter: 'grayscale(1)' }}>🏰</text>
                    <text x={x} y={y + 10} textAnchor='middle' fontSize={7}
                      fill='#1b4f72' fontWeight='bold' style={{ userSelect: 'none' }}>
                      {centerName}
                    </text>
                  </>
                )}

                {/* Marker emoji — grayscale so danger tint colour shows through hex fill */}
                {!isCenter && data?.marker && data.marker !== '○' && (
                  <text x={x} y={y + 6} textAnchor='middle' fontSize={16}
                    style={{ userSelect: 'none', filter: 'grayscale(1)' }}>
                    {data.marker}
                  </text>
                )}

                {/* Coordinate label or custom name */}
                {showLabels && (
                  <text x={x} y={y + (marker?.emoji && !isCenter ? 18 : 6)}
                    textAnchor='middle' fontSize={6.5} fill='#999'
                    style={{ userSelect: 'none' }}>
                    {data?.name && data.name !== label ? data.name : label}
                  </text>
                )}

                {/* Explored dot */}
                {explored && !isCenter && (
                  <circle cx={x + HEX_SIZE * 0.65} cy={y - HEX_SIZE * 0.55} r={3}
                    fill='#3a7a3a' opacity={0.7}/>
                )}
              </g>
            )
          })}
        </svg>

        {!loaded && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#aaa', fontStyle: 'italic',
            fontFamily: "'Source Serif 4', Georgia, serif" }}>
            Loading map…
          </div>
        )}
      </div>

      {/* Hex editor panel */}
      {selectedHex && (
        <HexEditor
          hexKey={selKey}
          hexData={selData}
          coordLabel={selLabel}
          isCenter={selIsCenter}
          centerName={centerName}
          admin={admin}
          onSave={(draft) => saveHex(selectedHex.col, selectedHex.row, draft)}
          onClose={() => setSelectedHex(null)}/>
      )}

      {/* Legend */}
      <div style={{ padding: '5px 14px', borderTop: '1px solid #e8e5e0', background: '#f8f7f4',
        display: 'flex', gap: 12, flexWrap: 'wrap', flexShrink: 0, fontSize: '0.65rem', color: '#888' }}>
        <span>Click hex to view/edit</span>
        {MARKERS.filter(m => m.emoji).map(m => (
          <span key={m.id}>{m.emoji} {m.label}</span>
        ))}
        <span style={{ marginLeft: 8 }}>
          {DANGER_LABELS.map((l, i) => (
            <span key={i} style={{ color: DANGER_COLORS[i], marginRight: 6 }}>● {l}</span>
          ))}
        </span>
      </div>
    </div>
  )
}

// ─── Main HexMap page ─────────────────────────────────────────────────────────
export default function HexMap({ user, onClose }) {
  const admin = isAdmin(user)
  const [tabs, setTabs] = useState([
    { id: 'melpho',  name: 'Melphö',  cols: 64, rows: 64 },
    { id: 'attitan', name: 'Attitan', cols: 64, rows: 64 },
  ])
  const [activeTab, setActiveTab] = useState('melpho')
  const [addingTab, setAddingTab] = useState(false)
  const [newTabName, setNewTabName] = useState('')
  const [editingTabName, setEditingTabName] = useState(null)
  const [editingTabNameVal, setEditingTabNameVal] = useState('')

  // Persist tabs list
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'hexmap/tabs'), snap => {
      if (snap.exists() && snap.data().tabs?.length) setTabs(snap.data().tabs)
    })
    return unsub
  }, [])

  const saveTabs = (newTabs) => {
    setTabs(newTabs)
    setDoc(doc(db, 'hexmap/tabs'), { tabs: newTabs, updatedAt: serverTimestamp() })
  }

  const addTab = () => {
    const name = newTabName.trim()
    if (!name) return
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const newTabs = [...tabs, { id, name, cols: 64, rows: 64 }]
    saveTabs(newTabs)
    setActiveTab(id)
    setNewTabName(''); setAddingTab(false)
  }

  const renameTab = (tabId) => {
    const name = editingTabNameVal.trim()
    if (!name) { setEditingTabName(null); return }
    saveTabs(tabs.map(t => t.id === tabId ? { ...t, name } : t))
    setEditingTabName(null)
  }

  const deleteTab = (tabId) => {
    if (!confirm('Delete this map tab?')) return
    const newTabs = tabs.filter(t => t.id !== tabId)
    saveTabs(newTabs)
    if (activeTab === tabId) setActiveTab(newTabs[0]?.id || null)
  }

  const growMap = (tabId) => {
    saveTabs(tabs.map(t => t.id === tabId ? { ...t, cols: t.cols + 16, rows: t.rows + 16 } : t))
  }

  const activeTabData = tabs.find(t => t.id === activeTab)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#f0eeea',
      display: 'flex', flexDirection: 'column', fontFamily: "'Source Serif 4', Georgia, serif" }}>

      {/* Header */}
      <div style={{ background: '#1b4f72', padding: '0 1.2rem', height: 50, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '2px solid #14395a' }}>
        <span style={{ fontFamily: "'IM Fell English', serif", fontSize: '1.1rem', color: '#e8f0f8' }}>
          Hex Map
        </span>
        <div style={{ flex: 1 }}/>
        {admin && activeTabData && (
          <button onClick={() => growMap(activeTab)}
            style={{ padding: '4px 10px', border: '1px solid #4a7fa5', borderRadius: 3,
              background: 'transparent', color: '#a8d0e8', cursor: 'pointer',
              fontSize: '0.78rem', fontFamily: "'Source Serif 4', Georgia, serif" }}>
            ⊕ Grow Map (+16)
          </button>
        )}
        <button onClick={onClose}
          style={{ padding: '4px 12px', border: '1px solid #4a7fa5', borderRadius: 3,
            background: 'transparent', color: '#a8d0e8', cursor: 'pointer',
            fontSize: '0.82rem', fontFamily: "'Source Serif 4', Georgia, serif" }}>← Back</button>
      </div>

      {/* Tab bar */}
      <div style={{ background: '#14395a', display: 'flex', alignItems: 'flex-end',
        padding: '0 1rem', gap: 2, flexShrink: 0, overflowX: 'auto' }}>
        {tabs.map(tab => (
          <div key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: '7px 16px 5px', cursor: 'pointer', userSelect: 'none',
              borderRadius: '4px 4px 0 0',
              background: activeTab === tab.id ? '#f0eeea' : 'transparent',
              color: activeTab === tab.id ? '#1b4f72' : '#7aafcc',
              fontFamily: "'IM Fell English', serif", fontSize: '0.88rem',
              display: 'flex', alignItems: 'center', gap: 6,
              marginBottom: activeTab === tab.id ? -1 : 0,
              borderBottom: activeTab === tab.id ? '1px solid #f0eeea' : '1px solid transparent' }}>
            {editingTabName === tab.id && admin
              ? <input autoFocus value={editingTabNameVal}
                  onChange={e => setEditingTabNameVal(e.target.value)}
                  onBlur={() => renameTab(tab.id)}
                  onKeyDown={e => { if(e.key==='Enter')renameTab(tab.id); if(e.key==='Escape')setEditingTabName(null) }}
                  onClick={e => e.stopPropagation()}
                  style={{ width: 90, padding: '1px 4px', border: '1px solid #1b4f72', borderRadius: 2,
                    fontSize: '0.88rem', fontFamily: "'IM Fell English', serif" }}/>
              : <span onDoubleClick={() => admin && (setEditingTabName(tab.id), setEditingTabNameVal(tab.name))}>
                  {tab.name}
                </span>
            }
            {admin && activeTab === tab.id && tabs.length > 1 && (
              <span onClick={e => { e.stopPropagation(); deleteTab(tab.id) }}
                style={{ fontSize: '0.6rem', color: '#aaa', cursor: 'pointer' }}>✕</span>
            )}
          </div>
        ))}
        {admin && (
          addingTab
            ? <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px' }}>
                <input autoFocus value={newTabName} onChange={e => setNewTabName(e.target.value)}
                  onKeyDown={e => { if(e.key==='Enter')addTab(); if(e.key==='Escape'){setAddingTab(false);setNewTabName('')} }}
                  placeholder='Region name…'
                  style={{ width: 110, padding: '2px 6px', border: '1px solid #4a7fa5', borderRadius: 3,
                    fontSize: '0.82rem', background: '#14395a', color: '#c8e0f0', fontFamily: "'Source Serif 4', Georgia, serif" }}/>
                <button onClick={addTab} style={{ padding: '2px 7px', border: 'none', borderRadius: 3,
                  background: '#1b9bc8', color: '#fff', cursor: 'pointer', fontSize: '0.72rem' }}>+</button>
                <button onClick={() => { setAddingTab(false); setNewTabName('') }}
                  style={{ padding: '2px 6px', border: '1px solid #4a7fa5', borderRadius: 3,
                    background: 'none', color: '#7aafcc', cursor: 'pointer', fontSize: '0.72rem' }}>✕</button>
              </div>
            : <button onClick={() => setAddingTab(true)}
                style={{ padding: '7px 12px', border: 'none', background: 'none',
                  cursor: 'pointer', color: '#7aafcc', fontSize: '1rem', marginBottom: 2 }}>+</button>
        )}
      </div>

      {/* Map */}
      {activeTabData ? (
        <HexMapTab
          key={activeTabData.id}
          mapId={activeTabData.id}
          centerName={activeTabData.name}
          user={user}
          cols={activeTabData.cols}
          rows={activeTabData.rows}/>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#aaa', fontStyle: 'italic' }}>No map selected.</div>
      )}
    </div>
  )
}
