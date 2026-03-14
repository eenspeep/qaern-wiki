import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

const INIT_DOC = 'initiative/state'
const ADMIN = 'speep'
const isAdmin = u => u?.displayName === ADMIN

const uid = () => Math.random().toString(36).slice(2, 9)

const BLANK_STATE = {
  round: 1,
  phase: 'players',  // 'players' | 'monsters'
  players: [],
  monsterGroups: [],
}

const BLANK_PLAYER = (name) => ({
  id: uid(), name,
  triggered: false, main: false, maneuver: false, move: false,
  turnTaken: false, dead: false,
})

const BLANK_GROUP = (name) => ({
  id: uid(), name,
  monsters: [],
  turnTaken: false,
})

const BLANK_MONSTER = (name, hp) => ({
  id: uid(), name,
  tier: 'standard',  // 'minion' | 'standard' | 'leader'
  maxHp: hp || 10,
  hp: hp || 10,
  hpPer: 4,          // minion hp per member
  count: 4,          // minion count
  // leader extras
  extraTurns: 0,
  villain1: false, villain2: false, villain3: false,
  dead: false,
})

const PLAYER_COLOR  = '#1b4f72'
const MONSTER_COLOR = '#7a2020'

// ─── HP bar ───────────────────────────────────────────────────────────────────
function HpBar({ hp, maxHp }) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0
  const col = pct > 60 ? '#3a7a3a' : pct > 25 ? '#c8a020' : '#b44'
  return (
    <div style={{ height: 5, borderRadius: 3, background: '#e0ddd8', overflow: 'hidden', marginTop: 2 }}>
      <div style={{ height: '100%', width: pct + '%', background: col, borderRadius: 3, transition: 'width 0.2s' }}/>
    </div>
  )
}

// ─── Action checkbox ──────────────────────────────────────────────────────────
function ActionBox({ label, checked, onChange, disabled }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: disabled ? 'default' : 'pointer',
      fontSize: '0.75rem', color: checked ? '#222' : '#888', userSelect: 'none' }}>
      <input type='checkbox' checked={checked} onChange={e => !disabled && onChange(e.target.checked)}
        disabled={disabled} style={{ accentColor: PLAYER_COLOR, width: 13, height: 13 }}/>
      {label}
    </label>
  )
}

