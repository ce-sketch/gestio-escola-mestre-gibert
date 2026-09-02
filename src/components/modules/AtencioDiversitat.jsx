import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { comparaCursos } from '../../lib/ordreCursos'
import { PI_AREES } from '../../lib/sicAlumnatIndicadors'

/** "efisica" → "piEfisica", igual que es desa a Firestore des d'Alumnes.jsx. */
function campArea(areaId) {
  return `pi${areaId.charAt(0).toUpperCase()}${areaId.slice(1)}`
}

/**
 * Mòdul "Atenció a la diversitat". Primera versió: només mostra el que ja
 * arriba amb la pujada d'alumnat (Alumnes.jsx, fulls "ESFERA PI" i
 * "ESFERA AD" — vegeu sicAlumnatIndicadors.js). Els indicadors automàtics
 * del SIC i la resta de blocs (mobilitat, absències, ajuts…) són feina
 * pendent, no d'aquesta primera versió.
 */
export default function AtencioDiversitat() {
  const [alumnes, setAlumnes] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [missatge, setMissatge] = useState(null)
  const [classeFiltrada, setClasseFiltrada] = useState('')
  const [areaPiFiltrada, setAreaPiFiltrada] = useState('')
  const [piObert, setPiObert] = useState(true)
  const [adObert, setAdObert] = useState(true)

  useEffect(() => {
    async function carrega() {
      try {
        const snap = await getDocs(query(collection(db, 'alumnes'), where('actiu', '==', true)))
        setAlumnes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'han pogut carregar els alumnes: ${err.message}` })
      } finally {
        setCarregant(false)
      }
    }
    carrega()
  }, [])

  const classes = useMemo(
    () => [...new Set(alumnes.map((a) => a.curs).filter(Boolean))].sort(comparaCursos),
    [alumnes]
  )

  const alumnesFiltrats = useMemo(
    () => (classeFiltrada ? alumnes.filter((a) => a.curs === classeFiltrada) : alumnes),
    [alumnes, classeFiltrada]
  )

  // Alumnes amb PI, per classe i endreçats per cognom dins de cada una
  // (el nom es desa "Cognom, Nom", així que ordenar pel nom tal qual ja
  // ordena per cognom). El filtre d'àrea només afecta aquest bloc: l'AD
  // no té àrees.
  const ambPi = useMemo(() => {
    const campFiltre = areaPiFiltrada ? campArea(areaPiFiltrada) : null
    const perClasse = {}
    for (const a of alumnesFiltrats) {
      if (!a.pi) continue
      if (campFiltre && !a[campFiltre]) continue
      if (!perClasse[a.curs]) perClasse[a.curs] = []
      perClasse[a.curs].push(a)
    }
    for (const llista of Object.values(perClasse)) {
      llista.sort((x, y) => (x.nom ?? '').localeCompare(y.nom ?? '', 'ca'))
    }
    return Object.entries(perClasse).sort(([a], [b]) => comparaCursos(a, b))
  }, [alumnesFiltrats, areaPiFiltrada])

  const totalPi = ambPi.reduce((acc, [, llista]) => acc + llista.length, 0)

  // Qualsevol alumne amb alguna dada de l'ESFERA AD (motiu, flag, o algun
  // dels tres tipus), també per classe i cognom.
  const ambAd = useMemo(() => (
    alumnesFiltrats
      .filter((a) => a.adMotiu || a.adFlag || a.adTipusA || a.adTipusB || a.adTipusC)
      .sort((a, b) => comparaCursos(a.curs, b.curs) || (a.nom ?? '').localeCompare(b.nom ?? '', 'ca'))
  ), [alumnesFiltrats])

  // Els mateixos comptadors que el full "ESFERA AD" del centre: percentatge
  // i recompte sobre el total d'alumnes (de la classe filtrada, si n'hi ha
  // una triada; si no, de tot el centre) — així els números quadren amb
  // els que ja coneixen del full original.
  const comptadors = useMemo(() => {
    const total = alumnesFiltrats.length
    const compta = (pred) => {
      const n = alumnesFiltrats.filter(pred).length
      return { n, pct: total > 0 ? (n / total) * 100 : 0 }
    }
    return {
      total,
      motiu: compta((a) => Boolean(a.adMotiu)),
      nese: compta((a) => Boolean(a.adFlag)),
      tipusA: compta((a) => Boolean(a.adTipusA)),
      tipusB: compta((a) => Boolean(a.adTipusB)),
      tipusC: compta((a) => Boolean(a.adTipusC)),
    }
  }, [alumnesFiltrats])

  if (carregant) return <p>Carregant…</p>

  return (
    <div className="module">
      <p className="module-eyebrow">Atenció a la diversitat</p>
      <h2>Atenció a la diversitat</h2>
      <p className="module-lead">
        Primera versió: de moment només mostra el que ja arriba amb el darrer llistat
        d&apos;alumnat pujat a <strong>Alumnes</strong> (fulls &quot;ESFERA PI&quot; i
        &quot;ESFERA AD&quot;) — qui té Pla Individualitzat, i el detall de NESE. Si algú hi
        falta o hi sobra, és qüestió de tornar a pujar el llistat amb aquests dos fulls.
      </p>

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--red)' }}>{missatge.text}</p>
      )}

      <label className="field" style={{ marginTop: 16, maxWidth: 240 }}>
        <span>Filtra per classe</span>
        <select
          value={classeFiltrada}
          onChange={(e) => setClasseFiltrada(e.target.value)}
          style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}
        >
          <option value="">Totes les classes</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>

      <div style={{ overflowX: 'auto', marginTop: 20 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: 480 }}>
          <thead>
            <tr style={{ background: 'var(--bg-soft, #f5f5f0)', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px', fontWeight: 700 }}>
                NESE{classeFiltrada ? ` — ${classeFiltrada}` : ''}
              </th>
              <th style={{ padding: '8px 12px' }}>Amb motiu</th>
              <th style={{ padding: '8px 12px' }}>NESE (flag)</th>
              <th style={{ padding: '8px 12px' }}>Tipus A NEE</th>
              <th style={{ padding: '8px 12px' }}>Tipus B</th>
              <th style={{ padding: '8px 12px' }}>Tipus C</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderTop: '1px solid var(--line)', textAlign: 'right' }}>
              <td style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--ink-soft)' }}>
                {comptadors.total} alumnes
              </td>
              <td style={{ padding: '6px 12px' }}>{comptadors.motiu.pct.toFixed(2)}%</td>
              <td style={{ padding: '6px 12px' }}>{comptadors.nese.pct.toFixed(2)}%</td>
              <td style={{ padding: '6px 12px' }}>{comptadors.tipusA.pct.toFixed(2)}%</td>
              <td style={{ padding: '6px 12px' }}>{comptadors.tipusB.pct.toFixed(2)}%</td>
              <td style={{ padding: '6px 12px' }}>{comptadors.tipusC.pct.toFixed(2)}%</td>
            </tr>
            <tr style={{ textAlign: 'right', fontWeight: 600 }}>
              <td style={{ padding: '2px 12px' }} />
              <td style={{ padding: '2px 12px' }}>{comptadors.motiu.n}</td>
              <td style={{ padding: '2px 12px' }}>{comptadors.nese.n}</td>
              <td style={{ padding: '2px 12px' }}>{comptadors.tipusA.n}</td>
              <td style={{ padding: '2px 12px' }}>{comptadors.tipusB.n}</td>
              <td style={{ padding: '2px 12px' }}>{comptadors.tipusC.n}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 24 }}>
        <button
          type="button"
          onClick={() => setPiObert((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'transparent',
            border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--ink-soft)', width: 14 }}>{piObert ? '▾' : '▸'}</span>
          <h3 style={{ fontSize: 18, margin: 0 }}>
            Alumnes amb PI <span style={{ fontWeight: 400, color: 'var(--ink-soft)', fontSize: 14 }}>({totalPi})</span>
          </h3>
        </button>

        <label className="field" style={{ marginTop: 8, maxWidth: 240 }}>
          <span>Filtra per àrea del PI</span>
          <select
            value={areaPiFiltrada}
            onChange={(e) => setAreaPiFiltrada(e.target.value)}
            style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}
          >
            <option value="">Totes les àrees</option>
            {PI_AREES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </label>

        {piObert && (
          ambPi.length === 0 ? (
            <p className="nota" style={{ marginTop: 8 }}>
              {areaPiFiltrada
                ? `Cap alumne amb PI a ${PI_AREES.find((a) => a.id === areaPiFiltrada)?.label}${classeFiltrada ? ` a ${classeFiltrada}` : ''}.`
                : `Cap alumne amb PI${classeFiltrada ? ` a ${classeFiltrada}` : ''}. Si n'hi hauria d'haver, comprova que el darrer fitxer pujat a Alumnes portava el full "ESFERA PI" — si falta, la pantalla de pujada n'avisa amb un requadre taronja abans de desar.`}
            </p>
          ) : (
            ambPi.map(([curs, llista]) => (
              <div key={curs} style={{ marginTop: 16 }}>
                <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                  {curs} <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}>({llista.length})</span>
                </p>
                <ul className="roster">
                  {llista.map((a) => (
                    <li key={a.id} className="roster-row">
                      <span className="roster-name">{a.nom}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )
        )}
      </div>

      <div style={{ marginTop: 32, borderTop: '1px solid var(--line)', paddingTop: 20 }}>
        <button
          type="button"
          onClick={() => setAdObert((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'transparent',
            border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--ink-soft)', width: 14 }}>{adObert ? '▾' : '▸'}</span>
          <h3 style={{ fontSize: 18, margin: 0 }}>
            Esfera AD — NESE <span style={{ fontWeight: 400, color: 'var(--ink-soft)', fontSize: 14 }}>({ambAd.length})</span>
          </h3>
        </button>
        <p className="nota" style={{ marginTop: 4 }}>
          &quot;NESE&quot; és el flag de la columna F del full (0/1); &quot;Motiu&quot; ve de
          la columna E, en text lliure — no sempre coincideixen (vegeu
          sicAlumnatIndicadors.js).
        </p>

        {adObert && (
          ambAd.length === 0 ? (
            <p className="nota" style={{ marginTop: 8 }}>
              Cap alumne amb dades de NESE{classeFiltrada ? ` a ${classeFiltrada}` : ''}.
            </p>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--line)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>Classe</th>
                    <th style={{ padding: '6px 8px' }}>Alumne</th>
                    <th style={{ padding: '6px 8px' }}>Motiu</th>
                    <th style={{ padding: '6px 8px' }}>NESE</th>
                    <th style={{ padding: '6px 8px' }}>Tipus A</th>
                    <th style={{ padding: '6px 8px' }}>Tipus B</th>
                    <th style={{ padding: '6px 8px' }}>Tipus C</th>
                  </tr>
                </thead>
                <tbody>
                  {ambAd.map((a) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid var(--line)' }}>
                      <td style={{ padding: '6px 8px' }}>{a.curs}</td>
                      <td style={{ padding: '6px 8px' }}>{a.nom}</td>
                      <td style={{ padding: '6px 8px' }}>{a.adMotiu || '—'}</td>
                      <td style={{ padding: '6px 8px' }}>{a.adFlag ? 'Sí' : '—'}</td>
                      <td style={{ padding: '6px 8px' }}>{a.adTipusA ? 'Sí' : '—'}</td>
                      <td style={{ padding: '6px 8px' }}>{a.adTipusB ? 'Sí' : '—'}</td>
                      <td style={{ padding: '6px 8px' }}>{a.adTipusC ? 'Sí' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}
