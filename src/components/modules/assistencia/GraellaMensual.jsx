import { useEffect, useMemo, useState, Fragment } from 'react'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import {
  MESOS_CURS, anyDelMes, diesLectiusDelMes, indexaRegistres, estatCasella, resumAlumne,
} from '../../../lib/graellaMensual'

const ESTATS = [
  { id: 'present', label: 'Present', curt: '', necessitaMotiu: false },
  { id: 'retard_justificat', label: 'Retard justificat', curt: 'RJ', necessitaMotiu: true },
  { id: 'retard_injustificat', label: 'Retard sense justificar', curt: 'R', necessitaMotiu: false },
  { id: 'absent_justificat', label: 'Absència justificada', curt: 'AJ', necessitaMotiu: true },
  { id: 'absent_injustificat', label: 'Absència sense justificar', curt: 'A', necessitaMotiu: false },
]

function colorFons(estat) {
  if (estat === 'absent_injustificat') return '#F8D7DA'
  if (estat === 'absent_justificat') return '#FDEBD0'
  if (estat === 'retard_injustificat') return '#FCF3CF'
  if (estat === 'retard_justificat') return '#FEF9E7'
  return 'transparent'
}

function avuiIso() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Vista mensual d'assistència d'una classe, amb el mateix format que el
 * full de càlcul que feien servir les tutores: una fila per alumne i una
 * columna per dia lectiu, amb matí i tarda.
 *
 * Les caselles buides d'un dia ja passat es consideren "present" (només
 * es marca qui falta), així que la graella només destaca absències i
 * retards. Clicant una casella es pot corregir la marca.
 */
