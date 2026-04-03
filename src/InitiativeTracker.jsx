import { useState, useEffect, useRef } from 'react'

function useIsMobile(bp=680){
  const [m,setM]=useState(()=>window.innerWidth<bp)
  useEffect(()=>{const h=()=>setM(window.innerWidth<bp);window.addEventListener('resize',h);return()=>window.removeEventListener('resize',h)},[bp])
  return m
}
import { doc, onSnapshot, setDoc, getDoc, serverTimestamp, runTransaction } from 'firebase/firestore'
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
  malice: 0,
}

const BLANK_PLAYER = (name) => ({
  id: uid(), name,
  triggered: false, main: false, maneuver: false, move: false,
  heroicResource: false,
  victories: 0,
  turnTaken: false, dead: false,
  conditions: [],
})

const BLANK_GROUP = (name) => ({
  id: uid(), name,
  monsters: [],
  turnsUsed: 0,
})

const BLANK_MONSTER = (name, hp) => ({
  id: uid(), name,
  tier: 'standard',  // 'minion' | 'standard' | 'leader'
  maxHp: hp || 10,
  hp: hp || 10,
  hpPer: 4,          // minion hp per member
  count: 4,          // minion count
  triggered: false,
  // leader extras
  extraTurns: 0,
  villain1: false, villain2: false, villain3: false,
  dead: false,
  conditions: [],
})

const CONDITIONS = [
  { id: 'bleeding',   label: 'Bleeding',   color: '#c0392b', desc: "Can't regain Stamina." },
  { id: 'dazed',      label: 'Dazed',      color: '#9b59b6', desc: 'Can only move, maneuver, or act — just one. No triggered actions.' },
  { id: 'frightened', label: 'Frightened', color: '#e2b400', desc: 'Bane vs fear source; they have Edge vs you. Can\'t move closer.' },
  { id: 'grabbed',    label: 'Grabbed',    color: '#7f5539', desc: 'Speed 0, can\'t be force moved. Bane on attacks not targeting grabber.' },
  { id: 'prone',      label: 'Prone',      color: '#607d8b', desc: 'Bane on attacks; melee attacks vs you have Edge. Crawling costs +1 sq.' },
  { id: 'restrained', label: 'Restrained', color: '#6a1b9a', desc: 'Speed 0, can\'t be force moved. Bane on attacks; attacks vs you have Edge.' },
  { id: 'slowed',     label: 'Slowed',     color: '#1976d2', desc: 'Speed halved.' },
  { id: 'taunted',    label: 'Taunted',    color: '#e65100', desc: 'Double Bane on attacks not targeting the creature who taunted you.' },
  { id: 'weakened',   label: 'Weakened',   color: '#546e7a', desc: 'Power Rolls and Tests (not Resistance) have a Bane.' },
]

// Returns box-shadow string for active condition stripes (inset left edge, 3px per condition)
const conditionBoxShadow = (conditions = [], baseShadow = '0 1px 4px rgba(0,0,0,0.06)') => {
  const active = CONDITIONS.filter(c => conditions.includes(c.id))
  if (!active.length) return baseShadow
  const stripes = active.slice(0, 5).map((c, i) => `inset ${(i + 1) * 3}px 0 0 ${c.color}`).join(', ')
  return `${stripes}, ${baseShadow}`
}

// Returns extra inline styles for the card container based on active conditions
const conditionCardStyle = (conditions = []) => {
  const has = id => conditions.includes(id)
  const animations = []
  const style = {}
  if (has('dazed')) animations.push('dazedSway 3s ease-in-out infinite')
  // frightenShake skipped when dazed is active (transform conflict); glow overlay covers it
  if (has('frightened') && !has('dazed')) animations.push('frightenShake 0.5s ease-in-out infinite')
  // Prone: tilt the card like it's been knocked down
  if (has('prone') && !has('dazed')) style.transform = 'rotate(-2deg) translateY(2px)'
  if (animations.length) style.animation = animations.join(', ')
  return style
}

// Injects @keyframes for all condition animations once
function ConditionStyles() {
  return (
    <style>{`
      @keyframes bleedDrip {
        0%   { transform: translateY(-8px); opacity: 0.9; }
        80%  { opacity: 0.55; }
        100% { transform: translateY(130px); opacity: 0; }
      }
      @keyframes dazedSway {
        0%,100% { transform: translateX(0) rotate(0deg);    filter: blur(0px); }
        30%     { transform: translateX(5px) rotate(1deg);  filter: blur(1px); }
        70%     { transform: translateX(-5px) rotate(-1deg); filter: blur(1.2px); }
      }
      @keyframes frightenShake {
        0%,100% { transform: translateX(0); }
        15%     { transform: translateX(-2px); }
        30%     { transform: translateX(2px); }
        45%     { transform: translateX(-2px); }
        60%     { transform: translateX(2px); }
        75%     { transform: translateX(-1px); }
        90%     { transform: translateX(1px); }
      }
      @keyframes frightenGlow {
        0%,100% { box-shadow: 0 0 0px rgba(226,180,0,0); }
        50%     { box-shadow: 0 0 14px 3px rgba(226,180,0,0.45); }
      }
      @keyframes grabbedConstrict {
        0%,100% { box-shadow: inset 0 0 0 0px rgba(127,85,57,0); }
        50%     { box-shadow: inset 0 0 0 5px rgba(127,85,57,0.4); }
      }
      @keyframes tauntedGlow {
        0%,100% { box-shadow: 0 0 4px rgba(230,81,0,0.15); }
        50%     { box-shadow: 0 0 20px 4px rgba(230,81,0,0.6); }
      }
      @keyframes frostPulse {
        0%,100% { opacity: 0.4; transform: scaleY(0.65); transform-origin: bottom; }
        50%     { opacity: 0.85; transform: scaleY(1);    transform-origin: bottom; }
      }
      @keyframes weakenOverlay {
        0%,100% { background: rgba(84,110,122,0); }
        50%     { background: rgba(84,110,122,0.22); }
      }
    `}</style>
  )
}

