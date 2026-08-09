import { useEffect, useState } from 'react'
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore'
import * as XLSX from 'xlsx'
import { db, auth } from '../../firebase'
import { cursEscolarActual } from '../../lib/cursEscolar'
import { ENSENYAMENTS, CURSOS, CONCEPTES, conceptaBuit, filaBuida, totalConcepte, totalFila } from '../../lib/economia'

// Conceptes on la reducció NESE (situació socioeconòmica) és del 100%,
// segons el criteri del centre: material escolar i activitats
// complementàries — no s'aplica a la resta de conceptes.
const CONCEPTES_REDUCCIO_NESE = ['materialEscolar', 'activitatsComplementaries']

export default function Economia() {
  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [files, setFiles] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [desant, setDesant] = useState(false)
  const [missatge, setMissatge] = useState(null)
  const [filaOberta, setFilaOberta] = useState(null) // índex de la fila expandida
  const [alumnesTots, setAlumnesTots] = useState([])

  useEffect(() => {
    carrega()
    carregaAlumnes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursEscolarId])

  async function carregaAlumnes() {
    try {
      const snap = await getDocs(collection(db, 'alumnes'))
      setAlumnesTots(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch {
      setAlumnesTots([])
    }
  }

  async function carrega() {
    setCarregant(true)
    setMissatge(null)
    try {
      const snap = await getDoc(doc(db, 'economia', cursEscolarId))
      setFiles(snap.exists() ? (snap.data().files ?? []) : [])
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'han pogut carregar les dades: ${err.message}` })
    } finally {
      setCarregant(false)
    }
  }

  /** Desa TOT el document d'aquest curs escolar — es crida sola en sortir
   *  de qualsevol camp, no cal cap botó "Desa". Com que és un únic document
   *  per curs escolar (no és una col·lecció d'entrades soltes com
   *  Assistència), l'escrivim sencer cada vegada; les dades hi caben de
   *  sobres (uns quants KB com a molt). */
  async function desaTot(filesNoves) {
    setDesant(true)
    setMissatge(null)
    try {
      await setDoc(doc(db, 'economia', cursEscolarId), {
        files: filesNoves,
        actualitzatEl: serverTimestamp(),
        actualitzatPer: auth.currentUser?.email ?? null,
      })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar: ${err.message}` })
    } finally {
      setDesant(false)
    }
  }

  function afegeixFila() {
    const noves = [...files, filaBuida(ENSENYAMENTS[1], CURSOS[0])]
    setFiles(noves)
    setFilaOberta(noves.length - 1)
    desaTot(noves)
  }

  function esborraFila(index) {
    const noves = files.filter((_, i) => i !== index)
    setFiles(noves)
    if (filaOberta === index) setFilaOberta(null)
    desaTot(noves)
  }

  function actualitzaFila(index, canvis) {
    const noves = files.map((f, i) => (i === index ? { ...f, ...canvis } : f))
    setFiles(noves)
    return noves
  }

  function actualitzaConcepte(index, conceptId, camp, valor) {
    const noves = files.map((f, i) => {
      if (i !== index) return f
      return { ...f, conceptes: { ...f.conceptes, [conceptId]: { ...f.conceptes[conceptId], [camp]: valor } } }
    })
    setFiles(noves)
    return noves
  }

  function onBlurDesa(noves) {
    desaTot(noves)
  }

  /** Compta alumnes amb reducció NESE (situació socioeconòmica) que
   *  coincideixen amb el curs genèric d'una fila (per exemple "1r" agafa
   *  tant "1r A" com "1r B"). */
  function numAlumnesNese(cursGeneric) {
    if (!cursGeneric) return 0
    const cg = cursGeneric.trim().toLowerCase()
    return alumnesTots.filter((a) => a.neseEconomic && a.curs?.trim().toLowerCase().startsWith(cg)).length
  }

  /** Aplica la reducció del 100% (Material escolar + Activitats
   *  complementàries) pels alumnes NESE trobats en aquesta fila — sobre
   *  l'import unitari ja introduït. Es pot desfer/ajustar a mà després. */
  function aplicaReduccioNese(index) {
    const fila = files[index]
    const n = numAlumnesNese(fila.curs)
    if (n === 0) return
    let noves = files
    for (const conceptId of CONCEPTES_REDUCCIO_NESE) {
      const importUnitari = Number(fila.conceptes[conceptId]?.importUnitari) || 0
      noves = noves.map((f, i) => {
        if (i !== index) return f
        return { ...f, conceptes: { ...f.conceptes, [conceptId]: { ...f.conceptes[conceptId], reduccio: String(n * importUnitari) } } }
      })
    }
    setFiles(noves)
    desaTot(noves)
  }

  const totalCentre = files.reduce((acc, f) => acc + totalFila(f), 0)
  const totalAlumnes = files.reduce((acc, f) => acc + (Number(f.numAlumnes) || 0), 0)

  function exportaExcelPlantilla() {
    const wb = XLSX.utils.book_new()

    // --- Full principal: una fila per Ensenyament/Curs ---
    const capçalera1 = ['Ensenyament', 'Curs', 'Detall', "Núm. alumnes"]
    const capçalera2 = ['', '', '', '']
    CONCEPTES.forEach((c) => {
      capçalera1.push(c.label, '', '', '', '')
      capçalera2.push('Import unitari', 'Reducció', 'Cobrat any 1', 'Cobrat any 2', 'Total')
    })
    capçalera1.push('TOTAL FILA')
    capçalera2.push('')

    const aoa = [capçalera1, capçalera2]
    files.forEach((f) => {
      const fila = [f.ensenyament, f.curs, f.detall, Number(f.numAlumnes) || 0]
      CONCEPTES.forEach((c) => {
        const concepte = f.conceptes[c.id] ?? conceptaBuit()
        fila.push(
          Number(concepte.importUnitari) || 0,
          Number(concepte.reduccio) || 0,
          Number(concepte.cobratAny1) || 0,
          Number(concepte.cobratAny2) || 0,
          0 // placeholder, s'omple amb fórmula real després
        )
      })
      fila.push(0) // placeholder TOTAL FILA
      aoa.push(fila)
    })

    const ws = XLSX.utils.aoa_to_sheet(aoa)

    // Fórmules reals: Total de cada concepte = alumnes × import unitari − reducció.
    // Columna D = núm. alumnes. Cada concepte ocupa 5 columnes a partir de E.
    const colLletra = (n) => XLSX.utils.encode_col(n)
    files.forEach((_, i) => {
      const filaExcel = i + 3 // les dades comencen a la fila 3 (2 de capçalera)
      const colsTotalFila = []
      CONCEPTES.forEach((c, ci) => {
        const colBase = 4 + ci * 5 // 0-indexat: E=4
        const colImport = colLletra(colBase)
        const colReduccio = colLletra(colBase + 1)
        const colTotal = colLletra(colBase + 4)
        ws[`${colTotal}${filaExcel}`] = { t: 'n', f: `D${filaExcel}*${colImport}${filaExcel}-${colReduccio}${filaExcel}` }
        colsTotalFila.push(`${colTotal}${filaExcel}`)
      })
      const colTotalFilaLletra = colLletra(4 + CONCEPTES.length * 5)
      ws[`${colTotalFilaLletra}${filaExcel}`] = { t: 'n', f: colsTotalFila.join('+') }
    })

    ws['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 20 }, { wch: 10 }, ...Array(CONCEPTES.length * 5).fill({ wch: 12 })]
    XLSX.utils.book_append_sheet(wb, ws, cursEscolarId.slice(0, 31))

    // --- Full "Total Centre": subtotal per Ensenyament, amb SUMIF real ---
    const totalCentreAoa = [['Ensenyament', "Núm. alumnes", 'Total aportacions']]
    ENSENYAMENTS.forEach((ens) => totalCentreAoa.push([ens, 0, 0]))
    totalCentreAoa.push(['TOTAL CENTRE', 0, 0])
    const wsTotal = XLSX.utils.aoa_to_sheet(totalCentreAoa)
    const nomFullPrincipal = cursEscolarId.slice(0, 31)
    const colTotalFilaLletra = colLletra(4 + CONCEPTES.length * 5)
    const ultimaFilaDades = files.length + 2
    ENSENYAMENTS.forEach((ens, i) => {
      const filaExcel = i + 2
      wsTotal[`B${filaExcel}`] = { t: 'n', f: `SUMIF('${nomFullPrincipal}'!A3:A${ultimaFilaDades},A${filaExcel},'${nomFullPrincipal}'!D3:D${ultimaFilaDades})` }
      wsTotal[`C${filaExcel}`] = { t: 'n', f: `SUMIF('${nomFullPrincipal}'!A3:A${ultimaFilaDades},A${filaExcel},'${nomFullPrincipal}'!${colTotalFilaLletra}3:${colTotalFilaLletra}${ultimaFilaDades})` }
    })
    const filaTotalCentre = ENSENYAMENTS.length + 2
    wsTotal[`B${filaTotalCentre}`] = { t: 'n', f: `SUM(B2:B${filaTotalCentre - 1})` }
    wsTotal[`C${filaTotalCentre}`] = { t: 'n', f: `SUM(C2:C${filaTotalCentre - 1})` }
    wsTotal['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, wsTotal, 'Total Centre')

    XLSX.writeFile(wb, `Aportacions-families-${cursEscolarId}.xlsx`)
  }

  if (carregant) return <p>Carregant…</p>

  return (
    <div>
      <p className="module-lead">
        Aportacions econòmiques de les famílies per curs escolar — substitueix l'ompliment
        manual de la plantilla oficial del Departament. Cada canvi es desa sol.
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
        <button className="btn-ghost" style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }} onClick={afegeixFila} type="button">
          + Afegeix fila
        </button>
        <button className="btn-ghost" style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }} onClick={exportaExcelPlantilla} type="button">
          📥 Descarrega Excel (mateixa estructura i fórmules)
        </button>
        {desant && <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Desant…</span>}
      </div>

      <div style={{ display: 'flex', gap: 24, marginTop: 16, fontSize: 13 }}>
        <span><strong>{totalAlumnes}</strong> alumnes en total</span>
        <span><strong>{totalCentre.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR' })}</strong> aportació total del centre</span>
      </div>

      {missatge && (
        <p style={{ marginTop: 12, fontSize: 13, color: missatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
          {missatge.text}
        </p>
      )}

      <div style={{ marginTop: 20 }}>
        {files.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
            Encara no hi ha cap fila per aquest curs escolar. Clica "+ Afegeix fila" per començar.
          </p>
        )}
        {files.map((fila, index) => {
          const oberta = filaOberta === index
          const total = totalFila(fila)
          return (
            <div key={index} className="placeholder-box" style={{ marginTop: 10, padding: 0, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', cursor: 'pointer', flexWrap: 'wrap', gap: 8,
                }}
                onClick={() => setFilaOberta(oberta ? null : index)}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={fila.ensenyament}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onBlurDesa(actualitzaFila(index, { ensenyament: e.target.value }))}
                    style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 13 }}
                  >
                    {ENSENYAMENTS.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                  <select
                    value={fila.curs}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onBlurDesa(actualitzaFila(index, { curs: e.target.value }))}
                    style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 13 }}
                  >
                    {CURSOS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input
                    type="text"
                    value={fila.detall}
                    placeholder="Detall (opcional)"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => actualitzaFila(index, { detall: e.target.value })}
                    onBlur={() => onBlurDesa(files)}
                    style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 13, width: 160 }}
                  />
                  <input
                    type="number"
                    value={fila.numAlumnes}
                    placeholder="Núm. alumnes"
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => actualitzaFila(index, { numAlumnes: e.target.value })}
                    onBlur={() => onBlurDesa(files)}
                    style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 13, width: 90 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <strong>{total.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR' })}</strong>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); esborraFila(index) }}
                    style={{ background: 'none', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}
                  >
                    Esborra
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{oberta ? '▲' : '▼'}</span>
                </div>
              </div>

              {oberta && (
                <div style={{ padding: '4px 14px 14px', borderTop: '1px solid var(--line)' }}>
                  {numAlumnesNese(fila.curs) > 0 && (
                    <div className="placeholder-box" style={{ borderStyle: 'solid', borderColor: 'var(--amber-dark)', marginBottom: 12 }}>
                      <span style={{ fontSize: 12 }}>
                        <strong>{numAlumnesNese(fila.curs)} alumnes</strong> d'aquest curs tenen reducció NESE per
                        situació socioeconòmica (100% en Material escolar i Activitats complementàries).
                      </span>
                      <button
                        type="button"
                        onClick={() => aplicaReduccioNese(index)}
                        style={{ display: 'block', marginTop: 8, background: 'var(--amber-dark)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Aplica la reducció automàticament (calcula sobre l'import unitari ja escrit)
                      </button>
                    </div>
                  )}
                  {CONCEPTES.map((c) => {
                    const concepte = fila.conceptes[c.id] ?? conceptaBuit()
                    const totalC = totalConcepte(fila.numAlumnes, concepte)
                    return (
                      <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, minWidth: 260, fontWeight: 500 }}>{c.label}</span>
                        {['importUnitari', 'reduccio', 'cobratAny1', 'cobratAny2'].map((camp) => (
                          <label key={camp} style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                            {{ importUnitari: 'Import unit.', reduccio: 'Reducció', cobratAny1: 'Cobrat any 1', cobratAny2: 'Cobrat any 2' }[camp]}
                            <input
                              type="number"
                              step="0.01"
                              value={concepte[camp]}
                              onChange={(e) => actualitzaConcepte(index, c.id, camp, e.target.value)}
                              onBlur={() => onBlurDesa(files)}
                              style={{ display: 'block', border: '1px solid var(--line)', borderRadius: 6, padding: '4px 6px', fontSize: 12, width: 90, marginTop: 2 }}
                            />
                          </label>
                        ))}
                        <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 'auto' }}>
                          Total: {totalC.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR' })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
