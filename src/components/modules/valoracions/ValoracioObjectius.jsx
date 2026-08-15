import { useEffect, useMemo, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import { slug } from '../../../lib/slug'
import {
  valoracioBuida, objectiuBuit, actuacioBuida, MOMENTS_DADES,
  mitjanaObjectiu, mitjanaValoracio, pendentsValoracio, pendentsObjectiu,
} from '../../../lib/valoracions'
import { CURS_AMB_PLANTILLA, PLANTILLES_26_27 } from '../../../lib/valoracionsPlantilles26_27'
import { ESCALES, opcionsDe } from '../../../lib/escales'
import { llegeixPlantillaValoracio } from '../../../lib/valoracionsPlantillaParser'
import BotoDrive from '../../BotoDrive'



/** Selector del grau d'una actuació o objectiu. Cada element porta la seva
 *  pròpia escala, perquè els fulls del centre no en fan servir una de sola:
 *  les comissions tenen "En procés" al 50%, els cicles escriuen el
 *  percentatge directament, i n'hi ha de binàries i de recompte.
 *  `onCanvi` rep el valor numèric ja convertit. */
function SelectorEstat({ etiqueta, valor, escala, opcions: opcionsPropies, onCanvi, onCanviEscala }) {
  const element = { escala: escala ?? 'execucio50', opcions: opcionsPropies }
  const opcions = opcionsDe(element)
  const actual = opcions.find((o) => o.valor === Number(valor)) ?? null
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, color: 'var(--ink-soft)', minWidth: 40 }}>{etiqueta}</span>
      {opcions.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onCanvi(o.valor)}
          style={{
            fontSize: 11, padding: '4px 10px', borderRadius: 6,
            border: `1px solid ${actual?.id === o.id ? 'var(--navy)' : 'var(--line)'}`,
            background: actual?.id === o.id ? 'var(--navy)' : 'transparent',
            color: actual?.id === o.id ? '#fff' : 'var(--ink)',
            cursor: 'pointer',
          }}
        >
          {o.label}
        </button>
      ))}
      <input
        type="number" min={0} max={100}
        value={valor}
        onChange={(e) => onCanvi(e.target.value)}
        title="Percentatge exacte"
        style={{ width: 56, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 11 }}
      />
      <span style={{ fontSize: 10, color: 'var(--ink-soft)' }}>%</span>
      {onCanviEscala && (
        <select
          value={escala ?? 'execucio50'}
          onChange={(e) => onCanviEscala(e.target.value)}
          title="Escala d'aquesta actuació, tal com surt al full original"
          style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '3px 5px', fontSize: 10, maxWidth: 190 }}
        >
          {(escala === 'propia') && <option value="propia">Escala pròpia del full</option>}
          {ESCALES.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
        </select>
      )}
    </div>
  )
}

/** Valoració d'un cicle, comissió, equip o comissió mixta: llista
 *  d'objectius, cadascun amb les seves actuacions opcionals. */
