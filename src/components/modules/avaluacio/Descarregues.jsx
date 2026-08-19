// "Descàrregues" — un únic lloc per baixar-ho tot de cop: les notes de
// totes les classes, el resum global per àrea (els quatre moments) i les
// àrees no superades, en un sol Excel (un full per bloc) o un sol PDF.
//
// Abans això vivia escampat: "totes les classes" era un botó dins de
// l'entrada de notes (una pantalla d'introduir dades, no de generar
// informes), i el resum global i les àrees no superades cadascun amb el
// seu propi botó a la seva pestanya. Aquesta pestanya no substitueix
// aquells botons — hi continuen sent, per baixar només un bloc concret —
// és el lloc per quan es vol tot alhora.
//
// Nota d'abast: només inclou "Notes per àrea" (notes, resum global, àrees
// no superades). Els resums de TEE i VL/CL tenen el seu propi botó a la
// pestanya "Resums de proves", perquè vénen d'una font de dades diferent.

import { useMemo, useState } from 'react'
import { nivellDe, redueixVigents } from '../../../lib/avaluacioCatala'
import { AREES, TRIMESTRES, areaAplicaAClasse, notaFinalArea } from '../../../lib/notesArea'
import { cursEscolarActual } from '../../../lib/cursEscolar'
import { grauPrimaria } from '../../../lib/rubricaLectura'
import { exportaExcel, exportaPDF } from '../../../lib/exportTaula'
import { useNotesAreaDades } from './useNotesAreaDades'

const NIVELLS_RESUM = [
  { id: 'no_assoliment', label: 'No Assoliment' },
  { id: 'assoliment_satisfactori', label: 'Assoliment Satisfactòri' },
  { id: 'assoliment_notable', label: 'Assoliment Notable' },
  { id: "assoliment_excel·lent", label: "Assoliment Excel·lent" },
]
const MOMENTS_RESUM = [...TRIMESTRES, 'Final']

