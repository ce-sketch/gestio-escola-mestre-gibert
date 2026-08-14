import { useEffect, useMemo, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { comptaDiesLectius } from '../../lib/calendar'
import {
  LLINDARS, graellaAbsencies, percentatgeDelGrup, sessionsDelTrimestre,
} from '../../lib/indexAbsencies'

/**
 * La graella d'índexs d'absències de tot el centre, com el full
 * "Assistència" de l'Eina d'avaluació.
 *
 * Diferència amb el full: allà els números arriben per IMPORTRANGE dels
 * fulls de cada tutora i s'hi veu només el recompte. Aquí es calculen de les
 * marques que ja hi ha a l'app, i clicant un número es veu de quins alumnes
 * es tracta.
 */
export default function GraellaAbsencies({ cursEscolarId, calendari }) {
  const [alumnes, setAlumnes] = useState([])
  const [registres, setRegistres] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [error, setError] = useState(null)
  const [tipus, setTipus] = useState('totes') // totes · injustificades
  const [obert, setObert] = useState(null)    // { grup, llindar, periode }

  useEffect(() => {
    carrega()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursEscolarId, calendari])

  async function carrega() {
    if (!calendari?.trimestres?.length) return
    setCarregant(true)
    setError(null)
    try {
      const [anyInici] = cursEscolarId.split('-')
      const [snapAlumnes, snapRegistres] = await Promise.all([
        getDocs(query(collection(db, 'alumnes'), where('actiu', '==', true))),
        getDocs(query(
          collection(db, 'assistencia'),
          where('data', '>=', `${anyInici}-09-01`),
          where('data', '<=', `${Number(anyInici) + 1}-08-31`)
        )),
      ])
      setAlumnes(snapAlumnes.docs.map((d) => ({ id: d.id, ...d.data() })))
      setRegistres(snapRegistres.docs.map((d) => d.data()))
    } catch (err) {
      setError(err.message)
    } finally {
      setCarregant(false)
    }
  }

  /** Un bloc per trimestre, més el total del curs. */
  const periodes = useMemo(() => {
    if (!calendari?.trimestres?.length) return []
    const diesNoLectius = calendari.diesNoLectius ?? []
    const blocs = calendari.trimestres.map((t, i) => ({
      id: `t${i}`,
      nom: t.nom ?? `${i + 1}r trimestre`,
      inici: t.inici,
      fi: t.fi,
      sessions: sessionsDelTrimestre(t, diesNoLectius),
    }))
    const primer = calendari.trimestres[0]
    const ultim = calendari.trimestres[calendari.trimestres.length - 1]
    blocs.push({
      id: 'curs',
      nom: 'TOTAL CURS',
      inici: primer?.inici,
      fi: ultim?.fi,
      sessions: comptaDiesLectius(primer?.inici, ultim?.fi, diesNoLectius) * 2,
    })
    return blocs
  }, [calendari])

  const graelles = useMemo(() => {
    return periodes.map((p) => ({
      periode: p,
      dades: graellaAbsencies({
        alumnes,
        registres: registres.filter((r) => r.data >= p.inici && r.data <= p.fi),
        sessions: p.sessions,
        nomesInjustificades: tipus === 'injustificades',
      }),
    }))
  }, [periodes, alumnes, registres, tipus])

  if (!calendari?.trimestres?.length) return null
  if (carregant) return <p style={{ marginTop: 16 }}>Calculant els índexs…</p>
  if (error) return <p style={{ marginTop: 16, color: 'var(--red)' }}>{error}</p>

  const grups = graelles[0]?.dades.grups ?? []
  const detall = obert && graelles
    .find((g) => g.periode.id === obert.periode)?.dades.grups
    .find((g) => g.grup === obert.grup)?.quiSupera[obert.llindar]

  return (
    <div style={{ marginTop: 28 }}>
      <h3 style={{ fontSize: 16 }}>Índex d'absències del centre</h3>
      <p className="nota" style={{ maxWidth: '100%' }}>
        Quants alumnes de cada grup superen el 10% i el 25% d'absències, calculat sobre els dies
        lectius del període per dues sessions — el mateix que fa el full de l'Eina d'avaluació.
        Entre parèntesis, quin percentatge del grup representen. <strong>Clica qualsevol número
        per veure de quins alumnes es tracta.</strong>
      </p>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {[
          { id: 'totes', label: 'Totes les absències' },
          { id: 'injustificades', label: 'Només les no justificades' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTipus(t.id); setObert(null) }}
            className={tipus === t.id ? 'btn-primary' : 'btn-ghost'}
          >
            {t.label}
          </button>
        ))}
      </div>

      {graelles.map(({ periode, dades }) => (
        <div key={periode.id} style={{ marginTop: 20 }}>
          <strong style={{ fontSize: 13 }}>{periode.nom}</strong>
          <span className="nota" style={{ marginLeft: 8 }}>
            {periode.sessions} sessions ({periode.sessions / 2} dies lectius × 2)
          </span>
          <div className="taula-scroll" style={{ marginTop: 6 }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '4px 10px 4px 0', minWidth: 220 }}>&nbsp;</th>
                  {dades.grups.map((g) => (
                    <th key={g.grup} style={{ padding: '4px 8px', minWidth: 62, background: 'var(--sand)' }}>
                      {g.grup}
                    </th>
                  ))}
                  <th style={{ padding: '4px 8px', background: 'var(--navy)', color: 'white' }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {LLINDARS.map((llindar) => (
                  <tr key={llindar}>
                    <td style={{ padding: '4px 10px 4px 0' }}>
                      Índex d'absències de l'alumnat superior al {llindar}%
                    </td>
                    {dades.grups.map((g) => {
                      const n = g.llindars[llindar] ?? 0
                      return (
                        <td key={g.grup} style={{ padding: '2px 8px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setObert(n === 0 ? null : { grup: g.grup, llindar, periode: periode.id })}
                            title={n === 0 ? 'Cap alumne' : 'Veure de qui es tracta'}
                            style={{
                              border: 'none', background: 'transparent', cursor: n === 0 ? 'default' : 'pointer',
                              color: n === 0 ? 'var(--ink-soft)' : 'var(--navy)',
                              fontWeight: n === 0 ? 400 : 700, fontSize: 12, padding: '2px 4px',
                              textDecoration: n === 0 ? 'none' : 'underline',
                            }}
                          >
                            {n}
                            <span style={{ fontWeight: 400, fontSize: 10, color: 'var(--ink-soft)' }}>
                              {' '}({percentatgeDelGrup(n, g.alumnes)}%)
                            </span>
                          </button>
                        </td>
                      )
                    })}
                    <td style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 700, background: 'var(--paper)' }}>
                      {dades.total.llindars[llindar]}
                      <span style={{ fontWeight: 400, fontSize: 10, color: 'var(--ink-soft)' }}>
                        {' '}({percentatgeDelGrup(dades.total.llindars[llindar], dades.total.alumnes)}%)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {obert && detall && (
        <div className="caixa" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 13 }}>
              {obert.grup} — alumnes per sobre del {obert.llindar}%
              {' '}({periodes.find((p) => p.id === obert.periode)?.nom})
            </strong>
            <button type="button" onClick={() => setObert(null)} className="btn-ghost" style={{ maxWidth: 100 }}>
              Tanca
            </button>
          </div>
          <ul style={{ fontSize: 13, marginTop: 8, paddingLeft: 18 }}>
            {detall.map((a) => (
              <li key={a.id}>{a.nom} — <strong>{a.percentatge}%</strong></li>
            ))}
          </ul>
        </div>
      )}

      {grups.length === 0 && (
        <p className="nota" style={{ marginTop: 12 }}>
          No hi ha cap alumne actiu per calcular els índexs.
        </p>
      )}
    </div>
  )
}
