import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../../firebase'
import { cursEscolarActual } from '../../../lib/cursEscolar'
import {
  entradesHistoric, distribucioPerNivell, agrupaPerProva, momentLabel,
} from '../../../lib/historicInnovamat'
import Matematiques from './Matematiques'

/**
 * Històric d'Innovamat: l'evolució del centre a les proves de ConMat i
 * COSMOS al llarg dels cursos.
 *
 * Va a part de la pestanya "Matemàtiques" (entrada de dades) a posta:
 * allà s'hi carreguen només els informes del curs en marxa, mentre que
 * aquí s'hi poden pujar els de qualsevol curs passat per reconstruir
 * l'històric, i consultar-ne els resultats acumulats.
 */
export default function HistoricInnovamat() {
  const [registres, setRegistres] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [error, setError] = useState(null)
  const [cursCarrega, setCursCarrega] = useState(cursEscolarActual())

  useEffect(() => { carrega() }, [])

  async function carrega() {
    setCarregant(true)
    setError(null)
    try {
      const snap = await getDocs(collection(db, 'matematiques'))
      setRegistres(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      setError(err.message)
    } finally {
      setCarregant(false)
    }
  }

  const entrades = entradesHistoric(registres)
  const informes = registres.filter((r) => r.tipus === 'informe')
  const cursos = [...new Set(entrades.map((e) => e.cursEscolar))].sort().reverse()

  return (
    <div>
      <p className="module-lead">
        L'evolució del centre a les proves d'Innovamat al llarg dels cursos. Aquí pots pujar els
        informes de cursos passats per reconstruir l'històric — els del curs en marxa es carreguen
        des de la pestanya "Matemàtiques" d'entrada de dades.
      </p>

      {/* ── Càrrega d'informes d'un curs qualsevol ─────────────────── */}
      <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 20 }}>
        <strong>Carrega informes d'un curs</strong>
        <p style={{ marginTop: 6, fontSize: 13 }}>
          Tria el curs escolar al qual pertanyen els informes i puja'ls. Pots pujar-ne diversos de
          cop. Els alumnes que ja no consten al centre es desen igualment, amb el nom que surti a
          l'informe.
        </p>
        <label className="field" style={{ maxWidth: 140, marginTop: 10 }}>
          <span>Curs escolar dels informes</span>
          <input
            type="text"
            value={cursCarrega}
            onChange={(e) => setCursCarrega(e.target.value)}
            style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontWeight: 600 }}
          />
        </label>
        <Matematiques cursEscolarFixat={cursCarrega} nomesCarrega onDesat={carrega} />
      </div>

      {error && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 10 }}>{error}</p>}
      {carregant && <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 14 }}>Carregant l'històric…</p>}

      {!carregant && entrades.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 20 }}>
          Encara no hi ha cap resultat d'Innovamat desat.
        </p>
      )}

      {!carregant && entrades.length > 0 && (
        <>
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 20 }}>
            {entrades.length} resultats de ConMat desats, de {cursos.length} curs{cursos.length === 1 ? '' : 'os'}
            {cursos.length > 0 && ` (${cursos.join(', ')})`}.
          </p>

          {/* ── Informes carregats ─────────────────────────────────── */}
          <h3 style={{ fontSize: 15, marginTop: 24 }}>Informes carregats</h3>
          {informes.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
              No consta cap informe carregat des que es registren. Els resultats dels alumnes sí que
              hi són a l'històric de sota.
            </p>
          ) : (
            <table style={{ borderCollapse: 'collapse', fontSize: 12, marginTop: 8 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                  <th style={{ padding: '4px 14px 4px 0' }}>Curs</th>
                  <th style={{ padding: '4px 14px' }}>Classe</th>
                  <th style={{ padding: '4px 14px' }}>Moment</th>
                  <th style={{ padding: '4px 14px' }}>Alumnes</th>
                </tr>
              </thead>
              <tbody>
                {informes
                  .sort((a, b) => String(b.cursEscolar).localeCompare(String(a.cursEscolar)))
                  .map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '4px 14px 4px 0' }}>{r.cursEscolar}</td>
                      <td style={{ padding: '4px 14px' }}>{r.classe}</td>
                      <td style={{ padding: '4px 14px' }}>{momentLabel(r.moment)}</td>
                      <td style={{ padding: '4px 14px' }}>
                        {r.alumnesCasats}
                        {r.alumnesSenseCasar > 0 && (
                          <span style={{ color: 'var(--ink-soft)' }}> (+{r.alumnesSenseCasar} amb nom de l'informe)</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {/* ── Resultats per prova ────────────────────────────────── */}
          <h3 style={{ fontSize: 15, marginTop: 28 }}>Resultats per prova</h3>
          {agrupaPerProva(entrades).map((grup) => {
            const dist = distribucioPerNivell(grup.entrades)
            const nSense = grup.entrades.filter((e) => e.sensCasar).length
            return (
              <div key={`${grup.cursEscolar}-${grup.moment}`} style={{ marginTop: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>
                  {grup.cursEscolar} · {momentLabel(grup.moment)}
                  <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}>
                    {' '}— {dist.total} alumnes
                    {nSense > 0 && `, ${nSense} amb el nom de l'informe (ja no són al centre)`}
                  </span>
                </p>
                <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                  <tbody>
                    {dist.files.map((f) => (
                      <tr key={f.nivell}>
                        <td style={{ padding: '2px 14px 2px 0' }}>{f.nivell}</td>
                        <td style={{ padding: '2px 14px', textAlign: 'right' }}>{f.alumnes}</td>
                        <td style={{ padding: '2px 14px', textAlign: 'right', color: 'var(--ink-soft)' }}>
                          {f.percentatge}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
