import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../../firebase'
import { cursEscolarActual } from '../../../lib/cursEscolar'
import {
  entradesHistoric, distribucioPerNivell, momentLabel, MOMENTS,
} from '../../../lib/historicInnovamat'
import { NIVELLS_CONMAT } from '../../../lib/conmatParser'

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

  return (
    <div>
      <p className="module-lead">
        Com han quedat les ConMat d'Innovamat del curs {curs}, classe per classe. Els informes es
        carreguen des de la pestanya "Matemàtiques" d'entrada de dades.
      </p>

      <label className="field" style={{ maxWidth: 170, marginTop: 14 }}>
        <span>Moment de la prova</span>
        <select value={moment} onChange={(e) => setMoment(e.target.value)} className="camp">
          {MOMENTS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </label>

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
                    <td className="num"><strong>{dist.total}</strong></td>
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
                <td className="num">{total.total}</td>
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
