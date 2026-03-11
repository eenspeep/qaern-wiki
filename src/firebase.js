import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey:            "AIzaSyDMDkA71sleJdKPw8n3bPRlftVtpaPkhcU",
  authDomain:        "qaern-wiki.firebaseapp.com",
  databaseURL:       "https://qaern-wiki-default-rtdb.firebaseio.com",
  projectId:         "qaern-wiki",
  storageBucket:     "qaern-wiki.firebasestorage.app",
  messagingSenderId: "88118593985",
  appId:             "1:88118593985:web:960c0581e8640c09da4740",
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db   = getFirestore(app)   // articles, changelog
export const rtdb = getDatabase(app)    // presence (who's online/editing)
