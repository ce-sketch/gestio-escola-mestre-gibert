import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { db, auth } from '../../firebase'
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
  const [piObert, setPiObert] = useState(false)
  const [adObert, setAdObert] = useState(false)
  const [sieiObert, setSieiObert] = useState(false)
  const [eeObert, setEeObert] = useState(false)
  const [descarregant, setDescarregant] = useState(null)
  const [missatgeDescarrega, setMissatgeDescarrega] = useState(null)

  async function carregaAlumnes() {
    const snap = await getDocs(query(collection(db, 'alumnes'), where('actiu', '==', true)))
    setAlumnes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  }

  useEffect(() => {
    async function carrega() {
      try {
        await carregaAlumnes()
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

  /** El full de resum (percentatges i totals) de l'ESFERA AD — els
   *  mateixos comptadors que ja es veuen a la pantalla, perquè la
   *  descàrrega no en sigui només la llista sense el context. */
  function fullResumAd() {
    return [
      ['Indicador', 'Percentatge', 'Alumnes'],
      ['Total alumnes', '', comptadors.total],
      ['Amb motiu', `${comptadors.motiu.pct.toFixed(2)}%`, comptadors.motiu.n],
      ['NESE (flag)', `${comptadors.nese.pct.toFixed(2)}%`, comptadors.nese.n],
      ['Tipus A NEE', `${comptadors.tipusA.pct.toFixed(2)}%`, comptadors.tipusA.n],
      ['Tipus B', `${comptadors.tipusB.pct.toFixed(2)}%`, comptadors.tipusB.n],
      ['Tipus C', `${comptadors.tipusC.pct.toFixed(2)}%`, comptadors.tipusC.n],
    ]
  }

  /** El full de resum (recompte per cicle) del PI — el mateix que ja es
   *  veu a la pantalla. */
  function fullResumPi() {
    return [
      ['Cicle', 'Alumnes amb PI'],
      ...Object.entries(CICLES).map(([id, label]) => [label, comptadorsCicle[id]]),
      ['Total', totalPiSenseFiltreArea],
    ]
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

  /**
   * Dona d'alta o de baixa un alumne per a SIEI o EE. Actualitza el camp
   * a `alumnes` (el mateix `siei` que ja fa servir la llegenda de colors
   * de TEE/Lectura — així una alta manual també hi surt destacada), i
   * deixa constància a `diversitatHistoric`, que mai s'esborra: una baixa
   * no fa desaparèixer que l'alumne hi va ser d'alta, ni quan.
   *
   * ⚠️ Si algú torna a pujar el fitxer SIEI ("14b. Alumnes NESE") a
   * Alumnes, el camp `siei` es torna a sobreescriure amb el que digui
   * aquell fitxer — una alta o baixa feta aquí manualment es podria
   * perdre en la propera pujada. És un compromís conegut, no un bug.
   */
  async function canviaEstat(alumne, tipus, accio) {
    const camp = tipus === 'SIEI' ? 'siei' : 'ee'
    await updateDoc(doc(db, 'alumnes', alumne.id), { [camp]: accio === 'alta' })
    await addDoc(collection(db, 'diversitatHistoric'), {
      alumneId: alumne.id,
      nom: alumne.nom,
      curs: alumne.curs,
      tipus,
      accio,
      data: serverTimestamp(),
      fetPer: auth.currentUser?.email ?? null,
    })
    await carregaAlumnes()
  }

  /** Bloc d'alta/baixa manual per a SIEI o EE: la llista dels qui hi són
   *  ara, un selector de classe + alumne per donar-ne d'alta un de nou, i
   *  un històric consultable (mai s'hi esborra res). */
  function BlocGestioManual({ tipus, camp, titol, obert, setObert }) {
    const [classeAlta, setClasseAlta] = useState('')
    const [alumneAltaId, setAlumneAltaId] = useState('')
    const [donant, setDonant] = useState(null) // id de l'alumne en procés d'alta/baixa
    const [error, setError] = useState(null)
    const [historicObert, setHistoricObert] = useState(false)
    const [historic, setHistoric] = useState(null) // null = encara no carregat

    const actius = useMemo(
      () => alumnes
        .filter((a) => a[camp])
        .sort((a, b) => comparaCursos(a.curs, b.curs) || (a.nom ?? '').localeCompare(b.nom ?? '', 'ca')),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [alumnes]
    )
    const candidats = useMemo(
      () => alumnes
        .filter((a) => a.curs === classeAlta && !a[camp])
        .sort((a, b) => (a.nom ?? '').localeCompare(b.nom ?? '', 'ca')),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [alumnes, classeAlta]
    )

    async function donaAlta() {
      const alumne = alumnes.find((a) => a.id === alumneAltaId)
      if (!alumne) return
      setError(null)
      setDonant(alumne.id)
      try {
        await canviaEstat(alumne, tipus, 'alta')
        setClasseAlta('')
        setAlumneAltaId('')
      } catch (err) {
        setError(`No s'ha pogut donar d'alta: ${err.message}`)
      } finally {
        setDonant(null)
      }
    }

    async function donaBaixa(alumne) {
      setError(null)
      setDonant(alumne.id)
      try {
        await canviaEstat(alumne, tipus, 'baixa')
      } catch (err) {
        setError(`No s'ha pogut donar de baixa: ${err.message}`)
      } finally {
        setDonant(null)
      }
    }

    async function obreHistoric() {
      const nouEstat = !historicObert
      setHistoricObert(nouEstat)
      if (nouEstat && historic === null) {
        try {
          const snap = await getDocs(query(
            collection(db, 'diversitatHistoric'),
            where('tipus', '==', tipus),
            orderBy('data', 'desc'),
            limit(100)
          ))
          setHistoric(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        } catch (err) {
          setError(`No s'ha pogut carregar l'històric: ${err.message}`)
        }
      }
    }

    return (
      <div className="caixa" style={{ marginTop: 16 }}>
        <button
          type="button"
          onClick={() => setObert((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'transparent',
            border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--ink-soft)', width: 14 }}>{obert ? '▾' : '▸'}</span>
          <h3 style={{ fontSize: 18, margin: 0 }}>
            {titol} <span style={{ fontWeight: 400, color: 'var(--ink-soft)', fontSize: 14 }}>({actius.length})</span>
          </h3>
        </button>

        {obert && (
          <>
            {error && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 8 }}>{error}</p>}

            <div className="caixa-discreta" style={{ marginTop: 12 }}>
              <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Dona d&apos;alta un alumne</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <label className="field" style={{ maxWidth: 200 }}>
                  <span>Classe</span>
                  <select
                    value={classeAlta}
                    onChange={(e) => { setClasseAlta(e.target.value); setAlumneAltaId('') }}
                    style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}
                  >
                    <option value="">Tria una classe</option>
                    {classes.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="field" style={{ maxWidth: 260 }}>
                  <span>Alumne</span>
                  <select
                    value={alumneAltaId}
                    onChange={(e) => setAlumneAltaId(e.target.value)}
                    disabled={!classeAlta}
                    style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}
                  >
                    <option value="">
                      {classeAlta ? (candidats.length ? 'Tria un alumne' : `Ja hi són tots a ${titol}`) : 'Primer tria la classe'}
                    </option>
                    {candidats.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ padding: '8px 16px', color: 'var(--navy)', borderColor: 'var(--navy)' }}
                  onClick={donaAlta}
                  disabled={!alumneAltaId || donant !== null}
                >
                  {donant === alumneAltaId ? 'Donant d\'alta…' : 'Dona d\'alta'}
                </button>
              </div>
            </div>

            {actius.length === 0 ? (
              <p className="nota" style={{ marginTop: 12 }}>Cap alumne d&apos;alta a {titol} ara mateix.</p>
            ) : (
              <ul className="roster" style={{ marginTop: 12 }}>
                {actius.map((a) => (
                  <li key={a.id} className="roster-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      <span className="roster-name">{a.nom}</span>
                      <span style={{ fontSize: 12, color: 'var(--ink-soft)', marginLeft: 8 }}>{a.curs}</span>
                    </span>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ fontSize: 12, padding: '4px 10px', color: 'var(--red)', borderColor: 'var(--red)' }}
                      onClick={() => donaBaixa(a)}
                      disabled={donant !== null}
                    >
                      {donant === a.id ? 'Donant de baixa…' : 'Dona de baixa'}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={obreHistoric}
              style={{
                marginTop: 14, background: 'transparent', border: 'none', padding: 0,
                cursor: 'pointer', fontSize: 13, color: 'var(--navy)', textDecoration: 'underline',
              }}
            >
              {historicObert ? 'Amaga' : 'Mostra'} l&apos;històric d&apos;altes i baixes
            </button>

            {historicObert && (
              historic === null ? (
                <p className="nota" style={{ marginTop: 8 }}>Carregant…</p>
              ) : historic.length === 0 ? (
                <p className="nota" style={{ marginTop: 8 }}>Encara no hi ha cap moviment desat.</p>
              ) : (
                <div style={{ overflowX: 'auto', marginTop: 8 }}>
                  <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: 420 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--line)', textAlign: 'left' }}>
                        <th style={{ padding: '4px 8px' }}>Data</th>
                        <th style={{ padding: '4px 8px' }}>Alumne</th>
                        <th style={{ padding: '4px 8px' }}>Classe</th>
                        <th style={{ padding: '4px 8px' }}>Acció</th>
                        <th style={{ padding: '4px 8px' }}>Fet per</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historic.map((h) => {
                        const data = h.data?.seconds ? new Date(h.data.seconds * 1000) : null
                        return (
                          <tr key={h.id} style={{ borderBottom: '1px solid var(--line)' }}>
                            <td style={{ padding: '4px 8px' }}>{data ? data.toLocaleString('ca-ES') : '—'}</td>
                            <td style={{ padding: '4px 8px' }}>{h.nom}</td>
                            <td style={{ padding: '4px 8px' }}>{h.curs}</td>
                            <td style={{ padding: '4px 8px', color: h.accio === 'alta' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                              {h.accio === 'alta' ? 'Alta' : 'Baixa'}
                            </td>
                            <td style={{ padding: '4px 8px' }}>{h.fetPer ?? '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </>
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
          onExcel={() => exportaExcel('Esfera AD - NESE', { ...dadesBase, fulls: [{ nom: 'Resum', files: fullResumAd() }, { nom: 'Esfera AD', files: fullAd() }] })}
          onPdf={() => exportaPDF('Esfera AD - NESE', { ...dadesBase, fulls: [{ nom: 'Resum', files: fullResumAd() }, { nom: 'Esfera AD', files: fullAd() }] })}
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
              { nom: 'Resum', files: fullResumPi() },
              { nom: 'PI Infantil', files: fullPi(ambPiInfantil, AREES_INFANTIL_IDS) },
              { nom: 'PI Primària', files: fullPi(ambPiPrimaria, AREES_PRIMARIA_IDS) },
            ],
          })}
          onPdf={() => exportaPDF('Alumnes amb PI', {
            ...dadesBase,
            fulls: [
              { nom: 'Resum', files: fullResumPi() },
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

      <BlocGestioManual tipus="SIEI" camp="siei" titol="Alumnat SIEI" obert={sieiObert} setObert={setSieiObert} />
      <BlocGestioManual tipus="EE" camp="ee" titol="Alumnat d'Educació Especial (EE)" obert={eeObert} setObert={setEeObert} />
    </div>
  )
}
