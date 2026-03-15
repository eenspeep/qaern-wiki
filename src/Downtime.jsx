import { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

const ADMIN = 'speep'
const isAdmin = u => u?.displayName === ADMIN

const BONUS_OPTIONS = [0,1,2,3,4,5,6]

const d10 = () => Math.floor(Math.random() * 10) + 1

const lb = { display:'block', fontSize:'0.67rem', textTransform:'uppercase', letterSpacing:'0.07em', color:'#888', marginBottom:3 }
const inp = (extra={}) => ({ width:'100%', padding:'6px 8px', border:'1px solid #ccc9c0', borderRadius:3,
  fontSize:'0.84rem', fontFamily:"'Source Serif 4',Georgia,serif",
  background:'#f8f7f4', color:'#222', boxSizing:'border-box', ...extra })

// ─── Die face SVG ─────────────────────────────────────────────────────────────
function DieFace({ value, rolling, size=52 }) {
  // d10 shape: pentagon-like polygon (10-sided die viewed from above)
  const s = size / 2
  // Approximate d10 as a kite/diamond shape — narrow top, wide middle, pointed bottom
  const points = [
    [s, 2],           // top point
    [size-4, s*0.7],  // upper right
    [size-2, s*1.35], // lower right
    [s, size-2],      // bottom point
    [2, s*1.35],      // lower left
    [4, s*0.7],       // upper left
  ].map(([x,y])=>`${x},${y}`).join(' ')

  return (
    <svg width={size} height={size} style={{ overflow:'visible', flexShrink:0,
      animation: rolling ? 'spin 0.4s linear infinite' : 'none' }}>
      <polygon points={points}
        fill={rolling ? '#1b4f72' : '#fdf8f0'}
        stroke={rolling ? '#1b4f72' : '#ccc9c0'}
        strokeWidth={2}
        style={{ filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.12))', transition:'fill 0.15s' }}/>
      <text x={s} y={s*1.15} textAnchor='middle' dominantBaseline='middle'
        fontSize={size*0.38} fontWeight='700'
        fontFamily="'IM Fell English',serif"
        fill={rolling ? '#fff' : '#1b4f72'}>
        {rolling ? '?' : value}
      </text>
    </svg>
  )
}

// ─── Roll form ────────────────────────────────────────────────────────────────
function RollForm({ user, onClose }) {
  const [playerName, setPlayerName] = useState(user?.displayName || '')
  const [sessionDate, setSessionDate] = useState('')
  const [goal, setGoal] = useState('')
  const [project, setProject] = useState('')
  const [skilledBonus, setSkilledBonus] = useState(false)
  const [additionalBonus, setAdditionalBonus] = useState(0)
  const [dice, setDice] = useState([null, null])
  const [rolling, setRolling] = useState(false)
  const [rolled, setRolled] = useState(false)
  const [saving, setSaving] = useState(false)

  const skillBonus = skilledBonus ? 2 : 0
  const addBonus = parseInt(additionalBonus) || 0
  const total = rolled ? (dice[0] + dice[1] + skillBonus + addBonus) : null

  const roll = () => {
    if (rolling || rolled) return
    setRolling(true)
    // Animate for 600ms then reveal
    setTimeout(() => {
      const d1 = d10(), d2 = d10()
      setDice([d1, d2])
      setRolling(false)
      setRolled(true)
    }, 600)
  }

  const save = async () => {
    if (!rolled || !playerName.trim() || !sessionDate) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'downtime'), {
        playerName: playerName.trim(),
        sessionDate,
        goal: goal.trim(),
        project: project.trim(),
        dice,
        skilledBonus,
        additionalBonus: parseInt(additionalBonus)||0,
        additionalBonusLabel: additionalBonus > 0 ? `+${additionalBonus}` : '',
        total,
        createdAt: serverTimestamp(),
        uid: user?.uid || '',
      })
      onClose()
    } catch(e) { console.error(e); setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:400,
      display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' }}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#fdf8f0', borderRadius:8,
        padding:'1.5rem', width:'100%', maxWidth:440,
        boxShadow:'0 8px 40px rgba(0,0,0,0.25)',
        fontFamily:"'Source Serif 4',Georgia,serif",
        maxHeight:'90vh', overflowY:'auto' }}>

        <div style={{ fontFamily:"'IM Fell English',serif", fontSize:'1.15rem', color:'#1b4f72', marginBottom:'1.2rem' }}>
          Log Downtime Roll
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 12px' }}>
          <div>
            <label style={lb}>Your Name</label>
            <input style={inp({marginBottom:10})} value={playerName}
              onChange={e=>setPlayerName(e.target.value)} placeholder='Character or player name'/>
          </div>
          <div>
            <label style={lb}>Session Date</label>
            <input type='date' style={inp({marginBottom:10})} value={sessionDate}
              onChange={e=>setSessionDate(e.target.value)}/>
          </div>
        </div>

        <label style={lb}>Project / Activity</label>
        <input style={inp({marginBottom:10})} value={project}
          onChange={e=>setProject(e.target.value)} placeholder='e.g. Crafting Silverite Dagger, Research into the Wyld'/>

        <label style={lb}>Goal</label>
        <input style={inp({marginBottom:14})} value={goal}
          onChange={e=>setGoal(e.target.value)} placeholder='What are you trying to achieve?'/>

        {/* Modifiers */}
        <div style={{ background:'#f0eeea', borderRadius:6, padding:'10px 12px', marginBottom:14 }}>
          <div style={{ fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.08em', color:'#888', marginBottom:8 }}>Roll Modifiers</div>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', userSelect:'none',
            fontSize:'0.84rem', color:'#333', marginBottom:8 }}>
            <input type='checkbox' checked={skilledBonus} onChange={e=>setSkilledBonus(e.target.checked)}
              style={{ accentColor:'#1b4f72', width:14, height:14 }}/>
            Applicable skill? <span style={{ color:'#1b4f72', fontWeight:600 }}>+2</span>
          </label>
          <label style={lb}>Additional Bonus</label>
          <select value={additionalBonus} onChange={e=>setAdditionalBonus(parseInt(e.target.value))}
            style={{ ...inp({marginBottom:0}), cursor:'pointer' }}>
            {BONUS_OPTIONS.map(v => <option key={v} value={v}>{v === 0 ? 'None' : `+${v}`}</option>)}
          </select>
        </div>

        {/* Dice area */}
        <div style={{ textAlign:'center', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:16, marginBottom:10 }}>
            <DieFace value={dice[0]} rolling={rolling}/>
            <span style={{ fontSize:'1.5rem', color:'#ccc' }}>+</span>
            <DieFace value={dice[1]} rolling={rolling}/>
            {(skilledBonus || addBonus > 0) && rolled && (
              <>
                <span style={{ fontSize:'1.2rem', color:'#ccc' }}>+</span>
                <div style={{ fontSize:'1.1rem', fontWeight:700, color:'#1b4f72' }}>
                  {skillBonus + addBonus}
                </div>
              </>
            )}
            {rolled && (
              <>
                <span style={{ fontSize:'1.2rem', color:'#aaa' }}>=</span>
                <div style={{ width:52, height:52, borderRadius:8, background:'#1b4f72',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'1.4rem', fontWeight:700, color:'#fff',
                  boxShadow:'0 2px 12px rgba(27,79,114,0.3)' }}>
                  {total}
                </div>
              </>
            )}
          </div>

          {!rolled && (
            <button onClick={roll} disabled={rolling}
              style={{ padding:'8px 28px', border:'none', borderRadius:4,
                background: rolling ? '#aaa' : '#1b4f72', color:'#fff',
                cursor: rolling ? 'default' : 'pointer', fontSize:'0.9rem',
                fontFamily:"'Source Serif 4',Georgia,serif" }}>
              {rolling ? 'Rolling…' : 'Roll 2d10'}
            </button>
          )}
          {rolled && (
            <div style={{ fontSize:'0.75rem', color:'#aaa', fontStyle:'italic' }}>
              {dice[0]} + {dice[1]}{skilledBonus?` + 2 (skill)`:''}
              {addBonus>0?` + ${addBonus} (bonus)`:''}
              {' '}= {total}
            </div>
          )}
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button onClick={onClose}
            style={{ padding:'6px 14px', border:'1px solid #ccc9c0', borderRadius:3,
              background:'#f0eeea', cursor:'pointer', fontSize:'0.8rem',
              fontFamily:"'Source Serif 4',Georgia,serif" }}>
            Cancel
          </button>
          <button onClick={save}
            disabled={!rolled || !playerName.trim() || !sessionDate || saving}
            style={{ padding:'6px 16px', border:'none', borderRadius:3,
              background: (!rolled||!playerName.trim()||!sessionDate) ? '#aaa' : '#1b4f72',
              color:'#fff', cursor: (!rolled||!playerName.trim()||!sessionDate) ? 'default' : 'pointer',
              fontSize:'0.8rem', fontFamily:"'Source Serif 4',Georgia,serif" }}>
            {saving ? 'Saving…' : 'Record Roll'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Single roll card ─────────────────────────────────────────────────────────
function RollCard({ roll, admin, onDelete }) {
  const breakdown = [
    roll.dice[0], '+', roll.dice[1],
    roll.skilledBonus ? '+ 2 (skill)' : null,
    roll.additionalBonus > 0 ? `+ ${roll.additionalBonus} (${roll.additionalBonusLabel||'bonus'})` : null,
  ].filter(Boolean).join(' ')

  return (
    <div style={{ background:'#faf9f6', border:'1px solid #e8e5e0', borderRadius:6,
      padding:'10px 14px', marginBottom:8,
      display:'flex', alignItems:'flex-start', gap:12 }}>
      {/* Total */}
      <div style={{ width:44, height:44, borderRadius:8, background:'#1b4f72', flexShrink:0,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:'1.3rem', fontWeight:700, color:'#fff',
        boxShadow:'0 1px 6px rgba(27,79,114,0.2)' }}>
        {roll.total}
      </div>
      {/* Details */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
          <span style={{ fontFamily:"'IM Fell English',serif", fontSize:'0.95rem', color:'#1a1a1a' }}>
            {roll.playerName}
          </span>
          {roll.project && (
            <span style={{ fontSize:'0.72rem', color:'#888', overflow:'hidden',
              textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              — {roll.project}
            </span>
          )}
        </div>
        {roll.goal && (
          <div style={{ fontSize:'0.76rem', color:'#666', marginBottom:2, fontStyle:'italic' }}>
            Goal: {roll.goal}
          </div>
        )}
        <div style={{ fontSize:'0.7rem', color:'#aaa' }}>{breakdown}</div>
      </div>
      {admin && (
        <button onClick={onDelete}
          style={{ background:'none', border:'none', cursor:'pointer',
            color:'#ccc', fontSize:'0.8rem', padding:'0 2px', flexShrink:0 }}>
          🗑
        </button>
      )}
    </div>
  )
}

// ─── Session group ────────────────────────────────────────────────────────────
function SessionGroup({ date, rolls, admin, onDelete }) {
  const [open, setOpen] = useState(true)
  const fmt = (d) => {
    try { return new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday:'long', year:'numeric', month:'long', day:'numeric' }) }
    catch { return d }
  }

  return (
    <div style={{ marginBottom:16 }}>
      <div onClick={() => setOpen(o=>!o)}
        style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer',
          padding:'6px 0', borderBottom:'2px solid #1b4f72', marginBottom:10, userSelect:'none' }}>
        <span style={{ fontFamily:"'IM Fell English',serif", fontSize:'1rem', color:'#1b4f72', flex:1 }}>
          {fmt(date)}
        </span>
        <span style={{ fontSize:'0.72rem', color:'#aaa' }}>{rolls.length} roll{rolls.length!==1?'s':''}</span>
        <span style={{ color:'#aaa', fontSize:'0.8rem' }}>{open?'▲':'▼'}</span>
      </div>
      {open && rolls.map(r => (
        <RollCard key={r.id} roll={r} admin={admin}
          onDelete={() => onDelete(r.id)}/>
      ))}
    </div>
  )
}

