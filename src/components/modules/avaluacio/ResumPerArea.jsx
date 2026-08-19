// "Resum per àrea" — abans era la pestanya "Resum escola" de dins de Notes
// per àrea, i ara viu com a pestanya pròpia a "Resums i informes". Conté:
//
//   - Resum global de tot el centre: equivalent a les pestanyes
//     "Resum 1r/2n/3r Trim." i "Resum" (Final) de l'Excel, amb els quatre
//     moments junts i un selector per mirar-ne un de sol.
//   - Resum d'un curs concret: NA/AS/AN/AE d'un nivell, amb la llista
//     d'alumnes que tenen alguna àrea en No Assoliment.
//
// "Àrees no superades" ja no hi és: viu a la seva pròpia pestanya
// (AreesNoSuperades.jsx).

import { Fragment, useMemo, useState } from 'react'
import { NIVELLS, nivellDe, redueixVigents } from '../../../lib/avaluacioCatala'
import { AREES, TRIMESTRES, areaAplicaAClasse, notaFinalArea } from '../../../lib/notesArea'
import { cursEscolarActual, NIVELLS_ESCOLARS, nivellEscolarDe } from '../../../lib/cursEscolar'
import { grauPrimaria } from '../../../lib/rubricaLectura'
import { exportaExcel, exportaPDF } from '../../../lib/exportTaula'
import { useNotesAreaDades } from './useNotesAreaDades'

const MOMENTS_RESUM = [...TRIMESTRES, 'Final']
const OPCIONS_MOMENT = ['Totes', ...MOMENTS_RESUM]