// ─── Monster row ──────────────────────────────────────────────────────────────
function MonsterRow({ monster, admin, onUpdate, onRemove }) {
  const upd = p => onUpdate({ ...monster, ...p })
  const isMinion = monster.tier === 'minion'
  const isLeader = monster.tier === 'leader'
  const totalHp = isMinion ? (monster.count || 1) * (monster.hpPer || 1) : monster.maxHp

  return (
    <div style={{ padding: '7px 8px', borderRadius: 4, background: 'rgba(0,0,0,0.06)',
      marginBottom: 5, opacity: monster.dead ? 0.4 : 1 }}>

      {/* Name + tier + dead toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
        <span style={{ fontSize: '0.78rem', color: monster.dead ? '#999' : '#2a0a0a', flex: 1,
          fontWeight: 600, textDecoration: monster.dead ? 'line-through' : 'none' }}>
          {monster.name}
        </span>
        {admin && <>
          <select value={monster.tier}
            onChange={e => upd({ tier: e.target.value })}
            style={{ fontSize: '0.65rem', border: '1px solid #e0c0c0', borderRadius: 3,
              background: '#fff8f4', color: '#7a3a2a', padding: '1px 3px', cursor: 'pointer' }}>
            <option value='minion'>Minion</option>
            <option value='standard'>Standard</option>
            <option value='leader'>Leader/Solo</option>
          </select>
          <button onClick={() => upd({ dead: !monster.dead })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem',
              color: monster.dead ? '#3a7a3a' : '#b44', padding: '0 2px' }}>
            {monster.dead ? '♥' : '💀'}
          </button>
          <button onClick={onRemove}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.65rem', color: '#ccc', padding: '0 1px' }}>✕</button>
        </>}
      </div>

      {/* HP section */}
      {isMinion ? (
        <div style={{ fontSize: '0.72rem', color: '#666' }}>
          {admin ? (
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.65rem', color: '#888' }}>Count</label>
              <input type='number' value={monster.count||4} min={0}
                onChange={e => { const c=parseInt(e.target.value)||0; upd({ count:c, maxHp:c*(monster.hpPer||1), hp:Math.min(monster.hp,c*(monster.hpPer||1)) }) }}
                style={{ width: 38, padding: '1px 4px', border: '1px solid #e0c0c0', borderRadius: 3, fontSize: '0.72rem', textAlign: 'center' }}/>
              <label style={{ fontSize: '0.65rem', color: '#888' }}>HP/each</label>
              <input type='number' value={monster.hpPer||4} min={1}
                onChange={e => { const h=parseInt(e.target.value)||1; upd({ hpPer:h, maxHp:(monster.count||1)*h, hp:Math.min(monster.hp,(monster.count||1)*h) }) }}
                style={{ width: 38, padding: '1px 4px', border: '1px solid #e0c0c0', borderRadius: 3, fontSize: '0.72rem', textAlign: 'center' }}/>
              <label style={{ fontSize: '0.65rem', color: '#888' }}>Pool HP</label>
              <input type='number' value={monster.hp} min={0} max={totalHp}
                onChange={e => upd({ hp: Math.max(0, Math.min(totalHp, parseInt(e.target.value)||0)) })}
                style={{ width: 44, padding: '1px 4px', border: '1px solid #e0c0c0', borderRadius: 3, fontSize: '0.72rem', textAlign: 'center' }}/>
              <span style={{ fontSize: '0.65rem', color: '#aaa' }}>/{totalHp}</span>
            </div>
          ) : (
            <span>{monster.count} minions · {monster.hp}/{totalHp} pool HP</span>
          )}
          <HpBar hp={monster.hp} maxHp={totalHp}/>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {admin ? (
            <>
              <input type='number' value={monster.hp} min={0} max={monster.maxHp}
                onChange={e => upd({ hp: Math.max(0, Math.min(monster.maxHp, parseInt(e.target.value)||0)) })}
                style={{ width: 44, padding: '1px 4px', border: '1px solid #e0c0c0', borderRadius: 3, fontSize: '0.72rem', textAlign: 'center' }}/>
              <span style={{ fontSize: '0.7rem', color: '#aaa' }}>/</span>
              <input type='number' value={monster.maxHp} min={1}
                onChange={e => { const m=parseInt(e.target.value)||1; upd({ maxHp:m, hp:Math.min(monster.hp,m) }) }}
                style={{ width: 44, padding: '1px 4px', border: '1px solid #e0c0c0', borderRadius: 3, fontSize: '0.72rem', textAlign: 'center' }}/>
            </>
          ) : (
            <span style={{ fontSize: '0.72rem', color: '#888' }}>{monster.hp}/{monster.maxHp} HP</span>
          )}
          <div style={{ flex: 1 }}><HpBar hp={monster.hp} maxHp={monster.maxHp}/></div>
        </div>
      )}

      {/* Leader extras */}
      {isLeader && admin && (
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: '#7a3a2a', cursor: 'pointer' }}>
            <span>Extra turns:</span>
            <input type='number' value={monster.extraTurns||0} min={0} max={5}
              onChange={e => upd({ extraTurns: parseInt(e.target.value)||0 })}
              style={{ width: 34, padding: '1px 4px', border: '1px solid #e0c0c0', borderRadius: 3, fontSize: '0.68rem', textAlign: 'center' }}/>
          </label>
          {[1,2,3].map(n => (
            <label key={n} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.68rem',
              color: monster[`villain${n}`] ? '#7a2020' : '#aaa', cursor: 'pointer', userSelect: 'none' }}>
              <input type='checkbox' checked={monster[`villain${n}`]||false}
                onChange={e => upd({ [`villain${n}`]: e.target.checked })}
                style={{ accentColor: MONSTER_COLOR, width: 12, height: 12 }}/>
              V.Action {n}
            </label>
          ))}
        </div>
      )}
      {isLeader && !admin && (monster.villain1||monster.villain2||monster.villain3) && (
        <div style={{ marginTop: 4, fontSize: '0.65rem', color: '#b44' }}>
          Villain actions: {[1,2,3].filter(n=>monster[`villain${n}`]).join(', ')}
        </div>
      )}
    </div>
  )
}

