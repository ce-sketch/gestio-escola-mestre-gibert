import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import { FESTES } from '../../../lib/valoracions'
import {
  GRUPS, NIVELLS_GRAU, festaBuida, objectiuFestaBuit, activitatBuida,
  mitjanaObjectiuGrup, mitjanaGrup, mitjanaGeneralFesta,
} from '../../../lib/festesDetall'
import {
  CURS_AMB_PLANTILLA as CURS_FESTES, FESTES_PLANTILLES_26_27, construeixFestaAmbPlantilla,
} from '../../../lib/festesPlantilles26_27'

/** Valoració d'una festa: objectius amb pes, desglossats per grup
 *  (cicles + equip directiu) amb activitats i grau d'assoliment. */
export default function ValoracioFesta({ cursEscolarId, festaId }) {
  const [festa, setFesta] = useState(null)
  const [grupObert, setGrupObert] = useState(GRUPS[0])
  const [carregant, setCarregant] = useState(false)
  const [desant, setDesant] = useState(false)
  const [missatge, setMissatge] = useState(null)

  useEffect(() => {
    if (festaId) carregaFesta()
    else setFesta(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursEscolarId, festaId])

  async function carregaFesta() {
    setCarregant(true)
    setMissatge(null)
    try {
      const id = `${cursEscolarId}__festa-${festaId}`
      const snap = await getDoc(doc(db, 'festesDetall', id))
      if (snap.exists()) {
        setFesta(snap.data().festa)
      } else if (cursEscolarId === CURS_FESTES && FESTES_PLANTILLES_26_27[festaId]) {
        setFesta(construeixFestaAmbPlantilla(FESTES_PLANTILLES_26_27[festaId]))
      } else {
        const label = FESTES.find((f) => f.id === festaId)?.label ?? festaId
        setFesta(festaBuida(label))
      }
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut carregar: ${err.message}` })
    } finally {
      setCarregant(false)
    }
  }

  async function desaFesta(festaNova) {
    setDesant(true)
    setMissatge(null)
    try {
      const id = `${cursEscolarId}__festa-${festaId}`
      await setDoc(doc(db, 'festesDetall', id), {
        festa: festaNova,
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

  function actualitzaFesta(canvis) {
    const nova = { ...festa, ...canvis }
    setFesta(nova)
    return nova
  }

  function actualitzaObjectiuFesta(objectiuId, canvis) {
    const nova = { ...festa, objectius: festa.objectius.map((o) => o.id === objectiuId ? { ...o, ...canvis } : o) }
    setFesta(nova)
    return nova
  }

  function afegeixObjectiuFesta() {
    const nouObjectiu = objectiuFestaBuit(0)
    const grups = {}
    for (const g of GRUPS) grups[g] = { ...festa.grups[g], [nouObjectiu.id]: { activitats: [], comentaris: '' } }
    const nova = { ...festa, objectius: [...festa.objectius, nouObjectiu], grups }
    setFesta(nova)
    desaFesta(nova)
  }

  function actualitzaActivitatFesta(grupNom, objectiuId, activitatId, canvis) {
    const nova = {
      ...festa,
      grups: {
        ...festa.grups,
        [grupNom]: {
          ...festa.grups[grupNom],
          [objectiuId]: {
            ...festa.grups[grupNom][objectiuId],
            activitats: festa.grups[grupNom][objectiuId].activitats.map((a) => a.id === activitatId ? { ...a, ...canvis } : a),
          },
        },
      },
    }
    setFesta(nova)
    return nova
  }

  function afegeixActivitatFesta(grupNom, objectiuId) {
    const novaActivitat = activitatBuida()
    const nova = {
      ...festa,
      grups: {
        ...festa.grups,
        [grupNom]: {
          ...festa.grups[grupNom],
          [objectiuId]: {
            ...festa.grups[grupNom][objectiuId],
            activitats: [...festa.grups[grupNom][objectiuId].activitats, novaActivitat],
          },
        },
      },
    }
    setFesta(nova)
    desaFesta(nova)
  }

  function esborraActivitatFesta(grupNom, objectiuId, activitatId) {
    const nova = {
      ...festa,
      grups: {
        ...festa.grups,
        [grupNom]: {
          ...festa.grups[grupNom],
          [objectiuId]: {
            ...festa.grups[grupNom][objectiuId],
            activitats: festa.grups[grupNom][objectiuId].activitats.filter((a) => a.id !== activitatId),
          },
        },
      },
    }
    setFesta(nova)
    desaFesta(nova)
  }

  function actualitzaComentarisGrup(grupNom, objectiuId, comentaris) {
    const nova = {
      ...festa,
      grups: { ...festa.grups, [grupNom]: { ...festa.grups[grupNom], [objectiuId]: { ...festa.grups[grupNom][objectiuId], comentaris } } },
    }
    setFesta(nova)
    return nova
  }


  if (!festaId) {
    return <p style={{ marginTop: 16, fontSize: 13, color: 'var(--ink-soft)' }}>Tria una festa per començar (o continuar) la valoració.</p>
  }
  if (carregant || !festa) return <p style={{ marginTop: 16 }}>Carregant…</p>

  return (
    <>
      {desant && <span style={{ fontSize: 12, color: 'var(--ink-soft)', display: 'block', marginTop: 8 }}>Desant…</span>}
              <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label className="field" style={{ maxWidth: 260 }}>
                  <span>Data</span>
                  <input
                    type="text"
                    value={festa.data}
                    onChange={(e) => actualitzaFesta({ data: e.target.value })}
                    onBlur={() => desaFesta(festa)}
                    placeholder="p. ex. 23 d'abril de 2027"
                    style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}
                  />
                </label>
                <div style={{ fontSize: 13 }}>
                  Grau d'assoliment general: <strong>{mitjanaGeneralFesta(festa) !== null ? `${Math.round(mitjanaGeneralFesta(festa))}%` : '—'}</strong>
                </div>
              </div>

              <p style={{ fontSize: 13, fontWeight: 600, marginTop: 20 }}>Objectius (amb el seu pes % entre ells)</p>
              {festa.objectius.map((o, oi) => (
                <div key={o.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-soft)', minWidth: 18 }}>{oi + 1}.</span>
                  <textarea
                    value={o.text}
                    onChange={(e) => actualitzaObjectiuFesta(o.id, { text: e.target.value })}
                    onBlur={() => desaFesta(festa)}
                    rows={2}
                    placeholder="Text de l'objectiu"
                    style={{ flex: 1, minWidth: 220, border: '1px solid var(--line)', borderRadius: 6, padding: '6px 8px', fontSize: 13, fontFamily: 'inherit' }}
                  />
                  <label style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                    Pes %
                    <input
                      type="number" min={0} max={100}
                      value={o.pes}
                      onChange={(e) => actualitzaObjectiuFesta(o.id, { pes: e.target.value })}
                      onBlur={() => desaFesta(festa)}
                      style={{ display: 'block', width: 64, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 12 }}
                    />
                  </label>
                </div>
              ))}
              <button type="button" onClick={afegeixObjectiuFesta} className="btn-ghost" style={{ marginTop: 8, maxWidth: 180, fontSize: 12 }}>
                + Afegeix objectiu
              </button>

              <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
                <label style={{ fontSize: 12 }}>
                  Pes Cicles %
                  <input
                    type="number" min={0} max={100}
                    value={festa.pesCicles}
                    onChange={(e) => actualitzaFesta({ pesCicles: e.target.value })}
                    onBlur={() => desaFesta(festa)}
                    style={{ display: 'block', width: 80, marginTop: 2, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px' }}
                  />
                </label>
                <label style={{ fontSize: 12 }}>
                  Pes Equip Directiu %
                  <input
                    type="number" min={0} max={100}
                    value={festa.pesEquipDirectiu}
                    onChange={(e) => actualitzaFesta({ pesEquipDirectiu: e.target.value })}
                    onBlur={() => desaFesta(festa)}
                    style={{ display: 'block', width: 80, marginTop: 2, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px' }}
                  />
                </label>
              </div>

              <p style={{ fontSize: 13, fontWeight: 600, marginTop: 24 }}>Desglossament per grup</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {GRUPS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGrupObert(g)}
                    className={grupObert === g ? 'btn-primary' : 'btn-ghost'}
                    style={grupObert === g ? { fontSize: 12, padding: '6px 12px' } : { fontSize: 12, padding: '6px 12px', color: 'var(--navy)', borderColor: 'var(--navy)' }}
                  >
                    {g} {mitjanaGrup(festa, g) !== null ? `(${Math.round(mitjanaGrup(festa, g))}%)` : ''}
                  </button>
                ))}
              </div>

              <div className="placeholder-box" style={{ marginTop: 12 }}>
                {festa.objectius.map((o, oi) => {
                  const bloc = festa.grups[grupObert]?.[o.id] ?? { activitats: [], comentaris: '' }
                  return (
                    <div key={o.id} style={{ marginTop: oi === 0 ? 0 : 16, borderTop: oi === 0 ? 'none' : '1px dashed var(--line)', paddingTop: oi === 0 ? 0 : 12 }}>
                      <p style={{ fontSize: 12, fontWeight: 600 }}>
                        {oi + 1}. {o.text || '(sense text)'} — {mitjanaObjectiuGrup(festa, grupObert, o.id) !== null ? `${Math.round(mitjanaObjectiuGrup(festa, grupObert, o.id))}%` : '—'}
                      </p>
                      {bloc.activitats.map((a) => (
                        <div key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            value={a.text}
                            placeholder="Activitat/Indicador"
                            onChange={(e) => actualitzaActivitatFesta(grupObert, o.id, a.id, { text: e.target.value })}
                            onBlur={() => desaFesta(festa)}
                            style={{ flex: 1, minWidth: 200, border: '1px solid var(--line)', borderRadius: 6, padding: '5px 8px', fontSize: 12 }}
                          />
                          <select
                            value={a.grau}
                            onChange={(e) => { const nova = actualitzaActivitatFesta(grupObert, o.id, a.id, { grau: e.target.value }); desaFesta(nova) }}
                            style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '5px 6px', fontSize: 12 }}
                          >
                            <option value="">—</option>
                            {NIVELLS_GRAU.map((n) => <option key={n.id} value={n.valor}>{n.label}</option>)}
                          </select>
                          <button type="button" onClick={() => esborraActivitatFesta(grupObert, o.id, a.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 11 }}>✕</button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => afegeixActivitatFesta(grupObert, o.id)}
                        className="btn-ghost"
                        style={{ marginTop: 6, fontSize: 11, padding: '3px 8px', maxWidth: 180 }}
                      >
                        + Afegeix activitat
                      </button>
                      <textarea
                        value={bloc.comentaris}
                        onChange={(e) => actualitzaComentarisGrup(grupObert, o.id, e.target.value)}
                        onBlur={() => desaFesta(festa)}
                        rows={2}
                        placeholder="Comentaris i propostes de millora (opcional)"
                        style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid var(--line)', borderRadius: 6, padding: 8, fontFamily: 'inherit', fontSize: 12 }}
                      />
                    </div>
                  )
                })}
              </div>

              {missatge && (
                <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
                  {missatge.text}
                </p>
              )}
    </>
  )
}
