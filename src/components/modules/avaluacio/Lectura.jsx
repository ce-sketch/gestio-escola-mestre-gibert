import { useEffect, useMemo, useState } from 'react'
import { collection, query, where, getDocs, addDoc, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import { redueixVigents } from '../../../lib/avaluacioCatala'
import { MOMENTS_LECTURA, nivellVL, nivellCL, LLINDARS_CL_DEFECTE, esClasseAmbLectura } from '../../../lib/rubricaLectura'
import { cursEscolarActual } from '../../../lib/cursEscolar'
import { esAdmin } from '../../../lib/roles'
import { exportaExcel, exportaPDF } from '../../../lib/exportTaula'

const GRUPS_LLINDAR = [
  { id: 'grau1', label: '1r' },
  { id: 'grau2', label: '2n' },
  { id: 'grau3a6', label: '3r a 6è' },
]

export default function Lectura() {
  const [alumnesTots, setAlumnesTots] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [curs, setCurs] = useState('')
  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [momentId, setMomentId] = useState('inicial')
  const [registres, setRegistres] = useState([])
  const [carregantRegistres, setCarregantRegistres] = useState(false)
  const [valors, setValors] = useState({})
  const [desantId, setDesantId] = useState(null) // id de l'alumne que s'està desant
  const [missatge, setMissatge] = useState(null)
  const [llindarsCl, setLlindarsCl] = useState(LLINDARS_CL_DEFECTE)
  const [editantLlindars, setEditantLlindars] = useState(false)
  const [llindarsEdicio, setLlindarsEdicio] = useState(null)
  const [desantLlindars, setDesantLlindars] = useState(false)

  const moment = MOMENTS_LECTURA.find((m) => m.id === momentId)

  useEffect(() => {
    async function carrega() {
      try {
        const [snapAlumnes, snapLlindars] = await Promise.all([
          getDocs(query(collection(db, 'alumnes'), where('actiu', '==', true))),
          getDoc(doc(db, 'configuracio', 'llindarsCL')),
        ])
        // La VL/CL no es fa a Educació Infantil: es filtren les seves
        // classes abans que arribin enlloc, no només al desplegable.
        const llista = snapAlumnes.docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => esClasseAmbLectura(a.curs))
        llista.sort((a, b) => (a.numLlista ?? 999) - (b.numLlista ?? 999) || a.nom.localeCompare(b.nom))
        setAlumnesTots(llista)
        if (llista.length > 0) setCurs((c) => c || llista[0].curs)
        if (snapLlindars.exists()) setLlindarsCl((prev) => ({ ...prev, ...snapLlindars.data() }))
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

  useEffect(() => {
    if (!curs) return
    carregaRegistres()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curs])

  async function carregaRegistres() {
    setCarregantRegistres(true)
    try {
      const q = query(collection(db, 'avaluacio'), where('curs', '==', curs), where('tipus', '==', 'lectura'))
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
      registres.filter((r) => r.moment === momentId && (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId),
      (r) => r.alumneId
    ),
    [registres, momentId, cursEscolarId]
  )

  function valorAlumne(alumneId, camp) {
    if (valors[alumneId]?.[camp] !== undefined) return valors[alumneId][camp]
    const vigent = vigents.find((r) => r.alumneId === alumneId)
    return vigent?.[camp] ?? ''
  }

  function updateValor(alumneId, camp, value) {
    setValors((prev) => ({ ...prev, [alumneId]: { ...prev[alumneId], [camp]: value } }))
  }

  /** Desa VL+CL d'UN alumne a l'instant (es crida en sortir de qualsevol
   *  dels dos camps) — no cal cap botó "Desa" ni recordar-se'n. Com que VL
   *  i CL viuen al mateix registre, sempre es desen junts amb el valor
   *  actual de tots dos camps. */
  async function desaAlumne(alumne) {
    const vl = valorAlumne(alumne.id, 'vl')
    const cl = valorAlumne(alumne.id, 'cl')
    if (vl === '' && cl === '') return

    const vigent = vigents.find((r) => r.alumneId === alumne.id)
    const vlNou = vl !== '' ? Number(vl) : null
    const clNou = cl !== '' && moment.teCL ? Number(cl) : null
    if (vigent && (vigent.vl ?? null) === vlNou && (vigent.cl ?? null) === clNou) {
      // Sense canvis reals respecte al que ja hi havia — no cal escriure res.
      setValors((prev) => { const n = { ...prev }; delete n[alumne.id]; return n })
      return
    }

    setDesantId(alumne.id)
    setMissatge(null)
    try {
      await addDoc(collection(db, 'avaluacio'), {
        tipus: 'lectura',
        alumneId: alumne.id,
        alumneNom: alumne.nom,
        curs,
        cursEscolar: cursEscolarId,
        moment: momentId,
        vl: vlNou,
        nivellVl: vl !== '' ? nivellVL(vl) : null,
        cl: clNou,
        nivellCl: clNou !== null ? nivellCL(cl, curs, llindarsCl) : null,
        creatEl: serverTimestamp(),
        creatPer: auth.currentUser?.email ?? null,
      })
      await carregaRegistres()
      setValors((prev) => { const n = { ...prev }; delete n[alumne.id]; return n })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar la lectura de ${alumne.nom}: ${err.message}` })
    } finally {
      setDesantId(null)
    }
  }

  function iniciaEdicioLlindars() {
    setLlindarsEdicio({
      grau1: [...llindarsCl.grau1],
      grau2: [...llindarsCl.grau2],
      grau3a6: [...llindarsCl.grau3a6],
    })
    setEditantLlindars(true)
  }

  function updateLlindar(grupId, index, valor) {
    setLlindarsEdicio((prev) => {
      const nou = { ...prev, [grupId]: [...prev[grupId]] }
      nou[grupId][index] = Number(valor)
      return nou
    })
  }

  async function desaLlindars() {
    for (const grup of GRUPS_LLINDAR) {
      const [a, b, c] = llindarsEdicio[grup.id]
      if (!(a < b && b < c)) {
        setMissatge({ type: 'error', text: `Els 3 llindars de ${grup.label} han d'anar en ordre creixent (ara: ${a}, ${b}, ${c}).` })
        return
      }
    }
    setDesantLlindars(true)
    try {
      await setDoc(doc(db, 'configuracio', 'llindarsCL'), llindarsEdicio)
      setLlindarsCl(llindarsEdicio)
      setEditantLlindars(false)
      setMissatge({ type: 'ok', text: 'Llindars de Comprensió Lectora desats.' })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'han pogut desar els llindars: ${err.message}` })
    } finally {
      setDesantLlindars(false)
    }
  }

  if (carregant) return <p>Carregant…</p>

  /** Taula de Lectura de LA CLASSE ACTUAL (VL i CL del moment seleccionat). */
  function taulaClasseActual() {
    const capçalera = ['Núm.', 'Alumne', 'VL (paraules/min)', 'Nivell lector']
    if (moment.teCL) capçalera.push('CL (respostes correctes)', 'Nivell CL')
    const files = alumnesClasse.map((alumne) => {
      const vl = valorAlumne(alumne.id, 'vl')
      const cl = valorAlumne(alumne.id, 'cl')
      const fila = [alumne.numLlista ?? '', alumne.nom, vl, nivellVL(vl) ?? '']
      if (moment.teCL) fila.push(cl, moment.teCL ? (nivellCL(cl, curs, llindarsCl) ?? '') : '')
      return fila
    })
    return [{ nom: `Lectura ${curs}`, files: [capçalera, ...files] }]
  }

  return (
    <div>
      <p className="module-lead">
        Introdueix la Velocitat Lectora (paraules/minut) i, quan toqui, la Comprensió
        Lectora (nombre de respostes correctes). Els nivells es calculen sols amb els
        mateixos barems del full de càlcul original — diferents segons el curs (1r, 2n, i
        3r a 6è tenen escales pròpies).
      </p>

      <div style={{ marginTop: 12 }}>
        {!esAdmin(auth.currentUser) ? (
          <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            Llindars de CL: {GRUPS_LLINDAR.map((g) => `${g.label} (${llindarsCl[g.id].join('/')})`).join(' · ')}
          </p>
        ) : !editantLlindars ? (
          <button className="btn-ghost" style={{ color: 'var(--ink-soft)', borderColor: 'var(--line)', fontSize: 12 }} onClick={iniciaEdicioLlindars} type="button">
            ⚙ Llindars de CL: {GRUPS_LLINDAR.map((g) => `${g.label} (${llindarsCl[g.id].join('/')})`).join(' · ')}
          </button>
        ) : (
          <div className="placeholder-box" style={{ borderStyle: 'solid' }}>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>
              Llindars de Comprensió Lectora (respostes correctes on comença cada nivell)
            </p>
            {GRUPS_LLINDAR.map((grup) => (
              <div key={grup.id} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ minWidth: 60, fontWeight: 600 }}>{grup.label}</span>
                <span style={{ fontSize: 12 }}>BAIX fins a</span>
                <input
                  type="number" min="0" value={llindarsEdicio[grup.id][0]}
                  onChange={(e) => updateLlindar(grup.id, 0, e.target.value)}
                  style={{ width: 56, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px' }}
                />
                <span style={{ fontSize: 12 }}>M.BAIX fins a</span>
                <input
                  type="number" min="0" value={llindarsEdicio[grup.id][1]}
                  onChange={(e) => updateLlindar(grup.id, 1, e.target.value)}
                  style={{ width: 56, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px' }}
                />
                <span style={{ fontSize: 12 }}>M.ALT fins a</span>
                <input
                  type="number" min="0" value={llindarsEdicio[grup.id][2]}
                  onChange={(e) => updateLlindar(grup.id, 2, e.target.value)}
                  style={{ width: 56, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px' }}
                />
                <span style={{ fontSize: 12 }}>ALT a partir d'aquí</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn-primary" style={{ maxWidth: 140 }} onClick={desaLlindars} disabled={desantLlindars} type="button">
                {desantLlindars ? 'Desant…' : 'Desa els llindars'}
              </button>
              <button className="btn-ghost" style={{ maxWidth: 140 }} onClick={() => setEditantLlindars(false)} type="button">
                Cancel·la
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
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
        <label className="field" style={{ minWidth: 180 }}>
          <span>Moment</span>
          <select value={momentId} onChange={(e) => setMomentId(e.target.value)} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
            {MOMENTS_LECTURA.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
      </div>

      {!moment.teCL && (
        <p className="module-note" style={{ marginTop: 12 }}>
          En aquest moment només s'avalua la Velocitat Lectora — la Comprensió Lectora no
          es passa a l'Avaluació Mitjana.
        </p>
      )}

      {carregantRegistres ? (
        <p style={{ marginTop: 20 }}>Carregant notes…</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <button
              className="btn-ghost"
              style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
              onClick={() => exportaExcel(`Lectura-${curs}-${moment.label.replace(/\s+/g, '_')}`, { cursEscolarId, fulls: taulaClasseActual(), etiqueta: 'Avaluació' })}
              type="button"
            >
              📥 Descarrega Excel ({curs})
            </button>
            <button
              className="btn-ghost"
              style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
              onClick={() => exportaPDF(`Lectura — ${curs} — ${moment.label}`, { cursEscolarId, fulls: taulaClasseActual(), etiqueta: 'Avaluació' })}
              type="button"
            >
              📄 Descarrega PDF ({curs})
            </button>
          </div>
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                <th style={{ padding: '6px 8px', width: 44 }}>Núm.</th>
                <th style={{ padding: '6px 8px', minWidth: 160 }}>Alumne</th>
                <th style={{ padding: '6px 8px' }}>VL (paraules/min)</th>
                <th style={{ padding: '6px 8px' }}>Nivell lector</th>
                {moment.teCL && <th style={{ padding: '6px 8px' }}>CL (respostes correctes)</th>}
                {moment.teCL && <th style={{ padding: '6px 8px' }}>Nivell CL</th>}
              </tr>
            </thead>
            <tbody>
              {alumnesClasse.map((alumne) => {
                const vl = valorAlumne(alumne.id, 'vl')
                const nVl = nivellVL(vl)
                const cl = valorAlumne(alumne.id, 'cl')
                const nCl = moment.teCL ? nivellCL(cl, curs, llindarsCl) : null
                return (
                  <tr key={alumne.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 8px', color: 'var(--ink-soft)' }}>{alumne.numLlista ?? '—'}</td>
                    <td style={{ padding: '6px 8px', fontWeight: 500 }}>{alumne.nom}</td>
                    <td style={{ padding: '4px 6px' }}>
                      <input
                        type="number" min="0" step="1"
                        value={vl}
                        disabled={desantId === alumne.id}
                        onChange={(e) => updateValor(alumne.id, 'vl', e.target.value)}
                        onBlur={() => desaAlumne(alumne)}
                        style={{ width: 80, border: `1px solid ${desantId === alumne.id ? 'var(--amber-dark)' : 'var(--line)'}`, borderRadius: 6, padding: '4px 6px' }}
                      />
                    </td>
                    <td style={{ padding: '4px 6px', fontWeight: 600, color: 'var(--navy)' }}>{nVl ?? '—'}</td>
                    {moment.teCL && (
                      <td style={{ padding: '4px 6px' }}>
                        <input
                          type="number" min="0" step="1"
                          value={cl}
                          disabled={desantId === alumne.id}
                          onChange={(e) => updateValor(alumne.id, 'cl', e.target.value)}
                          onBlur={() => desaAlumne(alumne)}
                          style={{ width: 80, border: `1px solid ${desantId === alumne.id ? 'var(--amber-dark)' : 'var(--line)'}`, borderRadius: 6, padding: '4px 6px' }}
                        />
                      </td>
                    )}
                    {moment.teCL && (
                      <td style={{ padding: '4px 6px', fontWeight: 600 }}>{nCl ?? '—'}</td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 12 }}>
        Cada VL/CL es desa sol en sortir de la casella (no cal cap botó "Desa") — així no es
        perd res encara que es tanqui la pestanya sense voler.
      </p>

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
          {missatge.text}
        </p>
      )}
    </div>
  )
}
