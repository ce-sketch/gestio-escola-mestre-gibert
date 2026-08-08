import { useState } from 'react'
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'

export default function Login({ errorExtern, debugInfo }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [mostraEmail, setMostraEmail] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      setError(mapAuthError(err.code))
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    setError(null)
    setLoadingGoogle(true)
    // Finestra emergent en lloc de redirecció de pàgina completa. Vam
    // provar signInWithRedirect() primer (evita el bloqueig de finestres
    // emergents en alguns entorns), però depèn de guardar un "estat
    // pendent" abans de sortir cap a Google i recuperar-lo en tornar —
    // alguns navegadors (per la protecció contra seguiment entre llocs)
    // bloquegen aquest emmagatzematge, i el login queda penjat sense error
    // clar. signInWithPopup() evita aquest problema perquè mai surt de la
    // pàgina: obre una finestreta a sobre i rep el resultat directament.
    try {
      await signInWithPopup(auth, googleProvider)
      // En èxit, onAuthStateChanged (a App.jsx) ja recull l'usuari nou
      // automàticament — no cal fer res més aquí.
    } catch (err) {
      console.error('Error en signInWithPopup:', err.code, err.message)
      setError(mapAuthError(err.code))
    } finally {
      setLoadingGoogle(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 100 100" width="36" height="36">
              <rect width="100" height="100" rx="20" fill="#1E3A5F" />
              <path d="M25 30 h50 M25 45 h50 M25 60 h35" stroke="#E8A33D" strokeWidth="6" strokeLinecap="round" />
              <circle cx="72" cy="60" r="4" fill="#E8A33D" />
            </svg>
          </div>
          <div>
            <p className="eyebrow">Gestió interna</p>
            <h1>Escola Mestre Enric Gibert i Camins</h1>
          </div>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={handleGoogleSignIn}
          disabled={loadingGoogle}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#fff" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
            <path fill="#fff" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.83.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18z" />
            <path fill="#fff" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.03z" />
            <path fill="#fff" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.6 8.6 0 0 0 9 0 9 9 0 0 0 .9 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z" />
          </svg>
          {loadingGoogle ? 'Entrant…' : 'Inicia sessió amb Google'}
        </button>

        <p className="login-footnote" style={{ marginTop: 12 }}>
          Fes servir el teu compte de Google del centre (@escolamestregibert.cat).
        </p>

        {(error || errorExtern) && <p className="form-error" role="alert" style={{ marginTop: 8 }}>{error || errorExtern}</p>}

        <button
          type="button"
          onClick={() => setMostraEmail((v) => !v)}
          style={{ background: 'none', border: 'none', color: 'var(--ink-soft)', fontSize: 12, marginTop: 16, cursor: 'pointer', textDecoration: 'underline' }}
        >
          {mostraEmail ? 'Amaga l\'accés amb correu i contrasenya' : 'Prefereixo entrar amb correu i contrasenya'}
        </button>

        {mostraEmail && (
          <form onSubmit={handleSubmit} className="login-form" style={{ marginTop: 16 }}>
            <label className="field">
              <span>Correu electrònic</span>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom.cognom@escolamestregibert.cat"
              />
            </label>

            <label className="field">
              <span>Contrasenya</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>

            <button type="submit" className="btn-ghost" disabled={loading}>
              {loading ? 'Entrant…' : 'Entra'}
            </button>
          </form>
        )}

        <p className="login-footnote">
          Accés reservat al professorat i personal del centre. Si tens problemes, contacta amb secretaria.
        </p>

        {debugInfo && (
          <p style={{ marginTop: 20, fontSize: 10, color: 'var(--ink-soft)', opacity: 0.7, wordBreak: 'break-word', borderTop: '1px dashed var(--line)', paddingTop: 8 }}>
            Diagnòstic temporal: {debugInfo}
          </p>
        )}
      </div>
    </div>
  )
}

function mapAuthError(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'El correu electrònic no és vàlid.'
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return 'No hem trobat cap compte amb aquestes dades.'
    case 'auth/wrong-password':
      return 'La contrasenya no és correcta.'
    case 'auth/too-many-requests':
      return 'Massa intents. Torna-ho a provar d\'aquí una estona.'
    case 'auth/popup-blocked':
      return 'El navegador ha bloquejat la finestra d\'inici de sessió. Permet finestres emergents per a aquesta pàgina.'
    case 'auth/unauthorized-domain':
      return 'Aquest domini no està autoritzat a Firebase. Cal afegir-lo a Firebase Console → Authentication → Settings → Authorized domains.'
    case 'auth/operation-not-supported-in-this-environment':
      return 'Aquest entorn no permet iniciar sessió amb Google (sovint passa dins d\'un iframe, com l\'editor de StackBlitz). Obre la vista prèvia en una pestanya pròpia del navegador.'
    case 'auth/network-request-failed':
      return 'No s\'ha pogut connectar amb Google. Comprova la connexió a internet i torna-ho a provar.'
    default:
      console.error('Codi d\'error d\'autenticació no reconegut:', code)
      return 'No s\'ha pogut iniciar la sessió. Torna-ho a provar. (Codi: ' + (code ?? 'desconegut') + ')'
  }
}
