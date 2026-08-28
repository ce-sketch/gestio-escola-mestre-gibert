import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDocs, query, setDoc, deleteDoc, where, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import { cursEscolarActual } from '../../../lib/cursEscolar'
import { TRIMESTRES, AREES } from '../../../lib/notesArea'
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
  // El curs al qual pertany el full que es puja. Es demana ABANS, com a
  // l'Històric d'Innovamat: així se sap sempre quin any s'està carregant.
  // El fitxer sol portar-lo escrit a dins ("Curs: 2023-24"); si el porta
  // i no coincideix amb el que s'ha triat, es diu, però mana el triat.
  const [cursCarrega, setCursCarrega] = useState('')
  const [trimestre, setTrimestre] = useState('3r trimestre')
  const [cursObert, setCursObert] = useState(null)
  // Esborrar un curs sencer de l'històric no es pot desfer des de l'app
  // (si venia d'un full antic, caldria tornar-lo a pujar). Amb un simple
  // clic era massa fàcil prémer'l sense voler mentre es despleguen els
  // cursos amb la fletxa — el mateix parany que ja vam trobar a
  // l'Innovamat. Cal escriure el curs exacte per confirmar-ho.
  const [cursPerEsborrar, setCursPerEsborrar] = useState(null)
  const [confirmaEsborraCurs, setConfirmaEsborraCurs] = useState('')

  useEffect(() => { carrega() }, [])

  async function carrega() {
    setCarregant(true)
    setError(null)
    try {
      // ⚠️ NOMÉS el curs en marxa, no tots els anys.
      //
      // Llegir totes les notes de tota la història sortiria a ~10.800
      // documents per any acumulat (400 alumnes × 9 àrees × 3 trimestres),
      // i Firestore factura per document llegit: als deu cursos serien
      // més de cent mil lectures cada vegada que algú obre la pantalla.
      //
      // Els cursos passats no cal recalcular-los mai: ja no canviaran. Es
      // desen una vegada com a resum a "historicNotaArea" (uns quants
      // documents en total) i es llegeixen d'allà.
      const [snapDesats, snapNotes] = await Promise.all([
        getDocs(collection(db, 'historicNotaArea')),
        getDocs(query(
          collection(db, 'avaluacio'),
          where('tipus', '==', 'nota_area'),
          where('cursEscolar', '==', cursEscolarActual()),
        )),
      ])
      setCursosDesats(snapDesats.docs.map((d) => ({ id: d.id, ...d.data() })))
      setRegistres(snapNotes.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      setError(err.message)
    } finally {
      setCarregant(false)
    }
  }

  const curs = cursEscolarActual()
  const filesActuals = useMemo(() => resumDesDeRegistres(registres, curs), [registres, curs])
  const cursos = useMemo(
    () => fusionaHistoric(cursosDesats, filesActuals.length > 0 ? { [curs]: filesActuals } : {}),
    [filesActuals, cursosDesats, curs]
  )

  // El curs en marxa es recalcula sempre de les notes; els passats es
  // llegeixen del resum desat. Perquè el curs d'enguany hi sigui l'any
  // que ve, se n'ha de deixar la foto feta: es desa sola quan hi ha
  // canvis i qui mira la pantalla té permís per escriure-hi.
  const desatActual = cursosDesats.find((c) => c.cursEscolar === curs)
  const calFotografiar = filesActuals.length > 0
    && JSON.stringify(desatActual?.files ?? []) !== JSON.stringify(filesActuals)

  useEffect(() => {
    if (!calFotografiar || carregant || desant) return
    let viu = true
    setDoc(doc(db, 'historicNotaArea', curs), {
      cursEscolar: curs,
      files: filesActuals,
      origenFitxer: null,
      actualitzatEl: serverTimestamp(),
      actualitzatPer: auth.currentUser?.email ?? null,
    })
      // Si l'usuari no té permís d'escriptura, no passa res: la pantalla
      // segueix mostrant el curs en marxa calculat en directe. La foto ja
      // la desarà qui pugui.
      .then(() => { if (viu) setCursosDesats((a) => [
        ...a.filter((c) => c.cursEscolar !== curs),
        { id: curs, cursEscolar: curs, files: filesActuals },
      ]) })
      .catch(() => {})
    return () => { viu = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calFotografiar, carregant])

  const arees = useMemo(() => areesDe(cursos.flatMap((c) => c.files)), [cursos])

  // ── Importar un curs antic ──────────────────────────────────────────
  async function puja(e) {
    const fitxer = e?.target?.files?.[0] ?? e
    if (!fitxer) return
    setLlegint(true)
    setMissatge(null)
    setError(null)
    try {
      const resultat = await llegeixResumNotaArea(await fitxer.arrayBuffer(), fitxer.name)
      // Mana el curs que s'ha triat a dalt. Si el camp és buit (perquè
      // encara no s'ha omplert), s'agafa el que digui el fitxer.
      const triat = cursCarrega.trim() || resultat.cursEscolar || ''
      if (triat && !cursCarrega.trim()) setCursCarrega(triat)
      setProposta({ ...resultat, fitxer: fitxer.name, curs: triat })
    } catch (err) {
      setError(err.message)
      setProposta(null)
    } finally {
      setLlegint(false)
    }
  }

  async function desaProposta() {
    const any = cursCarrega.trim()
    if (!any) {
      setError("Falta dir de quin curs escolar és el full (el camp de dalt).")
      return
    }
    setDesant(true)
    try {
      await setDoc(doc(db, 'historicNotaArea', any), {
        cursEscolar: any,
        files: proposta.files,
        origenFitxer: proposta.fitxer ?? null,
        actualitzatEl: serverTimestamp(),
        actualitzatPer: auth.currentUser?.email ?? null,
      })
      setMissatge(`Curs ${any} desat, amb ${proposta.files.length} files.`)
      setProposta(null)
      // Es buida perquè el curs següent no hereti l'any de l'anterior:
      // importar quatre cursos seguits és justament el cas d'ús, i
      // desar-ne un a sobre d'un altre no es podria desfer.
      setCursCarrega('')
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
      setCursPerEsborrar(null)
      setConfirmaEsborraCurs('')
      if (cursObert === cursEscolar) setCursObert(null)
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
          fullEvolucioNotaArea(cursos, { trimestre }),
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

      {/* Les descàrregues van a dalt i amb etiqueta, com a la resta
          d'històrics: abans quedaven empeses a la dreta de la fila del
          selector de trimestre i costaven de veure. */}
      {cursos.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 14 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Descarrega l&apos;històric:</span>
          <button type="button" onClick={() => descarrega('excel')} disabled={exportant}
            className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}>
            {exportant ? 'Generant…' : '⬇ Excel'}
          </button>
          <button type="button" onClick={() => descarrega('pdf')} disabled={exportant}
            className="btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }}>
            ⬇ PDF
          </button>
          <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
            ({cursos.length} curs{cursos.length === 1 ? '' : 'os'}: evolució + detall)
          </span>
        </div>
      )}

      {/* ── Importar un curs antic ──────────────────────────────────── */}
      <div className="caixa-discreta" style={{ marginTop: 16 }}>
        <strong style={{ fontSize: 14 }}>Afegeix un curs d&apos;abans de l&apos;app</strong>
        <p className="nota">
          Puja el fitxer de la graella de notes d&apos;aquell any, en <strong>PDF</strong> o
          en <strong>.xlsx</strong>. Se n&apos;llegeixen només els resums per trimestre; els
          fulls amb les notes de cada alumne s&apos;ignoren. Del PDF, els trimestres es
          dedueixen de l&apos;ordre de les pàgines de resum.
        </p>
        <label className="field" style={{ maxWidth: 140, marginTop: 10 }}>
          <span>Curs escolar del full</span>
          <input
            type="text"
            value={cursCarrega}
            onChange={(e) => setCursCarrega(e.target.value)}
            placeholder="2023-24"
            className="camp camp-destacat"
          />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <BotoDrive
            onFitxer={puja}
            onError={(text) => setError(text)}
            disabled={llegint}
            tipus="fulls_o_pdf"
            etiqueta="Tria el full o el PDF del Drive"
          />
          <label className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', cursor: llegint ? 'wait' : 'pointer' }}>
            {llegint ? 'Llegint…' : '📤 Puja el PDF o l\'Excel'}
            <input type="file" accept=".pdf,.xlsx,.xlsm" style={{ display: 'none' }} disabled={llegint}
              onChange={(e) => { puja(e); e.target.value = '' }} />
          </label>
        </div>

        {proposta && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <strong style={{ fontSize: 13 }}>
              {proposta.files.length} files llegides de &quot;{proposta.fitxer}&quot;
              {proposta.format === 'pdf' && <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}> (PDF)</span>}
              {' '}({trimestresDe(proposta.files).length} trimestres,
              {' '}{areesDe(proposta.files).length} àrees)
            </strong>
            {proposta.avisos.map((a, i) => <p key={i} className="nota nota-avis">{a}</p>)}

            {/* Un sol lloc per triar el curs: el camp de dalt. Aquí només
                es recorda a quin es desarà, perquè no calgui pujar amunt
                a comprovar-ho abans de prémer "Desa". */}
            <p className="nota" style={{ marginTop: 8 }}>
              Es desarà com a curs <strong>{cursCarrega.trim() || '(cap: omple el camp de dalt)'}</strong>.
            </p>
            {proposta.cursEscolar && cursCarrega.trim() && proposta.cursEscolar !== cursCarrega.trim() && (
              <p className="nota nota-avis">
                Compte: el fitxer diu que és del curs <strong>{proposta.cursEscolar}</strong> i
                l&apos;estàs desant com a <strong>{cursCarrega.trim()}</strong>. Si t&apos;has
                equivocat, canvia el camp de dalt abans de desar.
              </p>
            )}
            {cursos.some((c) => c.cursEscolar === cursCarrega.trim() && c.origen === 'calculat') && (
              <p className="nota nota-avis">
                El curs {cursCarrega.trim()} ja es calcula de les notes desades a l&apos;app. Es
                desarà igualment, però l&apos;històric seguirà mostrant les calculades, que
                vénen de les notes una per una.
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                type="button"
                onClick={desaProposta}
                disabled={desant || !cursCarrega.trim()}
                className="btn-primary"
                style={{ maxWidth: 220 }}
              >
                {desant ? 'Desant…' : `Desa el curs ${cursCarrega.trim() || '…'}`}
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
                        totalCentre(c.files, { area: area.id, trimestre }))
                      return (
                        <td key={c.cursEscolar} className="num">
                          {pct === null ? <span style={{ color: 'var(--line)' }}>—</span> : `${pct}%`}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr style={{ fontWeight: 700, borderTop: '2px solid var(--line)' }}>
                  <td>GLOBAL</td>
                  {[...cursos].reverse().map((c) => {
                    // Sobre el total d'avaluacions, no la mitjana dels
                    // percentatges: una àrea amb 20 alumnes no pot pesar
                    // igual que una amb 300. Les calculades (Medi global,
                    // Artística) en queden fora, o es comptarien dues
                    // vegades els mateixos alumnes.
                    const reals = c.files.filter((f) => !AREES.some((a) => a.calculada && a.id === f.area))
                    const pct = percentatgeSuperacio(totalCentre(reals, { trimestre }))
                    return (
                      <td key={c.cursEscolar} className="num">
                        {pct === null ? <span style={{ color: 'var(--line)' }}>—</span> : `${pct}%`}
                      </td>
                    )
                  })}
                </tr>
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
                      onClick={(e) => { e.stopPropagation(); setCursPerEsborrar(c.cursEscolar); setConfirmaEsborraCurs('') }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setCursPerEsborrar(c.cursEscolar); setConfirmaEsborraCurs('') } }}
                      style={{ marginLeft: 'auto', border: '1px solid var(--red, #b03030)', color: 'var(--red, #b03030)', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}
                    >
                      Treu-lo
                    </span>
                  )}
                </button>

                {/* Segon pas obligatori: cal escriure el curs exacte.
                    Esborrar-lo no es pot desfer des de l'app. */}
                {cursPerEsborrar === c.cursEscolar && (
                  <div className="caixa-discreta" style={{ margin: '0 12px 12px', borderColor: 'var(--red, #b03030)' }}>
                    <strong style={{ fontSize: 12, color: 'var(--red, #b03030)' }}>
                      Treure el curs {c.cursEscolar} de l&apos;històric?
                    </strong>
                    <p className="nota">
                      S&apos;esborraran les {c.files.length} files desades. <strong>Aquesta acció no es
                      pot desfer des de l&apos;app</strong> — si el curs venia d&apos;un full antic,
                      caldria tornar-lo a pujar. Escriu <strong>{c.cursEscolar}</strong> per confirmar-ho.
                    </p>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        value={confirmaEsborraCurs}
                        onChange={(e) => setConfirmaEsborraCurs(e.target.value)}
                        placeholder={c.cursEscolar}
                        className="camp camp-petit"
                        style={{ maxWidth: 120 }}
                      />
                      <button
                        type="button"
                        onClick={() => esborraCurs(c.cursEscolar)}
                        disabled={desant || confirmaEsborraCurs !== c.cursEscolar}
                        style={{
                          background: confirmaEsborraCurs === c.cursEscolar ? 'var(--red, #b03030)' : 'var(--line)',
                          color: confirmaEsborraCurs === c.cursEscolar ? '#fff' : 'var(--ink-soft)',
                          border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11,
                          cursor: confirmaEsborraCurs === c.cursEscolar ? 'pointer' : 'not-allowed',
                        }}
                      >
                        {desant ? 'Esborrant…' : 'Treu-lo definitivament'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setCursPerEsborrar(null); setConfirmaEsborraCurs('') }}
                        disabled={desant}
                        style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
                      >
                        Cancel·la
                      </button>
                    </div>
                  </div>
                )}

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
