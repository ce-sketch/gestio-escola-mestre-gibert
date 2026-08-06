import { useEffect, useMemo, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../../firebase'
import { redueixVigents } from '../../../lib/avaluacioCatala'
import { NIVELLS_PER_CICLE, cicleDe, aEscalaComuna } from '../../../lib/rubricaTEE'
import { MOMENTS_LECTURA, vlAEscalaComuna } from '../../../lib/rubricaLectura'
import { cursEscolarActual } from '../../../lib/cursEscolar'

const TRIMESTRES = ['1r trimestre', '2n trimestre', '3r trimestre']
const COLUMNES_COMUNES = [
  { id: 'no_assoliment', label: 'No Assoliment' },
  { id: 'assoliment_satisfactori', label: 'Ass. Satisfactori' },
  { id: 'assoliment_notable', label: 'Ass. Notable' },
  { id: 'assoliment_excel·lent', label: 'Ass. Excel·lent' },
]
const COLUMNES_CL = ['BAIX', 'M.BAIX', 'M.ALT', 'ALT']

export default function Resum() {
  const [alumnesTots, setAlumnesTots] = useState([])
  const [teeRegistres, setTeeRegistres] = useState([])
  const [lecturaRegistres, setLecturaRegistres] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [trimestre, setTrimestre] = useState('1r trimestre')
  const [missatge, setMissatge] = useState(null)

  useEffect(() => {
    async function carrega() {
      try {
        const [snapAlumnes, snapAvaluacio] = await Promise.all([
          getDocs(query(collection(db, 'alumnes'), where('actiu', '==', true))),
          getDocs(collection(db, 'avaluacio')),
        ])
        setAlumnesTots(snapAlumnes.docs.map((d) => ({ id: d.id, ...d.data() })))
        const totes = snapAvaluacio.docs.map((d) => ({ id: d.id, ...d.data() }))
        setTeeRegistres(totes.filter((r) => r.tipus === 'tee'))
        setLecturaRegistres(totes.filter((r) => r.tipus === 'lectura'))
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'han pogut carregar les dades: ${err.message}` })
      } finally {
        setCarregant(false)
      }
    }
    carrega()
  }, [])

  const cursos = useMemo(() => [...new Set(alumnesTots.map((a) => a.curs))].sort(), [alumnesTots])

  // ---- Resum TEE del trimestre seleccionat ----
  const resumTee = useMemo(() => {
    const delTrimestre = teeRegistres.filter((r) => r.trimestre === trimestre && (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId)
    const vigents = redueixVigents(delTrimestre, (r) => `${r.alumneId}-${r.trimestre}`)
    return cursos.map((curs) => {
      const comptadors = Object.fromEntries(COLUMNES_COMUNES.map((c) => [c.id, 0]))
      vigents.filter((r) => r.curs === curs).forEach((r) => {
        const comu = aEscalaComuna(r.global)
        if (comu) comptadors[comu] += 1
      })
      return { curs, comptadors, total: Object.values(comptadors).reduce((a, b) => a + b, 0) }
    })
  }, [teeRegistres, trimestre, cursos, cursEscolarId])

  // ---- Resum Lectura CL (Inicial i Final) ----
  const resumCl = useMemo(() => {
    return ['inicial', 'final'].map((momentId) => {
      const vigents = redueixVigents(
        lecturaRegistres.filter((r) => r.moment === momentId && (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId),
        (r) => `${r.alumneId}-${momentId}`
      )
      const files = cursos.map((curs) => {
        const comptadors = Object.fromEntries(COLUMNES_CL.map((c) => [c, 0]))
        vigents.filter((r) => r.curs === curs && r.nivellCl).forEach((r) => {
          comptadors[r.nivellCl] += 1
        })
        return { curs, comptadors, total: Object.values(comptadors).reduce((a, b) => a + b, 0) }
      })
      return { momentId, label: MOMENTS_LECTURA.find((m) => m.id === momentId)?.label, files }
    })
  }, [lecturaRegistres, cursos, cursEscolarId])

  // ---- Resum Velocitat Lectora (VL), amb la fórmula real (comparació amb el propi curs) ----
  const resumVl = useMemo(() => {
    return MOMENTS_LECTURA.map((moment) => {
      const vigents = redueixVigents(
        lecturaRegistres.filter((r) => r.moment === moment.id && (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId),
        (r) => `${r.alumneId}-${moment.id}`
      )
      const files = cursos.map((curs) => {
        const comptadors = Object.fromEntries(COLUMNES_COMUNES.map((c) => [c.id, 0]))
        vigents.filter((r) => r.curs === curs && r.vl !== null && r.vl !== undefined).forEach((r) => {
          const comu = vlAEscalaComuna(r.vl, r.nivellVl, curs)
          if (comu) comptadors[comu] += 1
        })
        return { curs, comptadors, total: Object.values(comptadors).reduce((a, b) => a + b, 0) }
      })
      return { moment, files }
    })
  }, [lecturaRegistres, cursos, cursEscolarId])

  if (carregant) return <p>Carregant…</p>

  return (
    <div>
      <p className="module-lead">
        Resums globals, equivalents als fulls "Global curs" i "Resum Trimestres" dels
        documents originals — calculats sols a partir de les notes introduïdes, sense
        fórmules que es puguin trencar.
      </p>

      <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
        <label className="field" style={{ maxWidth: 140 }}>
          <span>Curs escolar</span>
          <input
            type="text"
            value={cursEscolarId}
            onChange={(e) => setCursEscolarId(e.target.value)}
            style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontWeight: 600 }}
          />
        </label>
      </div>

      <h3 style={{ marginTop: 28, fontSize: 16 }}>Resum TEE per classe</h3>
      <label className="field" style={{ maxWidth: 200, marginTop: 8 }}>
        <span>Trimestre</span>
        <select value={trimestre} onChange={(e) => setTrimestre(e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }}>
          {TRIMESTRES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', marginTop: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
            <th style={{ padding: '6px 8px' }}>Classe</th>
            {COLUMNES_COMUNES.map((c) => <th key={c.id} style={{ padding: '6px 8px' }}>{c.label}</th>)}
            <th style={{ padding: '6px 8px' }}>Total avaluats</th>
          </tr>
        </thead>
        <tbody>
          {resumTee.map((fila) => (
            <tr key={fila.curs} style={{ borderBottom: '1px solid var(--line)' }}>
              <td style={{ padding: '6px 8px', fontWeight: 500 }}>{fila.curs}</td>
              {COLUMNES_COMUNES.map((c) => <td key={c.id} style={{ padding: '6px 8px' }}>{fila.comptadors[c.id]}</td>)}
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{fila.total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 style={{ marginTop: 32, fontSize: 16 }}>Resum Comprensió Lectora (CL)</h3>
      {resumCl.map(({ momentId, label, files }) => (
        <div key={momentId} style={{ marginTop: 16 }}>
          <p className="module-note" style={{ fontStyle: 'normal', fontWeight: 600, color: 'var(--ink)' }}>{label}</p>
          <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', marginTop: 8 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                <th style={{ padding: '6px 8px' }}>Classe</th>
                {COLUMNES_CL.map((c) => <th key={c} style={{ padding: '6px 8px' }}>{c}</th>)}
                <th style={{ padding: '6px 8px' }}>Total avaluats</th>
              </tr>
            </thead>
            <tbody>
              {files.map((fila) => (
                <tr key={fila.curs} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 500 }}>{fila.curs}</td>
                  {COLUMNES_CL.map((c) => <td key={c} style={{ padding: '6px 8px' }}>{fila.comptadors[c]}</td>)}
                  <td style={{ padding: '6px 8px', fontWeight: 600 }}>{fila.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <h3 style={{ marginTop: 32, fontSize: 16 }}>Resum Velocitat Lectora (VL)</h3>
      {resumVl.map(({ moment, files }) => (
        <div key={moment.id} style={{ marginTop: 16 }}>
          <p className="module-note" style={{ fontStyle: 'normal', fontWeight: 600, color: 'var(--ink)' }}>{moment.label}</p>
          <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', marginTop: 8 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                <th style={{ padding: '6px 8px' }}>Classe</th>
                {COLUMNES_COMUNES.map((c) => <th key={c.id} style={{ padding: '6px 8px' }}>{c.label}</th>)}
                <th style={{ padding: '6px 8px' }}>Total avaluats</th>
              </tr>
            </thead>
            <tbody>
              {files.map((fila) => (
                <tr key={fila.curs} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 500 }}>{fila.curs}</td>
                  {COLUMNES_COMUNES.map((c) => <td key={c.id} style={{ padding: '6px 8px' }}>{fila.comptadors[c.id]}</td>)}
                  <td style={{ padding: '6px 8px', fontWeight: 600 }}>{fila.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {missatge && (
        <p style={{ marginTop: 16, fontSize: 13, color: 'var(--red)' }}>{missatge.text}</p>
      )}
    </div>
  )
}
