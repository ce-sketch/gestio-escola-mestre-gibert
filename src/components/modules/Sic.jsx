import { useEffect, useMemo, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../firebase'
import { cursEscolarActual } from '../../lib/cursEscolar'
import {
  UNITATS, blocsPerDefecte, normalitzaBlocs, fusionaValors,
  progres, progresSeccio, variacio, totsElsIndicadors, indicadorBuit,
} from '../../lib/sic'
import { llegeixPlantillaSic, fullsDe } from '../../lib/sicPlantillaParser'
import BotoDrive from '../BotoDrive'

const sufixDe = (unitat) => UNITATS.find((u) => u.id === unitat)?.sufix ?? ''

/** La fletxa de la variació. Verd/vermell no volen dir "bo"/"dolent": un
 *  índex d'absències que baixa és una bona notícia, i un de superació que
 *  baixa no ho és. Per això només es marca la direcció, sense color de
 *  judici. */
function Variacio({ indicador }) {
  const v = variacio(indicador)
  if (v === null || v === 0) return null
  return (
    <span style={{ fontSize: 11, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
      {v > 0 ? '▲' : '▼'} {Math.abs(v)}{sufixDe(indicador.unitat)}
    </span>
  )
}

export default function Sic() {
  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [blocs, setBlocs] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [desant, setDesant] = useState(false)
  const [missatge, setMissatge] = useState(null)
  const [oberts, setOberts] = useState({})
  const [cerca, setCerca] = useState('')
  const [nomesBuits, setNomesBuits] = useState(false)
  // Previsualització d'una llista pujada, abans de substituir res.
  const [proposta, setProposta] = useState(null)
  const [llegint, setLlegint] = useState(false)

  useEffect(() => {
    carrega()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursEscolarId])

  async function carrega() {
    setCarregant(true)
    setMissatge(null)
    setProposta(null)
    try {
      const snap = await getDoc(doc(db, 'sic', cursEscolarId))
      if (snap.exists() && Array.isArray(snap.data().blocs) && snap.data().blocs.length > 0) {
        setBlocs(normalitzaBlocs(snap.data().blocs))
      } else {
        // Cap dada d'aquest curs: es parteix de la llista del curs passat,
        // que és el més calcat al que caldrà omplir. No es desa res fins
        // que no ho digui l'usuari.
        setBlocs(blocsPerDefecte())
      }
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'han pogut carregar els indicadors: ${err.message}` })
    } finally {
      setCarregant(false)
    }
  }

  async function desa() {
    setDesant(true)
    setMissatge(null)
    try {
      await setDoc(doc(db, 'sic', cursEscolarId), {
        cursEscolar: cursEscolarId,
        blocs,
        actualitzatEl: serverTimestamp(),
        actualitzatPer: auth.currentUser?.email ?? null,
      }, { merge: true })
      setMissatge({ type: 'ok', text: 'Indicadors desats.' })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar: ${err.message}` })
    } finally {
      setDesant(false)
    }
  }

  // ── Pujar la llista d'un curs nou ───────────────────────────────────
  async function pujaLlista(e, nomFull = null) {
    const fitxer = e?.target?.files?.[0] ?? proposta?.fitxer
    if (!fitxer) return
    setLlegint(true)
    setMissatge(null)
    try {
      const buffer = await fitxer.arrayBuffer()
      const resultat = await llegeixPlantillaSic(buffer, nomFull ? { nomFull } : {})
      const fusio = fusionaValors(resultat.blocs, blocs)
      setProposta({
        fitxer,
        full: resultat.full,
        fulls: await fullsDe(buffer),
        blocs: fusio.blocs,
        avisos: [...resultat.avisos, ...fusio.avisos],
        reaprofitats: fusio.reaprofitats,
        valorsLlegits: resultat.valors,
      })
    } catch (err) {
      setMissatge({ type: 'error', text: err.message })
      setProposta(null)
    } finally {
      setLlegint(false)
    }
  }

  function aplicaProposta() {
    setBlocs(proposta.blocs)
    setProposta(null)
    setMissatge({
      type: 'ok',
      text: 'Llista substituïda. Encara no s\'ha desat: repassa-la i prem "Desa els indicadors".',
    })
  }

  // ── Edició ──────────────────────────────────────────────────────────
  function canviaIndicador(blocId, seccioId, indicadorId, camp, valor) {
    setBlocs((actuals) => actuals.map((bloc) => (bloc.id !== blocId ? bloc : {
      ...bloc,
      seccions: bloc.seccions.map((seccio) => (seccio.id !== seccioId ? seccio : {
        ...seccio,
        indicadors: seccio.indicadors.map((i) => (i.id !== indicadorId ? i : { ...i, [camp]: valor })),
      })),
    })))
  }

  function afegeixIndicador(blocId, seccioId) {
    setBlocs((actuals) => actuals.map((bloc) => (bloc.id !== blocId ? bloc : {
      ...bloc,
      seccions: bloc.seccions.map((seccio) => (seccio.id !== seccioId ? seccio : {
        ...seccio, indicadors: [...seccio.indicadors, indicadorBuit('', '')],
      })),
    })))
  }

  function esborraIndicador(blocId, seccioId, indicadorId) {
    setBlocs((actuals) => actuals.map((bloc) => (bloc.id !== blocId ? bloc : {
      ...bloc,
      seccions: bloc.seccions.map((seccio) => (seccio.id !== seccioId ? seccio : {
        ...seccio, indicadors: seccio.indicadors.filter((i) => i.id !== indicadorId),
      })),
    })))
  }

  // ── Filtre ──────────────────────────────────────────────────────────
  const blocsVisibles = useMemo(() => {
    const q = cerca.trim().toLowerCase()
    if (!q && !nomesBuits) return blocs
    return blocs
      .map((bloc) => ({
        ...bloc,
        seccions: bloc.seccions
          .map((seccio) => ({
            ...seccio,
            indicadors: seccio.indicadors.filter((i) => {
              if (nomesBuits && String(i.valor ?? '').trim() !== '') return false
              if (!q) return true
              return `${i.codi} ${i.text}`.toLowerCase().includes(q)
                || `${seccio.codi} ${seccio.titol}`.toLowerCase().includes(q)
            }),
          }))
          .filter((seccio) => seccio.indicadors.length > 0),
      }))
      .filter((bloc) => bloc.seccions.length > 0)
  }, [blocs, cerca, nomesBuits])

  const total = useMemo(() => progres(blocs), [blocs])

  function copiaAlPortapapers() {
    const linies = ['Codi\tIndicador\tValor\tCurs anterior\tNota']
    for (const bloc of blocs) {
      for (const seccio of bloc.seccions) {
        for (const i of seccio.indicadors) {
          linies.push([i.codi, i.text, i.valor, i.valorAnterior, i.nota].join('\t'))
        }
      }
    }
    navigator.clipboard.writeText(linies.join('\n')).then(
      () => setMissatge({ type: 'ok', text: `${totsElsIndicadors(blocs).length} indicadors copiats: ja els pots enganxar a un full de càlcul.` }),
      () => setMissatge({ type: 'error', text: 'El navegador no ha deixat copiar-ho.' })
    )
  }

  if (carregant) return <p>Carregant…</p>

  return (
    <div className="module">
      <p className="module-lead">
        Sistema d&apos;Indicadors de Centre: la llista d&apos;indicadors que es lliura cada curs.
        Com que la llista canvia d&apos;un any a l&apos;altre, es pot substituir pujant l&apos;Excel
        del curs nou — els valors ja introduïts es conserven com a comparació.
      </p>

      <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="field" style={{ maxWidth: 130 }}>
          <span>Curs escolar</span>
          <input type="text" value={cursEscolarId} onChange={(e) => setCursEscolarId(e.target.value)}
            className="camp camp-petit" style={{ fontWeight: 600 }} />
        </label>
        <label className="field" style={{ minWidth: 220, flex: 1 }}>
          <span>Cerca</span>
          <input type="text" value={cerca} onChange={(e) => setCerca(e.target.value)}
            placeholder="absències, matemàtiques, 2.5…" className="camp camp-petit" />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, paddingBottom: 8 }}>
          <input type="checkbox" checked={nomesBuits} onChange={(e) => setNomesBuits(e.target.checked)} />
          Només els que falten
        </label>
      </div>

      {/* ── Progrés ─────────────────────────────────────────────────── */}
      <div className="caixa-discreta" style={{ marginTop: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 140, height: 8, borderRadius: 4, background: 'var(--line)', overflow: 'hidden' }}>
          <div style={{ width: `${total.percentatge}%`, height: '100%', background: 'var(--green)' }} />
        </div>
        <span style={{ fontSize: 13 }}>
          <strong>{total.omplerts}</strong> de {total.total} indicadors omplerts ({total.percentatge}%)
        </span>
        <button type="button" onClick={desa} disabled={desant} className="btn-primary" style={{ marginLeft: 'auto' }}>
          {desant ? 'Desant…' : 'Desa els indicadors'}
        </button>
        <button type="button" onClick={copiaAlPortapapers} className="btn-ghost">
          Copia-ho per al full de càlcul
        </button>
      </div>

      {missatge && (
        <p style={{ fontSize: 12, marginTop: 10, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
          {missatge.text}
        </p>
      )}

      {/* ── Pujar la llista d'un curs nou ───────────────────────────── */}
      <div className="caixa-discreta" style={{ marginTop: 18 }}>
        <strong style={{ fontSize: 14 }}>Llista d&apos;indicadors del curs</strong>
        <p className="nota">
          Si el Departament ha canviat la llista, puja l&apos;Excel del curs nou. Es llegeixen
          els codis (1.1, 1.1.1…) i el text de cada indicador. Els valors que ja tinguis
          desats es casen <strong>pel codi</strong> i passen a la columna &quot;curs anterior&quot;;
          els indicadors que desapareguin es diuen, no es col·loquen enlloc.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <BotoDrive
            onFitxer={pujaLlista}
            onError={(text) => setMissatge({ type: 'error', text })}
            disabled={llegint}
            tipus="fulls"
            etiqueta="Tria l'Excel del Drive"
          />
          <label className="btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', cursor: llegint ? 'wait' : 'pointer' }}>
            {llegint ? 'Llegint…' : '📤 Puja l\'Excel'}
            <input type="file" accept=".xlsx,.xlsm" style={{ display: 'none' }} disabled={llegint}
              onChange={(e) => { pujaLlista(e); e.target.value = '' }} />
          </label>
        </div>

        {proposta && (
          <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <strong style={{ fontSize: 13 }}>
              Full &quot;{proposta.full}&quot; · {totsElsIndicadors(proposta.blocs).length} indicadors
              {proposta.reaprofitats > 0 && (
                <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}>
                  {' '}· {proposta.reaprofitats} valors del curs actual passen a la columna de comparació
                </span>
              )}
            </strong>
            {proposta.fulls.length > 1 && (
              <label className="field" style={{ maxWidth: 260, marginTop: 8 }}>
                <span>Full a llegir</span>
                <select value={proposta.full} className="camp camp-petit"
                  onChange={(e) => pujaLlista(null, e.target.value)}>
                  {proposta.fulls.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
            )}
            {proposta.avisos.map((a, i) => <p key={i} className="nota nota-avis">{a}</p>)}

            <div style={{ maxHeight: 220, overflow: 'auto', marginTop: 8, border: '1px solid var(--line)', borderRadius: 8 }}>
              <table className="taula-dades" style={{ fontSize: 12 }}>
                <tbody>
                  {proposta.blocs.map((bloc) => (
                    bloc.seccions.map((seccio) => (
                      <tr key={seccio.id}>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--ink-soft)' }}>{seccio.codi}</td>
                        <td>{seccio.titol || <em style={{ color: 'var(--ink-soft)' }}>sense títol</em>}</td>
                        <td className="num">{seccio.indicadors.length}</td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" onClick={aplicaProposta} className="btn-primary" style={{ maxWidth: 220 }}>
                Fes servir aquesta llista
              </button>
              <button type="button" onClick={() => setProposta(null)} className="btn-ghost">Cancel·la</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Els indicadors ──────────────────────────────────────────── */}
      {blocsVisibles.length === 0 && (
        <p className="nota" style={{ marginTop: 20 }}>
          {cerca || nomesBuits ? 'Cap indicador coincideix amb el filtre.' : 'Encara no hi ha cap indicador.'}
        </p>
      )}

      {blocsVisibles.map((bloc) => (
        <div key={bloc.id} style={{ marginTop: 26 }}>
          <h3 style={{ fontSize: 16, marginBottom: 4 }}>{bloc.codi}. {bloc.titol}</h3>

          {bloc.seccions.map((seccio) => {
            const p = progresSeccio(seccio)
            const obert = oberts[seccio.id] ?? true
            return (
              <div key={seccio.id} style={{ marginTop: 10, border: '1px solid var(--line)', borderRadius: 10 }}>
                <button
                  type="button"
                  onClick={() => setOberts((o) => ({ ...o, [seccio.id]: !obert }))}
                  style={{
                    width: '100%', textAlign: 'left', background: 'none', border: 'none',
                    padding: '10px 12px', cursor: 'pointer', display: 'flex', gap: 8,
                    alignItems: 'center', fontSize: 13, fontWeight: 600,
                  }}
                >
                  <span style={{ color: 'var(--ink-soft)', fontSize: 11 }}>{obert ? '▾' : '▸'}</span>
                  <span style={{ color: 'var(--ink-soft)' }}>{seccio.codi}</span>
                  <span>{seccio.titol}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: 11, color: 'var(--ink-soft)' }}>
                    {p.omplerts}/{p.total}
                  </span>
                </button>

                {obert && (
                  <div style={{ padding: '0 12px 12px' }}>
                    <table className="taula-dades" style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th style={{ width: 70 }}>Codi</th>
                          <th>Indicador</th>
                          <th style={{ width: 110 }}>Unitat</th>
                          <th style={{ width: 110 }}>Valor</th>
                          <th style={{ width: 110 }}>Curs anterior</th>
                          <th>Nota</th>
                          <th style={{ width: 30 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {seccio.indicadors.map((i) => (
                          <tr key={i.id}>
                            <td style={{ color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{i.codi || '—'}</td>
                            <td>{i.text}</td>
                            <td>
                              <select
                                value={i.unitat}
                                onChange={(e) => canviaIndicador(bloc.id, seccio.id, i.id, 'unitat', e.target.value)}
                                className="camp camp-petit" style={{ fontSize: 11 }}
                              >
                                {UNITATS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                              </select>
                            </td>
                            <td>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <input
                                  type={i.unitat === 'text' ? 'text' : 'number'}
                                  step="any"
                                  value={i.valor}
                                  onChange={(e) => canviaIndicador(bloc.id, seccio.id, i.id, 'valor', e.target.value)}
                                  className="camp camp-petit" style={{ width: 70 }}
                                />
                                <span style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{sufixDe(i.unitat)}</span>
                              </span>
                            </td>
                            <td style={{ color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
                              {i.valorAnterior !== '' ? `${i.valorAnterior}${sufixDe(i.unitat)}` : '—'}
                              {' '}<Variacio indicador={i} />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={i.nota}
                                onChange={(e) => canviaIndicador(bloc.id, seccio.id, i.id, 'nota', e.target.value)}
                                className="camp camp-petit" style={{ width: '100%' }}
                                placeholder="d'on surt la dada, matisos…"
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => esborraIndicador(bloc.id, seccio.id, i.id)}
                                title="Treu aquest indicador de la llista"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-soft)', fontSize: 14 }}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button
                      type="button"
                      onClick={() => afegeixIndicador(bloc.id, seccio.id)}
                      className="btn-ghost"
                      style={{ marginTop: 8, fontSize: 11, padding: '3px 10px' }}
                    >
                      + Afegeix un indicador
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
