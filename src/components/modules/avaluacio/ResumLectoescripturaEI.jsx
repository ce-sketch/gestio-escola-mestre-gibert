import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../../firebase'
import { cursEscolarActual } from '../../../lib/cursEscolar'
import { slug } from '../../../lib/slug'
import {
  ETAPES_TEBEROSKY, NIVELLS_TEBEROSKY, esClasseEI4o5, comptaNivells, fullResumEI,
} from '../../../lib/lectoescripturaEI'
import { classesActives } from '../../../lib/provesActives'
import { exportaExcel, exportaPDF } from '../../../lib/exportTaula'

/**
 * Resum de lectoescriptura de tota l'Educació Infantil: una fila per
 * classe amb quants alumnes han assolit cada nivell de l'escala
 * Teberosky.
 *
 * Reprodueix el full "RESUM EI" de l'Eina d'avaluació. La pestanya
 * d'entrada de dades ("Lectoescriptura EI") ja permet baixar-se la
 * graella d'UNA classe; el que faltava era la foto de l'etapa sencera,
 * que és el que es lliura a la memòria del centre.
 *
 * ⚠️ Compte amb el recompte: als fulls originals cada nivell és una
 * casella independent i un alumne pot tenir-ne diverses marcades a
 * mesura que avança. Per això les columnes NO sumen el nombre d'alumnes
 * i els percentatges no sumen 100 — cada columna és "quants alumnes han
 * assolit aquest nivell", no "quants s'hi han classificat".
 *
 * Quines classes fan la prova NO es tria aquí: es llegeix de "Quines
 * proves es passen", que és on es configura per a totes les proves.
 * Abans es podia triar als dos llocs, i com que cadascun desava al seu
 * document de Firestore podien acabar dient coses diferents — i llavors
 * el resum i el quadre de comandament no haurien coincidit.
 */
