import { useEffect, useMemo, useState } from 'react'
import {
  collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc,
} from 'firebase/firestore'
import { db, auth } from '../../firebase'
import { normalitza } from '../../lib/text'
import { cursEscolarActual } from '../../lib/cursEscolar'
import GraellaMensual from './assistencia/GraellaMensual'

const CURS_ESCOLAR = cursEscolarActual()

const TORNS = [
  { id: 'mati', label: 'Matí' },
  { id: 'tarda', label: 'Tarda' },
]

const ESTATS = [
  { id: 'sense_marcar', label: '— Sense marcar —', curt: '—', necessitaMotiu: false },
  { id: 'present', label: 'Present', curt: 'P', necessitaMotiu: false },
  { id: 'retard_justificat', label: 'Retard justificat', curt: 'RJ', necessitaMotiu: true },
  { id: 'retard_injustificat', label: 'Retard sense justificar', curt: 'R', necessitaMotiu: false },
  { id: 'absent_justificat', label: 'Absència justificada', curt: 'AJ', necessitaMotiu: true },
  { id: 'absent_injustificat', label: 'Absència sense justificar', curt: 'A', necessitaMotiu: false },
]

function colorEstat(estatId) {
  if (!estatId || estatId === 'sense_marcar') return 'var(--ink-soft)'
  if (estatId === 'present') return 'var(--green)'
  if (estatId?.startsWith('retard')) return 'var(--amber-dark)'
  if (estatId?.startsWith('absent')) return 'var(--red)'
  return 'var(--ink-soft)'
}

function avui() {
  return new Date().toISOString().slice(0, 10)
}

