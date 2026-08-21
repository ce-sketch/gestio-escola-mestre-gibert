import { useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../../firebase'
import { carregaXLSX } from '../../../lib/carregaLlibreries'
import { descarregaDocumentSortides } from '../../../lib/documentSortides'
import {
  extreuSortidesAutocar, agrupaPerMes, generaCartaGUMes,
  PUNT_TROBADA_DEFECTE, DIRECTOR_DEFECTE,
} from '../../../lib/guardiaUrbanaExport'

/**
 * Genera, mes a mes (setembre a juny), la carta de comunicat de sortides
 * amb autocar que cada mes s'envia a la Guàrdia Urbana — llegint les
 * activitats reals del mateix document consolidat que ja fa servir la
 * resta d'Economia, i comptant l'alumnat de cada nivell des de Firestore.
 *
 * De moment només genera les cartes en PDF perquè les revisis i les
 * enviïs tu mateix per correu (a GU_UT09, amb còpia al centre) — l'enviament
 * automàtic és un pas següent.
 */
export default function ComunicatGU({ cursEscolarId }) {
  const [carregant, setCarregant] = useState(false)
  const [mesos, setMesos] = useState(null) // [{ mesLabel, any, sortides }]
  const [error, setError] = useState(null)
  const [puntTrobada, setPuntTrobada] = useState(PUNT_TROBADA_DEFECTE)
  const [director, setDirector] = useState(DIRECTOR_DEFECTE)

  async function carregaSortides() {
    setCarregant(true)
    setError(null)
    setMesos(null)
    try {
      const XLSX = await carregaXLSX()
      const [workbook, alumnesSnap] = await Promise.all([
        descarregaDocumentSortides(XLSX),
        getDocs(query(collection(db, 'alumnes'), where('actiu', '==', true))),
      ])
      const alumnesActius = alumnesSnap.docs.map((d) => d.data())
      const sortides = extreuSortidesAutocar(workbook, XLSX, alumnesActius)
      setMesos(agrupaPerMes(sortides, cursEscolarId))
    } catch (err) {
      setError(err.message)
    } finally {
      setCarregant(false)
    }
  }

  const totalSortides = mesos?.reduce((suma, m) => suma + m.sortides.length, 0) ?? 0
  const totalColonies = mesos?.reduce((suma, m) => suma + m.sortides.filter((s) => s.colonia).length, 0) ?? 0

  return (
    <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 28 }}>
      <strong>Comunicat de sortides a la Guàrdia Urbana</strong>
      <p style={{ marginTop: 6, fontSize: 13 }}>
        Llegeix les activitats amb autocar del document consolidat de sortides (el mateix que
        s'actualitza més amunt) i genera, mes a mes, la carta que s'envia a la Guàrdia Urbana. De
        moment només prepara el PDF perquè el revisis i l'enviïs tu mateix per correu — encara no
        l'envia sol.
      </p>

      <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
        <label className="field" style={{ maxWidth: 340 }}>
          <span>Punt de trobada (sortida i arribada de l'autocar)</span>
          <input
            type="text"
            value={puntTrobada}
            onChange={(e) => setPuntTrobada(e.target.value)}
            style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}
          />
        </label>
        <label className="field" style={{ maxWidth: 220 }}>
          <span>Signatura</span>
          <input
            type="text"
            value={director}
            onChange={(e) => setDirector(e.target.value)}
            style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}
          />
        </label>
      </div>

      <button type="button" className="btn-ghost" style={{ marginTop: 12 }} onClick={carregaSortides} disabled={carregant}>
        {carregant ? 'Llegint el document…' : '↻ Llegeix les sortides amb autocar del curs ' + cursEscolarId}
      </button>

      {error && <p style={{ color: 'var(--red, #b03030)', fontSize: 12, marginTop: 8 }}>{error}</p>}

      {mesos && (
        <>
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 12 }}>
            {totalSortides} sortida{totalSortides === 1 ? '' : 's'} amb autocar trobades
            {totalColonies > 0 && ` (${totalColonies} de colònies, amb l'empresa encara per determinar — revisa-les abans d'enviar)`}.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginTop: 10 }}>
            {mesos.map((m) => (
              <div
                key={`${m.mesLabel}-${m.any}`}
                style={{
                  border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px',
                  opacity: m.sortides.length === 0 ? 0.5 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <strong style={{ fontSize: 13 }}>{m.mesLabel} {m.any}</strong>
                  <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                    {m.sortides.length} sortid{m.sortides.length === 1 ? 'a' : 'es'}
                  </span>
                </div>
                {m.sortides.some((s) => s.colonia) && (
                  <p style={{ fontSize: 11, color: 'var(--red, #b03030)', margin: '4px 0 0' }}>⚠ Inclou colònies</p>
                )}
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ marginTop: 8, fontSize: 12, width: '100%' }}
                  disabled={m.sortides.length === 0}
                  onClick={() => generaCartaGUMes(m.mesLabel, m.any, m.sortides, { puntTrobada, director })}
                >
                  {m.sortides.length === 0 ? 'Sense sortides' : '📄 Genera la carta'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
