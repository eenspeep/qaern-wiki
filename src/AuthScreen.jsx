import { useState } from 'react'
import { useAuth } from './AuthContext'

export default function AuthScreen() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        if (!displayName.trim()) { setError('Display name is required.'); setLoading(false); return }
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

  return (
    <div style={{
      minHeight: '100vh', background: '#f4f2ee',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Source Serif 4', Georgia, serif",
    }}>
      <div style={{
        background: '#fff', border: '1px solid #ccc9c0', borderRadius: 6,
        padding: '2.5rem 2rem', width: '100%', maxWidth: 380, boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1.8rem' }}>
          <div style={{ fontFamily: "'IM Fell English', Georgia, serif", fontSize: '2rem', color: '#1b4f72', letterSpacing: '-0.01em' }}>Qærn</div>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888', marginTop: 2 }}>The Living Wiki</div>
        </div>

        <div style={{ display: 'flex', marginBottom: '1.4rem', borderBottom: '1px solid #e8e5e0' }}>
          {['login','register'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError('') }}
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
