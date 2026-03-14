import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

const ADV_DOC = 'bulletin/adventures'
const uid = () => Math.random().toString(36).slice(2, 10)

const PRESET_TAGS = ['Main Quest', 'Side Quest', 'Exploration', 'Political', 'Combat Heavy', 'Social', 'Dungeon', 'Wilderness', 'Urban', 'Horror']
const DIFFICULTY_LABELS = ['Trivial', 'Easy', 'Medium', 'Hard', 'Deadly', 'Legendary']
const FUN_LABELS = ['Poor', 'Below Average', 'Average', 'Good', 'Great', 'Exceptional']
const CRAFT_LABELS = ['Rough', 'Developing', 'Solid', 'Polished', 'Masterful', 'Perfect']

const lb = { display: 'block', fontSize: '0.67rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', marginBottom: 3 }
const inp = (extra = {}) => ({ width: '100%', padding: '6px 8px', border: '1px solid #ccc9c0', borderRadius: 3, fontSize: '0.84rem', fontFamily: "'Source Serif 4', Georgia, serif", background: '#f8f7f4', color: '#222', boxSizing: 'border-box', ...extra })
const btnStyle = (primary, danger) => ({
  padding: '5px 14px', border: primary ? 'none' : danger ? '1px solid #e0b0b0' : '1px solid #ccc9c0',
  borderRadius: 3, cursor: 'pointer', fontSize: '0.8rem', fontFamily: "'Source Serif 4', Georgia, serif",
  background: primary ? '#1b4f72' : danger ? 'none' : '#f0eeea',
  color: primary ? '#fff' : danger ? '#b44' : '#444',
})

// ─── Star/slider review widget ────────────────────────────────────────────────
function RatingSlider({ label, value, onChange, labels, color = '#1b4f72' }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <label style={{ ...lb, marginBottom: 0 }}>{label}</label>
        <span style={{ fontSize: '0.75rem', color, fontWeight: 600 }}>{labels[value] || value}</span>
      </div>
      <input type='range' min={0} max={5} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: color }}/>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#bbb', marginTop: 2 }}>
        <span>{labels[0]}</span><span>{labels[5]}</span>
      </div>
    </div>
  )
}

