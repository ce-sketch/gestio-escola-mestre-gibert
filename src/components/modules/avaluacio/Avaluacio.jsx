import { useState } from 'react'
import TEE from './avaluacio/TEE.jsx'
import Lectura from './avaluacio/Lectura.jsx'
import Matematiques from './avaluacio/Matematiques.jsx'
import NotaArea from './avaluacio/NotaArea.jsx'
import NotesGenerals from './avaluacio/NotesGenerals.jsx'
import InformeCatala from './avaluacio/InformeCatala.jsx'
import Resum from './avaluacio/Resum.jsx'

const PESTANYES = [
  { id: 'tee', label: 'TEE (Text Escrit)', component: TEE },
  { id: 'lectura', label: 'Lectura (VL/CL)', component: Lectura },
  { id: 'matematiques', label: 'Matemàtiques', component: Matematiques },
  { id: 'area', label: 'Nota d\'àrea (Català)', component: NotaArea },
  { id: 'notes-generals', label: 'Notes per àrea (totes)', component: NotesGenerals },
  { id: 'informe', label: 'Informe per alumne', component: InformeCatala },
  { id: 'resum', label: 'Resums', component: Resum },
]

export default function Avaluacio() {
  const [actiu, setActiu] = useState('tee')
  const Actiu = PESTANYES.find((p) => p.id === actiu)?.component ?? TEE

  return (
    <div className="module" style={{ maxWidth: 1100 }}>
      <p className="module-eyebrow">Llengua catalana</p>
      <h2>Avaluació</h2>

      <div style={{ display: 'flex', gap: 8, marginTop: 20, borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
        {PESTANYES.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiu(p.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: actiu === p.id ? '2px solid var(--navy)' : '2px solid transparent',
              padding: '10px 4px',
              marginRight: 16,
              fontWeight: actiu === p.id ? 600 : 500,
              color: actiu === p.id ? 'var(--navy)' : 'var(--ink-soft)',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <Actiu />
      </div>
    </div>
  )
}