// ─── Turn logic helpers ────────────────────────────────────────────────────────
// Total turns a group gets per round: 1 base + max extraTurns among living monsters
const groupTotalTurns = (group) => {
  const liveMons = group.monsters.filter(m => !m.dead)
  if (!liveMons.length) return 0
  const maxExtra = Math.max(0, ...liveMons.map(m => m.extraTurns || 0))
  return 1 + maxExtra
}
const groupIsDone = (group) => (group.turnsUsed || 0) >= groupTotalTurns(group)
const monstersHaveTurns = (groups) => groups.some(g => !groupIsDone(g) && groupTotalTurns(g) > 0)
const playersHaveTurns = (players) => players.filter(p => !p.dead).some(p => !p.turnTaken)

const advanceRound = (s, newPlayers, newGroups) => {
  const { round, malice = 0 } = s
  const resetPlayers = newPlayers.map(p => ({ ...p, turnTaken: false, triggered: false, main: false, maneuver: false, move: false, heroicResource: false }))
  const resetGroups = newGroups.map(g => ({ ...g, turnsUsed: 0, monsters: g.monsters.map(m => ({ ...m, triggered: false })) }))
  const maliceTick = malice + (round + 1) + resetPlayers.filter(p => !p.dead).length
  return { ...s, round: round + 1, phase: 'players', players: resetPlayers, monsterGroups: resetGroups, malice: maliceTick }
}

// Pure turn-logic helpers — used both for optimistic local updates and Firestore transactions
const applyPlayerEndTurn = (s, playerId) => {
  const newPlayers = s.players.map(p =>
    p.id === playerId ? { ...p, turnTaken: true, main: false, maneuver: false, move: false } : p
  )
  const pHave = playersHaveTurns(newPlayers)
  const mHave = monstersHaveTurns(s.monsterGroups)
  if (!pHave && !mHave) {
    return advanceRound(s, newPlayers, s.monsterGroups)
  } else if (mHave) {
    return { ...s, phase: 'monsters', players: newPlayers }
  } else {
    // no monsters with turns left — stay on players so remaining players can go
    return { ...s, phase: 'players', players: newPlayers }
  }
}

const applyMonsterGroupEndTurn = (s, groupId) => {
  const newGroups = s.monsterGroups.map(g =>
    g.id === groupId ? { ...g, turnsUsed: (g.turnsUsed || 0) + 1 } : g
  )
  const pHave = playersHaveTurns(s.players)
  const mHave = monstersHaveTurns(newGroups)
  if (!pHave && !mHave) {
    return advanceRound(s, s.players, newGroups)
  } else if (pHave) {
    return { ...s, phase: 'players', monsterGroups: newGroups }
  } else {
    // all players done but monsters still have turns — stay on monsters
    return { ...s, phase: 'monsters', monsterGroups: newGroups }
  }
}

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

