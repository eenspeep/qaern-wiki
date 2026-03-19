import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u ?? null))
    return unsub
  }, [])

  const register = async (email, password, displayName) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName })
    return cred.user
  }

  const login = (email, password) =>
    signInWithEmailAndPassword(auth, email, password)

  const logout = () => signOut(auth)

  const updateUser = async ({ displayName, color }) => {
    const updates = {}
    if (displayName) updates.displayName = displayName
    await updateProfile(auth.currentUser, updates)
    // Store color (and name) in Firestore
    await setDoc(doc(db, 'users', auth.currentUser.uid), {
      displayName: displayName || auth.currentUser.displayName,
      color: color || null,
    }, { merge: true })
  }

  const getUserColor = async (uid) => {
    const snap = await getDoc(doc(db, 'users', uid))
    return snap.exists() ? snap.data().color : null
  }

  return (
    <AuthContext.Provider value={{ user, register, login, logout, updateUser, getUserColor }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
