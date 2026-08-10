import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { cursEscolarActual } from '../../lib/cursEscolar'
import { CATEGORIES_VALORACIO, FESTES } from '../../lib/valoracions'

function colorPer(valor) {
  if (valor === '' || valor === undefined || valor === null) return 'var(--ink-soft)'
  const n = Number(valor)
  if (n >= 80) return 'var(--green)'
  if (n >= 40) return 'var(--amber-dark)'
  return 'var(--red)'
}

export default function MatriuGeneral() {
  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [valoracions, setValoracions] = useState({})
  const [carregant, setCarregant] = useState(true)
  const [missatge, setMissatge] = useState(null)

  useEffect(() => {
    carrega()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursEscolarId])

  async function carrega() {
    setCarregant(true)
    setMissatge(null)
    try {
      const snap = await getDocs(query(collection(db, 'valoracions'), where('cursEscolar', '==', cursEscolarId)))
      const mapa = {}
      snap.docs.forEach((d) => { mapa[d.data().categoria] = d.data() })
      setValoracions(mapa)
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'han pogut carregar les valoracions: ${err.message}` })
    } finally {
      setCarregant(false)
    }
  }

  if (carregant) return <p>Carregant…</p>

  return (
    <div>
      <p className="module-lead">
        Vista de conjunt de totes les valoracions de cicle/comissió/equip i festes que els
        docents han anat introduint des del mòdul "Documentació". Només lectura des d'aquí.
      </p>

      <label className="field" style={{ maxWidth: 160, marginTop: 16 }}>
        <span>Curs escolar</span>
        <input
          type="text"
          value={cursEscolarId}
          onChange={(e) => setCursEscolarId(e.target.value)}
          style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontWeight: 600 }}
        />
      </label>

      {missatge && <p style={{ marginTop: 12, fontSize: 13, color: 'var(--red)' }}>{missatge.text}</p>}

      <div style={{ overflowX: 'auto', marginTop: 20 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 12, whiteSpace: 'nowrap' }}>
          <thead>
            <tr style={{ background: 'var(--navy)', color: '#fff' }}>
              <th style={{ padding: '6px 10px', position: 'sticky', left: 0, background: 'var(--navy)', textAlign: 'left' }}>
                Cicle / Comissió / Equip
              </th>
              <th style={{ padding: '6px 10px' }}>Val. general</th>
              {FESTES.map((f) => <th key={f.id} style={{ padding: '6px 10px' }}>{f.label}</th>)}
              <th style={{ padding: '6px 10px', textAlign: 'left' }}>Comentaris</th>
              <th style={{ padding: '6px 10px', textAlign: 'left' }}>Actualitzat per</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES_VALORACIO.map((c, i) => {
              const v = valoracions[c.id]
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--line)', background: i % 2 === 0 ? '#fff' : 'var(--bg-soft, #fafaf7)' }}>
                  <td style={{ padding: '6px 10px', position: 'sticky', left: 0, background: i % 2 === 0 ? '#fff' : 'var(--bg-soft, #fafaf7)', fontWeight: 500 }}>
                    {c.label}
                  </td>
                  <td style={{ padding: '6px 10px', fontWeight: 700, color: colorPer(v?.valCicleComissioEquips) }}>
                    {v?.valCicleComissioEquips !== undefined && v?.valCicleComissioEquips !== '' ? `${v.valCicleComissioEquips}%` : '—'}
                  </td>
                  {FESTES.map((f) => (
                    <td key={f.id} style={{ padding: '6px 10px', color: colorPer(v?.festes?.[f.id]) }}>
                      {v?.festes?.[f.id] !== undefined && v?.festes?.[f.id] !== '' ? `${v.festes[f.id]}%` : '—'}
                    </td>
                  ))}
                  <td style={{ padding: '6px 10px', color: 'var(--ink-soft)', whiteSpace: 'normal', maxWidth: 240 }}>
                    {v?.comentaris || '—'}
                  </td>
                  <td style={{ padding: '6px 10px', color: 'var(--ink-soft)', fontSize: 11 }}>
                    {v?.actualitzatPer || '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
