import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../firebase'
import { cursEscolarActual } from '../../lib/cursEscolar'
import { objectiusPerDefecte, operatiuBuit, indicadorBuit, mitjanaOperatiu, mitjanaObjectiu, mitjanaGeneral } from '../../lib/pgac'
import { ESTATS_EXECUCIO, estatDe } from '../../lib/estatsExecucio'

function Barra({ valor }) {
  if (valor === null) return <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Sense dades</span>
  const color = valor >= 80 ? 'var(--green)' : valor >= 40 ? 'var(--amber-dark)' : 'var(--red)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 80, height: 8, borderRadius: 4, background: 'var(--line)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(valor, 100)}%`, height: '100%', background: color }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600 }}>{Math.round(valor)}%</span>
    </div>
  )
}

export default function Pgac() {
  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [objectius, setObjectius] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [desant, setDesant] = useState(false)
  const [missatge, setMissatge] = useState(null)
  const [objectiuObert, setObjectiuObert] = useState(0)

  useEffect(() => {
    carrega()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursEscolarId])

  async function carrega() {
    setCarregant(true)
    setMissatge(null)
    try {
      const snap = await getDoc(doc(db, 'pgac', cursEscolarId))
      if (snap.exists() && snap.data().objectius) {
        setObjectius(snap.data().objectius)
      } else {
        // Primera vegada: comencem amb les dades reals del document oficial.
        setObjectius(objectiusPerDefecte())
      }
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'han pogut carregar les dades: ${err.message}` })
    } finally {
      setCarregant(false)
    }
  }

  async function desa(objectiusNous) {
    setDesant(true)
    setMissatge(null)
    try {
      await setDoc(doc(db, 'pgac', cursEscolarId), {
        objectius: objectiusNous,
        actualitzatEl: serverTimestamp(),
        actualitzatPer: auth.currentUser?.email ?? null,
      })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar: ${err.message}` })
    } finally {
      setDesant(false)
    }
  }

  function actualitza(objectiuIndex, actualitzador) {
    const nous = objectius.map((o, i) => (i === objectiuIndex ? actualitzador(o) : o))
    setObjectius(nous)
    return nous
  }

  function onBlurDesa(nous) {
    desa(nous)
  }

  function canviaIndicador(objectiuIndex, operatiuId, indicadorId, camp, valor) {
    return actualitza(objectiuIndex, (o) => ({
      ...o,
      operatius: o.operatius.map((op) => op.id !== operatiuId ? op : {
        ...op,
        indicadors: op.indicadors.map((ind) => ind.id !== indicadorId ? ind : { ...ind, [camp]: valor }),
      }),
    }))
  }

  function afegeixOperatiu(objectiuIndex) {
    const nous = actualitza(objectiuIndex, (o) => ({
      ...o,
      operatius: [...o.operatius, operatiuBuit(`${objectiuIndex + 1}.${o.operatius.length + 1}`)],
    }))
    desa(nous)
  }

  function afegeixIndicador(objectiuIndex, operatiuId) {
    const nous = actualitza(objectiuIndex, (o) => ({
      ...o,
      operatius: o.operatius.map((op) => op.id !== operatiuId ? op : { ...op, indicadors: [...op.indicadors, indicadorBuit()] }),
    }))
    desa(nous)
  }

  function esborraIndicador(objectiuIndex, operatiuId, indicadorId) {
    const nous = actualitza(objectiuIndex, (o) => ({
      ...o,
      operatius: o.operatius.map((op) => op.id !== operatiuId ? op : { ...op, indicadors: op.indicadors.filter((ind) => ind.id !== indicadorId) }),
    }))
    desa(nous)
  }

  if (carregant) return <p>Carregant…</p>

  return (
    <div>
      <p className="module-lead">
        Seguiment de la Programació General Anual de Centre (PGAC): els 3 Objectius Estratègics
        del Projecte de Direcció, desglossats en Estratègia → Operatius → Indicadors, amb el
        percentatge de compliment a Gener i a Juny. Cada canvi es desa sol.
      </p>

      <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="field" style={{ maxWidth: 160 }}>
          <span>Curs escolar</span>
          <input
            type="text"
            value={cursEscolarId}
            onChange={(e) => setCursEscolarId(e.target.value)}
            style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontWeight: 600 }}
          />
        </label>
        {desant && <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Desant…</span>}
      </div>

      <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
        <div>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Compliment general — Gener</span>
          <Barra valor={mitjanaGeneral(objectius, 'gener')} />
        </div>
        <div>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Compliment general — Juny</span>
          <Barra valor={mitjanaGeneral(objectius, 'juny')} />
        </div>
      </div>

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
          {missatge.text}
        </p>
      )}

      <div style={{ marginTop: 20 }}>
        {objectius.map((objectiu, objectiuIndex) => {
          const obert = objectiuObert === objectiuIndex
          return (
            <div key={objectiu.id} className="placeholder-box" style={{ marginTop: 10, padding: 0, overflow: 'hidden' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', flexWrap: 'wrap', gap: 8 }}
                onClick={() => setObjectiuObert(obert ? null : objectiuIndex)}
              >
                <strong>{objectiu.titol}</strong>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                  <Barra valor={mitjanaObjectiu(objectiu, 'gener')} />
                  <Barra valor={mitjanaObjectiu(objectiu, 'juny')} />
                  <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{obert ? '▲' : '▼'}</span>
                </div>
              </div>

              {obert && (
                <div style={{ padding: '4px 16px 16px', borderTop: '1px solid var(--line)' }}>
                  <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 10 }}>{objectiu.descripcio}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, marginTop: 10 }}>{objectiu.estrategiaTitol}</p>
                  <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{objectiu.estrategiaText}</p>

                  {objectiu.operatius.map((op) => (
                    <div key={op.id} style={{ marginTop: 16, borderTop: '1px dashed var(--line)', paddingTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <strong style={{ fontSize: 13 }}>{op.titol}</strong>
                        <div style={{ display: 'flex', gap: 16 }}>
                          <Barra valor={mitjanaOperatiu(op, 'gener')} />
                          <Barra valor={mitjanaOperatiu(op, 'juny')} />
                        </div>
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>{op.text}</p>

                      {op.indicadors.map((ind) => (
                        <div key={ind.id} style={{ marginTop: 10, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <input
                              type="text"
                              value={ind.text}
                              placeholder="Text de l'indicador"
                              onChange={(e) => canviaIndicador(objectiuIndex, op.id, ind.id, 'text', e.target.value)}
                              onBlur={() => onBlurDesa(objectius)}
                              style={{ flex: 1, minWidth: 220, border: '1px solid var(--line)', borderRadius: 6, padding: '6px 8px', fontSize: 12 }}
                            />
                            <button
                              type="button"
                              onClick={() => esborraIndicador(objectiuIndex, op.id, ind.id)}
                              style={{ background: 'none', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 6, padding: '4px 8px', fontSize: 11 }}
                            >
                              Esborra
                            </button>
                          </div>

                          {[{ camp: 'gener', etiqueta: 'Gener' }, { camp: 'juny', etiqueta: 'Juny' }].map(({ camp, etiqueta }) => {
                            const estatActual = estatDe(ind[camp])
                            return (
                              <div key={camp} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 11, color: 'var(--ink-soft)', minWidth: 40 }}>{etiqueta}</span>
                                {ESTATS_EXECUCIO.map((e) => (
                                  <button
                                    key={e.id}
                                    type="button"
                                    onClick={() => { const nous = canviaIndicador(objectiuIndex, op.id, ind.id, camp, e.valor); onBlurDesa(nous) }}
                                    style={{
                                      fontSize: 11, padding: '4px 10px', borderRadius: 6,
                                      border: `1px solid ${estatActual?.id === e.id ? 'var(--navy)' : 'var(--line)'}`,
                                      background: estatActual?.id === e.id ? 'var(--navy)' : 'transparent',
                                      color: estatActual?.id === e.id ? '#fff' : 'var(--ink)',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {e.label}
                                  </button>
                                ))}
                                <input
                                  type="number" min={0} max={100}
                                  value={ind[camp]}
                                  onChange={(e) => canviaIndicador(objectiuIndex, op.id, ind.id, camp, e.target.value)}
                                  onBlur={() => onBlurDesa(objectius)}
                                  title="Si l'indicador té una escala pròpia (per exemple '2 Cicles = 66%'), escriu aquí el número exacte"
                                  style={{ width: 56, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 11, marginLeft: 4 }}
                                />
                                <span style={{ fontSize: 10, color: 'var(--ink-soft)' }}>%</span>
                              </div>
                            )
                          })}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => afegeixIndicador(objectiuIndex, op.id)}
                        className="btn-ghost"
                        style={{ marginTop: 8, fontSize: 12, padding: '4px 10px', maxWidth: 180 }}
                      >
                        + Afegeix indicador
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => afegeixOperatiu(objectiuIndex)}
                    className="btn-ghost"
                    style={{ marginTop: 16, color: 'var(--navy)', borderColor: 'var(--navy)', maxWidth: 200 }}
                  >
                    + Afegeix operatiu
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
