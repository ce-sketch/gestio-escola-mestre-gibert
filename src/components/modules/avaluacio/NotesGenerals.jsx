import { Fragment, useEffect, useMemo, useState } from 'react'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import { nivellDe, redueixVigents } from '../../../lib/avaluacioCatala'
import { AREES, TRIMESTRES, areaAplicaAClasse, interpretaDictatNotesArea, notaFinalArea } from '../../../lib/notesArea'
import { cursEscolarActual } from '../../../lib/cursEscolar'
import { grauPrimaria } from '../../../lib/rubricaLectura'
import { exportaExcel, exportaPDF } from '../../../lib/exportTaula'

/**
 * Entrada de notes de totes les àrees (no només Català). El resum de tot
 * el centre viu a part, a la pestanya "Resum per àrea" de "Resums i
 * informes" — abans hi havia les dues coses juntes en aquest mateix
 * component, amb un selector "Entrada de notes / Resum escola" a dalt.
 */
export default function NotesGenerals() {
  const [alumnesTots, setAlumnesTots] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [registres, setRegistres] = useState([])
  const [missatge, setMissatge] = useState(null)

  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [trimestre, setTrimestre] = useState(TRIMESTRES[0])
  const [classe, setClasse] = useState('')
  const [valors, setValors] = useState({})
  const [desantClau, setDesantClau] = useState(null) // clau "alumneId__areaId" que s'està desant
  const [dictat, setDictat] = useState(null) // { escoltant, transcripcio, resultat: {numLlista: {areaId: nivellId}} }

  useEffect(() => {
    async function carrega() {
      try {
        const [snapAlumnes, snapNotes] = await Promise.all([
          getDocs(query(collection(db, 'alumnes'), where('actiu', '==', true))),
          // Filtrem només per 'tipus' aquí (sense combinar més camps en la
          // consulta) per no necessitar crear cap índex compost nou a
          // Firestore. Amb el volum d'alumnes del centre, filtrar la resta
          // (curs escolar, trimestre, classe...) al navegador va prou bé.
          getDocs(query(collection(db, 'avaluacio'), where('tipus', '==', 'nota_area'))),
        ])
        const llista = snapAlumnes.docs.map((d) => ({ id: d.id, ...d.data() }))
        llista.sort((a, b) => (a.numLlista ?? 999) - (b.numLlista ?? 999) || a.nom.localeCompare(b.nom))
        setAlumnesTots(llista)
        const primeraClassePrimaria = [...new Set(llista.map((a) => a.curs))]
          .filter((c) => grauPrimaria(c) !== null)
          .sort()[0]
        if (primeraClassePrimaria) setClasse((c) => c || primeraClassePrimaria)
        setRegistres(snapNotes.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'han pogut carregar les dades: ${err.message}` })
      } finally {
        setCarregant(false)
      }
    }
    carrega()
  }, [])

  const classes = useMemo(
    () => [...new Set(alumnesTots.map((a) => a.curs))].filter((c) => grauPrimaria(c) !== null).sort(),
    [alumnesTots]
  )
  const alumnesClasse = useMemo(() => alumnesTots.filter((a) => a.curs === classe), [alumnesTots, classe])
  const areesClasse = useMemo(() => AREES.filter((a) => areaAplicaAClasse(a.id, classe)), [classe])

  // Vigents per a la classe actual (curs escolar), amb els TRES trimestres i
  // TOTES les àrees alhora — clau alumne+àrea+trimestre, tal com als fulls
  // per classe de l'Excel (1A, 1B...), on cada àrea té una columna per
  // trimestre més una de "Final". El selector de Trimestre ja no filtra
  // aquesta llista: només diu a quina columna escriu una nota nova.
  const vigentsClasse = useMemo(
    () => redueixVigents(
      registres.filter((r) => r.curs === classe && (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId),
      (r) => `${r.alumneId}__${r.area}__${r.trimestre}`
    ),
    [registres, classe, cursEscolarId]
  )

  // Igual que `vigentsClasse`, però de TOTES les classes alhora — només fa
  // falta per a la descàrrega de "totes les classes", que no es limita a
  // la que hi ha oberta al desplegable.
  const vigentsTotes = useMemo(
    () => redueixVigents(
      registres.filter((r) => (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId),
      (r) => `${r.alumneId}__${r.area}__${r.trimestre}`
    ),
    [registres, cursEscolarId]
  )

  function clauValor(alumneId, areaId, trim = trimestre) {
    return `${alumneId}__${areaId}__${trim}`
  }

  /** La nota d'un alumne, una àrea i UN trimestre concret. Les edicions
   *  locals encara no desades (`valors`) només existeixen per al trimestre
   *  actiu al selector, que és l'únic que es pot editar — i només dins de
   *  la classe oberta ara mateix a la pantalla.
   *
   *  Rep la classe com a paràmetre (i no la variable `classe` de l'estat)
   *  perquè la descàrrega de "totes les classes" ha de poder consultar
   *  qualsevol classe, no només la que hi ha oberta al desplegable. */
  function notaAlumneTrimestreDe(classeAlumne, alumneId, areaId, trim) {
    const clau = clauValor(alumneId, areaId, trim)
    if (classeAlumne === classe && trim === trimestre && valors[clau] !== undefined) return valors[clau]
    const existent = vigentsTotes.find((r) =>
      r.curs === classeAlumne && r.alumneId === alumneId && r.area === areaId && r.trimestre === trim
    )
    return existent?.nota ?? ''
  }

  function notaAlumneTrimestre(alumneId, areaId, trim) {
    return notaAlumneTrimestreDe(classe, alumneId, areaId, trim)
  }

  /** Nota final de l'àrea: la mitjana dels trimestres que l'alumne ja tingui
   *  avaluats (no cal esperar que hi siguin els tres). */
  function notaFinalAlumneAreaDe(classeAlumne, alumneId, areaId) {
    return notaFinalArea(TRIMESTRES.map((t) => notaAlumneTrimestreDe(classeAlumne, alumneId, areaId, t)))
  }

  function notaFinalAlumneArea(alumneId, areaId) {
    return notaFinalAlumneAreaDe(classe, alumneId, areaId)
  }

  async function desaCella(alumne, area, valorText) {
    const clau = clauValor(alumne.id, area.id)
    if (valorText === '') {
      // Casella buidada: només oblidem l'edició local, no cal escriure res.
      setValors((prev) => { const n = { ...prev }; delete n[clau]; return n })
      return
    }
    const nota = Number(valorText)
    if (Number.isNaN(nota)) return

    // Si el valor no ha canviat respecte al que ja hi havia desat, no cal
    // tornar a escriure res (evita omplir Firestore de registres iguals
    // cada vegada que es passa pel camp sense modificar-lo).
    const actual = vigentsClasse.find((r) => r.alumneId === alumne.id && r.area === area.id && r.trimestre === trimestre)?.nota
    if (actual === nota) {
      setValors((prev) => { const n = { ...prev }; delete n[clau]; return n })
      return
    }

    setDesantClau(clau)
    setMissatge(null)
    try {
      await addDoc(collection(db, 'avaluacio'), {
        tipus: 'nota_area',
        area: area.id,
        alumneId: alumne.id,
        alumneNom: alumne.nom,
        curs: classe,
        cursEscolar: cursEscolarId,
        trimestre,
        nota,
        creatEl: serverTimestamp(),
        creatPer: auth.currentUser?.email ?? null,
      })
      const snapNotes = await getDocs(query(collection(db, 'avaluacio'), where('tipus', '==', 'nota_area')))
      setRegistres(snapNotes.docs.map((d) => ({ id: d.id, ...d.data() })))
      setValors((prev) => { const n = { ...prev }; delete n[clau]; return n })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar la nota de ${alumne.nom} (${area.label}): ${err.message}` })
    } finally {
      setDesantClau(null)
    }
  }

  // Valor numèric representatiu de cada nivell qualitatiu, per quan
  // s'introdueix la nota per veu (aquest mòdul fa servir notes 0-10, no
  // un desplegable de nivells) — cada valor cau clarament dins de la
  // banda corresponent segons nivellDe().
  const NOTA_REPRESENTATIVA = {
    no_assoliment: 4,
    assoliment_satisfactori: 6,
    assoliment_notable: 8,
    'assoliment_excel·lent': 9.5,
  }

  function iniciaDictat() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setMissatge({ type: 'error', text: 'Aquest navegador no permet el dictat per veu. Prova-ho amb Chrome.' })
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'ca-ES'
    recognition.interimResults = false

    setDictat({ escoltant: true, transcripcio: '', resultat: {} })

    recognition.onresult = (event) => {
      const transcripcio = event.results[0][0].transcript
      const resultat = interpretaDictatNotesArea(transcripcio)
      setDictat({ escoltant: false, transcripcio, resultat })
    }
    recognition.onerror = () => {
      setDictat(null)
      setMissatge({ type: 'error', text: 'No s\'ha pogut entendre el dictat. Torna-ho a provar.' })
    }
    recognition.start()
  }

  async function aplicaDictat() {
    if (!dictat) return
    const entrades = []
    Object.entries(dictat.resultat).forEach(([numLlista, notesPerArea]) => {
      const alumne = alumnesClasse.find((a) => String(a.numLlista) === numLlista)
      if (!alumne) return
      Object.entries(notesPerArea).forEach(([areaId, nivellId]) => {
        const nota = NOTA_REPRESENTATIVA[nivellId]
        if (nota === undefined) return
        const area = areesClasse.find((a) => a.id === areaId)
        if (!area) return
        entrades.push({ alumne, area, nota: String(nota) })
      })
    })
    for (const { alumne, area, nota } of entrades) {
      await desaCella(alumne, area, nota)
    }
    setMissatge({ type: 'ok', text: `${entrades.length} notes dictades i desades directament (són valors orientatius dins la banda dita).` })
    setDictat(null)
  }

  function taulaClasseActual() {
    const capçalera = ['Núm.', 'Alumne', ...areesClasse.flatMap((a) => [`${a.label} 1r`, `${a.label} 2n`, `${a.label} 3r`, `${a.label} Final`])]
    const files = alumnesClasse.map((alumne) => [
      alumne.numLlista ?? '',
      alumne.nom,
      ...areesClasse.flatMap((a) => [
        ...TRIMESTRES.map((t) => (a.calculada ? '' : notaAlumneTrimestre(alumne.id, a.id, t))),
        (a.calculada
          ? notaFinalArea(a.deArees.map((id) => notaFinalAlumneArea(alumne.id, id)))
          : notaFinalAlumneArea(alumne.id, a.id)) ?? '',
      ]),
    ])
    return [{ nom: `Notes ${classe}`, files: [capçalera, ...files] }]
  }

  /**
   * Un full per cada classe de primària, amb la mateixa forma que
   * `taulaClasseActual`. Cada classe pot tenir àrees diferents (p. ex.
   * "Science" només a partir de 3r), i per això les columnes no es poden
   * calcular un sol cop per a totes: es recalculen classe per classe.
   */
  if (carregant) return <p>Carregant…</p>

  return (
    <div>
      <p className="module-lead">
        Entrada de notes de totes les àrees (no només Català). El resum de tot el centre és a la
        pestanya &quot;Resum per àrea&quot;, dins de &quot;Resums i informes&quot;.
      </p>

      <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
        <label className="field" style={{ minWidth: 120 }}>
          <span>Curs escolar</span>
          <input
            type="text"
            value={cursEscolarId}
            onChange={(e) => setCursEscolarId(e.target.value)}
            style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', fontWeight: 600 }}
          />
        </label>
        <label className="field" style={{ minWidth: 160 }}>
          <span>Trimestre</span>
          <select value={trimestre} onChange={(e) => setTrimestre(e.target.value)} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
            {TRIMESTRES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="field" style={{ minWidth: 160 }}>
          <span>Classe</span>
          <select value={classe} onChange={(e) => setClasse(e.target.value)} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      <>
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
            Cada àrea mostra els tres trimestres i la nota Final (la mitjana dels trimestres ja
            avaluats). El selector de Trimestre només diu a quina columna s'escriu una nota nova
            — la columna en blau és l'editable ara mateix. Vora vermella = nota per sota de 5
            (No Assoliment), igual que al full de càlcul. <strong>Artística *</strong> no s'omple
            directament: la seva Final és la mitjana de les Finals de Plàstica i Música.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <button
              className="btn-ghost"
              style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
              onClick={() => exportaExcel(`Notes-${classe}-${trimestre.replace(/\s+/g, '_')}`, { cursEscolarId, fulls: taulaClasseActual(), etiqueta: 'Avaluació' })}
              type="button"
            >
              📥 Descarrega Excel ({classe})
            </button>
            <button
              className="btn-ghost"
              style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
              onClick={() => exportaPDF(`Notes per àrea — ${classe} — ${trimestre}`, { cursEscolarId, fulls: taulaClasseActual() })}
              type="button"
            >
              📄 Descarrega PDF ({classe})
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6 }}>
            Per baixar totes les classes de cop, ves a la pestanya &quot;Descàrregues&quot;, dins
            de &quot;Resums i informes&quot;.
          </p>
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', marginTop: 0 }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th rowSpan={2} style={{ padding: '6px 8px', minWidth: 44, borderBottom: '2px solid var(--line)' }}>Núm.</th>
                  <th rowSpan={2} style={{ padding: '6px 8px', minWidth: 180, position: 'sticky', left: 0, background: 'var(--bg)', borderBottom: '2px solid var(--line)' }}>Alumne</th>
                  {areesClasse.map((a) => (
                    <th key={a.id} colSpan={4} style={{ padding: '4px', fontSize: 11, textAlign: 'center', borderLeft: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
                      {a.label}{a.calculada && <span title="Mitjana de Plàstica i Música" style={{ color: 'var(--ink-soft)', fontWeight: 400 }}> *</span>}
                    </th>
                  ))}
                </tr>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                  {areesClasse.map((a) => (
                    <Fragment key={a.id}>
                      {TRIMESTRES.map((t, ti) => (
                        <th
                          key={`${a.id}-${t}`}
                          style={{
                            padding: '4px 3px', minWidth: 46, fontSize: 10, fontWeight: t === trimestre ? 700 : 400,
                            color: t === trimestre ? 'var(--navy)' : 'var(--ink-soft)',
                            borderLeft: ti === 0 ? '1px solid var(--line)' : 'none',
                          }}
                        >
                          {t.slice(0, 2)}
                        </th>
                      ))}
                      <th key={`${a.id}-final`} style={{ padding: '4px 3px', minWidth: 50, fontSize: 10, color: 'var(--ink-soft)' }}>
                        Final
                      </th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alumnesClasse.map((alumne) => (
                  <tr key={alumne.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 8px', color: 'var(--ink-soft)' }}>{alumne.numLlista ?? '—'}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 500, position: 'sticky', left: 0, background: 'var(--bg)' }}>{alumne.nom}</td>
                    {areesClasse.map((a) => {
                      const final = a.calculada
                        ? notaFinalArea(a.deArees.map((id) => notaFinalAlumneArea(alumne.id, id)))
                        : notaFinalAlumneArea(alumne.id, a.id)
                      const nivellFinal = final !== null ? nivellDe(final) : null
                      return (
                        <Fragment key={a.id}>
                          {TRIMESTRES.map((t, ti) => {
                            // Artística no s'introdueix directament: només en
                            // surt la Final, calculada de Plàstica i Música.
                            if (a.calculada) {
                              return (
                                <td key={t} style={{ padding: '4px 3px', textAlign: 'center', borderLeft: ti === 0 ? '1px solid var(--line)' : 'none', color: 'var(--ink-soft)' }}>
                                  —
                                </td>
                              )
                            }
                            const nota = notaAlumneTrimestre(alumne.id, a.id, t)
                            const nivell = nota !== '' ? nivellDe(Number(nota)) : null
                            const clau = clauValor(alumne.id, a.id, t)
                            const esActiu = t === trimestre
                            const estaDesant = esActiu && desantClau === clau

                            // Només el trimestre triat al selector és editable — els
                            // altres dos es veuen però es toquen des del seu propi
                            // trimestre.
                            if (!esActiu) {
                              return (
                                <td key={t} style={{ padding: '4px 3px', textAlign: 'center', borderLeft: ti === 0 ? '1px solid var(--line)' : 'none', color: nivell?.id === 'no_assoliment' ? 'var(--red)' : 'var(--ink)' }}>
                                  {nota !== '' ? nota : '—'}
                                </td>
                              )
                            }
                            return (
                              <td key={t} style={{ padding: '4px 3px', position: 'relative', borderLeft: ti === 0 ? '1px solid var(--line)' : 'none' }}>
                                <input
                                  type="number"
                                  min={0}
                                  max={10}
                                  step={0.1}
                                  value={nota}
                                  disabled={estaDesant}
                                  onChange={(e) => setValors((prev) => ({ ...prev, [clau]: e.target.value }))}
                                  onBlur={(e) => desaCella(alumne, a, e.target.value)}
                                  style={{
                                    border: `1.5px solid ${estaDesant ? 'var(--amber-dark)' : nivell?.id === 'no_assoliment' ? 'var(--red)' : 'var(--navy)'}`,
                                    borderRadius: 6,
                                    padding: '4px 4px',
                                    fontSize: 12,
                                    width: 44,
                                  }}
                                />
                              </td>
                            )
                          })}
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 700, color: nivellFinal?.color ?? 'var(--ink-soft)' }}>
                            {final ?? '—'}
                          </td>
                        </Fragment>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8 }}>
            Cada nota es desa sola en sortir de la casella (no cal cap botó "Desa") — així no es
            perd res encara que es tanqui la pestanya sense voler.
          </p>

          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className="btn-ghost"
              style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
              onClick={iniciaDictat}
              type="button"
            >
              🎤 Dicta notes
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 6, lineHeight: 1.6 }}>
            <p>
              Format: "Alumne [número] [àrea] [nivell], [àrea] [nivell]..., alumne [número] [àrea] [nivell]...".
              Es poden dictar diverses àrees seguides per al mateix alumne, i tants alumnes com calgui d'un cop.
            </p>
            <p style={{ marginTop: 4 }}>
              <strong>Nivells:</strong> excel·lent (9,5) · notable (8) · satisfactori (6) · no assoliment o insuficient (4)
            </p>
            <p style={{ marginTop: 4 }}>
              <strong>Àrees:</strong> català · castellà · anglès · matemàtiques (o mates) · medi · science ·
              plàstica · música · educació física (o ed. física / gimnàstica) · religió (o valors)
            </p>
            <p style={{ marginTop: 4 }}>
              Exemple: "Alumne 3 català notable matemàtiques excel·lent, alumne 7 castellà satisfactori"
            </p>
          </div>

          {dictat && (
            <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 16 }}>
              {dictat.escoltant ? (
                <p>Escoltant… digues, per exemple, "Alumne 3 català notable, matemàtiques excel·lent, alumne 7 castellà satisfactori".</p>
              ) : Object.keys(dictat.resultat).length === 0 ? (
                <>
                  <p><strong>Sentit:</strong> "{dictat.transcripcio}"</p>
                  <p style={{ marginTop: 8, color: 'var(--red)' }}>No s'ha reconegut cap alumne/àrea. Torna-ho a provar dient "Alumne [número] [àrea] [nivell]".</p>
                  <button className="btn-ghost" style={{ maxWidth: 160, marginTop: 8 }} onClick={() => setDictat(null)} type="button">
                    Tanca
                  </button>
                </>
              ) : (
                <>
                  <p><strong>Sentit:</strong> "{dictat.transcripcio}"</p>
                  <p style={{ marginTop: 8 }}>Notes detectades:</p>
                  <ul className="roster" style={{ marginTop: 8 }}>
                    {Object.entries(dictat.resultat).map(([numLlista, notesPerArea]) => {
                      const alumne = alumnesClasse.find((a) => String(a.numLlista) === numLlista)
                      return (
                        <li key={numLlista} className="roster-row" style={{ display: 'block' }}>
                          <strong>{alumne ? alumne.nom : `Alumne ${numLlista} (no trobat a la classe)`}</strong>
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                            {Object.entries(notesPerArea).map(([areaId, nivellId]) => (
                              <span key={areaId} style={{ fontSize: 12 }}>
                                {AREES.find((a) => a.id === areaId)?.label}: <strong>{nivellId.replace('assoliment_', '').replace('no_assoliment', 'NA')}</strong>
                              </span>
                            ))}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button className="btn-primary" style={{ maxWidth: 160 }} onClick={aplicaDictat} type="button">
                      Aplica
                    </button>
                    <button className="btn-ghost" style={{ maxWidth: 160 }} onClick={() => setDictat(null)} type="button">
                      Cancel·la
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
          {missatge.text}
        </p>
      )}
    </div>
  )
}
