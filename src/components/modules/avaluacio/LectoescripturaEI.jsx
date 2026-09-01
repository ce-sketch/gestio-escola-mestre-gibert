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
import { exportaExcel, exportaPDF } from '../../../lib/exportTaula'
import { colorDiversitat } from '../../../lib/atencioDiversitat'
import LlegendaDiversitat from '../../LlegendaDiversitat'
import {
  ETAPES_TEBEROSKY, NIVELLS_TEBEROSKY, esClasseEI4o5, nivellsBuits, comptaNivells,
  CAPÇALERA_EXPORT_EI, GRUPS_EXPORT_EI, filaAlumneExportEI,
} from '../../../lib/lectoescripturaEI'
import { classesActives } from '../../../lib/provesActives'

export default function LectoescripturaEI() {
  const [alumnesTots, setAlumnesTots] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [missatge, setMissatge] = useState(null)

  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [classe, setClasse] = useState('')
  const [dades, setDades] = useState(null) // { alumnes: { [alumneId]: { [nivellId]: bool } } }
  const [carregantClasse, setCarregantClasse] = useState(false)
  const [desant, setDesant] = useState(false)
  const [generant, setGenerant] = useState(null) // 'excel' | 'pdf' | null
  // Quines classes passen la prova aquest curs. Es configura a "Quines
  // proves es passen" i mana per a tothom: si aquí sortissin classes que
  // no la fan, s'hi podrien introduir dades que després no comptarien
  // enlloc — ni al resum ni al quadre de comandament.
  const [config, setConfig] = useState(null)

  useEffect(() => {
    async function carrega() {
      try {
        const [snap, snapConfig] = await Promise.all([
          getDocs(query(collection(db, 'alumnes'), where('actiu', '==', true))),
          getDoc(doc(db, 'provesActives', cursEscolarId)),
        ])
        const llista = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        llista.sort((a, b) => (a.numLlista ?? 999) - (b.numLlista ?? 999) || a.nom.localeCompare(b.nom))
        setAlumnesTots(llista)
        const cfg = snapConfig.exists() ? snapConfig.data() : null
        setConfig(cfg)
        const totes = [...new Set(llista.map((a) => a.curs))].filter(esClasseEI4o5).sort()
        const primera = classesActives(cfg, 'lectoescriptura', 'curs', totes)[0]
        if (primera) setClasse((c) => c || primera)
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'han pogut carregar els alumnes: ${err.message}` })
      } finally {
        setCarregant(false)
      }
    }
    carrega()
  }, [cursEscolarId])

  const classes = useMemo(
    () => classesActives(
      config, 'lectoescriptura', 'curs',
      [...new Set(alumnesTots.map((a) => a.curs))].filter(esClasseEI4o5).sort()
    ),
    [alumnesTots, config]
  )
  const alumnesClasse = useMemo(() => alumnesTots.filter((a) => a.curs === classe), [alumnesTots, classe])

  // Si la classe que hi havia triada es desmarca a "Quines proves es
  // passen", el desplegable es quedaria mostrant-la sense que hi sigui a
  // la llista: es passa a la primera que sí que la faci.
  useEffect(() => {
    if (classes.length > 0 && classe && !classes.includes(classe)) setClasse(classes[0])
  }, [classes, classe])

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

  /** Un full amb la graella (una fila per alumne) i un full amb el resum
   *  de comptatge, tots dos amb la mateixa capçalera de 18 nivells
   *  agrupats per etapa — el mateix que es veu en pantalla. */
  function fullsExportables() {
    if (!dades) return []
    const filesAlumnes = alumnesClasse.map((alumne) => filaAlumneExportEI(alumne, dades.alumnes[alumne.id] ?? {}))
    const filaResum = ['Recompte', ...NIVELLS_TEBEROSKY.map((n) => resumClasse[n.id])]
    return [
      { nom: `Lectoescriptura ${classe}`, files: [CAPÇALERA_EXPORT_EI, ...filesAlumnes], grups: GRUPS_EXPORT_EI },
      { nom: `Resum ${classe}`, files: [CAPÇALERA_EXPORT_EI, filaResum], grups: GRUPS_EXPORT_EI },
    ]
  }

  async function descarrega(quin, fes) {
    setGenerant(quin)
    setMissatge(null)
    try {
      await fes()
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut generar la descàrrega: ${err.message}` })
    } finally {
      setGenerant(null)
    }
  }

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

      {!carregant && classes.length === 0 && (
        <p className="nota nota-avis" style={{ marginTop: 14 }}>
          Cap classe d&apos;I4 o I5 no consta com a que passi la prova aquest curs. Es
          configura a &quot;Quines proves es passen&quot;, dins de Resums i informes.
        </p>
      )}

      {desant && <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8 }}>Desant…</p>}

      {dades && alumnesClasse.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            className="btn-ghost"
            style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
            onClick={() => descarrega('excel', () => exportaExcel(`Lectoescriptura-EI-${slug(classe)}-${cursEscolarId}`, { cursEscolarId, etiqueta: 'Avaluació', fulls: fullsExportables() }))}
            disabled={generant !== null}
            type="button"
          >
            {generant === 'excel' ? 'Generant l\'Excel…' : '📥 Descarrega Excel'}
          </button>
          <button
            className="btn-ghost"
            style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
            onClick={() => descarrega('pdf', () => exportaPDF(`Lectoescriptura EI — ${classe}`, { cursEscolarId, etiqueta: 'Avaluació', fulls: fullsExportables() }))}
            disabled={generant !== null}
            type="button"
          >
            {generant === 'pdf' ? 'Generant el PDF…' : '📄 Descarrega PDF'}
          </button>
        </div>
      )}

      {carregantClasse || !dades ? (
        <p style={{ marginTop: 16 }}>Carregant…</p>
      ) : (
        <div className="taula-scroll" style={{ marginTop: 16 }}>
          <LlegendaDiversitat />
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
                {(() => {
                  // Agrupem les columnes consecutives que comparteixen subgrup
                  // (dins de la mateixa etapa) en una sola cel·la fusionada, en
                  // comptes de repetir el text a cada columna. Així
                  // "Escriptures diferenciades amb predomini de grafies
                  // convencionals" (×4), "Paraula" (×3) i "Frase" (×3) surten
                  // un sol cop, com al full original.
                  const grups = []
                  NIVELLS_TEBEROSKY.forEach((n) => {
                    const ultim = grups[grups.length - 1]
                    const mateixGrup = ultim && ultim.etapa === n.etapa && ultim.subgrup && ultim.subgrup === n.subgrup
                    if (mateixGrup) ultim.span += 1
                    else grups.push({ key: n.id, subgrup: n.subgrup ?? '', etapa: n.etapa, span: 1 })
                  })
                  return grups.map((g, i) => {
                    const canviaEtapa = g.etapa !== grups[i - 1]?.etapa
                    return (
                      <th key={g.key} colSpan={g.span} style={{ padding: '4px 3px', textAlign: 'center', fontSize: 10, color: 'var(--ink-soft)', fontWeight: g.subgrup ? 500 : 400, borderLeft: (canviaEtapa || g.subgrup) ? '1px solid var(--line)' : 'none' }}>
                        {g.subgrup}
                      </th>
                    )
                  })
                })()}
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
                const color = colorDiversitat(alumne)
                return (
                  <tr key={alumne.id} style={{ borderBottom: '1px solid var(--line)', backgroundColor: color ?? undefined }}>
                    <td style={{ padding: '4px 8px', fontWeight: 500, position: 'sticky', left: 0, background: color ?? 'var(--bg)' }}>{alumne.nom}</td>
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