export default function Descarregues() {
  const { alumnesTots, registres, carregant, missatge } = useNotesAreaDades()
  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [generant, setGenerant] = useState(null) // 'excel' | 'pdf' | null

  const vigentsTotes = useMemo(
    () => redueixVigents(
      registres.filter((r) => (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId),
      (r) => `${r.alumneId}__${r.area}__${r.trimestre}`
    ),
    [registres, cursEscolarId]
  )

  function notaAlumneTrimestreDe(classeAlumne, alumneId, areaId, trim) {
    const existent = vigentsTotes.find((r) => r.curs === classeAlumne && r.alumneId === alumneId && r.area === areaId && r.trimestre === trim)
    return existent?.nota ?? ''
  }

  function notaFinalAlumneAreaDe(classeAlumne, alumneId, areaId) {
    return notaFinalArea(TRIMESTRES.map((t) => notaAlumneTrimestreDe(classeAlumne, alumneId, areaId, t)))
  }

  const totesLesClasses = useMemo(
    () => [...new Set(alumnesTots.map((a) => a.curs))].filter((c) => grauPrimaria(c) !== null).sort(),
    [alumnesTots]
  )

  if (carregant) return <p>Carregant…</p>

  /** Un full per classe amb les notes tal com surten a "Entrada de notes"
   *  (1r/2n/3r/Final per àrea) — el que abans era el botó "totes les
   *  classes" de dins de l'entrada. */
  function taulaTotesLesClassesExportable() {
    return totesLesClasses.map((cl) => {
      const areesCl = AREES.filter((a) => areaAplicaAClasse(a.id, cl))
      const alumnesCl = alumnesTots.filter((a) => a.curs === cl)
      const capçalera = ['Núm.', 'Alumne', ...areesCl.flatMap((a) => [`${a.label} 1r`, `${a.label} 2n`, `${a.label} 3r`, `${a.label} Final`])]
      const files = alumnesCl.map((alumne) => [
        alumne.numLlista ?? '',
        alumne.nom,
        ...areesCl.flatMap((a) => [
          ...TRIMESTRES.map((t) => (a.calculada ? '' : notaAlumneTrimestreDe(cl, alumne.id, a.id, t))),
          (a.calculada
            ? notaFinalArea(a.deArees.map((id) => notaFinalAlumneAreaDe(cl, alumne.id, id)))
            : notaFinalAlumneAreaDe(cl, alumne.id, a.id)) ?? '',
        ]),
      ])
      return { nom: `Notes ${cl}`, files: [capçalera, ...files] }
    })
  }

  /** Un full per àrea amb el resum global, els quatre moments junts —
   *  el mateix que "Resum per àrea" amb l'agrupació per classe i el
   *  selector de moment a "Totes". */
  function taulesResumGlobalExportables() {
    return AREES.filter((a) => !a.calculada).map((a) => {
      const files = totesLesClasses.map((cl) => {
        const perMoment = Object.fromEntries(MOMENTS_RESUM.map((m) => {
          const comptes = Object.fromEntries(NIVELLS_RESUM.map((n) => [n.id, 0]))
          let avaluats = 0
          if (m === 'Final') {
            for (const alumne of alumnesTots) {
              if (alumne.curs !== cl) continue
              const final = notaFinalAlumneAreaDe(cl, alumne.id, a.id)
              if (final === null) continue
              const nivell = nivellDe(final)
              if (nivell) comptes[nivell.id] += 1
              avaluats += 1
            }
          } else {
            const notes = vigentsTotes.filter((r) => r.area === a.id && r.trimestre === m && r.curs === cl)
            for (const r of notes) {
              const nivell = nivellDe(r.nota)
              if (nivell) comptes[nivell.id] += 1
            }
            avaluats = notes.length
          }
          return [m, { comptes, avaluats }]
        }))
        return { etiqueta: cl, perMoment }
      })
      const total = Object.fromEntries(MOMENTS_RESUM.map((m) => [m, { comptes: Object.fromEntries(NIVELLS_RESUM.map((n) => [n.id, 0])), avaluats: 0 }]))
      files.forEach((f) => {
        for (const m of MOMENTS_RESUM) {
          for (const n of NIVELLS_RESUM) total[m].comptes[n.id] += f.perMoment[m].comptes[n.id]
          total[m].avaluats += f.perMoment[m].avaluats
        }
      })

      const capçaleraSup = ['', ...MOMENTS_RESUM.flatMap((m) => [m, '', '', '', ''])]
      const capçaleraInf = ['Classe', ...MOMENTS_RESUM.flatMap(() => [...NIVELLS_RESUM.map((n) => n.label), 'Avaluats'])]
      return {
        nom: `Resum ${a.label}`,
        files: [
          capçaleraSup,
          capçaleraInf,
          ...files.map((f) => [f.etiqueta, ...MOMENTS_RESUM.flatMap((m) => [...NIVELLS_RESUM.map((n) => f.perMoment[m].comptes[n.id]), f.perMoment[m].avaluats])]),
          ['TOTAL', ...MOMENTS_RESUM.flatMap((m) => [...NIVELLS_RESUM.map((n) => total[m].comptes[n.id]), total[m].avaluats])],
        ],
      }
    }).filter((full) => full.files.slice(2, -1).some((fila) => fila.slice(1).some((v) => Number(v) > 0)))
  }

  /** El full "Àrees no superades", igual que la seva pestanya pròpia. */
  function taulaAreesNoSuperadesExportable() {
    const areesNoCalculades = AREES.filter((a) => !a.calculada)
    const files = totesLesClasses.map((cl) => {
      const alumnesCl = alumnesTots.filter((a) => a.curs === cl)
      const comptes = {}
      for (const a of areesNoCalculades) {
        comptes[a.id] = alumnesCl.filter((alumne) => {
          const final = notaFinalAlumneAreaDe(cl, alumne.id, a.id)
          return final !== null && nivellDe(final)?.id === 'no_assoliment'
        }).length
      }
      return { classe: cl, comptes, totalAlumnes: alumnesCl.length }
    })
    const total = { comptes: {}, totalAlumnes: 0 }
    for (const a of areesNoCalculades) total.comptes[a.id] = 0
    files.forEach((f) => {
      for (const a of areesNoCalculades) total.comptes[a.id] += f.comptes[a.id]
      total.totalAlumnes += f.totalAlumnes
    })
    return [{
      nom: 'Àrees no superades',
      files: [
        ['Classe', ...areesNoCalculades.map((a) => a.label), 'Total alumnes'],
        ...files.map((f) => [f.classe, ...areesNoCalculades.map((a) => f.comptes[a.id]), f.totalAlumnes]),
        ['TOTAL', ...areesNoCalculades.map((a) => total.comptes[a.id]), total.totalAlumnes],
      ],
    }]
  }

  function totsElsFulls() {
    return [
      ...taulaTotesLesClassesExportable(),
      ...taulesResumGlobalExportables(),
      ...taulaAreesNoSuperadesExportable(),
    ]
  }

  async function descarrega(quin, fes) {
    setGenerant(quin)
    try {
      await fes()
    } catch (err) {
      alert(`No s'ha pogut generar la descàrrega: ${err.message}`)
    } finally {
      setGenerant(null)
    }
  }

  return (
    <div>
      <p className="module-lead">
        Tot el que hi ha a &quot;Notes per àrea&quot; en un sol lloc: les notes de totes les
        classes, el resum global per àrea i les àrees no superades. Cada pestanya té també el
        seu propi botó, per baixar només un bloc.
      </p>

      <label className="field" style={{ minWidth: 120, marginTop: 20 }}>
        <span>Curs escolar</span>
        <input
          type="text"
          value={cursEscolarId}
          onChange={(e) => setCursEscolarId(e.target.value)}
          style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', fontWeight: 600 }}
        />
      </label>

      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <button
          className="btn-primary"
          style={{ maxWidth: 280 }}
          onClick={() => descarrega('excel', () => exportaExcel(`Avaluacio-complet-${cursEscolarId}`, { cursEscolarId, fulls: totsElsFulls(), etiqueta: 'Avaluació' }))}
          disabled={generant !== null}
          type="button"
        >
          {generant === 'excel' ? 'Generant…' : '📥 Descarrega-ho tot en Excel'}
        </button>
        <button
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)', maxWidth: 280 }}
          onClick={() => descarrega('pdf', () => exportaPDF('Avaluació — resum complet', { cursEscolarId, fulls: totsElsFulls() }))}
          disabled={generant !== null}
          type="button"
        >
          {generant === 'pdf' ? 'Generant…' : '📄 Descarrega-ho tot en PDF'}
        </button>
      </div>

      <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 16 }}>
        Inclou: un full per classe amb les seves notes, un full per àrea amb el resum global dels
        quatre moments, i el full d&apos;àrees no superades. No inclou els resums de TEE ni de
        VL/CL — aquests tenen el seu propi botó a &quot;Resums de proves&quot;.
      </p>

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--red)' }}>
          {missatge.text}
        </p>
      )}
    </div>
  )
}
