import { useEffect, useMemo, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../../firebase'
import { redueixVigents } from '../../../lib/avaluacioCatala'
import { NIVELLS_PER_CICLE, cicleDe, aEscalaComuna } from '../../../lib/rubricaTEE'
import { MOMENTS_LECTURA, vlAEscalaComuna, grauPrimaria } from '../../../lib/rubricaLectura'
import { cursEscolarActual } from '../../../lib/cursEscolar'
import { exportaExcel, exportaPDF } from '../../../lib/exportTaula'

const TRIMESTRES = ['1r trimestre', '2n trimestre', '3r trimestre']
const COLUMNES_COMUNES = [
  { id: 'no_assoliment', label: 'No Assoliment' },
  { id: 'assoliment_satisfactori', label: 'Ass. Satisfactori' },
  { id: 'assoliment_notable', label: 'Ass. Notable' },
  { id: 'assoliment_excel·lent', label: 'Ass. Excel·lent' },
]
const COLUMNES_CL = ['BAIX', 'M.BAIX', 'M.ALT', 'ALT']

export default function Resum() {
  const [alumnesTots, setAlumnesTots] = useState([])
  const [teeRegistres, setTeeRegistres] = useState([])
  const [lecturaRegistres, setLecturaRegistres] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [trimestre, setTrimestre] = useState('1r trimestre')
  const [missatge, setMissatge] = useState(null)

  useEffect(() => {
    async function carrega() {
      try {
        const [snapAlumnes, snapAvaluacio] = await Promise.all([
          getDocs(query(collection(db, 'alumnes'), where('actiu', '==', true))),
          // Filtrat pel curs escolar: la col·lecció "avaluacio" només
          // creix (cada correcció hi afegeix una fila nova), i sense filtre
          // aquesta pantalla acabaria descarregant tots els cursos passats.
          getDocs(query(collection(db, 'avaluacio'), where('cursEscolar', '==', cursEscolarId))),
        ])
        setAlumnesTots(snapAlumnes.docs.map((d) => ({ id: d.id, ...d.data() })))
        const totes = snapAvaluacio.docs.map((d) => ({ id: d.id, ...d.data() }))
        setTeeRegistres(totes.filter((r) => r.tipus === 'tee'))
        setLecturaRegistres(totes.filter((r) => r.tipus === 'lectura'))
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'han pogut carregar les dades: ${err.message}` })
      } finally {
        setCarregant(false)
      }
    }
    carrega()
  }, [cursEscolarId])

  const cursos = useMemo(
    () => [...new Set(alumnesTots.map((a) => a.curs))].filter((c) => grauPrimaria(c) !== null).sort(),
    [alumnesTots]
  )

  /** Suma totes les files d'un resum en un únic total global — amb l'opció
   *  d'excloure 1r (que fa servir un criteri diferent, sense curs inferior
   *  amb què comparar-se, així que sovint interessa veure'l a part). */
  function totalGlobal(files, columnes, excloure1r) {
    const ids = columnes.map((c) => c.id ?? c)
    const comptadors = Object.fromEntries(ids.map((id) => [id, 0]))
    let total = 0
    files.forEach((f) => {
      if (excloure1r && grauPrimaria(f.curs) === 1) return
      for (const id of ids) comptadors[id] += f.comptadors[id]
      total += f.total
    })
    return { comptadors, total }
  }

  function FilaTotal({ label, files, columnes }) {
    const ambPrimer = totalGlobal(files, columnes, false)
    const sensePrimer = totalGlobal(files, columnes, true)
    const ids = columnes.map((c) => c.id ?? c)
    return (
      <>
        <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-soft, #f5f5f0)' }}>
          <td style={{ padding: '6px 8px', fontWeight: 700 }}>{label} — TOTAL (amb 1r)</td>
          {ids.map((id) => <td key={id} style={{ padding: '6px 8px', fontWeight: 700 }}>{ambPrimer.comptadors[id]}</td>)}
          <td style={{ padding: '6px 8px', fontWeight: 700 }}>{ambPrimer.total}</td>
        </tr>
        <tr style={{ borderBottom: '2px solid var(--line)', background: 'var(--bg-soft, #f5f5f0)' }}>
          <td style={{ padding: '6px 8px', fontWeight: 700 }}>{label} — TOTAL (sense 1r)</td>
          {ids.map((id) => <td key={id} style={{ padding: '6px 8px', fontWeight: 700 }}>{sensePrimer.comptadors[id]}</td>)}
          <td style={{ padding: '6px 8px', fontWeight: 700 }}>{sensePrimer.total}</td>
        </tr>
      </>
    )
  }

  // ---- Resum TEE del trimestre seleccionat ----
  const resumTee = useMemo(() => {
    const delTrimestre = teeRegistres.filter((r) => r.trimestre === trimestre && (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId)
    const vigents = redueixVigents(delTrimestre, (r) => `${r.alumneId}-${r.trimestre}`)
    return cursos.map((curs) => {
      const comptadors = Object.fromEntries(COLUMNES_COMUNES.map((c) => [c.id, 0]))
      vigents.filter((r) => r.curs === curs).forEach((r) => {
        const comu = aEscalaComuna(r.global)
        if (comu) comptadors[comu] += 1
      })
      return { curs, comptadors, total: Object.values(comptadors).reduce((a, b) => a + b, 0) }
    })
  }, [teeRegistres, trimestre, cursos, cursEscolarId])

  // ---- Resum Lectura CL (Inicial i Final) ----
  const resumCl = useMemo(() => {
    return ['inicial', 'final'].map((momentId) => {
      const vigents = redueixVigents(
        lecturaRegistres.filter((r) => r.moment === momentId && (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId),
        (r) => `${r.alumneId}-${momentId}`
      )
      const files = cursos.map((curs) => {
        const comptadors = Object.fromEntries(COLUMNES_CL.map((c) => [c, 0]))
        vigents.filter((r) => r.curs === curs && r.nivellCl).forEach((r) => {
          comptadors[r.nivellCl] += 1
        })
        return { curs, comptadors, total: Object.values(comptadors).reduce((a, b) => a + b, 0) }
      })
      return { momentId, label: MOMENTS_LECTURA.find((m) => m.id === momentId)?.label, files }
    })
  }, [lecturaRegistres, cursos, cursEscolarId])

  // ---- Resum Velocitat Lectora (VL), amb la fórmula real (comparació amb el propi curs) ----
  const resumVl = useMemo(() => {
    return MOMENTS_LECTURA.map((moment) => {
      const vigents = redueixVigents(
        lecturaRegistres.filter((r) => r.moment === moment.id && (r.cursEscolar ?? cursEscolarActual()) === cursEscolarId),
        (r) => `${r.alumneId}-${moment.id}`
      )
      const files = cursos.map((curs) => {
        const comptadors = Object.fromEntries(COLUMNES_COMUNES.map((c) => [c.id, 0]))
        vigents.filter((r) => r.curs === curs && r.vl !== null && r.vl !== undefined).forEach((r) => {
          const comu = vlAEscalaComuna(r.vl, r.nivellVl, curs)
          if (comu) comptadors[comu] += 1
        })
        return { curs, comptadors, total: Object.values(comptadors).reduce((a, b) => a + b, 0) }
      })
      return { moment, files }
    })
  }, [lecturaRegistres, cursos, cursEscolarId])

  if (carregant) return <p>Carregant…</p>

  /** Converteix una taula (files amb .curs/.comptadors/.total) al format
   *  "array de files" que fan servir exportaExcel/exportaPDF, incloent les
   *  dues files de TOTAL (amb 1r i sense 1r). */
  function taulaExportable(capçalera, files, columnes) {
    const ids = columnes.map((c) => c.id ?? c)
    const labels = columnes.map((c) => c.label ?? c)
    const files_ = files.map((f) => [f.curs, ...ids.map((id) => f.comptadors[id]), f.total])
    const ambPrimer = totalGlobal(files, columnes, false)
    const sensePrimer = totalGlobal(files, columnes, true)
    files_.push(['TOTAL (amb 1r)', ...ids.map((id) => ambPrimer.comptadors[id]), ambPrimer.total])
    files_.push(['TOTAL (sense 1r)', ...ids.map((id) => sensePrimer.comptadors[id]), sensePrimer.total])
    return [[capçalera, ...labels, 'Total avaluats'], ...files_]
  }

  function taulesTEE() {
    return [{ nom: `TEE ${trimestre}`, files: taulaExportable('Classe', resumTee, COLUMNES_COMUNES) }]
  }

  function taulesLectura() {
    const fulls = []
    resumCl.forEach(({ label, files }) => {
      fulls.push({ nom: `CL ${label}`, files: taulaExportable('Classe', files, COLUMNES_CL) })
    })
    resumVl.forEach(({ moment, files }) => {
      fulls.push({ nom: `VL ${moment.label}`, files: taulaExportable('Classe', files, COLUMNES_COMUNES) })
    })
    return fulls
  }

  const nomFitxerTEE = `Resum-TEE-${cursEscolarId}-${trimestre.replace(/\s+/g, '_')}`
  const nomFitxerLectura = `Resum-CL-VL-${cursEscolarId}`

  return (
    <div>
      <p className="module-lead">
        Resums globals, equivalents als fulls "Global curs" i "Resum Trimestres" dels
        documents originals. Només inclou cursos de Primària (1r-6è). Cada taula porta,
        a sota de les classes, dues files de TOTAL: una comptant totes les classes, i una
        altra sense 1r (que fa servir un criteri diferent, sense curs inferior amb què
        comparar-se) — igual que es distingia al full de càlcul original.
      </p>

      <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
        <label className="field" style={{ maxWidth: 140 }}>
          <span>Curs escolar</span>
          <input
            type="text"
            value={cursEscolarId}
            onChange={(e) => setCursEscolarId(e.target.value)}
            style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontWeight: 600 }}
          />
        </label>
      </div>

      <h3 style={{ marginTop: 28, fontSize: 16 }}>Resum TEE per classe</h3>
      <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
        <button
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
          onClick={() => exportaExcel(nomFitxerTEE, { cursEscolarId, fulls: taulesTEE() })}
          type="button"
        >
          📥 Descarrega Excel (TEE)
        </button>
        <button
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
          onClick={() => exportaPDF(`Resum TEE — ${trimestre}`, { cursEscolarId, fulls: taulesTEE() })}
          type="button"
        >
          📄 Descarrega PDF (TEE)
        </button>
      </div>
      <label className="field" style={{ maxWidth: 200, marginTop: 8 }}>
        <span>Trimestre</span>
        <select value={trimestre} onChange={(e) => setTrimestre(e.target.value)} style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }}>
          {TRIMESTRES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', marginTop: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
            <th style={{ padding: '6px 8px' }}>Classe</th>
            {COLUMNES_COMUNES.map((c) => <th key={c.id} style={{ padding: '6px 8px' }}>{c.label}</th>)}
            <th style={{ padding: '6px 8px' }}>Total avaluats</th>
          </tr>
        </thead>
        <tbody>
          {resumTee.map((fila) => (
            <tr key={fila.curs} style={{ borderBottom: '1px solid var(--line)' }}>
              <td style={{ padding: '6px 8px', fontWeight: 500 }}>{fila.curs}</td>
              {COLUMNES_COMUNES.map((c) => <td key={c.id} style={{ padding: '6px 8px' }}>{fila.comptadors[c.id]}</td>)}
              <td style={{ padding: '6px 8px', fontWeight: 600 }}>{fila.total}</td>
            </tr>
          ))}
          <FilaTotal label="TEE" files={resumTee} columnes={COLUMNES_COMUNES} />
        </tbody>
      </table>

      <h3 style={{ marginTop: 32, fontSize: 16 }}>Comprensió Lectora (CL) i Velocitat Lectora (VL)</h3>
      <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
        <button
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
          onClick={() => exportaExcel(nomFitxerLectura, { cursEscolarId, fulls: taulesLectura() })}
          type="button"
        >
          📥 Descarrega Excel (CL i VL)
        </button>
        <button
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
          onClick={() => exportaPDF('Resum CL i VL', { cursEscolarId, fulls: taulesLectura() })}
          type="button"
        >
          📄 Descarrega PDF (CL i VL)
        </button>
      </div>

      <h4 style={{ marginTop: 20, fontSize: 14 }}>Comprensió Lectora (CL)</h4>
      {resumCl.map(({ momentId, label, files }) => (
        <div key={momentId} style={{ marginTop: 16 }}>
          <p className="module-note" style={{ fontStyle: 'normal', fontWeight: 600, color: 'var(--ink)' }}>{label}</p>
          <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', marginTop: 8 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                <th style={{ padding: '6px 8px' }}>Classe</th>
                {COLUMNES_CL.map((c) => <th key={c} style={{ padding: '6px 8px' }}>{c}</th>)}
                <th style={{ padding: '6px 8px' }}>Total avaluats</th>
              </tr>
            </thead>
            <tbody>
              {files.map((fila) => (
                <tr key={fila.curs} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 500 }}>{fila.curs}</td>
                  {COLUMNES_CL.map((c) => <td key={c} style={{ padding: '6px 8px' }}>{fila.comptadors[c]}</td>)}
                  <td style={{ padding: '6px 8px', fontWeight: 600 }}>{fila.total}</td>
                </tr>
              ))}
              <FilaTotal label={`CL ${label}`} files={files} columnes={COLUMNES_CL} />
            </tbody>
          </table>
        </div>
      ))}

      <h4 style={{ marginTop: 32, fontSize: 14 }}>Velocitat Lectora (VL)</h4>
      {resumVl.map(({ moment, files }) => (
        <div key={moment.id} style={{ marginTop: 16 }}>
          <p className="module-note" style={{ fontStyle: 'normal', fontWeight: 600, color: 'var(--ink)' }}>{moment.label}</p>
          <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%', marginTop: 8 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--line)' }}>
                <th style={{ padding: '6px 8px' }}>Classe</th>
                {COLUMNES_COMUNES.map((c) => <th key={c.id} style={{ padding: '6px 8px' }}>{c.label}</th>)}
                <th style={{ padding: '6px 8px' }}>Total avaluats</th>
              </tr>
            </thead>
            <tbody>
              {files.map((fila) => (
                <tr key={fila.curs} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 500 }}>{fila.curs}</td>
                  {COLUMNES_COMUNES.map((c) => <td key={c.id} style={{ padding: '6px 8px' }}>{fila.comptadors[c.id]}</td>)}
                  <td style={{ padding: '6px 8px', fontWeight: 600 }}>{fila.total}</td>
                </tr>
              ))}
              <FilaTotal label={`VL ${moment.label}`} files={files} columnes={COLUMNES_COMUNES} />
            </tbody>
          </table>
        </div>
      ))}

      {missatge && (
        <p style={{ marginTop: 16, fontSize: 13, color: 'var(--red)' }}>{missatge.text}</p>
      )}
    </div>
  )
}