// ─── Tag picker ───────────────────────────────────────────────────────────────
function TagPicker({ tags, onChange }) {
  const [custom, setCustom] = useState('')
  const toggle = (tag) => {
    if (tags.includes(tag)) onChange(tags.filter(t => t !== tag))
    else onChange([...tags, tag])
  }
  const addCustom = () => {
    const t = custom.trim()
    if (t && !tags.includes(t)) onChange([...tags, t])
    setCustom('')
  }
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
        {PRESET_TAGS.map(tag => (
          <div key={tag} onClick={() => toggle(tag)}
            style={{ padding: '3px 10px', borderRadius: 12, cursor: 'pointer', fontSize: '0.72rem',
              background: tags.includes(tag) ? '#1b4f72' : '#f0eeea',
              color: tags.includes(tag) ? '#fff' : '#666',
              border: `1px solid ${tags.includes(tag) ? '#1b4f72' : '#ccc9c0'}`,
              userSelect: 'none' }}>
            {tag}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={custom} onChange={e => setCustom(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addCustom()}
          placeholder='Custom tag…'
          style={{ ...inp(), marginBottom: 0, flex: 1 }}/>
        <button onClick={addCustom} style={btnStyle(true)}>Add</button>
      </div>
      {tags.filter(t => !PRESET_TAGS.includes(t)).map(tag => (
        <span key={tag} onClick={() => toggle(tag)}
          style={{ display: 'inline-block', margin: '4px 4px 0 0', padding: '2px 8px', borderRadius: 12,
            background: '#1b4f72', color: '#fff', fontSize: '0.72rem', cursor: 'pointer' }}>
          {tag} ✕
        </span>
      ))}
    </div>
  )
}

// ─── Adventure editor ─────────────────────────────────────────────────────────
function AdventureEditor({ adventure, onSave, onCancel, user }) {
  const isNew = !adventure?.id
  const [draft, setDraft] = useState(adventure || {
    name: '', description: '', rewards: '', actualRewards: '',
    summary: '', notes: '', heroes: '', tags: [],
  })
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }))

  const ta = (key, placeholder, rows = 3) => (
    <textarea value={draft[key] || ''} onChange={e => set(key, e.target.value)}
      placeholder={placeholder} rows={rows}
      style={{ ...inp({ resize: 'vertical', lineHeight: 1.6 }), minHeight: rows * 22 }}/>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '2rem 1rem', overflowY: 'auto' }}
      onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fdf8f0', borderRadius: 8, padding: '1.5rem',
        width: '100%', maxWidth: 560,
        boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
        fontFamily: "'Source Serif 4', Georgia, serif",
      }}>
        <div style={{ fontFamily: "'IM Fell English', serif", fontSize: '1.15rem', color: '#1b4f72', marginBottom: '1.2rem' }}>
          {isNew ? 'New Adventure' : 'Edit Adventure'}
        </div>

        <label style={lb}>Adventure Name</label>
        <input style={inp({ marginBottom: 10 })} value={draft.name}
          onChange={e => set('name', e.target.value)} placeholder='e.g. The Hollow Road'/>

        <label style={lb}>Description</label>
        {ta('description', 'A brief overview of the adventure hook…')}
        <div style={{ height: 10 }}/>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <div>
            <label style={lb}>Possible Rewards</label>
            {ta('rewards', 'What was on offer…', 2)}
          </div>
          <div>
            <label style={lb}>Actual Rewards</label>
            {ta('actualRewards', 'What was earned…', 2)}
          </div>
        </div>
        <div style={{ height: 10 }}/>

        <label style={lb}>Adventure Summary</label>
        {ta('summary', 'What happened, start to finish…', 4)}
        <div style={{ height: 10 }}/>

        <label style={lb}>Notes</label>
        {ta('notes', 'GM notes, loose ends, follow-up hooks…', 3)}
        <div style={{ height: 10 }}/>

        <label style={lb}>Heroes Present</label>
        <input style={inp({ marginBottom: 10 })} value={draft.heroes || ''}
          onChange={e => set('heroes', e.target.value)}
          placeholder='e.g. Aldric, Senna, Morrow the Half-Named'/>

        <label style={{ ...lb, marginBottom: 8 }}>Tags</label>
        <TagPicker tags={draft.tags || []} onChange={v => set('tags', v)}/>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: '1.2rem' }}>
          <button onClick={onCancel} style={btnStyle()}>Cancel</button>
          <button onClick={() => onSave(draft)} disabled={!draft.name.trim()}
            style={btnStyle(!draft.name.trim() ? false : true)}>
            {isNew ? 'Create Adventure' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Review tab ───────────────────────────────────────────────────────────────
function ReviewTab({ adventure, user, onSaveReview }) {
  const reviews = adventure.reviews || []
  const myReview = reviews.find(r => r.uid === user?.uid)
  const [editing, setEditing] = useState(!myReview)
  const [draft, setDraft] = useState(myReview || { difficulty: 2, fun: 3, craft: 3, comment: '' })

  const avg = (key) => {
    if (!reviews.length) return null
    return (reviews.reduce((s, r) => s + (r[key] ?? 3), 0) / reviews.length).toFixed(1)
  }

  const save = () => {
    onSaveReview({ ...draft, uid: user.uid, name: user.displayName || user.email })
    setEditing(false)
  }

  return (
    <div>
      {/* Aggregate scores */}
      {reviews.length > 0 && (
        <div style={{ background: '#f0eeea', borderRadius: 6, padding: '10px 14px', marginBottom: 16,
          display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#b44' }}>{avg('difficulty')}</div>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#888' }}>Difficulty</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1b7a3a' }}>{avg('fun')}</div>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#888' }}>Fun</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1b4f72' }}>{avg('craft')}</div>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#888' }}>Well-Made</div>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#aaa', alignSelf: 'center' }}>{reviews.length} review{reviews.length !== 1 ? 's' : ''}</div>
        </div>
      )}

      {/* My review */}
      {editing ? (
        <div style={{ background: '#faf9f6', border: '1px solid #ccc9c0', borderRadius: 6, padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1b4f72', marginBottom: 12 }}>Your Review</div>
          <RatingSlider label='Difficulty' value={draft.difficulty} onChange={v => setDraft(d => ({ ...d, difficulty: v }))}
            labels={DIFFICULTY_LABELS} color='#b44'/>
          <RatingSlider label='Fun' value={draft.fun} onChange={v => setDraft(d => ({ ...d, fun: v }))}
            labels={FUN_LABELS} color='#1b7a3a'/>
          <RatingSlider label='Well-Made' value={draft.craft} onChange={v => setDraft(d => ({ ...d, craft: v }))}
            labels={CRAFT_LABELS} color='#1b4f72'/>
          <label style={lb}>Comment (optional)</label>
          <textarea value={draft.comment || ''} onChange={e => setDraft(d => ({ ...d, comment: e.target.value }))}
            placeholder='Any thoughts…' rows={2}
            style={{ ...inp({ resize: 'vertical' }) }}/>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
            {myReview && <button onClick={() => setEditing(false)} style={btnStyle()}>Cancel</button>}
            <button onClick={save} style={btnStyle(true)}>Submit Review</button>
          </div>
        </div>
      ) : myReview && (
        <div style={{ background: '#eef4f8', border: '1px solid #bcd', borderRadius: 6, padding: '10px 14px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1b4f72' }}>Your Review</span>
            <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: '#888' }}>✎ Edit</button>
          </div>
          <div style={{ display: 'flex', gap: 14, fontSize: '0.78rem', color: '#555' }}>
            <span>Difficulty: <strong style={{ color: '#b44' }}>{DIFFICULTY_LABELS[myReview.difficulty]}</strong></span>
            <span>Fun: <strong style={{ color: '#1b7a3a' }}>{FUN_LABELS[myReview.fun]}</strong></span>
            <span>Well-Made: <strong style={{ color: '#1b4f72' }}>{CRAFT_LABELS[myReview.craft]}</strong></span>
          </div>
          {myReview.comment && <div style={{ marginTop: 5, fontSize: '0.78rem', color: '#666', fontStyle: 'italic' }}>{myReview.comment}</div>}
        </div>
      )}

      {/* Other reviews */}
      {reviews.filter(r => r.uid !== user?.uid).map((r, i) => (
        <div key={i} style={{ background: '#faf9f6', border: '1px solid #e8e5e0', borderRadius: 6,
          padding: '8px 12px', marginBottom: 8 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#555', marginBottom: 4 }}>{r.name}</div>
          <div style={{ display: 'flex', gap: 12, fontSize: '0.72rem', color: '#777', flexWrap: 'wrap' }}>
            <span>Difficulty: <strong style={{ color: '#b44' }}>{DIFFICULTY_LABELS[r.difficulty]}</strong></span>
            <span>Fun: <strong style={{ color: '#1b7a3a' }}>{FUN_LABELS[r.fun]}</strong></span>
            <span>Well-Made: <strong style={{ color: '#1b4f72' }}>{CRAFT_LABELS[r.craft]}</strong></span>
          </div>
          {r.comment && <div style={{ marginTop: 4, fontSize: '0.72rem', color: '#888', fontStyle: 'italic' }}>{r.comment}</div>}
        </div>
      ))}

      {!myReview && !editing && (
        <button onClick={() => setEditing(true)} style={btnStyle(true)}>Leave a Review</button>
      )}
    </div>
  )
}

// ─── Adventure detail view ────────────────────────────────────────────────────
function AdventureDetail({ adventure, user, onEdit, onDelete, onClose, onSaveReview }) {
  const [tab, setTab] = useState('details')

  const Field = ({ label, value }) => value ? (
    <div style={{ marginBottom: 12 }}>
      <div style={{ ...lb, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '0.84rem', color: '#333', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{value}</div>
    </div>
  ) : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '2rem 1rem', overflowY: 'auto' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fdf8f0', borderRadius: 8, width: '100%', maxWidth: 580,
        boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
        fontFamily: "'Source Serif 4', Georgia, serif",
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '1.2rem 1.5rem 0', borderBottom: '1px solid #e8e5e0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
            <h2 style={{ fontFamily: "'IM Fell English', serif", fontSize: '1.3rem', color: '#1a1a1a',
              lineHeight: 1.2, flex: 1, margin: 0 }}>{adventure.name}</h2>
            <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
              <button onClick={onEdit} style={btnStyle()}>✎ Edit</button>
              <button onClick={onDelete} style={btnStyle(false, true)}>🗑</button>
              <button onClick={onClose} style={btnStyle()}>✕</button>
            </div>
          </div>
          {adventure.tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
              {adventure.tags.map(tag => (
                <span key={tag} style={{ padding: '2px 8px', borderRadius: 10, fontSize: '0.68rem',
                  background: '#1b4f72', color: '#fff' }}>{tag}</span>
              ))}
            </div>
          )}
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0 }}>
            {['details', 'review'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '6px 16px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: '0.78rem', textTransform: 'capitalize', letterSpacing: '0.04em',
                  color: tab === t ? '#1b4f72' : '#aaa', fontWeight: tab === t ? 700 : 400,
                  borderBottom: tab === t ? '2px solid #1b4f72' : '2px solid transparent',
                  fontFamily: "'Source Serif 4', Georgia, serif" }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '1.2rem 1.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
          {tab === 'details' ? (
            <>
              <Field label='Description' value={adventure.description}/>
              <Field label='Heroes Present' value={adventure.heroes}/>
              <Field label='Possible Rewards' value={adventure.rewards}/>
              <Field label='Actual Rewards' value={adventure.actualRewards}/>
              <Field label='Summary' value={adventure.summary}/>
              <Field label='Notes' value={adventure.notes}/>
              {!adventure.description && !adventure.summary && !adventure.heroes && (
                <div style={{ color: '#bbb', fontStyle: 'italic', fontSize: '0.84rem' }}>No details yet.</div>
              )}
            </>
          ) : (
            <ReviewTab adventure={adventure} user={user} onSaveReview={onSaveReview}/>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Adventures tab ──────────────────────────────────────────────────────
export default function Adventures({ user }) {
  const [adventures, setAdventures] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(null)      // adventure or 'new'
  const [viewing, setViewing] = useState(null)      // adventure being viewed
  const [filter, setFilter] = useState('')          // tag filter
  const [search, setSearch] = useState('')
  const writing = useRef(false)

  useEffect(() => {
    const unsub = onSnapshot(doc(db, ADV_DOC), snap => {
      if (writing.current) return
      setAdventures(snap.exists() ? (snap.data().list || []) : [])
      setLoaded(true)
    }, err => { console.error('Adventures error:', err); setLoaded(true) })
    return unsub
  }, [])

  const persist = async (list) => {
    writing.current = true
    try { await setDoc(doc(db, ADV_DOC), { list, updatedAt: serverTimestamp() }) }
    finally { writing.current = false }
  }

  const saveAdventure = (draft) => {
    let list
    if (editing === 'new') {
      list = [{ ...draft, id: uid(), createdAt: Date.now(), reviews: [] }, ...adventures]
    } else {
      list = adventures.map(a => a.id === editing.id ? { ...a, ...draft } : a)
    }
    setAdventures(list)
    persist(list)
    setEditing(null)
  }

  const deleteAdventure = (id) => {
    if (!confirm('Delete this adventure record?')) return
    const list = adventures.filter(a => a.id !== id)
    setAdventures(list)
    persist(list)
    setViewing(null)
  }

  const saveReview = (adventureId, review) => {
    const list = adventures.map(a => {
      if (a.id !== adventureId) return a
      const reviews = (a.reviews || []).filter(r => r.uid !== review.uid)
      return { ...a, reviews: [...reviews, review] }
    })
    setAdventures(list)
    persist(list)
    // Update viewing state too
    setViewing(list.find(a => a.id === adventureId) || null)
  }

  // Filter + search
  const allTags = [...new Set(adventures.flatMap(a => a.tags || []))]
  const visible = adventures.filter(a => {
    if (filter && !(a.tags || []).includes(filter)) return false
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) &&
        !(a.description || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: "'Source Serif 4', Georgia, serif" }}>
      {/* Toolbar */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #e8e5e0',
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder='Search adventures…'
          style={{ ...inp({ marginBottom: 0 }), width: 180 }}/>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          style={{ ...inp({ marginBottom: 0 }), width: 'auto', cursor: 'pointer' }}>
          <option value=''>All tags</option>
          {allTags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div style={{ flex: 1 }}/>
        <button onClick={() => setEditing('new')} style={btnStyle(true)}>+ New Adventure</button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {!loaded && <div style={{ color: '#aaa', fontStyle: 'italic' }}>Loading…</div>}
        {loaded && visible.length === 0 && (
          <div style={{ color: '#aaa', fontStyle: 'italic', fontSize: '0.88rem', marginTop: 20, textAlign: 'center' }}>
            {adventures.length === 0 ? 'No adventures recorded yet.' : 'No adventures match your filter.'}
          </div>
        )}
        {visible.map(a => {
          const avgFun = a.reviews?.length ? (a.reviews.reduce((s,r)=>s+(r.fun??3),0)/a.reviews.length).toFixed(1) : null
          return (
            <div key={a.id} onClick={() => setViewing(a)}
              style={{ padding: '12px 14px', borderRadius: 6, border: '1px solid #e8e5e0',
                background: '#faf9f6', marginBottom: 8, cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                transition: 'box-shadow 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.1)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'IM Fell English', serif", fontSize: '1rem', color: '#1a1a1a', marginBottom: 3 }}>
                    {a.name}
                  </div>
                  {a.heroes && <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: 4 }}>👥 {a.heroes}</div>}
                  {a.description && (
                    <div style={{ fontSize: '0.78rem', color: '#666', lineHeight: 1.5,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }}>
                      {a.description}
                    </div>
                  )}
                  {a.tags?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>
                      {a.tags.map(tag => (
                        <span key={tag} style={{ padding: '1px 7px', borderRadius: 10, fontSize: '0.63rem',
                          background: '#eef', color: '#4a4a8a', border: '1px solid #dde' }}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {avgFun !== null && (
                    <div style={{ fontSize: '0.68rem', color: '#1b7a3a', fontWeight: 600 }}>
                      ★ {avgFun} fun
                    </div>
                  )}
                  {a.reviews?.length > 0 && (
                    <div style={{ fontSize: '0.63rem', color: '#aaa' }}>{a.reviews.length} review{a.reviews.length!==1?'s':''}</div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Editor */}
      {editing && (
        <AdventureEditor
          adventure={editing === 'new' ? null : editing}
          user={user}
          onSave={saveAdventure}
          onCancel={() => setEditing(null)}/>
      )}

      {/* Detail view */}
      {viewing && (
        <AdventureDetail
          adventure={viewing}
          user={user}
          onEdit={() => { setEditing(viewing); setViewing(null) }}
          onDelete={() => deleteAdventure(viewing.id)}
          onClose={() => setViewing(null)}
          onSaveReview={(review) => saveReview(viewing.id, review)}/>
      )}
    </div>
  )
}