// ─── Condition picker ─────────────────────────────────────────────────────────
function ConditionPicker({ conditions = [], onChange, editable, accentColor }) {
  const [open, setOpen] = useState(false)
  const active = CONDITIONS.filter(c => conditions.includes(c.id))

  const toggle = (id) => {
    if (!editable) return
    onChange(conditions.includes(id) ? conditions.filter(c => c !== id) : [...conditions, id])
  }

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <button onClick={() => setOpen(o => !o)}
          style={{ background: 'none', border: `1px solid ${open ? accentColor : 'rgba(128,128,128,0.3)'}`,
            borderRadius: 3, cursor: 'pointer', padding: '1px 6px',
            fontSize: '0.65rem', color: open ? accentColor : '#888',
            fontFamily: "'Source Serif 4',Georgia,serif", lineHeight: '1.6' }}>
          {open ? '▲' : '▼'} Conditions{active.length > 0 ? ` (${active.length})` : ''}
        </button>
        {active.map(c => (
          <span key={c.id} title={c.desc}
            style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: 10,
              border: `1px solid ${c.color}`, color: c.color,
              fontFamily: "'Source Serif 4',Georgia,serif", lineHeight: '1.6',
              cursor: editable ? 'pointer' : 'default', userSelect: 'none' }}
            onClick={() => editable && toggle(c.id)}>
            {c.label}
          </span>
        ))}
      </div>
      {open && (
        <div style={{ marginTop: 5, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '3px 6px' }}>
          {CONDITIONS.map(c => (
            <label key={c.id} title={c.desc}
              style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: editable ? 'pointer' : 'default',
                fontSize: '0.67rem', color: conditions.includes(c.id) ? c.color : '#888',
                userSelect: 'none', fontFamily: "'Source Serif 4',Georgia,serif" }}>
              <input type='checkbox' checked={conditions.includes(c.id)}
                onChange={() => toggle(c.id)} disabled={!editable}
                style={{ accentColor: c.color, width: 11, height: 11 }}/>
              {c.label}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Condition overlay ────────────────────────────────────────────────────────
function ConditionOverlay({ conditions = [] }) {
  if (!conditions.length) return null
  const has = id => conditions.includes(id)
  return (
    // Outer wrapper — no overflow:hidden so outward glows aren't clipped
    <div style={{ position:'absolute', inset:0, borderRadius:'inherit', pointerEvents:'none' }}>

      {/* Inner clipped wrapper — for effects that must stay within card bounds */}
      <div style={{ position:'absolute', inset:0, borderRadius:'inherit', overflow:'hidden' }}>

        {/* Bleeding — 3 staggered red teardrops falling */}
        {has('bleeding') && [0,1,2].map(i => (
          <div key={i} style={{
            position:'absolute', top:0, left:`${20 + i*30}%`,
            width:5, height:8, opacity:0,
            borderRadius:'50% 50% 50% 50% / 30% 30% 70% 70%',
            background:'#c0392b',
            animation:`bleedDrip 2.5s ease-in ${i*0.85}s infinite`
          }}/>
        ))}

        {/* Grabbed — inward constricting brown squeeze */}
        {has('grabbed') && (
          <div style={{
            position:'absolute', inset:0, borderRadius:'inherit',
            animation:'grabbedConstrict 1.5s ease-in-out infinite'
          }}/>
        )}

        {/* Restrained — horizontal bar pattern */}
        {has('restrained') && (
          <div style={{
            position:'absolute', inset:0, borderRadius:'inherit',
            background:'repeating-linear-gradient(transparent, transparent 9px, rgba(106,27,154,0.08) 9px, rgba(106,27,154,0.08) 11px)'
          }}/>
        )}

        {/* Slowed — frost gradient breathes from bottom */}
        {has('slowed') && (
          <div style={{
            position:'absolute', bottom:0, left:0, right:0, height:'65%',
            borderRadius:'inherit',
            background:'linear-gradient(to top, rgba(25,118,210,0.2), transparent)',
            animation:'frostPulse 4s ease-in-out infinite'
          }}/>
        )}

        {/* Weakened — slow gray-blue overlay dim */}
        {has('weakened') && (
          <div style={{
            position:'absolute', inset:0, borderRadius:'inherit',
            animation:'weakenOverlay 3.5s ease-in-out infinite'
          }}/>
        )}
      </div>

      {/* Outward glow effects — outside the clipped wrapper so box-shadows aren't cut off */}

      {/* Frightened — pulsing amber outward glow */}
      {has('frightened') && (
        <div style={{
          position:'absolute', inset:-4, borderRadius:'inherit',
          animation:'frightenGlow 1.8s ease-in-out infinite'
        }}/>
      )}

      {/* Taunted — pulsing orange outward glow */}
      {has('taunted') && (
        <div style={{
          position:'absolute', inset:-4, borderRadius:'inherit',
          animation:'tauntedGlow 1s ease-in-out infinite'
        }}/>
      )}
    </div>
  )
}

// ─── Monster row ──────────────────────────────────────────────────────────────
function MonsterRow({ monster, admin, onUpdate, onRemove }) {
  const upd = p => onUpdate({ ...monster, ...p })
  const isMinion = monster.tier === 'minion'
  const isLeader = monster.tier === 'leader'
  const totalHp = isMinion ? (monster.count || 1) * (monster.hpPer || 1) : monster.maxHp
  const conditions = monster.conditions || []

  return (
    <div style={{ padding: '7px 8px', borderRadius: 4, background: 'rgba(0,0,0,0.06)',
      marginBottom: 5, opacity: monster.dead ? 0.4 : 1,
      position: 'relative',
      boxShadow: conditionBoxShadow(conditions),
      transition: 'box-shadow 0.2s',
      ...conditionCardStyle(conditions) }}>
      <ConditionOverlay conditions={conditions}/>

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

      {/* Triggered action */}
      <div style={{ marginBottom: 4 }}>
        <label style={{ display:'flex', alignItems:'center', gap:5, cursor: admin?'pointer':'default',
          fontSize:'0.7rem', color: monster.triggered?'#7a2020':'#999', userSelect:'none' }}>
          <input type='checkbox' checked={monster.triggered||false}
            onChange={e => admin && upd({ triggered: e.target.checked })}
            disabled={!admin}
            style={{ accentColor: MONSTER_COLOR, width:12, height:12 }}/>
          Triggered Action
        </label>
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

      <ConditionPicker conditions={conditions}
        onChange={v => upd({ conditions: v })}
        editable={admin}
        accentColor={MONSTER_COLOR}/>
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

  const totalTurns = groupTotalTurns(group)
  const turnsUsed = group.turnsUsed || 0
  const groupDone = turnsUsed >= totalTurns
  const canEndTurn = phase === 'monsters' && !groupDone && admin && totalTurns > 0
  const allDead = group.monsters.length > 0 && group.monsters.every(m => m.dead)

  return (
    <div style={{ borderRadius: 6, border: `2px solid ${groupDone ? '#ccc' : '#e0c0c0'}`,
      background: groupDone ? '#e8e4e0' : '#fff8f6',
      padding: '10px 12px', marginBottom: 8,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      opacity: allDead ? 0.4 : groupDone ? 0.55 : 1,
      transition: 'opacity 0.2s, background 0.2s' }}>

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
                color: groupDone ? '#aaa' : MONSTER_COLOR, fontWeight:600, flex:1,
                cursor: admin ? 'text' : 'default',
                textDecoration: groupDone ? 'line-through' : 'none' }}>
              {group.name}
            </span>
        }
        {groupDone && <span style={{ fontSize:'0.65rem', color:'#aaa', fontStyle:'italic' }}>done</span>}
        {!groupDone && turnsUsed > 0 && <span style={{ fontSize:'0.65rem', color:'#c84a4a', fontStyle:'italic' }}>turn {turnsUsed + 1}/{totalTurns}</span>}
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
  const canEdit = !!user  // all logged-in users can check action boxes
  const isMe = user?.displayName === player.name
  const canEndTurn = phase === 'players' && !player.turnTaken && !player.dead && canEdit
  const upd = p => onUpdate({ ...player, ...p })

  const conditions = player.conditions || []

  return (
    <div style={{ borderRadius:6, border:`2px solid ${player.turnTaken ? '#ccc' : '#ccc9c0'}`,
      background: player.turnTaken ? '#e8e8e8' : '#faf9f6',
      padding:'10px 12px', marginBottom:8,
      position: 'relative',
      boxShadow: conditionBoxShadow(conditions, '0 1px 4px rgba(0,0,0,0.06)'),
      opacity: player.dead ? 0.4 : player.turnTaken ? 0.55 : 1,
      transition: 'opacity 0.2s, background 0.2s, box-shadow 0.2s',
      ...conditionCardStyle(conditions) }}>
      <ConditionOverlay conditions={conditions}/>

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

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 8px' }}>
        <ActionBox label='Triggered Action' checked={player.triggered}
          onChange={v => canEdit && upd({ triggered:v })} disabled={!canEdit}/>
        <ActionBox label='Main Action' checked={player.main}
          onChange={v => canEdit && upd({ main:v })} disabled={!canEdit}/>
        <ActionBox label='Maneuver' checked={player.maneuver}
          onChange={v => canEdit && upd({ maneuver:v })} disabled={!canEdit}/>
        <ActionBox label='Move' checked={player.move}
          onChange={v => canEdit && upd({ move:v })} disabled={!canEdit}/>
      </div>
      <div style={{ marginTop:4, paddingTop:4, borderTop:'1px solid rgba(255,255,255,0.08)',
        display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <label style={{ display:'flex', alignItems:'center', gap:5, cursor: canEdit?'pointer':'default',
          fontSize:'0.75rem', userSelect:'none',
          color: player.heroicResource ? '#c8b87a' : '#666' }}>
          <input type='checkbox' checked={player.heroicResource||false}
            onChange={e => canEdit && upd({ heroicResource: e.target.checked })}
            disabled={!canEdit}
            style={{ accentColor:'#c8b87a', width:13, height:13 }}/>
          Heroic Resource
        </label>
        <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:'0.75rem',
          color:'#7a9ac8', userSelect:'none' }}>
          <span>Victories</span>
          <input type='number' min={0} max={99} value={player.victories||0}
            onChange={e => onUpdate({ ...player, victories: Math.max(0, parseInt(e.target.value)||0) })}
            style={{ width:38, padding:'1px 4px', borderRadius:3, textAlign:'center',
              border:'1px solid #2a3a5a', background:'#252540', color:'#7a9ac8',
              fontSize:'0.75rem', fontFamily:"'Source Serif 4',Georgia,serif" }}/>
        </label>
      </div>

      <ConditionPicker conditions={conditions}
        onChange={v => upd({ conditions: v })}
        editable={canEdit}
        accentColor={PLAYER_COLOR}/>

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

// ─── Template modal ───────────────────────────────────────────────────────────
function TemplateModal({ templates, onLoad, onDelete, onClose }) {
  const btn = (label, onClick, col='#3a3a5a') => (
    <button onClick={onClick} style={{ padding:'4px 10px', border:`1px solid ${col}`, borderRadius:3,
      background:'transparent', color: col==='#b44'?'#b44':'#aaa', cursor:'pointer',
      fontSize:'0.75rem', fontFamily:"'Source Serif 4',Georgia,serif" }}>{label}</button>
  )
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:400,
      display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'#1e1e32', border:'1px solid #3a3a5a',
        borderRadius:8, padding:'1.2rem', width:340, fontFamily:"'Source Serif 4',Georgia,serif" }}>
        <div style={{ fontFamily:"'IM Fell English',serif", color:'#c8b87a', fontSize:'1rem', marginBottom:'1rem' }}>
          Load Template
        </div>
        {templates.length === 0 && (
          <div style={{ color:'#666', fontStyle:'italic', fontSize:'0.82rem', marginBottom:'1rem' }}>
            No templates saved yet.
          </div>
        )}
        {templates.map(t => (
          <div key={t.id} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8,
            padding:'8px 10px', background:'#252540', borderRadius:4 }}>
            <span style={{ flex:1, fontSize:'0.85rem', color:'#c8c0b0' }}>{t.name}</span>
            {btn('Load', () => onLoad(t), '#4a9ac8')}
            {btn('✕', () => onDelete(t.id), '#b44')}
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
          {btn('Close', onClose)}
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function InitiativeTracker({ user, onClose }) {
  const admin = isAdmin(user)
  const isMobile = useIsMobile()

  // Tab list lives at initiative/tabs
  const [tabs, setTabs] = useState([])           // [{id, name}]
  const [activeTabId, setActiveTabId] = useState(null)
  const [state, setState] = useState(null)       // current tab's battle state
  const [templates, setTemplates] = useState([]) // [{id, name, state}]
  const [loaded, setLoaded] = useState(false)
  const [tabsLoaded, setTabsLoaded] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [editingTabName, setEditingTabName] = useState(null)
  const [editingTabNameVal, setEditingTabNameVal] = useState('')
  const [addingTab, setAddingTab] = useState(false)
  const [newTabName, setNewTabName] = useState('')
  const writing = useRef(0)   // timestamp of last write, 0 = not writing
  const unsubStateRef = useRef(null)
  const unsubTabsRef = useRef(null)

  const tabSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const setActiveTabWithHash = (tabId, tabList) => {
    setActiveTabId(tabId)
    const tab = (tabList || tabs).find(t => t.id === tabId)
    if (tab) history.replaceState(null, '', '#initiative-' + tabSlug(tab.name))
  }

  // Subscribe to tab list
  useEffect(() => {
    const ref = doc(db, 'initiative/tabs')
    const init = async () => {
      try {
        const snap = await getDoc(ref)
        if (!snap.exists()) {
          const defaultTab = { id: uid(), name: 'Encounter 1' }
          await setDoc(ref, { tabs: [defaultTab], updatedAt: serverTimestamp() })
        }
      } catch(e) { console.error('Tab init error:', e) }
      unsubTabsRef.current = onSnapshot(ref, snap => {
        const list = snap.exists() ? (snap.data().tabs || []) : []
        setTabs(list)
        setTabsLoaded(true)
        setActiveTabId(prev => {
          if (prev && list.find(t => t.id === prev)) return prev
          const hash = window.location.hash.replace('#initiative-', '')
          const byHash = list.find(t => tabSlug(t.name) === hash)
          const chosen = byHash?.id || list[0]?.id || null
          if (chosen) {
            const tab = list.find(t => t.id === chosen)
            if (tab) history.replaceState(null, '', '#initiative-' + tabSlug(tab.name))
          }
          return chosen
        })
      }, err => { console.error('Tab list error:', err); setTabsLoaded(true) })
    }
    init()
    return () => { if (unsubTabsRef.current) unsubTabsRef.current() }
  }, [])

  // Subscribe to templates
  useEffect(() => {
    const ref = doc(db, 'initiative/templates')
    const unsub = onSnapshot(ref, snap => {
      setTemplates(snap.exists() ? (snap.data().list || []) : [])
    }, ()=>{})
    return () => unsub()
  }, [])

  // Subscribe to active tab's state
  useEffect(() => {
    if (!activeTabId) { setState(null); setLoaded(false); return }
    setLoaded(false)
    if (unsubStateRef.current) unsubStateRef.current()
    const ref = doc(db, 'initiative/tab-' + activeTabId)
    const init = async () => {
      try {
        const snap = await getDoc(ref)
        if (!snap.exists()) {
          await setDoc(ref, { ...BLANK_STATE, updatedAt: serverTimestamp() })
        }
      } catch(e) { console.error('Tab state init error:', e) }
      unsubStateRef.current = onSnapshot(ref, snap => {
        // Only skip update if we wrote within the last 500ms
        if (writing.current && Date.now() - writing.current < 500) return
        if (snap.exists() && !snap.data()._deleted) {
          setState(snap.data())
        } else {
          setState({ ...BLANK_STATE })
        }
        setLoaded(true)
      }, err => { console.error('State error:', err); setState({ ...BLANK_STATE }); setLoaded(true) })
    }
    init()
    return () => { if (unsubStateRef.current) unsubStateRef.current() }
  }, [activeTabId])

  const persist = async (s) => {
    if (!activeTabId) return
    writing.current = Date.now()
    try { await setDoc(doc(db, 'initiative/tab-' + activeTabId), { ...s, updatedAt: serverTimestamp() }) }
    finally { setTimeout(() => { writing.current = 0 }, 500) }
  }
  const update = s => { setState(s); persist(s) }

  const persistTabs = async (newTabs) => {
    await setDoc(doc(db, 'initiative/tabs'), { tabs: newTabs, updatedAt: serverTimestamp() })
  }

  const addTab = () => {
    const name = newTabName.trim() || `Encounter ${tabs.length + 1}`
    const newTab = { id: uid(), name }
    const newTabs = [...tabs, newTab]
    setTabs(newTabs)
    persistTabs(newTabs)
    setActiveTabWithHash(newTab.id, newTabs)
    setNewTabName(''); setAddingTab(false)
  }

  const renameTab = (tabId) => {
    const name = editingTabNameVal.trim()
    if (!name) { setEditingTabName(null); return }
    const newTabs = tabs.map(t => t.id === tabId ? { ...t, name } : t)
    setTabs(newTabs)
    persistTabs(newTabs)
    setEditingTabName(null)
    history.replaceState(null, '', '#initiative-' + tabSlug(name))
  }

  const deleteTab = async (tabId) => {
    if (!confirm('Delete this encounter tab?')) return
    const newTabs = tabs.filter(t => t.id !== tabId)
    setTabs(newTabs)
    persistTabs(newTabs)
    // Also delete the state doc
    try { await setDoc(doc(db, 'initiative/tab-' + tabId), { _deleted: true }) } catch {}
    if (activeTabId === tabId) {
      const next = newTabs[0]
      if (next) setActiveTabWithHash(next.id, newTabs)
      else setActiveTabId(null)
    }
  }

  const saveAsTemplate = async () => {
    const name = prompt('Template name:', tabs.find(t=>t.id===activeTabId)?.name || 'Encounter')
    if (!name) return
    // Strip combat state but keep roster
    const templateState = {
      ...state,
      round: 1, phase: 'players',
      players: state.players.map(p => ({ ...p, turnTaken:false, triggered:false, main:false, maneuver:false, move:false, heroicResource:false, dead:false })),
      monsterGroups: state.monsterGroups.map(g => ({ ...g, turnsUsed:0,
        monsters: g.monsters.map(m => ({ ...m, hp:m.maxHp, triggered:false, dead:false,
          ...(m.tier==='minion' ? {hp:(m.count||1)*(m.hpPer||1)} : {}) })) })),
    }
    const newTemplate = { id: uid(), name, state: templateState }
    const newList = [...templates, newTemplate]
    await setDoc(doc(db, 'initiative/templates'), { list: newList, updatedAt: serverTimestamp() })
  }

  const loadTemplate = (template) => {
    if (!confirm(`Load template "${template.name}"? This replaces the current encounter.`)) return
    update({ ...template.state, round: 1, phase: 'players' })
    setShowTemplates(false)
  }

  const deleteTemplate = async (templateId) => {
    const newList = templates.filter(t => t.id !== templateId)
    await setDoc(doc(db, 'initiative/templates'), { list: newList, updatedAt: serverTimestamp() })
  }

  if (!tabsLoaded) return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'#1a1a2a',
      display:'flex', alignItems:'center', justifyContent:'center',
      color:'#888', fontStyle:'italic', fontFamily:"'Source Serif 4',Georgia,serif" }}>Loading…</div>
  )

  const { round, phase, players, monsterGroups, malice = 0 } = state || BLANK_STATE
  const allPlayersDone = players.filter(p=>!p.dead).every(p=>p.turnTaken)
  const allMonstersDone = !monstersHaveTurns(monsterGroups)

  const playerEndTurn = async (playerId) => {
    // Optimistic local update for snappy UI
    setState(s => applyPlayerEndTurn(s, playerId))
    // Transactional Firestore write — reads the latest server state before writing,
    // preventing stale closure data from overwriting concurrent changes by other players
    const ref = doc(db, 'initiative/tab-' + activeTabId)
    writing.current = Date.now()
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref)
        const s = snap.exists() ? snap.data() : { ...BLANK_STATE }
        tx.set(ref, { ...applyPlayerEndTurn(s, playerId), updatedAt: serverTimestamp() })
      })
    } catch (e) { console.error('playerEndTurn transaction failed:', e) }
    finally { setTimeout(() => { writing.current = 0 }, 500) }
  }

  const monsterGroupEndTurn = async (groupId) => {
    // Optimistic local update for snappy UI
    setState(s => applyMonsterGroupEndTurn(s, groupId))
    // Transactional Firestore write — reads the latest server state before writing
    const ref = doc(db, 'initiative/tab-' + activeTabId)
    writing.current = Date.now()
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref)
        const s = snap.exists() ? snap.data() : { ...BLANK_STATE }
        tx.set(ref, { ...applyMonsterGroupEndTurn(s, groupId), updatedAt: serverTimestamp() })
      })
    } catch (e) { console.error('monsterGroupEndTurn transaction failed:', e) }
    finally { setTimeout(() => { writing.current = 0 }, 500) }
  }

  const updatePlayer = upd => update({ ...state, players:players.map(p=>p.id===upd.id?upd:p) })
  const removePlayer = id => update({ ...state, players:players.filter(p=>p.id!==id) })
  const addPlayer = () => { if(!newPlayerName.trim())return; update({...state,players:[...players,BLANK_PLAYER(newPlayerName.trim())]}); setNewPlayerName('') }
  const updateGroup = upd => update({ ...state, monsterGroups:monsterGroups.map(g=>g.id===upd.id?upd:g) })
  const removeGroup = id => update({ ...state, monsterGroups:monsterGroups.filter(g=>g.id!==id) })
  const addGroup = () => { if(!newGroupName.trim())return; update({...state,monsterGroups:[...monsterGroups,BLANK_GROUP(newGroupName.trim())]}); setNewGroupName('') }
  const resetCombat = () => {
    if(!confirm('Reset initiative? Clears monsters and resets all turns.'))return
    update({ ...BLANK_STATE, players:players.map(p=>({...p,turnTaken:false,triggered:false,main:false,maneuver:false,move:false,dead:false})) })
  }

  const btnStyle = (col='#3a3a5a') => ({ padding:'5px 10px', border:`1px solid ${col}`, borderRadius:3,
    background:'transparent', color:'#aaa', cursor:'pointer', fontSize:'0.78rem',
    fontFamily:"'Source Serif 4',Georgia,serif" })

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'#1a1a2a',
      display:'flex', flexDirection:'column', fontFamily:"'Source Serif 4',Georgia,serif",
      overflowY: isMobile ? 'auto' : 'hidden' }}>
      <ConditionStyles/>

      {/* Header */}
      <div style={{ background:'#12121e', borderBottom:'1px solid #2a2a4a',
        padding:'0 0.8rem', height:isMobile?44:50, display:'flex', alignItems:'center', gap:isMobile?'0.4rem':'0.8rem', flexShrink:0 }}>
        {!isMobile && <span style={{ fontFamily:"'IM Fell English',serif", fontSize:'1.1rem', color:'#c8b87a', flexShrink:0 }}>Initiative</span>}
        {state && <>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            {admin && <button onClick={()=>update({...state,round:Math.max(1,round-1)})}
              style={{ background:'none',border:'1px solid #3a3a5a',borderRadius:3,color:'#888',cursor:'pointer',fontSize:'0.75rem',padding:'2px 6px' }}>−</button>}
            <span style={{ color:'#c8b87a',fontSize:'0.82rem',fontWeight:600,
              background:'#2a2a3e',padding:'3px 10px',borderRadius:4,border:'1px solid #3a3a5a' }}>
              Round {round}
            </span>
            {admin && <button onClick={()=>update({...state,round:round+1})}
              style={{ background:'none',border:'1px solid #3a3a5a',borderRadius:3,color:'#888',cursor:'pointer',fontSize:'0.75rem',padding:'2px 6px' }}>+</button>}
          </div>
          <div onClick={() => admin && state && update({ ...state, phase: phase === 'players' ? 'monsters' : 'players' })}
            style={{ display:'flex',gap:0,borderRadius:20,overflow:'hidden',border:'1px solid #3a3a5a',
              cursor: admin ? 'pointer' : 'default' }}
            title={admin ? 'Click to switch sides' : ''}>
            <span style={{ fontSize:'0.7rem',padding:'3px 8px',background:phase==='players'?PLAYER_COLOR:'transparent',color:phase==='players'?'#fff':'#555',transition:'all 0.2s' }}>Players</span>
            <span style={{ fontSize:'0.7rem',padding:'3px 8px',background:phase==='monsters'?MONSTER_COLOR:'transparent',color:phase==='monsters'?'#fff':'#555',transition:'all 0.2s' }}>Monsters</span>
          </div>
        </>}
        <div style={{ flex:1 }}/>
        {admin && state && !isMobile && <>
          <button onClick={resetCombat} style={btnStyle()}>↺ Reset</button>
          <button onClick={saveAsTemplate} style={btnStyle('#4a9ac8')} title='Save current state as a template'>💾</button>
          <button onClick={()=>setShowTemplates(true)} style={btnStyle('#7a5a9a')}>📂</button>
        </>}
        {admin && state && isMobile && <>
          <button onClick={resetCombat} style={{...btnStyle(), padding:'3px 7px', fontSize:'0.7rem'}}>↺</button>
          <button onClick={()=>setShowTemplates(true)} style={{...btnStyle('#7a5a9a'), padding:'3px 7px', fontSize:'0.7rem'}}>📂</button>
        </>}
        <button onClick={onClose} style={{...btnStyle(), padding:isMobile?'3px 8px':'5px 10px'}}>← Back</button>
      </div>

      {/* Tab bar */}
      <div style={{ background:'#16162a', borderBottom:'1px solid #2a2a4a',
        display:'flex', alignItems:'flex-end', padding:isMobile?'0 0.5rem':'0 1rem', gap:2, flexShrink:0, overflowX:'auto' }}>
        {tabs.map(tab => (
          <div key={tab.id}
            onClick={() => setActiveTabWithHash(tab.id)}
            style={{ padding:'7px 16px 5px', cursor:'pointer', userSelect:'none',
              borderRadius:'4px 4px 0 0', border:'1px solid transparent',
              borderBottom: activeTabId===tab.id ? '1px solid #1a1a2a' : '1px solid #2a2a4a',
              background: activeTabId===tab.id ? '#1a1a2a' : 'transparent',
              color: activeTabId===tab.id ? '#c8b87a' : '#555',
              fontFamily:"'IM Fell English',serif", fontSize:'0.88rem',
              display:'flex', alignItems:'center', gap:6,
              marginBottom: activeTabId===tab.id ? -1 : 0,
            }}>
            {editingTabName === tab.id && admin
              ? <input autoFocus value={editingTabNameVal}
                  onChange={e=>setEditingTabNameVal(e.target.value)}
                  onBlur={()=>renameTab(tab.id)}
                  onKeyDown={e=>{ if(e.key==='Enter')renameTab(tab.id); if(e.key==='Escape')setEditingTabName(null) }}
                  onClick={e=>e.stopPropagation()}
                  style={{ width:100,padding:'1px 4px',border:'1px solid #c8b87a',borderRadius:2,
                    fontSize:'0.88rem',fontFamily:"'IM Fell English',serif",
                    background:'#1a1a2a',color:'#c8b87a' }}/>
              : <span onDoubleClick={()=>{ if(admin){setEditingTabName(tab.id);setEditingTabNameVal(tab.name)} }}>
                  {tab.name}
                </span>
            }
            {admin && activeTabId===tab.id && tabs.length>1 && (
              <span onClick={e=>{e.stopPropagation();deleteTab(tab.id)}}
                style={{ fontSize:'0.6rem',color:'#555',cursor:'pointer',lineHeight:1 }}>✕</span>
            )}
          </div>
        ))}
        {admin && (
          addingTab
            ? <div style={{ display:'flex',alignItems:'center',gap:4,padding:'5px 8px' }}>
                <input autoFocus value={newTabName} onChange={e=>setNewTabName(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter')addTab();if(e.key==='Escape'){setAddingTab(false);setNewTabName('')}}}
                  placeholder='Encounter name…'
                  style={{ width:120,padding:'2px 6px',border:'1px solid #3a3a5a',borderRadius:3,
                    fontSize:'0.82rem',background:'#1a1a2a',color:'#c8c0b0',fontFamily:"'Source Serif 4',Georgia,serif" }}/>
                <button onClick={addTab} style={{ padding:'2px 7px',border:'none',borderRadius:3,background:PLAYER_COLOR,color:'#fff',cursor:'pointer',fontSize:'0.72rem' }}>+</button>
                <button onClick={()=>{setAddingTab(false);setNewTabName('')}} style={{ padding:'2px 6px',border:'1px solid #3a3a5a',borderRadius:3,background:'none',color:'#666',cursor:'pointer',fontSize:'0.72rem' }}>✕</button>
              </div>
            : <button onClick={()=>setAddingTab(true)}
                style={{ padding:'7px 12px',border:'none',background:'none',cursor:'pointer',color:'#555',fontSize:'1rem',marginBottom:2 }}>+</button>
        )}
      </div>

      {/* Content */}
      {(!loaded || !state) ? (
        <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',
          color:'#555',fontStyle:'italic' }}>Loading encounter…</div>
      ) : (
        <div style={{ flex:isMobile?'none':1,display:isMobile?'flex':'grid',flexDirection:isMobile?'column':undefined,gridTemplateColumns:isMobile?undefined:'1fr 1fr',overflow:isMobile?'visible':'hidden',overflowY:isMobile?'auto':undefined,WebkitOverflowScrolling:'touch' }}>
          {/* Players */}
          <div style={{ borderRight:isMobile?'none':'1px solid #2a2a4a',borderBottom:isMobile?'2px solid #2a2a4a':'none',display:'flex',flexDirection:'column',overflow:isMobile?'visible':'hidden',flexShrink:isMobile?0:undefined }}>
            <div style={{ padding:'10px 16px 6px',background:'#12121e',borderBottom:'1px solid #2a2a4a',
              fontSize:'0.68rem',textTransform:'uppercase',letterSpacing:'0.1em',color:PLAYER_COLOR,fontWeight:700,
              display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <span>Players</span>
              {phase==='players'&&!allPlayersDone&&<span style={{ fontSize:'0.65rem',color:'#4a9ac8',fontStyle:'italic',textTransform:'none',letterSpacing:0 }}>▶ Player turn</span>}
              {phase==='players'&&allPlayersDone&&<span style={{ fontSize:'0.65rem',color:'#888',fontStyle:'italic',textTransform:'none',letterSpacing:0 }}>all done</span>}
            </div>
            <div style={{ flex:isMobile?'none':1,overflowY:isMobile?'visible':'auto',padding:'10px 12px' }}>
              {players.map(p=>(
                <PlayerCard key={p.id} player={p} phase={phase} user={user} admin={admin}
                  onUpdate={updatePlayer} onRemove={()=>removePlayer(p.id)} onEndTurn={()=>playerEndTurn(p.id)}/>
              ))}
              {user&&(
                <div style={{ display:'flex',gap:6,marginTop:8 }}>
                  <input value={newPlayerName} onChange={e=>setNewPlayerName(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&addPlayer()} placeholder='Add player…'
                    style={{ flex:1,padding:'5px 8px',border:'1px solid #2a3a5a',borderRadius:3,
                      background:'#252540',color:'#c8c0b0',fontSize:'0.82rem',
                      fontFamily:"'Source Serif 4',Georgia,serif",outline:'none' }}/>
                  <button onClick={addPlayer}
                    style={{ padding:'5px 10px',border:'none',borderRadius:3,
                      background:PLAYER_COLOR,color:'#fff',cursor:'pointer',fontSize:'0.8rem' }}>+</button>
                </div>
              )}
            </div>
          </div>

          {/* Monsters */}
          <div style={{ display:'flex',flexDirection:'column',overflow:isMobile?'visible':'hidden',flexShrink:isMobile?0:undefined }}>
            <div style={{ padding:'10px 16px 6px',background:'#12121e',borderBottom:'1px solid #2a2a4a',
              fontSize:'0.68rem',textTransform:'uppercase',letterSpacing:'0.1em',color:MONSTER_COLOR,fontWeight:700,
              display:'flex',alignItems:'center',justifyContent:'space-between' }}>
              <span>Monsters</span>
              {phase==='monsters'&&!allMonstersDone&&<span style={{ fontSize:'0.65rem',color:'#c84a4a',fontStyle:'italic',textTransform:'none',letterSpacing:0 }}>▶ Monster turn</span>}
              {phase==='monsters'&&allMonstersDone&&<span style={{ fontSize:'0.65rem',color:'#888',fontStyle:'italic',textTransform:'none',letterSpacing:0 }}>all done</span>}
            </div>
            <div style={{ flex:isMobile?'none':1,overflowY:isMobile?'visible':'auto',padding:'10px 12px' }}>
              {/* Malice card — always present, speep-only edit */}
              <div style={{ borderRadius:6, marginBottom:10,
                background:'#1a0808', border:'2px solid #7a0000',
                boxShadow:'0 0 16px rgba(180,0,0,0.25)',
                padding:'10px 14px', display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ fontFamily:"'IM Fell English',serif", fontSize:'1.4rem',
                  color:'#c0392b', letterSpacing:'0.12em', textShadow:'0 0 12px rgba(192,57,43,0.6)',
                  flexShrink:0, userSelect:'none' }}>
                  MALICE
                </div>
                <div style={{ flex:1 }}/>
                {admin && (
                  <>
                    <button onClick={() => {
                      const livePlayers = players.filter(p=>!p.dead)
                      if (!livePlayers.length) return
                      const avg = Math.round(livePlayers.reduce((s,p)=>s+(p.victories||0),0) / livePlayers.length)
                      update({ ...state, malice: avg })
                    }}
                      title='Set to average victories per hero'
                      style={{ padding:'2px 7px', border:'1px solid #7a0000', borderRadius:4,
                        background:'#2a0808', color:'#c0392b', cursor:'pointer',
                        fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.08em',
                        fontFamily:"'Source Serif 4',Georgia,serif" }}>
                      SET
                    </button>
                    <button onClick={() => update({ ...state, malice: Math.max(0, malice - 1) })}
                      style={{ width:28, height:28, border:'1px solid #7a0000', borderRadius:4,
                        background:'#2a0808', color:'#c0392b', cursor:'pointer',
                        fontSize:'1rem', lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      −
                    </button>
                  </>
                )}
                <div style={{ minWidth:36, textAlign:'center',
                  fontFamily:"'IM Fell English',serif", fontSize:'1.8rem',
                  fontWeight:700, color:'#e74c3c',
                  textShadow:'0 0 10px rgba(231,76,60,0.7)' }}>
                  {malice}
                </div>
                {admin && (
                  <button onClick={() => update({ ...state, malice: malice + 1 })}
                    style={{ width:28, height:28, border:'1px solid #7a0000', borderRadius:4,
                      background:'#2a0808', color:'#c0392b', cursor:'pointer',
                      fontSize:'1rem', lineHeight:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    +
                  </button>
                )}
                {!admin && (
                  <div style={{ minWidth:28 }}/>
                )}
              </div>
              {monsterGroups.map(g=>(
                <MonsterGroupCard key={g.id} group={g} admin={admin} phase={phase}
                  onUpdate={updateGroup} onRemove={()=>removeGroup(g.id)} onEndTurn={()=>monsterGroupEndTurn(g.id)}/>
              ))}
              {admin&&(
                <div style={{ display:'flex',gap:6,marginTop:8 }}>
                  <input value={newGroupName} onChange={e=>setNewGroupName(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&addGroup()} placeholder='Add group…'
                    style={{ flex:1,padding:'5px 8px',border:'1px solid #3a2a2a',borderRadius:3,
                      background:'#252020',color:'#c8b0b0',fontSize:'0.82rem',
                      fontFamily:"'Source Serif 4',Georgia,serif",outline:'none' }}/>
                  <button onClick={addGroup}
                    style={{ padding:'5px 10px',border:'none',borderRadius:3,
                      background:MONSTER_COLOR,color:'#fff',cursor:'pointer',fontSize:'0.8rem' }}>+</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showTemplates && (
        <TemplateModal
          templates={templates}
          onLoad={loadTemplate}
          onDelete={deleteTemplate}
          onClose={()=>setShowTemplates(false)}/>
      )}
    </div>
  )
}
