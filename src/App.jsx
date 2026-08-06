import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, getRedirectResult } from 'firebase/auth'
import { auth } from './firebase'
import { esComptePersonal } from './lib/roles'
import Login from './components/Login.jsx'
import Dashboard from './components/Dashboard.jsx'

export default function App() {
  const [user, setUser] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [errorRedirect, setErrorRedirect] = useState(null)

  useEffect(() => {
    // En tornar d'una redirecció d'inici de sessió amb Google, comprova si
    // hi ha hagut algun error (per exemple, domini no permès).
    getRedirectResult(auth).catch((err) => {
      console.error('Error en getRedirectResult:', err.code, err.message)
      setErrorRedirect(err.code === 'auth/popup-closed-by-user' ? null : err.message)
    })

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && !esComptePersonal(firebaseUser)) {
        // Sessió d'un compte no vàlid (d'alumnat, o d'un altre domini) que
        // s'hagi quedat oberta d'abans — la tanquem directament.
        signOut(auth)
        setUser(null)
      } else {
        setUser(firebaseUser)
      }
      setCheckingSession(false)
    })
    return unsubscribe
  }, [])

  if (checkingSession) {
    return (
      <div className="screen-center">
        <div className="loader" aria-label="Carregant"></div>
      </div>
    )
  }

  if (!user) {
    return <Login errorExtern={errorRedirect} />
  }

  return <Dashboard user={user} onSignOut={() => signOut(auth)} />
}
