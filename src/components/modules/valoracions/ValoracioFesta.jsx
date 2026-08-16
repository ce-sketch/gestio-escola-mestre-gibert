import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import { FESTES } from '../../../lib/valoracions'
import {
  GRUPS, NIVELLS_GRAU, TIPUS_GRUP, festaBuida, objectiuFestaBuit, activitatBuida,
  normalitzaFesta, mitjanaObjectiu, mitjanaGrup, mitjanaGeneralFesta,
} from '../../../lib/festesDetall'
import {
  CURS_AMB_PLANTILLA as CURS_FESTES, FESTES_PLANTILLES_26_27, construeixFestaAmbPlantilla,
} from '../../../lib/festesPlantilles26_27'

const ETIQUETA_PES = {
  [TIPUS_GRUP.CICLE]: 'Pes dels cicles %',
  [TIPUS_GRUP.COORDINACIO]: 'Pes de l\u2019Equip de coordinació %',
  [TIPUS_GRUP.DIRECTIU]: 'Pes de l\u2019Equip Directiu %',
}

/**
 * Valoració d'una festa. Cada grup (els quatre cicles, l'Equip Directiu i
 * l'Equip de coordinació) té **els seus propis objectius**, perquè al full
 * del centre no són els mateixos: els cicles comparteixen els de la festa i
 * l'Equip Directiu en té de seus.
 */
