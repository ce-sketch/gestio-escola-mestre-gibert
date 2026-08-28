import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDocs, query, setDoc, deleteDoc, where, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import { cursEscolarActual } from '../../../lib/cursEscolar'
import { TRIMESTRES } from '../../../lib/notesArea'
import {
  FRANGES, resumDesDeRegistres, fusionaHistoric, totalCentre, percentatgeSuperacio,
  classesDe, areesDe, trimestresDe, fullHistoricNotaArea, fullEvolucioNotaArea,
} from '../../../lib/historicNotaArea'
import { llegeixResumNotaArea } from '../../../lib/historicNotaAreaParser'
import { exportaExcel, exportaPDF } from '../../../lib/exportTaula'
import BotoDrive from '../../BotoDrive'

/**
 * L'evolució de les notes per àrea al llarg dels cursos.
 *
 * S'amplia SOL: cada any que es porta amb l'app, el resum es calcula dels
 * registres de "Notes per àrea" que ja hi ha desats — no cal fer res.
 * Els cursos d'abans de l'app s'importen una vegada del full "Resum" del
 * Google Sheet que es feia servir aleshores.
 *
 * Si un curs té les dues coses, mana el calculat: ve de les notes una per
 * una i no d'un resum que algú ja havia agregat.
 */
export default function HistoricNotaArea() {
  const [cursosDesats, setCursosDesats] = useState([])
  const [registres, setRegistres] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [error, setError] = useState(null)
  const [missatge, setMissatge] = useState(null)
  const [exportant, setExportant] = useState(false)
  const [desant, setDesant] = useState(false)
  const [llegint, setLlegint] = useState(false)
  const [proposta, setProposta] = useState(null)
  const [trimestre, setTrimestre] = useState('3r trimestre')
  const [sensePrimer, setSensePrimer] = useState(false)
  const [cursObert, setCursObert] = useState(null)

  useEffect(() => { carrega() }, [])

  async function carrega() {
    setCarregant(true)
    setError(null)
    try {
      const [snapDesats, snapNotes] = await Promise.all([
        getDocs(collection(db, 'historicNotaArea')),
        // Sense filtre de curs escolar: aquí es volen TOTS els anys que
        // s'hagin portat amb l'app. Es filtra per tipus per no arrossegar
        // el TEE i la lectura, que ja tenen el seu propi històric.
        getDocs(query(collection(db, 'avaluacio'), where('tipus', '==', 'nota_area'))),
      ])
      setCursosDesats(snapDesats.docs.map((d) => ({ id: d.id, ...d.data() })))
      setRegistres(snapNotes.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      setError(err.message)
    } finally {
      setCarregant(false)
    }
  }

  const cursos = useMemo(() => {
    const anys = [...new Set(registres.map((r) => r.cursEscolar ?? cursEscolarActual()))]
    const calculats = Object.fromEntries(
      anys.map((any) => [any, resumDesDeRegistres(registres, any)]))
    return fusionaHistoric(cursosDesats, calculats)
  }, [registres, cursosDesats])

  const arees = useMemo(() => areesDe(cursos.flatMap((c) => c.files)), [cursos])

  // ── Importar un curs antic ──────────────────────────────────────────
  async function puja(e) {
    const fitxer = e?.target?.files?.[0] ?? e
    if (!fitxer) return
    setLlegint(true)
    setMissatge(null)
    setError(null)
    try {
      const resultat = await llegeixResumNotaArea(await fitxer.arrayBuffer())
      setProposta({ ...resultat, fitxer: fitxer.name, curs: resultat.cursEscolar ?? '' })
    } catch (err) {
      setError(err.message)
      setProposta(null)
    } finally {
      setLlegint(false)
    }
  }

  async function desaProposta() {
    if (!proposta?.curs?.trim()) {
      setError('Falta el curs escolar del fitxer.')
      return
    }
    setDesant(true)
    try {
      await setDoc(doc(db, 'historicNotaArea', proposta.curs.trim()), {
        cursEscolar: proposta.curs.trim(),
        files: proposta.files,
        origenFitxer: proposta.fitxer ?? null,
        actualitzatEl: serverTimestamp(),
        actualitzatPer: auth.currentUser?.email ?? null,
      })
      setMissatge(`Curs ${proposta.curs} desat, amb ${proposta.files.length} files.`)
      setProposta(null)
      await carrega()
    } catch (err) {
      setError(`No s'ha pogut desar: ${err.message}`)
    } finally {
      setDesant(false)
    }
  }

  async function esborraCurs(cursEscolar) {
    setDesant(true)
    try {
      await deleteDoc(doc(db, 'historicNotaArea', cursEscolar))
      await carrega()
    } catch (err) {
      setError(err.message)
    } finally {
      setDesant(false)
    }
  }

  function descarrega(format) {
    setExportant(true)
    setError(null)
    try {
      const anys = cursos.map((c) => c.cursEscolar)
      const dades = {
        cursEscolarId: anys.length === 1 ? anys[0] : `${anys[anys.length - 1]} a ${anys[0]}`,
        etiqueta: 'Avaluació',
        subtitol: "Històric de notes per àrea",
        fulls: [
          fullEvolucioNotaArea(cursos, { trimestre, sensePrimer }),
          fullHistoricNotaArea(cursos),
        ],
      }
      if (format === 'excel') exportaExcel('historic-notes-per-area.xlsx', dades)
      else exportaPDF('Històric de notes per àrea', dades)
    } catch (err) {
      setError(`No s'ha pogut generar la descàrrega: ${err.message}`)
    } finally {
      setExportant(false)
    }
  }

  return (
    <div>
      <p className="module-lead">
        Com han evolucionat les notes per àrea al llarg dels cursos. Els anys que es porten
        amb l&apos;app s&apos;hi afegeixen <strong>sols</strong>, a partir de les notes
        introduïdes a &quot;Notes per àrea&quot;. Els d&apos;abans s&apos;importen una vegada
        del full &quot;Resum&quot; del Google Sheet que es feia servir aleshores.
      </p>

      {/* ── Importar un curs antic ──────────────────────────────────── */}
      <div className="caixa-discreta" style={{ marginTop: 16 }}>
        <strong style={{ fontSize: 14 }}>Afegeix un curs d&apos;abans de l&apos;app</strong>
        <p className="nota">
          Puja el fitxer de la graella de notes d&apos;aquell any (en format .xlsx). Se
          n&apos;llegeixen només els fulls &quot;Resum 1r Trim.&quot;, &quot;Resum 2n
          trim.&quot; i &quot;Resum 3r trim.&quot;; els fulls de cada classe s&apos;ignoren.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <BotoDrive
            onFitxer={puja}
            onError={(text) => setError(text)}
            disabled={llegint}
            tipus="fulls"
            etiqueta="Tria el full del Drive"
          />
          <label className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', cursor: llegint ? 'wait' : 'pointer' }}>
            {llegint ? 'Llegint…' : '📤 Puja l\'Excel'}
            <input type="file" accept=".xlsx,.xlsm" style={{ display: 'none' }} disabled={llegint}
              onChange={(e) => { puja(e); e.target.value = '' }} />
          </label>
        </div>

        {proposta && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <strong style={{ fontSize: 13 }}>
              {proposta.files.length} files llegides de &quot;{proposta.fitxer}&quot;
              {' '}({trimestresDe(proposta.files).length} trimestres,
              {' '}{areesDe(proposta.files).length} àrees)
            </strong>
            {proposta.avisos.map((a, i) => <p key={i} className="nota nota-avis">{a}</p>)}
            <label className="field" style={{ maxWidth: 140, marginTop: 8 }}>
              <span>Curs escolar</span>
              <input type="text" value={proposta.curs} className="camp camp-petit"
                onChange={(e) => setProposta({ ...proposta, curs: e.target.value })} />
            </label>
            {cursos.some((c) => c.cursEscolar === proposta.curs && c.origen === 'calculat') && (
              <p className="nota nota-avis">
                El curs {proposta.curs} ja es calcula de les notes desades a l&apos;app. Es
                desarà igualment, però l&apos;històric seguirà mostrant les calculades, que
                vénen de les notes una per una.
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" onClick={desaProposta} disabled={desant} className="btn-primary" style={{ maxWidth: 200 }}>
                {desant ? 'Desant…' : 'Desa aquest curs'}
              </button>
              <button type="button" onClick={() => setProposta(null)} className="btn-ghost">Cancel·la</button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="nota nota-error">{error}</p>}
      {missatge && <p style={{ fontSize: 12, color: 'var(--green)', marginTop: 8 }}>{missatge}</p>}
      {carregant && <p className="nota">Carregant l&apos;històric…</p>}

      {!carregant && cursos.length === 0 && (
        <p className="nota" style={{ marginTop: 16 }}>
          Encara no hi ha cap curs a l&apos;històric. S&apos;hi afegiran sols a mesura que
          s&apos;introdueixin notes a &quot;Notes per àrea&quot;, o pots pujar els fulls dels
          cursos anteriors amb el botó de dalt.
        </p>
      )}

      {!carregant && cursos.length > 0 && (
        <>
          {/* ── Evolució ───────────────────────────────────────────── */}
          <h3 style={{ fontSize: 15, marginTop: 26 }}>Evolució del centre</h3>
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
            Percentatge d&apos;alumnes que superen cada àrea (tot menys el No Assoliment).
          </p>

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 10 }}>
            <label className="field" style={{ maxWidth: 160 }}>
              <span>Trimestre</span>
              <select value={trimestre} onChange={(e) => setTrimestre(e.target.value)} className="camp camp-petit">
                {TRIMESTRES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, paddingBottom: 8 }}>
              <input type="checkbox" checked={sensePrimer} onChange={(e) => setSensePrimer(e.target.checked)} />
              sense 1r
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 6, marginLeft: 'auto' }}>
              <button type="button" onClick={() => descarrega('excel')} disabled={exportant}
                className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}>
                {exportant ? 'Generant…' : '⬇ Excel'}
              </button>
              <button type="button" onClick={() => descarrega('pdf')} disabled={exportant}
                className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}>
                ⬇ PDF
              </button>
            </div>
          </div>

          <div className="taula-scroll" style={{ marginTop: 10 }}>
            <table className="taula-dades" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Àrea</th>
                  {[...cursos].reverse().map((c) => (
                    <th key={c.cursEscolar} className="num">
                      {c.cursEscolar}
                      {c.origen === 'importat' && (
                        <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }} title="Importat d'un full antic"> *</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {arees.map((area) => (
                  <tr key={area.id}>
                    <td>{area.label}</td>
                    {[...cursos].reverse().map((c) => {
                      const pct = percentatgeSuperacio(
                        totalCentre(c.files, { area: area.id, trimestre, sensePrimer }))
                      return (
                        <td key={c.cursEscolar} className="num">
                          {pct === null ? <span style={{ color: 'var(--line)' }}>—</span> : `${pct}%`}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cursos.some((c) => c.origen === 'importat') && (
            <p className="nota" style={{ marginTop: 8 }}>
              Els cursos marcats amb <strong>*</strong> vénen d&apos;un full importat, no de les
              notes introduïdes a l&apos;app.
            </p>
          )}

          {/* ── Detall per curs ────────────────────────────────────── */}
          <h3 style={{ fontSize: 15, marginTop: 28 }}>Detall per curs</h3>
          {cursos.map((c) => {
            const obert = cursObert === c.cursEscolar
            const delTrimestre = c.files.filter((f) => f.trimestre === trimestre)
            return (
              <div key={c.cursEscolar} style={{ marginTop: 10, border: '1px solid var(--line)', borderRadius: 10 }}>
                <button
                  type="button"
                  onClick={() => setCursObert(obert ? null : c.cursEscolar)}
                  style={{
                    width: '100%', textAlign: 'left', background: 'none', border: 'none',
                    padding: '10px 12px', cursor: 'pointer', display: 'flex', gap: 8,
                    alignItems: 'center', fontSize: 13, fontWeight: 600,
                  }}
                >
                  <span style={{ color: 'var(--ink-soft)', fontSize: 11 }}>{obert ? '▾' : '▸'}</span>
                  {c.cursEscolar}
                  <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--ink-soft)' }}>
                    {c.origen === 'calculat' ? 'de les notes de l\'app' : 'importat'}
                    {' · '}{c.files.length} files
                  </span>
                  {c.origen === 'importat' && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); esborraCurs(c.cursEscolar) }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); esborraCurs(c.cursEscolar) } }}
                      style={{ marginLeft: 'auto', border: '1px solid var(--red, #b03030)', color: 'var(--red, #b03030)', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}
                    >
                      Treu-lo
                    </span>
                  )}
                </button>

                {obert && (
                  <div style={{ padding: '0 12px 12px' }} className="taula-scroll">
                    {delTrimestre.length === 0 ? (
                      <p className="nota">Aquest curs no té dades del {trimestre}.</p>
                    ) : (
                      <table className="taula-dades" style={{ fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th>Àrea</th>
                            <th>Classe</th>
                            {FRANGES.map((f) => <th key={f.id} className="num">{f.label}</th>)}
                            <th className="num">Total</th>
                            <th className="num">% supera</th>
                          </tr>
                        </thead>
                        <tbody>
                          {areesDe(delTrimestre).map((area) => {
                            const delArea = delTrimestre.filter((f) => f.area === area.id)
                            const tot = totalCentre(delArea, {})
                            return [
                              ...classesDe(delArea).map((classe) => {
                                const f = delArea.find((x) => x.classe === classe)
                                return (
                                  <tr key={`${area.id}__${classe}`}>
                                    <td style={{ color: 'var(--ink-soft)' }}>{area.label}</td>
                                    <td>{classe}</td>
                                    {FRANGES.map((fr) => <td key={fr.id} className="num">{f[fr.id]}</td>)}
                                    <td className="num">{f.total}</td>
                                    <td className="num">{percentatgeSuperacio(f)}%</td>
                                  </tr>
                                )
                              }),
                              <tr key={`${area.id}__total`} style={{ fontWeight: 700 }}>
                                <td>{area.label}</td>
                                <td>TOTAL</td>
                                {FRANGES.map((fr) => <td key={fr.id} className="num">{tot[fr.id]}</td>)}
                                <td className="num">{tot.total}</td>
                                <td className="num">{percentatgeSuperacio(tot)}%</td>
                              </tr>,
                            ]
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
