// "Àrees no superades" — equivalent al full "Àrees no superades" de
// l'Excel: per cada classe i cada àrea, quants alumnes tenen la nota
// Final per sota de 5. Sempre amb la Final, mai amb la d'un trimestre
// concret, com al full original.
//
// Abans vivia dins de "Resum escola" (ara "Resum per àrea"); ara és la
// seva pròpia pestanya perquè són dues coses diferents que no calia tenir
// juntes.

import { useMemo, useState } from 'react'
import { nivellDe, redueixVigents } from '../../../lib/avaluacioCatala'
import { AREES, TRIMESTRES, notaFinalArea } from '../../../lib/notesArea'
import { cursEscolarActual } from '../../../lib/cursEscolar'
import { grauPrimaria } from '../../../lib/rubricaLectura'
import { exportaExcel, exportaPDF } from '../../../lib/exportTaula'
import { useNotesAreaDades } from './useNotesAreaDades'

export default function AreesNoSuperades() {
  const { alumnesTots, registres, carregant, missatge } = useNotesAreaDades()
  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())

  const vigentsTotes = useMemo(
    () => redueixVigents(
      registres.filter((r) => (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId),
      (r) => `${r.alumneId}__${r.area}__${r.trimestre}`
    ),
    [registres, cursEscolarId]
  )

  function notaFinalAlumneAreaDe(classeAlumne, alumneId, areaId) {
    return notaFinalArea(TRIMESTRES.map((t) => {
      const existent = vigentsTotes.find((r) => r.curs === classeAlumne && r.alumneId === alumneId && r.area === areaId && r.trimestre === t)
      return existent?.nota ?? ''
    }))
  }

  const totesLesClasses = useMemo(
    () => [...new Set(alumnesTots.map((a) => a.curs))].filter((c) => grauPrimaria(c) !== null).sort(),
    [alumnesTots]
  )

  const areesNoSuperadesPerClasse = useMemo(() => {
    const areesNoCalculades = AREES.filter((a) => !a.calculada)
    const files = totesLesClasses.map((classe) => {
      const alumnesCl = alumnesTots.filter((a) => a.curs === classe)
      const comptes = {}
      for (const a of areesNoCalculades) {
        comptes[a.id] = alumnesCl.filter((alumne) => {
          const final = notaFinalAlumneAreaDe(classe, alumne.id, a.id)
          return final !== null && nivellDe(final)?.id === 'no_assoliment'
        }).length
      }
      return { classe, comptes, totalAlumnes: alumnesCl.length }
    })
    const total = { comptes: {}, totalAlumnes: 0 }
    for (const a of areesNoCalculades) total.comptes[a.id] = 0
    files.forEach((f) => {
      for (const a of areesNoCalculades) total.comptes[a.id] += f.comptes[a.id]
      total.totalAlumnes += f.totalAlumnes
    })
    return { arees: areesNoCalculades, files, total }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totesLesClasses, alumnesTots, cursEscolarId, registres])

  if (carregant) return <p>Carregant…</p>

  function taulaAreesNoSuperadesExportable() {
    const { arees, files, total } = areesNoSuperadesPerClasse
    return [{
      nom: 'Àrees no superades',
      files: [
        ['Classe', ...arees.map((a) => a.label), 'Total alumnes'],
        ...files.map((f) => [f.classe, ...arees.map((a) => f.comptes[a.id]), f.totalAlumnes]),
        ['TOTAL', ...arees.map((a) => total.comptes[a.id]), total.totalAlumnes],
      ],
    }]
  }

  return (
    <div>
      <p className="module-lead">
        Igual que al full &quot;Àrees no superades&quot; de l&apos;Excel: quants alumnes de cada
        classe tenen la nota <strong>Final</strong> per sota de 5 a cada àrea.
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
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
          onClick={() => exportaExcel(`Arees-no-superades-${cursEscolarId}`, { cursEscolarId, fulls: taulaAreesNoSuperadesExportable(), etiqueta: 'Avaluació' })}
          type="button"
        >
          📥 Descarrega Excel
        </button>
        <button
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
          onClick={() => exportaPDF('Àrees no superades', { cursEscolarId, fulls: taulaAreesNoSuperadesExportable(), etiqueta: 'Avaluació' })}
          type="button"
        >
          📄 Descarrega PDF
        </button>
      </div>

      <div className="taula-scroll" style={{ marginTop: 16 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
              <th style={{ padding: '6px 8px', minWidth: 60 }}>Classe</th>
              {areesNoSuperadesPerClasse.arees.map((a) => (
                <th key={a.id} style={{ padding: '6px 4px', minWidth: 60, fontSize: 11 }}>{a.label}</th>
              ))}
              <th style={{ padding: '6px 8px', minWidth: 70, fontSize: 11 }}>Total alumnes</th>
            </tr>
          </thead>
          <tbody>
            {areesNoSuperadesPerClasse.files.map((f) => (
              <tr key={f.classe} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '6px 8px', fontWeight: 500 }}>{f.classe}</td>
                {areesNoSuperadesPerClasse.arees.map((a) => (
                  <td key={a.id} style={{ padding: '6px 4px', color: f.comptes[a.id] > 0 ? 'var(--red)' : 'var(--ink-soft)' }}>
                    {f.comptes[a.id]}
                  </td>
                ))}
                <td style={{ padding: '6px 8px' }}>{f.totalAlumnes}</td>
              </tr>
            ))}
            <tr style={{ background: 'var(--bg-soft, #f5f5f0)' }}>
              <td style={{ padding: '6px 8px', fontWeight: 700 }}>TOTAL</td>
              {areesNoSuperadesPerClasse.arees.map((a) => (
                <td key={a.id} style={{ padding: '6px 4px', fontWeight: 700 }}>{areesNoSuperadesPerClasse.total.comptes[a.id]}</td>
              ))}
              <td style={{ padding: '6px 8px', fontWeight: 700 }}>{areesNoSuperadesPerClasse.total.totalAlumnes}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--red)' }}>
          {missatge.text}
        </p>
      )}
    </div>
  )
}
