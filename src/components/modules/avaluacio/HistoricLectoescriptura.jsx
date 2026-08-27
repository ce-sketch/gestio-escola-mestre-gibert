import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../../firebase'
import {
  ETAPES_TEBEROSKY, NIVELLS_TEBEROSKY, historicEI, fullHistoricEI,
} from '../../../lib/lectoescripturaEI'
import { exportaExcel, exportaPDF } from '../../../lib/exportTaula'

/**
 * L'evolució de la lectoescriptura d'Educació Infantil al llarg dels
 * cursos: una fila per curs escolar i classe.
 *
 * Va al grup "Històric" i no a "Resums" perquè aquí no hi ha el curs en
 * marxa sinó la sèrie sencera — el mateix criteri que separa "Resum
 * ConMat" de "Històric (Innovamat)".
 *
 * ⚠️ La columna "Amb dades" no és el nombre d'alumnes de la classe: és
 * quants en tenen alguna casella marcada. Mirant enrere no es pot saber
 * quants alumnes tenia una classe de fa tres cursos, perquè la llista
 * d'alumnes només conté els actius d'ara.
 */
export default function HistoricLectoescriptura() {
  const [documents, setDocuments] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [error, setError] = useState(null)
  const [exportant, setExportant] = useState(false)

  useEffect(() => {
    async function carrega() {
      setCarregant(true)
      setError(null)
      try {
        // Sense filtre de curs: aquí es volen tots. La col·lecció té un
        // document per classe i curs (una vintena l'any), així que
        // llegir-la sencera no és cap problema.
        const snap = await getDocs(collection(db, 'lectoescripturaEI'))
        setDocuments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (err) {
        setError(err.message)
      } finally {
        setCarregant(false)
      }
    }
    carrega()
  }, [])

  const files = useMemo(() => historicEI(documents), [documents])
  const cursos = [...new Set(files.map((f) => f.cursEscolar))]

  function descarrega(format) {
    setExportant(true)
    setError(null)
    try {
      const dades = {
        cursEscolarId: cursos.length === 1 ? cursos[0] : `${cursos[cursos.length - 1]} a ${cursos[0]}`,
        etiqueta: 'Avaluació',
        subtitol: "Històric de lectoescriptura · Educació Infantil",
        fulls: [fullHistoricEI(files)],
      }
      if (format === 'excel') exportaExcel('historic-lectoescriptura-EI.xlsx', dades)
      else exportaPDF('Històric de lectoescriptura — Educació Infantil', dades)
    } catch (err) {
      setError(`No s'ha pogut generar la descàrrega: ${err.message}`)
    } finally {
      setExportant(false)
    }
  }

  return (
    <div>
      <p className="module-lead">
        Com ha evolucionat la lectoescriptura d&apos;Educació Infantil (I4 i I5) al llarg dels
        cursos. La foto del curs en marxa, classe per classe, és a &quot;Resum
        Lectoescriptura&quot;.
      </p>

      {files.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Descarrega l&apos;històric:</span>
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
      {carregant && <p className="nota">Carregant l&apos;històric…</p>}

      {!carregant && files.length === 0 && (
        <p className="nota" style={{ marginTop: 16 }}>
          Encara no hi ha cap dada de lectoescriptura desada. S&apos;introdueixen a la pestanya
          &quot;Lectoescriptura EI&quot; d&apos;entrada de dades.
        </p>
      )}

      {!carregant && files.length > 0 && (
        <>
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 14 }}>
            {files.length} càrregues, de {cursos.length} curs{cursos.length === 1 ? '' : 'os'}
            {cursos.length > 0 && ` (${cursos.join(', ')})`}.
          </p>

          <div className="taula-scroll" style={{ marginTop: 10 }}>
            <table className="taula-dades" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th rowSpan={2}>Curs</th>
                  <th rowSpan={2}>Classe</th>
                  <th rowSpan={2} className="num">Amb dades</th>
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
                {files.map((f) => (
                  <tr key={`${f.cursEscolar}__${f.classe}`}>
                    <td>{f.cursEscolar}</td>
                    <td>{f.classe}</td>
                    <td className="num">{f.ambDades}</td>
                    {NIVELLS_TEBEROSKY.map((n) => (
                      <td key={n.id} className="num">{f.comptes[n.id] || ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="nota" style={{ marginTop: 10 }}>
            <strong>Amb dades</strong> és quants alumnes tenen alguna casella marcada, no quants
            n&apos;hi havia a la classe: dels cursos passats, la fitxa d&apos;alumnat ja no els
            conté. Recorda també que un mateix alumne pot tenir diversos nivells assolits, així que
            les columnes no sumen el total.
          </p>
        </>
      )}
    </div>
  )
}
