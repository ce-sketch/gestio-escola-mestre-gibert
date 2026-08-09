import { useState } from 'react'
import * as XLSX from 'xlsx'
import {
  collection, doc, getDocs, writeBatch, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { slug } from '../../lib/slug'

const DEFAULT_CLASSES = ['1r A', '1r B']

// Columnes del full "LLISTAT ALUMNES CURS ACTUAL Administrativa" (0-indexades):
// la 1a (A) és l'IDALU (identificador permanent de l'alumne, del sistema ESFERA
// del Departament), la 4a és el nom complet ("Cognoms, Nom"), la 6a és la
// classe llegible (p. ex. "1r A").
const COL_IDALU = 0
const COL_NOM = 4
const COL_CURS = 6
const COL_NESE = 8
const COL_NESE_MOTIU = 9

// Només aquest motiu concret dona dret a la reducció del 100% en material i
// activitats — no pas qualsevol alumne NESE (una discapacitat o altes
// capacitats, per exemple, no donen aquest dret).
const MOTIU_NESE_REDUCCIO = 'situacions socioeconòmiques'

export default function Alumnes() {
  const [classes, setClasses] = useState(
    DEFAULT_CLASSES.map((curs) => ({ curs, text: '' }))
  )
  const [importing, setImporting] = useState(false)
  const [log, setLog] = useState([])

  const [previsualitzacio, setPrevisualitzacio] = useState(null) // { [curs]: [{nom, numLlista}] }
  const [important, setImportantFitxer] = useState(false)
  const [errorFitxer, setErrorFitxer] = useState(null)

  const [confirmaEsborrat, setConfirmaEsborrat] = useState('')
  const [esborrant, setEsborrant] = useState(false)

  function updateClass(index, field, value) {
    setClasses((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)))
  }

  function addClass() {
    setClasses((prev) => [...prev, { curs: '', text: '' }])
  }

  function removeClass(index) {
    setClasses((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleImport() {
    setImporting(true)
    setLog([])

    const perClasse = {}
    for (const { curs, text } of classes) {
      if (!curs.trim() || !text.trim()) continue
      const alumnes = extractAlumnes(text)
      if (alumnes.length > 0) perClasse[curs.trim()] = alumnes
    }

    if (Object.keys(perClasse).length === 0) {
      setLog([{ type: 'warn', text: 'No s\'ha trobat cap classe amb dades vàlides.' }])
      setImporting(false)
      return
    }

    try {
      const resum = await syncTotesLesClasses(perClasse)
      setLog(resumAText(resum))
    } catch (err) {
      setLog([{ type: 'error', text: `No s'ha pogut actualitzar: ${err.message}` }])
    } finally {
      setImporting(false)
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setErrorFitxer(null)
    setPrevisualitzacio(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const primerFull = workbook.Sheets[workbook.SheetNames[0]]
        const files = XLSX.utils.sheet_to_json(primerFull, { header: 1, raw: false })

        const perClasse = {}
        for (const fila of files) {
          const idalu = fila[COL_IDALU]?.toString().replace(/[^\d]/g, '')
          const nom = fila[COL_NOM]?.toString().trim()
          const curs = fila[COL_CURS]?.toString().trim()
          if (!nom || !curs) continue
          if (curs.toUpperCase() === 'FALSE') continue // encara sense classe assignada
          if (nom === 'Alumnes:' || curs === 'Grup Classe') continue // fila de capçalera
          if (!/[a-zA-ZÀ-ÿ]/.test(nom)) continue
          if (!idalu || !/^\d+$/.test(idalu)) continue // sense IDALU vàlid (p. ex. la fila de capçalera)
          const esNese = fila[COL_NESE]?.toString().trim().toLowerCase() === 'sí'
          const neseMotiu = fila[COL_NESE_MOTIU]?.toString().trim() ?? ''
          const neseEconomic = esNese && neseMotiu.toLowerCase().includes(MOTIU_NESE_REDUCCIO)
          if (!perClasse[curs]) perClasse[curs] = []
          perClasse[curs].push({ nom, idalu, neseEconomic })
        }

        if (Object.keys(perClasse).length === 0) {
          setErrorFitxer('No s\'ha trobat cap alumne amb IDALU vàlid al fitxer. Comprova que és el full "LLISTAT ALUMNES" exportat sencer (full "ESFERA"), no una còpia parcial.')
          return
        }

        const previsualitzat = {}
        for (const [curs, files2] of Object.entries(perClasse)) {
          previsualitzat[curs] = files2
            .sort((a, b) => a.nom.localeCompare(b.nom))
            .map((f, i) => ({ nom: f.nom, idalu: f.idalu, numLlista: i + 1, neseEconomic: f.neseEconomic }))
        }
        setPrevisualitzacio(previsualitzat)
      } catch (err) {
        setErrorFitxer(`No s'ha pogut llegir el fitxer: ${err.message}`)
      }
    }
    reader.onerror = () => setErrorFitxer('No s\'ha pogut llegir el fitxer.')
    reader.readAsBinaryString(file)
  }

  async function importaFitxer() {
    if (!previsualitzacio) return
    setImportantFitxer(true)
    setLog([])
    try {
      const resum = await syncTotesLesClasses(previsualitzacio)
      setLog(resumAText(resum))
    } catch (err) {
      setLog([{ type: 'error', text: `No s'ha pogut actualitzar: ${err.message}` }])
    } finally {
      setImportantFitxer(false)
      setPrevisualitzacio(null)
    }
  }

  const totalAlumnesPrevisualitzats = previsualitzacio
    ? Object.values(previsualitzacio).reduce((acc, llista) => acc + llista.length, 0)
    : 0
  const totalNeseEconomic = previsualitzacio
    ? Object.values(previsualitzacio).reduce((acc, llista) => acc + llista.filter((a) => a.neseEconomic).length, 0)
    : 0

  async function esborraTotsElsAlumnes() {
    setEsborrant(true)
    setLog([])
    try {
      const alumnesRef = collection(db, 'alumnes')
      const snapshot = await getDocs(alumnesRef)
      const docs = snapshot.docs

      // Firestore només permet 500 operacions per lot (batch), així que si
      // hi ha més alumnes que això cal fer-ho a trossos.
      for (let i = 0; i < docs.length; i += 500) {
        const batch = writeBatch(db)
        for (const d of docs.slice(i, i + 500)) {
          batch.delete(doc(alumnesRef, d.id))
        }
        await batch.commit()
      }

      setLog([{ type: 'ok', text: `Esborrats ${docs.length} alumnes. La llista ja és buida — puja un Excel per tornar-la a omplir.` }])
      setConfirmaEsborrat('')
    } catch (err) {
      setLog([{ type: 'error', text: `No s'ha pogut esborrar: ${err.message}` }])
    } finally {
      setEsborrant(false)
    }
  }

  return (
    <div className="module">
      <p className="module-eyebrow">Dades privades, sense compartir cap enllaç</p>
      <h2>Alumnes</h2>
      <p className="module-lead">
        Actualitza el llistat d'alumnes tants cops com calgui durant el curs (altes, baixes,
        canvis de classe). Pujant el fitxer Excel, cada alumne es reconeix pel seu <strong>IDALU</strong> (el
        codi permanent del Departament), no pel nom — així l'historial d'assistència i
        avaluació mai queda desconnectat, ni encara que canviï de classe o s'escrigui el nom
        una mica diferent.
      </p>

      <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 16, borderColor: 'var(--amber-dark)' }}>
        <strong>Important:</strong> per detectar bé els canvis de classe, és millor pujar
        sempre el <strong>fitxer sencer</strong> (totes les classes de cop) en lloc d'actualitzar
        una sola classe per separat. Si només actualitzes una classe, l'app no pot saber si
        algú que hi falta s'ha mogut a una altra classe o ha causat baixa de debò.
      </div>

      <div style={{ marginTop: 24, border: '1px solid var(--line)', borderRadius: 12, padding: 20 }}>
        <p className="module-note" style={{ marginTop: 0, fontStyle: 'normal', fontWeight: 600, color: 'var(--ink)' }}>
          Opció ràpida: puja el fitxer Excel
        </p>
        <p className="module-note" style={{ marginTop: 0 }}>
          A Google Sheets: Fitxer → Baixa → Microsoft Excel (.xlsx). Després puja aquí el
          fitxer descarregat — detecta totes les classes soles, sense haver-les d'enganxar
          una per una.
        </p>
        <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} style={{ marginTop: 8 }} />

        {errorFitxer && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{errorFitxer}</p>}

        {previsualitzacio && (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 14, fontWeight: 600 }}>
              Trobats {totalAlumnesPrevisualitzats} alumnes en {Object.keys(previsualitzacio).length} classes
              ({totalNeseEconomic} amb reducció NESE per situació socioeconòmica):
            </p>
            <ul className="roster" style={{ marginTop: 8 }}>
              {Object.entries(previsualitzacio).sort().map(([curs, alumnes]) => (
                <li key={curs} className="roster-row">
                  <span className="roster-name">{curs}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                    {alumnes.length} alumnes
                    {alumnes.some((a) => a.neseEconomic) && ` · ${alumnes.filter((a) => a.neseEconomic).length} NESE`}
                  </span>
                </li>
              ))}
            </ul>
            <button
              className="btn-primary"
              style={{ marginTop: 16, maxWidth: 260 }}
              onClick={importaFitxer}
              disabled={important}
              type="button"
            >
              {important ? 'Important…' : 'Confirma i actualitza totes les classes'}
            </button>
          </div>
        )}
      </div>

      <details style={{ marginTop: 24 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          Opció manual: enganxar classe a classe
        </summary>

        <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 16 }}>
          <strong>Com copiar-ho des de Google Sheets:</strong> obre el full amb el teu compte
          habitual, selecciona les cel·les de número i nom d'una classe (les dues columnes
          senceres, files incloses), prem Ctrl+C, i enganxa-ho (Ctrl+V) al requadre corresponent
          de sota.
          <br /><br />
          <strong>Nota:</strong> aquesta opció fa servir el nom com a identificador (no hi ha
          IDALU disponible copiant només aquestes dues columnes), així que és una mica menys
          fiable que pujar el fitxer sencer. Fes-la servir només si el fitxer Excel no és una
          opció.
        </div>

        {classes.map((c, i) => (
          <div key={i} style={{ marginTop: 20, border: '1px solid var(--line)', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
              <input
                type="text"
                placeholder="Nom de la classe (p. ex. 1r A)"
                value={c.curs}
                onChange={(e) => updateClass(i, 'curs', e.target.value)}
                style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px', fontWeight: 600 }}
              />
              <button className="chip" onClick={() => removeClass(i)} type="button">Treu</button>
            </div>
            <textarea
              value={c.text}
              onChange={(e) => updateClass(i, 'text', e.target.value)}
              placeholder={'Enganxa aquí les dues columnes (número i nom), per exemple:\n1\tLaia Ferrer\n2\tMartí Soler'}
              rows={6}
              style={{
                width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: 10,
                fontFamily: 'monospace', fontSize: 13, resize: 'vertical',
              }}
            />
          </div>
        ))}

        <button
          className="btn-ghost"
          style={{ marginTop: 16, color: 'var(--navy)', borderColor: 'var(--navy)' }}
          onClick={addClass}
          type="button"
        >
          + Afegeix una classe
        </button>

        <div>
          <button
            className="btn-primary"
            style={{ marginTop: 24, maxWidth: 260 }}
            onClick={handleImport}
            disabled={importing}
          >
            {importing ? 'Actualitzant…' : 'Actualitza alumnes'}
          </button>
        </div>
      </details>

      {log.length > 0 && (
        <ul className="roster" style={{ marginTop: 24 }}>
          {log.map((entry, i) => (
            <li key={i} className="roster-row" style={{ display: 'block' }}>
              <span style={{
                fontSize: 13,
                color: entry.type === 'error' ? 'var(--red)' : entry.type === 'warn' ? 'var(--amber-dark)' : 'var(--green)',
              }}>
                {entry.text}
              </span>
            </li>
          ))}
        </ul>
      )}

      <details style={{ marginTop: 40 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--red)' }}>
          Zona perillosa: esborra tots els alumnes
        </summary>
        <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 16, borderColor: 'var(--red)' }}>
          <p>
            <strong>Això esborra tota la llista d'alumnes de Firestore</strong> (útil per
            començar un curs nou de zero, en comptes d'arrossegar dades d'anys anteriors).
            No esborra l'historial d'assistència ni d'avaluació ja desat — es queda tal
            com estava, però deixarà de poder-se relacionar amb un alumne actiu fins que
            tornis a pujar l'Excel.
          </p>
          <p style={{ marginTop: 10 }}>
            Per confirmar, escriu <strong>ESBORRA</strong> aquí sota i clica el botó:
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={confirmaEsborrat}
              onChange={(e) => setConfirmaEsborrat(e.target.value)}
              placeholder="ESBORRA"
              style={{ border: '1px solid var(--red)', borderRadius: 8, padding: '8px 10px', maxWidth: 160 }}
            />
            <button
              type="button"
              onClick={esborraTotsElsAlumnes}
              disabled={confirmaEsborrat !== 'ESBORRA' || esborrant}
              style={{
                background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 8,
                padding: '10px 16px', fontWeight: 600, cursor: confirmaEsborrat === 'ESBORRA' ? 'pointer' : 'not-allowed',
                opacity: confirmaEsborrat === 'ESBORRA' ? 1 : 0.5,
              }}
            >
              {esborrant ? 'Esborrant…' : 'Esborra tots els alumnes'}
            </button>
          </div>
        </div>
      </details>
    </div>
  )
}

