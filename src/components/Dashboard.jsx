import { useState, lazy, Suspense } from 'react'
import { esAdmin } from '../lib/roles'

const Inici = lazy(() => import('./modules/Inici.jsx'))
const Alumnes = lazy(() => import('./modules/Alumnes.jsx'))
const Calendari = lazy(() => import('./modules/Calendari.jsx'))
const Avaluacio = lazy(() => import('./modules/Avaluacio.jsx'))
const Assistencia = lazy(() => import('./modules/Assistencia.jsx'))
const Absentisme = lazy(() => import('./modules/Absentisme.jsx'))
const Documentacio = lazy(() => import('./modules/Documentacio.jsx'))
const Backup = lazy(() => import('./modules/Backup.jsx'))
const Economia = lazy(() => import('./modules/Economia.jsx'))

const MODULES = [
  { id: 'inici', label: 'Inici', component: Inici },
  { id: 'alumnes', label: 'Alumnes', component: Alumnes, nomesAdmin: true },
  { id: 'calendari', label: 'Calendari', component: Calendari, nomesAdmin: true },
  { id: 'avaluacio', label: 'Avaluació', component: Avaluacio },
  { id: 'assistencia', label: 'Assistència', component: Assistencia },
  { id: 'absentisme', label: 'Absentisme', component: Absentisme },
  { id: 'documentacio', label: 'Documentació', component: Documentacio },
  { id: 'economia', label: 'Economia', component: Economia, nomesAdmin: true },
  { id: 'backup', label: 'Backup', component: Backup, nomesAdmin: true },
]

export default function Dashboard({ user, onSignOut }) {
  const [activeId, setActiveId] = useState('inici')
  const [navOpen, setNavOpen] = useState(false)
  const admin = esAdmin(user)
  const modulsVisibles = MODULES.filter((m) => !m.nomesAdmin || admin)

  const ActiveModule = modulsVisibles.find((m) => m.id === activeId)?.component ?? Inici

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="nav-toggle"
          aria-label="Obre el menú"
          onClick={() => setNavOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        <p className="topbar-title">Escola Mestre Enric Gibert i Camins</p>
        <div className="topbar-user">
          <span className="user-email">{user.email}</span>
          <button className="btn-ghost" onClick={onSignOut}>Surt</button>
        </div>
      </header>

      <div className="app-body">
        <nav className={`sidebar ${navOpen ? 'sidebar-open' : ''}`}>
          {modulsVisibles.map((m) => (
            <button
              key={m.id}
              className={`nav-item ${activeId === m.id ? 'nav-item-active' : ''}`}
              onClick={() => {
                setActiveId(m.id)
                setNavOpen(false)
              }}
            >
              {m.label}
            </button>
          ))}
        </nav>

        <main className="content">
          <Suspense fallback={<div className="loader" style={{ marginTop: 40 }} />}>
            <ActiveModule />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
