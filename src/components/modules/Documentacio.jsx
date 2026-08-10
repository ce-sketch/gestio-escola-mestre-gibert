import { useEffect, useState } from 'react'
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../firebase'
import { cursEscolarActual } from '../../lib/cursEscolar'
import { slug } from '../../lib/slug'
import {
  CICLES, NOMS_SUGGERITS, FESTES, valoracioBuida, objectiuBuit, actuacioBuida,
  mitjanaObjectiu, mitjanaValoracio,
} from '../../lib/valoracions'
import { CURS_AMB_PLANTILLA, PLANTILLES_26_27 } from '../../lib/valoracionsPlantilles26_27'
import {
  GRUPS, NIVELLS_GRAU, festaBuida, objectiuFestaBuit, activitatBuida,
  mitjanaObjectiuGrup, mitjanaGrup, mitjanaGeneralFesta,
} from '../../lib/festesDetall'
import { CURS_AMB_PLANTILLA as CURS_FESTES, FESTES_PLANTILLES_26_27, construeixFestaAmbPlantilla } from '../../lib/festesPlantilles26_27'

function inputPercent(valor, onChange, onBlur) {
  return (
    <input
      type="number" min={0} max={100}
      value={valor}
      onChange={onChange}
      onBlur={onBlur}
      style={{ width: 64, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 12 }}
    />
  )
}

