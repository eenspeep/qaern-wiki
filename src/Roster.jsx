import { useState, useEffect, useRef } from 'react'
import { collection, doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { db, storage } from './firebase'
import { RichEditor } from './RichEditor'

const ADMIN = 'speep'
const isAdmin = user => user?.displayName === ADMIN

const uid = () => Math.random().toString(36).slice(2, 10)
const slugify = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const INFOBOX_FIELDS = ['Name', 'Class', 'Level', 'Ancestry', 'Faction', 'Age', 'Player Name']

const FACTION_COLORS = {
  'scarlet pyre':    { glow: 'rgba(190, 35, 35, 0.30)', border: '#c88080' },
  'amber ceremony':  { glow: 'rgba(195, 140, 0, 0.30)',  border: '#c8a845' },
}

const checkPassword = (input, hash) => btoa(input) === hash

// ─── Shared styles ────────────────────────────────────────────────────────────
const inp = { width: '100%', padding: '6px 9px', border: '1px solid #ccc9c0', borderRadius: 3, fontSize: '0.85rem', fontFamily: "'Source Serif 4',Georgia,serif", background: '#f8f7f4', color: '#222', boxSizing: 'border-box' }
const lb  = { display: 'block', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', marginBottom: 3 }
const btnPrimary   = { padding: '6px 16px', border: 'none', borderRadius: 3, background: '#1b4f72', color: '#fff', cursor: 'pointer', fontSize: '0.83rem', fontFamily: "'Source Serif 4',Georgia,serif" }
const btnSecondary = { padding: '6px 12px', border: '1px solid #ccc9c0', borderRadius: 3, background: '#f0eeea', color: '#444', cursor: 'pointer', fontSize: '0.83rem', fontFamily: "'Source Serif 4',Georgia,serif" }
const btnDanger    = { padding: '6px 12px', border: '1px solid #e0b0b0', borderRadius: 3, background: 'none', color: '#b44', cursor: 'pointer', fontSize: '0.83rem', fontFamily: "'Source Serif 4',Georgia,serif" }

// ─── Sealed envelope ─────────────────────────────────────────────────────────
function SecretEnvelope({ onReveal, hasSecret }) {
  const [hovered, setHovered] = useState(false)
  if (!hasSecret) return null
  return (
    <div
      onClick={onReveal}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'pointer',
        margin: '1.5rem 0',
        borderRadius: 6,
        overflow: 'hidden',
        border: '2px solid #c8a060',
        boxShadow: hovered ? '0 6px 28px rgba(0,0,0,0.22)' : '0 2px 12px rgba(0,0,0,0.12)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'box-shadow 0.2s, transform 0.15s',
        userSelect: 'none',
      }}>
      {/* Envelope body */}
      <div style={{
        background: 'linear-gradient(160deg, #f5e8c8 0%, #ede0b0 50%, #e8d490 100%)',
        padding: '2.5rem 2rem 2rem',
        textAlign: 'center',
        position: 'relative',
      }}>
        {/* Envelope flap (triangle at top) */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 0,
          borderLeft: '50vw solid transparent',
          borderRight: '50vw solid transparent',
          borderTop: '56px solid #d4b870',
          pointerEvents: 'none',
        }}/>
        {/* Wax seal */}
        <div style={{
          width: 88, height: 88, borderRadius: '50%',
          background: 'radial-gradient(circle at 38% 35%, #ff7070 0%, #cc0000 55%, #7a0000 100%)',
          margin: '0 auto 1.2rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 18px rgba(150,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.2)',
          fontSize: '2rem',
          position: 'relative', zIndex: 1,
          border: '3px solid #8a0000',
        }}>
          🔒
        </div>
        {/* Label */}
        <div style={{
          fontFamily: "'IM Fell English', serif",
          fontSize: '1.05rem',
          color: '#7a5020',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: 4,
          position: 'relative', zIndex: 1,
        }}>
          GM Eyes Only
        </div>
        <div style={{
          fontSize: '0.72rem',
          color: '#9a7040',
          fontStyle: 'italic',
          position: 'relative', zIndex: 1,
        }}>
          {hovered ? 'Click to unseal…' : 'This section is sealed'}
        </div>
      </div>
    </div>
  )
}