export default function ResumLectoescripturaEI() {
  const [alumnes, setAlumnes] = useState([])
  const [documents, setDocuments] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [error, setError] = useState(null)
  const [exportant, setExportant] = useState(false)
  const [config, setConfig] = useState(null)

  const cursEscolarId = cursEscolarActual()

  useEffect(() => {
    async function carrega() {
      setCarregant(true)
      setError(null)
      try {
        const [snapAlumnes, snapDades, snapConfig] = await Promise.all([
          getDocs(query(collection(db, 'alumnes'), where('actiu', '==', true))),
          getDocs(query(collection(db, 'lectoescripturaEI'), where('cursEscolar', '==', cursEscolarId))),
          getDoc(doc(db, 'provesActives', cursEscolarId)),
        ])
        setAlumnes(snapAlumnes.docs.map((d) => ({ id: d.id, ...d.data() })))
        setDocuments(snapDades.docs.map((d) => ({ id: d.id, ...d.data() })))
        setConfig(snapConfig.exists() ? snapConfig.data() : null)
      } catch (err) {
        setError(err.message)
      } finally {
        setCarregant(false)
      }
    }
    carrega()
  }, [cursEscolarId])

  const totesLesClasses = useMemo(
    () => [...new Set(alumnes.map((a) => a.curs))].filter(esClasseEI4o5).sort(),
    [alumnes]
  )

  const perClasse = useMemo(() => {
    // Les que passen la prova segons "Quines proves es passen". Per
    // defecte, totes: si no s'hi ha configurat res, no en falta cap.
    const classes = classesActives(config, 'lectoescriptura', 'curs', totesLesClasses)
    return classes.map((classe) => {
      const ids = alumnes.filter((a) => a.curs === classe).map((a) => a.id)
      const doc = documents.find((d) => d.id === `${cursEscolarId}__${slug(classe)}`)
      return {
        classe,
        total: ids.length,
        comptes: comptaNivells(ids, doc?.alumnes ?? {}),
        teDades: Boolean(doc),
      }
    })
  }, [alumnes, documents, cursEscolarId, config, totesLesClasses])

  const totalAlumnes = perClasse.reduce((t, c) => t + c.total, 0)
  const suma = (nivellId) => perClasse.reduce((t, c) => t + (c.comptes[nivellId] ?? 0), 0)
  const senseDades = perClasse.filter((c) => !c.teDades).map((c) => c.classe)

  function descarrega(format) {
    setExportant(true)
    setError(null)
    try {
      const dades = {
        cursEscolarId,
        etiqueta: 'Avaluació',
        subtitol: 'Resum de lectoescriptura · Educació Infantil',
        fulls: [fullResumEI(perClasse)],
      }
      if (format === 'excel') exportaExcel(`resum-lectoescriptura-EI-${cursEscolarId}.xlsx`, dades)
      else exportaPDF('Resum de lectoescriptura — Educació Infantil', dades)
    } catch (err) {
      setError(`No s'ha pogut generar la descàrrega: ${err.message}`)
    } finally {
      setExportant(false)
    }
  }

  return (
    <div>
      <p className="module-lead">
        Com ha quedat la lectoescriptura d&apos;Educació Infantil (I4 i I5) del curs {cursEscolarId},
        classe per classe. Les marques s&apos;introdueixen a la pestanya &quot;Lectoescriptura
        EI&quot; d&apos;entrada de dades.
      </p>

      {perClasse.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Descarrega el resum:</span>
          <button type="button" onClick={() => descarrega('excel')} disabled={exportant}
            className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}>
            {exportant ? 'Generant…' : '⬇ Excel'}
          </button>
          <button type="button" onClick={() => descarrega('pdf')} disabled={exportant}
            className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}>
            ⬇ PDF
          </button>
        </div>
      )}

      {error && <p className="nota nota-error">{error}</p>}
      {carregant && <p className="nota">Carregant…</p>}

      {!carregant && perClasse.length === 0 && (
        <p className="nota" style={{ marginTop: 16 }}>
          {totesLesClasses.length === 0
            ? "No consta cap classe d'I4 o I5 amb alumnes actius aquest curs."
            : 'Cap classe d\'I4 o I5 no consta com a que passi la prova. Es configura a "Quines proves es passen".'}
        </p>
      )}

      {!carregant && senseDades.length > 0 && (
        <p className="nota nota-avis" style={{ marginTop: 12 }}>
          Encara no s&apos;han introduït dades de {senseDades.join(', ')}. Aquestes classes surten
          a zero, però els seus alumnes sí que compten al total.
        </p>
      )}

      {!carregant && perClasse.length > 0 && (
        <>
          <div className="taula-scroll" style={{ marginTop: 16 }}>
            <table className="taula-dades" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th rowSpan={2}>Classe</th>
                  <th rowSpan={2} className="num">Alumnes</th>
                  {ETAPES_TEBEROSKY.map((e) => (
                    <th key={e.id} colSpan={e.nivells.length} style={{ textAlign: 'center' }}>{e.titol}</th>
                  ))}
                </tr>
                <tr>
                  {NIVELLS_TEBEROSKY.map((n) => (
                    <th key={n.id} className="num" style={{ fontWeight: 400, fontSize: 10 }} title={n.label}>
                      {n.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perClasse.map((c) => (
                  <tr key={c.classe}>
                    <td>{c.classe}</td>
                    <td className="num">{c.total}</td>
                    {NIVELLS_TEBEROSKY.map((n) => (
                      <td key={n.id} className="num">{c.comptes[n.id] || ''}</td>
                    ))}
                  </tr>
                ))}
                <tr style={{ fontWeight: 700 }}>
                  <td>TOTAL</td>
                  <td className="num">{totalAlumnes}</td>
                  {NIVELLS_TEBEROSKY.map((n) => (
                    <td key={n.id} className="num">{suma(n.id) || ''}</td>
                  ))}
                </tr>
                <tr style={{ color: 'var(--ink-soft)' }}>
                  <td>% del centre</td>
                  <td></td>
                  {NIVELLS_TEBEROSKY.map((n) => (
                    <td key={n.id} className="num">
                      {totalAlumnes ? `${Math.round((suma(n.id) / totalAlumnes) * 1000) / 10}%` : '—'}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <p className="nota" style={{ marginTop: 10 }}>
            Cada columna diu quants alumnes han <strong>assolit</strong> aquell nivell, i un mateix
            alumne en pot tenir diversos de marcats. Per això les columnes no sumen el nombre
            d&apos;alumnes ni els percentatges sumen 100.
          </p>
        </>
      )}
    </div>
  )
}
