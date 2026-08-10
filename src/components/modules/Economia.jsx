import { useEffect, useState, Fragment } from 'react'
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore'
import { db, auth } from '../../firebase'
import { cursEscolarActual } from '../../lib/cursEscolar'
import { ENSENYAMENTS, CURSOS, CONCEPTES, conceptaBuit, filaBuida, totalConcepte, totalFila } from '../../lib/economia'
import { exportaExcelOficial } from '../../lib/economiaExcelOficial'
import { fetchDocText } from '../../lib/officialCalendarDoc'
import { parseOfficialQuotesText, parseResumSortides } from '../../lib/officialQuotesDoc'
import * as XLSX from 'xlsx'

// ID del document "Recull informatiu de les famílies" a Google Docs, amb
// els preus de quotes. Ha d'estar compartit com "Qualsevol persona amb
// l'enllaç" (lector) perquè el botó d'actualització el pugui llegir.
const DOC_QUOTES_OFICIAL_ID = '11d6iuGeB3MhBuy_fzAJJQSXDxom8x4cVtDk4FqTq-U0'

// Conceptes on la reducció NESE (situació socioeconòmica) és del 100%,
// segons el criteri del centre: material escolar i activitats
// complementàries — no s'aplica a la resta de conceptes.
const CONCEPTES_REDUCCIO_NESE = ['materialEscolar', 'activitatsComplementaries']

