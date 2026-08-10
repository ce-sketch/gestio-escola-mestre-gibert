import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../firebase'
import { cursEscolarActual } from '../../lib/cursEscolar'
import { CATEGORIES_VALORACIO, FESTES, valoracioBuida } from '../../lib/valoracions'

export default function Documentacio() {
  const [cursEscolarId] = useState(cursEscolarActual())
  const [categoria, setCategoria] = useState(CATEGORIES_VALORACIO[0].id)
  const [valoracio, setValoracio] = useState(valoracioBuida())
  const [carregant, setCarregant] = useState(true)
  const [desant, setDesant] = useState(false)
  const [missatge, setMissatge] = useState(null)

  useEffect(() => {
    carrega()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoria])

  async function carrega() {
    setCarregant(true)
    setMissatge(null)
    try {
      const snap = await getDoc(doc(db, 'valoracions', `${cursEscolarId}__${categoria}`))
      setValoracio(snap.exists() ? { ...valoracioBuida(), ...snap.data() } : valoracioBuida())
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut carregar: ${err.message}` })
    } finally {
      setCarregant(false)
    }
  }

  async function desa(valoracioNova) {
    setDesant(true)
    setMissatge(null)
    try {
      await setDoc(doc(db, 'valoracions', `${cursEscolarId}__${categoria}`), {
        ...valoracioNova,
        categoria,
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

  function actualitza(canvis) {
    const nova = { ...valoracio, ...canvis }
    setValoracio(nova)
    return nova
  }

  function actualitzaFesta(festaId, valor) {
    const nova = { ...valoracio, festes: { ...valoracio.festes, [festaId]: valor } }
    setValoracio(nova)
    return nova
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
        <h3 style={{ marginTop: 4, fontSize: 18 }}>Valoració de cicle/comissió/equip i festes</h3>
        <p className="module-lead">
          Tria el teu cicle, comissió o equip, i valora'l (0-100%) igual que la valoració de
          cada festa del curs. Cada canvi es desa sol.
        </p>

        <label className="field" style={{ maxWidth: 280, marginTop: 12 }}>
          <span>Cicle / Comissió / Equip</span>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}
          >
            {CATEGORIES_VALORACIO.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>

        {carregant ? (
          <p style={{ marginTop: 16 }}>Carregant…</p>
        ) : (
          <>
            <div style={{ marginTop: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Valoració general del cicle/comissió/equip (%)
                <input
                  type="number" min={0} max={100}
                  value={valoracio.valCicleComissioEquips}
                  onChange={(e) => actualitza({ valCicleComissioEquips: e.target.value })}
                  onBlur={() => desa(valoracio)}
                  style={{ display: 'block', width: 100, marginTop: 6, border: '1px solid var(--line)', borderRadius: 6, padding: '6px 8px' }}
                />
              </label>
            </div>

            <p style={{ fontSize: 13, fontWeight: 600, marginTop: 24 }}>Valoració de cada festa (%)</p>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
              {FESTES.map((f) => (
                <label key={f.id} style={{ fontSize: 12 }}>
                  {f.label}
                  <input
                    type="number" min={0} max={100}
                    value={valoracio.festes[f.id]}
                    onChange={(e) => actualitzaFesta(f.id, e.target.value)}
                    onBlur={() => desa(valoracio)}
                    style={{ display: 'block', width: 90, marginTop: 4, border: '1px solid var(--line)', borderRadius: 6, padding: '6px 8px' }}
                  />
                </label>
              ))}
            </div>

            <label style={{ display: 'block', marginTop: 20, fontSize: 13, fontWeight: 600 }}>
              Comentaris (opcional)
              <textarea
                value={valoracio.comentaris}
                onChange={(e) => actualitza({ comentaris: e.target.value })}
                onBlur={() => desa(valoracio)}
                rows={3}
                style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid var(--line)', borderRadius: 8, padding: 10, fontFamily: 'inherit', fontSize: 13 }}
              />
            </label>

            {desant && <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8 }}>Desant…</p>}
            {missatge && (
              <p style={{ marginTop: 8, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
                {missatge.text}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
