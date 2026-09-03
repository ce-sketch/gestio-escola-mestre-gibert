import { useEffect, useMemo, useState } from 'react'
import { collection, query, where, getDocs, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import { NIVELLS, nivellDe, nivellPerId, redueixVigents } from '../../../lib/avaluacioCatala'
import { NIVELLS_PER_CICLE, cicleDe, aEscalaComuna } from '../../../lib/rubricaTEE'
import { clAEscalaComuna, vlAEscalaComuna } from '../../../lib/rubricaLectura'
import { interpretaDictatNivellUnic } from '../../../lib/dictatTEE'
import { enviaAvis, WORKER_AVISOS_URL } from '../../../lib/email'
import { cursEscolarActual } from '../../../lib/cursEscolar'
import { exportaExcel, exportaPDF } from '../../../lib/exportTaula'
import { taulaPonderacioLlengua, carregaPonderacioLlengua, desaPonderacioLlengua, grupNivell } from '../../../lib/ponderacioLlengua'
import { campAreaPI } from '../../../lib/sicAlumnatIndicadors'
import { esAdmin } from '../../../lib/roles'

const TRIMESTRES = ['1r trimestre', '2n trimestre', '3r trimestre']
// Si la nota general és, com a mínim, aquests nivells millor que el pitjor
// resultat de TEE/CL, es considera una incoherència digna d'avís.
const LLINDAR_AVIS = 2

export default function NotaArea() {
  const [alumnesTots, setAlumnesTots] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [curs, setCurs] = useState('')
  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [trimestre, setTrimestre] = useState('1r trimestre')
  const [registresArea, setRegistresArea] = useState([])
  const [teeRegistres, setTeeRegistres] = useState([])
  const [lecturaRegistres, setLecturaRegistres] = useState([])
  const [notesAreaRegistres, setNotesAreaRegistres] = useState([]) // 'nota_area' (mòdul "Notes per àrea"), àrea català
  const [contactes, setContactes] = useState({})
  const [valors, setValors] = useState({})
  const [desantId, setDesantId] = useState(null) // id de l'alumne que s'està desant en aquest moment
  const [enviantAvis, setEnviantAvis] = useState(null)
  const [missatge, setMissatge] = useState(null)
  const [dictat, setDictat] = useState(null) // { escoltant, transcripcio, resultat: {numLlista: nivellId} }
  const [ponderacio, setPonderacio] = useState(null) // config de Firestore, o PONDERACIO_DEFECTE si no n'hi ha
  const [editantPonderacio, setEditantPonderacio] = useState(false)
  const [ponderacioEdicio, setPonderacioEdicio] = useState(null) // còpia editable mentre s'edita
  const [desantPonderacio, setDesantPonderacio] = useState(false)

  useEffect(() => {
    async function carrega() {
      try {
        const [snapAlumnes, snapContactes] = await Promise.all([
          getDocs(query(collection(db, 'alumnes'), where('actiu', '==', true))),
          getDoc(doc(db, 'configuracio', 'contactes')),
        ])
        const llista = snapAlumnes.docs.map((d) => ({ id: d.id, ...d.data() }))
        llista.sort((a, b) => (a.numLlista ?? 999) - (b.numLlista ?? 999) || a.nom.localeCompare(b.nom))
        setAlumnesTots(llista)
        if (llista.length > 0) setCurs((c) => c || llista[0].curs)
        if (snapContactes.exists()) setContactes(snapContactes.data())
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'han pogut carregar les dades: ${err.message}` })
      } finally {
        setCarregant(false)
      }
    }
    carrega()
  }, [])

  useEffect(() => {
    carregaPonderacioLlengua().then(setPonderacio).catch(() => setPonderacio(null))
  }, [])

  const cursos = useMemo(() => [...new Set(alumnesTots.map((a) => a.curs))].sort(), [alumnesTots])
  const alumnesClasse = useMemo(() => alumnesTots.filter((a) => a.curs === curs), [alumnesTots, curs])
  const cicle = cicleDe(curs)

  useEffect(() => {
    if (!curs) return
    carregaDades()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curs])

  async function carregaDades() {
    try {
      const [areaSnap, teeSnap, lecturaSnap, notesAreaSnap] = await Promise.all([
        getDocs(query(collection(db, 'avaluacio'), where('curs', '==', curs), where('tipus', '==', 'area_catala'))),
        getDocs(query(collection(db, 'avaluacio'), where('curs', '==', curs), where('tipus', '==', 'tee'))),
        getDocs(query(collection(db, 'avaluacio'), where('curs', '==', curs), where('tipus', '==', 'lectura'))),
        // Notes de l'àrea "Català" introduïdes des del mòdul "Notes per
        // àrea (totes)" — filtrem només per 'tipus' (sense combinar més
        // camps) per no necessitar cap índex compost nou.
        getDocs(query(collection(db, 'avaluacio'), where('tipus', '==', 'nota_area'))),
      ])
      setRegistresArea(areaSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setTeeRegistres(teeSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLecturaRegistres(lecturaSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setNotesAreaRegistres(
        notesAreaSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((r) => r.area === 'catala' && r.curs === curs)
      )
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'han pogut carregar les dades: ${err.message}` })
    }
  }

  const vigentsArea = useMemo(
    () => redueixVigents(
      registresArea.filter((r) => r.trimestre === trimestre && (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId),
      (r) => r.alumneId
    ),
    [registresArea, trimestre, cursEscolarId]
  )
  const vigentsTee = useMemo(
    () => redueixVigents(
      teeRegistres.filter((r) => r.trimestre === trimestre && (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId),
      (r) => r.alumneId
    ),
    [teeRegistres, trimestre, cursEscolarId]
  )
  // Fem servir el CL més recent de qualsevol moment (inicial/mitjana/final)
  // com a referència de lectura per a aquest trimestre i curs escolar.
  const vigentsLectura = useMemo(
    () => redueixVigents(
      lecturaRegistres.filter((r) => (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId),
      (r) => r.alumneId
    ),
    [lecturaRegistres, cursEscolarId]
  )

  const vigentsNotesArea = useMemo(
    () => redueixVigents(
      notesAreaRegistres.filter((r) => r.trimestre === trimestre && (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId),
      (r) => r.alumneId
    ),
    [notesAreaRegistres, trimestre, cursEscolarId]
  )

  function notaGeneralAlumne(alumneId) {
    if (valors[alumneId] !== undefined) return valors[alumneId]
    // 1a prioritat: una nota d'àrea ja desada explícitament aquí mateix.
    const explicita = vigentsArea.find((r) => r.alumneId === alumneId)?.nivell
    if (explicita) return explicita
    // 2a prioritat: si no hi ha res desat encara, s'omple sola amb la nota
    // de Català introduïda al mòdul "Notes per àrea" — estalvia
    // haver d'entrar la mateixa informació dues vegades. Es pot sobreescriure
    // igualment triant un altre valor al desplegable.
    const notaArea = vigentsNotesArea.find((r) => r.alumneId === alumneId)?.nota
    if (notaArea !== undefined) return nivellDe(notaArea)?.id ?? ''
    return ''
  }

  /** Diu si el valor mostrat ve auto-omplert de "Notes per àrea" (encara no
   *  hi ha res desat explícitament aquí) — per mostrar-ho amb una marca visual. */
  function esAutoOmplert(alumneId) {
    if (valors[alumneId] !== undefined) return false
    if (vigentsArea.find((r) => r.alumneId === alumneId)?.nivell) return false
    return vigentsNotesArea.find((r) => r.alumneId === alumneId)?.nota !== undefined
  }

  /** Compara la nota general amb TEE i CL, i diu si hi ha una incoherència gran. */
  function comprovaCoherencia(alumneId) {
    const notaGeneral = notaGeneralAlumne(alumneId)
    if (!notaGeneral) return null

    const tee = vigentsTee.find((r) => r.alumneId === alumneId)
    const lectura = vigentsLectura.find((r) => r.alumneId === alumneId)

    const nivellsComuns = []
    if (tee?.global) {
      const comu = aEscalaComuna(tee.global)
      if (comu) nivellsComuns.push({ origen: 'TEE', nivell: nivellPerId(comu) })
    }
    if (lectura?.nivellCl) {
      const comuCl = clAEscalaComuna(lectura.nivellCl)
      if (comuCl) nivellsComuns.push({ origen: 'CL', nivell: nivellPerId(comuCl) })
    }
    if (lectura?.vl !== undefined && lectura?.vl !== null) {
      const comuVl = vlAEscalaComuna(lectura.vl, lectura.nivellVl, curs)
      if (comuVl) nivellsComuns.push({ origen: 'VL', nivell: nivellPerId(comuVl) })
    }
    if (nivellsComuns.length === 0) return null

    const general = nivellPerId(notaGeneral)
    const pitjor = nivellsComuns.reduce((a, b) => (a.nivell.ordre <= b.nivell.ordre ? a : b))

    if (general.ordre - pitjor.nivell.ordre >= LLINDAR_AVIS) {
      return { general, pitjor: pitjor.nivell, origen: pitjor.origen }
    }
    return null
  }

  /** Taula de Nota d'àrea (Català) de LA CLASSE ACTUAL. */
  function taulaClasseActual() {
    const capçalera = ['Núm.', 'Alumne', 'Nota general Català', 'Coherència TEE/CL/VL']
    const files = alumnesClasse.map((alumne) => {
      const nivellId = notaGeneralAlumne(alumne.id)
      const incoherencia = comprovaCoherencia(alumne.id)
      return [
        alumne.numLlista ?? '',
        alumne.nom,
        nivellPerId(nivellId)?.label ?? '',
        incoherencia ? `Revisar (${incoherencia.origen}: ${incoherencia.pitjor.label})` : 'OK',
      ]
    })
    return [{ nom: `Nota d'àrea ${curs}`, files: [capçalera, ...files] }]
  }

  /** Desa la nota d'UN alumne a l'instant, en triar-la — no cal cap botó
   *  "Desa" ni recordar-se'n abans de tancar la pestanya. */
  async function desaUn(alumne, nivell) {
    setDesantId(alumne.id)
    setMissatge(null)
    try {
      await addDoc(collection(db, 'avaluacio'), {
        tipus: 'area_catala',
        alumneId: alumne.id,
        alumneNom: alumne.nom,
        curs,
        cursEscolar: cursEscolarId,
        trimestre,
        nivell,
        creatEl: serverTimestamp(),
        creatPer: auth.currentUser?.email ?? null,
      })
      const snap = await getDocs(query(collection(db, 'avaluacio'), where('curs', '==', curs), where('tipus', '==', 'area_catala')))
      setRegistresArea(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setValors((prev) => {
        const nou = { ...prev }
        delete nou[alumne.id]
        return nou
      })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar la nota de ${alumne.nom}: ${err.message}` })
    } finally {
      setDesantId(null)
    }
  }

  async function enviaAvisIncoherencia(alumne, incoherencia) {
    setEnviantAvis(alumne.id)
    const tutorEmail = contactes.tutors?.[curs]
    const destinataris = [...new Set([tutorEmail, 'ce@escolamestregibert.cat'].filter(Boolean))]
    try {
      await enviaAvis({
        destinataris,
        assumpte: `Revisió recomanada — nota de Català de ${alumne.nom} (${curs})`,
        cos: `
          <p>La nota general de Català de <strong>${alumne.nom}</strong> (${curs}, ${trimestre})
          és <strong>${incoherencia.general.label}</strong>, però el resultat de
          <strong>${incoherencia.origen}</strong> és <strong>${incoherencia.pitjor.label}</strong>.</p>
          <p>Es recomana revisar si la nota general reflecteix correctament els resultats de les proves.</p>
          <p>Avís generat automàticament per l'eina de gestió del centre.</p>
        `,
      })
      setMissatge({ type: 'ok', text: `Avís enviat sobre ${alumne.nom}.` })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut enviar l'avís: ${err.message}` })
    } finally {
      setEnviantAvis(null)
    }
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
      const resultat = interpretaDictatNivellUnic(transcripcio)
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
    const entrades = Object.entries(dictat.resultat)
      .map(([numLlista, nivellId]) => ({
        alumne: alumnesClasse.find((a) => String(a.numLlista) === numLlista),
        nivellId,
      }))
      .filter((e) => e.alumne)

    for (const { alumne, nivellId } of entrades) {
      await desaUn(alumne, nivellId)
    }
    setMissatge({ type: 'ok', text: `${entrades.length} notes dictades i desades directament.` })
    setDictat(null)
  }

  /** Comença a editar la ponderació del nivell de la classe oberta —
   *  només l'administrador hi arriba (el botó que ho crida ja només surt
   *  per a ell), però es comprova igualment per si algú hi arribés d'una
   *  altra manera. */
  function comencaEdicioPonderacio() {
    const grup = grupNivell(curs)
    if (!grup) return
    const taulaActual = taulaPonderacioLlengua(curs, ponderacio)
    // Còpia profunda: mentre s'edita, no es toca res del que ja es
    // mostra (si es cancel·la, no ha de quedar cap rastre del canvi).
    setPonderacioEdicio(taulaActual.periodes.map((p) => ({ ...p })))
    setEditantPonderacio(true)
  }

  function canviaCellaPonderacio(index, camp, valor) {
    setPonderacioEdicio((prev) => prev.map((p, i) => (i === index ? { ...p, [camp]: valor } : p)))
  }

  async function desaEdicioPonderacio() {
    const grup = grupNivell(curs)
    if (!grup) return
    setDesantPonderacio(true)
    try {
      const nova = { ...(ponderacio ?? {}), [grup]: { periodes: ponderacioEdicio } }
      await desaPonderacioLlengua(nova)
      setPonderacio(nova)
      setEditantPonderacio(false)
      setMissatge({ type: 'ok', text: 'Ponderació desada.' })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar la ponderació: ${err.message}` })
    } finally {
      setDesantPonderacio(false)
    }
  }

  if (carregant) return <p>Carregant…</p>

  return (
    <div>
      <p className="module-lead">
        Nota general de Català del trimestre (l'informe consolidat per àrees). Si ja has
        introduït la nota de Català al mòdul "Notes per àrea", aquí surt <strong>omplerta
        sola</strong> (marcada amb un asterisc) — la pots deixar tal qual o canviar-la manualment.
        L'app avisa automàticament si aquesta nota no quadra amb els resultats de TEE, CL o VL.
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
          <span>Classe</span>
          <select value={curs} onChange={(e) => setCurs(e.target.value)} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
            {cursos.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="field" style={{ minWidth: 160 }}>
          <span>Trimestre</span>
          <select value={trimestre} onChange={(e) => setTrimestre(e.target.value)} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
            {TRIMESTRES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>

      {!WORKER_AVISOS_URL && (
        <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 16, borderColor: 'var(--amber-dark)' }}>
          El servei d'enviament de correus encara no està configurat (mòdul Absentisme →
          worker-avisos). Mentrestant, les incoherències es mostraran igualment, però el
          botó d'avís no funcionarà.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
        <button
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
          onClick={() => exportaExcel(`Nota-area-catala-${curs}-${trimestre.replace(/\s+/g, '_')}`, { cursEscolarId, fulls: taulaClasseActual(), etiqueta: 'Avaluació' })}
          type="button"
        >
          📥 Descarrega Excel ({curs})
        </button>
        <button
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
          onClick={() => exportaPDF(`Nota d'àrea Català — ${curs} — ${trimestre}`, { cursEscolarId, fulls: taulaClasseActual(), etiqueta: 'Avaluació' })}
          type="button"
        >
          📄 Descarrega PDF ({curs})
        </button>
      </div>

      {(() => {
        const taula = taulaPonderacioLlengua(curs, ponderacio)
        if (!taula) return null
        const potEditar = esAdmin(auth.currentUser)
        return (
          <div className="caixa" style={{ marginTop: 16, maxWidth: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                  Ponderació qualificació de l&apos;àmbit lingüístic
                </p>
                <p className="nota" style={{ marginBottom: 8 }}>
                  Català i castellà, {curs}. Encara no calcula la nota — de moment és només
                  informativa (pendent de lligar-la amb TEE/CL/VL).
                </p>
              </div>
              {potEditar && !editantPonderacio && (
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: 12, padding: '4px 10px', color: 'var(--navy)', borderColor: 'var(--navy)', whiteSpace: 'nowrap' }}
                  onClick={comencaEdicioPonderacio}
                >
                  Edita
                </button>
              )}
            </div>

            {editantPonderacio ? (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-soft, #f5f5f0)', textAlign: 'left' }}>
                        <th style={{ padding: '4px 10px' }} />
                        {ponderacioEdicio.map((p, i) => (
                          <th key={i} style={{ padding: '4px 10px', fontWeight: 600 }}>
                            <input
                              type="text"
                              value={p.id}
                              onChange={(e) => canviaCellaPonderacio(i, 'id', e.target.value)}
                              style={{ width: 110, fontSize: 12, fontWeight: 600, border: '1px solid var(--line)', borderRadius: 4, padding: '2px 4px' }}
                            />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['comunicacioOral', 'Comunicació oral'],
                        ['expressioEscrita', 'Expressió escrita'],
                        ['comprensioLectora', 'Comprensió lectora'],
                      ].map(([camp, etiqueta]) => (
                        <tr key={camp} style={{ borderTop: '1px solid var(--line)' }}>
                          <td style={{ padding: '4px 10px', fontWeight: 500 }}>{etiqueta}</td>
                          {ponderacioEdicio.map((p, i) => (
                            <td key={i} style={{ padding: '4px 10px' }}>
                              <input
                                type="text"
                                value={p[camp]}
                                onChange={(e) => canviaCellaPonderacio(i, camp, e.target.value)}
                                style={{ width: 110, fontSize: 12, border: '1px solid var(--line)', borderRadius: 4, padding: '2px 4px' }}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ fontSize: 12, padding: '5px 12px', color: 'var(--navy)', borderColor: 'var(--navy)' }}
                    onClick={desaEdicioPonderacio}
                    disabled={desantPonderacio}
                  >
                    {desantPonderacio ? 'Desant…' : 'Desa'}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ fontSize: 12, padding: '5px 12px' }}
                    onClick={() => setEditantPonderacio(false)}
                    disabled={desantPonderacio}
                  >
                    Cancel·la
                  </button>
                </div>
              </>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-soft, #f5f5f0)', textAlign: 'left' }}>
                      <th style={{ padding: '4px 10px' }} />
                      {taula.periodes.map((p) => (
                        <th key={p.id} style={{ padding: '4px 10px', fontWeight: 600 }}>{p.id}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: '4px 10px', fontWeight: 500 }}>Comunicació oral</td>
                      {taula.periodes.map((p) => <td key={p.id} style={{ padding: '4px 10px' }}>{p.comunicacioOral}</td>)}
                    </tr>
                    <tr style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: '4px 10px', fontWeight: 500 }}>Expressió escrita</td>
                      {taula.periodes.map((p) => <td key={p.id} style={{ padding: '4px 10px' }}>{p.expressioEscrita}</td>)}
                    </tr>
                    <tr style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: '4px 10px', fontWeight: 500 }}>Comprensió lectora</td>
                      {taula.periodes.map((p) => <td key={p.id} style={{ padding: '4px 10px' }}>{p.comprensioLectora}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })()}

      <div className="taula-scroll">
        <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', marginTop: 12 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
              <th style={{ padding: '6px 8px', width: 44 }}>Núm.</th>
              <th style={{ padding: '6px 8px', minWidth: 160 }}>Alumne</th>
              <th style={{ padding: '6px 8px', minWidth: 160 }}>Nota general Català</th>
              <th style={{ padding: '6px 8px' }}>Coherència amb TEE/CL/VL</th>
            </tr>
          </thead>
          <tbody>
            {alumnesClasse.map((alumne) => {
              const incoherencia = comprovaCoherencia(alumne.id)
              const autoOmplert = esAutoOmplert(alumne.id)
              const esPI = Boolean(alumne[campAreaPI('catala')])
              const fons = notaGeneralAlumne(alumne.id) === 'no_assoliment'
                ? 'var(--red-soft, #FBD9D6)'
                : (esPI ? 'var(--green-soft, #D9F2DE)' : undefined)
              return (
                <tr key={alumne.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '6px 8px', color: 'var(--ink-soft)' }}>{alumne.numLlista ?? '—'}</td>
                  <td style={{ padding: '6px 8px', fontWeight: 500 }}>{alumne.nom}</td>
                  <td style={{ padding: '4px 6px', background: fons }}>
                    <select
                      value={notaGeneralAlumne(alumne.id)}
                      onChange={(e) => desaUn(alumne, e.target.value)}
                      disabled={desantId === alumne.id}
                      style={{
                        border: `1px solid ${autoOmplert ? 'var(--amber-dark)' : 'var(--line)'}`,
                        borderRadius: 6, padding: '4px 6px', fontSize: 12,
                        background: fons ?? '#fff',
                      }}
                      title={autoOmplert ? 'Omplert automàticament des de "Notes per àrea"' : undefined}
                    >
                      <option value="">—</option>
                      {NIVELLS.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
                    </select>
                    {desantId === alumne.id && (
                      <span style={{ color: 'var(--ink-soft)', fontSize: 11, marginLeft: 4 }}>Desant…</span>
                    )}
                    {autoOmplert && desantId !== alumne.id && (
                      <span style={{ color: 'var(--amber-dark)', fontSize: 11, marginLeft: 4 }} title="Auto-omplert des de Notes per àrea">*</span>
                    )}
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    {incoherencia ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: 'var(--red)', fontWeight: 600, fontSize: 12 }}>
                          ⚠ {incoherencia.origen}: {incoherencia.pitjor.label}
                        </span>
                        <button
                          className="chip"
                          onClick={() => enviaAvisIncoherencia(alumne, incoherencia)}
                          disabled={enviantAvis === alumne.id || !WORKER_AVISOS_URL}
                          type="button"
                        >
                          {enviantAvis === alumne.id ? 'Enviant…' : 'Envia avís'}
                        </button>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--ink-soft)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
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
        <p>Format: "Alumne [número] [nivell], alumne [número] [nivell]...".</p>
        <p style={{ marginTop: 4 }}>
          <strong>Nivells:</strong> excel·lent · notable · satisfactori · no assoliment (o insuficient)
        </p>
        <p style={{ marginTop: 4 }}>Exemple: "Alumne 3 notable, alumne 7 excel·lent"</p>
      </div>

      {dictat && (
        <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 16 }}>
          {dictat.escoltant ? (
            <p>Escoltant… digues, per exemple, "Alumne 3 notable, alumne 7 excel·lent".</p>
          ) : Object.keys(dictat.resultat).length === 0 ? (
            <>
              <p><strong>Sentit:</strong> "{dictat.transcripcio}"</p>
              <p style={{ marginTop: 8, color: 'var(--red)' }}>No s'ha reconegut cap alumne. Torna-ho a provar dient "Alumne [número] [nivell]".</p>
              <button className="btn-ghost" style={{ maxWidth: 160, marginTop: 8 }} onClick={() => setDictat(null)} type="button">
                Tanca
              </button>
            </>
          ) : (
            <>
              <p><strong>Sentit:</strong> "{dictat.transcripcio}"</p>
              <p style={{ marginTop: 8 }}>Notes detectades:</p>
              <ul className="roster" style={{ marginTop: 8 }}>
                {Object.entries(dictat.resultat).map(([numLlista, nivellId]) => {
                  const alumne = alumnesClasse.find((a) => String(a.numLlista) === numLlista)
                  return (
                    <li key={numLlista} className="roster-row">
                      <span>{alumne ? alumne.nom : `Alumne ${numLlista} (no trobat a la classe)`}</span>
                      <span style={{ fontWeight: 600, color: nivellPerId(nivellId)?.color }}>{nivellPerId(nivellId)?.label}</span>
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

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
          {missatge.text}
        </p>
      )}
    </div>
  )
}