export default function Economia() {
  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [files, setFiles] = useState([])
  const [codiCentre, setCodiCentre] = useState('')
  const [preusTrobats, setPreusTrobats] = useState(null)
  const [actualitzantPreus, setActualitzantPreus] = useState(false)
  const [sortidesTrobades, setSortidesTrobades] = useState(null)
  const [carregantSortides, setCarregantSortides] = useState(false)
  const [carregant, setCarregant] = useState(true)
  const [desant, setDesant] = useState(false)
  const [missatge, setMissatge] = useState(null)
  const [filaOberta, setFilaOberta] = useState(null) // índex de la fila expandida
  const [mostraPreview, setMostraPreview] = useState(false)
  const [filtrePreview, setFiltrePreview] = useState('') // '' = totes les promocions
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
      setCodiCentre(snap.exists() ? (snap.data().codiCentre ?? '') : '')
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'han pogut carregar les dades: ${err.message}` })
    } finally {
      setCarregant(false)
    }
  }

  async function desaCodiCentre(valor) {
    setCodiCentre(valor)
    try {
      await setDoc(doc(db, 'economia', cursEscolarId), { codiCentre: valor }, { merge: true })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar el codi de centre: ${err.message}` })
    }
  }

  /** Llegeix el document oficial de preus i mostra tots els imports en
   *  euros que hi troba — no s'apliquen sols, perquè el mestre triï a
   *  quina fila i concepte correspon cadascun. */
  function aplicaTextPreus(text) {
    const trobats = parseOfficialQuotesText(text)
    if (trobats.length === 0) {
      setMissatge({ type: 'error', text: 'No he trobat cap import en euros al document. Comprova que és el document correcte.' })
    } else {
      setPreusTrobats(trobats)
    }
  }

  async function actualitzaPreusDesDelDocument() {
    setActualitzantPreus(true)
    setMissatge(null)
    setPreusTrobats(null)
    try {
      const text = await fetchDocText(DOC_QUOTES_OFICIAL_ID)
      aplicaTextPreus(text)
    } catch (err) {
      setMissatge({ type: 'error', text: err.message })
    } finally {
      setActualitzantPreus(false)
    }
  }

  /** Alternativa manual per si l'enllaç automàtic falla algun dia: puja una
   *  còpia del document (baixada com a "Text pla (.txt)" des de Google
   *  Docs) i s'interpreta amb exactament la mateixa lògica. */
  function pujaFitxerPreusManualment(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setMissatge(null)
    setPreusTrobats(null)
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        aplicaTextPreus(event.target.result)
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'ha pogut interpretar el fitxer: ${err.message}` })
      }
    }
    reader.onerror = () => setMissatge({ type: 'error', text: 'No s\'ha pogut llegir el fitxer.' })
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
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

  /** Compta TOTS els alumnes (independentment de NESE) que coincideixen amb
   *  el curs genèric d'una fila — per omplir el "Núm. alumnes" sol. */
  function numAlumnesClasse(cursGeneric) {
    if (!cursGeneric) return 0
    const cg = cursGeneric.trim().toLowerCase()
    return alumnesTots.filter((a) => a.curs?.trim().toLowerCase().startsWith(cg)).length
  }

  /** Omple el "Núm. alumnes" d'una fila amb el recompte real de la llista
   *  d'alumnes — no cal escriure'l a mà ni mantenir-lo actualitzat. */
  function autoemplenaAlumnes(index) {
    const fila = files[index]
    const n = numAlumnesClasse(fila.curs)
    if (n === 0) return
    onBlurDesa(actualitzaFila(index, { numAlumnes: String(n) }))
  }

  /** Puja el document consolidat "Activitats_Complementaries_XX-XX_I3_a_6e"
   *  (un sol Excel amb un full per curs i un full "Resum" ja calculat), i
   *  en llegeix el full "Resum" directament. */
  function pujaResumSortides(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCarregantSortides(true)
    setMissatge(null)
    setSortidesTrobades(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const nomFull = workbook.SheetNames.find((n) => n.toLowerCase().includes('resum'))
        if (!nomFull) {
          setMissatge({ type: 'error', text: 'No he trobat cap full "Resum" en aquest Excel. Comprova que és el document consolidat correcte.' })
          setCarregantSortides(false)
          return
        }
        const files_ = XLSX.utils.sheet_to_json(workbook.Sheets[nomFull], { header: 1, raw: false })
        const resultats = parseResumSortides(files_)
        if (resultats.length === 0) {
          setMissatge({ type: 'error', text: 'No he trobat cap fila amb un total vàlid al full "Resum".' })
        } else {
          setSortidesTrobades(resultats)
        }
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'ha pogut llegir l'Excel: ${err.message}` })
      } finally {
        setCarregantSortides(false)
      }
    }
    reader.onerror = () => {
      setMissatge({ type: 'error', text: 'No s\'ha pogut llegir el fitxer.' })
      setCarregantSortides(false)
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  /** Aplica el total de sortides trobat a l'"Import unitari" del concepte
   *  "Activitats complementàries" de la fila que coincideixi amb el curs. */
  function aplicaTotalSortides(curs, total) {
    const index = files.findIndex((f) => f.curs === curs)
    if (index === -1) {
      setMissatge({ type: 'error', text: `No hi ha cap fila amb el curs "${curs}" — afegeix-la primer amb "+ Afegeix fila".` })
      return
    }
    const noves = files.map((f, i) => {
      if (i !== index) return f
      return { ...f, conceptes: { ...f.conceptes, activitatsComplementaries: { ...f.conceptes.activitatsComplementaries, importUnitari: String(total) } } }
    })
    setFiles(noves)
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

  /** Nomès informatiu: quants alumnes NESE d'aquest curs tenen cada tipus
   *  d'ajut (Motxilles Escolars / Pla de Xoc), per portar-ne el seguiment
   *  de cara a qui el finança (CEB o Generalitat). No afecta el càlcul. */
  function desglossamentAjut(cursGeneric) {
    if (!cursGeneric) return []
    const cg = cursGeneric.trim().toLowerCase()
    const alumnesNese = alumnesTots.filter((a) => a.neseEconomic && a.curs?.trim().toLowerCase().startsWith(cg))
    const comptes = {}
    for (const a of alumnesNese) {
      const programa = a.ajutNese || 'Sense etiquetar'
      comptes[programa] = (comptes[programa] ?? 0) + 1
    }
    return Object.entries(comptes).map(([programa, n]) => ({ programa, n }))
  }

  /** L'escola està retirant aquesta reducció progressivament:
   *  - Curs 26-27: només la conserva l'alumnat de 6è (últim curs, per no
   *    tallar-los-hi de cop a mitja etapa).
   *  - A partir del curs 27-28: ja no s'aplica a ningú.
   *  (Cursos anteriors, si mai calgués consultar-los, mantenen el criteri
   *  antic — reducció per a tothom.) */
  function teDretReduccioNese(cursGeneric) {
    const anyInici = Number(cursEscolarId.split('-')[0])
    if (Number.isNaN(anyInici)) return true
    if (anyInici >= 2027) return false
    if (anyInici === 2026) return cursGeneric === '6è'
    return true
  }

  /** Aplica la reducció del 100% (Material escolar + Activitats
   *  complementàries) pels alumnes NESE trobats en aquesta fila — sobre
   *  l'import unitari ja introduït. Es pot desfer/ajustar a mà després. */
  function aplicaReduccioNese(index) {
    const fila = files[index]
    if (!teDretReduccioNese(fila.curs)) return
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

  async function exportaExcelPlantilla() {
    await exportaExcelOficial({
      nomCentre: 'Escola Mestre Enric Gibert i Camins',
      codiCentre,
      cursEscolarId,
      files,
    })
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
        <label className="field" style={{ maxWidth: 140 }}>
          <span>Codi del Centre</span>
          <input
            type="text"
            value={codiCentre}
            onChange={(e) => desaCodiCentre(e.target.value)}
            placeholder="p. ex. 08012345"
            style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}
          />
        </label>
        <button className="btn-ghost" style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }} onClick={afegeixFila} type="button">
          + Afegeix fila
        </button>
        <button className="btn-ghost" style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }} onClick={exportaExcelPlantilla} type="button">
          📥 Descarrega Excel oficial (plantilla CEB)
        </button>
        <button
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
          onClick={() => setMostraPreview((v) => !v)}
          type="button"
        >
          {mostraPreview ? '✕ Amaga la previsualització' : '👁 Previsualitza l\'Excel oficial'}
        </button>
        {desant && <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Desant…</span>}
      </div>

      {mostraPreview && (
        <div style={{ marginTop: 16 }}>
          <p className="module-note" style={{ marginTop: 0 }}>
            Així quedarà l'Excel amb el que ja tens introduït. Les caselles en blanc (amb fons
            vermellós) són el que encara falta per omplir.
          </p>
          <label className="field" style={{ maxWidth: 220, marginBottom: 10 }}>
            <span>Promoció</span>
            <select
              value={filtrePreview}
              onChange={(e) => setFiltrePreview(e.target.value)}
              style={{ padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 8 }}
            >
              <option value="">Totes les promocions</option>
              {CURSOS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 8 }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 11, whiteSpace: 'nowrap' }}>
              <thead>
                <tr style={{ background: 'var(--navy)', color: '#fff' }}>
                  <th style={{ padding: '6px 8px', position: 'sticky', left: 0, background: 'var(--navy)' }}>Ensenyament</th>
                  <th style={{ padding: '6px 8px' }}>Curs</th>
                  <th style={{ padding: '6px 8px' }}>Alumnes</th>
                  {CONCEPTES.map((c) => (
                    <th key={c.id} colSpan={5} style={{ padding: '6px 8px', textAlign: 'center', borderLeft: '2px solid #fff' }}>
                      {c.label}
                    </th>
                  ))}
                  <th style={{ padding: '6px 8px', borderLeft: '2px solid #fff' }}>TOTAL FILA</th>
                </tr>
                <tr style={{ background: 'var(--bg-soft, #f5f5f0)' }}>
                  <th style={{ padding: '4px 8px', position: 'sticky', left: 0, background: 'var(--bg-soft, #f5f5f0)' }} />
                  <th />
                  <th />
                  {CONCEPTES.map((c) => (
                    <Fragment key={c.id}>
                      <th style={{ padding: '4px 6px', fontWeight: 400, borderLeft: '2px solid var(--line)' }}>Import unit.</th>
                      <th style={{ padding: '4px 6px', fontWeight: 400 }}>Reducció</th>
                      <th style={{ padding: '4px 6px', fontWeight: 400 }}>Total</th>
                      <th style={{ padding: '4px 6px', fontWeight: 400 }}>Cobrat 1</th>
                      <th style={{ padding: '4px 6px', fontWeight: 400 }}>Cobrat 2</th>
                    </Fragment>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filesFiltrades = filtrePreview ? files.filter((f) => f.curs === filtrePreview) : files
                  if (filesFiltrades.length === 0) {
                    return <tr><td colSpan={4 + CONCEPTES.length * 5 + 1} style={{ padding: 12, color: 'var(--ink-soft)' }}>
                      {files.length === 0 ? 'Encara no hi ha cap fila.' : `Cap fila amb el curs "${filtrePreview}".`}
                    </td></tr>
                  }
                  return filesFiltrades.map((fila, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '4px 8px', position: 'sticky', left: 0, background: i % 2 === 0 ? '#fff' : 'var(--bg-soft, #fafaf7)' }}>{fila.ensenyament}</td>
                    <td style={{ padding: '4px 8px' }}>{fila.curs}</td>
                    <td style={{ padding: '4px 8px', background: fila.numAlumnes ? undefined : 'rgba(200,60,60,0.08)' }}>{fila.numAlumnes || '—'}</td>
                    {CONCEPTES.map((c) => {
                      const concepte = fila.conceptes[c.id] ?? conceptaBuit()
                      const total = totalConcepte(fila.numAlumnes, concepte)
                      const buit = (v) => v === '' || v === undefined || v === null
                      return (
                        <Fragment key={c.id}>
                          <td style={{ padding: '4px 6px', borderLeft: '2px solid var(--line)', background: buit(concepte.importUnitari) ? 'rgba(200,60,60,0.08)' : undefined }}>
                            {buit(concepte.importUnitari) ? '—' : concepte.importUnitari}
                          </td>
                          <td style={{ padding: '4px 6px' }}>{buit(concepte.reduccio) ? '—' : concepte.reduccio}</td>
                          <td style={{ padding: '4px 6px', fontWeight: 600 }}>{total.toLocaleString('ca-ES', { minimumFractionDigits: 2 })}</td>
                          <td style={{ padding: '4px 6px', background: buit(concepte.cobratAny1) ? 'rgba(200,60,60,0.08)' : undefined }}>
                            {buit(concepte.cobratAny1) ? '—' : concepte.cobratAny1}
                          </td>
                          <td style={{ padding: '4px 6px', background: buit(concepte.cobratAny2) ? 'rgba(200,60,60,0.08)' : undefined }}>
                            {buit(concepte.cobratAny2) ? '—' : concepte.cobratAny2}
                          </td>
                        </Fragment>
                      )
                    })}
                    <td style={{ padding: '4px 8px', fontWeight: 700, borderLeft: '2px solid var(--line)' }}>
                      {totalFila(fila).toLocaleString('ca-ES', { minimumFractionDigits: 2 })} €
                    </td>
                  </tr>
                  ))
                })()}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 6 }}>
            🟥 Casella en blanc amb fons vermellós = encara sense omplir. La columna "Total" i
            "TOTAL FILA" ja es calculen soles a partir del que hi hagi.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
          onClick={actualitzaPreusDesDelDocument}
          disabled={actualitzantPreus}
          type="button"
        >
          {actualitzantPreus ? 'Llegint el document…' : '↻ Actualitza preus des del document oficial'}
        </button>
        <a
          href={`https://docs.google.com/document/d/${DOC_QUOTES_OFICIAL_ID}/export?format=pdf`}
          target="_blank"
          rel="noreferrer"
          className="btn-ghost"
          style={{ color: 'var(--ink-soft)', borderColor: 'var(--line)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', fontSize: 12 }}
        >
          👁 Obre el document per consultar-lo
        </a>
        <label
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
        >
          📤 Puja el document manualment
          <input type="file" accept=".txt" onChange={pujaFitxerPreusManualment} style={{ display: 'none' }} />
        </label>
      </div>
      <p className="module-note" style={{ marginTop: 4 }}>
        Si algun dia el botó "Actualitza" de dalt deixa de funcionar (per exemple perquè es
        trenca el permís de compartició), baixa el document manualment des de Google Docs amb
        "Arxiu → Baixa → Text pla (.txt)" i puja'l aquí — s'interpretarà exactament igual.
      </p>

      <div style={{ marginTop: 20, borderTop: '1px solid var(--line)', paddingTop: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 600 }}>Activitats complementàries (sortides) per curs</p>
        <p className="module-note" style={{ marginTop: 4 }}>
          Puja el document consolidat "Activitats_Complementaries_..._I3_a_6e" (baixat des de
          Google Sheets amb "Arxiu → Baixa → Microsoft Excel (.xlsx)") — es llegeix directament
          el full "Resum", que ja té el total calculat de cada curs.
        </p>
        <label
          className="btn-ghost"
          style={{ color: 'var(--navy)', borderColor: 'var(--navy)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', marginTop: 8 }}
        >
          {carregantSortides ? 'Llegint el document…' : '📤 Puja el document de sortides (Excel)'}
          <input type="file" accept=".xlsx,.xls" onChange={pujaResumSortides} style={{ display: 'none' }} disabled={carregantSortides} />
        </label>

        {sortidesTrobades && (
          <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 12 }}>
            <ul className="roster" style={{ marginTop: 0 }}>
              {sortidesTrobades.map((s, i) => (
                <li key={i} className="roster-row" style={{ display: 'block', paddingBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <span>
                      <strong>{s.curs}</strong>
                      {s.numActivitats !== null && (
                        <span style={{ fontSize: 12, color: 'var(--ink-soft)', marginLeft: 8 }}>({s.numActivitats} activitats)</span>
                      )}
                    </span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <strong>{s.total.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR' })}</strong>
                      <button
                        type="button"
                        onClick={() => aplicaTotalSortides(s.curs, s.total)}
                        className="btn-ghost"
                        style={{ fontSize: 12, padding: '4px 10px' }}
                      >
                        Aplica a la fila de {s.curs}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setSortidesTrobades(null)} className="btn-ghost" style={{ marginTop: 8, maxWidth: 100 }}>
              Tanca
            </button>
          </div>
        )}
      </div>

      {preusTrobats && (
        <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 600 }}>
            Imports trobats al document ({preusTrobats.length}) — copia'l manualment a la casella
            d'"Import unitari" de la fila i concepte que correspongui:
          </p>
          <ul className="roster" style={{ marginTop: 8 }}>
            {preusTrobats.map((p, i) => (
              <li key={i} className="roster-row">
                <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{p.context}</span>
                <strong>{p.import.toLocaleString('ca-ES', { style: 'currency', currency: 'EUR' })}</strong>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setPreusTrobats(null)}
            className="btn-ghost"
            style={{ marginTop: 8, maxWidth: 100 }}
          >
            Tanca
          </button>
        </div>
      )}

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
                  {numAlumnesClasse(fila.curs) > 0 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); autoemplenaAlumnes(index) }}
                      title={`Omple amb els ${numAlumnesClasse(fila.curs)} alumnes reals d'aquest curs`}
                      style={{ background: 'none', border: '1px solid var(--navy)', color: 'var(--navy)', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer' }}
                    >
                      ↻ {numAlumnesClasse(fila.curs)}
                    </button>
                  )}
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
                  {numAlumnesNese(fila.curs) > 0 && teDretReduccioNese(fila.curs) && (
                    <div className="placeholder-box" style={{ borderStyle: 'solid', borderColor: 'var(--amber-dark)', marginBottom: 12 }}>
                      <span style={{ fontSize: 12 }}>
                        <strong>{numAlumnesNese(fila.curs)} alumnes</strong> d'aquest curs tenen reducció NESE per
                        situació socioeconòmica (100% en Material escolar i Activitats complementàries).
                      </span>
                      {desglossamentAjut(fila.curs).length > 0 && (
                        <p style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>
                          Seguiment de finançament: {desglossamentAjut(fila.curs).map((d) => `${d.programa} (${d.n})`).join(' · ')}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => aplicaReduccioNese(index)}
                        style={{ display: 'block', marginTop: 8, background: 'var(--amber-dark)', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Aplica la reducció automàticament (calcula sobre l'import unitari ja escrit)
                      </button>
                    </div>
                  )}
                  {numAlumnesNese(fila.curs) > 0 && !teDretReduccioNese(fila.curs) && (
                    <div className="placeholder-box" style={{ marginBottom: 12 }}>
                      <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                        Hi ha {numAlumnesNese(fila.curs)} alumnes NESE en aquest curs, però aquest any ja no els
                        correspon la reducció (l'escola l'està retirant progressivament: curs 26-27 només 6è,
                        i a partir de 27-28 ja no s'aplica a ningú).
                      </span>
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