export default function Documentacio() {
  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [tipus, setTipus] = useState('cicle') // 'cicle', 'comissio' o 'festa'
  const [nomsExistents, setNomsExistents] = useState([])
  const [nom, setNom] = useState('')
  const [valoracio, setValoracio] = useState(valoracioBuida())
  const [carregant, setCarregant] = useState(false)
  const [desant, setDesant] = useState(false)
  const [missatge, setMissatge] = useState(null)

  const [festaId, setFestaId] = useState('')
  const [festa, setFesta] = useState(null)
  const [grupObert, setGrupObert] = useState(GRUPS[0])

  useEffect(() => {
    carregaNomsExistents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursEscolarId])

  useEffect(() => {
    if (tipus !== 'festa' && nom.trim()) carregaValoracio()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nom, cursEscolarId, tipus])

  useEffect(() => {
    if (tipus === 'festa' && festaId) carregaFesta()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [festaId, cursEscolarId, tipus])

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

  async function carregaNomsExistents() {
    try {
      const snap = await getDocs(collection(db, 'valoracions'))
      const noms = snap.docs
        .map((d) => d.data())
        .filter((v) => v.cursEscolar === cursEscolarId)
        .map((v) => v.nom)
      setNomsExistents([...new Set(noms)])
    } catch {
      setNomsExistents([])
    }
  }

  async function carregaValoracio() {
    setCarregant(true)
    setMissatge(null)
    try {
      const id = `${cursEscolarId}__${slug(nom.trim())}`
      const snap = await getDoc(doc(db, 'valoracions', id))
      if (snap.exists()) {
        const dades = snap.data()
        setValoracio({ ...valoracioBuida(), ...dades, objectius: dades.objectius?.length ? dades.objectius : [objectiuBuit()] })
        setFestesValoracio({ ...festesBuides(), ...(dades.festes ?? {}) })
      } else if (cursEscolarId === CURS_AMB_PLANTILLA && PLANTILLES_26_27[nom.trim()]) {
        // Primer cop que s'obre aquest nom en aquest curs concret: comencem
        // amb el text real de la plantilla oficial 2026-27. Qualsevol
        // altre curs, o un nom que no hi surti, comença en blanc.
        setValoracio({ ...valoracioBuida(), ...PLANTILLES_26_27[nom.trim()] })
        setFestesValoracio(festesBuides())
      } else {
        setValoracio(valoracioBuida())
        setFestesValoracio(festesBuides())
      }
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut carregar: ${err.message}` })
    } finally {
      setCarregant(false)
    }
  }

  async function desa(valoracioNova) {
    if (!nom.trim()) return
    setDesant(true)
    setMissatge(null)
    try {
      const id = `${cursEscolarId}__${slug(nom.trim())}`
      await setDoc(doc(db, 'valoracions', id), {
        ...valoracioNova,
        nom: nom.trim(),
        cursEscolar: cursEscolarId,
        actualitzatEl: serverTimestamp(),
        actualitzatPer: auth.currentUser?.email ?? null,
      })
      if (!nomsExistents.includes(nom.trim())) setNomsExistents((prev) => [...prev, nom.trim()])
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar: ${err.message}` })
    } finally {
      setDesant(false)
    }
  }

  function actualitza(canvis) {
    const nova = { ...valoracio, ...canvis }
    setValoracio(nova)
    return nova
  }

  function actualitzaObjectiu(objectiuId, canvis) {
    const nova = { ...valoracio, objectius: valoracio.objectius.map((o) => o.id === objectiuId ? { ...o, ...canvis } : o) }
    setValoracio(nova)
    return nova
  }

  function actualitzaActuacio(objectiuId, actuacioId, canvis) {
    const nova = {
      ...valoracio,
      objectius: valoracio.objectius.map((o) => o.id !== objectiuId ? o : {
        ...o,
        actuacions: o.actuacions.map((a) => a.id === actuacioId ? { ...a, ...canvis } : a),
      }),
    }
    setValoracio(nova)
    return nova
  }

  function afegeixObjectiu() {
    const nova = actualitza({ objectius: [...valoracio.objectius, objectiuBuit()] })
    desa(nova)
  }

  function esborraObjectiu(objectiuId) {
    const nova = actualitza({ objectius: valoracio.objectius.filter((o) => o.id !== objectiuId) })
    desa(nova)
  }

  function afegeixActuacio(objectiuId) {
    const nova = {
      ...valoracio,
      objectius: valoracio.objectius.map((o) => o.id !== objectiuId ? o : { ...o, actuacions: [...o.actuacions, actuacioBuida()] }),
    }
    setValoracio(nova)
    desa(nova)
  }

  function esborraActuacio(objectiuId, actuacioId) {
    const nova = {
      ...valoracio,
      objectius: valoracio.objectius.map((o) => o.id !== objectiuId ? o : { ...o, actuacions: o.actuacions.filter((a) => a.id !== actuacioId) }),
    }
    setValoracio(nova)
    desa(nova)
  }

  return (
    <div className="module">
      <p className="module-eyebrow">Mòdul en construcció</p>
      <h2>Documentació</h2>
      <p className="module-lead">
        Aquí es guardaran els documents de cada alumne (autoritzacions, informes, certificats).
        Els fitxers s'emmagatzemaran a Cloudflare R2, i cada document quedarà enllaçat a
        l'alumne corresponent sense afectar la resta de mòduls.
      </p>
      <div className="placeholder-box">
        Properament: pujada de documents, categorització per tipus i cerca per alumne.
      </div>

      <div style={{ marginTop: 32, borderTop: '1px solid var(--line)', paddingTop: 20 }}>
        <p className="module-eyebrow" style={{ marginTop: 0 }}>Valoracions</p>
        <h3 style={{ marginTop: 4, fontSize: 18 }}>Valoració de cicle / comissió / equip</h3>
        <p className="module-lead">
          Mateixa estructura que els fulls "Valoració ..." de sempre: Responsable, Membres,
          Objectius (amb Gener/Juny), i — si el teu cicle/comissió ho necessita — "Actuacions"
          dins de cada objectiu, cadascuna amb el seu indicador d'avaluació. Cada canvi es desa sol.
        </p>

        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
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

        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => { setTipus('cicle'); setNom('') }}
            className={tipus === 'cicle' ? 'btn-primary' : 'btn-ghost'}
            style={{ maxWidth: 200 }}
          >
            Cicles
          </button>
          <button
            type="button"
            onClick={() => { setTipus('comissio'); setNom('') }}
            className={tipus === 'comissio' ? 'btn-primary' : 'btn-ghost'}
            style={{ maxWidth: 240 }}
          >
            Comissions i equips
          </button>
          <button
            type="button"
            onClick={() => { setTipus('festa'); setNom(''); setFestaId('') }}
            className={tipus === 'festa' ? 'btn-primary' : 'btn-ghost'}
            style={{ maxWidth: 240 }}
          >
            Festes i celebracions
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          {tipus === 'cicle' ? (
            <label className="field" style={{ maxWidth: 320 }}>
              <span>Cicle</span>
              <select
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}
              >
                <option value="">Tria un cicle…</option>
                {CICLES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          ) : tipus === 'comissio' ? (
            <label className="field" style={{ maxWidth: 320 }}>
              <span>Nom de la comissió / equip</span>
              <input
                type="text"
                list="noms-valoracio"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="p. ex. Comissió TAC, Equip LIC..."
                style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}
              />
              <datalist id="noms-valoracio">
                {[...new Set([...NOMS_SUGGERITS, ...nomsExistents.filter((n) => !CICLES.includes(n))])].map((n) => <option key={n} value={n} />)}
              </datalist>
            </label>
          ) : (
            <label className="field" style={{ maxWidth: 320 }}>
              <span>Festa</span>
              <select
                value={festaId}
                onChange={(e) => setFestaId(e.target.value)}
                style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}
              >
                <option value="">Tria una festa…</option>
                {FESTES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </label>
          )}
          {desant && <span style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8, display: 'block' }}>Desant…</span>}
        </div>

        {tipus === 'festa' ? (
          !festaId ? (
            <p style={{ marginTop: 16, fontSize: 13, color: 'var(--ink-soft)' }}>Tria una festa per començar (o continuar) la valoració.</p>
          ) : carregant || !festa ? (
            <p style={{ marginTop: 16 }}>Carregant…</p>
          ) : (
            <>
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
                    style={{ fontSize: 12, padding: '6px 12px' }}
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
        ) : !nom.trim() ? (
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--ink-soft)' }}>
            Escriu o tria un nom de cicle/comissió/equip per començar (o continuar) la valoració.
          </p>
        ) : carregant ? (
          <p style={{ marginTop: 16 }}>Carregant…</p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
              <label className="field" style={{ flex: 1, minWidth: 220 }}>
                <span>Responsable</span>
                <input
                  type="text"
                  value={valoracio.responsable}
                  onChange={(e) => actualitza({ responsable: e.target.value })}
                  onBlur={() => desa(valoracio)}
                  style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}
                />
              </label>
              <label className="field" style={{ flex: 2, minWidth: 220 }}>
                <span>Membres</span>
                <input
                  type="text"
                  value={valoracio.membres}
                  onChange={(e) => actualitza({ membres: e.target.value })}
                  onBlur={() => desa(valoracio)}
                  placeholder="Noms separats per comes"
                  style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 24, marginTop: 16, fontSize: 13 }}>
              <span>Grau d'assoliment — Gener: <strong>{mitjanaValoracio(valoracio, 'gener') !== null ? `${Math.round(mitjanaValoracio(valoracio, 'gener'))}%` : '—'}</strong></span>
              <span>Grau d'assoliment — Juny: <strong>{mitjanaValoracio(valoracio, 'juny') !== null ? `${Math.round(mitjanaValoracio(valoracio, 'juny'))}%` : '—'}</strong></span>
            </div>

            <p style={{ fontSize: 13, fontWeight: 600, marginTop: 24 }}>Objectius</p>
            {valoracio.objectius.map((objectiu, oi) => (
              <div key={objectiu.id} className="placeholder-box" style={{ marginTop: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-soft)', minWidth: 20 }}>{oi + 1}.</span>
                  <textarea
                    value={objectiu.text}
                    onChange={(e) => actualitzaObjectiu(objectiu.id, { text: e.target.value })}
                    onBlur={() => desa(valoracio)}
                    rows={2}
                    placeholder="Text de l'objectiu"
                    style={{ flex: 1, minWidth: 220, border: '1px solid var(--line)', borderRadius: 6, padding: '6px 8px', fontSize: 13, fontFamily: 'inherit' }}
                  />
                  {objectiu.actuacions.length === 0 && (
                    <>
                      <label style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                        Gener
                        {inputPercent(objectiu.gener, (e) => actualitzaObjectiu(objectiu.id, { gener: e.target.value }), () => desa(valoracio))}
                      </label>
                      <label style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                        Juny
                        {inputPercent(objectiu.juny, (e) => actualitzaObjectiu(objectiu.id, { juny: e.target.value }), () => desa(valoracio))}
                      </label>
                    </>
                  )}
                  {objectiu.actuacions.length > 0 && (
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                      Gener {mitjanaObjectiu(objectiu, 'gener') !== null ? `${Math.round(mitjanaObjectiu(objectiu, 'gener'))}%` : '—'} · Juny {mitjanaObjectiu(objectiu, 'juny') !== null ? `${Math.round(mitjanaObjectiu(objectiu, 'juny'))}%` : '—'}
                    </div>
                  )}
                  <button type="button" onClick={() => esborraObjectiu(objectiu.id)} style={{ background: 'none', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 6, padding: '4px 8px', fontSize: 11 }}>
                    Esborra objectiu
                  </button>
                </div>

                {objectiu.actuacions.map((actuacio) => (
                  <div key={actuacio.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, marginLeft: 28, flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={actuacio.text}
                      placeholder="Actuació/Activitat"
                      onChange={(e) => actualitzaActuacio(objectiu.id, actuacio.id, { text: e.target.value })}
                      onBlur={() => desa(valoracio)}
                      style={{ flex: 1, minWidth: 160, border: '1px solid var(--line)', borderRadius: 6, padding: '5px 8px', fontSize: 12 }}
                    />
                    <input
                      type="text"
                      value={actuacio.indicador}
                      placeholder="Indicador d'avaluació"
                      onChange={(e) => actualitzaActuacio(objectiu.id, actuacio.id, { indicador: e.target.value })}
                      onBlur={() => desa(valoracio)}
                      style={{ flex: 1, minWidth: 160, border: '1px solid var(--line)', borderRadius: 6, padding: '5px 8px', fontSize: 12 }}
                    />
                    {inputPercent(actuacio.gener, (e) => actualitzaActuacio(objectiu.id, actuacio.id, { gener: e.target.value }), () => desa(valoracio))}
                    {inputPercent(actuacio.juny, (e) => actualitzaActuacio(objectiu.id, actuacio.id, { juny: e.target.value }), () => desa(valoracio))}
                    <button type="button" onClick={() => esborraActuacio(objectiu.id, actuacio.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 11 }}>
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => afegeixActuacio(objectiu.id)}
                  className="btn-ghost"
                  style={{ marginTop: 8, marginLeft: 28, fontSize: 11, padding: '3px 8px', maxWidth: 200 }}
                >
                  + Afegeix actuació (opcional)
                </button>
              </div>
            ))}
            <button type="button" onClick={afegeixObjectiu} className="btn-ghost" style={{ marginTop: 10, color: 'var(--navy)', borderColor: 'var(--navy)', maxWidth: 180 }}>
              + Afegeix objectiu
            </button>

            <div style={{ display: 'flex', gap: 16, marginTop: 24, flexWrap: 'wrap' }}>
              <label style={{ flex: 1, minWidth: 260, fontSize: 13, fontWeight: 600 }}>
                Valoració / revisió (gener o febrer)
                <textarea
                  value={valoracio.valoracioRevisio}
                  onChange={(e) => actualitza({ valoracioRevisio: e.target.value })}
                  onBlur={() => desa(valoracio)}
                  rows={3}
                  style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid var(--line)', borderRadius: 8, padding: 10, fontFamily: 'inherit', fontSize: 13 }}
                />
              </label>
              <label style={{ flex: 1, minWidth: 260, fontSize: 13, fontWeight: 600 }}>
                Valoració final (maig/juny)
                <textarea
                  value={valoracio.valoracioFinal}
                  onChange={(e) => actualitza({ valoracioFinal: e.target.value })}
                  onBlur={() => desa(valoracio)}
                  rows={3}
                  style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid var(--line)', borderRadius: 8, padding: 10, fontFamily: 'inherit', fontSize: 13 }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
              <label style={{ flex: 1, minWidth: 260, fontSize: 13, fontWeight: 600 }}>
                Metodologies utilitzades (opcional)
                <textarea
                  value={valoracio.metodologies}
                  onChange={(e) => actualitza({ metodologies: e.target.value })}
                  onBlur={() => desa(valoracio)}
                  rows={2}
                  style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid var(--line)', borderRadius: 8, padding: 10, fontFamily: 'inherit', fontSize: 13 }}
                />
              </label>
              <label style={{ flex: 1, minWidth: 260, fontSize: 13, fontWeight: 600 }}>
                Propostes de millora (opcional)
                <textarea
                  value={valoracio.propostesMillora}
                  onChange={(e) => actualitza({ propostesMillora: e.target.value })}
                  onBlur={() => desa(valoracio)}
                  rows={2}
                  style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid var(--line)', borderRadius: 8, padding: 10, fontFamily: 'inherit', fontSize: 13 }}
                />
              </label>
            </div>

            {missatge && (
              <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
                {missatge.text}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
