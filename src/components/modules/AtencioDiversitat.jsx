import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { comparaCursos } from '../../lib/ordreCursos'
import { PI_AREES } from '../../lib/sicAlumnatIndicadors'
import { CICLES, cicleDe } from '../../lib/rubricaTEE'
import { exportaExcel, exportaPDF } from '../../lib/exportTaula'
import { cursEscolarActual } from '../../lib/cursEscolar'

/** "efisica" → "piEfisica", igual que es desa a Firestore des d'Alumnes.jsx. */
function campArea(areaId) {
  return `pi${areaId.charAt(0).toUpperCase()}${areaId.slice(1)}`
}

// Les àrees de PI d'Infantil i de Primària són diferents (vegeu
// sicAlumnatIndicadors.js): "Anglès" es comparteix, la resta no. Per
// això la taula d'alumnes amb PI es divideix en dues, cadascuna amb
// només les columnes que li toquen — una sola taula amb les 12 juntes
// quedava plena de "No" que no volien dir res per a la meitat dels
// alumnes.
const AREES_INFANTIL_IDS = new Set(['descobertaEntorn', 'comunicacioLlenguatges', 'angles', 'descobertaMateix'])
const AREES_PRIMARIA_IDS = new Set(['efisica', 'artistica', 'matematiques', 'castella', 'catala', 'angles', 'religio', 'medi', 'valors'])

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
  const [descarregant, setDescarregant] = useState(null)
  const [missatgeDescarrega, setMissatgeDescarrega] = useState(null)

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

  // Alumnes amb PI, en una llista plana ordenada per classe i cognom
  // (el nom es desa "Cognom, Nom", així que ordenar pel nom tal qual ja
  // ordena per cognom), dividida entre Infantil (I3/I4/I5) i Primària
  // (1r-6è) segons `cicleDe()`. El filtre d'àrea només afecta aquest
  // bloc: l'AD no té àrees.
  const [ambPiInfantil, ambPiPrimaria] = useMemo(() => {
    const campFiltre = areaPiFiltrada ? campArea(areaPiFiltrada) : null
    const llista = alumnesFiltrats
      .filter((a) => a.pi && (!campFiltre || a[campFiltre]))
      .sort((a, b) => comparaCursos(a.curs, b.curs) || (a.nom ?? '').localeCompare(b.nom ?? '', 'ca'))
    const infantil = llista.filter((a) => cicleDe(a.curs) === 'EI')
    const primaria = llista.filter((a) => cicleDe(a.curs) !== 'EI')
    return [infantil, primaria]
  }, [alumnesFiltrats, areaPiFiltrada])

  const totalPi = ambPiInfantil.length + ambPiPrimaria.length

  // Un recompte per cicle (EI/CI/CM/CS) i el sumatori final — sobre TOTS
  // els alumnes amb PI de la classe filtrada, sense el filtre d'àrea:
  // aquest comptador respon "quants alumnes amb PI hi ha a cada cicle",
  // no "quants en una àrea concreta".
  const comptadorsCicle = useMemo(() => {
    const recompte = { EI: 0, CI: 0, CM: 0, CS: 0 }
    for (const a of alumnesFiltrats) {
      if (!a.pi) continue
      recompte[cicleDe(a.curs)] = (recompte[cicleDe(a.curs)] ?? 0) + 1
    }
    return recompte
  }, [alumnesFiltrats])
  const totalPiSenseFiltreArea = comptadorsCicle.EI + comptadorsCicle.CI + comptadorsCicle.CM + comptadorsCicle.CS

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

  /** Un full (files de la taula) per a un grup de PI (Infantil o Primària). */
  function fullPi(alumnesLlista, areesIds) {
    const arees = PI_AREES.filter((a) => areesIds.has(a.id))
    const capcalera = ['Classe', 'Alumne', ...arees.map((a) => a.label)]
    const cos = alumnesLlista.map((a) => [
      a.curs, a.nom, ...arees.map((area) => (a[campArea(area.id)] ? 'Sí' : 'No')),
    ])
    return [capcalera, ...cos]
  }

  /** El full de la taula d'Esfera AD. */
  function fullAd() {
    const capcalera = ['Classe', 'Alumne', 'Motiu', 'NESE', 'Tipus A', 'Tipus B', 'Tipus C']
    const cos = ambAd.map((a) => [
      a.curs, a.nom, a.adMotiu || '', a.adFlag ? 'Sí' : 'No',
      a.adTipusA ? 'Sí' : 'No', a.adTipusB ? 'Sí' : 'No', a.adTipusC ? 'Sí' : 'No',
    ])
    return [capcalera, ...cos]
  }

  async function descarrega(quin, fes) {
    setDescarregant(quin)
    setMissatgeDescarrega(null)
    try {
      await fes()
    } catch (err) {
      setMissatgeDescarrega({ type: 'error', text: `No s'ha pogut generar la descàrrega: ${err.message}` })
    } finally {
      setDescarregant(null)
    }
  }

  const dadesBase = { cursEscolarId: cursEscolarActual(), etiqueta: 'Atenció a la diversitat' }

  function BotonsDescarrega({ id, onExcel, onPdf }) {
    return (
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button
          type="button"
          className="btn-ghost"
          style={{ fontSize: 12, padding: '5px 12px', color: 'var(--navy)', borderColor: 'var(--navy)' }}
          onClick={() => descarrega(`${id}-excel`, onExcel)}
          disabled={descarregant !== null}
        >
          {descarregant === `${id}-excel` ? 'Generant…' : '📥 Excel'}
        </button>
        <button
          type="button"
          className="btn-ghost"
          style={{ fontSize: 12, padding: '5px 12px', color: 'var(--navy)', borderColor: 'var(--navy)' }}
          onClick={() => descarrega(`${id}-pdf`, onPdf)}
          disabled={descarregant !== null}
        >
          {descarregant === `${id}-pdf` ? 'Generant…' : '📄 PDF'}
        </button>
      </div>
    )
  }

  /** Una taula d'alumnes amb PI, amb només les columnes d'àrea que li
   *  toquen (Infantil o Primària). */
  function TaulaPi({ titol, alumnesLlista, areesIds }) {
    const arees = PI_AREES.filter((a) => areesIds.has(a.id))
    return (
      <div style={{ marginTop: 20 }}>
        <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
          {titol} <span style={{ fontWeight: 400, color: 'var(--ink-soft)', fontSize: 13 }}>({alumnesLlista.length})</span>
        </p>
        {alumnesLlista.length === 0 ? (
          <p className="nota">
            Cap alumne{areaPiFiltrada ? ` amb PI a ${PI_AREES.find((a) => a.id === areaPiFiltrada)?.label}` : ' amb PI'}
            {classeFiltrada ? ` a ${classeFiltrada}` : ''} en aquest grup.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: 480 }}>
              <thead>
                <tr style={{ background: 'var(--bg-soft, #f5f5f0)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>Classe</th>
                  <th style={{ padding: '6px 8px' }}>Alumne</th>
                  {arees.map((a) => (
                    <th key={a.id} style={{ padding: '6px 8px', fontWeight: 600 }}>{a.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alumnesLlista.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 8px' }}>{a.curs}</td>
                    <td style={{ padding: '6px 8px' }}>{a.nom}</td>
                    {arees.map((area) => {
                      const hiEs = Boolean(a[campArea(area.id)])
                      return (
                        <td
                          key={area.id}
                          style={{ padding: '6px 8px', background: hiEs ? 'var(--green-soft, #d6f5df)' : undefined, fontWeight: hiEs ? 600 : 400 }}
                        >
                          {hiEs ? 'Sí' : 'No'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

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

      <div className="caixa" style={{ marginTop: 20 }}>
        <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>
          NESE{classeFiltrada ? ` — ${classeFiltrada}` : ''}
          <span style={{ fontWeight: 400, color: 'var(--ink-soft)', fontSize: 13 }}> · {comptadors.total} alumnes</span>
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 12 }}>
          {[
            { label: 'Amb motiu', ...comptadors.motiu },
            { label: 'NESE (flag)', ...comptadors.nese },
            { label: 'Tipus A NEE', ...comptadors.tipusA },
            { label: 'Tipus B', ...comptadors.tipusB },
            { label: 'Tipus C', ...comptadors.tipusC },
          ].map((c) => (
            <div key={c.label} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '14px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--navy)', lineHeight: 1.1 }}>{c.pct.toFixed(1)}%</div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>{c.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{c.n} alumnes</div>
            </div>
          ))}
        </div>
      </div>

      <div className="caixa" style={{ marginTop: 16 }}>
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
        <BotonsDescarrega
          id="ad"
          onExcel={() => exportaExcel('Esfera AD - NESE', { ...dadesBase, fulls: [{ nom: 'Esfera AD', files: fullAd() }] })}
          onPdf={() => exportaPDF('Esfera AD - NESE', { ...dadesBase, fulls: [{ nom: 'Esfera AD', files: fullAd() }] })}
        />

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
        {missatgeDescarrega && (
          <p style={{ marginTop: 8, fontSize: 12, color: missatgeDescarrega.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
            {missatgeDescarrega.text}
          </p>
        )}
      </div>

      <div className="caixa" style={{ marginTop: 16 }}>
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
        <BotonsDescarrega
          id="pi"
          onExcel={() => exportaExcel('Alumnes amb PI', {
            ...dadesBase,
            fulls: [
              { nom: 'PI Infantil', files: fullPi(ambPiInfantil, AREES_INFANTIL_IDS) },
              { nom: 'PI Primària', files: fullPi(ambPiPrimaria, AREES_PRIMARIA_IDS) },
            ],
          })}
          onPdf={() => exportaPDF('Alumnes amb PI', {
            ...dadesBase,
            fulls: [
              { nom: 'PI Infantil', files: fullPi(ambPiInfantil, AREES_INFANTIL_IDS) },
              { nom: 'PI Primària', files: fullPi(ambPiPrimaria, AREES_PRIMARIA_IDS) },
            ],
          })}
        />

        <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
          <label className="field" style={{ maxWidth: 240 }}>
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
          <label className="field" style={{ maxWidth: 240 }}>
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
        </div>

        {piObert && (
          <>
            <div style={{ overflowX: 'auto', marginTop: 16 }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-soft, #f5f5f0)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 12px', fontWeight: 700 }}>PI per cicle</th>
                    {Object.entries(CICLES).map(([id, label]) => <th key={id} style={{ padding: '6px 12px' }}>{label}</th>)}
                    <th style={{ padding: '6px 12px', fontWeight: 700 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 12px', color: 'var(--ink-soft)' }}>
                      Alumnes{classeFiltrada ? ` — ${classeFiltrada}` : ''}
                    </td>
                    {Object.keys(CICLES).map((id) => (
                      <td key={id} style={{ padding: '6px 12px' }}>{comptadorsCicle[id]}</td>
                    ))}
                    <td style={{ padding: '6px 12px', fontWeight: 700 }}>{totalPiSenseFiltreArea}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <TaulaPi titol="Educació Infantil" alumnesLlista={ambPiInfantil} areesIds={AREES_INFANTIL_IDS} />
            <TaulaPi titol="Primària" alumnesLlista={ambPiPrimaria} areesIds={AREES_PRIMARIA_IDS} />
          </>
        )}
      </div>
    </div>
  )
}
