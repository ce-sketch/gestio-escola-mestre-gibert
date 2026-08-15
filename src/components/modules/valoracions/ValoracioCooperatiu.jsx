import { Fragment, useEffect, useMemo, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import {
  normalitzaCooperatiu, grauNivell, grauCicle, grauGlobal, grauObjectiu,
  grauObjectiuNivell, pendentsCooperatiu, actuacioCooperativaBuida, NOM_LLARG,
} from '../../../lib/aprenentatgeCooperatiu'
import { llegeixPlantillaCooperatiu, aplicaPlantilla, resumPlantilla } from '../../../lib/cooperatiuPlantillaParser'
import { opcionsDe, ESCALES } from '../../../lib/escales'
import BotoDrive from '../../BotoDrive'

const pct = (v) => `${Math.round(v)}%`

/** Barreta de color, igual que a la resta de mòduls. */
function Barra({ valor }) {
  const color = valor >= 80 ? 'var(--green)' : valor >= 40 ? 'var(--amber-dark)' : 'var(--red)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 70, height: 8, borderRadius: 4, background: 'var(--line)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(Math.max(valor, 0), 100)}%`, height: '100%', background: color }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600 }}>{pct(valor)}</span>
    </div>
  )
}

/**
 * Valoració de l'aprenentatge cooperatiu.
 *
 * Va per NIVELL, no per cicle: cada nivell valora els tres objectius i el
 * resultat del cicle surt dels seus nivells. És com ho fa el full
 * "APRENENTATGE COOPERATIU" de l'Eina d'avaluació.
 */
export default function ValoracioCooperatiu({ cursEscolarId }) {
  const [dades, setDades] = useState(null)
  const [carregant, setCarregant] = useState(false)
  const [desant, setDesant] = useState(false)
  const [missatge, setMissatge] = useState(null)
  const [momentObert, setMomentObert] = useState('gener')
  const [nivellObert, setNivellObert] = useState(null)
  const [plantilla, setPlantilla] = useState(null)
  const [llegint, setLlegint] = useState(false)

  useEffect(() => {
    carrega()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursEscolarId])

  const totals = useMemo(() => {
    if (!dades) return null
    return {
      gener: { global: grauGlobal(dades, 'gener'), pendents: pendentsCooperatiu(dades, 'gener') },
      juny: { global: grauGlobal(dades, 'juny'), pendents: pendentsCooperatiu(dades, 'juny') },
    }
  }, [dades])

  async function carrega() {
    setCarregant(true)
    setMissatge(null)
    try {
      const snap = await getDoc(doc(db, 'aprenentatgeCooperatiu', cursEscolarId))
      setDades(normalitzaCooperatiu(snap.exists() ? snap.data().dades : null))
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut carregar: ${err.message}` })
      setDades(normalitzaCooperatiu(null))
    } finally {
      setCarregant(false)
    }
  }

  async function desa(noves) {
    setDesant(true)
    try {
      await setDoc(doc(db, 'aprenentatgeCooperatiu', cursEscolarId), {
        dades: noves,
        cursEscolar: cursEscolarId,
        actualitzatEl: serverTimestamp(),
        actualitzatPer: auth.currentUser?.email ?? null,
      })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar: ${err.message}` })
    } finally {
      setDesant(false)
    }
  }

  /** Llegeix la plantilla del centre i n'ensenya el contingut. */
  async function pujaPlantilla(e) {
    const fitxer = e.target.files?.[0]
    if (!fitxer) return
    setLlegint(true)
    setMissatge(null)
    setPlantilla(null)
    try {
      setPlantilla(await llegeixPlantillaCooperatiu(await fitxer.arrayBuffer()))
    } catch (err) {
      setMissatge({ type: 'error', text: err.message })
    } finally {
      setLlegint(false)
    }
  }

  function aplicaLaPlantilla() {
    if (!plantilla) return
    const noves = aplicaPlantilla(dades, plantilla.nivells)
    setDades(noves)
    desa(noves)
    setPlantilla(null)
    setMissatge({ type: 'ok', text: 'Actuacions carregades de la plantilla.' })
  }

  function canviaActuacio(nivell, objectiuId, actuacioId, camp, valor) {
    const actuacions = (dades.valors[nivell][objectiuId].actuacions ?? [])
      .map((a) => (a.id === actuacioId ? { ...a, [camp]: valor } : a))
    const noves = {
      ...dades,
      valors: {
        ...dades.valors,
        [nivell]: {
          ...dades.valors[nivell],
          [objectiuId]: { ...dades.valors[nivell][objectiuId], actuacions },
        },
      },
    }
    setDades(noves)
    return noves
  }

  function afegeixActuacio(nivell, objectiuId) {
    const actuacions = [...(dades.valors[nivell][objectiuId].actuacions ?? []), actuacioCooperativaBuida()]
    const noves = {
      ...dades,
      valors: {
        ...dades.valors,
        [nivell]: {
          ...dades.valors[nivell],
          [objectiuId]: { ...dades.valors[nivell][objectiuId], actuacions },
        },
      },
    }
    setDades(noves)
    desa(noves)
  }

  function canviaValor(nivell, objectiuId, camp, valor) {
    const noves = {
      ...dades,
      valors: {
        ...dades.valors,
        [nivell]: {
          ...dades.valors[nivell],
          [objectiuId]: { ...dades.valors[nivell][objectiuId], [camp]: valor },
        },
      },
    }
    setDades(noves)
    return noves
  }

  function canviaPesObjectiu(objectiuId, pes) {
    const noves = {
      ...dades,
      objectius: dades.objectius.map((o) => (o.id === objectiuId ? { ...o, pes } : o)),
    }
    setDades(noves)
    return noves
  }

  function canviaPesCicle(cicleId, pes) {
    const noves = {
      ...dades,
      cicles: dades.cicles.map((c) => (c.id === cicleId ? { ...c, pes } : c)),
    }
    setDades(noves)
    return noves
  }

  if (carregant || !dades) return <p style={{ marginTop: 16 }}>Carregant…</p>

  const camp = momentObert
  const pesObjectius = dades.objectius.reduce((t, o) => t + Number(o.pes || 0), 0)
  const pesCicles = dades.cicles.reduce((t, c) => t + Number(c.pes || 0), 0)
  const pendents = totals[camp].pendents.total - totals[camp].pendents.valorats

  return (
    <>
      {desant && <span style={{ fontSize: 12, color: 'var(--ink-soft)', display: 'block', marginTop: 8 }}>Desant…</span>}

      <p className="nota" style={{ marginTop: 12, maxWidth: '100%' }}>
        A diferència de la resta de valoracions, aquesta va <strong>per nivell</strong> i no per
        cicle: cada nivell valora els tres objectius amb un percentatge, el resultat del cicle
        surt de la mitjana dels seus nivells, i el global surt dels quatre cicles amb el seu pes.
        Igual que al full de l'Eina d'avaluació.
      </p>

      {/* ── Carregar la plantilla ── */}
      <div className="caixa-discreta" style={{ marginTop: 14 }}>
        <strong style={{ fontSize: 13 }}>Carrega les actuacions d'una plantilla</strong>
        <p className="nota" style={{ maxWidth: '100%' }}>
          Puja el document "Valoració Aprenentatge Cooperatiu" del centre i l'app en treu les
          actuacions de cada nivell amb la seva escala. Les actuacions no són les mateixes a tots
          els nivells, i per això val més llegir-les del full que escriure-les a mà.
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
          <BotoDrive
            onFitxer={pujaPlantilla}
            tipus="fulls"
            etiqueta="Tria la plantilla del Drive"
            onError={(t) => setMissatge({ type: 'error', text: t })}
            disabled={llegint}
          />
          <label className="btn-ghost" style={{ color: 'var(--navy)', borderColor: 'var(--navy)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
            {llegint ? 'Llegint…' : '📤 Puja la plantilla Excel'}
            <input type="file" accept=".xlsx" style={{ display: 'none' }}
              onChange={(e) => { pujaPlantilla(e); e.target.value = '' }} />
          </label>
        </div>

        {plantilla && (
          <div className="caixa" style={{ marginTop: 12 }}>
            <strong style={{ fontSize: 13 }}>
              {Object.keys(plantilla.nivells).length} nivells llegits
            </strong>
            {plantilla.avisos.map((a, i) => <p key={i} className="nota nota-avis">{a}</p>)}
            <ul style={{ fontSize: 12, color: 'var(--ink-soft)', paddingLeft: 18, marginTop: 6 }}>
              {resumPlantilla(plantilla.nivells).map((r) => (
                <li key={r.nivell}>{r.nivell}: {r.total} actuacions</li>
              ))}
            </ul>
            <p className="nota nota-avis">
              Substituirà les actuacions dels nivells que porti la plantilla. Els altres es queden
              com estan.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button type="button" onClick={aplicaLaPlantilla} className="btn-primary" style={{ maxWidth: 160 }}>
                Carrega-ho
              </button>
              <button type="button" onClick={() => setPlantilla(null)} className="btn-ghost" style={{ maxWidth: 130 }}>
                Cancel·la
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Totals ── */}
      <div className="caixa" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          {['gener', 'juny'].map((m) => (
            <div key={m}>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                Grau d'assoliment — {m === 'gener' ? 'Gener' : 'Juny'}
              </div>
              <Barra valor={totals[m].global} />
            </div>
          ))}
        </div>
        {pendents > 0 && (
          <p className="nota" style={{ marginTop: 6 }}>
            {pendents} de {totals[camp].pendents.total} caselles sense valorar
            al {camp === 'gener' ? 'gener' : 'juny'} — compten 0.
          </p>
        )}
      </div>

      {/* ── Objectius i pesos ── */}
      <div className="caixa-discreta" style={{ marginTop: 14 }}>
        <strong style={{ fontSize: 13 }}>Els tres objectius i el seu pes</strong>
        {dades.objectius.map((o, i) => (
          <div key={o.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, minWidth: 18, color: 'var(--ink-soft)' }}>{i + 1}.</span>
            <span style={{ flex: 1, minWidth: 220, fontSize: 12 }}>{o.text}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <input
                type="number" min={0} max={100}
                value={o.pes}
                onChange={(e) => canviaPesObjectiu(o.id, e.target.value)}
                onBlur={() => desa(dades)}
                style={{ width: 56, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 12, textAlign: 'right' }}
              />
              <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>%</span>
            </span>
            <Barra valor={grauObjectiu(dades, o.id, camp)} />
          </div>
        ))}
        {Math.abs(pesObjectius - 100) > 0.5 && (
          <p className="nota nota-avis">Els pesos sumen {pesObjectius}%, no 100%.</p>
        )}
      </div>

      {/* ── Selector de moment ── */}
      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        {['gener', 'juny'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMomentObert(m)}
            className={momentObert === m ? 'btn-primary' : 'btn-ghost'}
          >
            {m === 'gener' ? 'Gener' : 'Juny'}
          </button>
        ))}
      </div>

      {/* ── Graella per nivell ── */}
      <div className="taula-scroll" style={{ marginTop: 12 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 10px 6px 0' }}>Nivell</th>
              {dades.objectius.map((o, i) => (
                <th key={o.id} style={{ textAlign: 'center', padding: '6px 10px', minWidth: 90 }}>
                  Objectiu {i + 1}
                  <div style={{ fontWeight: 400, fontSize: 10, color: 'var(--ink-soft)' }}>{o.pes}%</div>
                </th>
              ))}
              <th style={{ textAlign: 'left', padding: '6px 10px' }}>Grau del nivell</th>
            </tr>
          </thead>
          <tbody>
            {dades.cicles.map((cicle) => (
              <Fragment key={cicle.id}>
                {cicle.nivells.map((nivell, idx) => (
                  <tr key={nivell}>
                    <td style={{ padding: '4px 10px 4px 0', fontWeight: 600 }}>
                      <button
                        type="button"
                        onClick={() => setNivellObert(nivellObert === nivell ? null : nivell)}
                        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--navy)', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        {nivell}
                      </button>
                      {idx === 0 && (
                        <div style={{ fontWeight: 400, fontSize: 10, color: 'var(--ink-soft)' }}>{cicle.nom}</div>
                      )}
                    </td>
                    {dades.objectius.map((o) => {
                      const actuacions = dades.valors[nivell]?.[o.id]?.actuacions ?? []
                      // Si l'objectiu té actuacions, el número surt d'elles i
                      // no s'escriu: es toquen des del detall del nivell.
                      return (
                        <td key={o.id} style={{ padding: '4px 10px', textAlign: 'center' }}>
                          {actuacions.length > 0 ? (
                            <span title={`${actuacions.length} actuacions`}>
                              {Math.round(grauObjectiuNivell(dades, nivell, o.id, camp))}%
                              <span style={{ fontSize: 10, color: 'var(--ink-soft)' }}> ({actuacions.length})</span>
                            </span>
                          ) : (
                            <input
                              type="number" min={0} max={100}
                              value={dades.valors[nivell]?.[o.id]?.[camp] ?? ''}
                              placeholder="—"
                              onChange={(e) => canviaValor(nivell, o.id, camp, e.target.value)}
                              onBlur={() => desa(dades)}
                              style={{ width: 64, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 12, textAlign: 'right' }}
                            />
                          )}
                        </td>
                      )
                    })}
                    <td style={{ padding: '4px 10px' }}>
                      <Barra valor={grauNivell(dades, nivell, camp)} />
                    </td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--paper)' }}>
                  <td style={{ padding: '6px 10px 6px 0', fontSize: 11, color: 'var(--ink-soft)' }}>
                    Grau de {cicle.nom}
                  </td>
                  <td colSpan={dades.objectius.length} style={{ padding: '6px 10px', textAlign: 'right' }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>pes del cicle</span>{' '}
                    <input
                      type="number" min={0} max={100}
                      value={cicle.pes}
                      onChange={(e) => canviaPesCicle(cicle.id, e.target.value)}
                      onBlur={() => desa(dades)}
                      style={{ width: 56, border: '1px solid var(--line)', borderRadius: 6, padding: '3px 5px', fontSize: 11, textAlign: 'right' }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}> %</span>
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <Barra valor={grauCicle(dades, cicle.id, camp)} />
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {Math.abs(pesCicles - 100) > 0.5 && (
        <p className="nota nota-avis">Els pesos dels cicles sumen {pesCicles}%, no 100%.</p>
      )}


      {/* ── Detall d'un nivell ──────────────────────────────────────
          Disposat com el full del centre: cada objectiu amb les seves
          actuacions a sota, i les dues columnes de seguiment —gener i
          juny— alhora, per no haver de canviar de moment per veure'n una.
      */}
      {nivellObert && (
        <div className="caixa" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 15 }}>
              {NOM_LLARG[nivellObert] ?? `Nivell ${nivellObert}`}
            </strong>
            <button type="button" onClick={() => setNivellObert(null)} className="btn-ghost" style={{ maxWidth: 100 }}>
              Tanca
            </button>
          </div>

          {dades.objectius.map((o) => {
            const actuacions = dades.valors[nivellObert]?.[o.id]?.actuacions ?? []
            return (
              <div key={o.id} style={{ marginTop: 18 }}>
                <div className="taula-scroll">
                  <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{
                          textAlign: 'left', padding: '8px 10px', width: '45%',
                          border: '1px solid var(--line)', verticalAlign: 'top', fontWeight: 600,
                        }}>
                          {o.text}
                        </th>
                        <th colSpan={2} style={{ padding: '8px 10px', border: '1px solid var(--line)' }}>
                          Seguiment gener
                        </th>
                        <th colSpan={2} style={{ padding: '8px 10px', border: '1px solid var(--line)' }}>
                          Grau d'assoliment juny
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {actuacions.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: '8px 10px', border: '1px solid var(--line)', color: 'var(--ink-soft)' }}>
                            Cap actuació. El percentatge d'aquest objectiu s'escriu directament a la graella de dalt.
                          </td>
                        </tr>
                      ) : actuacions.map((a) => {
                        const opcions = opcionsDe(a)
                        return (
                          <tr key={a.id}>
                            <td style={{ padding: '6px 10px', border: '1px solid var(--line)', verticalAlign: 'top' }}>
                              <textarea
                                rows={Math.min(12, Math.max(2, Math.ceil(a.text.length / 45)))}
                                value={a.text}
                                placeholder="Text de l'actuació i el seu criteri"
                                onChange={(e) => canviaActuacio(nivellObert, o.id, a.id, 'text', e.target.value)}
                                onBlur={() => desa(dades)}
                                style={{
                                  width: '100%', border: 'none', background: 'transparent',
                                  fontSize: 12, resize: 'vertical', fontFamily: 'inherit', color: 'inherit',
                                }}
                              />
                              <select
                                value={a.escala ?? 'execucio50'}
                                onChange={(e) => { const n = canviaActuacio(nivellObert, o.id, a.id, 'escala', e.target.value); desa(n) }}
                                title="Escala d'aquesta actuació"
                                style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '2px 4px', fontSize: 10, maxWidth: '100%' }}
                              >
                                {a.escala === 'propia' && <option value="propia">Escala pròpia del full</option>}
                                {ESCALES.map((es) => <option key={es.id} value={es.id}>{es.nom}</option>)}
                              </select>
                            </td>

                            {['gener', 'juny'].map((m) => {
                              const actual = opcions.find((op) => op.valor === Number(a[m])) ?? null
                              return [
                                <td key={`${m}-sel`} style={{ padding: '6px 8px', border: '1px solid var(--line)', verticalAlign: 'middle', textAlign: 'center' }}>
                                  {opcions.length > 0 ? (
                                    <select
                                      value={actual ? String(actual.valor) : ''}
                                      onChange={(e) => {
                                        const n = canviaActuacio(nivellObert, o.id, a.id, m, e.target.value === '' ? '' : Number(e.target.value))
                                        desa(n)
                                      }}
                                      style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 12, minWidth: 110 }}
                                    >
                                      <option value="">—</option>
                                      {opcions.map((op) => (
                                        <option key={op.id} value={op.valor}>{op.label}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="number" min={0} max={100}
                                      value={a[m]}
                                      onChange={(e) => canviaActuacio(nivellObert, o.id, a.id, m, e.target.value)}
                                      onBlur={() => desa(dades)}
                                      style={{ width: 70, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 12 }}
                                    />
                                  )}
                                </td>,
                                <td key={`${m}-pct`} style={{
                                  padding: '6px 8px', border: '1px solid var(--line)',
                                  textAlign: 'center', background: 'var(--paper)', minWidth: 56,
                                }}>
                                  {a[m] === '' || a[m] === null || a[m] === undefined
                                    ? <span style={{ color: 'var(--ink-soft)' }}>—</span>
                                    : `${Math.round(Number(a[m]))}%`}
                                </td>,
                              ]
                            })}
                          </tr>
                        )
                      })}

                      <tr>
                        <td style={{ padding: '6px 10px', border: '1px solid var(--line)', fontWeight: 600 }}>
                          Grau de l'objectiu
                        </td>
                        <td colSpan={2} style={{ padding: '6px 10px', border: '1px solid var(--line)', textAlign: 'center', fontWeight: 600 }}>
                          {Math.round(grauObjectiuNivell(dades, nivellObert, o.id, 'gener'))}%
                        </td>
                        <td colSpan={2} style={{ padding: '6px 10px', border: '1px solid var(--line)', textAlign: 'center', fontWeight: 600 }}>
                          {Math.round(grauObjectiuNivell(dades, nivellObert, o.id, 'juny'))}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={() => afegeixActuacio(nivellObert, o.id)}
                  className="btn-ghost"
                  style={{ marginTop: 6, fontSize: 12, padding: '4px 10px', maxWidth: 180 }}
                >
                  + Afegeix actuació
                </button>
              </div>
            )
          })}
        </div>
      )}

      <label className="field" style={{ marginTop: 20, maxWidth: '100%' }}>
        <span>Observacions</span>
        <textarea
          rows={4}
          value={dades.observacions}
          onChange={(e) => setDades({ ...dades, observacions: e.target.value })}
          onBlur={() => desa(dades)}
          style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 13, resize: 'vertical' }}
        />
      </label>

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
          {missatge.text}
        </p>
      )}
    </>
  )
}
