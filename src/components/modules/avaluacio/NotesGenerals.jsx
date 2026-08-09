import { useEffect, useMemo, useState } from 'react'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import { NIVELLS, nivellDe, redueixVigents } from '../../../lib/avaluacioCatala'
import { AREES, TRIMESTRES, areaAplicaAClasse, interpretaDictatNotesArea } from '../../../lib/notesArea'
import { cursEscolarActual, NIVELLS_ESCOLARS, nivellEscolarDe } from '../../../lib/cursEscolar'
import { grauPrimaria } from '../../../lib/rubricaLectura'
import { exportaExcel, exportaPDF } from '../../../lib/exportTaula'

const VISTES = [
  { id: 'entrada', label: 'Entrada de notes' },
  { id: 'resum', label: 'Resum escola' },
]

export default function NotesGenerals() {
  const [vista, setVista] = useState('entrada')
  const [alumnesTots, setAlumnesTots] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [registres, setRegistres] = useState([])
  const [missatge, setMissatge] = useState(null)

  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [trimestre, setTrimestre] = useState(TRIMESTRES[0])
  const [classe, setClasse] = useState('')
  const [nivellResum, setNivellResum] = useState(NIVELLS_ESCOLARS[0].label)
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

  // Vigents per a l'entrada actual (classe + trimestre + curs escolar), amb
  // TOTES les àrees alhora — clau alumne+àrea, tal com als fulls per classe
  // de l'Excel (1A, 1B...), on cada alumne té una columna per àrea.
  const vigentsEntrada = useMemo(
    () => redueixVigents(
      registres.filter((r) =>
        r.curs === classe &&
        r.trimestre === trimestre &&
        (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId
      ),
      (r) => `${r.alumneId}__${r.area}`
    ),
    [registres, classe, trimestre, cursEscolarId]
  )

  function clauValor(alumneId, areaId) {
    return `${alumneId}__${areaId}`
  }

  function notaAlumne(alumneId, areaId) {
    const clau = clauValor(alumneId, areaId)
    if (valors[clau] !== undefined) return valors[clau]
    const existent = vigentsEntrada.find((r) => r.alumneId === alumneId && r.area === areaId)
    return existent?.nota ?? ''
  }

  /** Mitjana de totes les àrees ja introduïdes per aquest alumne (ignora
   *  les àrees encara buides) — la "nota global" del trimestre. */
  function notaGlobalAlumne(alumneId) {
    const valorsOmplerts = areesClasse
      .map((a) => notaAlumne(alumneId, a.id))
      .filter((v) => v !== '')
      .map(Number)
    if (valorsOmplerts.length === 0) return null
    const mitjana = valorsOmplerts.reduce((a, b) => a + b, 0) / valorsOmplerts.length
    return Math.round(mitjana * 10) / 10
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
    const actual = vigentsEntrada.find((r) => r.alumneId === alumne.id && r.area === area.id)?.nota
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

  // ---- Resum per curs (agrupa totes les classes A/B d'un mateix nivell) ----

  // ---- Resum global de tot el centre (equivalent al full "Resum" de
  // l'Excel): una taula per àrea, amb cada CLASSE individual com a fila
  // (no agrupada per nivell) i una fila de TOTAL a baix — exactament com
  // al full original. ----
  const vigentsResumGlobal = useMemo(
    () => redueixVigents(
      registres.filter((r) =>
        (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId &&
        r.trimestre === trimestre
      ),
      (r) => `${r.alumneId}__${r.area}`
    ),
    [registres, cursEscolarId, trimestre]
  )

  const totesLesClasses = useMemo(
    () => [...new Set(alumnesTots.map((a) => a.curs))].filter((c) => grauPrimaria(c) !== null).sort(),
    [alumnesTots]
  )

  const resumGlobalPerArea = useMemo(() => {
    return AREES.map((a) => {
      const files = totesLesClasses.map((classe) => {
        const notesClasse = vigentsResumGlobal.filter((r) => r.area === a.id && r.curs === classe)
        const comptes = { no_assoliment: 0, assoliment_satisfactori: 0, assoliment_notable: 0, 'assoliment_excel·lent': 0 }
        for (const r of notesClasse) {
          const nivell = nivellDe(r.nota)
          if (nivell) comptes[nivell.id] += 1
        }
        return { classe, avaluats: notesClasse.length, comptes }
      })
      const total = { no_assoliment: 0, assoliment_satisfactori: 0, assoliment_notable: 0, 'assoliment_excel·lent': 0 }
      let avaluatsTotal = 0
      files.forEach((f) => {
        for (const k of Object.keys(total)) total[k] += f.comptes[k]
        avaluatsTotal += f.avaluats
      })
      return { area: a, files, total, avaluatsTotal }
    }).filter((f) => f.avaluatsTotal > 0) // amaguem àrees sense cap nota encara
  }, [vigentsResumGlobal, totesLesClasses])

  const alumnesDelNivell = useMemo(
    () => alumnesTots.filter((a) => nivellEscolarDe(a.curs) === nivellResum),
    [alumnesTots, nivellResum]
  )

  const vigentsResum = useMemo(
    () => redueixVigents(
      registres.filter((r) =>
        (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId &&
        r.trimestre === trimestre &&
        nivellEscolarDe(r.curs) === nivellResum
      ),
      (r) => `${r.alumneId}__${r.area}`
    ),
    [registres, cursEscolarId, trimestre, nivellResum]
  )

  const digitNivellResum = useMemo(
    () => NIVELLS_ESCOLARS.find((n) => n.label === nivellResum)?.id,
    [nivellResum]
  )
  const areesResum = useMemo(
    () => AREES.filter((a) => areaAplicaAClasse(a.id, digitNivellResum)),
    [digitNivellResum]
  )

  const resumPerArea = useMemo(() => {
    const files = areesResum.map((a) => {
      const notesArea = vigentsResum.filter((r) => r.area === a.id)
      const comptes = { no_assoliment: 0, assoliment_satisfactori: 0, assoliment_notable: 0, 'assoliment_excel·lent': 0 }
      for (const r of notesArea) {
        const nivell = nivellDe(r.nota)
        if (nivell) comptes[nivell.id] += 1
      }
      return { area: a, avaluats: notesArea.length, comptes }
    })

    // "Artística" no s'introdueix mai directament: és la mitjana de Plàstica
    // i Música, calculada al moment, igual que la columna "GF" del teu
    // Excel. Només es compta un alumne si té les DUES notes d'aquest
    // trimestre — igual que la fórmula original. Plàstica i Música es
    // mantenen com a files pròpies i separades (no es toquen).
    const perAlumne = new Map()
    for (const r of vigentsResum) {
      if (r.area !== 'plastica' && r.area !== 'musica') continue
      if (!perAlumne.has(r.alumneId)) perAlumne.set(r.alumneId, {})
      perAlumne.get(r.alumneId)[r.area] = r.nota
    }
    const comptesArtistica = { no_assoliment: 0, assoliment_satisfactori: 0, assoliment_notable: 0, 'assoliment_excel·lent': 0 }
    let avaluatsArtistica = 0
    for (const valors of perAlumne.values()) {
      if (valors.plastica === undefined || valors.musica === undefined) continue
      const mitjana = (valors.plastica + valors.musica) / 2
      const nivell = nivellDe(mitjana)
      if (nivell) comptesArtistica[nivell.id] += 1
      avaluatsArtistica += 1
    }
    if (avaluatsArtistica > 0) {
      files.push({
        area: { id: 'artistica', label: 'Artística (mitjana Plàstica+Música)' },
        avaluats: avaluatsArtistica,
        comptes: comptesArtistica,
        calculada: true,
      })
    }
    return files
  }, [vigentsResum, areesResum])

  // Alumnes amb almenys una àrea en "No Assoliment" aquest trimestre.
  const alumnesAmbSuspeses = useMemo(() => {
    const perAlumne = new Map()
    for (const r of vigentsResum) {
      const nivell = nivellDe(r.nota)
      if (nivell?.id !== 'no_assoliment') continue
      const areaLabel = AREES.find((a) => a.id === r.area)?.label ?? r.area
      if (!perAlumne.has(r.alumneId)) {
        const numLlista = alumnesTots.find((a) => a.id === r.alumneId)?.numLlista
        perAlumne.set(r.alumneId, { nom: r.alumneNom, numLlista, arees: [] })
      }
      perAlumne.get(r.alumneId).arees.push(areaLabel)
    }
    return [...perAlumne.values()].sort((a, b) => b.arees.length - a.arees.length)
  }, [vigentsResum, alumnesTots])

  if (carregant) return <p>Carregant…</p>

  /** Prepara totes les taules del resum global per exportar-les (un full
   *  per àrea, exactament com es veuen a la pantalla). */
  function taulesResumGlobalExportables() {
    return resumGlobalPerArea.map(({ area: a, files, total, avaluatsTotal }) => ({
      nom: a.label,
      files: [
        ['Classe', ...NIVELLS.map((n) => n.label), 'Avaluats'],
        ...files.map((f) => [f.classe, ...NIVELLS.map((n) => f.comptes[n.id]), f.avaluats]),
        ['TOTAL', ...NIVELLS.map((n) => total[n.id]), avaluatsTotal],
      ],
    }))
  }

  const nomFitxerResum = `Notes-per-area-${cursEscolarId}-${trimestre.replace(/\s+/g, '_')}`

  /** Taula de la graella d'entrada de LA CLASSE ACTUAL (totes les àrees). */
  function taulaClasseActual() {
    const capçalera = ['Núm.', 'Alumne', ...areesClasse.map((a) => a.label), 'Nota global']
    const files = alumnesClasse.map((alumne) => [
      alumne.numLlista ?? '',
      alumne.nom,
      ...areesClasse.map((a) => notaAlumne(alumne.id, a.id)),
      notaGlobalAlumne(alumne.id) ?? '',
    ])
    return [{ nom: `Notes ${classe}`, files: [capçalera, ...files] }]
  }

  return (
    <div>
      <p className="module-lead">
        Notes de totes les àrees (no només Català), amb resum per curs (agrupant classes A i B
        d'un mateix nivell) igual que a la graella de nota mitjana d'àrea.
      </p>

      <div style={{ display: 'flex', gap: 8, marginTop: 20, borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
        {VISTES.map((v) => (
          <button
            key={v.id}
            onClick={() => setVista(v.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: vista === v.id ? '2px solid var(--navy)' : '2px solid transparent',
              padding: '10px 4px',
              marginRight: 16,
              fontWeight: vista === v.id ? 600 : 500,
              color: vista === v.id ? 'var(--navy)' : 'var(--ink-soft)',
              cursor: 'pointer',
              fontSize: 14,
            }}
            type="button"
          >
            {v.label}
          </button>
        ))}
      </div>

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

        {vista === 'entrada' && (
          <label className="field" style={{ minWidth: 160 }}>
            <span>Classe</span>
            <select value={classe} onChange={(e) => setClasse(e.target.value)} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}

        {vista === 'resum' && (
          <label className="field" style={{ minWidth: 120 }}>
            <span>Curs (nivell)</span>
            <select value={nivellResum} onChange={(e) => setNivellResum(e.target.value)} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
              {NIVELLS_ESCOLARS.map((n) => <option key={n.id} value={n.label}>{n.label}</option>)}
            </select>
          </label>
        )}
      </div>

      {vista === 'entrada' ? (
        <>
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
            Vora vermella = nota per sota de 5 (No Assoliment), igual que al full de càlcul.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <button
              className="btn-ghost"
              style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
              onClick={() => exportaExcel(`Notes-${classe}-${trimestre.replace(/\s+/g, '_')}`, taulaClasseActual())}
              type="button"
            >
              📥 Descarrega Excel ({classe})
            </button>
            <button
              className="btn-ghost"
              style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
              onClick={() => exportaPDF(`Notes per àrea — ${classe} — ${trimestre}`, taulaClasseActual())}
              type="button"
            >
              📄 Descarrega PDF ({classe})
            </button>
          </div>
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', marginTop: 0 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                  <th style={{ padding: '6px 8px', minWidth: 44 }}>Núm.</th>
                  <th style={{ padding: '6px 8px', minWidth: 180, position: 'sticky', left: 0, background: 'var(--bg)' }}>Alumne</th>
                  {areesClasse.map((a) => (
                    <th key={a.id} style={{ padding: '6px 4px', minWidth: 70, fontSize: 11 }}>{a.label}</th>
                  ))}
                  <th style={{ padding: '6px 8px', minWidth: 70, fontSize: 11 }}>Nota global</th>
                </tr>
              </thead>
              <tbody>
                {alumnesClasse.map((alumne) => (
                  <tr key={alumne.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 8px', color: 'var(--ink-soft)' }}>{alumne.numLlista ?? '—'}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 500, position: 'sticky', left: 0, background: 'var(--bg)' }}>{alumne.nom}</td>
                    {areesClasse.map((a) => {
                      const nota = notaAlumne(alumne.id, a.id)
                      const nivell = nota !== '' ? nivellDe(Number(nota)) : null
                      const clau = clauValor(alumne.id, a.id)
                      const estaDesant = desantClau === clau
                      return (
                        <td key={a.id} style={{ padding: '4px 3px', position: 'relative' }}>
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
                              border: `1.5px solid ${estaDesant ? 'var(--amber-dark)' : nivell?.id === 'no_assoliment' ? 'var(--red)' : 'var(--line)'}`,
                              borderRadius: 6,
                              padding: '4px 4px',
                              fontSize: 12,
                              width: 56,
                            }}
                          />
                        </td>
                      )
                    })}
                    {(() => {
                      const global = notaGlobalAlumne(alumne.id)
                      const nivellGlobal = global !== null ? nivellDe(global) : null
                      return (
                        <td style={{ padding: '4px 8px', fontWeight: 700, color: nivellGlobal?.color ?? 'var(--ink-soft)' }}>
                          {global ?? '—'}
                        </td>
                      )
                    })()}
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
      ) : (
        <>
          <h3 style={{ marginTop: 8, fontSize: 15 }}>Resum global de tot el centre</h3>
          <p className="module-note" style={{ marginTop: 4 }}>
            Igual que al full "Resum" de l'Excel: una taula per àrea, amb totes les classes
            per separat i una fila de TOTAL a baix.
          </p>

          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <button
              className="btn-ghost"
              style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
              onClick={() => exportaExcel(nomFitxerResum, taulesResumGlobalExportables())}
              type="button"
            >
              📥 Descarrega Excel
            </button>
            <button
              className="btn-ghost"
              style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
              onClick={() => exportaPDF(`Notes per àrea — Resum global (${trimestre})`, taulesResumGlobalExportables())}
              type="button"
            >
              📄 Descarrega PDF
            </button>
          </div>

          {resumGlobalPerArea.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 12 }}>Encara no hi ha cap nota d'aquest trimestre.</p>
          ) : resumGlobalPerArea.map(({ area: a, files, total, avaluatsTotal }) => (
            <div key={a.id} style={{ marginTop: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600 }}>{a.label}</p>
              <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', marginTop: 6 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                    <th style={{ padding: '6px 8px', minWidth: 80 }}>Classe</th>
                    {NIVELLS.map((n) => <th key={n.id} style={{ padding: '6px 8px', color: n.color }}>{n.curt}</th>)}
                    <th style={{ padding: '6px 8px' }}>Avaluats</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr key={f.classe} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 500 }}>{f.classe}</td>
                      {NIVELLS.map((n) => <td key={n.id} style={{ padding: '6px 8px' }}>{f.comptes[n.id]}</td>)}
                      <td style={{ padding: '6px 8px' }}>{f.avaluats}</td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--bg-soft, #f5f5f0)' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 700 }}>TOTAL</td>
                    {NIVELLS.map((n) => <td key={n.id} style={{ padding: '6px 8px', fontWeight: 700 }}>{total[n.id]}</td>)}
                    <td style={{ padding: '6px 8px', fontWeight: 700 }}>{avaluatsTotal}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}

          <h3 style={{ marginTop: 32, fontSize: 15 }}>Resum d'un curs concret</h3>
          <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', marginTop: 20 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                <th style={{ padding: '6px 8px', minWidth: 140 }}>Àrea</th>
                {NIVELLS.map((n) => <th key={n.id} style={{ padding: '6px 8px', color: n.color }}>{n.curt}</th>)}
                <th style={{ padding: '6px 8px' }}>Avaluats</th>
                <th style={{ padding: '6px 8px' }}>Sense nota</th>
              </tr>
            </thead>
            <tbody>
              {resumPerArea.map(({ area: a, avaluats, comptes, calculada }) => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--line)', fontStyle: calculada ? 'italic' : 'normal' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 500, color: calculada ? 'var(--ink-soft)' : 'inherit' }}>{a.label}</td>
                  {NIVELLS.map((n) => (
                    <td key={n.id} style={{ padding: '6px 8px' }}>{comptes[n.id]}</td>
                  ))}
                  <td style={{ padding: '6px 8px' }}>{avaluats}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--ink-soft)' }}>
                    {alumnesDelNivell.length - avaluats}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p style={{ marginTop: 24, fontWeight: 600, fontSize: 13 }}>
            Alumnes amb àrees no superades ({nivellResum}, {trimestre})
          </p>
          {alumnesAmbSuspeses.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 6 }}>Cap alumne amb àrees no superades.</p>
          ) : (
            <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', marginTop: 10 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                  <th style={{ padding: '6px 8px', width: 44 }}>Núm.</th>
                  <th style={{ padding: '6px 8px' }}>Alumne</th>
                  <th style={{ padding: '6px 8px' }}>Àrees no superades</th>
                </tr>
              </thead>
              <tbody>
                {alumnesAmbSuspeses.map((a) => (
                  <tr key={a.nom} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 8px', color: 'var(--ink-soft)' }}>{a.numLlista ?? '—'}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 500 }}>{a.nom}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--red)' }}>{a.arees.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
          {missatge.text}
        </p>
      )}
    </div>
  )
}