export default function ValoracioObjectius({ cursEscolarId, tipus, nom, onDesat }) {
  const [valoracio, setValoracio] = useState(valoracioBuida())
  const [plantilla, setPlantilla] = useState(null)
  const [llegintPlantilla, setLlegintPlantilla] = useState(false)
  const [errorPlantilla, setErrorPlantilla] = useState(null)
  const [carregant, setCarregant] = useState(false)
  const [desant, setDesant] = useState(false)
  const [missatge, setMissatge] = useState(null)

  useEffect(() => {
    if (nom.trim()) carregaValoracio()
    else setValoracio(valoracioBuida())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursEscolarId, tipus, nom])

  async function carregaValoracio() {
    setCarregant(true)
    setMissatge(null)
    try {
      const id = `${cursEscolarId}__${slug(nom.trim())}`
      const snap = await getDoc(doc(db, 'valoracions', id))
      if (snap.exists()) {
        const dades = snap.data()
        setValoracio({ ...valoracioBuida(), ...dades, objectius: dades.objectius?.length ? dades.objectius : [objectiuBuit()] })
      } else if (cursEscolarId === CURS_AMB_PLANTILLA && PLANTILLES_26_27[nom.trim()]) {
        // Primer cop que s'obre aquest nom en aquest curs concret: comencem
        // amb el text real de la plantilla oficial 2026-27. Qualsevol
        // altre curs, o un nom que no hi surti, comença en blanc.
        setValoracio({ ...valoracioBuida(), ...PLANTILLES_26_27[nom.trim()] })
      } else {
        setValoracio(valoracioBuida())
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
      onDesat?.()
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

  /** Llegeix una plantilla del centre i n'ensenya el contingut abans de
   *  substituir res. L'escala de cada actuació surt de la fórmula del full,
   *  no se suposa. */
  async function pujaPlantilla(fitxer) {
    if (!fitxer) return
    setLlegintPlantilla(true)
    setErrorPlantilla(null)
    setPlantilla(null)
    try {
      const buffer = await fitxer.arrayBuffer()
      setPlantilla(await llegeixPlantillaValoracio(buffer))
    } catch (err) {
      setErrorPlantilla(err.message)
    } finally {
      setLlegintPlantilla(false)
    }
  }

  function aplicaPlantilla() {
    if (!plantilla) return
    const nova = {
      ...valoracio,
      responsable: plantilla.valoracio.responsable || valoracio.responsable,
      membres: plantilla.valoracio.membres || valoracio.membres,
      objectius: plantilla.valoracio.objectius,
    }
    setValoracio(nova)
    desa(nova)
    setPlantilla(null)
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

  function actualitzaEtiquetaDades(objectiuId, moment, valor) {
    return actualitzaObjectiu(objectiuId, {
      etiquetesDades: {
        ...(valoracio.objectius.find((o) => o.id === objectiuId)?.etiquetesDades ?? {}),
        [moment]: valor,
      },
    })
  }

  function actualitzaDadaActuacio(objectiuId, actuacioId, moment, valor) {
    const objectiu = valoracio.objectius.find((o) => o.id === objectiuId)
    const actuacio = objectiu?.actuacions.find((a) => a.id === actuacioId)
    return actualitzaActuacio(objectiuId, actuacioId, {
      dades: { ...(actuacio?.dades ?? { inici: '', gener: '', juny: '' }), [moment]: valor },
    })
  }

  function afegeixObjectiu() {
    const nova = actualitza({ objectius: [...valoracio.objectius, objectiuBuit()] })
    desa(nova)
  }

  /** Esborrar un objectiu se'n porta el text i totes les seves actuacions,
   *  i no hi ha desfer. Val la pena preguntar-ho. */
  function esborraObjectiu(objectiuId) {
    const objectiu = valoracio.objectius.find((o) => o.id === objectiuId)
    const quantes = objectiu?.actuacions?.length ?? 0
    const detall = quantes > 0 ? ` i les seves ${quantes} actuacions` : ''
    if (!window.confirm(`Segur que vols esborrar aquest objectiu${detall}? No es pot desfer.`)) return
    return esborraObjectiuConfirmat(objectiuId)
  }

  function esborraObjectiuConfirmat(objectiuId) {
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
    const actuacio = valoracio.objectius
      .find((o) => o.id === objectiuId)?.actuacions.find((a) => a.id === actuacioId)
    if (actuacio?.text?.trim() && !window.confirm(`Segur que vols esborrar «${actuacio.text.slice(0, 60)}»?`)) return
    return esborraActuacioConfirmada(objectiuId, actuacioId)
  }

  function esborraActuacioConfirmada(objectiuId, actuacioId) {
    const nova = {
      ...valoracio,
      objectius: valoracio.objectius.map((o) => o.id !== objectiuId ? o : { ...o, actuacions: o.actuacions.filter((a) => a.id !== actuacioId) }),
    }
    setValoracio(nova)
    desa(nova)
  }


  // Els totals de la valoració recorren tots els objectius i actuacions:
  // es calculen un cop per canvi, no un cop per dibuixat.
  const totals = useMemo(() => ({
    gener: { total: mitjanaValoracio(valoracio, 'gener'), p: pendentsValoracio(valoracio, 'gener') },
    juny: { total: mitjanaValoracio(valoracio, 'juny'), p: pendentsValoracio(valoracio, 'juny') },
  }), [valoracio])

  if (!nom.trim()) {
    return (
      <p style={{ marginTop: 16, fontSize: 13, color: 'var(--ink-soft)' }}>
        Escriu o tria un nom de cicle/comissió/equip per començar (o continuar) la valoració.
      </p>
    )
  }
  if (carregant) return <p style={{ marginTop: 16 }}>Carregant…</p>

  return (
    <>
      {desant && <span style={{ fontSize: 12, color: 'var(--ink-soft)', display: 'block', marginTop: 8 }}>Desant…</span>}
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

            <div style={{ display: 'flex', gap: 24, marginTop: 16, fontSize: 13, flexWrap: 'wrap' }}>
              {['gener', 'juny'].map((camp) => {
                const { total, p } = totals[camp]
                return (
                  <span key={camp}>
                    TOTAL GENERAL — {camp === 'gener' ? 'Gener' : 'Juny'}:{' '}
                    <strong>{total !== null ? `${Math.round(total)}%` : '—'}</strong>
                    {p.total - p.valorats > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                        {' '}({p.total - p.valorats} sense valorar, compten 0)
                      </span>
                    )}
                  </span>
                )
              })}
            </div>

            <p style={{ fontSize: 13, fontWeight: 600, marginTop: 24 }}>Objectius</p>
            {/* La plantilla, a dalt: amb deu objectius i les seves
                actuacions, al final del tot no la trobava ningú. */}
            <div className="caixa-discreta" style={{ marginTop: 14 }}>
              <strong style={{ fontSize: 13 }}>Carrega els objectius d'una plantilla</strong>
              <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4, maxWidth: '100%' }}>
                Puja el full de valoració del centre i l'app en treu els objectius, les actuacions
                i l'escala de cada una. Des del Google Sheets: Fitxer → Baixa → Microsoft Excel.
              </p>
              <BotoDrive
                onFitxer={(e) => pujaPlantilla(e.target.files?.[0])}
                tipus="fulls"
                etiqueta="Tria la plantilla del Drive"
                onError={setErrorPlantilla}
                disabled={llegintPlantilla}
              />
              <label
                className="btn-ghost"
                style={{ display: 'inline-block', marginTop: 8, color: 'var(--navy)', borderColor: 'var(--navy)', border: '1px solid', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
              >
                {llegintPlantilla ? 'Llegint…' : 'Puja la plantilla Excel'}
                <input
                  type="file"
                  accept=".xlsx"
                  style={{ display: 'none' }}
                  onChange={(e) => { pujaPlantilla(e.target.files?.[0]); e.target.value = '' }}
                />
              </label>

              {errorPlantilla && (
                <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>{errorPlantilla}</p>
              )}

              {plantilla && (
                <div className="placeholder-box" style={{ marginTop: 12, padding: '12px 14px' }}>
                  <strong style={{ fontSize: 13 }}>
                    {plantilla.valoracio.nom ? `${plantilla.valoracio.nom} — ` : ''}
                    {plantilla.valoracio.objectius.length} objectius
                  </strong>
                  {plantilla.avisos.length > 0 && (
                    <ul style={{ fontSize: 12, color: 'var(--amber-dark)', marginTop: 6, paddingLeft: 18 }}>
                      {plantilla.avisos.map((a, i) => <li key={i}>{a}</li>)}
                    </ul>
                  )}
                  <ul style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8, paddingLeft: 18, maxHeight: 220, overflowY: 'auto' }}>
                    {plantilla.valoracio.objectius.map((o, i) => (
                      <li key={i}>{o.text || '(sense text)'} — {o.actuacions.length} actuacions</li>
                    ))}
                  </ul>
                  <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 8 }}>
                    Això substituirà els objectius que hi ha ara en aquesta valoració.
                  </p>
                  <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={aplicaPlantilla}
                      style={{ background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
                    >
                      Carrega-ho
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlantilla(null)}
                      className="btn-ghost"
                      style={{ color: 'var(--navy)', borderColor: 'var(--navy)', maxWidth: 130, fontSize: 13 }}
                    >
                      Cancel·la
                    </button>
                  </div>
                </div>
              )}
            </div>


            {valoracio.objectius.map((objectiu, oi) => {
              // Un sol càlcul per objectiu: abans es refeia quatre vegades
              // a la mateixa línia, i amb una comissió de 60 actuacions es
              // notava a cada tecla.
              const p = pendentsObjectiu(objectiu, 'juny')
              const pendents = p.total - p.valorats
              return (
              <div key={objectiu.id} style={{ marginTop: 10, padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-soft)', minWidth: 20, marginTop: 8 }}>{oi + 1}.</span>
                  <textarea
                    value={objectiu.text}
                    onChange={(e) => actualitzaObjectiu(objectiu.id, { text: e.target.value })}
                    onBlur={() => desa(valoracio)}
                    rows={4}
                    placeholder="Text de l'objectiu"
                    style={{ flex: 1, minWidth: 220, minHeight: 90, border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px', fontSize: 13, lineHeight: 1.4, fontFamily: 'inherit' }}
                  />
                </div>
                {objectiu.actuacions.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, marginLeft: 30 }}>
                    <SelectorEstat
                      etiqueta="Gener"
                      valor={objectiu.gener}
                      escala={objectiu.escala ?? 'lliure'}
                      opcions={objectiu.opcions}
                      onCanvi={(v) => { const nova = actualitzaObjectiu(objectiu.id, { gener: v }); desa(nova) }}
                      onCanviEscala={(e) => { const nova = actualitzaObjectiu(objectiu.id, { escala: e }); desa(nova) }}
                    />
                    <SelectorEstat
                      etiqueta="Juny"
                      valor={objectiu.juny}
                      escala={objectiu.escala ?? 'lliure'}
                      opcions={objectiu.opcions}
                      onCanvi={(v) => { const nova = actualitzaObjectiu(objectiu.id, { juny: v }); desa(nova) }}
                    />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', marginTop: 6 }}>
                  {objectiu.actuacions.length > 0 && (
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                      TOTAL objectiu — Gener {mitjanaObjectiu(objectiu, 'gener') !== null ? `${Math.round(mitjanaObjectiu(objectiu, 'gener'))}%` : '—'} · Juny {mitjanaObjectiu(objectiu, 'juny') !== null ? `${Math.round(mitjanaObjectiu(objectiu, 'juny'))}%` : '—'}
                      {pendents > 0 && (
                        <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}>
                          {' '}· {pendents} sense valorar al juny
                        </span>
                      )}
                    </div>
                  )}
                  <button type="button" onClick={() => esborraObjectiu(objectiu.id)} style={{ background: 'none', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 6, padding: '4px 8px', fontSize: 11 }}>
                    Esborra objectiu
                  </button>
                </div>

                {objectiu.actuacions.map((actuacio) => (
                  <div key={actuacio.id} style={{ marginTop: 8, marginLeft: 28 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
                      <button type="button" onClick={() => esborraActuacio(objectiu.id, actuacio.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 11 }}>
                        ✕
                      </button>
                    </div>
                    {objectiu.recullDades && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                        {MOMENTS_DADES.map((m) => (
                          <label key={m.id} style={{ flex: 1, minWidth: 150 }}>
                            <span style={{ display: 'block', fontSize: 10, color: 'var(--ink-soft)' }}>
                              {objectiu.etiquetesDades?.[m.id] || m.label}
                            </span>
                            <textarea
                              rows={2}
                              value={actuacio.dades?.[m.id] ?? ''}
                              placeholder="Dada recollida"
                              onChange={(e) => actualitzaDadaActuacio(objectiu.id, actuacio.id, m.id, e.target.value)}
                              onBlur={() => desa(valoracio)}
                              style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 6, padding: '5px 8px', fontSize: 12, resize: 'vertical' }}
                            />
                          </label>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                      <SelectorEstat
                        etiqueta="Gener"
                        valor={actuacio.gener}
                        escala={actuacio.escala ?? 'execucio50'}
                        opcions={actuacio.opcions}
                        onCanvi={(v) => { const nova = actualitzaActuacio(objectiu.id, actuacio.id, { gener: v }); desa(nova) }}
                        onCanviEscala={(e) => { const nova = actualitzaActuacio(objectiu.id, actuacio.id, { escala: e }); desa(nova) }}
                      />
                      <SelectorEstat
                        etiqueta="Juny"
                        valor={actuacio.juny}
                        escala={actuacio.escala ?? 'execucio50'}
                        opcions={actuacio.opcions}
                        onCanvi={(v) => { const nova = actualitzaActuacio(objectiu.id, actuacio.id, { juny: v }); desa(nova) }}
                      />
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 10, marginLeft: 28, paddingTop: 8, borderTop: '1px dashed var(--line)' }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
                    <input
                      type="checkbox"
                      checked={!!objectiu.recullDades}
                      onChange={(e) => { const nova = actualitzaObjectiu(objectiu.id, { recullDades: e.target.checked }); desa(nova) }}
                    />
                    Aquest objectiu recull dades
                  </label>
                  <p style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                    Per als objectius on el full demana escriure xifres o textos (ajuts de menjador,
                    preus, nombre de monitors…). Les dades no compten al percentatge: el grau se
                    segueix marcant a part, com al full.
                  </p>
                  {objectiu.recullDades && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      {MOMENTS_DADES.map((m) => (
                        <label key={m.id} style={{ flex: 1, minWidth: 150 }}>
                          <span style={{ display: 'block', fontSize: 10, color: 'var(--ink-soft)' }}>
                            Títol de la columna «{m.label}»
                          </span>
                          <input
                            type="text"
                            value={objectiu.etiquetesDades?.[m.id] ?? m.label}
                            onChange={(e) => actualitzaEtiquetaDades(objectiu.id, m.id, e.target.value)}
                            onBlur={() => desa(valoracio)}
                            style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 11 }}
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => afegeixActuacio(objectiu.id)}
                  className="btn-ghost"
                  style={{ marginTop: 8, marginLeft: 28, fontSize: 11, padding: '3px 8px', maxWidth: 200 }}
                >
                  + Afegeix actuació (opcional)
                </button>
              </div>
            )
            })}
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
    </>
  )
}
