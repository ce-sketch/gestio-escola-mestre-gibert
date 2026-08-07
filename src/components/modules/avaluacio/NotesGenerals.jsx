import { useEffect, useMemo, useState } from 'react'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../../../firebase'
import { NIVELLS, nivellDe, redueixVigents } from '../../../lib/avaluacioCatala'
import { AREES, TRIMESTRES, areaAplicaAClasse } from '../../../lib/notesArea'
import { cursEscolarActual, NIVELLS_ESCOLARS, nivellEscolarDe } from '../../../lib/cursEscolar'

const VISTES = [
  { id: 'entrada', label: 'Entrada de notes' },
  { id: 'resum', label: 'Resum per curs' },
]

export default function NotesGenerals() {
  const [vista, setVista] = useState('entrada')
  const [alumnesTots, setAlumnesTots] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [registres, setRegistres] = useState([])
  const [missatge, setMissatge] = useState(null)

  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [trimestre, setTrimestre] = useState(TRIMESTRES[0])
  const [classe, setClasse] = useState('')
  const [nivellResum, setNivellResum] = useState(NIVELLS_ESCOLARS[0].label)
  const [valors, setValors] = useState({})
  const [desant, setDesant] = useState(false)

  useEffect(() => {
    async function carrega() {
      try {
        const [snapAlumnes, snapNotes] = await Promise.all([
          getDocs(query(collection(db, 'alumnes'), where('actiu', '==', true))),
          // Filtrem només per 'tipus' aquí (sense combinar més camps en la
          // consulta) per no necessitar crear cap índex compost nou a
          // Firestore. Amb el volum d'alumnes del centre, filtrar la resta
          // (curs escolar, trimestre, classe...) al navegador va prou bé.
          getDocs(query(collection(db, 'avaluacio'), where('tipus', '==', 'nota_area'))),
        ])
        const llista = snapAlumnes.docs.map((d) => ({ id: d.id, ...d.data() }))
        llista.sort((a, b) => (a.numLlista ?? 999) - (b.numLlista ?? 999) || a.nom.localeCompare(b.nom))
        setAlumnesTots(llista)
        if (llista.length > 0) setClasse((c) => c || llista[0].curs)
        setRegistres(snapNotes.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'han pogut carregar les dades: ${err.message}` })
      } finally {
        setCarregant(false)
      }
    }
    carrega()
  }, [])

  const classes = useMemo(() => [...new Set(alumnesTots.map((a) => a.curs))].sort(), [alumnesTots])
  const alumnesClasse = useMemo(() => alumnesTots.filter((a) => a.curs === classe), [alumnesTots, classe])
  const areesClasse = useMemo(() => AREES.filter((a) => areaAplicaAClasse(a.id, classe)), [classe])

  // Vigents per a l'entrada actual (classe + trimestre + curs escolar), amb
  // TOTES les àrees alhora — clau alumne+àrea, tal com als fulls per classe
  // de l'Excel (1A, 1B...), on cada alumne té una columna per àrea.
  const vigentsEntrada = useMemo(
    () => redueixVigents(
      registres.filter((r) =>
        r.curs === classe &&
        r.trimestre === trimestre &&
        (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId
      ),
      (r) => `${r.alumneId}__${r.area}`
    ),
    [registres, classe, trimestre, cursEscolarId]
  )

  function clauValor(alumneId, areaId) {
    return `${alumneId}__${areaId}`
  }

  function notaAlumne(alumneId, areaId) {
    const clau = clauValor(alumneId, areaId)
    if (valors[clau] !== undefined) return valors[clau]
    const existent = vigentsEntrada.find((r) => r.alumneId === alumneId && r.area === areaId)
    return existent?.nota ?? ''
  }

  async function desaTot() {
    setDesant(true)
    setMissatge(null)
    let desats = 0
    try {
      for (const alumne of alumnesClasse) {
        for (const a of areesClasse) {
          const clau = clauValor(alumne.id, a.id)
          const valor = valors[clau]
          if (valor === undefined || valor === '') continue
          const nota = Number(valor)
          if (Number.isNaN(nota)) continue
          await addDoc(collection(db, 'avaluacio'), {
            tipus: 'nota_area',
            area: a.id,
            alumneId: alumne.id,
            alumneNom: alumne.nom,
            curs: classe,
            cursEscolar: cursEscolarId,
            trimestre,
            nota,
            creatEl: serverTimestamp(),
            creatPer: auth.currentUser?.email ?? null,
          })
          desats += 1
        }
      }
      setValors({})
      const snapNotes = await getDocs(query(collection(db, 'avaluacio'), where('tipus', '==', 'nota_area')))
      setRegistres(snapNotes.docs.map((d) => ({ id: d.id, ...d.data() })))
      setMissatge({ type: 'ok', text: `${desats} notes desades.` })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar: ${err.message}` })
    } finally {
      setDesant(false)
    }
  }

  // ---- Resum per curs (agrupa totes les classes A/B d'un mateix nivell) ----

  const alumnesDelNivell = useMemo(
    () => alumnesTots.filter((a) => nivellEscolarDe(a.curs) === nivellResum),
    [alumnesTots, nivellResum]
  )

  const vigentsResum = useMemo(
    () => redueixVigents(
      registres.filter((r) =>
        (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId &&
        r.trimestre === trimestre &&
        nivellEscolarDe(r.curs) === nivellResum
      ),
      (r) => `${r.alumneId}__${r.area}`
    ),
    [registres, cursEscolarId, trimestre, nivellResum]
  )

  const digitNivellResum = useMemo(
    () => NIVELLS_ESCOLARS.find((n) => n.label === nivellResum)?.id,
    [nivellResum]
  )
  const areesResum = useMemo(
    () => AREES.filter((a) => areaAplicaAClasse(a.id, digitNivellResum)),
    [digitNivellResum]
  )

  const resumPerArea = useMemo(() => {
    const files = areesResum.map((a) => {
      const notesArea = vigentsResum.filter((r) => r.area === a.id)
      const comptes = { no_assoliment: 0, assoliment_satisfactori: 0, assoliment_notable: 0, 'assoliment_excel·lent': 0 }
      for (const r of notesArea) {
        const nivell = nivellDe(r.nota)
        if (nivell) comptes[nivell.id] += 1
      }
      return { area: a, avaluats: notesArea.length, comptes }
    })

    // "Artística" no s'introdueix mai directament: és la mitjana de Plàstica
    // i Música, calculada al moment, igual que la columna "GF" del teu
    // Excel. Només es compta un alumne si té les DUES notes d'aquest
    // trimestre — igual que la fórmula original. Plàstica i Música es
    // mantenen com a files pròpies i separades (no es toquen).
    const perAlumne = new Map()
    for (const r of vigentsResum) {
      if (r.area !== 'plastica' && r.area !== 'musica') continue
      if (!perAlumne.has(r.alumneId)) perAlumne.set(r.alumneId, {})
      perAlumne.get(r.alumneId)[r.area] = r.nota
    }
    const comptesArtistica = { no_assoliment: 0, assoliment_satisfactori: 0, assoliment_notable: 0, 'assoliment_excel·lent': 0 }
    let avaluatsArtistica = 0
    for (const valors of perAlumne.values()) {
      if (valors.plastica === undefined || valors.musica === undefined) continue
      const mitjana = (valors.plastica + valors.musica) / 2
      const nivell = nivellDe(mitjana)
      if (nivell) comptesArtistica[nivell.id] += 1
      avaluatsArtistica += 1
    }
    if (avaluatsArtistica > 0) {
      files.push({
        area: { id: 'artistica', label: 'Artística (mitjana Plàstica+Música)' },
        avaluats: avaluatsArtistica,
        comptes: comptesArtistica,
        calculada: true,
      })
    }
    return files
  }, [vigentsResum, areesResum])

  // Alumnes amb almenys una àrea en "No Assoliment" aquest trimestre.
  const alumnesAmbSuspeses = useMemo(() => {
    const perAlumne = new Map()
    for (const r of vigentsResum) {
      const nivell = nivellDe(r.nota)
      if (nivell?.id !== 'no_assoliment') continue
      const areaLabel = AREES.find((a) => a.id === r.area)?.label ?? r.area
      if (!perAlumne.has(r.alumneId)) perAlumne.set(r.alumneId, { nom: r.alumneNom, arees: [] })
      perAlumne.get(r.alumneId).arees.push(areaLabel)
    }
    return [...perAlumne.values()].sort((a, b) => b.arees.length - a.arees.length)
  }, [vigentsResum])

  if (carregant) return <p>Carregant…</p>

  return (
    <div>
      <p className="module-lead">
        Notes de totes les àrees (no només Català), amb resum per curs (agrupant classes A i B
        d'un mateix nivell) igual que a la graella de nota mitjana d'àrea.
      </p>

      <div style={{ display: 'flex', gap: 8, marginTop: 20, borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
        {VISTES.map((v) => (
          <button
            key={v.id}
            onClick={() => setVista(v.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: vista === v.id ? '2px solid var(--navy)' : '2px solid transparent',
              padding: '10px 4px',
              marginRight: 16,
              fontWeight: vista === v.id ? 600 : 500,
              color: vista === v.id ? 'var(--navy)' : 'var(--ink-soft)',
              cursor: 'pointer',
              fontSize: 14,
            }}
            type="button"
          >
            {v.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
        <label className="field" style={{ minWidth: 120 }}>
          <span>Curs escolar</span>
          <input
            type="text"
            value={cursEscolarId}
            onChange={(e) => setCursEscolarId(e.target.value)}
            style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px', fontWeight: 600 }}
          />
        </label>
        <label className="field" style={{ minWidth: 160 }}>
          <span>Trimestre</span>
          <select value={trimestre} onChange={(e) => setTrimestre(e.target.value)} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
            {TRIMESTRES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        {vista === 'entrada' && (
          <label className="field" style={{ minWidth: 160 }}>
            <span>Classe</span>
            <select value={classe} onChange={(e) => setClasse(e.target.value)} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}

        {vista === 'resum' && (
          <label className="field" style={{ minWidth: 120 }}>
            <span>Curs (nivell)</span>
            <select value={nivellResum} onChange={(e) => setNivellResum(e.target.value)} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 8 }}>
              {NIVELLS_ESCOLARS.map((n) => <option key={n.id} value={n.label}>{n.label}</option>)}
            </select>
          </label>
        )}
      </div>

      {vista === 'entrada' ? (
        <>
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
            Vora vermella = nota per sota de 5 (No Assoliment), igual que al full de càlcul.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', marginTop: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                  <th style={{ padding: '6px 8px', minWidth: 180, position: 'sticky', left: 0, background: 'var(--bg)' }}>Alumne</th>
                  {areesClasse.map((a) => (
                    <th key={a.id} style={{ padding: '6px 4px', minWidth: 70, fontSize: 11 }}>{a.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alumnesClasse.map((alumne) => (
                  <tr key={alumne.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 500, position: 'sticky', left: 0, background: 'var(--bg)' }}>{alumne.nom}</td>
                    {areesClasse.map((a) => {
                      const nota = notaAlumne(alumne.id, a.id)
                      const nivell = nota !== '' ? nivellDe(Number(nota)) : null
                      return (
                        <td key={a.id} style={{ padding: '4px 3px' }}>
                          <input
                            type="number"
                            min={0}
                            max={10}
                            step={0.1}
                            value={nota}
                            onChange={(e) => setValors((prev) => ({ ...prev, [clauValor(alumne.id, a.id)]: e.target.value }))}
                            style={{
                              border: `1.5px solid ${nivell?.id === 'no_assoliment' ? 'var(--red)' : 'var(--line)'}`,
                              borderRadius: 6,
                              padding: '4px 4px',
                              fontSize: 12,
                              width: 56,
                            }}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button className="btn-primary" style={{ marginTop: 20, maxWidth: 220 }} onClick={desaTot} disabled={desant}>
            {desant ? 'Desant…' : 'Desa notes de la classe'}
          </button>
        </>
      ) : (
        <>
          <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', marginTop: 20 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                <th style={{ padding: '6px 8px', minWidth: 140 }}>Àrea</th>
                {NIVELLS.map((n) => <th key={n.id} style={{ padding: '6px 8px', color: n.color }}>{n.curt}</th>)}
                <th style={{ padding: '6px 8px' }}>Avaluats</th>
                <th style={{ padding: '6px 8px' }}>Sense nota</th>
              </tr>
            </thead>
            <tbody>
              {resumPerArea.map(({ area: a, avaluats, comptes, calculada }) => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--line)', fontStyle: calculada ? 'italic' : 'normal' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 500, color: calculada ? 'var(--ink-soft)' : 'inherit' }}>{a.label}</td>
                  {NIVELLS.map((n) => (
                    <td key={n.id} style={{ padding: '6px 8px' }}>{comptes[n.id]}</td>
                  ))}
                  <td style={{ padding: '6px 8px' }}>{avaluats}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--ink-soft)' }}>
                    {alumnesDelNivell.length - avaluats}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p style={{ marginTop: 24, fontWeight: 600, fontSize: 13 }}>
            Alumnes amb àrees no superades ({nivellResum}, {trimestre})
          </p>
          {alumnesAmbSuspeses.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 6 }}>Cap alumne amb àrees no superades.</p>
          ) : (
            <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', marginTop: 10 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                  <th style={{ padding: '6px 8px' }}>Alumne</th>
                  <th style={{ padding: '6px 8px' }}>Àrees no superades</th>
                </tr>
              </thead>
              <tbody>
                {alumnesAmbSuspeses.map((a) => (
                  <tr key={a.nom} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 500 }}>{a.nom}</td>
                    <td style={{ padding: '6px 8px', color: 'var(--red)' }}>{a.arees.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
          {missatge.text}
        </p>
      )}
    </div>
  )
}
