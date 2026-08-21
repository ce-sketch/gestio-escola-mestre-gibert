import { useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../../firebase'
import { carregaXLSX } from '../../../lib/carregaLlibreries'
import { descarregaDocumentSortides } from '../../../lib/documentSortides'
import {
  extreuActivitatsAutocar, comptaAlumnesDelNivell, textCartaGUMes, obreImpressioCartaGU,
  PUNT_TROBADA_DEFECTE, DIRECTOR_DEFECTE, EMPRESA_AUTOCARS_HABITUAL, EMPRESA_PER_DETERMINAR,
  MESOS_CURS,
} from '../../../lib/guardiaUrbanaExport'

const inputSmall = { border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 12 }

/**
 * Comunicat de sortides a la Guàrdia Urbana.
 *
 * Detecta soles quines activitats porten autocar (la columna Transport
 * del document és fiable), però la Data i l'Horari que hi escriuen els
 * mestres són text totalment lliure — per això aquí NO s'intenta
 * endevinar el mes ni l'horari: es mostren com a referència i és la
 * persona qui tria el mes i ajusta l'horari de cada sortida abans de
 * generar la carta. La carta, un cop generada, surt com a text editable
 * a la pantalla — es pot corregir abans d'imprimir-la o desar-la en PDF.
 */
export default function ComunicatGU({ cursEscolarId }) {
  const [carregant, setCarregant] = useState(false)
  const [activitats, setActivitats] = useState(null) // [{ id, ...doc, mes, horariSortida, horariArribada, alumnes, numAutocars, empresa }]
  const [error, setError] = useState(null)
  const [puntTrobada, setPuntTrobada] = useState(PUNT_TROBADA_DEFECTE)
  const [director, setDirector] = useState(DIRECTOR_DEFECTE)
  const [cartaOberta, setCartaOberta] = useState(null) // { mesLabel, any, text }

  async function carregaSortides() {
    setCarregant(true)
    setError(null)
    setActivitats(null)
    setCartaOberta(null)
    try {
      const XLSX = await carregaXLSX()
      const [workbook, alumnesSnap] = await Promise.all([
        descarregaDocumentSortides(XLSX),
        getDocs(query(collection(db, 'alumnes'), where('actiu', '==', true))),
      ])
      const alumnesActius = alumnesSnap.docs.map((d) => d.data())
      const trobades = extreuActivitatsAutocar(workbook, XLSX)
      setActivitats(trobades.map((a) => ({
        ...a,
        mes: '',
        horariSortida: '',
        horariArribada: '',
        alumnes: comptaAlumnesDelNivell(alumnesActius, a.nivell),
        numAutocars: 1,
        empresa: a.avisColonia ? EMPRESA_PER_DETERMINAR : EMPRESA_AUTOCARS_HABITUAL,
      })))
    } catch (err) {
      setError(err.message)
    } finally {
      setCarregant(false)
    }
  }

  function actualitza(id, canvis) {
    setActivitats((prev) => prev.map((a) => (a.id === id ? { ...a, ...canvis } : a)))
  }

  function generaCarta(mes) {
    const sortides = activitats.filter((a) => a.mes === mes)
    const any = ['Setembre', 'Octubre', 'Novembre', 'Desembre'].includes(mes)
      ? Number(cursEscolarId.split('-')[0])
      : Number(cursEscolarId.split('-')[0]) + 1
    const text = textCartaGUMes(mes, any, sortides, { puntTrobada, director })
    setCartaOberta({ mesLabel: mes, any, text })
  }

  const mesosAmbSortides = activitats
    ? MESOS_CURS.filter((m) => activitats.some((a) => a.mes === m))
    : []
  const senseMes = activitats?.filter((a) => !a.mes).length ?? 0

  return (
    <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 28 }}>
      <strong>Comunicat de sortides a la Guàrdia Urbana</strong>
      <p style={{ marginTop: 6, fontSize: 13 }}>
        Detecta les activitats amb autocar del document consolidat de sortides. La data i l'horari
        que escriuen els mestres són text lliure (no sempre amb el mateix format), així que aquí
        es mostren com a referència perquè triïs tu mateix el mes i ajustis l'horari de cada
        sortida — la carta final surt com a text editable, per revisar-la abans d'imprimir-la.
      </p>

      <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
        <label className="field" style={{ maxWidth: 340 }}>
          <span>Punt de trobada (sortida i arribada de l'autocar)</span>
          <input type="text" value={puntTrobada} onChange={(e) => setPuntTrobada(e.target.value)} style={{ ...inputSmall, display: 'block', width: '100%' }} />
        </label>
        <label className="field" style={{ maxWidth: 220 }}>
          <span>Signatura</span>
          <input type="text" value={director} onChange={(e) => setDirector(e.target.value)} style={{ ...inputSmall, display: 'block', width: '100%' }} />
        </label>
      </div>

      <button type="button" className="btn-ghost" style={{ marginTop: 12 }} onClick={carregaSortides} disabled={carregant}>
        {carregant ? 'Llegint el document…' : '↻ Llegeix les sortides amb autocar del curs ' + cursEscolarId}
      </button>

      {error && <p style={{ color: 'var(--red, #b03030)', fontSize: 12, marginTop: 8 }}>{error}</p>}

      {activitats && activitats.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 12 }}>No hi ha cap activitat amb "Autocar" a la columna Transport.</p>
      )}

      {activitats && activitats.length > 0 && (
        <>
          <div style={{ overflowX: 'auto', marginTop: 14 }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                  <th style={{ padding: '4px 6px' }}>Sortida</th>
                  <th style={{ padding: '4px 6px' }}>Data / Horari al document</th>
                  <th style={{ padding: '4px 6px' }}>Mes</th>
                  <th style={{ padding: '4px 6px' }}>Sortida</th>
                  <th style={{ padding: '4px 6px' }}>Arribada</th>
                  <th style={{ padding: '4px 6px' }}>Alumnes</th>
                  <th style={{ padding: '4px 6px' }}>Autocars</th>
                  <th style={{ padding: '4px 6px' }}>Empresa</th>
                </tr>
              </thead>
              <tbody>
                {activitats.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px' }}>
                      <strong>{a.nom}</strong><br />
                      <span style={{ color: 'var(--ink-soft)' }}>{a.nivell} · {a.lloc}</span>
                      {a.avisColonia && <div style={{ color: 'var(--red, #b03030)' }}>⚠ Pot ser de més d'un dia</div>}
                    </td>
                    <td style={{ padding: '6px', color: 'var(--ink-soft)' }}>
                      {a.dataText || '—'}<br />{a.horariText || '—'}
                    </td>
                    <td style={{ padding: '6px' }}>
                      <select value={a.mes} onChange={(e) => actualitza(a.id, { mes: e.target.value })} style={inputSmall}>
                        <option value="">— tria —</option>
                        {MESOS_CURS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '6px' }}>
                      <input type="text" placeholder="9:00" value={a.horariSortida} onChange={(e) => actualitza(a.id, { horariSortida: e.target.value })} style={{ ...inputSmall, width: 60 }} />
                    </td>
                    <td style={{ padding: '6px' }}>
                      <input type="text" placeholder="16:30" value={a.horariArribada} onChange={(e) => actualitza(a.id, { horariArribada: e.target.value })} style={{ ...inputSmall, width: 60 }} />
                    </td>
                    <td style={{ padding: '6px' }}>
                      <input type="number" value={a.alumnes} onChange={(e) => actualitza(a.id, { alumnes: Number(e.target.value) })} style={{ ...inputSmall, width: 55 }} />
                    </td>
                    <td style={{ padding: '6px' }}>
                      <input type="number" value={a.numAutocars} onChange={(e) => actualitza(a.id, { numAutocars: Number(e.target.value) })} style={{ ...inputSmall, width: 45 }} />
                    </td>
                    <td style={{ padding: '6px' }}>
                      <select value={a.empresa} onChange={(e) => actualitza(a.id, { empresa: e.target.value })} style={inputSmall}>
                        <option value={EMPRESA_AUTOCARS_HABITUAL}>{EMPRESA_AUTOCARS_HABITUAL}</option>
                        <option value={EMPRESA_PER_DETERMINAR}>{EMPRESA_PER_DETERMINAR}</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {senseMes > 0 && (
            <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8 }}>
              {senseMes} sortida{senseMes === 1 ? '' : 's'} encara sense mes triat — no sortiran a cap carta fins que en triïs un.
            </p>
          )}

          {mesosAmbSortides.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {mesosAmbSortides.map((m) => (
                <button key={m} type="button" className="btn-ghost" onClick={() => generaCarta(m)}>
                  📄 Genera la carta de {m}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {cartaOberta && (
        <div style={{ marginTop: 16, border: '1px solid var(--line)', borderRadius: 8, padding: 12 }}>
          <strong style={{ fontSize: 13 }}>Carta de {cartaOberta.mesLabel} {cartaOberta.any} — revisa-la i edita-la si cal</strong>
          <textarea
            value={cartaOberta.text}
            onChange={(e) => setCartaOberta({ ...cartaOberta, text: e.target.value })}
            rows={18}
            style={{ width: '100%', marginTop: 8, fontFamily: 'Georgia, serif', fontSize: 13, padding: 10, border: '1px solid var(--line)', borderRadius: 6, boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="btn-ghost" onClick={() => obreImpressioCartaGU(cartaOberta.mesLabel, cartaOberta.any, cartaOberta.text)}>
              🖨 Imprimeix / Desa PDF
            </button>
            <button type="button" className="btn-ghost" onClick={() => setCartaOberta(null)}>Tanca</button>
          </div>
        </div>
      )}
    </div>
  )
}
