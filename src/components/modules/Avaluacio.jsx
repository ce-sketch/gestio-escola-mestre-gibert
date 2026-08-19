// Contenidor del mòdul d'Avaluació.
//
// Les pestanyes van en DOS GRUPS perquè fan feines diferents: unes són per
// introduir dades (i les fa servir el professorat durant el curs), i les
// altres per llegir-ne el resultat (i les fa servir sobretot direcció).
// Abans anaven totes set de seguides i costava saber on era cada cosa.
//
// El mòdul cobreix totes les àrees, no només llengua catalana: el subtítol
// "Llengua catalana" que hi havia venia de quan només hi havia el TEE.

import { useState } from 'react'
import TEE from './avaluacio/TEE.jsx'
import Lectura from './avaluacio/Lectura.jsx'
import Matematiques from './avaluacio/Matematiques.jsx'
import NotaArea from './avaluacio/NotaArea.jsx'
import NotesGenerals from './avaluacio/NotesGenerals.jsx'
import InformeCatala from './avaluacio/InformeCatala.jsx'
import Resum from './avaluacio/Resum.jsx'

const GRUPS = [
  {
    id: 'entrada',
    titol: 'Entrada de dades',
    pestanyes: [
      { id: 'tee', label: 'TEE (Text Escrit)', component: TEE },
      { id: 'lectura', label: 'Lectura (VL/CL)', component: Lectura },
      { id: 'matematiques', label: 'Matemàtiques', component: Matematiques },
      { id: 'notes-generals', label: 'Notes per àrea', component: NotesGenerals },
      // Va a part de "Notes per àrea" a posta: és la graella de Català amb
      // els seus criteris propis, no una àrea més de la graella general.
      { id: 'area', label: 'Graella de Català', component: NotaArea },
    ],
  },
  {
    id: 'resultats',
    titol: 'Resums i informes',
    pestanyes: [
      { id: 'informe', label: 'Informe per alumne', component: InformeCatala },
      { id: 'resum', label: 'Resums de proves (TEE i VL/CL)', component: Resum },
    ],
  },
]

const TOTES = GRUPS.flatMap((g) => g.pestanyes)

export default function Avaluacio() {
  const [actiu, setActiu] = useState('tee')
  const Actiu = TOTES.find((p) => p.id === actiu)?.component ?? TEE

  return (
    <div className="module" style={{ maxWidth: 1100 }}>
      <h2>Avaluació</h2>

      <div style={{ marginTop: 20, borderBottom: '1px solid var(--line)', paddingBottom: 4 }}>
        {GRUPS.map((g) => (
          <div key={g.id} style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginTop: g.id === 'entrada' ? 0 : 10 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 130 }}>
              {g.titol}
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {g.pestanyes.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActiu(p.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: actiu === p.id ? '2px solid var(--navy)' : '2px solid transparent',
                    padding: '8px 4px',
                    marginRight: 12,
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
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <Actiu />
      </div>
    </div>
  )
}
