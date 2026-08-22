import { useEffect, useMemo, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../firebase'
import { cursEscolarActual } from '../../lib/cursEscolar'
import {
  objectiusPerDefecte, operatiuBuit, indicadorBuit, normalitzaObjectius,
  resultatOperatiu, resultatObjectiu, resultatGeneral,
} from '../../lib/pgac'
import { ESCALES, escalaDe, opcioDe, opcionsDe } from '../../lib/escales'
import { llegeixPlantillaPgac } from '../../lib/pgacPlantillaParser'
import BotoDrive from '../BotoDrive'
import { exportaPgacExcel, exportaPgacPDF } from '../../lib/pgacExport'

function Barra({ resultat, etiqueta }) {
  if (!resultat || resultat.valor === null) {
    return <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Sense dades</span>
  }
  const v = resultat.valor
  const color = v >= 80 ? 'var(--green)' : v >= 40 ? 'var(--amber-dark)' : 'var(--red)'
  const pendents = resultat.total - resultat.valorats
  return (
    <div>
      {etiqueta && <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{etiqueta}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 80, height: 8, borderRadius: 4, background: 'var(--line)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(Math.max(v, 0), 100)}%`, height: '100%', background: color }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{Math.round(v)}%</span>
      </div>
      {pendents > 0 && (
        <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>
          {pendents} sense valorar (compten 0)
        </div>
      )}
    </div>
  )
}

function CampPes({ valor, onChange, onBlur, titol }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }} title={titol}>
      <input
        type="number" min={0} max={100} step={0.1}
        value={valor ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        style={{ width: 52, border: '1px solid var(--line)', borderRadius: 6, padding: '3px 5px', fontSize: 11, textAlign: 'right' }}
      />
      <span style={{ fontSize: 10, color: 'var(--ink-soft)' }}>%</span>
    </span>
  )
}