function resumAText(resum) {
  return [{
    type: 'ok',
    text: `Fet: ${resum.creats} alumnes nous, ${resum.actualitzats} sense canvis, ${resum.moguts} canviats de classe (historial conservat), ${resum.desactivats} donats de baixa.`,
  }]
}

/**
 * Interpreta el text enganxat des de Google Sheets (o Excel): cada fila
 * separada per salt de línia, i dins de cada fila les columnes separades
 * per tabulador (és el format que fan servir aquests programes quan
 * copies cel·les i les enganxes com a text).
 */
function extractAlumnes(text) {
  const alumnes = []
  const rows = text.split('\n')
  for (const row of rows) {
    if (!row.trim()) continue
    const cols = row.split('\t')
    const numLlista = cols[0]?.trim()
    const nom = (cols.length > 1 ? cols[1] : cols[0])?.trim()
    if (!nom) continue
    if (!/[a-zA-ZÀ-ÿ]/.test(nom)) continue
    const num = Number(numLlista)
    alumnes.push({ nom, numLlista: Number.isFinite(num) ? num : null })
  }
  return alumnes
}

/**
 * Sincronitza TOTES les classes d'un cop.
 *
 * Quan l'alumne té IDALU (pujada del fitxer Excel, el cas recomanat), es fa
 * servir directament com a identificador — el més fiable possible, ja que
 * és un codi permanent del Departament que mai canvia, encara que
 * s'equivoquin escrivint un nom o hi hagi dos alumnes amb el mateix nom.
 *
 * Quan no hi ha IDALU (opció manual d'enganxar text), es fa servir el nom
 * com a clau de coincidència, igual que abans.
 *
 * Un alumne que no aparegui a CAP de les classes d'aquesta importació es
 * marca com a inactiu (mai s'esborra de debò).
 */