export default function Assistencia() {
  const [alumnesTots, setAlumnesTots] = useState([])
  const [carregantAlumnes, setCarregantAlumnes] = useState(true)
  const [curs, setCurs] = useState('')
  const [data, setData] = useState(avui())
  const [registres, setRegistres] = useState([]) // registres bruts del dia (historial complet)
  const [carregantRegistres, setCarregantRegistres] = useState(false)
  const [desant, setDesant] = useState(null) // "alumneId-torn" que s'està desant
  const [missatge, setMissatge] = useState(null)
  const [dictat, setDictat] = useState(null) // { torn, transcripcio, coincidencies: Set }
  const [pendentMotiu, setPendentMotiu] = useState(null) // { alumneId, torn, estat, text }
  const [vista, setVista] = useState('dia') // dia · mes
  const [calendari, setCalendari] = useState(null)

  // --- Carrega alumnes actius un sol cop ---
  useEffect(() => {
    async function carrega() {
      try {
        const q = query(collection(db, 'alumnes'), where('actiu', '==', true))
        const snap = await getDocs(q)
        const llista = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        llista.sort((a, b) => (a.numLlista ?? 999) - (b.numLlista ?? 999) || a.nom.localeCompare(b.nom))
        setAlumnesTots(llista)
        if (llista.length > 0 && !curs) setCurs(llista[0].curs)
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'han pogut carregar els alumnes: ${err.message}` })
      } finally {
        setCarregantAlumnes(false)
      }
    }
    carrega()
    getDoc(doc(db, 'calendari', CURS_ESCOLAR))
      .then((snap) => { if (snap.exists()) setCalendari(snap.data()) })
      .catch(() => { /* sense calendari, la vista mensual ja ho avisa */ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cursos = useMemo(
    () => [...new Set(alumnesTots.map((a) => a.curs))].sort(),
    [alumnesTots]
  )
  const alumnesClasse = useMemo(
    () => alumnesTots.filter((a) => a.curs === curs),
    [alumnesTots, curs]
  )

  // --- Carrega els registres d'aquest curs+data cada vegada que canvien ---
  useEffect(() => {
    if (!curs || !data) return
    carregaRegistres()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curs, data])

  async function carregaRegistres() {
    setCarregantRegistres(true)
    try {
      const q = query(
        collection(db, 'assistencia'),
        where('curs', '==', curs),
        where('data', '==', data)
      )
      const snap = await getDocs(q)
      setRegistres(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut carregar l'assistència: ${err.message}` })
    } finally {
      setCarregantRegistres(false)
    }
  }

  /** El registre "vigent" d'un alumne+torn és el més recent que hi hagi. */
  function registreActual(alumneId, torn) {
    const delTorn = registres.filter((r) => r.alumneId === alumneId && r.torn === torn)
    if (delTorn.length === 0) return null
    delTorn.sort((a, b) => (b.creatEl?.seconds ?? 0) - (a.creatEl?.seconds ?? 0))
    return delTorn[0]
  }

  async function marca(alumne, torn, estat, motiu = '') {
    const clau = `${alumne.id}-${torn}`

    // Actualitza la pantalla a l'instant (optimista), sense esperar la xarxa.
    const registreOptimista = {
      id: `local-${Date.now()}-${Math.random()}`,
      alumneId: alumne.id,
      alumneNom: alumne.nom,
      curs,
      data,
      torn,
      estat,
      motiu: motiu || null,
      creatEl: { seconds: Date.now() / 1000 },
      creatPer: auth.currentUser?.email ?? null,
    }
    setRegistres((prev) => [...prev, registreOptimista])
    setDesant(clau)

    try {
      await addDoc(collection(db, 'assistencia'), {
        alumneId: alumne.id,
        alumneNom: alumne.nom,
        curs,
        data,
        torn,
        estat,
        motiu: motiu || null,
        creatEl: serverTimestamp(),
        creatPer: auth.currentUser?.email ?? null,
      })
      return { ok: true }
    } catch (err) {
      // Si falla el desat de debò, treu la marca optimista i avisa.
      console.error('Error en desar assistència:', err.code, err.message)
      setRegistres((prev) => prev.filter((r) => r.id !== registreOptimista.id))
      const textError = `No s'ha pogut desar la marca de ${alumne.nom}: ${err.message}${err.code ? ` (${err.code})` : ''}`
      setMissatge({ type: 'error', text: textError })
      return { ok: false, error: textError }
    } finally {
      setDesant(null)
    }
  }

  /** Es crida en triar un estat nou al desplegable. Si necessita motiu,
   *  obre el quadre per escriure'l abans de desar; si no, desa directament. */
  function triaEstat(alumne, torn, estatId) {
    const definicio = ESTATS.find((e) => e.id === estatId)
    if (definicio?.necessitaMotiu) {
      setPendentMotiu({ alumneId: alumne.id, alumne, torn, estat: estatId, text: '' })
    } else {
      marca(alumne, torn, estatId)
    }
  }

  function confirmaMotiu() {
    if (!pendentMotiu) return
    marca(pendentMotiu.alumne, pendentMotiu.torn, pendentMotiu.estat, pendentMotiu.text)
    setPendentMotiu(null)
  }

  // --- Dictat per veu ---
  /** Marca tots els alumnes de la classe com a presents, en els torns indicats.
   *  Només crea un registre nou per a qui encara no en tingui cap avui en aquell torn
   *  (així no trepitja marques que ja hi hagués, com un retard ja apuntat). */
  async function marcaTothomPresent(tornsAaplicar) {
    const promeses = []
    for (const alumne of alumnesClasse) {
      for (const idTorn of tornsAaplicar) {
        const actual = registreActual(alumne.id, idTorn)
        if (!actual || actual.estat === 'sense_marcar') {
          promeses.push(marca(alumne, idTorn, 'present'))
        }
      }
    }
    const etiquetaTorns = tornsAaplicar.length === 2 ? 'tot el dia' : TORNS.find((t) => t.id === tornsAaplicar[0])?.label

    if (promeses.length === 0) {
      setMissatge({ type: 'ok', text: `Tothom ja tenia una marca per a ${etiquetaTorns} — no calia canviar res.` })
      return
    }

    const resultats = await Promise.all(promeses)
    const exits = resultats.filter((r) => r.ok).length
    const fallades = resultats.length - exits
    const primerError = resultats.find((r) => !r.ok)?.error

    if (fallades === 0) {
      setMissatge({ type: 'ok', text: `${exits} marques de "present" desades correctament (${etiquetaTorns}). Ara retoca només qui falti o arribi tard.` })
    } else {
      setMissatge({
        type: 'error',
        text: `Només s'han desat ${exits} de ${resultats.length} marques (${etiquetaTorns}). Motiu del primer error: ${primerError ?? 'desconegut'}`,
      })
    }
  }

  function iniciaDictat(torn) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setMissatge({ type: 'error', text: 'Aquest navegador no permet el dictat per veu. Prova-ho amb Chrome.' })
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'ca-ES'
    recognition.interimResults = false

    setDictat({ torn, transcripcio: '', coincidencies: new Set(), escoltant: true })

    recognition.onresult = (event) => {
      const transcripcio = event.results[0][0].transcript
      const text = normalitza(transcripcio)
      const coincidencies = new Set(
        alumnesClasse
          .filter((a) => {
            const desprésComa = a.nom.split(',')[1]
            const primerNom = normalitza((desprésComa ? desprésComa.trim() : a.nom).split(' ')[0])
            return primerNom.length > 1 && text.includes(primerNom)
          })
          .map((a) => a.id)
      )
      setDictat({ torn, transcripcio, coincidencies, escoltant: false })
    }
    recognition.onerror = () => {
      setDictat(null)
      setMissatge({ type: 'error', text: 'No s\'ha pogut entendre el dictat. Torna-ho a provar.' })
    }
    recognition.start()
  }

  function alternaCoincidencia(alumneId) {
    setDictat((prev) => {
      const nou = new Set(prev.coincidencies)
      if (nou.has(alumneId)) nou.delete(alumneId)
      else nou.add(alumneId)
      return { ...prev, coincidencies: nou }
    })
  }

  function aplicaDictat() {
    if (!dictat) return
    const alumnesAbsents = alumnesClasse.filter((a) => dictat.coincidencies.has(a.id))
    alumnesAbsents.forEach((alumne) => {
      marca(alumne, dictat.torn, 'absent_injustificat')
    })
    setMissatge({ type: 'ok', text: `Marcats ${alumnesAbsents.length} alumnes com a absents sense justificar (${TORNS.find((t) => t.id === dictat.torn)?.label}). Si alguna té justificant, canvia-la manualment a "Absència justificada".` })
    setDictat(null)
  }

  return (
    <div className={`module${vista === 'mes' ? ' module-ample' : ''}`}>
      <p className="module-eyebrow">Passar llista</p>
      <h2>Assistència</h2>
      <p className="module-lead">
        Marca present, retard o absència — justificat o no — per separat a cada torn. Cada
        marca queda desada amb data i hora; si et confons, torna a triar l'opció correcta i
        es desa com un registre nou, sense esborrar l'anterior.
      </p>

      {carregantAlumnes ? (
        <p style={{ marginTop: 24 }}>Carregant alumnes…</p>
      ) : alumnesTots.length === 0 ? (
        <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 24 }}>
          Encara no hi ha cap alumne carregat. Ves al mòdul "Alumnes" per importar-los abans
          de fer servir l'assistència.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginTop: 24, borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
            {[{ id: 'dia', label: 'Passar llista (dia)' }, { id: 'mes', label: 'Vista mensual' }].map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVista(v.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '6px 10px',
                  fontWeight: vista === v.id ? 700 : 400,
                  borderBottom: vista === v.id ? '2px solid var(--ink)' : '2px solid transparent',
                  color: vista === v.id ? 'var(--ink)' : 'var(--ink-soft)',
                }}
              >
                {v.label}
              </button>
            ))}
          </div>

          {vista === 'mes' && (
            <div style={{ marginTop: 20 }}>
              <GraellaMensual cursEscolarId={CURS_ESCOLAR} calendari={calendari} alumnesTots={alumnesTots} />
            </div>
          )}

          {vista === 'dia' && (
          <>
          <div style={{ display: 'flex', gap: 16, marginTop: 24, flexWrap: 'wrap' }}>
            <label className="field" style={{ minWidth: 160 }}>
              <span>Classe</span>
              <select value={curs} onChange={(e) => setCurs(e.target.value)} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
                {cursos.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="field" style={{ minWidth: 180 }}>
              <span>Data</span>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <button
              className="btn-primary"
              style={{ maxWidth: 240 }}
              onClick={() => marcaTothomPresent(['mati', 'tarda'])}
              type="button"
              disabled={alumnesClasse.length === 0}
            >
              ✓ Tothom present (tot el dia)
            </button>
            <button
              className="btn-primary"
              style={{ maxWidth: 200, background: 'var(--navy)', opacity: 0.85 }}
              onClick={() => marcaTothomPresent(['mati'])}
              type="button"
              disabled={alumnesClasse.length === 0}
            >
              ✓ Tothom present (Matí)
            </button>
            <button
              className="btn-primary"
              style={{ maxWidth: 200, background: 'var(--navy)', opacity: 0.85 }}
              onClick={() => marcaTothomPresent(['tarda'])}
              type="button"
              disabled={alumnesClasse.length === 0}
            >
              ✓ Tothom present (Tarda)
            </button>
          </div>
          <p className="module-note" style={{ marginTop: 6 }}>
            Clica'l com a primer pas cada dia, i després només retoca qui falti, arribi tard,
            o tingui justificant.
          </p>

          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            {TORNS.map((t) => (
              <button
                key={t.id}
                className="btn-ghost"
                style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
                onClick={() => iniciaDictat(t.id)}
                type="button"
              >
                🎤 Dicta absències de {t.label}
              </button>
            ))}
          </div>

          {dictat && (
            <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 16 }}>
              {dictat.escoltant ? (
                <p>Escoltant… digues els noms dels alumnes absents de {TORNS.find((t) => t.id === dictat.torn)?.label}.</p>
              ) : (
                <>
                  <p><strong>Sentit:</strong> "{dictat.transcripcio}"</p>
                  <p style={{ marginTop: 8 }}>Alumnes detectats (desmarca'ls si algun no toca):</p>
                  <ul className="roster" style={{ marginTop: 8 }}>
                    {alumnesClasse.map((a) => (
                      <li key={a.id} className="roster-row">
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={dictat.coincidencies.has(a.id)}
                            onChange={() => alternaCoincidencia(a.id)}
                          />
                          {a.nom}
                        </label>
                      </li>
                    ))}
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

          {pendentMotiu && (
            <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 16, borderColor: 'var(--amber-dark)' }}>
              <p>
                <strong>{pendentMotiu.alumne.nom}</strong> — {ESTATS.find((e) => e.id === pendentMotiu.estat)?.label} ({TORNS.find((t) => t.id === pendentMotiu.torn)?.label})
              </p>
              <input
                type="text"
                autoFocus
                placeholder="Motiu (p. ex. visita mèdica, assumptes familiars...)"
                value={pendentMotiu.text}
                onChange={(e) => setPendentMotiu((p) => ({ ...p, text: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && confirmaMotiu()}
                style={{ width: '100%', marginTop: 8, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn-primary" style={{ maxWidth: 140 }} onClick={confirmaMotiu} type="button">Desa</button>
                <button className="btn-ghost" style={{ maxWidth: 140 }} onClick={() => setPendentMotiu(null)} type="button">Cancel·la</button>
              </div>
            </div>
          )}

          {carregantRegistres ? (
            <p style={{ marginTop: 24 }}>Carregant assistència…</p>
          ) : (
            <ul className="roster" style={{ marginTop: 24 }}>
              {alumnesClasse.map((alumne) => (
                <li key={alumne.id} className="roster-row">
                  <span className="roster-name">
                    <span style={{ color: 'var(--ink-soft)', fontWeight: 400, marginRight: 8 }}>{alumne.numLlista ?? '—'}</span>
                    {alumne.nom}
                  </span>
                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                    {TORNS.map((t) => {
                      const registre = registreActual(alumne.id, t.id)
                      const clau = `${alumne.id}-${t.id}`
                      return (
                        <div key={t.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                          <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{t.label}</span>
                          <select
                            value={registre?.estat ?? 'sense_marcar'}
                            onChange={(e) => triaEstat(alumne, t.id, e.target.value)}
                            disabled={desant === clau}
                            style={{
                              border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 12,
                              color: colorEstat(registre?.estat), fontWeight: 600, minWidth: 140,
                            }}
                          >
                            {ESTATS.map((e) => (
                              <option key={e.id} value={e.id}>{e.label}</option>
                            ))}
                          </select>
                          {registre?.motiu && (
                            <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontStyle: 'italic' }}>
                              {registre.motiu}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </li>
              ))}
            </ul>
          )}
          </>
          )}
        </>
      )}

      {missatge && (
        <p style={{ marginTop: 16, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
          {missatge.text}
        </p>
      )}
    </div>
  )
}