function AvisPesos({ pesTotal, onReparteix }) {
  if (Math.abs(pesTotal - 100) < 0.5) return null
  return (
    <div style={{ fontSize: 11, color: 'var(--amber-dark)', marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span>Els pesos sumen {pesTotal}%, no 100% — el resultat quedarà per sobre o per sota del que toca.</span>
      <button
        type="button"
        onClick={onReparteix}
        style={{ background: 'none', border: '1px solid var(--amber-dark)', color: 'var(--amber-dark)', borderRadius: 6, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}
      >
        Reparteix a parts iguals
      </button>
    </div>
  )
}

export default function Pgac() {
  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [objectius, setObjectius] = useState([])
  const [descarregant, setDescarregant] = useState(null) // 'excel' | 'pdf' | null
  const [carregant, setCarregant] = useState(true)
  const [desant, setDesant] = useState(false)
  const [missatge, setMissatge] = useState(null)
  const [objectiuObert, setObjectiuObert] = useState(0)
  // Operatius buits (reservats per si algun any calen més) que s'han
  // desplegat manualment per omplir-los — per defecte queden amagats,
  // com ja passava a la plantilla original.
  const [operatiusBuitsMostrats, setOperatiusBuitsMostrats] = useState(new Set())
  const [importacio, setImportacio] = useState(null)
  const [cursOrigen, setCursOrigen] = useState('')
  const [important, setImportant] = useState(false)

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
        // normalitzaObjectius afegeix els pesos als documents desats abans
        // que existissin, repartint-los a parts iguals.
        setObjectius(normalitzaObjectius(snap.data().objectius))
      } else {
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

  function canviaOperatiu(objectiuIndex, operatiuId, camp, valor) {
    return actualitza(objectiuIndex, (o) => ({
      ...o,
      operatius: o.operatius.map((op) => (op.id !== operatiuId ? op : { ...op, [camp]: valor })),
    }))
  }

  function canviaIndicador(objectiuIndex, operatiuId, indicadorId, camp, valor) {
    return actualitza(objectiuIndex, (o) => ({
      ...o,
      operatius: o.operatius.map((op) => op.id !== operatiuId ? op : {
        ...op,
        indicadors: op.indicadors.map((ind) => (ind.id !== indicadorId ? ind : { ...ind, [camp]: valor })),
      }),
    }))
  }

  function canviaCompetencies(objectiuIndex, camp, valor) {
    return actualitza(objectiuIndex, (o) => ({
      ...o,
      competencies: { ...o.competencies, [camp]: valor },
    }))
  }

  function reparteixIndicadors(objectiuIndex, operatiuId) {
    const nous = actualitza(objectiuIndex, (o) => ({
      ...o,
      operatius: o.operatius.map((op) => {
        if (op.id !== operatiuId || op.indicadors.length === 0) return op
        const n = op.indicadors.length
        const base = Math.round((100 / n) * 10) / 10
        return {
          ...op,
          indicadors: op.indicadors.map((ind, idx) => ({
            ...ind,
            pesGlobal: idx === n - 1 ? Math.round((100 - base * (n - 1)) * 10) / 10 : base,
          })),
        }
      }),
    }))
    desa(nous)
  }

  function reparteixOperatius(objectiuIndex) {
    const nous = actualitza(objectiuIndex, (o) => {
      const n = o.operatius.length
      if (n === 0) return o
      const base = Math.round((100 / n) * 10) / 10
      return {
        ...o,
        operatius: o.operatius.map((op, idx) => ({
          ...op,
          pes: idx === n - 1 ? Math.round((100 - base * (n - 1)) * 10) / 10 : base,
        })),
      }
    })
    desa(nous)
  }

  /**
   * Genera la descàrrega i ensenya què passa. Abans es cridava la funció
   * d'exportació directament des de l'onClick: si petava, el navegador
   * s'empassava l'error i no passava absolutament res, sense cap pista.
   */
  async function descarrega(quin, fes) {
    setDescarregant(quin)
    setMissatge(null)
    try {
      if (objectius.length === 0) {
        throw new Error('Encara no hi ha cap objectiu carregat en aquest curs escolar.')
      }
      await fes()
      setMissatge({ type: 'ok', text: 'Descàrrega generada.' })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut generar la descàrrega: ${err.message}` })
    } finally {
      setDescarregant(null)
    }
  }

  async function pujaPlantilla(fitxer) {
    if (!fitxer) return
    setImportant(true)
    setMissatge(null)
    try {
      const buffer = await fitxer.arrayBuffer()
      const { objectius: llegits, avisos } = await llegeixPlantillaPgac(buffer)
      setImportacio({ objectius: llegits, avisos, origen: fitxer.name })
    } catch (err) {
      setMissatge({ type: 'error', text: `No he pogut llegir la plantilla: ${err.message}` })
    } finally {
      setImportant(false)
    }
  }

  async function copiaDeCurs() {
    const origen = cursOrigen.trim()
    if (!origen) return
    if (origen === cursEscolarId) {
      setMissatge({ type: 'error', text: 'El curs d\'origen i el de destí són el mateix.' })
      return
    }
    setImportant(true)
    setMissatge(null)
    try {
      const snap = await getDoc(doc(db, 'pgac', origen))
      if (!snap.exists() || !snap.data().objectius) {
        setMissatge({ type: 'error', text: `No hi ha cap PGAC desat del curs ${origen}.` })
        return
      }
      // Es copia tota l'estructura (textos, pesos i escales) i es buiden les
      // valoracions: el curs nou comença sense res marcat.
      const copia = normalitzaObjectius(snap.data().objectius).map((o) => ({
        ...o,
        id: crypto.randomUUID(),
        competencies: { ...o.competencies, gener: '', juny: '' },
        operatius: o.operatius.map((op) => ({
          ...op,
          id: crypto.randomUUID(),
          indicadors: op.indicadors.map((ind) => ({ ...ind, id: crypto.randomUUID(), gener: '', juny: '' })),
        })),
      }))
      setImportacio({
        objectius: copia,
        avisos: [],
        origen: `el curs ${origen}`,
      })
    } catch (err) {
      setMissatge({ type: 'error', text: `No he pogut copiar: ${err.message}` })
    } finally {
      setImportant(false)
    }
  }

  function aplicaImportacio() {
    if (!importacio) return
    const nous = normalitzaObjectius(importacio.objectius)
    setObjectius(nous)
    desa(nous)
    setImportacio(null)
    setObjectiuObert(0)
    setMissatge({ type: 'ok', text: `Estructura carregada al curs ${cursEscolarId}.` })
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
      operatius: o.operatius.map((op) => (op.id !== operatiuId ? op : { ...op, indicadors: [...op.indicadors, indicadorBuit()] })),
    }))
    desa(nous)
  }

  function esborraOperatiu(objectiuIndex, operatiuId) {
    const op = objectius[objectiuIndex]?.operatius.find((o) => o.id === operatiuId)
    const teDades = op && (op.indicadors.length > 0 || op.text || !(op.pes === '' || op.pes === null || op.pes === undefined))
    if (teDades && !window.confirm(`Segur que vols esborrar «${op.titol}» i tots els seus indicadors?`)) return
    const nous = actualitza(objectiuIndex, (o) => ({
      ...o,
      operatius: o.operatius.filter((operatiu) => operatiu.id !== operatiuId),
    }))
    desa(nous)
  }

  function esborraIndicador(objectiuIndex, operatiuId, indicadorId) {
    const indicador = objectius[objectiuIndex]?.operatius
      .find((op) => op.id === operatiuId)?.indicadors.find((i) => i.id === indicadorId)
    if (indicador?.text?.trim() && !window.confirm(`Segur que vols esborrar «${indicador.text.slice(0, 60)}»?`)) return
    return esborraIndicadorConfirmat(objectiuIndex, operatiuId, indicadorId)
  }

  function esborraIndicadorConfirmat(objectiuIndex, operatiuId, indicadorId) {
    const nous = actualitza(objectiuIndex, (o) => ({
      ...o,
      operatius: o.operatius.map((op) => (op.id !== operatiuId ? op : { ...op, indicadors: op.indicadors.filter((ind) => ind.id !== indicadorId) })),
    }))
    desa(nous)
  }

  // Els totals recorren tots els objectius, operatius i indicadors. Sense
  // memoritzar-los es refan a cada tecla que es prem en qualsevol camp.
  // Van abans del "return" de càrrega: els hooks de React s'han de cridar
  // sempre en el mateix ordre, passi el que passi.
  const generalG = useMemo(() => resultatGeneral(objectius, 'gener'), [objectius])
  const generalJ = useMemo(() => resultatGeneral(objectius, 'juny'), [objectius])

  if (carregant) return <p>Carregant…</p>

  return (
    <div>
      <p className="module-lead">
        Seguiment de la Programació General Anual de Centre (PGAC). El càlcul reprodueix el del
        document oficial: cada indicador es multiplica pel seu pes dins de l'operatiu, i cada
        operatiu pel seu pes dins de l'objectiu. Els indicadors sense valorar compten 0, com al
        document. Cada canvi es desa sol.
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

      <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
        <Barra resultat={generalG} etiqueta="Mitjana dels 3 objectius — Gener" />
        <Barra resultat={generalJ} etiqueta="Mitjana dels 3 objectius — Juny" />
      </div>
      <p style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>
        El document oficial no calcula cap total global del PGAC: els tres objectius hi van per
        separat. Aquesta mitjana és una comoditat de l'app, no una xifra oficial.
      </p>

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
          {missatge.text}
        </p>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <button
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
          onClick={() => descarrega('excel', () => exportaPgacExcel(objectius, cursEscolarId))}
          disabled={descarregant !== null}
          type="button"
        >
          {descarregant === 'excel' ? 'Generant…' : '📥 Descarrega en Excel'}
        </button>
        <button
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
          onClick={() => descarrega('pdf', () => exportaPgacPDF(objectius, cursEscolarId))}
          disabled={descarregant !== null}
          type="button"
        >
          {descarregant === 'pdf' ? 'Generant…' : '📄 Descarrega en PDF'}
        </button>
      </div>

      {/* ── Carregar l'estructura: plantilla Excel o curs anterior ── */}
      <div className="placeholder-box" style={{ marginTop: 16, padding: '14px 16px' }}>
        <strong style={{ fontSize: 13 }}>Carrega l'estructura del curs</strong>
        <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4, maxWidth: '100%' }}>
          Els objectius, operatius, indicadors, pesos i escales es poden treure de la plantilla
          oficial o del curs anterior. En tots dos casos veuràs què s'ha llegit abans de desar res.
        </p>

        <div style={{ display: 'flex', gap: 24, marginTop: 12, flexWrap: 'wrap' }}>
          <div>
            <BotoDrive
              onFitxer={(e) => pujaPlantilla(e.target.files?.[0])}
              tipus="fulls"
              etiqueta="Tria la plantilla del Drive"
              onError={(t) => setMissatge({ type: 'error', text: t })}
              disabled={important}
            />
            <label
              className="btn-ghost"
              style={{ display: 'inline-block', color: 'var(--navy)', borderColor: 'var(--navy)', fontSize: 13, cursor: 'pointer', padding: '8px 14px', borderRadius: 8, border: '1px solid' }}
            >
              Puja la plantilla Excel
              <input
                type="file"
                accept=".xlsx"
                style={{ display: 'none' }}
                onChange={(e) => { pujaPlantilla(e.target.files?.[0]); e.target.value = '' }}
              />
            </label>
            <p style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4, maxWidth: 280 }}>
              L'Eina d'avaluació PGAC. Des del Google Sheets: Fitxer → Baixa → Microsoft Excel.
            </p>
          </div>

          <div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={cursOrigen}
                placeholder="2026-27"
                onChange={(e) => setCursOrigen(e.target.value)}
                style={{ width: 100, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
              />
              <button
                type="button"
                onClick={copiaDeCurs}
                disabled={!cursOrigen.trim()}
                className="btn-ghost"
                style={{ color: 'var(--navy)', borderColor: 'var(--navy)', fontSize: 13, maxWidth: 220 }}
              >
                Copia d'aquest curs
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4, maxWidth: 280 }}>
              Agafa l'estructura sencera i la deixa sense valorar, a punt per al curs nou.
            </p>
          </div>
        </div>
        {important && <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8 }}>Llegint…</p>}
      </div>

      {importacio && (
        <div className="placeholder-box" style={{ marginTop: 12, padding: '14px 16px' }}>
          <strong style={{ fontSize: 13 }}>
            Llegit de {importacio.origen} — {importacio.objectius.length} objectius
          </strong>

          {importacio.avisos.length > 0 && (
            <ul style={{ fontSize: 12, color: 'var(--amber-dark)', marginTop: 8, paddingLeft: 18 }}>
              {importacio.avisos.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          )}

          <div style={{ marginTop: 10, maxHeight: 300, overflowY: 'auto', fontSize: 12 }}>
            {importacio.objectius.map((o, i) => (
              <div key={i} style={{ marginTop: 8 }}>
                <div style={{ fontWeight: 600 }}>{o.titol}</div>
                {o.competencies?.actiu && (
                  <div style={{ color: 'var(--ink-soft)' }}>
                    amb competències bàsiques: {100 - o.competencies.pes}/{o.competencies.pes}
                  </div>
                )}
                {o.operatius.map((op, j) => (
                  <div key={j} style={{ color: 'var(--ink-soft)', marginLeft: 12 }}>
                    {op.titol} — pes {op.pes ?? '—'}% · {op.indicadors.length} indicadors
                    {op.indicadors.some((ind) => ind.escala === 'propia') && ' · amb escala pròpia'}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 10 }}>
            Això substituirà tot el que hi hagi ara al curs {cursEscolarId}, valoracions incloses.
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={aplicaImportacio}
              style={{ background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}
            >
              Carrega-ho al curs {cursEscolarId}
            </button>
            <button
              type="button"
              onClick={() => setImportacio(null)}
              className="btn-ghost"
              style={{ color: 'var(--navy)', borderColor: 'var(--navy)', maxWidth: 140, fontSize: 13 }}
            >
              Cancel·la
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        {objectius.map((objectiu, objectiuIndex) => {
          const obert = objectiuObert === objectiuIndex
          const rg = resultatObjectiu(objectiu, 'gener')
          const rj = resultatObjectiu(objectiu, 'juny')
          const cb = objectiu.competencies ?? {}
          return (
            <div key={objectiu.id} className="placeholder-box" style={{ marginTop: 10, padding: 0, overflow: 'hidden' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', flexWrap: 'wrap', gap: 8 }}
                onClick={() => setObjectiuObert(obert ? null : objectiuIndex)}
              >
                <strong>{objectiu.titol}</strong>
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                  <Barra resultat={rg} etiqueta="Gener" />
                  <Barra resultat={rj} etiqueta="Juny" />
                  <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{obert ? '▲' : '▼'}</span>
                </div>
              </div>

              {obert && (
                <div style={{ padding: '4px 16px 16px', borderTop: '1px solid var(--line)' }}>
                  <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 10 }}>{objectiu.descripcio}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, marginTop: 10 }}>{objectiu.estrategiaTitol}</p>
                  <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{objectiu.estrategiaText}</p>

                  <AvisPesos pesTotal={rg.pesTotal} onReparteix={() => reparteixOperatius(objectiuIndex)} />

                  {/* Competències bàsiques (65/35 del document): NOMÉS l'Objectiu 1
                      (Àmbit pedagògic) combina els operatius amb TEE/VL/CL — els
                      altres dos objectius no ho fan mai. */}
                  {objectiuIndex === 0 && (
                  <div style={{ marginTop: 14, padding: '10px 12px', border: '1px dashed var(--line)', borderRadius: 8 }}>
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={!!cb.actiu}
                        onChange={() => {
                          setObjectius((prev) => {
                            const nous = prev.map((o, i) => (i === objectiuIndex
                              ? { ...o, competencies: { ...(o.competencies ?? {}), actiu: !o.competencies?.actiu } }
                              : o))
                            desa(nous)
                            return nous
                          })
                        }}
                      />
                      Aquest objectiu inclou el resultat de TEE, VL i CL
                    </label>
                    {cb.actiu && (
                      <div style={{ marginTop: 8 }}>
                        <p style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{cb.text}</p>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                          <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Pes de TEE, VL i CL</span>
                          <CampPes
                            valor={cb.pes}
                            onChange={(v) => canviaCompetencies(objectiuIndex, 'pes', v)}
                            onBlur={() => desa(objectius)}
                            titol="Al document oficial és el 35%; els operatius s'enduen el 65% restant"
                          />
                          <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                            → els operatius pesen el {100 - (Number(cb.pes) || 0)}%
                          </span>
                        </div>
                        <select
                          value={cb.escala ?? 'indicadors6'}
                          onChange={(e) => { const nous = canviaCompetencies(objectiuIndex, 'escala', e.target.value); desa(nous) }}
                          style={{ marginTop: 8, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 11 }}
                        >
                          {ESCALES.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
                        </select>
                        {[{ camp: 'gener', etiqueta: 'Gener' }, { camp: 'juny', etiqueta: 'Juny' }].map(({ camp, etiqueta }) => {
                          const opcioActual = opcioDe(cb.escala ?? 'indicadors6', cb[camp])
                          return (
                            <div key={camp} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, color: 'var(--ink-soft)', minWidth: 40 }}>{etiqueta}</span>
                              {escalaDe(cb.escala ?? 'indicadors6').opcions.map((op) => (
                                <button
                                  key={op.id}
                                  type="button"
                                  onClick={() => {
                                    // Clicar el que ja està triat el desmarca (deixa sense valorar);
                                    // clicar-ne un altre el substitueix com sempre.
                                    const valorNou = opcioActual?.id === op.id ? '' : op.valor
                                    const nous = canviaCompetencies(objectiuIndex, camp, valorNou)
                                    desa(nous)
                                  }}
                                  style={{
                                    fontSize: 11, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                                    border: `1px solid ${opcioActual?.id === op.id ? 'var(--navy)' : 'var(--line)'}`,
                                    background: opcioActual?.id === op.id ? 'var(--navy)' : 'transparent',
                                    color: opcioActual?.id === op.id ? '#fff' : 'var(--ink)',
                                  }}
                                >
                                  {op.label}
                                </button>
                              ))}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* ── Operatius ── */}
                  {objectiu.operatius.map((op) => {
                    const rog = resultatOperatiu(op, 'gener')
                    const roj = resultatOperatiu(op, 'juny')
                    const esBuitOp = op.indicadors.length === 0
                      && (op.pes === '' || op.pes === null || op.pes === undefined)
                      && !op.text
                    const mostrat = operatiusBuitsMostrats.has(op.id)

                    if (esBuitOp && !mostrat) {
                      return (
                        <div key={op.id} style={{ marginTop: 10, borderTop: '1px dashed var(--line)', paddingTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setOperatiusBuitsMostrats((prev) => new Set(prev).add(op.id))}
                            style={{ background: 'none', border: 'none', color: 'var(--ink-soft)', fontSize: 12, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                          >
                            + {op.titol} (reservat, buit — clica per omplir-lo)
                          </button>
                          <button
                            type="button"
                            onClick={() => esborraOperatiu(objectiuIndex, op.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 11, cursor: 'pointer', padding: 0 }}
                          >
                            Esborra
                          </button>
                        </div>
                      )
                    }

                    return (
                      <div key={op.id} style={{ marginTop: 16, borderTop: '1px dashed var(--line)', paddingTop: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 13 }}>{op.titol}</strong>
                            <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>pes dins l'objectiu</span>
                            <CampPes
                              valor={op.pes}
                              onChange={(v) => canviaOperatiu(objectiuIndex, op.id, 'pes', v)}
                              onBlur={() => desa(objectius)}
                              titol="Pes d'aquest operatiu dins de l'objectiu. Els pesos de tots els operatius han de sumar 100%."
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                            <Barra resultat={rog} etiqueta="Gener" />
                            <Barra resultat={roj} etiqueta="Juny" />
                            <button
                              type="button"
                              onClick={() => esborraOperatiu(objectiuIndex, op.id)}
                              style={{ background: 'none', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}
                            >
                              Esborra
                            </button>
                          </div>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>{op.text}</p>

                        {op.indicadors.length > 0 && (
                          <AvisPesos pesTotal={rog.pesTotal} onReparteix={() => reparteixIndicadors(objectiuIndex, op.id)} />
                        )}

                        {op.indicadors.map((ind) => {
                          const escala = escalaDe(ind.escala)
                          const opcions = opcionsDe(ind)
                          return (
                            <div key={ind.id} style={{ marginTop: 10, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
                              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                <input
                                  type="text"
                                  value={ind.text}
                                  placeholder="Text de l'indicador"
                                  onChange={(e) => canviaIndicador(objectiuIndex, op.id, ind.id, 'text', e.target.value)}
                                  onBlur={() => desa(objectius)}
                                  style={{ flex: 1, minWidth: 220, border: '1px solid var(--line)', borderRadius: 6, padding: '6px 8px', fontSize: 12 }}
                                />
                                <button
                                  type="button"
                                  onClick={() => esborraIndicador(objectiuIndex, op.id, ind.id)}
                                  style={{ background: 'none', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}
                                >
                                  Esborra
                                </button>
                              </div>

                              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
                                <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Pes dins l'operatiu</span>
                                <CampPes
                                  valor={ind.pesGlobal}
                                  onChange={(v) => canviaIndicador(objectiuIndex, op.id, ind.id, 'pesGlobal', v)}
                                  onBlur={() => desa(objectius)}
                                  titol="La columna 'Valor Global' del document. Els pesos de tots els indicadors de l'operatiu han de sumar 100%."
                                />
                                <select
                                  value={ind.escala ?? 'execucio'}
                                  onChange={(e) => { const nous = canviaIndicador(objectiuIndex, op.id, ind.id, 'escala', e.target.value); desa(nous) }}
                                  style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 11, maxWidth: 260 }}
                                >
                                  {ind.escala === 'propia' && (
                                    <option value="propia">Escala pròpia de la plantilla</option>
                                  )}
                                  {ESCALES.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
                                </select>
                              </div>
                              {escala.perConfirmar && (
                                <p style={{ fontSize: 10, color: 'var(--amber-dark)', marginTop: 4 }}>
                                  Els percentatges d'aquesta escala encara s'han de confirmar amb un full original.
                                </p>
                              )}

                              {[{ camp: 'gener', etiqueta: 'Gener' }, { camp: 'juny', etiqueta: 'Juny' }].map(({ camp, etiqueta }) => {
                                const opcioActual = (ind[camp] === '' || ind[camp] === null || ind[camp] === undefined)
                                  ? null
                                  : opcions.find((o) => o.valor === Number(ind[camp])) ?? null
                                return (
                                  <div key={camp} style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 11, color: 'var(--ink-soft)', minWidth: 40 }}>{etiqueta}</span>
                                    {opcions.map((o) => (
                                      <button
                                        key={o.id}
                                        type="button"
                                        onClick={() => {
                                          const valorNou = opcioActual?.id === o.id ? '' : o.valor
                                          const nous = canviaIndicador(objectiuIndex, op.id, ind.id, camp, valorNou)
                                          desa(nous)
                                        }}
                                        style={{
                                          fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                                          border: `1px solid ${opcioActual?.id === o.id ? 'var(--navy)' : 'var(--line)'}`,
                                          background: opcioActual?.id === o.id ? 'var(--navy)' : 'transparent',
                                          color: opcioActual?.id === o.id ? '#fff' : 'var(--ink)',
                                        }}
                                      >
                                        {o.label}
                                      </button>
                                    ))}
                                    <input
                                      type="number" min={0} max={100}
                                      value={ind[camp]}
                                      onChange={(e) => canviaIndicador(objectiuIndex, op.id, ind.id, camp, e.target.value)}
                                      onBlur={() => desa(objectius)}
                                      title="Si cal un número que no és a l'escala, escriu-lo aquí"
                                      style={{ width: 56, border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 11, marginLeft: 4 }}
                                    />
                                    <span style={{ fontSize: 10, color: 'var(--ink-soft)' }}>%</span>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })}

                        <button
                          type="button"
                          onClick={() => afegeixIndicador(objectiuIndex, op.id)}
                          className="btn-ghost"
                          style={{ marginTop: 8, fontSize: 12, padding: '4px 10px', maxWidth: 180, color: 'var(--navy)', borderColor: 'var(--navy)' }}
                        >
                          + Afegeix indicador
                        </button>
                      </div>
                    )
                  })}

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
