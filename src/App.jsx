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
  const [debugInfo, setDebugInfo] = useState('')

  useEffect(() => {
    // En tornar d'una redirecció d'inici de sessió amb Google, comprova si
    // hi ha hagut algun error (per exemple, domini no permès).
    //
    // NOTA TEMPORAL DE DIAGNÒSTIC: mentre acabem de resoldre l'error
    // intermitent del login, deixem un rastre visible a la pantalla (no
    // només a la consola) de què ha passat exactament amb aquesta
    // redirecció, perquè es pugui veure amb una simple captura de pantalla
    // sense haver d'obrir cap eina de desenvolupador. Es pot treure un cop
    // confirmat que tot funciona bé.
    getRedirectResult(auth)
      .then((result) => {
        setDebugInfo((prev) =>
          `${prev}redirectResult: ${result ? `usuari trobat (${result.user?.email ?? 'sense email'})` : 'buit (cap redirecció pendent)'}`
        )
      })
      .catch((err) => {
        console.error('Error en getRedirectResult:', err.code, err.message)
        setErrorRedirect(err.code === 'auth/popup-closed-by-user' ? null : err.message)
        setDebugInfo((prev) => `${prev}redirectResult ERROR: ${err.code} — ${err.message}`)
      })

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && !esComptePersonal(firebaseUser)) {
        // Sessió d'un compte no vàlid (d'alumnat, o d'un altre domini) que
        // s'hagi quedat oberta d'abans — la tanquem directament.
        setDebugInfo((prev) => `${prev} | onAuthStateChanged: usuari ${firebaseUser.email} REBUTJAT per esComptePersonal()`)
        signOut(auth)
        setUser(null)
      } else {
        setDebugInfo((prev) => `${prev} | onAuthStateChanged: ${firebaseUser ? `usuari ${firebaseUser.email} acceptat` : 'sense usuari'}`)
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
    return <Login errorExtern={errorRedirect} debugInfo={debugInfo} />
  }

  return <Dashboard user={user} onSignOut={() => signOut(auth)} />
}
