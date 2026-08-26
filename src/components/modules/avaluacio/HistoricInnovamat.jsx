import { useEffect, useState } from 'react'
import { collection, getDocs, doc, setDoc, deleteDoc, deleteField, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import { cursEscolarActual, NIVELLS_ESCOLARS } from '../../../lib/cursEscolar'
import {
  entradesHistoric, distribucioPerNivell, agrupaPerProva, momentLabel, MOMENTS,
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
  const [esborrant, setEsborrant] = useState(false)
  // "Esborra tot un curs" esborra TOTES les classes i TOTS dos moments
  // d'un cop, sense manera de desfer-ho des de l'app. Un window.confirm()
  // normal és massa fàcil de prémer sense voler (per exemple, buscant el
  // "Desfés" d'un informe concret que hi ha just a sota). Per això cal
  // escriure el curs exacte abans que el botó s'activi — el mateix
  // patró que ja fa servir "Backup" per restaurar-hi.
  const [cursPerEsborrar, setCursPerEsborrar] = useState(null)
  const [confirmaEsborraCurs, setConfirmaEsborraCurs] = useState('')

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
    // Abans, si faltava el curs o el nivell, la funció sortia en silenci
    // i el botó semblava no fer res. Ara ho diu.
    if (!curs.trim() || !nivell.trim()) {
      setError('Falta el curs escolar o el nivell.')
      return
    }
    setError(null)
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

  /**
   * Desfà la càrrega d'un informe (una classe i un moment concrets).
   *
   * Compte: un mateix document d'alumne pot contenir el ConMat d'inici I
   * el de final, i a més les dades de COSMOS. Per això només s'esborra el
   * moment que toca; el document sencer només desapareix si no hi queda
   * res més a dins.
   */
  async function esborraInforme(cursEscolar, classe, moment) {
    const afectats = registres.filter((r) =>
      r.tipus !== 'informe' && r.tipus !== 'referencia'
      && r.cursEscolar === cursEscolar
      && r.conmat?.[moment]?.classe === classe)

    if (!window.confirm(
      `Esborrar el ConMat de ${classe} (${momentLabel(moment)}, curs ${cursEscolar})?\n\n`
      + `Afecta ${afectats.length} alumnes. La resta de dades (l'altre moment i el COSMOS) es mantenen.`
    )) return

    setEsborrant(true)
    try {
      // En lots: amb 25 alumnes per informe, fer-ho un per un és lent i
      // podria quedar-se a mitges si es talla la connexió.
      const lot = writeBatch(db)
      for (const r of afectats) {
        const restaConmat = Object.keys(r.conmat ?? {}).filter((m) => m !== moment)
        if (restaConmat.length === 0 && !r.cosmos) {
          lot.delete(doc(db, 'matematiques', r.id))
        } else {
          lot.update(doc(db, 'matematiques', r.id), { [`conmat.${moment}`]: deleteField() })
        }
      }
      await lot.commit()
      await deleteDoc(doc(db, 'matematiques', `informe__${cursEscolar}__${classe}__${moment}`)).catch(() => {})
      await carrega()
    } catch (err) {
      setError(err.message)
    } finally {
      setEsborrant(false)
    }
  }

  /** Esborra tots els resultats d'Innovamat d'un curs escolar sencer.
   *  Les referències introduïdes a mà es mantenen.
   *
   *  Ja no demana confirmació aquí: la crida només arriba quan qui
   *  truca (el botó de sota) ha comprovat que l'usuari ha escrit el curs
   *  exacte. Fer-ho amb un window.confirm() sol era massa fàcil de
   *  prémer per error. */
  async function esborraCurs(cursEscolar) {
    const afectats = registres.filter((r) => r.cursEscolar === cursEscolar && r.tipus !== 'referencia')
    setEsborrant(true)
    try {
      const MAX = 450
      for (let i = 0; i < afectats.length; i += MAX) {
        const lot = writeBatch(db)
        for (const r of afectats.slice(i, i + MAX)) lot.delete(doc(db, 'matematiques', r.id))
        await lot.commit()
      }
      setCursPerEsborrar(null)
      setConfirmaEsborraCurs('')
      await carrega()
    } catch (err) {
      setError(err.message)
    } finally {
      setEsborrant(false)
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
            className="camp camp-destacat"
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
              className="camp camp-petit" />
          </label>
          <label className="field" style={{ maxWidth: 130 }}>
            <span>Moment</span>
            <select value={refForm.moment} onChange={(e) => setRefForm({ ...refForm, moment: e.target.value })}
              className="camp camp-petit">
              <option value="inici">Inici de curs</option>
              <option value="final">Final de curs</option>
            </select>
          </label>
          <label className="field" style={{ maxWidth: 110 }}>
            <span>Nivell</span>
            {/* Abans era text lliure amb "3r" com a exemple en gris, i
                costava veure que el camp era buit: el botó de desar no
                feia res i no s'entenia per què. Amb un desplegable no es
                pot deixar a mitges ni escriure'l de dues maneres
                ("3r" / "3er"), que trencaria l'agrupació per nivell.
                Les ConMat només es passen de 3r a 6è. */}
            <select value={refForm.nivell} onChange={(e) => setRefForm({ ...refForm, nivell: e.target.value })}
              className="camp camp-petit">
              <option value="">— Tria'l —</option>
              {NIVELLS_ESCOLARS.filter((n) => Number(n.id) >= 3).map((n) => (
                <option key={n.id} value={n.label}>{n.label}</option>
              ))}
            </select>
          </label>
          <label className="field" style={{ maxWidth: 130 }}>
            <span>Àmbit</span>
            <select value={refForm.ambit} onChange={(e) => setRefForm({ ...refForm, ambit: e.target.value })}
              className="camp camp-petit">
              <option value="catalunya">Catalunya</option>
              <option value="total">Total centres</option>
            </select>
          </label>
          {NIVELLS.map((n) => (
            <label key={n} className="field" style={{ maxWidth: 85 }}>
              <span>{n} %</span>
              <input type="number" value={refForm[n]} onChange={(e) => setRefForm({ ...refForm, [n]: e.target.value })}
                className="camp camp-petit" style={{ width: 70 }} />
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

          {cursos.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Esborra tot un curs:</span>
                {cursos.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { setCursPerEsborrar(c); setConfirmaEsborraCurs('') }}
                    disabled={esborrant}
                    style={{ background: 'none', border: '1px solid var(--red, #b03030)', color: 'var(--red, #b03030)', borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {/* Segon pas obligatori: cal escriure el curs exacte. Esborrar
                  un curs sencer no es pot desfer des de l'app (a diferència
                  del "Desfés" d'un informe concret), així que aquí no n'hi
                  ha prou amb un simple clic de confirmació. */}
              {cursPerEsborrar && (
                <div className="caixa-discreta" style={{ marginTop: 8, borderColor: 'var(--red, #b03030)' }}>
                  <strong style={{ fontSize: 12, color: 'var(--red, #b03030)' }}>
                    Esborrar TOTS els resultats d'Innovamat del curs {cursPerEsborrar}?
                  </strong>
                  <p className="nota">
                    Afecta totes les classes i tots dos moments (ConMat i COSMOS) —{' '}
                    {registres.filter((r) => r.cursEscolar === cursPerEsborrar && r.tipus !== 'referencia').length} registres.
                    Les referències d'Innovamat es mantenen. <strong>Aquesta acció no es pot desfer des de l'app.</strong>
                    {' '}Escriu <strong>{cursPerEsborrar}</strong> per confirmar-ho.
                  </p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={confirmaEsborraCurs}
                      onChange={(e) => setConfirmaEsborraCurs(e.target.value)}
                      placeholder={cursPerEsborrar}
                      className="camp camp-petit"
                      style={{ maxWidth: 120 }}
                    />
                    <button
                      type="button"
                      onClick={() => esborraCurs(cursPerEsborrar)}
                      disabled={esborrant || confirmaEsborraCurs !== cursPerEsborrar}
                      style={{
                        background: confirmaEsborraCurs === cursPerEsborrar ? 'var(--red, #b03030)' : 'var(--line)',
                        color: confirmaEsborraCurs === cursPerEsborrar ? '#fff' : 'var(--ink-soft)',
                        border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11,
                        cursor: confirmaEsborraCurs === cursPerEsborrar ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {esborrant ? 'Esborrant…' : 'Esborra definitivament'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCursPerEsborrar(null); setConfirmaEsborraCurs('') }}
                      disabled={esborrant}
                      style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
                    >
                      Cancel·la
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Informes carregats ─────────────────────────────────── */}
          <h3 style={{ fontSize: 15, marginTop: 24 }}>Informes carregats</h3>
          {informes.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
              No consta cap informe carregat des que es registren. Els resultats dels alumnes sí que
              hi són a l'històric de sota.
            </p>
          ) : (
            <table className="taula-dades" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Curs</th>
                  <th>Classe</th>
                  <th>Moment</th>
                  <th>Alumnes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {informes
                  .sort((a, b) => String(b.cursEscolar).localeCompare(String(a.cursEscolar)))
                  .map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td>{r.cursEscolar}</td>
                      <td>{r.classe}</td>
                      <td>{momentLabel(r.moment)}</td>
                      <td>
                        {r.alumnesCasats}
                        {r.alumnesSenseCasar > 0 && (
                          <span style={{ color: 'var(--ink-soft)' }}> (+{r.alumnesSenseCasar} amb nom de l'informe)</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => esborraInforme(r.cursEscolar, r.classe, r.moment)}
                          disabled={esborrant}
                          style={{ background: 'none', border: '1px solid var(--red, #b03030)', color: 'var(--red, #b03030)', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}
                        >
                          Desfés
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {/* ── Evolució del centre ────────────────────────────────────
              Una fila per curs, com a l'històric de TEE i VL/CL: és la
              vista que serveix per veure la tendència d'un cop d'ull. */}
          <h3 style={{ fontSize: 15, marginTop: 28 }}>Evolució del centre</h3>
          {MOMENTS.map((m) => {
            const delMoment = entrades.filter((e) => e.moment === m.id)
            if (delMoment.length === 0) return null
            const cursosDelMoment = [...new Set(delMoment.map((e) => e.cursEscolar))].sort().reverse()
            return (
              <div key={m.id} style={{ marginTop: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', margin: '0 0 6px' }}>
                  {m.label}
                </p>
                <div className="taula-scroll">
                  <table className="taula-dades">
                    <thead>
                      <tr>
                        <th>Curs</th>
                        {NIVELLS.map((n) => <th key={n} className="num">{n}</th>)}
                        <th className="num">Avaluats</th>
                        <th>Nivells</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cursosDelMoment.map((c) => {
                        const delCurs = delMoment.filter((e) => e.cursEscolar === c)
                        const dist = distribucioPerNivell(delCurs)
                        // Quins nivells de primària hi ha en aquell curs
                        // (3-4-5-6 si hi són tots), tret de la lletra de classe.
                        const nivells = [...new Set(delCurs
                          .map((e) => String(e.classe ?? '').replace(/[A-D]$/i, '').replace(/[^0-9]/g, ''))
                          .filter(Boolean))].sort().join('-')
                        return (
                          <tr key={c}>
                            <td>{c}</td>
                            {NIVELLS.map((n) => {
                              const f = dist.files.find((x) => x.nivell === n)
                              return (
                                <td key={n} className="num">
                                  <strong>{f?.alumnes ?? 0}</strong>
                                  <span style={{ color: 'var(--ink-soft)' }}> ({f?.percentatge ?? 0}%)</span>
                                </td>
                              )
                            })}
                            <td className="num">
                              {dist.total}
                              {dist.noAvaluats > 0 && (
                                <span style={{ color: 'var(--ink-soft)' }}> (+{dist.noAvaluats} sense fer la prova)</span>
                              )}
                            </td>
                            <td style={{ color: 'var(--ink-soft)' }}>{nivells || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}

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
                    {' '}— {dist.total} avaluats
                    {dist.noAvaluats > 0 && `, ${dist.noAvaluats} sense fer la prova`}
                    {nSense > 0 && `, ${nSense} amb el nom de l'informe (ja no són al centre)`}
                  </span>
                </p>
                {/* Una fila per classe, com al resum de TEE i VL/CL. Les
                    classes surten de les dades: si un curs tenia altres
                    grups, hi apareixen igualment. */}
                <table className="taula-dades" style={{ marginBottom: 14 }}>
                  <thead>
                    <tr>
                      <th>Classe</th>
                      {NIVELLS.map((n) => <th key={n} className="num">{n}</th>)}
                      <th className="num">Total avaluats</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...new Set(grup.entrades.map((e) => e.classe).filter(Boolean))].sort().map((classe) => {
                      const dEls = distribucioPerNivell(grup.entrades.filter((e) => e.classe === classe))
                      return (
                        <tr key={classe}>
                          <td>{classe}</td>
                          {NIVELLS.map((n) => (
                            <td key={n} className="num">
                              {dEls.files.find((f) => f.nivell === n)?.alumnes ?? 0}
                            </td>
                          ))}
                          <td className="num">
                            <strong>{dEls.total}</strong>
                            {dEls.noAvaluats > 0 && (
                              <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}> (+{dEls.noAvaluats})</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    <tr style={{ fontWeight: 700 }}>
                      <td>ConMat — TOTAL</td>
                      {NIVELLS.map((n) => (
                        <td key={n} className="num">
                          {dist.files.find((f) => f.nivell === n)?.alumnes ?? 0}
                        </td>
                      ))}
                      <td className="num">
                        {dist.total}
                        {dist.noAvaluats > 0 && (
                          <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}> (+{dist.noAvaluats})</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <table className="taula-dades">
                  <thead>
                    <tr style={{ color: 'var(--ink-soft)', textAlign: 'right' }}>
                      <th>Nivell</th>
                      <th>Alumnes</th>
                      <th>Centre</th>
                      <th>Catalunya</th>
                      <th>Total</th>
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
                          <td>{f.nivell}</td>
                          <td className="num">{f.alumnes}</td>
                          <td className="num">{f.percentatge}%</td>
                          <td className="num">
                            {cat != null ? `${cat}%` : '—'}
                          </td>
                          <td className="num">
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