// ─── Monster group card ────────────────────────────────────────────────────────
function MonsterGroupCard({ group, admin, phase, onUpdate, onRemove, onEndTurn }) {
  const [newName, setNewName] = useState('')
  const [newHp, setNewHp] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(group.name)

  const updMonster = (id, patch) =>
    onUpdate({ ...group, monsters: group.monsters.map(m => m.id === id ? { ...m, ...patch } : m) })
  const removeMonster = id =>
    onUpdate({ ...group, monsters: group.monsters.filter(m => m.id !== id) })
  const addMonster = () => {
    if (!newName.trim()) return
    onUpdate({ ...group, monsters: [...group.monsters, BLANK_MONSTER(newName.trim(), parseInt(newHp)||10)] })
    setNewName(''); setNewHp('')
  }

  const canEndTurn = phase === 'monsters' && !group.turnTaken && admin
  const allDead = group.monsters.length > 0 && group.monsters.every(m => m.dead)

  return (
    <div style={{ borderRadius: 6, border: `2px solid ${group.turnTaken ? '#ccc' : '#e0c0c0'}`,
      background: group.turnTaken ? '#f4f0ee' : '#fff8f6',
      padding: '10px 12px', marginBottom: 8,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      opacity: allDead ? 0.5 : 1 }}>

      {/* Group name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {editingName && admin
          ? <input autoFocus value={nameVal} onChange={e => setNameVal(e.target.value)}
              onBlur={() => { onUpdate({ ...group, name: nameVal }); setEditingName(false) }}
              onKeyDown={e => { if (e.key==='Enter'){onUpdate({...group,name:nameVal});setEditingName(false)} if(e.key==='Escape')setEditingName(false) }}
              style={{ flex:1, padding:'2px 6px', border:'1px solid #e0c0c0', borderRadius:3,
                fontSize:'0.92rem', fontFamily:"'IM Fell English', serif", color: MONSTER_COLOR }}/>
          : <span onDoubleClick={() => admin && (setNameVal(group.name), setEditingName(true))}
              style={{ fontFamily:"'IM Fell English', serif", fontSize:'0.92rem',
                color: group.turnTaken ? '#aaa' : MONSTER_COLOR, fontWeight:600, flex:1,
                cursor: admin ? 'text' : 'default',
                textDecoration: group.turnTaken ? 'line-through' : 'none' }}>
              {group.name}
            </span>
        }
        {group.turnTaken && <span style={{ fontSize:'0.65rem', color:'#aaa', fontStyle:'italic' }}>done</span>}
        {admin && <button onClick={onRemove}
          style={{ background:'none', border:'none', cursor:'pointer', fontSize:'0.75rem', color:'#bbb', padding:'0 2px' }}>✕</button>}
      </div>

      {/* Monsters */}
      {group.monsters.map(m => (
        <MonsterRow key={m.id} monster={m} admin={admin}
          onUpdate={upd => updMonster(m.id, upd)}
          onRemove={() => removeMonster(m.id)}/>
      ))}

      {/* Add monster (admin only) */}
      {admin && (
        <div style={{ display:'flex', gap:4, marginTop:4 }}>
          <input value={newName} onChange={e=>setNewName(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&addMonster()}
            placeholder='Monster name…'
            style={{ flex:1, padding:'3px 6px', border:'1px solid #e0c0c0', borderRadius:3,
              fontSize:'0.75rem', fontFamily:"'Source Serif 4',Georgia,serif", minWidth:0 }}/>
          <input value={newHp} onChange={e=>setNewHp(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&addMonster()}
            placeholder='HP'
            style={{ width:42, padding:'3px 5px', border:'1px solid #e0c0c0', borderRadius:3, fontSize:'0.75rem', textAlign:'center' }}/>
          <button onClick={addMonster}
            style={{ padding:'3px 8px', border:'none', borderRadius:3, background:MONSTER_COLOR, color:'#fff', cursor:'pointer', fontSize:'0.75rem' }}>+</button>
        </div>
      )}

      {/* End turn button */}
      {canEndTurn && (
        <button onClick={onEndTurn}
          style={{ marginTop:8, width:'100%', padding:'5px', border:'none', borderRadius:4,
            background: MONSTER_COLOR, color:'#fff', cursor:'pointer',
            fontSize:'0.78rem', fontFamily:"'Source Serif 4',Georgia,serif" }}>
          End Group Turn →
        </button>
      )}
    </div>
  )
}

// ─── Player card ──────────────────────────────────────────────────────────────
function PlayerCard({ player, phase, user, admin, onUpdate, onRemove, onEndTurn }) {
  const canEdit = admin || user?.displayName === player.name
  const isMe = user?.displayName === player.name
  const canEndTurn = phase === 'players' && !player.turnTaken && canEdit
  const upd = p => onUpdate({ ...player, ...p })

  return (
    <div style={{ borderRadius:6, border:`2px solid ${player.turnTaken ? '#ccc' : '#ccc9c0'}`,
      background: player.turnTaken ? '#f0f0f0' : '#faf9f6',
      padding:'10px 12px', marginBottom:8,
      boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
      opacity: player.dead ? 0.4 : 1 }}>

      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
        <span style={{ fontFamily:"'IM Fell English',serif", fontSize:'0.95rem',
          color: isMe ? PLAYER_COLOR : '#222', fontWeight: isMe?700:600, flex:1,
          textDecoration: player.turnTaken ? 'line-through' : 'none' }}>
          {player.name}
        </span>
        {player.turnTaken && <span style={{ fontSize:'0.65rem', color:'#aaa', fontStyle:'italic' }}>done</span>}
        {admin && <>
          <button onClick={() => upd({ dead: !player.dead })}
            style={{ background:'none', border:'none', cursor:'pointer', fontSize:'0.75rem',
              color: player.dead?'#3a7a3a':'#b44', padding:'0 3px' }}>
            {player.dead ? '♥' : '💀'}
          </button>
          <button onClick={onRemove}
            style={{ background:'none', border:'none', cursor:'pointer', fontSize:'0.75rem', color:'#bbb', padding:'0 2px' }}>✕</button>
        </>}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px 10px' }}>
        <ActionBox label='Triggered Action' checked={player.triggered}
          onChange={v => canEdit && upd({ triggered:v })} disabled={!canEdit}/>
        <ActionBox label='Main Action' checked={player.main}
          onChange={v => canEdit && upd({ main:v })} disabled={!canEdit}/>
        <ActionBox label='Maneuver' checked={player.maneuver}
          onChange={v => canEdit && upd({ maneuver:v })} disabled={!canEdit}/>
        <ActionBox label='Move' checked={player.move}
          onChange={v => canEdit && upd({ move:v })} disabled={!canEdit}/>
      </div>

      {canEndTurn && (
        <button onClick={onEndTurn}
          style={{ marginTop:10, width:'100%', padding:'5px', border:'none', borderRadius:4,
            background: PLAYER_COLOR, color:'#fff', cursor:'pointer',
            fontSize:'0.78rem', fontFamily:"'Source Serif 4',Georgia,serif" }}>
          End Turn →
        </button>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function InitiativeTracker({ user, onClose }) {
  const admin = isAdmin(user)
  const [state, setState] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const writing = useRef(false)
  const unsubRef = useRef(null)

  useEffect(() => {
    const ref = doc(db, INIT_DOC)
    getDoc(ref).then(snap => {
      if (!snap.exists()) return setDoc(ref, { ...BLANK_STATE, updatedAt: serverTimestamp() })
    }).catch(()=>{}).finally(() => {
      unsubRef.current = onSnapshot(ref, snap => {
        if (writing.current) return
        setState(snap.exists() ? snap.data() : BLANK_STATE)
        setLoaded(true)
      }, err => { console.error('Initiative error:', err); setState(BLANK_STATE); setLoaded(true) })
    })
    return () => { if (unsubRef.current) unsubRef.current() }
  }, [])

  const persist = async (s) => {
    writing.current = true
    try { await setDoc(doc(db, INIT_DOC), { ...s, updatedAt: serverTimestamp() }) }
    finally { writing.current = false }
  }
  const update = s => { setState(s); persist(s) }

  if (!loaded || !state) return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'#1a1a2a',
      display:'flex', alignItems:'center', justifyContent:'center',
      color:'#888', fontStyle:'italic', fontFamily:"'Source Serif 4',Georgia,serif" }}>
      Loading…
    </div>
  )

  const { round, phase, players, monsterGroups } = state

  // ── Turn logic ───────────────────────────────────────────────────────────────
  // Check if all active entities on the current side have taken their turn
  const allPlayersDone = players.filter(p=>!p.dead).every(p=>p.turnTaken)
  const allMonstersDone = monsterGroups.every(g=>g.turnTaken)

  const playerEndTurn = (playerId) => {
    // Mark this player's turn as taken, refresh their non-triggered actions
    const newPlayers = players.map(p =>
      p.id === playerId
        ? { ...p, turnTaken: true, main: false, maneuver: false, move: false }
        : p
    )
    const allDone = newPlayers.filter(p=>!p.dead).every(p=>p.turnTaken)
    if (allDone) {
      // Switch to monsters — reset all monster group turns
      const newGroups = monsterGroups.map(g => ({ ...g, turnTaken: false }))
      update({ ...state, phase: 'monsters', players: newPlayers, monsterGroups: newGroups })
    } else {
      update({ ...state, players: newPlayers })
    }
  }

  const monsterGroupEndTurn = (groupId) => {
    const newGroups = monsterGroups.map(g =>
      g.id === groupId ? { ...g, turnTaken: true } : g
    )
    const allDone = newGroups.every(g => g.turnTaken)
    if (allDone) {
      // New round — switch to players, reset all turns, refresh triggered actions too
      const newPlayers = players.map(p => ({
        ...p, turnTaken: false,
        triggered: false, main: false, maneuver: false, move: false
      }))
      const resetGroups = newGroups.map(g => ({ ...g, turnTaken: false }))
      update({ ...state, round: round + 1, phase: 'players', players: newPlayers, monsterGroups: resetGroups })
    } else {
      update({ ...state, monsterGroups: newGroups })
    }
  }

  const updatePlayer = upd => update({ ...state, players: players.map(p => p.id===upd.id ? upd : p) })
  const removePlayer = id => update({ ...state, players: players.filter(p => p.id!==id) })
  const addPlayer = () => {
    if (!newPlayerName.trim()) return
    update({ ...state, players: [...players, BLANK_PLAYER(newPlayerName.trim())] })
    setNewPlayerName('')
  }

  const updateGroup = upd => update({ ...state, monsterGroups: monsterGroups.map(g => g.id===upd.id ? upd : g) })
  const removeGroup = id => update({ ...state, monsterGroups: monsterGroups.filter(g => g.id!==id) })
  const addGroup = () => {
    if (!newGroupName.trim()) return
    update({ ...state, monsterGroups: [...monsterGroups, BLANK_GROUP(newGroupName.trim())] })
    setNewGroupName('')
  }

  const resetCombat = () => {
    if (!confirm('Reset initiative? This clears all monsters and resets all turns.')) return
    update({ ...BLANK_STATE,
      players: players.map(p => ({ ...p, turnTaken:false, triggered:false, main:false, maneuver:false, move:false, dead:false }))
    })
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'#1a1a2a',
      display:'flex', flexDirection:'column', fontFamily:"'Source Serif 4',Georgia,serif" }}>

      {/* Header */}
      <div style={{ background:'#12121e', borderBottom:'1px solid #2a2a4a',
        padding:'0 1.5rem', height:50, display:'flex', alignItems:'center', gap:'1rem', flexShrink:0 }}>
        <span style={{ fontFamily:"'IM Fell English',serif", fontSize:'1.1rem', color:'#c8b87a' }}>Initiative</span>

        {/* Round counter */}
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {admin && <button onClick={() => update({...state, round:Math.max(1,round-1)})}
            style={{ background:'none', border:'1px solid #3a3a5a', borderRadius:3,
              color:'#888', cursor:'pointer', fontSize:'0.75rem', padding:'2px 6px' }}>−</button>}
          <span style={{ color:'#c8b87a', fontSize:'0.85rem', fontWeight:600,
            background:'#2a2a3e', padding:'3px 12px', borderRadius:4, border:'1px solid #3a3a5a' }}>
            Round {round}
          </span>
          {admin && <button onClick={() => update({...state, round:round+1})}
            style={{ background:'none', border:'1px solid #3a3a5a', borderRadius:3,
              color:'#888', cursor:'pointer', fontSize:'0.75rem', padding:'2px 6px' }}>+</button>}
        </div>

        {/* Phase pill */}
        <div style={{ display:'flex', gap:0, borderRadius:20, overflow:'hidden', border:'1px solid #3a3a5a' }}>
          <span style={{ fontSize:'0.72rem', padding:'3px 12px',
            background: phase==='players' ? PLAYER_COLOR : 'transparent',
            color: phase==='players' ? '#fff' : '#555', transition:'all 0.2s' }}>Players</span>
          <span style={{ fontSize:'0.72rem', padding:'3px 12px',
            background: phase==='monsters' ? MONSTER_COLOR : 'transparent',
            color: phase==='monsters' ? '#fff' : '#555', transition:'all 0.2s' }}>Monsters</span>
        </div>

        <div style={{ flex:1 }}/>
        {admin && <button onClick={resetCombat}
          style={{ padding:'5px 10px', border:'1px solid #3a3a5a', borderRadius:3,
            background:'transparent', color:'#888', cursor:'pointer',
            fontSize:'0.78rem', fontFamily:"'Source Serif 4',Georgia,serif" }}>↺ Reset</button>}
        <button onClick={onClose}
          style={{ padding:'5px 12px', border:'1px solid #3a3a5a', borderRadius:3,
            background:'transparent', color:'#888', cursor:'pointer',
            fontSize:'0.82rem', fontFamily:"'Source Serif 4',Georgia,serif" }}>← Back</button>
      </div>

      {/* Two columns */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', overflow:'hidden' }}>

        {/* Players */}
        <div style={{ borderRight:'1px solid #2a2a4a', display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'10px 16px 6px', background:'#12121e', borderBottom:'1px solid #2a2a4a',
            fontSize:'0.68rem', textTransform:'uppercase', letterSpacing:'0.1em', color: PLAYER_COLOR, fontWeight:700,
            display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span>Players</span>
            {phase==='players' && !allPlayersDone &&
              <span style={{ fontSize:'0.65rem', color:'#4a9ac8', fontStyle:'italic', textTransform:'none', letterSpacing:0 }}>▶ Player turn</span>}
            {phase==='players' && allPlayersDone &&
              <span style={{ fontSize:'0.65rem', color:'#888', fontStyle:'italic', textTransform:'none', letterSpacing:0 }}>all done</span>}
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'12px 14px' }}>
            {players.map(p => (
              <PlayerCard key={p.id} player={p} phase={phase} user={user} admin={admin}
                onUpdate={updatePlayer}
                onRemove={() => removePlayer(p.id)}
                onEndTurn={() => playerEndTurn(p.id)}/>
            ))}
            {admin && (
              <div style={{ display:'flex', gap:6, marginTop:8 }}>
                <input value={newPlayerName} onChange={e=>setNewPlayerName(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&addPlayer()}
                  placeholder='Add player…'
                  style={{ flex:1, padding:'5px 8px', border:'1px solid #2a3a5a', borderRadius:3,
                    background:'#252540', color:'#c8c0b0', fontSize:'0.82rem',
                    fontFamily:"'Source Serif 4',Georgia,serif", outline:'none' }}/>
                <button onClick={addPlayer}
                  style={{ padding:'5px 10px', border:'none', borderRadius:3,
                    background:PLAYER_COLOR, color:'#fff', cursor:'pointer', fontSize:'0.8rem' }}>+</button>
              </div>
            )}
          </div>
        </div>

        {/* Monsters */}
        <div style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
          <div style={{ padding:'10px 16px 6px', background:'#12121e', borderBottom:'1px solid #2a2a4a',
            fontSize:'0.68rem', textTransform:'uppercase', letterSpacing:'0.1em', color:MONSTER_COLOR, fontWeight:700,
            display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span>Monsters</span>
            {phase==='monsters' && !allMonstersDone &&
              <span style={{ fontSize:'0.65rem', color:'#c84a4a', fontStyle:'italic', textTransform:'none', letterSpacing:0 }}>▶ Monster turn</span>}
            {phase==='monsters' && allMonstersDone &&
              <span style={{ fontSize:'0.65rem', color:'#888', fontStyle:'italic', textTransform:'none', letterSpacing:0 }}>all done</span>}
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'12px 14px' }}>
            {monsterGroups.map(g => (
              <MonsterGroupCard key={g.id} group={g} admin={admin} phase={phase}
                onUpdate={updateGroup}
                onRemove={() => removeGroup(g.id)}
                onEndTurn={() => monsterGroupEndTurn(g.id)}/>
            ))}
            {admin && (
              <div style={{ display:'flex', gap:6, marginTop:8 }}>
                <input value={newGroupName} onChange={e=>setNewGroupName(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&addGroup()}
                  placeholder='Add group (e.g. Wyldmen)…'
                  style={{ flex:1, padding:'5px 8px', border:'1px solid #3a2a2a', borderRadius:3,
                    background:'#252020', color:'#c8b0b0', fontSize:'0.82rem',
                    fontFamily:"'Source Serif 4',Georgia,serif", outline:'none' }}/>
                <button onClick={addGroup}
                  style={{ padding:'5px 10px', border:'none', borderRadius:3,
                    background:MONSTER_COLOR, color:'#fff', cursor:'pointer', fontSize:'0.8rem' }}>+</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
