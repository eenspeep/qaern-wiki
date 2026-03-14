import { useState, useEffect, useRef } from 'react'
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

const INIT_DOC = 'initiative/state'
const ADMIN = 'speep'
const isAdmin = u => u?.displayName === ADMIN

const uid = () => Math.random().toString(36).slice(2, 9)

const BLANK_STATE = {
  round: 1,
  phase: 'players',   // 'players' | 'monsters'
  activePlayerIdx: 0, // which player is currently taking their turn
  players: [],
  monsterGroups: [],
}

const BLANK_PLAYER = (name) => ({
  id: uid(), name,
  triggered: false,
  main: false,
  maneuver: false,
  move: false,
  dead: false,
})

const BLANK_GROUP = (name) => ({
  id: uid(), name,
  monsters: [],
})

const BLANK_MONSTER = (name, hp) => ({
  id: uid(), name,
  maxHp: hp || 10,
  hp: hp || 10,
  dead: false,
})

// ─── Colours ──────────────────────────────────────────────────────────────────
const PLAYER_COLOR  = '#1b4f72'
const MONSTER_COLOR = '#7a2020'
const ACTIVE_BG     = '#e8f4ff'
const ACTIVE_BORDER = '#1b4f72'

// ─── HP bar ───────────────────────────────────────────────────────────────────
function HpBar({ hp, maxHp }) {
  const pct = maxHp > 0 ? Math.max(0, Math.min(100, (hp / maxHp) * 100)) : 0
  const col = pct > 60 ? '#3a7a3a' : pct > 25 ? '#c8a020' : '#b44'
  return (
    <div style={{ height: 5, borderRadius: 3, background: '#e0ddd8', overflow: 'hidden', marginTop: 3 }}>
      <div style={{ height: '100%', width: pct + '%', background: col, borderRadius: 3, transition: 'width 0.2s' }}/>
    </div>
  )
}

// ─── Action checkbox ──────────────────────────────────────────────────────────
function ActionBox({ label, checked, onChange, disabled, dim }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: disabled ? 'default' : 'pointer',
      opacity: dim ? 0.4 : 1, fontSize: '0.75rem', color: '#333', userSelect: 'none' }}>
      <input type='checkbox' checked={checked} onChange={e => !disabled && onChange(e.target.checked)}
        disabled={disabled}
        style={{ accentColor: PLAYER_COLOR, width: 13, height: 13, cursor: disabled ? 'default' : 'pointer' }}/>
      {label}
    </label>
  )
}

// ─── Player card ──────────────────────────────────────────────────────────────
function PlayerCard({ player, isActive, isTurn, onUpdate, onRemove, admin, user }) {
  const canEdit = admin || user?.displayName === player.name
  const isMe = user?.displayName === player.name

  const upd = (patch) => onUpdate({ ...player, ...patch })

  return (
    <div style={{
      borderRadius: 6, border: `2px solid ${isActive ? ACTIVE_BORDER : '#ccc9c0'}`,
      background: isActive ? ACTIVE_BG : '#faf9f6',
      padding: '10px 12px', marginBottom: 8,
      boxShadow: isActive ? '0 2px 12px rgba(27,79,114,0.15)' : '0 1px 4px rgba(0,0,0,0.06)',
      transition: 'border-color 0.2s, background 0.2s',
      opacity: player.dead ? 0.45 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {isActive && <span style={{ fontSize: '0.7rem', color: PLAYER_COLOR }}>▶</span>}
        <span style={{ fontFamily: "'IM Fell English', serif", fontSize: '0.95rem',
          color: isMe ? PLAYER_COLOR : '#222', fontWeight: isMe ? 700 : 600, flex: 1 }}>
          {player.name}
        </span>
        {admin && (
          <>
            <button onClick={() => upd({ dead: !player.dead })}
              title={player.dead ? 'Revive' : 'Mark dead'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem',
                color: player.dead ? '#3a7a3a' : '#b44', padding: '0 3px' }}>
              {player.dead ? '♥' : '💀'}
            </button>
            <button onClick={onRemove}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem',
                color: '#bbb', padding: '0 2px' }}>✕</button>
          </>
        )}
      </div>

      {/* Action checkboxes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 10px' }}>
        <ActionBox label='Triggered Action' checked={player.triggered}
          onChange={v => canEdit && upd({ triggered: v })}
          disabled={!canEdit} dim={!isActive && false}/>
        <ActionBox label='Main Action' checked={player.main}
          onChange={v => canEdit && upd({ main: v })}
          disabled={!canEdit}/>
        <ActionBox label='Maneuver' checked={player.maneuver}
          onChange={v => canEdit && upd({ maneuver: v })}
          disabled={!canEdit}/>
        <ActionBox label='Move' checked={player.move}
          onChange={v => canEdit && upd({ move: v })}
          disabled={!canEdit}/>
      </div>

      {/* End turn button — only shown on active player's turn, and only they (or admin) can click */}
      {isActive && canEdit && (
        <button onClick={() => isTurn && isTurn()}
          style={{ marginTop: 10, width: '100%', padding: '5px', border: 'none', borderRadius: 4,
            background: PLAYER_COLOR, color: '#fff', cursor: 'pointer',
            fontSize: '0.78rem', fontFamily: "'Source Serif 4', Georgia, serif" }}>
          End Turn →
        </button>
      )}
    </div>
  )
}

