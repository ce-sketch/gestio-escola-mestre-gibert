import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../../firebase'
import { cursEscolarActual } from '../../../lib/cursEscolar'
import {
  entradesCosmos, distribucioCosmos, evolucioCosmos, NIVELLS_COSMOS, MOMENTS_COSMOS,
} from '../../../lib/historicInnovamat'
import { exportaExcel, exportaPDF } from '../../../lib/exportTaula'
import { fullResumCurs } from '../../../lib/innovamatExport'

const momentLabel = (id) => MOMENTS_COSMOS.find((m) => m.id === id)?.label ?? id

/**
 * Resum del COSMOS del curs en marxa, amb una fila per classe.
 *
 * Bessona de ResumConmat.jsx, però amb la seva pròpia escala: el COSMOS
 * es mesura amb TRES nivells de rendiment (Baix/Mitjà/Alt) i el ConMat
 * amb QUATRE, i no es passen al mateix alumnat (COSMOS a 1r i 2n, ConMat
 * de 3r en amunt). Per això són dues pestanyes i no una de sola amb un
 * selector: sumar-les donaria xifres que no volen dir res.
 *
 * L'evolució al llarg dels anys és a "Històric (Innovamat)".
 */
export default function ResumCosmos() {
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

  // Al COSMOS, els dos moments viuen dins del mateix registre: no es
  // filtra per moment com al ConMat, sinó que es tria quina columna es
  // mira en calcular la distribució.
  const entrades = entradesCosmos(registres).filter((e) => e[moment] != null || e.noAvaluat)
  const classes = [...new Set(entrades.map((e) => e.classe).filter(Boolean))].sort()
  const total = distribucioCosmos(entrades, moment)
  const evo = evolucioCosmos(entrades)

  function descarrega(format) {
    setExportant(true)
    setError(null)
    try {
      const full = fullResumCurs(entrades, {
        prova: 'COSMOS',
        nivells: NIVELLS_COSMOS,
        distribucio: (llista) => distribucioCosmos(llista, moment),
        moment: momentLabel(moment),
        curs,
      })
      const dades = { cursEscolarId: curs, etiqueta: 'COSMOS', subtitol: `Resum del COSMOS · ${momentLabel(moment)}`, fulls: [full] }
      if (format === 'excel') exportaExcel(`resum-cosmos-${curs}-${moment}.xlsx`, dades)
      else exportaPDF('Resum del COSMOS', dades)
    } catch (err) {
      setError(`No s'ha pogut generar la descàrrega: ${err.message}`)
    } finally {
      setExportant(false)
    }
  }

  return (
    <div>
      <p className="module-lead">
        Com ha quedat el COSMOS d&apos;Innovamat del curs {curs} (1r i 2n), classe per classe.
        Els CSV es carreguen des de la pestanya &quot;Matemàtiques&quot; d&apos;entrada de dades.
      </p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 14 }}>
        <label className="field" style={{ maxWidth: 170 }}>
          <span>Moment de la prova</span>
          <select value={moment} onChange={(e) => setMoment(e.target.value)} className="camp">
            {MOMENTS_COSMOS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
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
          Encara no hi ha cap resultat de COSMOS del curs {curs} per al moment «{momentLabel(moment)}».
        </p>
      )}

      {!carregant && entrades.length > 0 && (
        <>
          <div className="taula-scroll" style={{ marginTop: 16 }}>
            <table className="taula-dades">
              <thead>
                <tr>
                  <th>Classe</th>
                  {NIVELLS_COSMOS.map((n) => <th key={n} className="num">{n}</th>)}
                  <th className="num">Total avaluats</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((classe) => {
                  const dist = distribucioCosmos(entrades.filter((e) => e.classe === classe), moment)
                  return (
                    <tr key={classe}>
                      <td>{classe}</td>
                      {NIVELLS_COSMOS.map((n) => (
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
                  <td>COSMOS — TOTAL</td>
                  {NIVELLS_COSMOS.map((n) => (
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
                <tr style={{ color: 'var(--ink-soft)' }}>
                  <td>COSMOS — % del centre</td>
                  {NIVELLS_COSMOS.map((n) => (
                    <td key={n} className="num">
                      {total.files.find((f) => f.nivell === n)?.percentatge ?? 0}%
                    </td>
                  ))}
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Aquesta lectura no té equivalent al ConMat: al COSMOS el
              mateix alumne fa la prova inicial i la final el mateix curs. */}
          {evo.ambTotesDues > 0 && (
            <p className="nota" style={{ marginTop: 12 }}>
              Dels {evo.ambTotesDues} alumnes que tenen les dues proves, <strong>{evo.milloren}</strong> pugen
              de nivell, {evo.mantenen} es mantenen i {evo.baixen} baixen.
            </p>
          )}
        </>
      )}
    </div>
  )
}
