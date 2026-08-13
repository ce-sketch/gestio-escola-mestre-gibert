import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import { slug } from '../../../lib/slug'
import {
  CRITERIS_ACTIVITAT, activitatBuida as activitatSortidaBuida, mitjanaActivitat, grauSatisfaccioCicle,
  percentValorades, totalRepetirSi,
} from '../../../lib/activitatsComplementariesDetall'
import { activitatsDelCicle } from '../../../lib/activitatsComplementariesParser'
import { descarregaDocumentSortides, URL_DOC_SORTIDES } from '../../../lib/documentSortides'

// El `xlsx` pesa 429 kB i només fa falta quan algú puja un fitxer. Es
// carrega en aquell moment, no en obrir el mòdul.
async function carregaXLSX() {
  return import('xlsx')
}

/** Valoració de les activitats complementàries d'un cicle, amb els 10
 *  criteris de la plantilla oficial de sortides. */
export default function ValoracioActivitats({ cursEscolarId, cicleActivitats }) {
  const [activitats, setActivitats] = useState([])
  const [activitatOberta, setActivitatOberta] = useState(null)
  const [carregantActivitats, setCarregantActivitats] = useState(false)
  const [pujantActivitats, setPujantActivitats] = useState(false)
  const [desant, setDesant] = useState(false)
  const [missatge, setMissatge] = useState(null)

  useEffect(() => {
    if (cicleActivitats) carregaActivitats()
    else setActivitats([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursEscolarId, cicleActivitats])

  async function carregaActivitats() {
    setCarregantActivitats(true)
    setMissatge(null)
    try {
      const id = `${cursEscolarId}__activitats-${slug(cicleActivitats)}`
      const snap = await getDoc(doc(db, 'activitatsComplementariesDetall', id))
      setActivitats(snap.exists() ? (snap.data().activitats ?? []) : [])
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'han pogut carregar les activitats: ${err.message}` })
    } finally {
      setCarregantActivitats(false)
    }
  }

  async function desaActivitats(activitatsNoves) {
    try {
      const id = `${cursEscolarId}__activitats-${slug(cicleActivitats)}`
      await setDoc(doc(db, 'activitatsComplementariesDetall', id), {
        cicle: cicleActivitats,
        cursEscolar: cursEscolarId,
        activitats: activitatsNoves,
        actualitzatEl: serverTimestamp(),
        actualitzatPer: auth.currentUser?.email ?? null,
      })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar: ${err.message}` })
    }
  }

  function actualitzaActivitat(activitatId, canvis) {
    const noves = activitats.map((a) => a.id === activitatId ? { ...a, ...canvis } : a)
    setActivitats(noves)
    return noves
  }

  function actualitzaCriteriActivitat(activitatId, criteriId, valor) {
    const noves = activitats.map((a) => a.id !== activitatId ? a : { ...a, valoracions: { ...a.valoracions, [criteriId]: valor } })
    setActivitats(noves)
    return noves
  }

  /** Puja el document consolidat de sortides (el mateix que Economia) i
   *  n'extreu les activitats reals del cicle triat — sense esborrar cap
   *  valoració que ja s'hagués introduït per a una activitat que coincideixi
   *  de nom. */
  /** Combina les activitats llegides del document amb les que ja hi ha
   *  desades: si el nom coincideix, es manté la valoració i només
   *  s'actualitzen les dades de la sortida. */
  function combina(trobades) {
    return trobades.map((t) => {
      const existent = activitats.find((a) => a.nom === t.nom)
      if (existent) return { ...existent, nivell: t.nivell, data: t.data, horari: t.horari, preu: t.preu }
      const nova = activitatSortidaBuida(t.nom)
      nova.nivell = t.nivell
      nova.data = t.data
      nova.horari = t.horari
      nova.preu = t.preu
      return nova
    })
  }

  /** Llegeix el document consolidat directament del Drive — el mateix que
   *  actualitza Economia. Així no cal baixar-lo i tornar-lo a pujar aquí. */
  async function actualitzaDesDelDocument() {
    if (!cicleActivitats) return
    setPujantActivitats(true)
    setMissatge(null)
    try {
      const XLSX = await carregaXLSX()
      const workbook = await descarregaDocumentSortides(XLSX)
      const trobades = activitatsDelCicle(workbook, XLSX, cicleActivitats)
      if (trobades.length === 0) {
        setMissatge({ type: 'error', text: `No he trobat cap activitat pel cicle "${cicleActivitats}" al document.` })
        return
      }
      const noves = combina(trobades)
      setActivitats(noves)
      await desaActivitats(noves)
      setMissatge({ type: 'ok', text: `${trobades.length} activitats carregades del document oficial.` })
    } catch (err) {
      setMissatge({ type: 'error', text: err.message })
    } finally {
      setPujantActivitats(false)
    }
  }

  function pujaActivitatsCicle(e) {
    const file = e.target.files?.[0]
    if (!file || !cicleActivitats) return
    setPujantActivitats(true)
    setMissatge(null)

    const reader = new FileReader()
    reader.onload = async (event) => {
      const XLSX = await carregaXLSX()
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const trobades = activitatsDelCicle(workbook, XLSX, cicleActivitats)
        if (trobades.length === 0) {
          setMissatge({ type: 'error', text: `No he trobat cap activitat pel cicle "${cicleActivitats}" en aquest Excel.` })
          setPujantActivitats(false)
          return
        }
        const noves = trobades.map((t) => {
          const existent = activitats.find((a) => a.nom === t.nom)
          if (existent) return { ...existent, nivell: t.nivell, data: t.data, horari: t.horari, preu: t.preu }
          const nova = activitatSortidaBuida(t.nom)
          nova.nivell = t.nivell
          nova.data = t.data
          nova.horari = t.horari
          nova.preu = t.preu
          return nova
        })
        setActivitats(noves)
        await desaActivitats(noves)
        setMissatge({ type: 'ok', text: `${noves.length} activitats carregades per a ${cicleActivitats}.` })
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'ha pogut llegir l'Excel: ${err.message}` })
      } finally {
        setPujantActivitats(false)
      }
    }
    reader.onerror = () => {
      setMissatge({ type: 'error', text: 'No s\'ha pogut llegir el fitxer.' })
      setPujantActivitats(false)
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }


  if (!cicleActivitats) {
    return (
      <p style={{ marginTop: 16, fontSize: 13, color: 'var(--ink-soft)' }}>
        Tria un cicle per començar (o continuar) la valoració d'activitats complementàries.
      </p>
    )
  }
  if (carregantActivitats) return <p style={{ marginTop: 16 }}>Carregant…</p>

  return (
    <>
      {desant && <span style={{ fontSize: 12, color: 'var(--ink-soft)', display: 'block', marginTop: 8 }}>Desant…</span>}
              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={actualitzaDesDelDocument}
                  disabled={pujantActivitats}
                  className="btn-ghost"
                >
                  {pujantActivitats ? 'Llegint el document…' : '🔄 Actualitza des del document oficial'}
                </button>
                <label className="btn-ghost" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                  {pujantActivitats ? 'Llegint el document…' : '📤 Puja el document de sortides (el mateix d\'Economia)'}
                  <input type="file" accept=".xlsx,.xls" onChange={pujaActivitatsCicle} style={{ display: 'none' }} disabled={pujantActivitats} />
                </label>
              </div>
              <p className="module-note" style={{ marginTop: 6 }}>
                El botó de dalt llegeix el <a href={URL_DOC_SORTIDES} target="_blank" rel="noreferrer">document consolidat</a> del
                Drive, el mateix que actualitza Economia: quan allà s'hi afegeix una sortida, aquí ja hi és.
                El de pujar fitxer només fa falta si el document no es pot llegir des del Drive.{' '}
              </p>
              <p className="module-note" style={{ marginTop: 6 }}>
                Puja el mateix Excel consolidat "Activitats_Complementaries_..._I3_a_6e" que ja
                fas servir a Economia — es llegeixen els fulls dels nivells d'aquest cicle i
                se n'agafen els noms de les activitats reals. Si ja havies valorat alguna
                activitat amb aquest nom, la valoració es manté.
              </p>

              {activitats.length > 0 && (
                <div style={{ display: 'flex', gap: 24, marginTop: 16, fontSize: 13, flexWrap: 'wrap' }}>
                  <span>Grau de satisfacció: <strong>{grauSatisfaccioCicle(activitats) !== null ? `${Math.round(grauSatisfaccioCicle(activitats))}%` : '—'}</strong></span>
                  <span>% de sortides valorades: <strong>{Math.round(percentValorades(activitats))}%</strong></span>
                  <span>Total de "Sí" (repetir): <strong>{totalRepetirSi(activitats)}</strong></span>
                </div>
              )}

              {missatge && (
                <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
                  {missatge.text}
                </p>
              )}

              <div style={{ marginTop: 16 }}>
                {activitats.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                    Encara no hi ha cap activitat carregada per a aquest cicle.
                  </p>
                ) : activitats.map((act) => {
                  const oberta = activitatOberta === act.id
                  const mitjana = mitjanaActivitat(act)
                  return (
                    <div key={act.id} className="placeholder-box" style={{ marginTop: 10, padding: 0, overflow: 'hidden' }}>
                      <div
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', flexWrap: 'wrap', gap: 8 }}
                        onClick={() => setActivitatOberta(oberta ? null : act.id)}
                      >
                        <div>
                          <strong>{act.nom}</strong>
                          <span style={{ fontSize: 12, color: 'var(--ink-soft)', marginLeft: 8 }}>
                            {act.nivell} {act.data && `· ${act.data}`}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <strong>{mitjana !== null ? `${mitjana.toFixed(1)}/10` : '— /10'}</strong>
                          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{oberta ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {oberta && (
                        <div style={{ padding: '4px 14px 14px', borderTop: '1px solid var(--line)' }}>
                          <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 10 }}>
                            {act.horari && `Horari: ${act.horari}`} {act.preu && `· Preu: ${act.preu}`}
                          </p>

                          <p style={{ fontSize: 13, fontWeight: 600, marginTop: 12 }}>Valoració (0-10)</p>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, marginTop: 8 }}>
                            {CRITERIS_ACTIVITAT.map((c) => (
                              <label key={c.id} style={{ fontSize: 11 }}>
                                {c.label}
                                <input
                                  type="number" min={0} max={10} step={1}
                                  value={act.valoracions[c.id]}
                                  onChange={(e) => actualitzaCriteriActivitat(act.id, c.id, e.target.value)}
                                  onBlur={() => desaActivitats(activitats)}
                                  style={{ display: 'block', width: 70, marginTop: 3, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px' }}
                                />
                              </label>
                            ))}
                          </div>

                          <div style={{ display: 'flex', gap: 16, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                            <label style={{ fontSize: 12 }}>
                              Tornaríeu a fer la sortida?
                              <select
                                value={act.repetir}
                                onChange={(e) => { const noves = actualitzaActivitat(act.id, { repetir: e.target.value }); desaActivitats(noves) }}
                                style={{ display: 'block', marginTop: 3, border: '1px solid var(--line)', borderRadius: 6, padding: '5px 8px' }}
                              >
                                <option value="">—</option>
                                <option value="Sí">Sí</option>
                                <option value="No">No</option>
                              </select>
                            </label>
                          </div>

                          <label style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
                            Aspectes a considerar un altre curs
                            <textarea
                              value={act.aspectesConsiderar}
                              onChange={(e) => actualitzaActivitat(act.id, { aspectesConsiderar: e.target.value })}
                              onBlur={() => desaActivitats(activitats)}
                              rows={2}
                              style={{ display: 'block', width: '100%', marginTop: 4, border: '1px solid var(--line)', borderRadius: 6, padding: 8, fontFamily: 'inherit', fontSize: 12 }}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
    </>
  )
}
