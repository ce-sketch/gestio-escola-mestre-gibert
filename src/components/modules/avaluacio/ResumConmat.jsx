import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../../firebase'
import { cursEscolarActual } from '../../../lib/cursEscolar'
import {
  entradesHistoric, distribucioPerNivell, momentLabel, MOMENTS,
} from '../../../lib/historicInnovamat'
import { NIVELLS_CONMAT } from '../../../lib/conmatParser'
import { exportaExcel, exportaPDF } from '../../../lib/exportTaula'
import { fullResumCurs } from '../../../lib/innovamatExport'

const NIVELLS = NIVELLS_CONMAT.map((n) => n.label)

/**
 * Resum de les ConMat del curs en marxa, amb una fila per classe — el
 * mateix format que el resum de TEE i VL/CL.
 *
 * Va a "Resums i informes" perquè és la foto d'aquest curs. L'evolució al
 * llarg dels anys és a la pestanya "Històric (Innovamat)".
 */
export default function ResumConmat() {
  const [registres, setRegistres] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [error, setError] = useState(null)
  const [moment, setMoment] = useState('final')
  const [exportant, setExportant] = useState(false)

  const curs = cursEscolarActual()

  useEffect(() => {
    async function carrega() {
      setCarregant(true)
      setError(null)
      try {
        const snap = await getDocs(query(collection(db, 'matematiques'), where('cursEscolar', '==', curs)))
        setRegistres(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (err) {
        setError(err.message)
      } finally {
        setCarregant(false)
      }
    }
    carrega()
  }, [curs])

  const entrades = entradesHistoric(registres).filter((e) => e.moment === moment)
  const classes = [...new Set(entrades.map((e) => e.classe).filter(Boolean))].sort()
  const total = distribucioPerNivell(entrades)

  function descarrega(format) {
    setExportant(true)
    setError(null)
    try {
      const full = fullResumCurs(entrades, {
        prova: 'ConMat',
        nivells: NIVELLS,
        distribucio: distribucioPerNivell,
        moment: momentLabel(moment),
        curs,
      })
      const dades = { cursEscolarId: curs, etiqueta: 'ConMat', subtitol: `Resum del ConMat · ${momentLabel(moment)}`, fulls: [full] }
      if (format === 'excel') exportaExcel(`resum-conmat-${curs}-${moment}.xlsx`, dades)
      else exportaPDF('Resum del ConMat', dades)
    } catch (err) {
      setError(`No s'ha pogut generar la descàrrega: ${err.message}`)
    } finally {
      setExportant(false)
    }
  }

  return (
    <div>
      <p className="module-lead">
        Com han quedat les ConMat d'Innovamat del curs {curs}, classe per classe. Els informes es
        carreguen des de la pestanya "Matemàtiques" d'entrada de dades.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 14 }}>
        <label className="field" style={{ maxWidth: 170 }}>
          <span>Moment de la prova</span>
          <select value={moment} onChange={(e) => setMoment(e.target.value)} className="camp">
            {MOMENTS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
        {entrades.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 6 }}>
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
      </div>

      {error && <p className="nota nota-error">{error}</p>}
      {carregant && <p className="nota">Carregant…</p>}

      {!carregant && entrades.length === 0 && (
        <p className="nota" style={{ marginTop: 16 }}>
          Encara no hi ha cap resultat de ConMat del curs {curs} per al moment «{momentLabel(moment)}».
        </p>
      )}

      {!carregant && entrades.length > 0 && (
        <div className="taula-scroll" style={{ marginTop: 16 }}>
          <table className="taula-dades">
            <thead>
              <tr>
                <th>Classe</th>
                {NIVELLS.map((n) => <th key={n} className="num">{n}</th>)}
                <th className="num">Total avaluats</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((classe) => {
                const dist = distribucioPerNivell(entrades.filter((e) => e.classe === classe))
                return (
                  <tr key={classe}>
                    <td>{classe}</td>
                    {NIVELLS.map((n) => (
                      <td key={n} className="num">
                        {dist.files.find((f) => f.nivell === n)?.alumnes ?? 0}
                      </td>
                    ))}
                    <td className="num">
                      <strong>{dist.total}</strong>
                      {dist.noAvaluats > 0 && (
                        <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}> (+{dist.noAvaluats} sense fer la prova)</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              <tr style={{ fontWeight: 700 }}>
                <td>ConMat — TOTAL</td>
                {NIVELLS.map((n) => (
                  <td key={n} className="num">
                    {total.files.find((f) => f.nivell === n)?.alumnes ?? 0}
                  </td>
                ))}
                <td className="num">
                  {total.total}
                  {total.noAvaluats > 0 && (
                    <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}> (+{total.noAvaluats})</span>
                  )}
                </td>
              </tr>
              {/* Els percentatges, a sota dels recomptes: és el que es
                  mira per comparar amb Catalunya i amb els altres centres. */}
              <tr style={{ color: 'var(--ink-soft)' }}>
                <td>ConMat — % del centre</td>
                {NIVELLS.map((n) => (
                  <td key={n} className="num">
                    {total.files.find((f) => f.nivell === n)?.percentatge ?? 0}%
                  </td>
                ))}
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