export default function GraellaMensual({ cursEscolarId, calendari, alumnesTots }) {
  const [curs, setCurs] = useState('')
  const [mesNum, setMesNum] = useState(new Date().getMonth() + 1)
  const [registres, setRegistres] = useState([])
  const [carregant, setCarregant] = useState(false)
  const [error, setError] = useState(null)
  const [caixaOberta, setCaixaOberta] = useState(null) // { alumne, data, torn, estatActual }
  const [motiu, setMotiu] = useState('')
  const [estatTriat, setEstatTriat] = useState(null)

  const cursos = useMemo(
    () => [...new Set(alumnesTots.map((a) => a.curs))].sort(),
    [alumnesTots]
  )

  useEffect(() => {
    if (!curs && cursos.length > 0) setCurs(cursos[0])
  }, [cursos, curs])

  const any = anyDelMes(mesNum, cursEscolarId)
  const dies = useMemo(
    () => diesLectiusDelMes(mesNum, any, calendari?.diesNoLectius ?? []),
    [mesNum, any, calendari]
  )
  const alumnesClasse = useMemo(
    () => alumnesTots.filter((a) => a.curs === curs).sort((a, b) => (a.numLlista ?? 999) - (b.numLlista ?? 999)),
    [alumnesTots, curs]
  )

  useEffect(() => {
    if (!curs || dies.length === 0) return
    carrega()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curs, mesNum, any])

  async function carrega() {
    setCarregant(true)
    setError(null)
    try {
      const snap = await getDocs(query(
        collection(db, 'assistencia'),
        where('curs', '==', curs),
        where('data', '>=', dies[0].data),
        where('data', '<=', dies[dies.length - 1].data)
      ))
      setRegistres(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch (err) {
      setError(err.message)
    } finally {
      setCarregant(false)
    }
  }

  const index = useMemo(() => indexaRegistres(registres), [registres])
  const ara = avuiIso()

  async function desaCorreccio(estat, textMotiu) {
    const { alumne, data, torn } = caixaOberta
    const nou = {
      alumneId: alumne.id,
      alumneNom: alumne.nom,
      curs,
      data,
      torn,
      estat,
      motiu: textMotiu || null,
      creatEl: { seconds: Date.now() / 1000 },
      creatPer: auth.currentUser?.email ?? null,
    }
    // Es pinta a l'instant i es desa a sota; si falla, es desfà.
    setRegistres((prev) => [...prev, { id: `local-${Date.now()}`, ...nou }])
    setCaixaOberta(null)
    setMotiu('')
    setEstatTriat(null)
    try {
      await addDoc(collection(db, 'assistencia'), { ...nou, creatEl: serverTimestamp() })
    } catch (err) {
      setError(`No s'ha pogut desar la correcció: ${err.message}`)
      carrega()
    }
  }

  function clicaCasella(alumne, data, torn) {
    if (data > ara) return // dies que encara no han arribat
    setCaixaOberta({ alumne, data, torn, estatActual: estatCasella(index, data, alumne.id, torn, ara) })
    setEstatTriat(null)
    setMotiu('')
  }

  if (!calendari) {
    return (
      <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
        Cal tenir el calendari del curs {cursEscolarId} desat al mòdul "Calendari" per saber quins dies són lectius.
      </p>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
        <label className="field" style={{ maxWidth: 140 }}>
          <span>Classe</span>
          <select value={curs} onChange={(e) => setCurs(e.target.value)} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}>
            {cursos.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="field" style={{ maxWidth: 160 }}>
          <span>Mes</span>
          <select value={mesNum} onChange={(e) => setMesNum(Number(e.target.value))} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}>
            {MESOS_CURS.map((m) => <option key={m.num} value={m.num}>{m.label} {anyDelMes(m.num, cursEscolarId)}</option>)}
          </select>
        </label>
      </div>

      {error && <p style={{ color: 'var(--red)', fontSize: 12 }}>{error}</p>}
      {carregant && <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Carregant…</p>}

      {!carregant && dies.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Aquest mes no té cap dia lectiu al calendari del curs.</p>
      )}

      {!carregant && dies.length > 0 && (
        <>
          <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ position: 'sticky', left: 0, background: 'var(--bg, #fff)', border: '1px solid var(--line)', padding: '4px 8px', textAlign: 'left', minWidth: 170, zIndex: 2 }}>
                    Alumne
                  </th>
                  {dies.map((d) => (
                    <th key={d.data} colSpan={2} style={{ border: '1px solid var(--line)', padding: '2px 4px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {d.dia}
                    </th>
                  ))}
                  <th colSpan={2} style={{ border: '1px solid var(--line)', padding: '2px 6px' }}>Total</th>
                </tr>
                <tr>
                  {dies.map((d) => (
                    <Fragment key={d.data}>
                      <th style={{ border: '1px solid var(--line)', padding: '2px 3px', fontWeight: 400, color: 'var(--ink-soft)' }}>M</th>
                      <th style={{ border: '1px solid var(--line)', padding: '2px 3px', fontWeight: 400, color: 'var(--ink-soft)' }}>T</th>
                    </Fragment>
                  ))}
                  <th style={{ border: '1px solid var(--line)', padding: '2px 4px', fontWeight: 400, color: 'var(--ink-soft)' }}>Abs</th>
                  <th style={{ border: '1px solid var(--line)', padding: '2px 4px', fontWeight: 400, color: 'var(--ink-soft)' }}>Ret</th>
                </tr>
              </thead>
              <tbody>
                {alumnesClasse.map((alumne) => {
                  const resum = resumAlumne(index, dies, alumne.id, ara)
                  return (
                    <tr key={alumne.id}>
                      <td style={{ position: 'sticky', left: 0, background: 'var(--bg, #fff)', border: '1px solid var(--line)', padding: '3px 8px', whiteSpace: 'nowrap', zIndex: 1 }}>
                        <span style={{ color: 'var(--ink-soft)', marginRight: 6 }}>{alumne.numLlista ?? ''}</span>
                        {alumne.nom}
                      </td>
                      {dies.flatMap((d) => ['mati', 'tarda'].map((torn) => {
                        const estat = estatCasella(index, d.data, alumne.id, torn, ara)
                        const def = ESTATS.find((e) => e.id === estat)
                        const futur = d.data > ara
                        return (
                          <td
                            key={`${d.data}-${torn}`}
                            onClick={() => clicaCasella(alumne, d.data, torn)}
                            title={futur ? 'Encara no ha arribat' : `${alumne.nom} · ${d.nomDia} ${d.dia} · ${torn === 'mati' ? 'Matí' : 'Tarda'}`}
                            style={{
                              border: '1px solid var(--line)', padding: '3px 2px', textAlign: 'center',
                              minWidth: 20, cursor: futur ? 'default' : 'pointer',
                              background: futur ? '#F4F4F4' : colorFons(estat),
                              fontWeight: def?.curt ? 700 : 400,
                            }}
                          >
                            {def?.curt ?? ''}
                          </td>
                        )
                      }))}
                      <td style={{ border: '1px solid var(--line)', padding: '3px 5px', textAlign: 'center', fontWeight: resum.totalAbsencies > 0 ? 700 : 400 }}>
                        {resum.totalAbsencies || ''}
                      </td>
                      <td style={{ border: '1px solid var(--line)', padding: '3px 5px', textAlign: 'center', fontWeight: resum.totalRetards > 0 ? 700 : 400 }}>
                        {resum.totalRetards || ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 8 }}>
            Casella en blanc = present. <strong>A</strong> absència sense justificar · <strong>AJ</strong> absència
            justificada · <strong>R</strong> retard sense justificar · <strong>RJ</strong> retard justificat.
            Les caselles grises són dies que encara no han arribat. Clica qualsevol casella per corregir-la.
          </p>
        </>
      )}

      {caixaOberta && (
        <div style={{ marginTop: 14, border: '1px solid var(--line)', borderRadius: 8, padding: 12, maxWidth: 420 }}>
          <strong style={{ fontSize: 13 }}>{caixaOberta.alumne.nom}</strong>
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '4px 0 10px' }}>
            {caixaOberta.data} · {caixaOberta.torn === 'mati' ? 'Matí' : 'Tarda'}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ESTATS.map((e) => (
              <button
                key={e.id}
                type="button"
                className="btn-ghost"
                style={{ textAlign: 'left', fontWeight: estatTriat === e.id ? 700 : 400 }}
                onClick={() => {
                  if (e.necessitaMotiu) setEstatTriat(e.id)
                  else desaCorreccio(e.id, '')
                }}
              >
                {e.label}
              </button>
            ))}
          </div>
          {estatTriat && (
            <div style={{ marginTop: 10 }}>
              <label className="field">
                <span>Motiu</span>
                <input
                  type="text"
                  value={motiu}
                  onChange={(e) => setMotiu(e.target.value)}
                  style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '6px 8px', fontSize: 12, width: '100%', boxSizing: 'border-box' }}
                />
              </label>
              <button type="button" className="btn-ghost" style={{ marginTop: 8 }} onClick={() => desaCorreccio(estatTriat, motiu)}>
                Desa
              </button>
            </div>
          )}
          <button type="button" className="btn-ghost" style={{ marginTop: 10 }} onClick={() => setCaixaOberta(null)}>
            Cancel·la
          </button>
        </div>
      )}
    </div>
  )
}
