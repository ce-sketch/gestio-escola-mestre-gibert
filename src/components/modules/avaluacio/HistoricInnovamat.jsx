import { useEffect, useState } from 'react'
import { collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
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
const NIVELLS = ['Baix', 'Mitjà-baix', 'Mitjà-alt', 'Alt']

export default function HistoricInnovamat() {
  const [registres, setRegistres] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [error, setError] = useState(null)
  const [cursCarrega, setCursCarrega] = useState(cursEscolarActual())
  // Referències d'Innovamat (pàgina 4 de l'informe). No es poden llegir
  // del PDF perquè hi són dins d'un gràfic, així que s'introdueixen a mà.
  const [refs, setRefs] = useState({})
  const [refForm, setRefForm] = useState({ curs: cursEscolarActual(), moment: 'final', nivell: '', ambit: 'catalunya', Baix: '', 'Mitjà-baix': '', 'Mitjà-alt': '', Alt: '' })
  const [desantRef, setDesantRef] = useState(false)

  useEffect(() => { carrega() }, [])

  async function carrega() {
    setCarregant(true)
    setError(null)
    try {
      const snap = await getDocs(collection(db, 'matematiques'))
      const tots = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setRegistres(tots.filter((r) => r.tipus !== 'referencia'))
      const mapa = {}
      for (const r of tots.filter((r) => r.tipus === 'referencia')) {
        mapa[`${r.cursEscolar}__${r.moment}__${r.nivell}__${r.ambit}`] = r.valors
      }
      setRefs(mapa)
    } catch (err) {
      setError(err.message)
    } finally {
      setCarregant(false)
    }
  }

  async function desaReferencia() {
    const { curs, moment, nivell, ambit } = refForm
    if (!curs.trim() || !nivell.trim()) return
    setDesantRef(true)
    try {
      const valors = {}
      for (const n of ['Baix', 'Mitjà-baix', 'Mitjà-alt', 'Alt']) {
        valors[n] = refForm[n] === '' ? null : Number(refForm[n])
      }
      await setDoc(doc(db, 'matematiques', `referencia__${curs}__${moment}__${nivell}__${ambit}`), {
        tipus: 'referencia',
        cursEscolar: curs, moment, nivell, ambit, valors,
        actualitzatEl: serverTimestamp(),
        actualitzatPer: auth.currentUser?.email ?? null,
      }, { merge: true })
      await carrega()
    } catch (err) {
      setError(err.message)
    } finally {
      setDesantRef(false)
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

      {/* ── Referències d'Innovamat (a mà) ─────────────────────────── */}
      <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 20 }}>
        <strong>Referències d'Innovamat</strong>
        <p style={{ marginTop: 6, fontSize: 13 }}>
          Els percentatges de Catalunya i del total de centres surten a la pàgina 4 de l'informe,
          però hi són dins d'un gràfic: no es poden llegir del PDF i cal copiar-los aquí a mà.
          Un cop desats, surten al costat dels resultats del centre per comparar-los.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 10 }}>
          <label className="field" style={{ maxWidth: 110 }}>
            <span>Curs</span>
            <input type="text" value={refForm.curs} onChange={(e) => setRefForm({ ...refForm, curs: e.target.value })}
              style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} />
          </label>
          <label className="field" style={{ maxWidth: 130 }}>
            <span>Moment</span>
            <select value={refForm.moment} onChange={(e) => setRefForm({ ...refForm, moment: e.target.value })}
              style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px', fontSize: 12 }}>
              <option value="inici">Inici de curs</option>
              <option value="final">Final de curs</option>
            </select>
          </label>
          <label className="field" style={{ maxWidth: 90 }}>
            <span>Nivell</span>
            <input type="text" placeholder="3r" value={refForm.nivell} onChange={(e) => setRefForm({ ...refForm, nivell: e.target.value })}
              style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px', fontSize: 12 }} />
          </label>
          <label className="field" style={{ maxWidth: 130 }}>
            <span>Àmbit</span>
            <select value={refForm.ambit} onChange={(e) => setRefForm({ ...refForm, ambit: e.target.value })}
              style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px', fontSize: 12 }}>
              <option value="catalunya">Catalunya</option>
              <option value="total">Total centres</option>
            </select>
          </label>
          {NIVELLS.map((n) => (
            <label key={n} className="field" style={{ maxWidth: 85 }}>
              <span>{n} %</span>
              <input type="number" value={refForm[n]} onChange={(e) => setRefForm({ ...refForm, [n]: e.target.value })}
                style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px', fontSize: 12, width: 70 }} />
            </label>
          ))}
          <button type="button" className="btn-ghost" onClick={desaReferencia} disabled={desantRef}>
            {desantRef ? 'Desant…' : 'Desa la referència'}
          </button>
        </div>
        {Object.keys(refs).length > 0 && (
          <p style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 8 }}>
            {Object.keys(refs).length} referències desades.
          </p>
        )}
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
                  <thead>
                    <tr style={{ color: 'var(--ink-soft)', textAlign: 'right' }}>
                      <th style={{ padding: '2px 14px 2px 0', textAlign: 'left' }}>Nivell</th>
                      <th style={{ padding: '2px 14px' }}>Alumnes</th>
                      <th style={{ padding: '2px 14px' }}>Centre</th>
                      <th style={{ padding: '2px 14px' }}>Catalunya</th>
                      <th style={{ padding: '2px 14px' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dist.files.map((f) => {
                      // Les referències es desen per nivell de primària (3r, 4t...),
                      // no per classe: es busca pel primer tros del nom de la classe.
                      const nivellCurs = String(grup.entrades[0]?.classe ?? '').replace(/[A-D]$/i, '')
                      const cat = refs[`${grup.cursEscolar}__${grup.moment}__${nivellCurs}__catalunya`]?.[f.nivell]
                      const tot = refs[`${grup.cursEscolar}__${grup.moment}__${nivellCurs}__total`]?.[f.nivell]
                      return (
                        <tr key={f.nivell}>
                          <td style={{ padding: '2px 14px 2px 0' }}>{f.nivell}</td>
                          <td style={{ padding: '2px 14px', textAlign: 'right' }}>{f.alumnes}</td>
                          <td style={{ padding: '2px 14px', textAlign: 'right', fontWeight: 600 }}>{f.percentatge}%</td>
                          <td style={{ padding: '2px 14px', textAlign: 'right', color: 'var(--ink-soft)' }}>
                            {cat != null ? `${cat}%` : '—'}
                          </td>
                          <td style={{ padding: '2px 14px', textAlign: 'right', color: 'var(--ink-soft)' }}>
                            {tot != null ? `${tot}%` : '—'}
                          </td>
                        </tr>
                      )
                    })}
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