// ─── Monster group card ────────────────────────────────────────────────────────
function MonsterGroupCard({ group, onUpdate, onRemove, admin }) {
  const [newName, setNewName] = useState('')
  const [newHp, setNewHp] = useState('')
  const [editingGroupName, setEditingGroupName] = useState(false)
  const [groupNameVal, setGroupNameVal] = useState(group.name)

  const updMonster = (id, patch) =>
    onUpdate({ ...group, monsters: group.monsters.map(m => m.id === id ? { ...m, ...patch } : m) })
  const removeMonster = (id) =>
    onUpdate({ ...group, monsters: group.monsters.filter(m => m.id !== id) })
  const addMonster = () => {
    if (!newName.trim()) return
    const hp = parseInt(newHp) || 10
    onUpdate({ ...group, monsters: [...group.monsters, BLANK_MONSTER(newName.trim(), hp)] })
    setNewName(''); setNewHp('')
  }

  if (!admin) {
    // Read-only view for players
    return (
      <div style={{ borderRadius: 6, border: '2px solid #e0c0c0', background: '#fff8f6',
        padding: '10px 12px', marginBottom: 8 }}>
        <div style={{ fontFamily: "'IM Fell English', serif", fontSize: '0.92rem',
          color: MONSTER_COLOR, fontWeight: 600, marginBottom: 6 }}>{group.name}</div>
        {group.monsters.filter(m => !m.dead).map(m => (
          <div key={m.id} style={{ marginBottom: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#444' }}>
              <span>{m.name}</span>
              <span style={{ color: '#888' }}>{m.hp}/{m.maxHp}</span>
            </div>
            <HpBar hp={m.hp} maxHp={m.maxHp}/>
          </div>
        ))}
        {group.monsters.filter(m => !m.dead).length === 0 && (
          <div style={{ fontSize: '0.75rem', color: '#aaa', fontStyle: 'italic' }}>All defeated</div>
        )}
      </div>
    )
  }

  return (
    <div style={{ borderRadius: 6, border: '2px solid #e0c0c0', background: '#fff8f6',
      padding: '10px 12px', marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      {/* Group name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {editingGroupName
          ? <input autoFocus value={groupNameVal} onChange={e => setGroupNameVal(e.target.value)}
              onBlur={() => { onUpdate({ ...group, name: groupNameVal }); setEditingGroupName(false) }}
              onKeyDown={e => { if (e.key === 'Enter') { onUpdate({ ...group, name: groupNameVal }); setEditingGroupName(false) } if (e.key === 'Escape') setEditingGroupName(false) }}
              style={{ flex: 1, padding: '2px 6px', border: '1px solid #e0c0c0', borderRadius: 3,
                fontSize: '0.92rem', fontFamily: "'IM Fell English', serif", color: MONSTER_COLOR }}/>
          : <span onDoubleClick={() => { setGroupNameVal(group.name); setEditingGroupName(true) }}
              style={{ fontFamily: "'IM Fell English', serif", fontSize: '0.92rem',
                color: MONSTER_COLOR, fontWeight: 600, flex: 1, cursor: 'text' }}>
              {group.name}
            </span>
        }
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '0.75rem', color: '#bbb', padding: '0 2px' }}>✕</button>
      </div>

      {/* Monster list */}
      {group.monsters.map(m => (
        <div key={m.id} style={{ marginBottom: 7, opacity: m.dead ? 0.4 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: '0.78rem', color: '#444', flex: 1,
              textDecoration: m.dead ? 'line-through' : 'none' }}>{m.name}</span>
            <input type='number' value={m.hp} min={0} max={m.maxHp}
              onChange={e => updMonster(m.id, { hp: Math.max(0, Math.min(m.maxHp, parseInt(e.target.value)||0)) })}
              style={{ width: 42, padding: '2px 4px', border: '1px solid #e0c0c0', borderRadius: 3,
                fontSize: '0.75rem', textAlign: 'center', color: '#444' }}/>
            <span style={{ fontSize: '0.7rem', color: '#aaa' }}>/{m.maxHp}</span>
            <button onClick={() => updMonster(m.id, { dead: !m.dead })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.7rem',
                color: m.dead ? '#3a7a3a' : '#b44', padding: '0 2px' }}>
              {m.dead ? '♥' : '💀'}
            </button>
            <button onClick={() => removeMonster(m.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.65rem', color: '#ccc', padding: '0 1px' }}>✕</button>
          </div>
          <HpBar hp={m.hp} maxHp={m.maxHp}/>
        </div>
      ))}

      {/* Add monster */}
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addMonster()}
          placeholder='Monster name…'
          style={{ flex: 1, padding: '3px 6px', border: '1px solid #e0c0c0', borderRadius: 3,
            fontSize: '0.75rem', fontFamily: "'Source Serif 4', Georgia, serif", minWidth: 0 }}/>
        <input value={newHp} onChange={e => setNewHp(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addMonster()}
          placeholder='HP'
          style={{ width: 44, padding: '3px 6px', border: '1px solid #e0c0c0', borderRadius: 3,
            fontSize: '0.75rem', textAlign: 'center' }}/>
        <button onClick={addMonster}
          style={{ padding: '3px 8px', border: 'none', borderRadius: 3, background: MONSTER_COLOR,
            color: '#fff', cursor: 'pointer', fontSize: '0.75rem' }}>+</button>
      </div>
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
    // Pre-create the document if it doesn't exist, then subscribe
    const ref = doc(db, INIT_DOC)
    getDoc(ref).then(snap => {
      if (!snap.exists()) {
        return setDoc(ref, { ...BLANK_STATE, updatedAt: serverTimestamp() })
      }
    }).catch(() => {}).finally(() => {
      const unsub = onSnapshot(ref, snap => {
        if (writing.current) return
        setState(snap.exists() ? snap.data() : BLANK_STATE)
        setLoaded(true)
      }, err => { console.error('Initiative error:', err); setState(BLANK_STATE); setLoaded(true) })
      // Store unsub for cleanup — use a ref since we're inside a promise
      unsubRef.current = unsub
    })
    return () => { if (unsubRef.current) unsubRef.current() }
  }, [])

  const persist = async (s) => {
    writing.current = true
    try { await setDoc(doc(db, INIT_DOC), { ...s, updatedAt: serverTimestamp() }) }
    finally { writing.current = false }
  }

  const update = (s) => { setState(s); persist(s) }

  if (!loaded || !state) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#1a1a2a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#888', fontStyle: 'italic', fontFamily: "'Source Serif 4', Georgia, serif" }}>
      Loading…
    </div>
  )

  const { round, phase, activePlayerIdx, players, monsterGroups } = state

  // ── Turn logic ───────────────────────────────────────────────────────────────
  const advanceTurn = () => {
    if (!admin) return
    if (phase === 'players') {
      const nextIdx = activePlayerIdx + 1
      if (nextIdx >= players.filter(p => !p.dead).length) {
        // All players done → monsters phase
        update({ ...state, phase: 'monsters' })
      } else {
        // Next player — refresh their non-triggered actions
        const livePlayers = players.filter(p => !p.dead)
        const nextPlayer = livePlayers[nextIdx]
        const newPlayers = players.map(p =>
          p.id === nextPlayer.id
            ? { ...p, main: false, maneuver: false, move: false }
            : p
        )
        update({ ...state, activePlayerIdx: nextIdx, players: newPlayers })
      }
    } else {
      // Monsters done → new round, players phase, refresh all
      const newPlayers = players.map(p => ({ ...p, triggered: false, main: false, maneuver: false, move: false }))
      const firstLive = players.findIndex(p => !p.dead)
      update({ ...state, round: round + 1, phase: 'players', activePlayerIdx: firstLive >= 0 ? firstLive : 0, players: newPlayers })
    }
  }

  // Player end-turn (by the player themselves)
  const playerEndTurn = (playerId) => {
    const livePlayers = players.filter(p => !p.dead)
    const myLiveIdx = livePlayers.findIndex(p => p.id === playerId)
    if (myLiveIdx !== activePlayerIdx) return // not your turn
    advanceTurn()
  }

  // Refresh actions for a player's turn start
  const startPlayerTurn = (idx) => {
    const livePlayers = players.filter(p => !p.dead)
    const target = livePlayers[idx]
    if (!target) return
    const newPlayers = players.map(p =>
      p.id === target.id ? { ...p, main: false, maneuver: false, move: false } : p
    )
    update({ ...state, activePlayerIdx: idx, players: newPlayers })
  }

  const updatePlayer = (updated) => {
    update({ ...state, players: players.map(p => p.id === updated.id ? updated : p) })
  }
  const removePlayer = (id) => update({ ...state, players: players.filter(p => p.id !== id) })

  const addPlayer = () => {
    if (!newPlayerName.trim()) return
    const p = BLANK_PLAYER(newPlayerName.trim())
    const newPlayers = [...players, p]
    update({ ...state, players: newPlayers })
    setNewPlayerName('')
  }

  const updateGroup = (updated) => {
    update({ ...state, monsterGroups: monsterGroups.map(g => g.id === updated.id ? updated : g) })
  }
  const removeGroup = (id) => update({ ...state, monsterGroups: monsterGroups.filter(g => g.id !== id) })

  const addGroup = () => {
    if (!newGroupName.trim()) return
    update({ ...state, monsterGroups: [...monsterGroups, BLANK_GROUP(newGroupName.trim())] })
    setNewGroupName('')
  }

  const resetCombat = () => {
    if (!confirm('Reset the initiative tracker? This will clear all monsters and reset all actions.')) return
    update({ ...BLANK_STATE, players: players.map(p => ({ ...p, triggered: false, main: false, maneuver: false, move: false, dead: false })) })
  }

  const livePlayers = players.filter(p => !p.dead)
  const activePlayer = livePlayers[activePlayerIdx]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#1a1a2a',
      display: 'flex', flexDirection: 'column', fontFamily: "'Source Serif 4', Georgia, serif" }}>

      {/* Header */}
      <div style={{ background: '#12121e', borderBottom: '1px solid #2a2a4a',
        padding: '0 1.5rem', height: 50, display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
        <span style={{ fontFamily: "'IM Fell English', serif", fontSize: '1.1rem', color: '#c8b87a' }}>
          Initiative
        </span>
        {/* Round counter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {admin && <button onClick={() => update({ ...state, round: Math.max(1, round - 1) })}
            style={{ background: 'none', border: '1px solid #3a3a5a', borderRadius: 3,
              color: '#888', cursor: 'pointer', fontSize: '0.75rem', padding: '2px 6px' }}>−</button>}
          <span style={{ color: '#c8b87a', fontSize: '0.85rem', fontWeight: 600,
            background: '#2a2a3e', padding: '3px 12px', borderRadius: 4, border: '1px solid #3a3a5a' }}>
            Round {round}
          </span>
          {admin && <button onClick={() => update({ ...state, round: round + 1 })}
            style={{ background: 'none', border: '1px solid #3a3a5a', borderRadius: 3,
              color: '#888', cursor: 'pointer', fontSize: '0.75rem', padding: '2px 6px' }}>+</button>}
        </div>
        {/* Phase indicator */}
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: 10,
            background: phase === 'players' ? PLAYER_COLOR : 'transparent',
            color: phase === 'players' ? '#fff' : '#555',
            border: `1px solid ${phase === 'players' ? PLAYER_COLOR : '#3a3a5a'}`,
            transition: 'all 0.2s' }}>Players</span>
          <span style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: 10,
            background: phase === 'monsters' ? MONSTER_COLOR : 'transparent',
            color: phase === 'monsters' ? '#fff' : '#555',
            border: `1px solid ${phase === 'monsters' ? MONSTER_COLOR : '#3a3a5a'}`,
            transition: 'all 0.2s' }}>Monsters</span>
        </div>
        <div style={{ flex: 1 }}/>
        {admin && (
          <>
            <button onClick={advanceTurn}
              style={{ padding: '5px 14px', border: 'none', borderRadius: 3,
                background: phase === 'monsters' ? MONSTER_COLOR : PLAYER_COLOR,
                color: '#fff', cursor: 'pointer', fontSize: '0.82rem',
                fontFamily: "'Source Serif 4', Georgia, serif" }}>
              {phase === 'players' ? 'Next Player →' : 'End Monster Turn →'}
            </button>
            <button onClick={resetCombat}
              style={{ padding: '5px 10px', border: '1px solid #3a3a5a', borderRadius: 3,
                background: 'transparent', color: '#888', cursor: 'pointer',
                fontSize: '0.78rem', fontFamily: "'Source Serif 4', Georgia, serif" }}>↺ Reset</button>
          </>
        )}
        <button onClick={onClose}
          style={{ padding: '5px 12px', border: '1px solid #3a3a5a', borderRadius: 3,
            background: 'transparent', color: '#888', cursor: 'pointer',
            fontSize: '0.82rem', fontFamily: "'Source Serif 4', Georgia, serif" }}>← Back</button>
      </div>

      {/* Two-column layout */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 0, overflow: 'hidden' }}>

        {/* Players column */}
        <div style={{ borderRight: '1px solid #2a2a4a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px 6px', background: '#12121e', borderBottom: '1px solid #2a2a4a',
            fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em',
            color: PLAYER_COLOR, fontWeight: 700 }}>
            Players
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
            {players.map((p, globalIdx) => {
              const liveIdx = livePlayers.findIndex(lp => lp.id === p.id)
              const isActive = phase === 'players' && liveIdx === activePlayerIdx && !p.dead
              return (
                <PlayerCard
                  key={p.id}
                  player={p}
                  isActive={isActive}
                  user={user}
                  admin={admin}
                  onUpdate={updatePlayer}
                  onRemove={() => removePlayer(p.id)}
                  isTurn={() => playerEndTurn(p.id)}
                />
              )
            })}

            {admin && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <input value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addPlayer()}
                  placeholder='Add player…'
                  style={{ flex: 1, padding: '5px 8px', border: '1px solid #2a3a5a', borderRadius: 3,
                    background: '#252540', color: '#c8c0b0', fontSize: '0.82rem',
                    fontFamily: "'Source Serif 4', Georgia, serif", outline: 'none' }}/>
                <button onClick={addPlayer}
                  style={{ padding: '5px 10px', border: 'none', borderRadius: 3,
                    background: PLAYER_COLOR, color: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>+</button>
              </div>
            )}
          </div>
        </div>

        {/* Monsters column */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px 6px', background: '#12121e', borderBottom: '1px solid #2a2a4a',
            fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em',
            color: MONSTER_COLOR, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Monsters</span>
            {phase === 'monsters' && (
              <span style={{ fontSize: '0.65rem', color: '#f5a623', fontStyle: 'italic',
                textTransform: 'none', letterSpacing: 0 }}>▶ Monster turn</span>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
            {monsterGroups.map(group => (
              <MonsterGroupCard
                key={group.id}
                group={group}
                admin={admin}
                onUpdate={updateGroup}
                onRemove={() => removeGroup(group.id)}
              />
            ))}

            {admin && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addGroup()}
                  placeholder='Add group (e.g. Wyldmen)'
                  style={{ flex: 1, padding: '5px 8px', border: '1px solid #3a2a2a', borderRadius: 3,
                    background: '#252020', color: '#c8b0b0', fontSize: '0.82rem',
                    fontFamily: "'Source Serif 4', Georgia, serif", outline: 'none' }}/>
                <button onClick={addGroup}
                  style={{ padding: '5px 10px', border: 'none', borderRadius: 3,
                    background: MONSTER_COLOR, color: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>+</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
