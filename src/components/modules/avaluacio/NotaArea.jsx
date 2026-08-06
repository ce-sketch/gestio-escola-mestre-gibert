import { useEffect, useMemo, useState } from 'react'
import { collection, query, where, getDocs, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import { NIVELLS, nivellPerId, redueixVigents } from '../../../lib/avaluacioCatala'
import { NIVELLS_PER_CICLE, cicleDe, aEscalaComuna } from '../../../lib/rubricaTEE'
import { clAEscalaComuna } from '../../../lib/rubricaLectura'
import { enviaAvis, WORKER_AVISOS_URL } from '../../../lib/email'
import { cursEscolarActual } from '../../../lib/cursEscolar'

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
  const [contactes, setContactes] = useState({})
  const [valors, setValors] = useState({})
  const [desant, setDesant] = useState(false)
  const [enviantAvis, setEnviantAvis] = useState(null)
  const [missatge, setMissatge] = useState(null)

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
      const [areaSnap, teeSnap, lecturaSnap] = await Promise.all([
        getDocs(query(collection(db, 'avaluacio'), where('curs', '==', curs), where('tipus', '==', 'area_catala'))),
        getDocs(query(collection(db, 'avaluacio'), where('curs', '==', curs), where('tipus', '==', 'tee'))),
        getDocs(query(collection(db, 'avaluacio'), where('curs', '==', curs), where('tipus', '==', 'lectura'))),
      ])
      setRegistresArea(areaSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setTeeRegistres(teeSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLecturaRegistres(lecturaSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
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

  function notaGeneralAlumne(alumneId) {
    if (valors[alumneId] !== undefined) return valors[alumneId]
    return vigentsArea.find((r) => r.alumneId === alumneId)?.nivell ?? ''
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
    if (nivellsComuns.length === 0) return null

    const general = nivellPerId(notaGeneral)
    const pitjor = nivellsComuns.reduce((a, b) => (a.nivell.ordre <= b.nivell.ordre ? a : b))

    if (general.ordre - pitjor.nivell.ordre >= LLINDAR_AVIS) {
      return { general, pitjor: pitjor.nivell, origen: pitjor.origen }
    }
    return null
  }

  async function desaTot() {
    setDesant(true)
    setMissatge(null)
    let desats = 0
    try {
      for (const alumne of alumnesClasse) {
        if (valors[alumne.id] === undefined || valors[alumne.id] === '') continue
        await addDoc(collection(db, 'avaluacio'), {
          tipus: 'area_catala',
          alumneId: alumne.id,
          alumneNom: alumne.nom,
          curs,
          cursEscolar: cursEscolarId,
          trimestre,
          nivell: valors[alumne.id],
          creatEl: serverTimestamp(),
          creatPer: auth.currentUser?.email ?? null,
        })
        desats += 1
      }
      setValors({})
      await carregaDades()
      setMissatge({ type: 'ok', text: `${desats} alumnes desats.` })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar: ${err.message}` })
    } finally {
      setDesant(false)
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

  if (carregant) return <p>Carregant…</p>

  return (
    <div>
      <p className="module-lead">
        Nota general de Català del trimestre (l'informe consolidat per àrees). L'app avisa
        automàticament si aquesta nota no quadra amb els resultats de TEE o de Lectura.
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

      <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', marginTop: 20 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
            <th style={{ padding: '6px 8px', minWidth: 160 }}>Alumne</th>
            <th style={{ padding: '6px 8px', minWidth: 160 }}>Nota general Català</th>
            <th style={{ padding: '6px 8px' }}>Coherència amb TEE/CL</th>
          </tr>
        </thead>
        <tbody>
          {alumnesClasse.map((alumne) => {
            const incoherencia = comprovaCoherencia(alumne.id)
            return (
              <tr key={alumne.id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '6px 8px', fontWeight: 500 }}>{alumne.nom}</td>
                <td style={{ padding: '4px 6px' }}>
                  <select
                    value={notaGeneralAlumne(alumne.id)}
                    onChange={(e) => setValors((prev) => ({ ...prev, [alumne.id]: e.target.value }))}
                    style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 12 }}
                  >
                    <option value="">—</option>
                    {NIVELLS.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
                  </select>
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

      <button className="btn-primary" style={{ marginTop: 20, maxWidth: 220 }} onClick={desaTot} disabled={desant}>
        {desant ? 'Desant…' : 'Desa notes de la classe'}
      </button>

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
          {missatge.text}
        </p>
      )}
    </div>
  )
}