// ─── Password modal ───────────────────────────────────────────────────────────
function PasswordModal({ onUnlock, onCancel }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 40)
    const h = e => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onCancel])

  const submit = () => {
    onUnlock(value, () => { setError(true); setValue('') })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#f8f7f4', border: '1px solid #ccc9c0', borderRadius: 6, padding: '1.5rem', width: 300, fontFamily: "'Source Serif 4',Georgia,serif", boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
        <div style={{ fontFamily: "'IM Fell English',serif", fontSize: '1.1rem', color: '#1a1a1a', marginBottom: '0.4rem' }}>🔒 GM Eyes Only</div>
        <div style={{ fontSize: '0.84rem', color: '#666', marginBottom: '1rem', lineHeight: 1.5 }}>Enter the GM's password to unseal this section.</div>
        <input ref={inputRef} type='password' value={value}
          onChange={e => { setValue(e.target.value); setError(false) }}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder='Password…'
          style={{ ...inp, border: `1px solid ${error ? '#e0b0b0' : '#ccc9c0'}` }}/>
        {error && <div style={{ fontSize: '0.74rem', color: '#b44', marginTop: 4 }}>Incorrect password.</div>}
        <div style={{ display: 'flex', gap: 6, marginTop: '0.9rem' }}>
          <button onClick={submit} style={btnPrimary}>Unseal</button>
          <button onClick={onCancel} style={btnSecondary}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── PDF fullscreen viewer ────────────────────────────────────────────────────
function PdfViewer({ url, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: '#1a1a1a', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: '#111', borderBottom: '1px solid #333', flexShrink: 0 }}>
        <span style={{ color: '#ccc', fontSize: '0.85rem', flex: 1 }}>Character Sheet</span>
        <a href={url} target='_blank' rel='noopener noreferrer'
          style={{ color: '#7ab', fontSize: '0.78rem', textDecoration: 'none', padding: '4px 10px', border: '1px solid #445', borderRadius: 3 }}>
          ⬇ Download
        </a>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px', lineHeight: 1 }}>✕</button>
      </div>
      <iframe src={url} style={{ flex: 1, border: 'none', width: '100%' }} title='Character Sheet'/>
    </div>
  )
}

// ─── Character card ───────────────────────────────────────────────────────────
function CharacterCard({ char, onClick }) {
  const [hovered, setHovered] = useState(false)
  const fc = FACTION_COLORS[(char.faction || '').toLowerCase()]
  const shadow = hovered
    ? `0 8px 28px rgba(0,0,0,0.18)${fc ? `, 0 0 22px 5px ${fc.glow}` : ''}`
    : `0 2px 8px rgba(0,0,0,0.08)${fc ? `, 0 0 10px 3px ${fc.glow}` : ''}`
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'pointer',
        borderRadius: 6,
        border: `1px solid ${fc ? fc.border : '#ccc9c0'}`,
        background: '#faf9f6',
        boxShadow: shadow,
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'box-shadow 0.2s, transform 0.15s',
      }}>
      {/* Portrait — overflow:hidden isolated here so it doesn't clip the card's box-shadow */}
      <div style={{ width: '100%', aspectRatio: '3/4', background: '#d8d4cc', overflow: 'hidden', position: 'relative', borderRadius: '5px 5px 0 0' }}>
        {char.portrait
          ? <img src={char.portrait} alt={char.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', color: '#a09888' }}>⚔</div>
        }
      </div>
      {/* Name + class */}
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontFamily: "'IM Fell English',serif", fontSize: '1rem', color: '#222', fontWeight: 600, marginBottom: 3 }}>{char.name || '(Unnamed)'}</div>
        {(char.class || char.level) && (
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#888' }}>
            {char.class}{char.class && char.level ? ' · ' : ''}{char.level ? `Lv. ${char.level}` : ''}
          </div>
        )}
        {char.ancestry && <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: 1 }}>{char.ancestry}</div>}
        <div style={{ fontSize: '0.65rem', color: '#bbb', marginTop: 6, fontStyle: 'italic' }}>{char.player_name || char.playerName}</div>
      </div>
    </div>
  )
}

