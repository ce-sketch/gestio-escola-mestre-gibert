// Entrada de la lectoescriptura d'Educació Infantil (I4 i I5), equivalent
// a les pestanyes "I4A", "I4B", "I5A", "I5B" i "RESUM EI" de l'Eina
// d'avaluació.
//
// Un sol document per classe i curs escolar (no un per alumne ni per
// trimestre: l'avaluació és única, de maig/juny), amb un mapa
// alumneId -> quins dels 18 nivells té marcats.

import { useEffect, useMemo, useState } from 'react'
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import { cursEscolarActual } from '../../../lib/cursEscolar'
import { slug } from '../../../lib/slug'
import {
  ETAPES_TEBEROSKY, NIVELLS_TEBEROSKY, esClasseEI4o5, nivellsBuits, comptaNivells,
} from '../../../lib/lectoescripturaEI'

export default function LectoescripturaEI() {
  const [alumnesTots, setAlumnesTots] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [missatge, setMissatge] = useState(null)

  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [classe, setClasse] = useState('')
  const [dades, setDades] = useState(null) // { alumnes: { [alumneId]: { [nivellId]: bool } } }
  const [carregantClasse, setCarregantClasse] = useState(false)
  const [desant, setDesant] = useState(false)

  useEffect(() => {
    async function carrega() {
      try {
        const snap = await getDocs(query(collection(db, 'alumnes'), where('actiu', '==', true)))
        const llista = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        llista.sort((a, b) => (a.numLlista ?? 999) - (b.numLlista ?? 999) || a.nom.localeCompare(b.nom))
        setAlumnesTots(llista)
        const primera = [...new Set(llista.map((a) => a.curs))].filter(esClasseEI4o5).sort()[0]
        if (primera) setClasse((c) => c || primera)
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'han pogut carregar els alumnes: ${err.message}` })
      } finally {
        setCarregant(false)
      }
    }
    carrega()
  }, [])

  const classes = useMemo(
    () => [...new Set(alumnesTots.map((a) => a.curs))].filter(esClasseEI4o5).sort(),
    [alumnesTots]
  )
  const alumnesClasse = useMemo(() => alumnesTots.filter((a) => a.curs === classe), [alumnesTots, classe])

  useEffect(() => {
    if (!classe) return
    async function carregaClasse() {
      setCarregantClasse(true)
      setMissatge(null)
      try {
        const id = `${cursEscolarId}__${slug(classe)}`
        const snap = await getDoc(doc(db, 'lectoescripturaEI', id))
        setDades(snap.exists() ? snap.data() : { alumnes: {} })
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'ha pogut carregar: ${err.message}` })
      } finally {
        setCarregantClasse(false)
      }
    }
    carregaClasse()
  }, [classe, cursEscolarId])

  async function marca(alumneId, nivellId, valor) {
    const nou = {
      ...dades,
      alumnes: {
        ...dades.alumnes,
        [alumneId]: { ...(dades.alumnes[alumneId] ?? nivellsBuits()), [nivellId]: valor },
      },
    }
    setDades(nou)
    setDesant(true)
    setMissatge(null)
    try {
      const id = `${cursEscolarId}__${slug(classe)}`
      await setDoc(doc(db, 'lectoescripturaEI', id), {
        classe,
        cursEscolar: cursEscolarId,
        alumnes: nou.alumnes,
        actualitzatEl: new Date(),
        actualitzatPer: auth.currentUser?.email ?? null,
      })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar: ${err.message}` })
    } finally {
      setDesant(false)
    }
  }

  // Equivalent a "RESUM EI": el comptatge d'aquesta classe, sempre visible
  // sota la graella perquè no calgui sortir de la pestanya per veure'l.
  const resumClasse = useMemo(() => {
    if (!dades) return null
    return comptaNivells(alumnesClasse.map((a) => a.id), dades.alumnes)
  }, [dades, alumnesClasse])

  if (carregant) return <p>Carregant…</p>

  return (
    <div>
      <p className="module-lead">
        Lectoescriptura d&apos;Infantil (I4 i I5): escala Teberosky, igual que a les pestanyes
        &quot;I4A&quot;, &quot;I4B&quot;, &quot;I5A&quot; i &quot;I5B&quot; de l&apos;Eina
        d&apos;avaluació. Es marca un sol cop l&apos;any (maig/juny) — no per trimestre.
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
        <label className="field" style={{ minWidth: 120 }}>
          <span>Classe</span>
          <select value={classe} onChange={(e) => setClasse(e.target.value)} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>

      {desant && <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8 }}>Desant…</p>}

      {carregantClasse || !dades ? (
        <p style={{ marginTop: 16 }}>Carregant…</p>
      ) : (
        <div className="taula-scroll" style={{ marginTop: 16 }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th rowSpan={3} style={{ padding: '6px 8px', minWidth: 160, position: 'sticky', left: 0, background: 'var(--bg)', borderBottom: '2px solid var(--line)' }}>
                  Alumne
                </th>
                {ETAPES_TEBEROSKY.map((etapa) => (
                  <th key={etapa.id} colSpan={etapa.nivells.length} style={{ padding: '4px', textAlign: 'center', borderLeft: '1px solid var(--line)', borderBottom: '1px solid var(--line)', fontSize: 11 }}>
                    {etapa.titol}
                  </th>
                ))}
              </tr>
              <tr>
                {ETAPES_TEBEROSKY.flatMap((etapa) => etapa.nivells).map((n, i, tots) => {
                  const anterior = tots[i - 1]
                  const canviaSubgrup = n.subgrup !== anterior?.subgrup || n.etapa !== anterior?.etapa
                  return (
                    <th key={n.id} style={{ padding: '4px 3px', textAlign: 'center', fontSize: 10, color: 'var(--ink-soft)', fontWeight: 400, borderLeft: canviaSubgrup ? '1px solid var(--line)' : 'none' }}>
                      {n.subgrup ?? ''}
                    </th>
                  )
                })}
              </tr>
              <tr style={{ borderBottom: '2px solid var(--line)' }}>
                {ETAPES_TEBEROSKY.flatMap((etapa) => etapa.nivells).map((n, i, tots) => {
                  const anterior = tots[i - 1]
                  const canviaEtapa = n.etapa !== anterior?.etapa
                  return (
                    <th key={n.id} title={n.label} style={{ padding: '4px 3px', minWidth: 34, fontSize: 9, color: 'var(--ink-soft)', fontWeight: 400, borderLeft: canviaEtapa ? '1px solid var(--line)' : 'none', writingMode: 'vertical-rl', height: 90 }}>
                      {n.label}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {alumnesClasse.map((alumne) => {
                const marcats = dades.alumnes[alumne.id] ?? {}
                return (
                  <tr key={alumne.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '4px 8px', fontWeight: 500, position: 'sticky', left: 0, background: 'var(--bg)' }}>{alumne.nom}</td>
                    {NIVELLS_TEBEROSKY.map((n, i) => {
                      const anterior = NIVELLS_TEBEROSKY[i - 1]
                      const canviaEtapa = n.etapa !== anterior?.etapa
                      return (
                        <td key={n.id} style={{ padding: '4px 3px', textAlign: 'center', borderLeft: canviaEtapa ? '1px solid var(--line)' : 'none' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(marcats[n.id])}
                            onChange={(e) => marca(alumne.id, n.id, e.target.checked)}
                          />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {resumClasse && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontWeight: 600, fontSize: 13 }}>Resum de {classe} — quants alumnes tenen marcat cada nivell</p>
          <div className="taula-scroll" style={{ marginTop: 8 }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
              <tbody>
                {ETAPES_TEBEROSKY.map((etapa) => (
                  <tr key={etapa.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '4px 8px', fontWeight: 500, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{etapa.titol}</td>
                    {etapa.nivells.map((n) => (
                      <td key={n.id} title={n.label} style={{ padding: '4px 8px', textAlign: 'center' }}>
                        {resumClasse[n.id]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
