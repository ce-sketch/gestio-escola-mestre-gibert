import { useEffect, useMemo, useState } from 'react'
import { collection, query, where, getDocs, addDoc, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import { redueixVigents } from '../../../lib/avaluacioCatala'
import { CICLES, CRITERIS_TEE, NIVELLS_PER_CICLE, PESOS_PER_CICLE_DEFECTE, cicleDe, calculaNotaAutomatica, nivellDeNota } from '../../../lib/rubricaTEE'
import { exportaExcel, exportaPDF } from '../../../lib/exportTaula'
import { interpretaDictatTEE } from '../../../lib/dictatTEE'
import { cursEscolarActual } from '../../../lib/cursEscolar'
import { normalitza } from '../../../lib/text'
import { esAdmin } from '../../../lib/roles'
import BotoDrive from '../../BotoDrive'
import { carregaXLSX } from '../../../lib/carregaLlibreries'

// Paraules clau per reconèixer cada columna de criteri a la capçalera del
// fitxer Excel pujat, siguin quin siguin l'ordre o els espais exactes.
const PARAULES_CAPÇALERA = {
  coherencia: ['coherencia'],
  lexic: ['lexic'],
  presentacio: ['presentacio'],
  ortografia: ['ortografia'],
  morfosintaxis: ['morfosintaxi'],
}

export default function TEE() {
  const [alumnesTots, setAlumnesTots] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [curs, setCurs] = useState('')
  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [trimestre, setTrimestre] = useState('1r trimestre')
  const [registres, setRegistres] = useState([])
  const [carregantRegistres, setCarregantRegistres] = useState(false)
  const [valors, setValors] = useState({}) // { [alumneId]: { coherencia: 'ae', ..., globalManual: 'an' } }
  const [desantId, setDesantId] = useState(null) // id de l'alumne que s'està desant
  const [dictat, setDictat] = useState(null) // { transcripcio, resultat: {numLlista: {criteri: nivell}} }
  const [errorFitxer, setErrorFitxer] = useState(null)
  const [missatge, setMissatge] = useState(null)
  const [pesosPerCicle, setPesosPerCicle] = useState(PESOS_PER_CICLE_DEFECTE)
  const [editantPesos, setEditantPesos] = useState(false)
  const [pesosEdicio, setPesosEdicio] = useState(null)
  const [desantPesos, setDesantPesos] = useState(false)

  useEffect(() => {
    async function carrega() {
      try {
        const [snapAlumnes, snapPesos] = await Promise.all([
          getDocs(query(collection(db, 'alumnes'), where('actiu', '==', true))),
          getDoc(doc(db, 'configuracio', 'pesosTEE')),
        ])
        const llista = snapAlumnes.docs.map((d) => ({ id: d.id, ...d.data() }))
        llista.sort((a, b) => (a.numLlista ?? 999) - (b.numLlista ?? 999) || a.nom.localeCompare(b.nom))
        setAlumnesTots(llista)
        if (llista.length > 0) setCurs((c) => c || llista[0].curs)
        if (snapPesos.exists()) {
          setPesosPerCicle((prev) => ({ ...prev, ...snapPesos.data() }))
        }
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'han pogut carregar els alumnes: ${err.message}` })
      } finally {
        setCarregant(false)
      }
    }
    carrega()
  }, [])

  const cursos = useMemo(() => [...new Set(alumnesTots.map((a) => a.curs))].sort(), [alumnesTots])
  const alumnesClasse = useMemo(() => alumnesTots.filter((a) => a.curs === curs), [alumnesTots, curs])
  const cicle = cicleDe(curs)
  const nivells = NIVELLS_PER_CICLE[cicle]
  const pesosActuals = pesosPerCicle[cicle] ?? PESOS_PER_CICLE_DEFECTE[cicle]

  useEffect(() => {
    if (!curs) return
    carregaRegistres()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curs])

  async function carregaRegistres() {
    setCarregantRegistres(true)
    try {
      const q = query(collection(db, 'avaluacio'), where('curs', '==', curs), where('tipus', '==', 'tee'))
      const snap = await getDocs(q)
      setRegistres(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'han pogut carregar les notes: ${err.message}` })
    } finally {
      setCarregantRegistres(false)
    }
  }

  const vigents = useMemo(
    () => redueixVigents(
      registres.filter((r) => r.trimestre === trimestre && (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId),
      (r) => r.alumneId
    ),
    [registres, trimestre, cursEscolarId]
  )

  function valorAlumne(alumneId, camp) {
    if (valors[alumneId]?.[camp] !== undefined) return valors[alumneId][camp]
    const vigent = vigents.find((r) => r.alumneId === alumneId)
    if (camp === 'globalManual') return vigent?.globalManual ? vigent.global : ''
    return vigent?.criteris?.[camp] ?? ''
  }

  function updateValor(alumneId, camp, value) {
    setValors((prev) => ({ ...prev, [alumneId]: { ...prev[alumneId], [camp]: value } }))
  }

  /** Desa TOTS els criteris d'UN alumne a l'instant (es crida en triar
   *  qualsevol criteri o el nivell global manual) — no cal cap botó "Desa".
   *  Rep el valor que s'acaba de triar per "override", perquè React encara
   *  no ha actualitzat l'estat en el moment de cridar-ho. */
  async function desaAlumneTEE(alumne, override = {}) {
    const criteris = {}
    let hiHaCriteris = false
    for (const c of CRITERIS_TEE) {
      const v = override[c.id] !== undefined ? override[c.id] : valorAlumne(alumne.id, c.id)
      if (v) { criteris[c.id] = v; hiHaCriteris = true }
    }
    if (!hiHaCriteris) return

    const notaAuto = calculaNotaAutomatica(cicle, criteris, pesosActuals)
    const nivellAuto = notaAuto !== null ? nivellDeNota(cicle, notaAuto) : null
    const globalManualId = override.globalManual !== undefined ? override.globalManual : valorAlumne(alumne.id, 'globalManual')
    const globalFinal = globalManualId || nivellAuto?.id

    // Evitem re-escriure si res ha canviat respecte al que ja hi havia.
    const vigent = vigents.find((r) => r.alumneId === alumne.id)
    if (vigent && JSON.stringify(vigent.criteris) === JSON.stringify(criteris) && (vigent.global ?? null) === (globalFinal ?? null)) {
      setValors((prev) => { const n = { ...prev }; delete n[alumne.id]; return n })
      return
    }

    setDesantId(alumne.id)
    setMissatge(null)
    try {
      await addDoc(collection(db, 'avaluacio'), {
        tipus: 'tee',
        alumneId: alumne.id,
        alumneNom: alumne.nom,
        curs,
        cursEscolar: cursEscolarId,
        cicle,
        trimestre,
        criteris,
        notaAutomatica: notaAuto,
        globalAutomatic: nivellAuto?.id ?? null,
        global: globalFinal ?? null,
        globalManual: Boolean(globalManualId),
        creatEl: serverTimestamp(),
        creatPer: auth.currentUser?.email ?? null,
      })
      await carregaRegistres()
      setValors((prev) => { const n = { ...prev }; delete n[alumne.id]; return n })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar el TEE de ${alumne.nom}: ${err.message}` })
    } finally {
      setDesantId(null)
    }
  }

  async function handleFileUpload(e) {
    const XLSX = await carregaXLSX()
    const file = e.target.files?.[0]
    if (!file) return
    setErrorFitxer(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const primerFull = workbook.Sheets[workbook.SheetNames[0]]
        const files = XLSX.utils.sheet_to_json(primerFull, { header: 1, raw: false })

        // Troba la fila de capçalera i quina columna correspon a cada criteri.
        let filaCapçalera = -1
        const columnaPerCriteri = {}
        for (let i = 0; i < Math.min(files.length, 10); i++) {
          const fila = files[i] ?? []
          const trobades = {}
          fila.forEach((cel, col) => {
            const text = normalitza(cel?.toString() ?? '')
            for (const [criteriId, paraules] of Object.entries(PARAULES_CAPÇALERA)) {
              if (paraules.some((p) => text.includes(p))) trobades[criteriId] = col
            }
          })
          if (Object.keys(trobades).length >= 3) {
            filaCapçalera = i
            Object.assign(columnaPerCriteri, trobades)
            break
          }
        }

        if (filaCapçalera === -1) {
          setErrorFitxer('No s\'han trobat les columnes dels criteris (Coherència, Lèxic, Presentació, Ortografia, Morfosintaxis) al fitxer.')
          return
        }

        // La columna del nom és la primera columna de text de la fila de
        // capçalera que no sigui cap dels criteris ni sembli un número.
        let columnaNom = -1
        files[filaCapçalera].forEach((cel, col) => {
          if (columnaNom !== -1) return
          if (Object.values(columnaPerCriteri).includes(col)) return
          const text = cel?.toString().trim()
          if (text && /[a-zA-ZÀ-ÿ]/.test(text) && !/^n[ºo°]?$/i.test(text)) columnaNom = col
        })
        if (columnaNom === -1) columnaNom = 1 // valor per defecte habitual

        const novaValors = {}
        let coincidencies = 0
        let sensecoincidencia = 0

        for (let i = filaCapçalera + 1; i < files.length; i++) {
          const fila = files[i]
          if (!fila) continue
          const nomFitxer = fila[columnaNom]?.toString().trim()
          if (!nomFitxer) continue

          const alumne = alumnesClasse.find((a) => normalitza(a.nom) === normalitza(nomFitxer))
          if (!alumne) { sensecoincidencia += 1; continue }

          const criteris = {}
          for (const [criteriId, col] of Object.entries(columnaPerCriteri)) {
            const valorCel = fila[col]?.toString().trim().replace(',', '.')
            const num = Number(valorCel)
            if (Number.isFinite(num) && num >= 1 && num <= 5) {
              const nivellTrobat = NIVELLS_PER_CICLE[cicle].find((n) => n.punts === num)
              if (nivellTrobat) criteris[criteriId] = nivellTrobat.id
            }
          }
          if (Object.keys(criteris).length > 0) {
            novaValors[alumne.id] = criteris
            coincidencies += 1
          }
        }

        if (coincidencies === 0) {
          setErrorFitxer('No s\'ha pogut relacionar cap fila del fitxer amb un alumne d\'aquesta classe. Comprova que la classe seleccionada és la correcta.')
          return
        }

        setValors((prev) => {
          const combinat = { ...prev }
          for (const [alumneId, criteris] of Object.entries(novaValors)) {
            combinat[alumneId] = { ...combinat[alumneId], ...criteris }
          }
          return combinat
        })
        setMissatge({
          type: 'ok',
          text: `Formulari omplert des del fitxer: ${coincidencies} alumnes reconeguts${sensecoincidencia > 0 ? `, ${sensecoincidencia} files sense coincidència` : ''}. Revisa-ho i clica "Desa notes de la classe".`,
        })
      } catch (err) {
        setErrorFitxer(`No s'ha pogut llegir el fitxer: ${err.message}`)
      }
    }
    reader.onerror = () => setErrorFitxer('No s\'ha pogut llegir el fitxer.')
    reader.readAsBinaryString(file)
    e.target.value = '' // permet tornar a pujar el mateix fitxer si cal
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
      const resultat = interpretaDictatTEE(transcripcio, cicle)
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
      .map(([numLlista, notes]) => ({ alumne: alumnesClasse.find((a) => String(a.numLlista) === numLlista), notes }))
      .filter((e) => e.alumne)

    for (const { alumne, notes } of entrades) {
      setValors((prev) => ({ ...prev, [alumne.id]: { ...prev[alumne.id], ...notes } }))
      await desaAlumneTEE(alumne, notes)
    }
    setMissatge({ type: 'ok', text: `${entrades.length} alumnes dictats i desats directament.` })
    setDictat(null)
  }

  function globalAutoAlumne(alumneId) {
    const criteris = {}
    for (const c of CRITERIS_TEE) criteris[c.id] = valorAlumne(alumneId, c.id)
    const nota = calculaNotaAutomatica(cicle, criteris, pesosActuals)
    const nivell = nota !== null ? nivellDeNota(cicle, nota) : null
    return { nota, nivell }
  }

  /** Taula del TEE de LA CLASSE ACTUAL (no de tot el centre), perquè el
   *  tutor pugui descarregar-se les notes que acaba d'introduir. */
  function taulaClasseActual() {
    const capçalera = ['Núm.', 'Alumne', ...CRITERIS_TEE.map((c) => c.label), 'Nota', 'Nivell']
    const files = alumnesClasse.map((alumne) => {
      const { nota, nivell } = globalAutoAlumne(alumne.id)
      const globalManual = valorAlumne(alumne.id, 'globalManual')
      const nivellFinal = globalManual ? nivells.find((n) => n.id === globalManual) : nivell
      return [
        alumne.numLlista ?? '',
        alumne.nom,
        ...CRITERIS_TEE.map((c) => {
          const v = valorAlumne(alumne.id, c.id)
          return nivells.find((n) => n.id === v)?.label ?? ''
        }),
        nota ?? '',
        nivellFinal?.label ?? '',
      ]
    })
    return [{ nom: `TEE ${curs}`, files: [capçalera, ...files] }]
  }

  const nomFitxerClasse = `TEE-${curs}-${trimestre.replace(/\s+/g, '_')}`

  function iniciaEdicioPesos() {
    // Els pesos s'editen en tant per cent enters (25, 20, 10...), no en
    // fraccions (0.25), perquè és més fàcil de llegir i escriure.
    const enPercentatge = {}
    for (const c of CRITERIS_TEE) enPercentatge[c.id] = Math.round((pesosActuals[c.id] ?? 0) * 100)
    setPesosEdicio(enPercentatge)
    setEditantPesos(true)
  }

  function updatePes(criteriId, valor) {
    setPesosEdicio((prev) => ({ ...prev, [criteriId]: valor }))
  }

  const sumaPesosEdicio = pesosEdicio
    ? CRITERIS_TEE.reduce((acc, c) => acc + (Number(pesosEdicio[c.id]) || 0), 0)
    : 0

  async function desaPesos() {
    if (Math.round(sumaPesosEdicio) !== 100) {
      setMissatge({ type: 'error', text: `Els pesos han de sumar 100% (ara sumen ${sumaPesosEdicio}%).` })
      return
    }
    setDesantPesos(true)
    try {
      const enFraccio = {}
      for (const c of CRITERIS_TEE) enFraccio[c.id] = (Number(pesosEdicio[c.id]) || 0) / 100
      const nouEstat = { ...pesosPerCicle, [cicle]: enFraccio }
      await setDoc(doc(db, 'configuracio', 'pesosTEE'), { [cicle]: enFraccio }, { merge: true })
      setPesosPerCicle(nouEstat)
      setEditantPesos(false)
      setMissatge({ type: 'ok', text: `Pesos de ${CICLES[cicle]} desats. S'aplicaran a partir d'ara.` })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'han pogut desar els pesos: ${err.message}` })
    } finally {
      setDesantPesos(false)
    }
  }

  if (carregant) return <p>Carregant…</p>

  return (
    <div>
      <p className="module-lead">
        Tria el nivell de cada criteri segons la rúbrica d'Expressió Escrita. La nota
        automàtica (0-10) es calcula amb la mateixa fórmula ponderada del full de càlcul
        original, i se'n suggereix un nivell — que sempre pots sobreescriure.
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
            <option value="1r trimestre">1r trimestre</option>
            <option value="2n trimestre">2n trimestre</option>
            <option value="3r trimestre">3r trimestre</option>
          </select>
        </label>
        <div style={{ marginTop: 18, fontSize: 13, color: 'var(--ink-soft)' }}>
          Cicle detectat: <strong>{CICLES[cicle]}</strong>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        {!esAdmin(auth.currentUser) ? (
          <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            Pesos de {CICLES[cicle]}: {CRITERIS_TEE.map((c) => `${c.label.slice(0, 3)} ${Math.round((pesosActuals[c.id] ?? 0) * 100)}%`).join(' · ')}
          </p>
        ) : !editantPesos ? (
          <button className="btn-ghost" style={{ color: 'var(--ink-soft)', borderColor: 'var(--line)', fontSize: 12 }} onClick={iniciaEdicioPesos} type="button">
            ⚙ Pesos de {CICLES[cicle]}: {CRITERIS_TEE.map((c) => `${c.label.slice(0, 3)} ${Math.round((pesosActuals[c.id] ?? 0) * 100)}%`).join(' · ')}
          </button>
        ) : (
          <div className="placeholder-box" style={{ borderStyle: 'solid' }}>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Pesos de {CICLES[cicle]} (han de sumar 100%)</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {CRITERIS_TEE.map((c) => (
                <label key={c.id} className="field" style={{ maxWidth: 110 }}>
                  <span>{c.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number" min="0" max="100" step="1"
                      value={pesosEdicio?.[c.id] ?? 0}
                      onChange={(e) => updatePes(c.id, e.target.value)}
                      style={{ width: 60, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px' }}
                    />
                    <span style={{ fontSize: 13 }}>%</span>
                  </div>
                </label>
              ))}
            </div>
            <p style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: Math.round(sumaPesosEdicio) === 100 ? 'var(--green)' : 'var(--red)' }}>
              Suma: {sumaPesosEdicio}%
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn-primary" style={{ maxWidth: 140 }} onClick={desaPesos} disabled={desantPesos} type="button">
                {desantPesos ? 'Desant…' : 'Desa els pesos'}
              </button>
              <button className="btn-ghost" style={{ maxWidth: 140 }} onClick={() => setEditantPesos(false)} type="button">
                Cancel·la
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <button
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
          onClick={iniciaDictat}
          type="button"
        >
          🎤 Dicta notes (per número d'alumne)
        </button>

        <BotoDrive
          onFitxer={handleFileUpload}
          tipus="fulls"
          etiqueta="Tria el fitxer del Drive"
          onError={(t) => setMissatge({ type: 'error', text: t })}
        />
        <label
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
        >
          📄 Puja un fitxer Excel de la classe
          <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} style={{ display: 'none' }} />
        </label>
      </div>
      <p className="module-note" style={{ marginTop: 6 }}>
        Digues, per exemple: "Alumne 1, coherència notable, lèxic excel·lent, presentació
        satisfactori, ortografia notable, morfosintaxi excel·lent. Alumne 2, ..." — no cal dir
        cap nom, només el número de la llista (columna "Núm." de la taula).
      </p>
      <p className="module-note" style={{ marginTop: 4 }}>
        El fitxer Excel ha de tenir una fila de capçalera amb "Coherència", "Lèxic",
        "Presentació", "Ortografia" i "Morfosintaxis", i una columna amb el nom de l'alumne
        (ha de coincidir amb el nom ja carregat a "Alumnes"). Els valors de cada criteri
        poden ser 1-5 (1=AE, 2=AN, 3=AS, 4=NA, 5=NA amb 0 punts).
      </p>
      {errorFitxer && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 6 }}>{errorFitxer}</p>}

      {dictat && (
        <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 16 }}>
          {dictat.escoltant ? (
            <p>Escoltant…</p>
          ) : (
            <>
              <p><strong>Sentit:</strong> "{dictat.transcripcio}"</p>
              {Object.keys(dictat.resultat).length === 0 ? (
                <p style={{ marginTop: 8, color: 'var(--red)' }}>
                  No s'ha reconegut cap alumne. Assegura't de dir "Alumne" seguit del número.
                </p>
              ) : (
                <ul className="roster" style={{ marginTop: 8 }}>
                  {Object.entries(dictat.resultat).map(([numLlista, notes]) => {
                    const alumne = alumnesClasse.find((a) => String(a.numLlista) === numLlista)
                    return (
                      <li key={numLlista} className="roster-row" style={{ display: 'block' }}>
                        <strong>Alumne {numLlista}{alumne ? ` — ${alumne.nom}` : ' (no trobat a la llista)'}</strong>
                        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                          {CRITERIS_TEE.map((c) => `${c.label}: ${notes[c.id] ?? '—'}`).join(' · ')}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
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

      {carregantRegistres ? (
        <p style={{ marginTop: 20 }}>Carregant notes…</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <button
              className="btn-ghost"
              style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
              onClick={() => exportaExcel(nomFitxerClasse, { cursEscolarId, fulls: taulaClasseActual() })}
              type="button"
            >
              📥 Descarrega Excel ({curs})
            </button>
            <button
              className="btn-ghost"
              style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
              onClick={() => exportaPDF(`TEE — ${curs} — ${trimestre}`, { cursEscolarId, fulls: taulaClasseActual() })}
              type="button"
            >
              📄 Descarrega PDF ({curs})
            </button>
          </div>
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                <th style={{ padding: '6px 8px', minWidth: 40 }}>Núm.</th>
                <th style={{ padding: '6px 8px', minWidth: 160 }}>Alumne</th>
                {CRITERIS_TEE.map((c) => (
                  <th key={c.id} style={{ padding: '6px 8px', minWidth: 90 }}>{c.label}</th>
                ))}
                <th style={{ padding: '6px 8px', minWidth: 70 }}>Nota auto. (0-10)</th>
                <th style={{ padding: '6px 8px', minWidth: 80 }}>Nivell suggerit</th>
                <th style={{ padding: '6px 8px', minWidth: 100 }}>Global final</th>
              </tr>
            </thead>
            <tbody>
              {alumnesClasse.map((alumne) => {
                const { nota, nivell } = globalAutoAlumne(alumne.id)
                const globalManual = valors[alumne.id]?.globalManual
                return (
                  <tr key={alumne.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 8px', color: 'var(--ink-soft)' }}>{alumne.numLlista ?? '—'}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 500 }}>{alumne.nom}</td>
                    {CRITERIS_TEE.map((c) => (
                      <td key={c.id} style={{ padding: '4px 6px' }}>
                        <select
                          value={valorAlumne(alumne.id, c.id)}
                          disabled={desantId === alumne.id}
                          onChange={(e) => {
                            updateValor(alumne.id, c.id, e.target.value)
                            desaAlumneTEE(alumne, { [c.id]: e.target.value })
                          }}
                          style={{ border: `1px solid ${desantId === alumne.id ? 'var(--amber-dark)' : 'var(--line)'}`, borderRadius: 6, padding: '4px 6px', fontSize: 12 }}
                        >
                          <option value="">—</option>
                          {nivells.map((n) => <option key={n.id} value={n.id}>{n.punts} · {n.label}</option>)}
                        </select>
                      </td>
                    ))}
                    <td style={{ padding: '4px 6px', color: 'var(--ink-soft)' }}>{nota ?? '—'}</td>
                    <td style={{ padding: '4px 6px', fontWeight: 600, color: nivell?.color }}>{nivell?.label ?? '—'}</td>
                    <td style={{ padding: '4px 6px' }}>
                      <select
                        value={globalManual ?? ''}
                        disabled={desantId === alumne.id}
                        onChange={(e) => {
                          updateValor(alumne.id, 'globalManual', e.target.value)
                          desaAlumneTEE(alumne, { globalManual: e.target.value })
                        }}
                        style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 12, fontWeight: 600 }}
                      >
                        <option value="">(fer servir el suggerit)</option>
                        {nivells.map((n) => <option key={n.id} value={n.id}>{n.punts} · {n.label}</option>)}
                      </select>
                      {desantId === alumne.id && <span style={{ fontSize: 11, color: 'var(--ink-soft)', marginLeft: 4 }}>Desant…</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </>
      )}

      <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 12 }}>
        Cada criteri es desa sol en triar-lo (no cal cap botó "Desa") — així no es perd res
        encara que es tanqui la pestanya sense voler.
      </p>

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
          {missatge.text}
        </p>
      )}
    </div>
  )
}
