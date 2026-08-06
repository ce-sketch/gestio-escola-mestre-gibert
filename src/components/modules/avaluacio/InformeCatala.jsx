import { useEffect, useMemo, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../../firebase'
import { redueixVigents } from '../../../lib/avaluacioCatala'
import { CRITERIS_TEE, NIVELLS_PER_CICLE, cicleDe } from '../../../lib/rubricaTEE'
import { MOMENTS_LECTURA } from '../../../lib/rubricaLectura'
import { cursEscolarActual } from '../../../lib/cursEscolar'

const TRIMESTRES = ['1r trimestre', '2n trimestre', '3r trimestre']

export default function InformeCatala() {
  const [alumnesTots, setAlumnesTots] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [curs, setCurs] = useState('')
  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [alumneId, setAlumneId] = useState('')
  const [teeRegistres, setTeeRegistres] = useState([])
  const [lecturaRegistres, setLecturaRegistres] = useState([])
  const [carregantInforme, setCarregantInforme] = useState(false)
  const [missatge, setMissatge] = useState(null)

  useEffect(() => {
    async function carrega() {
      try {
        const q = query(collection(db, 'alumnes'), where('actiu', '==', true))
        const snap = await getDocs(q)
        const llista = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        llista.sort((a, b) => (a.numLlista ?? 999) - (b.numLlista ?? 999) || a.nom.localeCompare(b.nom))
        setAlumnesTots(llista)
        if (llista.length > 0) setCurs((c) => c || llista[0].curs)
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
    if (alumnesClasse.length > 0 && !alumnesClasse.find((a) => a.id === alumneId)) {
      setAlumneId(alumnesClasse[0].id)
    }
  }, [alumnesClasse, alumneId])

  useEffect(() => {
    if (!curs) return
    carregaDades()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curs])

  async function carregaDades() {
    setCarregantInforme(true)
    try {
      const [teeSnap, lecturaSnap] = await Promise.all([
        getDocs(query(collection(db, 'avaluacio'), where('curs', '==', curs), where('tipus', '==', 'tee'))),
        getDocs(query(collection(db, 'avaluacio'), where('curs', '==', curs), where('tipus', '==', 'lectura'))),
      ])
      setTeeRegistres(teeSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLecturaRegistres(lecturaSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'han pogut carregar les dades: ${err.message}` })
    } finally {
      setCarregantInforme(false)
    }
  }

  const teeAlumne = useMemo(
    () => redueixVigents(
      teeRegistres.filter((r) => r.alumneId === alumneId && (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId),
      (r) => r.trimestre
    ),
    [teeRegistres, alumneId, cursEscolarId]
  )
  const lecturaAlumne = useMemo(
    () => redueixVigents(
      lecturaRegistres.filter((r) => r.alumneId === alumneId && (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId),
      (r) => r.moment
    ),
    [lecturaRegistres, alumneId, cursEscolarId]
  )

  const alumneActual = alumnesClasse.find((a) => a.id === alumneId)

  if (carregant) return <p>Carregant…</p>

  return (
    <div>
      <p className="module-lead">
        Resum de llengua catalana d'un alumne: evolució de Text Escrit (TEE) i de Lectura
        (VL/CL) al llarg del curs, a partir de les notes introduïdes als altres dos apartats.
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
        <label className="field" style={{ minWidth: 220 }}>
          <span>Alumne</span>
          <select value={alumneId} onChange={(e) => setAlumneId(e.target.value)} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
            {alumnesClasse.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
          </select>
        </label>
      </div>

      {carregantInforme ? (
        <p style={{ marginTop: 20 }}>Carregant…</p>
      ) : !alumneActual ? (
        <p style={{ marginTop: 20 }}>No hi ha cap alumne en aquesta classe.</p>
      ) : (
        <>
          <h3 style={{ marginTop: 28, fontSize: 18 }}>{alumneActual.nom}</h3>

          <p className="module-note" style={{ marginTop: 20, fontStyle: 'normal', fontWeight: 600, color: 'var(--ink)' }}>
            Text Escrit (TEE)
          </p>
          {teeAlumne.length === 0 ? (
            <p className="module-note">Encara no hi ha cap nota de Text Escrit per aquest alumne.</p>
          ) : (
            <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', marginTop: 8 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                  <th style={{ padding: '6px 8px' }}>Trimestre</th>
                  {CRITERIS_TEE.map((c) => <th key={c.id} style={{ padding: '6px 8px' }}>{c.label}</th>)}
                  <th style={{ padding: '6px 8px' }}>Nota (0-10)</th>
                  <th style={{ padding: '6px 8px' }}>Global</th>
                </tr>
              </thead>
              <tbody>
                {TRIMESTRES.map((t) => {
                  const reg = teeAlumne.find((r) => r.trimestre === t)
                  if (!reg) return null
                  const nivellsCicle = NIVELLS_PER_CICLE[reg.cicle ?? cicleDe(curs)]
                  const etiquetaNivell = (id) => nivellsCicle.find((n) => n.id === id)
                  const globalNivell = etiquetaNivell(reg.global)
                  return (
                    <tr key={t} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 500 }}>{t}</td>
                      {CRITERIS_TEE.map((c) => (
                        <td key={c.id} style={{ padding: '6px 8px' }}>
                          {etiquetaNivell(reg.criteris?.[c.id])?.label ?? '—'}
                        </td>
                      ))}
                      <td style={{ padding: '6px 8px', color: 'var(--ink-soft)' }}>{reg.notaAutomatica ?? '—'}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 600, color: globalNivell?.color }}>
                        {globalNivell?.label ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          <p className="module-note" style={{ marginTop: 28, fontStyle: 'normal', fontWeight: 600, color: 'var(--ink)' }}>
            Lectura (VL / CL)
          </p>
          {lecturaAlumne.length === 0 ? (
            <p className="module-note">Encara no hi ha cap nota de Lectura per aquest alumne.</p>
          ) : (
            <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', marginTop: 8 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                  <th style={{ padding: '6px 8px' }}>Moment</th>
                  <th style={{ padding: '6px 8px' }}>VL (paraules/min)</th>
                  <th style={{ padding: '6px 8px' }}>Nivell lector</th>
                  <th style={{ padding: '6px 8px' }}>CL (respostes)</th>
                  <th style={{ padding: '6px 8px' }}>Nivell CL</th>
                </tr>
              </thead>
              <tbody>
                {MOMENTS_LECTURA.map((m) => {
                  const reg = lecturaAlumne.find((r) => r.moment === m.id)
                  if (!reg) return null
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 500 }}>{m.label}</td>
                      <td style={{ padding: '6px 8px' }}>{reg.vl ?? '—'}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--navy)' }}>{reg.nivellVl ?? '—'}</td>
                      <td style={{ padding: '6px 8px' }}>{m.teCL ? (reg.cl ?? '—') : '—'}</td>
                      <td style={{ padding: '6px 8px', fontWeight: 600 }}>{m.teCL ? (reg.nivellCl ?? '—') : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {teeAlumne.length === 0 && lecturaAlumne.length === 0 && (
            <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 20 }}>
              Encara no hi ha cap nota de llengua catalana per a aquest alumne. Introdueix-les
              als apartats "TEE" o "Lectura" d'aquest mateix mòdul.
            </div>
          )}
        </>
      )}

      {missatge && (
        <p style={{ marginTop: 16, fontSize: 13, color: 'var(--red)' }}>{missatge.text}</p>
      )}
    </div>
  )
}
