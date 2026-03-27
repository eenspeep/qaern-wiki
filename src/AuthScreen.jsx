import { useState, useEffect } from 'react'
import { useAuth } from './AuthContext'

function useIsMobile(bp = 680) {
  const [m, setM] = useState(() => window.innerWidth < bp)
  useEffect(() => {
    const h = () => setM(window.innerWidth < bp)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [bp])
  return m
}

export default function AuthScreen() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isMobile = useIsMobile()

  const submit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        if (!displayName.trim()) { setError('Display name is required.'); setLoading(false); return }
        if (password !== confirmPassword) { setError('Passwords do not match.'); setLoading(false); return }
        await register(email, password, displayName.trim())
      }
    } catch (err) {
      setError(friendlyError(err.code))
    }
    setLoading(false)
  }

  const friendlyError = code => ({
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/email-already-in-use': 'An account with that email already exists.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/invalid-credential': 'Incorrect email or password.',
  }[code] || 'Something went wrong. Please try again.')

  const inp = {
    width: '100%', padding: '9px 12px', border: '1px solid #ccc9c0',
    borderRadius: 4, fontSize: '0.92rem', fontFamily: "'Source Serif 4', Georgia, serif",
    background: '#faf9f6', color: '#222', marginBottom: 10, boxSizing: 'border-box',
  }

  const planetSize = isMobile ? 220 : 300

  // Seeded LCG starfield — same parameters as WikiApp landing
  const stars = []
  let s = 42
  const rnd = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }
  for (let i = 0; i < 220; i++) {
    const x = rnd() * 100, y = rnd() * 100
    const r = rnd() < 0.08 ? 1.5 : rnd() < 0.3 ? 1 : 0.55
    const op = 0.25 + rnd() * 0.7
    stars.push(<circle key={i} cx={x + '%'} cy={y + '%'} r={r} fill='#fff' opacity={op} />)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000', overflowY: 'auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      fontFamily: "'Source Serif 4', Georgia, serif",
    }}>
      {/* Starfield */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <svg width='100%' height='100%' style={{ position: 'absolute', inset: 0 }}>
          {stars}
        </svg>
      </div>

      {/* Planet + moons */}
      <div style={{
        position: 'relative', width: planetSize, height: planetSize,
        margin: isMobile ? '2rem auto 0.5rem' : '3rem auto 1rem',
        flexShrink: 0, zIndex: 1,
      }}>
        <div style={{ position: 'absolute', inset: 0, animation: 'orbit1 8s linear infinite', transformOrigin: '50% 50%' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: `translate(-50%,-50%) translateX(${isMobile ? 124 : 168}px)` }}>
            <div style={{ width: isMobile ? 10 : 14, height: isMobile ? 10 : 14, borderRadius: '50%', background: '#c8b87a', boxShadow: '0 0 8px rgba(200,184,122,0.5)' }} />
          </div>
        </div>
        <div style={{ position: 'absolute', inset: 0, animation: 'orbit2 18s linear infinite', transformOrigin: '50% 50%' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: `translate(-50%,-50%) translateX(${isMobile ? 142 : 192}px)` }}>
            <div style={{ width: isMobile ? 6 : 9, height: isMobile ? 6 : 9, borderRadius: '50%', background: '#8899aa', boxShadow: '0 0 6px rgba(136,153,170,0.4)' }} />
          </div>
        </div>
        <div style={{ position: 'absolute', inset: 0, animation: 'orbit3 12s linear infinite reverse', transformOrigin: '50% 50%' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: `translate(-50%,-50%) translateX(${isMobile ? 108 : 146}px) translateY(${isMobile ? 16 : 22}px)` }}>
            <div style={{ width: isMobile ? 4 : 6, height: isMobile ? 4 : 6, borderRadius: '50%', background: '#cc9966', boxShadow: '0 0 5px rgba(204,153,102,0.4)' }} />
          </div>
        </div>
        <img src='/qaern-planet.png' alt='Qærn'
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain',
            filter: 'drop-shadow(0 0 32px rgba(80,180,80,0.25))',
            animation: 'slowspin 120s linear infinite',
          }} />
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', zIndex: 1, padding: '0 1rem', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: "'IM Fell English', serif", fontSize: isMobile ? '2.6rem' : '3.2rem', color: '#d4eed4', lineHeight: 1, marginBottom: '0.3rem', textShadow: '0 0 30px rgba(80,200,80,0.3)' }}>Qærn</div>
        <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#4a7a4a', marginBottom: '1rem' }}>The Living Wiki</div>
        <p style={{ fontFamily: "'IM Fell English', serif", fontSize: '0.9rem', color: '#556655', lineHeight: 1.8, fontStyle: 'italic', margin: '0 auto', maxWidth: 360 }}>
          "Three stars. Dig to crack the heart. Peace above all else."
        </p>
      </div>

      {/* Auth card */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: '#fff', border: '1px solid #ccc9c0', borderRadius: 6,
        padding: '2rem 2rem', width: '100%', maxWidth: 380,
        boxShadow: '0 2px 24px rgba(0,0,0,0.4)',
        margin: '0 1rem 3rem',
      }}>
        <div style={{ display: 'flex', marginBottom: '1.4rem', borderBottom: '1px solid #e8e5e0' }}>
          {['login', 'register'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setConfirmPassword('') }}
              style={{
                flex: 1, padding: '7px 0', border: 'none', background: 'none', cursor: 'pointer',
                fontFamily: "'Source Serif 4', Georgia, serif", fontSize: '0.88rem',
                color: mode === m ? '#1b4f72' : '#999',
                borderBottom: mode === m ? '2px solid #1b4f72' : '2px solid transparent',
                fontWeight: mode === m ? 600 : 400,
                marginBottom: -1,
              }}>
              {m === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          {mode === 'register' && (
            <>
              <label style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', display: 'block', marginBottom: 3 }}>Display Name</label>
              <input style={inp} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Ser Aldric" autoFocus />
            </>
          )}
          <label style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', display: 'block', marginBottom: 3 }}>Email</label>
          <input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" autoFocus={mode === 'login'} />
          <label style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', display: 'block', marginBottom: 3 }}>Password</label>
          <input style={inp} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          {mode === 'register' && (
            <>
              <label style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#888', display: 'block', marginBottom: 3 }}>Confirm Password</label>
              <input style={inp} type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" />
            </>
          )}

          {error && (
            <div style={{ background: '#fff5f5', border: '1px solid #f5c6cb', borderRadius: 4, padding: '8px 12px', fontSize: '0.84rem', color: '#b44', marginBottom: 10 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{
              width: '100%', padding: '10px', border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer',
              background: '#1b4f72', color: '#fff', fontFamily: "'Source Serif 4', Georgia, serif",
              fontSize: '0.92rem', fontWeight: 600, marginTop: 4, opacity: loading ? 0.7 : 1,
            }}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
