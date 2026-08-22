import { useEffect, useMemo, useState, Fragment } from 'react'
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import {
  MESOS_CURS, anyDelMes, diesLectiusDelMes, indexaRegistres, estatCasella, resumAlumne,
} from '../../../lib/graellaMensual'
import { normalitzaCursEscolar } from '../../../lib/cursEscolar'

const ESTATS = [
  { id: 'present', label: 'Present', curt: '', necessitaMotiu: false },
  { id: 'retard_justificat', label: 'Retard justificat', curt: 'RJ', necessitaMotiu: true },
  { id: 'retard_injustificat', label: 'Retard sense justificar', curt: 'R', necessitaMotiu: false },
  { id: 'absent_justificat', label: 'Absència justificada', curt: 'AJ', necessitaMotiu: true },
  { id: 'absent_injustificat', label: 'Absència sense justificar', curt: 'A', necessitaMotiu: false },
]

const ABREUJA_DIA = { Dilluns: 'Dl', Dimarts: 'Dt', Dimecres: 'Dc', Dijous: 'Dj', Divendres: 'Dv' }
const NUM_DIA = { Dilluns: 1, Dimarts: 2, Dimecres: 3, Dijous: 4, Divendres: 5 }

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
  const [cursEscolarSel, setCursEscolarSel] = useState(cursEscolarId)
  // El que la persona escriu a la caixa pot venir en qualsevol format
  // raonable ("2027-2028", "2027/28"...); tota la lògica interna sempre
  // fa servir la versió normalitzada ("2027-28"), que és com es desa
  // arreu de l'app.
  const cursEscolarNorm = normalitzaCursEscolar(cursEscolarSel)
  const [calendariSel, setCalendariSel] = useState(calendari)
  const esCursActual = cursEscolarNorm === cursEscolarId
  const [curs, setCurs] = useState('')
  // El mes "actual" pot caure fora del curs (per exemple, agost, entre
  // cursos): en aquest cas es comença mostrant setembre, el primer mes
  // amb opció al desplegable, en comptes d'un valor que no hi surt.
  const mesActual = new Date().getMonth() + 1
  const [mesNum, setMesNum] = useState(MESOS_CURS.some((m) => m.num === mesActual) ? mesActual : 9)
  const [registres, setRegistres] = useState([])
  const [carregant, setCarregant] = useState(false)
  const [error, setError] = useState(null)
  const [caixaOberta, setCaixaOberta] = useState(null) // { alumne, data, torn, estatActual }
  const [motiu, setMotiu] = useState('')
  const [estatTriat, setEstatTriat] = useState(null)

  const [carregantClasses, setCarregantClasses] = useState(false)
  const [classesHistoriques, setClassesHistoriques] = useState(null) // null = fes servir 'cursos' (curs actual)

  const cursos = useMemo(
    () => (esCursActual || !classesHistoriques ? [...new Set(alumnesTots.map((a) => a.curs))].sort() : classesHistoriques),
    [alumnesTots, esCursActual, classesHistoriques]
  )

  // Curs actual: les classes ja se saben (les d'ara). Curs anterior: cal
  // anar a buscar quines classes van existir de debò aquell any — les
  // d'ara podrien tenir noms diferents (grups fusionats, canviats...).
  useEffect(() => {
    if (esCursActual) {
      setClassesHistoriques(null)
      return
    }
    setCarregantClasses(true)
    setClassesHistoriques(null)
    const anyInici = Number(cursEscolarNorm.split('-')[0])
    getDocs(query(
      collection(db, 'assistencia'),
      where('data', '>=', `${anyInici}-09-01`),
      where('data', '<=', `${anyInici + 1}-08-31`)
    ))
      .then((snap) => {
        const trobades = [...new Set(snap.docs.map((d) => d.data().curs).filter(Boolean))].sort()
        setClassesHistoriques(trobades)
      })
      .catch(() => setClassesHistoriques([]))
      .finally(() => setCarregantClasses(false))
  }, [cursEscolarNorm, esCursActual])

  useEffect(() => {
    // Quan canvien les classes disponibles (p. ex. en canviar de curs),
    // si la triada ja no hi és, es passa a la primera de la llista nova.
    if (cursos.length > 0 && !cursos.includes(curs)) setCurs(cursos[0])
  }, [cursos, curs])

  // El calendari del curs actual ja arriba per prop; si es tria un altre
  // curs (per consultar anys anteriors), es va a buscar el seu.
  useEffect(() => {
    if (esCursActual) {
      setCalendariSel(calendari)
      return
    }
    getDoc(doc(db, 'calendari', cursEscolarNorm))
      .then((snap) => setCalendariSel(snap.exists() ? snap.data() : null))
      .catch(() => setCalendariSel(null))
  }, [cursEscolarNorm, esCursActual, calendari])

  const any = anyDelMes(mesNum, cursEscolarNorm)
  const dies = useMemo(
    () => diesLectiusDelMes(mesNum, any, calendariSel?.diesNoLectius ?? [], calendariSel?.inici ?? '', calendariSel?.fi ?? ''),
    [mesNum, any, calendariSel]
  )
  // Curs actual: es fa servir el llistat d'alumnes actius (amb ordre de
  // llista). Cursos anteriors: no hi ha manera de saber qui era a cada
  // classe fa temps, així que es reconstrueix el llistat directament dels
  // registres d'assistència d'aquell mes (que ja porten el nom desat).
  const alumnesClasse = useMemo(() => {
    if (esCursActual) {
      return alumnesTots.filter((a) => a.curs === curs).sort((a, b) => (a.numLlista ?? 999) - (b.numLlista ?? 999))
    }
    const vistos = new Map()
    for (const r of registres) {
      if (!vistos.has(r.alumneId)) vistos.set(r.alumneId, { id: r.alumneId, nom: r.alumneNom ?? '(sense nom)' })
    }
    return [...vistos.values()].sort((a, b) => a.nom.localeCompare(b.nom))
  }, [esCursActual, alumnesTots, curs, registres])

  useEffect(() => {
    if (!curs || dies.length === 0) return
    carrega()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curs, mesNum, any, cursEscolarNorm])

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

  // Un dia "obre setmana" si és el primer dia lectiu de la seva setmana,
  // i "tanca setmana" si el següent dia lectiu ja cau en una altra. No es
  // pot mirar només si és dilluns o divendres: quan aquests són festius,
  // la setmana comença o s'acaba un altre dia i el requadre quedaria obert.
  const { obreSetmana, tancaSetmana } = useMemo(() => {
    const obre = new Set()
    const tanca = new Set()
    dies.forEach((d, i) => {
      const anterior = dies[i - 1]
      const seguent = dies[i + 1]
      if (!anterior || d.nomDia === 'Dilluns' || NUM_DIA[d.nomDia] < NUM_DIA[anterior.nomDia]) obre.add(d.data)
      if (!seguent || seguent.nomDia === 'Dilluns' || NUM_DIA[seguent.nomDia] < NUM_DIA[d.nomDia]) tanca.add(d.data)
    })
    return { obreSetmana: obre, tancaSetmana: tanca }
  }, [dies])

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

  if (!calendariSel) {
    return (
      <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
        Cal tenir el calendari del curs {cursEscolarNorm} desat al mòdul "Calendari" per saber quins dies són lectius.
      </p>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
        <label className="field" style={{ maxWidth: 110 }}>
          <span>Curs escolar</span>
          <input
            type="text"
            value={cursEscolarSel}
            onChange={(e) => setCursEscolarSel(e.target.value)}
            style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontWeight: 600 }}
          />
          {cursEscolarSel.trim() !== '' && cursEscolarSel.trim() !== cursEscolarNorm && (
            <span style={{ fontSize: 10, color: 'var(--ink-soft)' }}>
              {/\d{4}/.test(cursEscolarNorm) ? `→ ${cursEscolarNorm}` : 'Format no reconegut'}
            </span>
          )}
        </label>
        <label className="field" style={{ maxWidth: 140 }}>
          <span>Classe</span>
          <select value={curs} onChange={(e) => setCurs(e.target.value)} disabled={carregantClasses} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}>
            {cursos.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="field" style={{ maxWidth: 160 }}>
          <span>Mes</span>
          <select value={mesNum} onChange={(e) => setMesNum(Number(e.target.value))} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}>
            {MESOS_CURS.map((m) => <option key={m.num} value={m.num}>{m.label} {anyDelMes(m.num, cursEscolarNorm)}</option>)}
          </select>
        </label>
      </div>

      {carregantClasses && <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Buscant les classes reals d'aquell curs…</p>}

      {!esCursActual && !carregantClasses && (
        <p style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 10 }}>
          Consultant un curs anterior: les classes i el llistat d'alumnes es reconstrueixen dels
          registres d'assistència reals d'aquell any (no de les classes ni el llistat d'ara), i les
          correccions també hi queden desades.
        </p>
      )}

      {error && <p style={{ color: 'var(--red)', fontSize: 12 }}>{error}</p>}
      {carregant && <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Carregant…</p>}

      {!carregant && dies.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Aquest mes no té cap dia lectiu al calendari del curs.</p>
      )}

      {!carregant && dies.length > 0 && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 11, border: '3px solid var(--ink-soft)' }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ position: 'sticky', left: 0, background: 'var(--bg, #fff)', border: '1px solid var(--line)', borderRight: '3px solid var(--ink-soft)', borderBottom: '3px solid var(--ink-soft)', padding: '4px 8px', textAlign: 'left', minWidth: 170, zIndex: 2 }}>
                    Alumne
                  </th>
                  {dies.map((d) => (
                    <th
                      key={d.data}
                      colSpan={2}
                      style={{
                        border: '1px solid var(--line)', padding: '2px 4px', fontWeight: 600, whiteSpace: 'nowrap',
                        borderLeft: obreSetmana.has(d.data) ? '3px solid var(--ink-soft)' : '1px solid var(--line)',
                        borderRight: tancaSetmana.has(d.data) ? '3px solid var(--ink-soft)' : '2px solid var(--line)',
                      }}
                    >
                      {d.dia}
                      <span style={{ display: 'block', fontSize: 9, fontWeight: 400, color: 'var(--ink-soft)' }}>
                        {ABREUJA_DIA[d.nomDia] ?? d.nomDia}
                      </span>
                    </th>
                  ))}
                  <th colSpan={4} style={{ border: '1px solid var(--line)', borderLeft: '3px solid var(--ink-soft)', padding: '2px 6px' }}>Total</th>
                </tr>
                <tr>
                  {dies.map((d) => (
                    <Fragment key={d.data}>
                      <th
                        style={{
                          border: '1px solid var(--line)', padding: '2px 3px', fontWeight: 400, color: 'var(--ink-soft)',
                          borderBottom: '3px solid var(--ink-soft)',
                          borderLeft: obreSetmana.has(d.data) ? '3px solid var(--ink-soft)' : '1px solid var(--line)',
                        }}
                      >
                        M
                      </th>
                      <th
                        style={{
                          border: '1px solid var(--line)', padding: '2px 3px', fontWeight: 400, color: 'var(--ink-soft)',
                          borderBottom: '3px solid var(--ink-soft)',
                          borderRight: tancaSetmana.has(d.data) ? '3px solid var(--ink-soft)' : '2px solid var(--line)',
                        }}
                      >
                        T
                      </th>
                    </Fragment>
                  ))}
                  <th title="Absències justificades" style={{ border: '1px solid var(--line)', borderBottom: '3px solid var(--ink-soft)', borderLeft: '3px solid var(--ink-soft)', padding: '2px 4px', fontWeight: 400, color: 'var(--ink-soft)' }}>AJ</th>
                  <th title="Absències sense justificar" style={{ border: '1px solid var(--line)', borderBottom: '3px solid var(--ink-soft)', padding: '2px 4px', fontWeight: 400, color: 'var(--ink-soft)' }}>A</th>
                  <th title="Retards justificats" style={{ border: '1px solid var(--line)', borderBottom: '3px solid var(--ink-soft)', padding: '2px 4px', fontWeight: 400, color: 'var(--ink-soft)' }}>RJ</th>
                  <th title="Retards sense justificar" style={{ border: '1px solid var(--line)', borderBottom: '3px solid var(--ink-soft)', padding: '2px 4px', fontWeight: 400, color: 'var(--ink-soft)' }}>R</th>
                </tr>
              </thead>
              <tbody>
                {alumnesClasse.map((alumne) => {
                  const resum = resumAlumne(index, dies, alumne.id, ara)
                  return (
                    <tr key={alumne.id}>
                      <td style={{ position: 'sticky', left: 0, background: 'var(--bg, #fff)', border: '1px solid var(--line)', borderRight: '3px solid var(--ink-soft)', padding: '3px 8px', whiteSpace: 'nowrap', zIndex: 1 }}>
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
                              borderLeft: (obreSetmana.has(d.data) && torn === 'mati') ? '3px solid var(--ink-soft)' : '1px solid var(--line)',
                              borderRight: torn === 'tarda'
                                ? (tancaSetmana.has(d.data) ? '3px solid var(--ink-soft)' : '2px solid var(--line)')
                                : '1px solid var(--line)',
                            }}
                          >
                            {def?.curt ?? ''}
                          </td>
                        )
                      }))}
                      <td style={{ border: '1px solid var(--line)', borderLeft: '3px solid var(--ink-soft)', padding: '3px 5px', textAlign: 'center', fontWeight: resum.absentJustificat > 0 ? 700 : 400 }}>
                        {resum.absentJustificat || ''}
                      </td>
                      <td style={{ border: '1px solid var(--line)', padding: '3px 5px', textAlign: 'center', fontWeight: resum.absentInjustificat > 0 ? 700 : 400 }}>
                        {resum.absentInjustificat || ''}
                      </td>
                      <td style={{ border: '1px solid var(--line)', padding: '3px 5px', textAlign: 'center', fontWeight: resum.retardJustificat > 0 ? 700 : 400 }}>
                        {resum.retardJustificat || ''}
                      </td>
                      <td style={{ border: '1px solid var(--line)', padding: '3px 5px', textAlign: 'center', fontWeight: resum.retardInjustificat > 0 ? 700 : 400 }}>
                        {resum.retardInjustificat || ''}
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