export default function ValoracioFesta({ cursEscolarId, festaId, etiquetaFesta }) {
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
        // Les festes desades amb el model vell es reparteixen soles.
        setFesta(normalitzaFesta(snap.data().festa))
      } else if (cursEscolarId === CURS_FESTES && FESTES_PLANTILLES_26_27[festaId]) {
        setFesta(construeixFestaAmbPlantilla(FESTES_PLANTILLES_26_27[festaId]))
      } else {
        const label = etiquetaFesta ?? FESTES.find((f) => f.id === festaId)?.label ?? festaId
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

  function actualitzaPes(tipus, valor) {
    return actualitzaFesta({ pesos: { ...festa.pesos, [tipus]: valor } })
  }

  /** Tot el que es toca dins d'un grup passa per aquí: canviar un objectiu,
   *  una activitat o els comentaris. Així només hi ha un lloc que sàpiga
   *  com està muntada l'estructura. */
  function canviaGrup(grupNom, fesAmbObjectius) {
    const nova = {
      ...festa,
      grups: festa.grups.map((g) => g.nom === grupNom ? { ...g, objectius: fesAmbObjectius(g.objectius) } : g),
    }
    setFesta(nova)
    return nova
  }

  function actualitzaObjectiu(grupNom, objectiuId, canvis) {
    return canviaGrup(grupNom, (objectius) => objectius.map((o) => o.id === objectiuId ? { ...o, ...canvis } : o))
  }

  function afegeixObjectiu(grupNom) {
    desaFesta(canviaGrup(grupNom, (objectius) => [...objectius, objectiuFestaBuit(0)]))
  }

  function esborraObjectiu(grupNom, objectiuId, text) {
    if (text?.trim() && !window.confirm(`Segur que vols esborrar l'objectiu «${text.slice(0, 60)}» i les seves activitats?`)) return
    desaFesta(canviaGrup(grupNom, (objectius) => objectius.filter((o) => o.id !== objectiuId)))
  }

  function actualitzaActivitat(grupNom, objectiuId, activitatId, canvis) {
    return canviaGrup(grupNom, (objectius) => objectius.map((o) => o.id !== objectiuId ? o : {
      ...o,
      activitats: o.activitats.map((a) => a.id === activitatId ? { ...a, ...canvis } : a),
    }))
  }

  function afegeixActivitat(grupNom, objectiuId) {
    desaFesta(canviaGrup(grupNom, (objectius) => objectius.map((o) => o.id !== objectiuId ? o : {
      ...o, activitats: [...o.activitats, activitatBuida()],
    })))
  }

  function esborraActivitat(grupNom, objectiuId, activitatId) {
    const grup = festa.grups.find((g) => g.nom === grupNom)
    const activitat = grup?.objectius.find((o) => o.id === objectiuId)?.activitats.find((a) => a.id === activitatId)
    if (activitat?.text?.trim() && !window.confirm(`Segur que vols esborrar «${activitat.text.slice(0, 60)}»?`)) return
    desaFesta(canviaGrup(grupNom, (objectius) => objectius.map((o) => o.id !== objectiuId ? o : {
      ...o, activitats: o.activitats.filter((a) => a.id !== activitatId),
    })))
  }

  if (!festaId) {
    return <p style={{ marginTop: 16, fontSize: 13, color: 'var(--ink-soft)' }}>Tria una festa per començar (o continuar) la valoració.</p>
  }
  if (carregant || !festa) return <p style={{ marginTop: 16 }}>Carregant…</p>

  const grup = festa.grups.find((g) => g.nom === grupObert) ?? festa.grups[0]
  const general = mitjanaGeneralFesta(festa)

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
          Grau d&apos;assoliment general: <strong>{general !== null ? `${Math.round(general)}%` : '—'}</strong>
        </div>
      </div>

      <p style={{ fontSize: 13, fontWeight: 600, marginTop: 20 }}>Pes de cada bloc</p>
      <p style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
        Els cicles fan mitjana entre ells i el resultat entra amb el seu pes. Un bloc amb pes 0
        no mou el resultat: és el cas de la coordinació mentre no avaluï.
      </p>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
        {[TIPUS_GRUP.CICLE, TIPUS_GRUP.COORDINACIO, TIPUS_GRUP.DIRECTIU].map((tipus) => (
          <label key={tipus} style={{ fontSize: 12 }}>
            {ETIQUETA_PES[tipus]}
            <input
              type="number" min={0} max={100}
              value={festa.pesos?.[tipus] ?? 0}
              onChange={(e) => actualitzaPes(tipus, e.target.value)}
              onBlur={() => desaFesta(festa)}
              style={{ display: 'block', width: 80, marginTop: 2, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px' }}
            />
          </label>
        ))}
      </div>

      <p style={{ fontSize: 13, fontWeight: 600, marginTop: 24 }}>Desglossament per grup</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        {festa.grups.map((g) => {
          const valor = mitjanaGrup(festa, g.nom)
          return (
            <button
              key={g.nom}
              type="button"
              onClick={() => setGrupObert(g.nom)}
              className={grupObert === g.nom ? 'btn-primary' : 'btn-ghost'}
              style={grupObert === g.nom
                ? { fontSize: 12, padding: '6px 12px' }
                : { fontSize: 12, padding: '6px 12px', color: 'var(--navy)', borderColor: 'var(--navy)' }}
            >
              {g.nom} {valor !== null ? `(${Math.round(valor)}%)` : ''}
            </button>
          )
        })}
      </div>

      <div className="placeholder-box" style={{ marginTop: 12 }}>
        <p style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
          Els objectius d&apos;aquest apartat són els de <strong>{grup.nom}</strong>. Cada grup té els
          seus: al full del centre, l&apos;Equip Directiu no valora el mateix que els cicles.
        </p>

        {grup.objectius.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 10 }}>
            Aquest grup encara no té cap objectiu.
          </p>
        )}

        {grup.objectius.map((o, oi) => {
          const valor = mitjanaObjectiu(o)
          return (
            <div key={o.id} style={{ marginTop: oi === 0 ? 12 : 16, borderTop: oi === 0 ? 'none' : '1px dashed var(--line)', paddingTop: oi === 0 ? 0 : 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--ink-soft)', minWidth: 18, marginTop: 6 }}>{oi + 1}.</span>
                <textarea
                  value={o.text}
                  onChange={(e) => actualitzaObjectiu(grup.nom, o.id, { text: e.target.value })}
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
                    onChange={(e) => actualitzaObjectiu(grup.nom, o.id, { pes: e.target.value })}
                    onBlur={() => desaFesta(festa)}
                    style={{ display: 'block', width: 64, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 12 }}
                  />
                </label>
                <span style={{ fontSize: 12, marginTop: 6, minWidth: 44 }}>{valor !== null ? `${Math.round(valor)}%` : '—'}</span>
                <button
                  type="button"
                  onClick={() => esborraObjectiu(grup.nom, o.id, o.text)}
                  title="Esborra l'objectiu"
                  style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12, marginTop: 6 }}
                >
                  ✕
                </button>
              </div>

              {o.activitats.map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap', paddingLeft: 26 }}>
                  <input
                    type="text"
                    value={a.text}
                    placeholder="Activitat/Indicador"
                    onChange={(e) => actualitzaActivitat(grup.nom, o.id, a.id, { text: e.target.value })}
                    onBlur={() => desaFesta(festa)}
                    style={{ flex: 1, minWidth: 200, border: '1px solid var(--line)', borderRadius: 6, padding: '5px 8px', fontSize: 12 }}
                  />
                  <select
                    value={a.grau}
                    onChange={(e) => desaFesta(actualitzaActivitat(grup.nom, o.id, a.id, { grau: e.target.value }))}
                    style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '5px 6px', fontSize: 12 }}
                  >
                    <option value="">—</option>
                    {NIVELLS_GRAU.map((n) => <option key={n.id} value={n.valor}>{n.label}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => esborraActivitat(grup.nom, o.id, a.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 11 }}
                  >
                    ✕
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => afegeixActivitat(grup.nom, o.id)}
                className="btn-ghost"
                style={{ marginTop: 6, marginLeft: 26, fontSize: 11, padding: '3px 8px', maxWidth: 180 }}
              >
                + Afegeix activitat
              </button>

              <textarea
                value={o.comentaris}
                onChange={(e) => actualitzaObjectiu(grup.nom, o.id, { comentaris: e.target.value })}
                onBlur={() => desaFesta(festa)}
                rows={2}
                placeholder="Comentaris i propostes de millora (opcional)"
                style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid var(--line)', borderRadius: 6, padding: 8, fontFamily: 'inherit', fontSize: 12 }}
              />
            </div>
          )
        })}

        <button type="button" onClick={() => afegeixObjectiu(grup.nom)} className="btn-ghost" style={{ marginTop: 12, maxWidth: 220, fontSize: 12 }}>
          + Afegeix objectiu a {grup.nom}
        </button>
      </div>

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
          {missatge.text}
        </p>
      )}
    </>
  )
}
