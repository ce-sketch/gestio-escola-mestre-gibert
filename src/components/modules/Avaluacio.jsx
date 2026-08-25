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
import { auth } from '../../firebase'
import { esAdmin } from '../../lib/roles'
import TEE from './avaluacio/TEE.jsx'
import Lectura from './avaluacio/Lectura.jsx'
import Matematiques from './avaluacio/Matematiques.jsx'
import NotaArea from './avaluacio/NotaArea.jsx'
import LectoescripturaEI from './avaluacio/LectoescripturaEI.jsx'
import NotesGenerals from './avaluacio/NotesGenerals.jsx'
import ResumPerArea from './avaluacio/ResumPerArea.jsx'
import AreesNoSuperades from './avaluacio/AreesNoSuperades.jsx'
import Descarregues from './avaluacio/Descarregues.jsx'
import InformeAlumne from './avaluacio/InformeAlumne.jsx'
import Resum from './avaluacio/Resum.jsx'
import ResumConmat from './avaluacio/ResumConmat.jsx'
import Historic from './avaluacio/Historic.jsx'
import HistoricInnovamat from './avaluacio/HistoricInnovamat.jsx'

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
      { id: 'lectoescriptura-ei', label: 'Lectoescriptura EI', component: LectoescripturaEI },
    ],
  },
  {
    id: 'resultats',
    titol: 'Resums i informes',
    pestanyes: [
      { id: 'informe', label: 'Informe per alumne', component: InformeAlumne },
      { id: 'resum', label: 'Resums de proves (TEE i VL/CL)', component: Resum },
      // Abans era la pestanya "Resum escola" dins de "Notes per àrea".
      // Les ConMat d'aquest curs, classe per classe. L'evolució al llarg
      // dels anys va a la pestanya "Històric (Innovamat)".
      { id: 'resum-conmat', label: 'Resum ConMat', subLabel: '(Innovamat)', component: ResumConmat },
      { id: 'resum-area', label: 'Resum per àrea', component: ResumPerArea },
      // Separat del "Resum per àrea": són dues coses diferents.
      { id: 'arees-no-superades', label: 'Àrees no superades', component: AreesNoSuperades },
      // El "lloc per imprimir": tot Notes per àrea en un sol Excel/PDF.
      { id: 'descarregues', label: 'Descàrregues', component: Descarregues },
    ],
  },
  {
    // Grup propi, sota de "Descàrregues": l'històric no és el resultat
    // d'aquest curs sinó l'evolució del centre al llarg dels anys, i
    // barrejar-lo amb els resums del curs en marxa despistava.
    id: 'historic',
    titol: 'Històric',
    pestanyes: [
      { id: 'historic', label: 'Històric', subLabel: '(TEE, VL i CL)', component: Historic, nomesAdmin: true },
      { id: 'historic-innovamat', label: 'Històric', subLabel: '(Innovamat)', component: HistoricInnovamat, nomesAdmin: true },
    ],
  },
]

export default function Avaluacio() {
  const [actiu, setActiu] = useState('tee')

  // Hi ha pestanyes restringides a direcció (l'Històric). Es filtren aquí
  // perquè no apareguin ni al menú ni es puguin obrir; el component
  // també ho torna a comprovar pel seu compte.
  const admin = esAdmin(auth.currentUser)
  const grupsVisibles = GRUPS
    .map((g) => ({ ...g, pestanyes: g.pestanyes.filter((p) => !p.nomesAdmin || admin) }))
    .filter((g) => g.pestanyes.length > 0)
  const totes = grupsVisibles.flatMap((g) => g.pestanyes)
  const Actiu = totes.find((p) => p.id === actiu)?.component ?? TEE

  return (
    <div className="module" style={{ maxWidth: 1100 }}>
      <h2>Avaluació</h2>

      <div style={{ marginTop: 20, borderBottom: '1px solid var(--line)', paddingBottom: 4 }}>
        {grupsVisibles.map((g, i) => (
          <div key={g.id} style={{ marginTop: i === 0 ? 0 : 14 }}>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
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
                    lineHeight: 1.3,
                    textAlign: 'left',
                  }}
                >
                  {p.label}
                  {p.subLabel && (
                    <span style={{ display: 'block', fontSize: 11, fontWeight: 400 }}>
                      {p.subLabel}
                    </span>
                  )}
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
