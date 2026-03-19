import { useEffect, useState } from 'react'
import { ref, set, onValue, onDisconnect, serverTimestamp } from 'firebase/database'
import { doc, onSnapshot } from 'firebase/firestore'
import { rtdb, db } from './firebase'

// Returns a stable color for a given uid
const COLORS = [
  '#e05c5c','#e0895c','#c8b44a','#5ca85c','#5c8ae0',
  '#8e5ce0','#c45cb4','#5cb4c4','#7ab85c','#c45c7a',
]
export function uidColor(uid) {
  let n = 0
  for (const c of uid) n += c.charCodeAt(0)
  return COLORS[n % COLORS.length]
}

// Returns initials from a display name
export function initials(name = '?') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export function usePresence(user, currentArticleId, isEditing) {
  const [online, setOnline] = useState({})
  const [customColor, setCustomColor] = useState(null)

  // Subscribe to own Firestore color
  useEffect(() => {
    if (!user?.uid) return
    const unsub = onSnapshot(doc(db, 'users', user.uid), snap => {
      setCustomColor(snap.exists() ? snap.data().color || null : null)
    })
    return unsub
  }, [user?.uid])

  useEffect(() => {
    if (!user) return

    const myRef = ref(rtdb, `presence/${user.uid}`)

    const data = {
      displayName: user.displayName || user.email,
      articleId: currentArticleId,
      editing: isEditing,
      color: customColor || uidColor(user.uid),
      lastSeen: serverTimestamp(),
    }

    set(myRef, data)
    onDisconnect(myRef).remove()

    return () => { set(myRef, null) }
  }, [user, currentArticleId, isEditing, customColor])

  useEffect(() => {
    if (!user) return
    const presenceRef = ref(rtdb, 'presence')
    const unsub = onValue(presenceRef, snap => {
      setOnline(snap.val() || {})
    })
    return unsub
  }, [user])

  return online
}
