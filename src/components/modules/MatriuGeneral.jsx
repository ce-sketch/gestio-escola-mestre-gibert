import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { cursEscolarActual } from '../../lib/cursEscolar'
import { FESTES, mitjanaValoracio, mitjanaObjectiu } from '../../lib/valoracions'
import { exportaValoracionsExcel, exportaValoracionsPDF } from '../../lib/valoracionsExport'

function colorPer(valor) {
  if (valor === null || valor === undefined) return 'var(--ink-soft)'
  const n = Number(valor)
  if (n >= 80) return 'var(--green)'
  if (n >= 40) return 'var(--amber-dark)'
  return 'var(--red)'
}

export default function MatriuGeneral() {
  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [valoracions, setValoracions] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [missatge, setMissatge] = useState(null)
  const [obert, setObert] = useState(null)

  useEffect(() => {
    carrega()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursEscolarId])

  async function carrega() {
    setCarregant(true)
    setMissatge(null)
    try {
      const snap = await getDocs(query(collection(db, 'valoracions'), where('cursEscolar', '==', cursEscolarId)))
      setValoracions(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.nom.localeCompare(b.nom)))
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
        Vista de conjunt de totes les valoracions de cicle/comissió/equip que els docents han
        anat introduint des del mòdul "Documentació". Només lectura des d'aquí.
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

      {valoracions.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            className="btn-ghost"
            style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
            onClick={() => exportaValoracionsExcel(valoracions, cursEscolarId)}
            type="button"
          >
            📥 Descarrega totes en Excel (amb totes les pestanyes)
          </button>
          <button
            className="btn-ghost"
            style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
            onClick={() => exportaValoracionsPDF(valoracions, cursEscolarId)}
            type="button"
          >
            📄 Descarrega totes en PDF
          </button>
        </div>
      )}

      {valoracions.length === 0 ? (
        <p style={{ marginTop: 20, fontSize: 13, color: 'var(--ink-soft)' }}>
          Encara no hi ha cap valoració introduïda per aquest curs escolar.
        </p>
      ) : (
        <div style={{ marginTop: 20 }}>
          {valoracions.map((v) => {
            const oberta = obert === v.id
            const gener = mitjanaValoracio(v, 'gener')
            const juny = mitjanaValoracio(v, 'juny')
            return (
              <div key={v.id} className="placeholder-box" style={{ marginTop: 10, padding: 0, overflow: 'hidden' }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', flexWrap: 'wrap', gap: 8 }}
                  onClick={() => setObert(oberta ? null : v.id)}
                >
                  <div>
                    <strong>{v.nom}</strong>
                    {v.responsable && <span style={{ fontSize: 12, color: 'var(--ink-soft)', marginLeft: 8 }}>Resp: {v.responsable}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span style={{ fontSize: 12 }}>Gener: <strong style={{ color: colorPer(gener) }}>{gener !== null ? `${Math.round(gener)}%` : '—'}</strong></span>
                    <span style={{ fontSize: 12 }}>Juny: <strong style={{ color: colorPer(juny) }}>{juny !== null ? `${Math.round(juny)}%` : '—'}</strong></span>
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{oberta ? '▲' : '▼'}</span>
                  </div>
                </div>

                {oberta && (
                  <div style={{ padding: '4px 14px 14px', borderTop: '1px solid var(--line)' }}>
                    {v.membres && <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8 }}>Membres: {v.membres}</p>}

                    <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%', marginTop: 10 }}>
                      <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
                          <th style={{ padding: '4px 6px' }}>Objectiu</th>
                          <th style={{ padding: '4px 6px' }}>Gener</th>
                          <th style={{ padding: '4px 6px' }}>Juny</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(v.objectius ?? []).map((o) => {
                          const og = mitjanaObjectiu(o, 'gener')
                          const oj = mitjanaObjectiu(o, 'juny')
                          return (
                            <tr key={o.id} style={{ borderBottom: '1px solid var(--line)' }}>
                              <td style={{ padding: '4px 6px' }}>{o.text || '(sense text)'}</td>
                              <td style={{ padding: '4px 6px', color: colorPer(og) }}>{og !== null ? `${Math.round(og)}%` : '—'}</td>
                              <td style={{ padding: '4px 6px', color: colorPer(oj) }}>{oj !== null ? `${Math.round(oj)}%` : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>

                    {v.valoracioRevisio && <p style={{ fontSize: 12, marginTop: 10 }}><strong>Valoració/revisió:</strong> {v.valoracioRevisio}</p>}
                    {v.valoracioFinal && <p style={{ fontSize: 12, marginTop: 6 }}><strong>Valoració final:</strong> {v.valoracioFinal}</p>}
                    {v.propostesMillora && <p style={{ fontSize: 12, marginTop: 6 }}><strong>Propostes de millora:</strong> {v.propostesMillora}</p>}

                    {v.festes && (
                      <>
                        <p style={{ fontSize: 12, fontWeight: 600, marginTop: 12 }}>Festes</p>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                          {FESTES.map((f) => (
                            <span key={f.id} style={{ fontSize: 11 }}>
                              {f.label}: <strong style={{ color: colorPer(v.festes[f.id]) }}>{v.festes[f.id] !== '' && v.festes[f.id] !== undefined ? `${v.festes[f.id]}%` : '—'}</strong>
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