export default function ResumPerArea() {
  const { alumnesTots, registres, carregant, missatge } = useNotesAreaDades()

  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [trimestre, setTrimestre] = useState(TRIMESTRES[0])
  const [nivellResum, setNivellResum] = useState(NIVELLS_ESCOLARS[0].label)
  const [agrupacioResum, setAgrupacioResum] = useState('classe') // 'classe' | 'nivell'
  const [momentMostrat, setMomentMostrat] = useState('Totes')

  const vigentsResumGlobal = useMemo(
    () => redueixVigents(
      registres.filter((r) => (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId),
      (r) => `${r.alumneId}__${r.area}__${r.trimestre}`
    ),
    [registres, cursEscolarId]
  )

  const totesLesClasses = useMemo(
    () => [...new Set(alumnesTots.map((a) => a.curs))].filter((c) => grauPrimaria(c) !== null).sort(),
    [alumnesTots]
  )

  function notaAlumneTrimestreDe(classeAlumne, alumneId, areaId, trim) {
    const existent = vigentsResumGlobal.find((r) => r.curs === classeAlumne && r.alumneId === alumneId && r.area === areaId && r.trimestre === trim)
    return existent?.nota ?? ''
  }

  function notaFinalAlumneAreaDe(classeAlumne, alumneId, areaId) {
    return notaFinalArea(TRIMESTRES.map((t) => notaAlumneTrimestreDe(classeAlumne, alumneId, areaId, t)))
  }

  function buidaComptes() {
    return { no_assoliment: 0, assoliment_satisfactori: 0, assoliment_notable: 0, 'assoliment_excel·lent': 0 }
  }

  /** El comptatge d'una àrea, un moment i un grup de classes concrets
   *  (una sola classe quan s'agrupa per classe; totes les d'un nivell
   *  quan s'agrupa per nivell). */
  function comptaGrup(areaId, moment, classesDelGrup) {
    const comptes = buidaComptes()
    let avaluats = 0
    if (moment === 'Final') {
      for (const alumne of alumnesTots) {
        if (!classesDelGrup.includes(alumne.curs)) continue
        const final = notaFinalAlumneAreaDe(alumne.curs, alumne.id, areaId)
        if (final === null) continue
        const nivell = nivellDe(final)
        if (nivell) comptes[nivell.id] += 1
        avaluats += 1
      }
    } else {
      const notes = vigentsResumGlobal.filter((r) => r.area === areaId && r.trimestre === moment && classesDelGrup.includes(r.curs))
      for (const r of notes) {
        const nivell = nivellDe(r.nota)
        if (nivell) comptes[nivell.id] += 1
      }
      avaluats = notes.length
    }
    return { comptes, avaluats }
  }

  /**
   * Equivalent a les pestanyes "Resum 1r/2n/3r Trim." i "Resum" (Final) de
   * l'Excel, amb els quatre moments calculats sempre; quin es mostra depèn
   * del selector "Moment" (`momentMostrat`), no d'aquest càlcul.
   *
   * Les àrees calculades (Artística, Medi global) es deixen fora a posta:
   * al full original tampoc hi són.
   */
  const resumGlobalPerArea = useMemo(() => {
    const grups = agrupacioResum === 'nivell'
      ? NIVELLS_ESCOLARS.map((n) => ({ etiqueta: n.label, classes: totesLesClasses.filter((c) => nivellEscolarDe(c) === n.label) }))
      : totesLesClasses.map((c) => ({ etiqueta: c, classes: [c] }))

    return AREES.filter((a) => !a.calculada).map((a) => {
      const files = grups.map((g) => ({
        etiqueta: g.etiqueta,
        perMoment: Object.fromEntries(MOMENTS_RESUM.map((m) => [m, comptaGrup(a.id, m, g.classes)])),
      }))
      const total = Object.fromEntries(MOMENTS_RESUM.map((m) => [m, { comptes: buidaComptes(), avaluats: 0 }]))
      files.forEach((f) => {
        for (const m of MOMENTS_RESUM) {
          for (const k of Object.keys(total[m].comptes)) total[m].comptes[k] += f.perMoment[m].comptes[k]
          total[m].avaluats += f.perMoment[m].avaluats
        }
      })
      const teAlgunaDada = MOMENTS_RESUM.some((m) => total[m].avaluats > 0)
      return { area: a, files, total, teAlgunaDada }
    }).filter((f) => f.teAlgunaDada) // amaguem àrees sense cap nota encara, a cap moment
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vigentsResumGlobal, totesLesClasses, agrupacioResum, alumnesTots])

  // Quins moments es dibuixen ara mateix: tots quatre, o només el triat.
  const momentsAMostrar = momentMostrat === 'Totes' ? MOMENTS_RESUM : [momentMostrat]

  const alumnesDelNivell = useMemo(
    () => alumnesTots.filter((a) => nivellEscolarDe(a.curs) === nivellResum),
    [alumnesTots, nivellResum]
  )

  const vigentsResum = useMemo(
    () => redueixVigents(
      registres.filter((r) =>
        (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId &&
        r.trimestre === trimestre &&
        nivellEscolarDe(r.curs) === nivellResum
      ),
      (r) => `${r.alumneId}__${r.area}`
    ),
    [registres, cursEscolarId, trimestre, nivellResum]
  )

  const digitNivellResum = useMemo(
    () => NIVELLS_ESCOLARS.find((n) => n.label === nivellResum)?.id,
    [nivellResum]
  )
  const areesResum = useMemo(
    () => AREES.filter((a) => areaAplicaAClasse(a.id, digitNivellResum)),
    [digitNivellResum]
  )

  const resumPerArea = useMemo(() => {
    const files = areesResum.map((a) => {
      const notesArea = vigentsResum.filter((r) => r.area === a.id)
      const comptes = buidaComptes()
      for (const r of notesArea) {
        const nivell = nivellDe(r.nota)
        if (nivell) comptes[nivell.id] += 1
      }
      return { area: a, avaluats: notesArea.length, comptes }
    })

    // "Artística" no s'introdueix mai directament: és la mitjana de Plàstica
    // i Música, calculada al moment, igual que la columna "GF" del full
    // original. Només es compta un alumne si té les DUES notes d'aquest
    // trimestre — igual que la fórmula original. Plàstica i Música es
    // mantenen com a files pròpies i separades (no es toquen).
    const perAlumne = new Map()
    for (const r of vigentsResum) {
      if (r.area !== 'plastica' && r.area !== 'musica') continue
      if (!perAlumne.has(r.alumneId)) perAlumne.set(r.alumneId, {})
      perAlumne.get(r.alumneId)[r.area] = r.nota
    }
    const comptesArtistica = buidaComptes()
    let avaluatsArtistica = 0
    for (const valors of perAlumne.values()) {
      if (valors.plastica === undefined || valors.musica === undefined) continue
      const mitjana = (valors.plastica + valors.musica) / 2
      const nivell = nivellDe(mitjana)
      if (nivell) comptesArtistica[nivell.id] += 1
      avaluatsArtistica += 1
    }
    if (avaluatsArtistica > 0) {
      files.push({
        area: { id: 'artistica', label: 'Artística (mitjana Plàstica+Música)' },
        avaluats: avaluatsArtistica,
        comptes: comptesArtistica,
        calculada: true,
      })
    }
    return files
  }, [vigentsResum, areesResum])

  // Alumnes amb almenys una àrea en "No Assoliment" aquest trimestre.
  const alumnesAmbSuspeses = useMemo(() => {
    const perAlumne = new Map()
    for (const r of vigentsResum) {
      const nivell = nivellDe(r.nota)
      if (nivell?.id !== 'no_assoliment') continue
      const areaLabel = AREES.find((a) => a.id === r.area)?.label ?? r.area
      if (!perAlumne.has(r.alumneId)) {
        const numLlista = alumnesTots.find((a) => a.id === r.alumneId)?.numLlista
        perAlumne.set(r.alumneId, { nom: r.alumneNom, numLlista, arees: [] })
      }
      perAlumne.get(r.alumneId).arees.push(areaLabel)
    }
    return [...perAlumne.values()].sort((a, b) => b.arees.length - a.arees.length)
  }, [vigentsResum, alumnesTots])

  if (carregant) return <p>Carregant…</p>

  /** Prepara la taula del resum global per exportar-la (un full per àrea,
   *  amb els moments que hi hagi triats, exactament com es veuen a la
   *  pantalla). */
  function taulesResumGlobalExportables() {
    const capçaleraSup = ['', ...momentsAMostrar.flatMap((m) => [m, '', '', '', ''])]
    const capçaleraInf = [agrupacioResum === 'nivell' ? 'Nivell' : 'Classe', ...momentsAMostrar.flatMap(() => [...NIVELLS.map((n) => n.label), 'Avaluats'])]
    return resumGlobalPerArea.map(({ area: a, files, total }) => ({
      nom: a.label,
      files: [
        capçaleraSup,
        capçaleraInf,
        ...files.map((f) => [f.etiqueta, ...momentsAMostrar.flatMap((m) => [...NIVELLS.map((n) => f.perMoment[m].comptes[n.id]), f.perMoment[m].avaluats])]),
        ['TOTAL', ...momentsAMostrar.flatMap((m) => [...NIVELLS.map((n) => total[m].comptes[n.id]), total[m].avaluats])],
      ],
    }))
  }

  const nomFitxerResum = `Notes-per-area-${cursEscolarId}-${agrupacioResum}-${momentMostrat.replace(/\s+/g, '_')}`

  return (
    <div>
      <p className="module-lead">
        Resum per àrea de tota l&apos;escola: equivalent a les pestanyes &quot;Resum 1r/2n/3r
        Trim.&quot; i &quot;Resum&quot; (Final) de l&apos;Excel, més el resum d&apos;un nivell
        concret.
      </p>

      <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
        <label className="field" style={{ minWidth: 120 }}>
          <span>Curs escolar</span>
          <input
            type="text"
            value={cursEscolarId}
            onChange={(e) => setCursEscolarId(e.target.value)}
            style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', fontWeight: 600 }}
          />
        </label>
        <label className="field" style={{ minWidth: 150 }}>
          <span>Moment (resum global)</span>
          <select value={momentMostrat} onChange={(e) => setMomentMostrat(e.target.value)} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
            {OPCIONS_MOMENT.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="field" style={{ minWidth: 160 }}>
          <span>Resum global agrupat per</span>
          <select value={agrupacioResum} onChange={(e) => setAgrupacioResum(e.target.value)} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
            <option value="classe">Classe (1A, 1B, 2A...)</option>
            <option value="nivell">Nivell (1r, 2n... amb A+B junts)</option>
          </select>
        </label>
      </div>

      <h3 style={{ marginTop: 24, fontSize: 15 }}>Resum global de tot el centre</h3>
      <p className="module-note" style={{ marginTop: 4 }}>
        Tria &quot;Totes&quot; per veure els quatre moments un al costat de l&apos;altre, o un
        moment concret per veure només aquell.
      </p>

      <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        <button
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
          onClick={() => exportaExcel(nomFitxerResum, { cursEscolarId, fulls: taulesResumGlobalExportables(), etiqueta: 'Avaluació' })}
          type="button"
        >
          📥 Descarrega Excel
        </button>
        <button
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
          onClick={() => exportaPDF('Notes per àrea — Resum global', { cursEscolarId, fulls: taulesResumGlobalExportables() })}
          type="button"
        >
          📄 Descarrega PDF
        </button>
      </div>

      {resumGlobalPerArea.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 12 }}>Encara no hi ha cap nota.</p>
      ) : resumGlobalPerArea.map(({ area: a, files, total }) => (
        <div key={a.id} style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600 }}>{a.label}</p>
          <div className="taula-scroll">
            <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%', marginTop: 6 }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th rowSpan={2} style={{ padding: '6px 8px', minWidth: 70, borderBottom: '2px solid var(--line)' }}>
                    {agrupacioResum === 'nivell' ? 'Nivell' : 'Classe'}
                  </th>
                  {momentsAMostrar.map((m) => (
                    <th key={m} colSpan={5} style={{ padding: '4px', fontSize: 11, textAlign: 'center', borderLeft: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
                      {m}
                    </th>
                  ))}
                </tr>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                  {momentsAMostrar.map((m) => (
                    <Fragment key={m}>
                      {NIVELLS.map((n, ni) => (
                        <th key={n.id} style={{ padding: '4px 3px', fontSize: 10, color: n.color, borderLeft: ni === 0 ? '1px solid var(--line)' : 'none' }}>
                          {n.curt}
                        </th>
                      ))}
                      <th style={{ padding: '4px 3px', fontSize: 10, color: 'var(--ink-soft)' }}>Av.</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.etiqueta} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '4px 8px', fontWeight: 500 }}>{f.etiqueta}</td>
                    {momentsAMostrar.map((m) => (
                      <Fragment key={m}>
                        {NIVELLS.map((n, ni) => (
                          <td key={n.id} style={{ padding: '4px 3px', textAlign: 'center', borderLeft: ni === 0 ? '1px solid var(--line)' : 'none' }}>
                            {f.perMoment[m].comptes[n.id]}
                          </td>
                        ))}
                        <td style={{ padding: '4px 3px', textAlign: 'center', color: 'var(--ink-soft)' }}>{f.perMoment[m].avaluats}</td>
                      </Fragment>
                    ))}
                  </tr>
                ))}
                <tr style={{ background: 'var(--bg-soft, #f5f5f0)' }}>
                  <td style={{ padding: '4px 8px', fontWeight: 700 }}>TOTAL</td>
                  {momentsAMostrar.map((m) => (
                    <Fragment key={m}>
                      {NIVELLS.map((n, ni) => (
                        <td key={n.id} style={{ padding: '4px 3px', textAlign: 'center', fontWeight: 700, borderLeft: ni === 0 ? '1px solid var(--line)' : 'none' }}>
                          {total[m].comptes[n.id]}
                        </td>
                      ))}
                      <td style={{ padding: '4px 3px', textAlign: 'center', fontWeight: 700 }}>{total[m].avaluats}</td>
                    </Fragment>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <h3 style={{ marginTop: 32, fontSize: 15 }}>Resum d&apos;un curs concret</h3>
      <label className="field" style={{ minWidth: 120, marginTop: 10 }}>
        <span>Curs (nivell)</span>
        <select value={nivellResum} onChange={(e) => setNivellResum(e.target.value)} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
          {NIVELLS_ESCOLARS.map((n) => <option key={n.id} value={n.label}>{n.label}</option>)}
        </select>
      </label>
      <label className="field" style={{ minWidth: 160, marginTop: 10, marginLeft: 12 }}>
        <span>Trimestre</span>
        <select value={trimestre} onChange={(e) => setTrimestre(e.target.value)} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
          {TRIMESTRES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>

      <div className="taula-scroll">
        <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', marginTop: 20 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
              <th style={{ padding: '6px 8px', minWidth: 140 }}>Àrea</th>
              {NIVELLS.map((n) => <th key={n.id} style={{ padding: '6px 8px', color: n.color }}>{n.curt}</th>)}
              <th style={{ padding: '6px 8px' }}>Avaluats</th>
              <th style={{ padding: '6px 8px' }}>Sense nota</th>
              <th style={{ padding: '6px 8px' }}>Total alumnes</th>
            </tr>
          </thead>
          <tbody>
            {resumPerArea.map(({ area: a, avaluats, comptes, calculada }) => (
              <tr key={a.id} style={{ borderBottom: '1px solid var(--line)', fontStyle: calculada ? 'italic' : 'normal' }}>
                <td style={{ padding: '6px 8px', fontWeight: 500, color: calculada ? 'var(--ink-soft)' : 'inherit' }}>{a.label}</td>
                {NIVELLS.map((n) => (
                  <td key={n.id} style={{ padding: '6px 8px' }}>{comptes[n.id]}</td>
                ))}
                <td style={{ padding: '6px 8px' }}>{avaluats}</td>
                <td style={{ padding: '6px 8px', color: 'var(--ink-soft)' }}>
                  {alumnesDelNivell.length - avaluats}
                </td>
                <td style={{ padding: '6px 8px', fontWeight: 600 }}>{alumnesDelNivell.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 24, fontWeight: 600, fontSize: 13 }}>
        Alumnes amb àrees no superades ({nivellResum}, {trimestre})
      </p>
      {alumnesAmbSuspeses.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 6 }}>Cap alumne amb àrees no superades.</p>
      ) : (
        <div className="taula-scroll">
          <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', marginTop: 10 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                <th style={{ padding: '6px 8px', width: 44 }}>Núm.</th>
                <th style={{ padding: '6px 8px' }}>Alumne</th>
                <th style={{ padding: '6px 8px' }}>Àrees no superades</th>
              </tr>
            </thead>
            <tbody>
              {alumnesAmbSuspeses.map((a) => (
                <tr key={a.nom} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '6px 8px', color: 'var(--ink-soft)' }}>{a.numLlista ?? '—'}</td>
                  <td style={{ padding: '6px 8px', fontWeight: 500 }}>{a.nom}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--red)' }}>{a.arees.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--red)' }}>
          {missatge.text}
        </p>
      )}
    </div>
  )
}