async function syncTotesLesClasses(perClasse) {
  const alumnesRef = collection(db, 'alumnes')
  const snapshot = await getDocs(alumnesRef)

  const existentsPerNom = new Map() // nom -> { id, curs, actiu }
  const existentsPerId = new Map() // id -> { curs, actiu }
  snapshot.forEach((d) => {
    const dades = d.data()
    const info = { id: d.id, curs: dades.curs, actiu: dades.actiu !== false }
    existentsPerNom.set(dades.nom, info)
    existentsPerId.set(d.id, info)
  })

  const batch = writeBatch(db)
  const vistos = new Set() // claus "id" o "nom" trobades en aquesta importació
  const classesTocades = new Set(Object.keys(perClasse))
  let creats = 0
  let actualitzats = 0
  let moguts = 0
  let desactivats = 0

  for (const [curs, alumnes] of Object.entries(perClasse)) {
    for (const { nom, numLlista, idalu, neseEconomic } of alumnes) {
      const id = idalu ? String(idalu) : (existentsPerNom.get(nom)?.id ?? slug(nom))
      const existent = idalu ? existentsPerId.get(id) : existentsPerNom.get(nom)

      vistos.add(id)

      batch.set(
        doc(alumnesRef, id),
        { nom, curs, numLlista, idalu: idalu ?? null, neseEconomic: Boolean(neseEconomic), actiu: true, actualitzatEl: serverTimestamp() },
        { merge: true }
      )

      if (!existent) creats += 1
      else if (existent.curs && existent.curs !== curs) moguts += 1
      else actualitzats += 1
    }
  }

  // Només es marquen de baixa alumnes la classe actual dels quals formi
  // part d'aquesta importació — així, actualitzar una sola classe mai
  // afecta la resta de classes que no s'hagin tocat.
  existentsPerNom.forEach(({ id, curs, actiu }, nom) => {
    const clauVista = vistos.has(id) || vistos.has(nom)
    if (!clauVista && actiu && classesTocades.has(curs)) {
      batch.set(doc(alumnesRef, id), { actiu: false, actualitzatEl: serverTimestamp() }, { merge: true })
      desactivats += 1
    }
  })

  await batch.commit()
  return { creats, actualitzats, moguts, desactivats }
}
