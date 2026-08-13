import { Fragment, useEffect, useMemo, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import {
  normalitzaCooperatiu, grauNivell, grauCicle, grauGlobal, grauObjectiu,
  pendentsCooperatiu,
} from '../../../lib/aprenentatgeCooperatiu'

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
                      {nivell}
                      {idx === 0 && (
                        <div style={{ fontWeight: 400, fontSize: 10, color: 'var(--ink-soft)' }}>{cicle.nom}</div>
                      )}
                    </td>
                    {dades.objectius.map((o) => (
                      <td key={o.id} style={{ padding: '4px 10px', textAlign: 'center' }}>
                        <input
                          type="number" min={0} max={100}
                          value={dades.valors[nivell]?.[o.id]?.[camp] ?? ''}
                          placeholder="—"
                          onChange={(e) => canviaValor(nivell, o.id, camp, e.target.value)}
                          onBlur={() => desa(dades)}
                          style={{ width: 64, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 12, textAlign: 'right' }}
                        />
                      </td>
                    ))}
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