// ─── Character view ───────────────────────────────────────────────────────────
function CharacterView({ char, user, onEdit, onClose, unlocked, onRequestUnlock }) {
  const [showPdf, setShowPdf] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const admin = isAdmin(user)
  const secretVisible = admin || unlocked

  const handleUnlock = (password, onFail) => {
    if (checkPassword(password, char.secretPasswordHash)) {
      onRequestUnlock(char.id)
      setShowPasswordModal(false)
    } else {
      onFail()
    }
  }

  const Section = ({ title, html }) => {
    if (!html || html === '<p><br></p>' || html === '<br>') return null
    return (
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontFamily: "'IM Fell English',serif", fontSize: '1rem', color: '#1b4f72', borderBottom: '1px solid #e8e5e0', paddingBottom: 4, marginBottom: '0.7rem' }}>{title}</h3>
        <div className='article-body' dangerouslySetInnerHTML={{ __html: html }}
          style={{ fontSize: '0.9rem', lineHeight: 1.7, color: '#333' }}/>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#f8f7f4', borderRadius: 8, width: '100%', maxWidth: 680, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 16px 60px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column' }}>

        {/* Portrait */}
        {char.portrait && (
          <div style={{ width: '100%', maxHeight: 360, overflow: 'hidden', flexShrink: 0, borderRadius: '8px 8px 0 0' }}>
            <img src={char.portrait} alt={char.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>
          </div>
        )}

        <div style={{ padding: '1.5rem', flex: 1, minHeight: 0 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontFamily: "'IM Fell English',serif", fontSize: '1.6rem', color: '#1a1a1a', margin: 0 }}>{char.name || '(Unnamed)'}</h2>
              {char.faction && <div style={{ fontSize: '0.78rem', color: '#888', marginTop: 2 }}>{char.faction}</div>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {char.characterSheetUrl && (
                <button onClick={() => setShowPdf(true)} style={btnSecondary}>📄 Sheet</button>
              )}
              {(admin || user?.uid === char.playerUid) && (
                <button onClick={onEdit} style={btnSecondary}>✎ Edit</button>
              )}
              <button onClick={onClose} style={{ ...btnSecondary, padding: '6px 10px' }}>✕</button>
            </div>
          </div>

          {/* Infobox */}
          <div style={{ background: '#f0eeea', border: '1px solid #e0ddd8', borderRadius: 4, padding: '0.7rem 1rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            <div style={{ fontFamily: "'IM Fell English',serif", fontWeight: 600, fontSize: '0.88rem', color: '#1b4f72', borderBottom: '1px solid #e0ddd8', paddingBottom: 4, marginBottom: 8 }}>
              {char.name || 'Character'}
            </div>
            {INFOBOX_FIELDS.map(field => {
              const val = char[field.toLowerCase().replace(/ /g, '_')] || char[field] || ''
              if (!val) return null
              return (
                <div key={field} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: '#888', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: 90, flexShrink: 0, paddingTop: 1 }}>{field}</span>
                  <span style={{ color: '#222' }}>{val}</span>
                </div>
              )
            })}
          </div>

          {/* Summary */}
          <Section title='Summary' html={char.summary}/>

          {/* Goals */}
          <Section title='By Level 3' html={char.goal3}/>
          <Section title='By Level 5' html={char.goal5}/>
          <Section title='By Level 10' html={char.goal10}/>

          {/* Secret */}
          {(char.secret || char.secretPasswordHash) && (
            <div style={{ marginTop: '1rem' }}>
              <h3 style={{ fontFamily: "'IM Fell English',serif", fontSize: '1rem', color: '#8a0000', borderBottom: '1px solid #e8e5e0', paddingBottom: 4, marginBottom: '0.7rem' }}>
                🔒 SECRET
              </h3>
              {secretVisible
                ? (
                  <div>
                    <div className='article-body' dangerouslySetInnerHTML={{ __html: char.secret || '' }}
                      style={{ fontSize: '0.9rem', lineHeight: 1.7, color: '#333', background: '#fff5f5', border: '1px solid #e8c8c8', borderRadius: 4, padding: '0.75rem 1rem' }}/>
                    {!admin && (
                      <button onClick={() => onRequestUnlock(null)} style={{ ...btnSecondary, marginTop: 8, fontSize: '0.75rem' }}>🔒 Re-seal</button>
                    )}
                  </div>
                )
                : <SecretEnvelope hasSecret onReveal={() => setShowPasswordModal(true)}/>
              }
            </div>
          )}
        </div>
      </div>

      {showPasswordModal && (
        <PasswordModal
          onUnlock={handleUnlock}
          onCancel={() => setShowPasswordModal(false)}/>
      )}
      {showPdf && <PdfViewer url={char.characterSheetUrl} onClose={() => setShowPdf(false)}/>}
    </div>
  )
}

// ─── Character edit form ──────────────────────────────────────────────────────
function CharacterEditForm({ initial, user, onSave, onDelete, onCancel }) {
  const admin = isAdmin(user)
  const isNew = !initial?.id

  const blank = { name: '', class: '', level: '', ancestry: '', faction: '', age: '', player_name: user?.displayName || '', portrait: '', summary: '', goal3: '', goal5: '', goal10: '', secret: '', secretPasswordHash: '', characterSheetUrl: '' }
  const [draft, setDraft] = useState(() => ({ ...blank, ...initial }))
  const [secretPassword, setSecretPassword] = useState('')
  const [uploadProgress, setUploadProgress] = useState(null) // null | 0-100
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }))

  const uploadPdf = (file) => {
    if (!file) return
    const charId = draft.id || uid()
    if (!draft.id) setDraft(d => ({ ...d, id: charId }))
    const storageRef = ref(storage, `characters/${charId}/sheet.pdf`)
    const task = uploadBytesResumable(storageRef, file)
    setUploadProgress(0)
    task.on('state_changed',
      snap => setUploadProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
      err => { console.error('Upload failed:', err); setUploadProgress(null) },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        setDraft(d => ({ ...d, characterSheetUrl: url }))
        setUploadProgress(null)
      }
    )
  }

  const save = async () => {
    if (!draft.name.trim()) return
    setSaving(true)
    try {
      const charId = draft.id || slugify(draft.name) || uid()
      const data = {
        ...draft,
        id: charId,
        playerUid: initial?.playerUid || user.uid,
        playerName: initial?.playerName || user.displayName || user.email || '',
        secretPasswordHash: secretPassword ? btoa(secretPassword) : (draft.secretPasswordHash || ''),
        updatedAt: serverTimestamp(),
        ...(!initial?.createdAt ? { createdAt: serverTimestamp() } : {}),
      }
      await setDoc(doc(db, 'characters', charId), data)
      onSave(data)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete ${draft.name || 'this character'}? This cannot be undone.`)) return
    await deleteDoc(doc(db, 'characters', draft.id))
    onDelete()
  }

  const GoalSection = ({ label, field }) => (
    <div style={{ marginBottom: '1.2rem' }}>
      <label style={{ ...lb, fontSize: '0.8rem', color: '#555', marginBottom: 6, fontStyle: 'italic' }}>{label}</label>
      <RichEditor value={draft[field]} onChange={v => set(field, v)} minHeight={120} maxHeight={280}/>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 410, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#f8f7f4', borderRadius: 8, width: '100%', maxWidth: 720, maxHeight: '94vh', overflowY: 'auto', boxShadow: '0 16px 60px rgba(0,0,0,0.35)', fontFamily: "'Source Serif 4',Georgia,serif" }}>
        {/* Header */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e0ddd8', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0eeea', borderRadius: '8px 8px 0 0', position: 'sticky', top: 0, zIndex: 1 }}>
          <span style={{ fontFamily: "'IM Fell English',serif", fontSize: '1.1rem', color: '#1b4f72' }}>{isNew ? 'New Character' : `Edit — ${draft.name || 'Character'}`}</span>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '1.3rem', padding: '0 4px', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* Portrait + basic fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1.5rem' }}>
            <div style={{ gridColumn: '1 / -1', marginBottom: '1rem' }}>
              <label style={lb}>Portrait Image URL</label>
              <input style={inp} value={draft.portrait} onChange={e => set('portrait', e.target.value)} placeholder='https://…'/>
            </div>
            {INFOBOX_FIELDS.map(field => {
              const key = field.toLowerCase().replace(/ /g, '_')
              const val = draft[key] !== undefined ? draft[key] : (draft[field] || '')
              return (
                <div key={field} style={{ marginBottom: '0.8rem' }}>
                  <label style={lb}>{field}</label>
                  <input style={inp} value={val} onChange={e => set(key, e.target.value)} placeholder={field}/>
                </div>
              )
            })}
          </div>

          {/* Summary */}
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={lb}>Summary</label>
            <RichEditor value={draft.summary} onChange={v => set('summary', v)} minHeight={120} maxHeight={240}/>
          </div>

          {/* Goals questionnaire */}
          <div style={{ background: '#f4f2ec', border: '1px solid #e0ddd8', borderRadius: 4, padding: '1rem 1.2rem', marginBottom: '1.2rem' }}>
            <div style={{ fontFamily: "'IM Fell English',serif", fontSize: '0.95rem', color: '#555', marginBottom: '1rem', fontStyle: 'italic' }}>Character Goals</div>
            <GoalSection label='What does your character want by level 3?' field='goal3'/>
            <GoalSection label='What does your character want by level 5?' field='goal5'/>
            <GoalSection label='What does your character want by level 10?' field='goal10'/>
          </div>

          {/* Character sheet upload */}
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={lb}>Character Sheet (PDF)</label>
            {draft.characterSheetUrl && (
              <div style={{ fontSize: '0.8rem', color: '#1b4f72', marginBottom: 6 }}>
                ✓ Sheet uploaded —{' '}
                <a href={draft.characterSheetUrl} target='_blank' rel='noopener noreferrer' style={{ color: '#1b4f72' }}>view</a>
                {' · '}
                <button onClick={() => set('characterSheetUrl', '')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b44', fontSize: '0.8rem', padding: 0, fontFamily: "'Source Serif 4',Georgia,serif" }}>remove</button>
              </div>
            )}
            <input ref={fileRef} type='file' accept='.pdf' style={{ display: 'none' }}
              onChange={e => uploadPdf(e.target.files?.[0])}/>
            <button onClick={() => fileRef.current?.click()} style={btnSecondary} disabled={uploadProgress !== null}>
              {uploadProgress !== null ? `Uploading… ${uploadProgress}%` : (draft.characterSheetUrl ? 'Replace PDF' : '↑ Upload PDF')}
            </button>
            {uploadProgress !== null && (
              <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: '#e0ddd8', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: uploadProgress + '%', background: '#1b4f72', transition: 'width 0.2s' }}/>
              </div>
            )}
          </div>

          {/* GM-only section */}
          {admin && (
            <div style={{ background: '#fff5f5', border: '1px solid #f0c8c8', borderRadius: 4, padding: '1rem 1.2rem', marginBottom: '1.2rem' }}>
              <div style={{ fontFamily: "'IM Fell English',serif", fontSize: '0.95rem', color: '#8a0000', marginBottom: '0.8rem' }}>🔒 GM Secret Section</div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ ...lb, color: '#8a0000' }}>Secret content (hidden from players)</label>
                <RichEditor value={draft.secret} onChange={v => set('secret', v)} minHeight={120} maxHeight={280}/>
              </div>
              <div>
                <label style={{ ...lb, color: '#8a0000' }}>
                  {draft.secretPasswordHash ? 'Change password (leave blank to keep current)' : 'Set password to seal this section'}
                </label>
                <input style={{ ...inp, borderColor: '#e0b0b0' }} type='text' value={secretPassword}
                  onChange={e => setSecretPassword(e.target.value)}
                  placeholder={draft.secretPasswordHash ? '(unchanged)' : 'Choose a password…'}/>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
            {!isNew && (admin || user?.uid === initial?.playerUid) && (
              <button onClick={handleDelete} style={btnDanger}>Delete Character</button>
            )}
            <button onClick={onCancel} style={btnSecondary}>Cancel</button>
            <button onClick={save} disabled={saving || !draft.name.trim()} style={{ ...btnPrimary, opacity: saving || !draft.name.trim() ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Roster page ─────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { key: 'level',    label: 'Level' },
  { key: 'name',     label: 'Name' },
  { key: 'class',    label: 'Class' },
  { key: 'ancestry', label: 'Ancestry' },
  { key: 'faction',  label: 'Faction' },
  { key: 'player',   label: 'Player' },
]

function sortChars(chars, sortBy) {
  const str = c => (c[sortBy] || c.player_name || '').toLowerCase()
  const name = c => (c.name || '').toLowerCase()
  return [...chars].sort((a, b) => {
    if (sortBy === 'level') {
      const la = parseInt(a.level) || 0
      const lb = parseInt(b.level) || 0
      if (lb !== la) return lb - la
      return name(a).localeCompare(name(b))
    }
    if (sortBy === 'player') {
      const pa = (a.player_name || a.playerName || '').toLowerCase()
      const pb = (b.player_name || b.playerName || '').toLowerCase()
      return pa.localeCompare(pb) || name(a).localeCompare(name(b))
    }
    return str(a).localeCompare(str(b)) || name(a).localeCompare(name(b))
  })
}

export default function Roster({ user, onClose }) {
  const [chars, setChars] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [editing, setEditing] = useState(null)
  const [creating, setCreating] = useState(false)
  const [unlockedIds, setUnlockedIds] = useState(new Set())
  const [sortBy, setSortBy] = useState('level')

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'characters'), snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))
      setChars(list)
      setLoaded(true)
    }, err => {
      console.error('Roster Firestore error:', err)
      setLoaded(true)
    })
    return unsub
  }, [])

  const handleUnlock = (id) => {
    if (id === null) {
      // Re-seal: remove from unlocked set
      setUnlockedIds(s => { const n = new Set(s); n.delete(viewing?.id); return n })
    } else {
      setUnlockedIds(s => new Set([...s, id]))
    }
  }

  const afterSave = (saved) => {
    setCreating(false)
    setEditing(null)
    // Re-open view with updated data
    setViewing(saved)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: '#f8f7f4', display: 'flex', flexDirection: 'column', fontFamily: "'Source Serif 4',Georgia,serif" }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #ccc9c0', padding: '0 1.5rem', height: 50, display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0, background: '#f0eeea' }}>
        <span style={{ fontFamily: "'IM Fell English',serif", fontSize: '1.1rem', color: '#1b4f72' }}>⚔ Roster</span>
        <div style={{ flex: 1 }}/>
        <button onClick={() => setCreating(true)}
          style={{ padding: '5px 14px', borderRadius: 3, border: 'none', background: '#1b4f72', color: '#fff', cursor: 'pointer', fontSize: '0.83rem', fontFamily: "'Source Serif 4',Georgia,serif" }}>
          + Create Character
        </button>
        <button onClick={onClose} style={{ padding: '5px 12px', borderRadius: 3, border: '1px solid #ccc9c0', background: '#f8f7f4', cursor: 'pointer', fontSize: '0.8rem', fontFamily: "'Source Serif 4',Georgia,serif", color: '#555' }}>
          ← Back to Wiki
        </button>
      </div>

      {/* Sort bar */}
      <div style={{ borderBottom: '1px solid #e8e5e0', padding: '0 1.5rem', height: 38, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, background: '#f8f7f4' }}>
        <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#aaa', marginRight: 4 }}>Sort</span>
        {SORT_OPTIONS.map(opt => (
          <button key={opt.key} onClick={() => setSortBy(opt.key)}
            style={{ padding: '3px 10px', borderRadius: 12, border: `1px solid ${sortBy === opt.key ? '#1b4f72' : '#ccc9c0'}`,
              background: sortBy === opt.key ? '#1b4f72' : 'none',
              color: sortBy === opt.key ? '#fff' : '#666',
              cursor: 'pointer', fontSize: '0.74rem', fontFamily: "'Source Serif 4',Georgia,serif",
              transition: 'background 0.15s, color 0.15s' }}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
        {!loaded && <div style={{ color: '#aaa', fontStyle: 'italic' }}>Loading…</div>}
        {loaded && chars.length === 0 && (
          <div style={{ color: '#aaa', fontStyle: 'italic', textAlign: 'center', marginTop: '3rem' }}>
            No characters yet. {user ? 'Create one above.' : 'Sign in to add your character.'}
          </div>
        )}
        {loaded && chars.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.2rem', maxWidth: 1100 }}>
            {sortChars(chars, sortBy).map(char => (
              <CharacterCard key={char.id} char={char} onClick={() => setViewing(char)}/>
            ))}
          </div>
        )}
      </div>

      {/* Character view modal */}
      {viewing && !editing && !creating && (
        <CharacterView
          char={chars.find(c => c.id === viewing.id) || viewing}
          user={user}
          unlocked={unlockedIds.has(viewing.id)}
          onRequestUnlock={handleUnlock}
          onEdit={() => setEditing(chars.find(c => c.id === viewing.id) || viewing)}
          onClose={() => setViewing(null)}/>
      )}

      {/* Edit / create form */}
      {(editing || creating) && (
        <CharacterEditForm
          initial={editing || null}
          user={user}
          onSave={afterSave}
          onDelete={() => { setEditing(null); setViewing(null) }}
          onCancel={() => { setEditing(null); setCreating(false) }}/>
      )}
    </div>
  )
}