// ─── Main Downtime page ───────────────────────────────────────────────────────
export default function Downtime({ user, onClose }) {
  const admin = isAdmin(user)
  const [rolls, setRolls] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'downtime'), snap => {
      const list = snap.docs.map(d => ({ id:d.id, ...d.data() }))
      list.sort((a,b) => {
        if (b.sessionDate !== a.sessionDate) return b.sessionDate.localeCompare(a.sessionDate)
        return (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0)
      })
      setRolls(list)
      setLoaded(true)
    }, err => { console.error('Downtime error:', err); setLoaded(true) })
    return unsub
  }, [])

  const deleteRoll = async (id) => {
    if (!confirm('Delete this downtime roll?')) return
    await deleteDoc(doc(db, 'downtime', id))
  }

  const filtered = rolls.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return r.playerName?.toLowerCase().includes(q) ||
      r.project?.toLowerCase().includes(q) ||
      r.goal?.toLowerCase().includes(q)
  })

  // Group by session date
  const groups = {}
  filtered.forEach(r => {
    if (!groups[r.sessionDate]) groups[r.sessionDate] = []
    groups[r.sessionDate].push(r)
  })
  const sortedDates = Object.keys(groups).sort((a,b) => b.localeCompare(a))

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'#faf9f6',
      display:'flex', flexDirection:'column', fontFamily:"'Source Serif 4',Georgia,serif" }}>

      {/* Header */}
      <div style={{ background:'#1b4f72', padding:'0 1.2rem', height:50, flexShrink:0,
        display:'flex', alignItems:'center', gap:'1rem', borderBottom:'2px solid #14395a' }}>
        <span style={{ fontFamily:"'IM Fell English',serif", fontSize:'1.1rem', color:'#e8f4ff' }}>
          Downtime
        </span>
        <div style={{ flex:1 }}/>
        <button onClick={() => setShowForm(true)}
          style={{ padding:'5px 14px', border:'1px solid #a8d0e8', borderRadius:3,
            background:'transparent', color:'#a8d0e8', cursor:'pointer',
            fontSize:'0.82rem', fontFamily:"'Source Serif 4',Georgia,serif" }}>
          + Log Roll
        </button>
        <button onClick={onClose}
          style={{ padding:'5px 12px', border:'1px solid #4a7fa5', borderRadius:3,
            background:'transparent', color:'#a8d0e8', cursor:'pointer',
            fontSize:'0.82rem', fontFamily:"'Source Serif 4',Georgia,serif" }}>
          ← Back
        </button>
      </div>

      {/* Search */}
      <div style={{ padding:'10px 14px', borderBottom:'1px solid #e8e5e0', background:'#f8f7f4', flexShrink:0 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder='Search by player, project, or goal…'
          style={{ ...inp({marginBottom:0}), maxWidth:400 }}/>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', maxWidth:680, width:'100%', margin:'0 auto', boxSizing:'border-box' }}>
        {!loaded && <div style={{ color:'#aaa', fontStyle:'italic' }}>Loading…</div>}
        {loaded && sortedDates.length === 0 && (
          <div style={{ color:'#aaa', fontStyle:'italic', textAlign:'center', marginTop:40, fontSize:'0.9rem' }}>
            {rolls.length === 0 ? 'No downtime rolls recorded yet.' : 'No rolls match your search.'}
          </div>
        )}
        {sortedDates.map(date => (
          <SessionGroup key={date} date={date} rolls={groups[date]}
            admin={admin} onDelete={deleteRoll}/>
        ))}
      </div>

      {showForm && <RollForm user={user} onClose={() => setShowForm(false)}/>}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
