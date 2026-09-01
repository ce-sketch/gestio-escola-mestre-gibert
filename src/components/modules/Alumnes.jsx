import { useEffect, useMemo, useState } from 'react'
import {
  collection, doc, getDocs, query, where, writeBatch, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import { slug } from '../../lib/slug'
import { cursEscolarActual } from '../../lib/cursEscolar'
import BotoDrive from '../BotoDrive'
import { carregaXLSX } from '../../lib/carregaLlibreries'
import { normalitza } from '../../lib/text'
import { llegeixResumPI, llegeixResumAD, llegeixResumSIEI } from '../../lib/sicAlumnatIndicadors'

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

// El mateix llibre Excel que porta el full "ESFERA" porta també, en
// pestanyes a part, els resums de PI i NESE que fa servir el SIC
// automàtic (vegeu sicAlumnatIndicadors.js). Es llegeixen del mateix
// fitxer que ja es puja aquí perquè ningú hagi de recordar-se de pujar-los
// per separat — si el fitxer no les porta (exportacions antigues, o un
// full parcial), simplement queden a false/buit sense petar.
const FULL_ESFERA_PI = 'ESFERA PI'
const FULL_ESFERA_AD = 'ESFERA AD'

export default function Alumnes() {
  const [classes, setClasses] = useState(
    DEFAULT_CLASSES.map((curs) => ({ curs, text: '' }))
  )
  const [importing, setImporting] = useState(false)
  const [log, setLog] = useState([])

  const [previsualitzacio, setPrevisualitzacio] = useState(null) // { [curs]: [{nom, numLlista}] }
  const [important, setImportantFitxer] = useState(false)
  const [errorFitxer, setErrorFitxer] = useState(null)
  // Si el fitxer pujat portava els fulls "ESFERA PI" / "ESFERA AD" — si
  // no, cal avisar-ho perquè no passi desapercebut que el PI/NESE no
  // s'ha actualitzat en aquesta pujada.
  const [fullsPiAdTrobats, setFullsPiAdTrobats] = useState({ pi: true, ad: true })
  // Actualització de SIEI: fitxer a part ("14b. Alumnes NESE"), no del
  // mateix llibre que ESFERA/ESFERA PI/AD, així que va per la seva pròpia
  // pujada en lloc d'enganxar-se al flux de dalt.
  const [pujantSiei, setPujantSiei] = useState(false)
  const [missatgeSiei, setMissatgeSiei] = useState(null)

  // Llistat del que hi ha desat de debò. Abans només es veia la
  // previsualització d'una importació, que desapareix en confirmar-la:
  // un cop importat no hi havia manera de consultar qui hi ha ni en
  // quin estat, que és el que cal quan un alumne no apareix en algun
  // altre mòdul.
  const [desats, setDesats] = useState([])
  const [carregantDesats, setCarregantDesats] = useState(true)
  const [cerca, setCerca] = useState('')
  const [veureBaixes, setVeureBaixes] = useState(false)

  useEffect(() => { carregaDesats() }, [])

  async function carregaDesats() {
    setCarregantDesats(true)
    try {
      const snap = await getDocs(collection(db, 'alumnes'))
      setDesats(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    } catch {
      setDesats([])
    } finally {
      setCarregantDesats(false)
    }
  }

  // Els que es mostren: filtrats per la cerca i, si no es demana el
  // contrari, només els actius.
  const alumnesFiltrats = useMemo(() => {
    const q = normalitza(cerca)
    return desats
      .filter((a) => (veureBaixes ? true : a.actiu !== false))
      .filter((a) => !q || normalitza(a.nom ?? '').includes(q) || normalitza(a.curs ?? '').includes(q))
  }, [desats, cerca, veureBaixes])

  const perClasse = useMemo(() => {
    const mapa = new Map()
    for (const a of alumnesFiltrats) {
      const curs = a.curs || '(sense classe)'
      if (!mapa.has(curs)) mapa.set(curs, [])
      mapa.get(curs).push(a)
    }
    return [...mapa.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([curs, llista]) => [curs, llista.sort((x, y) => (x.numLlista ?? 999) - (y.numLlista ?? 999))])
  }, [alumnesFiltrats])

  const [confirmaEsborrat, setConfirmaEsborrat] = useState('')
  const [esborrant, setEsborrant] = useState(false)

  const [cursProves, setCursProves] = useState(cursEscolarActual())
  const [confirmaEsborratProves, setConfirmaEsborratProves] = useState('')
  const [esborrantProves, setEsborrantProves] = useState(false)
  const [resultatEsborratProves, setResultatEsborratProves] = useState(null)
  const [classeProves, setClasseProves] = useState('')
  const [inventari, setInventari] = useState(null)
  const [carregantInventari, setCarregantInventari] = useState(false)
  const [confirmaEsborratTot, setConfirmaEsborratTot] = useState('')

  // Només es poden esborrar dades del curs en marxa: les regles de
  // Firestore protegeixen l'històric dels cursos ja tancats.
  const esCursEnMarxa = cursProves.trim() === cursEscolarActual()

  const [ajutFitxer, setAjutFitxer] = useState(null)
  const [ajutCarregant, setAjutCarregant] = useState(false)
  const [ajutMissatge, setAjutMissatge] = useState(null)

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

  /** Pujada opcional del fitxer "Motxilles i Pla de Xoc" — només afegeix
   *  una etiqueta de seguiment (quin ajut i, per tant, qui el finança) als
   *  alumnes que ja existeixen (fets coincidir per IDALU). No canvia qui té
   *  dret a la reducció de les quotes — això ja es calcula a partir de
   *  "Alumne NESE?" i el motiu, tal com sempre. */
  function handleAjutFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAjutMissatge(null)
    setAjutCarregant(true)

    const reader = new FileReader()
    reader.onload = async (event) => {
      const XLSX = await carregaXLSX()
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const primerFull = workbook.Sheets[workbook.SheetNames[0]]
        const files = XLSX.utils.sheet_to_json(primerFull, { header: 1, raw: false })

        // Columnes d'aquest fitxer (0-indexades): 0=IDALU, 7="Pla de Xoc /
        // Motxilles Escolars" (text lliure amb el programa concret).
        const actualitzacions = []
        for (const fila of files) {
          const idalu = fila[0]?.toString().replace(/[^\d]/g, '')
          const programa = fila[7]?.toString().trim()
          if (!idalu || !/^\d+$/.test(idalu) || !programa) continue
          actualitzacions.push({ idalu, programa })
        }

        if (actualitzacions.length === 0) {
          setAjutMissatge({ type: 'error', text: 'No s\'ha trobat cap fila amb IDALU i programa vàlids en aquest fitxer.' })
          setAjutCarregant(false)
          return
        }

        const alumnesRef = collection(db, 'alumnes')
        let actualitzats = 0
        let noTrobats = 0
        for (let i = 0; i < actualitzacions.length; i += 500) {
          const batch = writeBatch(db)
          for (const { idalu, programa } of actualitzacions.slice(i, i + 500)) {
            batch.set(doc(alumnesRef, idalu), { ajutNese: programa }, { merge: true })
          }
          await batch.commit()
          actualitzats += actualitzacions.slice(i, i + 500).length
        }

        setAjutMissatge({ type: 'ok', text: `Etiqueta d'ajut (Motxilles/Pla de Xoc) actualitzada per ${actualitzats} alumnes.` })
      } catch (err) {
        setAjutMissatge({ type: 'error', text: `No s'ha pogut llegir el fitxer: ${err.message}` })
      } finally {
        setAjutCarregant(false)
      }
    }
    reader.onerror = () => {
      setAjutMissatge({ type: 'error', text: 'No s\'ha pogut llegir el fitxer.' })
      setAjutCarregant(false)
    }
    reader.readAsBinaryString(file)
  }

  async function handleFileChange(e) {
    const XLSX = await carregaXLSX()
    const file = e.target.files?.[0]
    if (!file) return
    setErrorFitxer(null)
    setPrevisualitzacio(null)
    setFullsPiAdTrobats({ pi: true, ad: true })

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const primerFull = workbook.Sheets[workbook.SheetNames[0]]
        const files = XLSX.utils.sheet_to_json(primerFull, { header: 1, raw: false })

        // PI i NESE detallat: pestanyes a part del mateix llibre. Si no hi
        // són (fitxer parcial o exportació antiga), es continua igualment
        // amb tothom a false/buit — no bloqueja la importació del llistat
        // principal, que és la part imprescindible.
        const fullPI = workbook.Sheets[FULL_ESFERA_PI]
        const fullAD = workbook.Sheets[FULL_ESFERA_AD]
        const resumPI = fullPI
          ? llegeixResumPI(XLSX.utils.sheet_to_json(fullPI, { header: 1, raw: false }))
          : new Map()
        const resumAD = fullAD
          ? llegeixResumAD(XLSX.utils.sheet_to_json(fullAD, { header: 1, raw: false }))
          : new Map()

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
          const pi = resumPI.get(idalu)?.pi ?? false
          const ad = resumAD.get(idalu)
          if (!perClasse[curs]) perClasse[curs] = []
          perClasse[curs].push({
            nom,
            idalu,
            neseEconomic,
            pi,
            adMotiu: ad?.neseMotiu ?? '',
            adFlag: ad?.neseFlag ?? false,
            adTipusA: ad?.tipusANee ?? false,
            adTipusB: ad?.tipusB ?? false,
            adTipusC: ad?.tipusC ?? false,
          })
        }

        if (Object.keys(perClasse).length === 0) {
          setErrorFitxer('No s\'ha trobat cap alumne amb IDALU vàlid al fitxer. Comprova que és el full "LLISTAT ALUMNES" exportat sencer (full "ESFERA"), no una còpia parcial.')
          return
        }

        const previsualitzat = {}
        for (const [curs, files2] of Object.entries(perClasse)) {
          previsualitzat[curs] = files2
            .sort((a, b) => a.nom.localeCompare(b.nom))
            .map((f, i) => ({
              nom: f.nom,
              idalu: f.idalu,
              numLlista: i + 1,
              neseEconomic: f.neseEconomic,
              pi: f.pi,
              adMotiu: f.adMotiu,
              adFlag: f.adFlag,
              adTipusA: f.adTipusA,
              adTipusB: f.adTipusB,
              adTipusC: f.adTipusC,
            }))
        }
        setPrevisualitzacio(previsualitzat)
        setFullsPiAdTrobats({ pi: Boolean(fullPI), ad: Boolean(fullAD) })
      } catch (err) {
        setErrorFitxer(`No s'ha pogut llegir el fitxer: ${err.message}`)
      }
    }
    reader.onerror = () => setErrorFitxer('No s\'ha pogut llegir el fitxer.')
    reader.readAsBinaryString(file)
  }

  /**
   * Actualitza el flag SIEI a partir del document "14b. Alumnes NESE",
   * un fitxer a part que no té res a veure amb la resta d'aquesta
   * pantalla. Només actualitza alumnes que JA existeixen (aquest fitxer
   * no en té prou dades per crear-ne de nous): els IDALU que hi surten
   * però no coincideixen amb cap alumne actual es compten i s'avisen,
   * no es creen fitxes noves a mitges.
   */
  async function pujaSiei(file) {
    if (!file) return
    setMissatgeSiei(null)
    setPujantSiei(true)
    try {
      const XLSX = await carregaXLSX()
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const full = workbook.Sheets['EE ESFERA']
      if (!full) {
        setMissatgeSiei({ type: 'error', text: 'Aquest fitxer no porta el full "EE ESFERA".' })
        return
      }
      const resumSiei = llegeixResumSIEI(XLSX.utils.sheet_to_json(full, { header: 1, raw: false }))
      if (resumSiei.size === 0) {
        setMissatgeSiei({ type: 'error', text: 'No hi he trobat cap alumne amb IDALU vàlid.' })
        return
      }

      const snap = await getDocs(collection(db, 'alumnes'))
      const existentsIds = new Set(snap.docs.map((d) => d.id))

      let batch = writeBatch(db)
      let opsEnBatch = 0
      let actualitzats = 0
      let noTrobats = 0
      for (const [idalu, { siei }] of resumSiei) {
        if (!existentsIds.has(idalu)) { noTrobats += 1; continue }
        batch.set(doc(db, 'alumnes', idalu), { siei, actualitzatEl: serverTimestamp() }, { merge: true })
        actualitzats += 1
        opsEnBatch += 1
        if (opsEnBatch >= 450) { // marge sota el límit de 500 de Firestore
          await batch.commit()
          batch = writeBatch(db)
          opsEnBatch = 0
        }
      }
      if (opsEnBatch > 0) await batch.commit()

      setMissatgeSiei({
        type: 'ok',
        text: `SIEI actualitzat per a ${actualitzats} alumnes.`
          + (noTrobats > 0 ? ` (${noTrobats} IDALU del fitxer no coincideixen amb cap alumne actual.)` : ''),
      })
    } catch (err) {
      setMissatgeSiei({ type: 'error', text: `No s'ha pogut actualitzar el SIEI: ${err.message}` })
    } finally {
      setPujantSiei(false)
    }
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
      carregaDesats() // el llistat de sota ha de reflectir el que s'acaba d'importar
    }
  }

  const totalAlumnesPrevisualitzats = previsualitzacio
    ? Object.values(previsualitzacio).reduce((acc, llista) => acc + llista.length, 0)
    : 0
  const totalNeseEconomic = previsualitzacio
    ? Object.values(previsualitzacio).reduce((acc, llista) => acc + llista.filter((a) => a.neseEconomic).length, 0)
    : 0
  const totalPi = previsualitzacio
    ? Object.values(previsualitzacio).reduce((acc, llista) => acc + llista.filter((a) => a.pi).length, 0)
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

  /** Busca els registres d'un curs escolar. Es fa servir tant per ensenyar
   *  què hi ha abans d'esborrar com per esborrar-ho.
   *  Si es passa una classe, només retorna els d'aquella classe. */
  async function buscaRegistres(curs, classe = '') {
    // Avaluació: el filtre pel camp "cursEscolar" el fa Firestore. Els
    // registres antics que no portin el camp no hi surten — i tampoc es
    // podrien esborrar, perquè les regles demanen que el camp hi sigui.
    const snapAvaluacio = await getDocs(query(collection(db, 'avaluacio'), where('cursEscolar', '==', curs)))
    let docsAvaluacio = snapAvaluacio.docs

    // Assistència: no porta "cursEscolar", però sí una data — es calcula el
    // rang del curs (de l'1 de setembre al 31 d'agost).
    const [anyIniciStr] = curs.split('-')
    const anyInici = Number(anyIniciStr)
    const snapAssistencia = await getDocs(
      query(collection(db, 'assistencia'), where('data', '>=', `${anyInici}-09-01`), where('data', '<=', `${anyInici + 1}-08-31`))
    )
    let docsAssistencia = snapAssistencia.docs

    if (classe) {
      docsAvaluacio = docsAvaluacio.filter((d) => d.data().curs === classe)
      docsAssistencia = docsAssistencia.filter((d) => d.data().curs === classe)
    }
    return { docsAvaluacio, docsAssistencia }
  }

  /** Ensenya què hi ha desat, classe per classe, abans de tocar res. */
  async function analitzaCurs() {
    setCarregantInventari(true)
    setInventari(null)
    setResultatEsborratProves(null)
    try {
      const { docsAvaluacio, docsAssistencia } = await buscaRegistres(cursProves)
      const perClasse = {}
      const compta = (docs, clau) => {
        for (const d of docs) {
          const classe = d.data().curs ?? '(sense classe)'
          perClasse[classe] = perClasse[classe] ?? { avaluacio: 0, assistencia: 0 }
          perClasse[classe][clau]++
        }
      }
      compta(docsAvaluacio, 'avaluacio')
      compta(docsAssistencia, 'assistencia')
      setInventari({
        classes: Object.entries(perClasse)
          .map(([classe, n]) => ({ classe, ...n }))
          .sort((a, b) => a.classe.localeCompare(b.classe, 'ca')),
        avaluacio: docsAvaluacio.length,
        assistencia: docsAssistencia.length,
      })
      setClasseProves('')
    } catch (err) {
      setInventari({ error: err.message })
    } finally {
      setCarregantInventari(false)
    }
  }

  /** Esborra de debò les notes (Avaluació) i les marques d'assistència d'un
   *  curs escolar — de tot el curs o només d'una classe.
   *  Pensat només per netejar dades de proves: per començar un curs nou de
   *  debò no cal esborrar res, perquè les dades ja queden separades soles
   *  pel camp "cursEscolar". */
  async function esborraProvesDelCurs(classe = '') {
    setEsborrantProves(true)
    setResultatEsborratProves(null)
    try {
      const { docsAvaluacio: trobats, docsAssistencia } = await buscaRegistres(cursProves, classe)

      // Les regles de Firestore només deixen esborrar avaluacions que
      // portin el camp "cursEscolar" i que sigui el del curs en marxa. Els
      // registres antics sense el camp els deixem fora a posta: si
      // n'inclossim cap, Firestore rebutjaria el lot sencer i no
      // s'esborraria res.
      const docsAvaluacio = trobats.filter((d) => d.data().cursEscolar === cursProves)
      const omesos = trobats.length - docsAvaluacio.length

      const totsElsDocs = [
        ...docsAvaluacio.map((d) => ({ ref: doc(db, 'avaluacio', d.id) })),
        ...docsAssistencia.map((d) => ({ ref: doc(db, 'assistencia', d.id) })),
      ]

      for (let i = 0; i < totsElsDocs.length; i += 500) {
        const batch = writeBatch(db)
        for (const { ref } of totsElsDocs.slice(i, i + 500)) batch.delete(ref)
        await batch.commit()
      }

      setResultatEsborratProves({
        avaluacio: docsAvaluacio.length,
        assistencia: docsAssistencia.length,
        omesos,
        classe,
      })
      setConfirmaEsborratProves('')
      setInventari(null)
      setClasseProves('')
    } catch (err) {
      setResultatEsborratProves({ error: err.message })
    } finally {
      setEsborrantProves(false)
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
        <BotoDrive
          onFitxer={handleFileChange}
          tipus="fulls"
          etiqueta="Tria la llista d'alumnes del Drive"
          onError={setErrorFitxer}
        />
        <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} style={{ marginTop: 8 }} />

        {errorFitxer && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{errorFitxer}</p>}

        {previsualitzacio && (
          <div style={{ marginTop: 16 }}>
            {(!fullsPiAdTrobats.pi || !fullsPiAdTrobats.ad) && (
              <div className="placeholder-box" style={{ borderStyle: 'solid', borderColor: 'var(--amber-dark)', marginBottom: 12 }}>
                <strong>Atenció:</strong> aquest fitxer no porta{' '}
                {!fullsPiAdTrobats.pi && !fullsPiAdTrobats.ad
                  ? 'els fulls "ESFERA PI" ni "ESFERA AD"'
                  : !fullsPiAdTrobats.pi ? 'el full "ESFERA PI"' : 'el full "ESFERA AD"'}
                . El PI i el NESE detallat de tothom quedaran a "No" en aquesta importació — puja el
                llibre sencer si vols actualitzar-los.
              </div>
            )}
            <p style={{ fontSize: 14, fontWeight: 600 }}>
              Trobats {totalAlumnesPrevisualitzats} alumnes en {Object.keys(previsualitzacio).length} classes
              ({totalNeseEconomic} amb reducció NESE per situació socioeconòmica, {totalPi} amb PI):
            </p>
            <ul className="roster" style={{ marginTop: 8 }}>
              {Object.entries(previsualitzacio).sort().map(([curs, alumnes]) => (
                <li key={curs} className="roster-row">
                  <span className="roster-name">{curs}</span>
                  <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                    {alumnes.length} alumnes
                    {alumnes.some((a) => a.neseEconomic) && ` · ${alumnes.filter((a) => a.neseEconomic).length} NESE`}
                    {alumnes.some((a) => a.pi) && ` · ${alumnes.filter((a) => a.pi).length} PI`}
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

      <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 24 }}>
        <strong>Actualitza el SIEI</strong>
        <p style={{ marginTop: 6, fontSize: 13 }}>
          Fitxer a part, sense res a veure amb la resta d&apos;aquesta pantalla: el document
          &quot;14b. Alumnes NESE. Curs actual&quot;, full &quot;EE ESFERA&quot;. Només
          actualitza el SIEI dels alumnes que ja hi ha a la llista — no en crea de nous ni en
          toca cap altra dada.
        </p>
        <label
          className="btn-ghost"
          style={{ display: 'inline-block', marginTop: 8, border: '1px solid', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: pujantSiei ? 'default' : 'pointer' }}
        >
          {pujantSiei ? 'Actualitzant…' : '📂 Tria el fitxer "14b. Alumnes NESE"'}
          <input
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            disabled={pujantSiei}
            onChange={(e) => { pujaSiei(e.target.files?.[0]); e.target.value = '' }}
          />
        </label>
        {missatgeSiei && (
          <p style={{ marginTop: 8, fontSize: 13, color: missatgeSiei.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
            {missatgeSiei.text}
          </p>
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

      <div style={{ marginTop: 32, border: '1px solid var(--line)', borderRadius: 12, padding: 20 }}>
        <p className="module-note" style={{ marginTop: 0, fontStyle: 'normal', fontWeight: 600, color: 'var(--ink)' }}>
          Opcional: puja el fitxer "Motxilles i Pla de Xoc"
        </p>
        <p className="module-note" style={{ marginTop: 0 }}>
          Només afegeix una etiqueta de seguiment (quin ajut té cada alumne — Motxilles
          Escolars o Pla de Xoc — i per tant qui el finança, CEB o Generalitat segons la
          promoció). No canvia qui té dret a la reducció de les quotes.
        </p>
        <BotoDrive
          onFitxer={handleAjutFileChange}
          tipus="fulls"
          etiqueta="Tria el fitxer d'ajuts del Drive"
          onError={(t) => setAjutMissatge({ type: 'error', text: t })}
          disabled={ajutCarregant}
        />
        <input type="file" accept=".xlsx,.xls" onChange={handleAjutFileChange} style={{ marginTop: 8 }} disabled={ajutCarregant} />
        {ajutCarregant && <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 8 }}>Actualitzant…</p>}
        {ajutMissatge && (
          <p style={{ fontSize: 13, marginTop: 8, color: ajutMissatge.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
            {ajutMissatge.text}
          </p>
        )}
      </div>


      {/* ── Qui hi ha desat ─────────────────────────────────────────── */}
      <div style={{ marginTop: 36 }}>
        <h3 style={{ fontSize: 16, marginBottom: 4 }}>Alumnes desats</h3>
        <p className="nota">
          El que hi ha ara mateix a la base de dades, no el que s'importarà. Serveix per comprovar
          si un alumne concret hi és i en quin estat, quan no apareix en algun altre mòdul.
        </p>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          <input
            type="text"
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder="Busca per nom o classe…"
            className="camp"
            style={{ minWidth: 240 }}
          />
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={veureBaixes} onChange={() => setVeureBaixes((v) => !v)} />
            Mostra també les baixes
          </label>
          <button type="button" className="btn-ghost" onClick={carregaDesats}>↻ Actualitza</button>
        </div>

        {carregantDesats && <p className="nota">Carregant…</p>}

        {!carregantDesats && (
          <p className="nota" style={{ marginTop: 8 }}>
            {alumnesFiltrats.length} alumnes en {perClasse.length} classes
            {!veureBaixes && desats.some((a) => a.actiu === false) && (
              ` · ${desats.filter((a) => a.actiu === false).length} de baixa, amagats`
            )}
          </p>
        )}

        {!carregantDesats && perClasse.map(([curs, llista]) => (
          <details key={curs} style={{ marginTop: 6 }}>
            <summary style={{ cursor: 'pointer', fontSize: 14 }}>
              <strong>{curs}</strong>
              <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}> — {llista.length} alumnes</span>
            </summary>
            <ol style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4, paddingLeft: 28 }}>
              {llista.map((a) => (
                <li key={a.id} style={{ marginBottom: 2 }}>
                  {a.nom}
                  {a.actiu === false && <span style={{ color: 'var(--red)' }}> · de baixa</span>}
                  {!a.idalu && <span style={{ color: 'var(--amber-dark)' }}> · sense IDALU</span>}
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>

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
              className="btn-perill"
            >
              {esborrant ? 'Esborrant…' : 'Esborra tots els alumnes'}
            </button>
          </div>
        </div>
      </details>

      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--red)' }}>
          Zona perillosa: esborra notes i assistència de proves
        </summary>
        <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 16, borderColor: 'var(--red)' }}>
          <p>
            <strong>Això esborra de debò notes d'Avaluació i marques d'Assistència</strong> — no
            és reversible. Pots fer-ho d'una classe sola o de tot un curs escolar. Fes-ho servir
            només per netejar dades de proves, mai amb dades reals d'alumnes.
          </p>
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--ink-soft)' }}>
            Per començar un curs nou de debò <strong>no cal fer servir això</strong>: les notes
            ja queden separades soles per curs escolar, sense esborrar res.
          </p>
          <label className="field" style={{ maxWidth: 160, marginTop: 10 }}>
            <span>Curs escolar a netejar</span>
            <input
              type="text"
              value={cursProves}
              onChange={(e) => { setCursProves(e.target.value); setInventari(null); setClasseProves('') }}
              style={{ border: '1px solid var(--red)', borderRadius: 8, padding: '8px 10px', fontWeight: 600 }}
            />
          </label>

          {!esCursEnMarxa && (
            <p style={{ marginTop: 10, fontSize: 13, color: 'var(--amber-dark)' }}>
              El curs {cursProves} no és el que corre ({cursEscolarActual()}). Pots mirar què hi
              ha desat, però <strong>no esborrar-hi res</strong>: les regles de Firestore protegeixen
              l'històric dels cursos tancats i rebutjarien l'operació.
            </p>
          )}

          <button
            type="button"
            onClick={analitzaCurs}
            disabled={carregantInventari || !cursProves.trim()}
            className="btn-ghost"
            style={{ marginTop: 10, color: 'var(--navy)', borderColor: 'var(--navy)', maxWidth: 260, fontSize: 13 }}
          >
            {carregantInventari ? 'Mirant…' : 'Mira què hi ha desat en aquest curs'}
          </button>

          {inventari?.error && (
            <p style={{ marginTop: 10, fontSize: 13, color: 'var(--red)' }}>No s'ha pogut consultar: {inventari.error}</p>
          )}

          {inventari && !inventari.error && (
            <div style={{ marginTop: 12 }}>
              {inventari.classes.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                  No hi ha cap registre desat del curs {cursProves}. No hi ha res a esborrar.
                </p>
              ) : (
                <>
                  <p style={{ fontSize: 13 }}>
                    Al curs {cursProves} hi ha <strong>{inventari.avaluacio}</strong> registres
                    d'avaluació i <strong>{inventari.assistencia}</strong> d'assistència,
                    repartits així:
                  </p>
                  <div className="taula-scroll">
                    <table style={{ marginTop: 8, fontSize: 12, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '4px 10px 4px 0' }}>Classe</th>
                          <th style={{ textAlign: 'right', padding: '4px 10px' }}>Avaluació</th>
                          <th style={{ textAlign: 'right', padding: '4px 10px' }}>Assistència</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventari.classes.map((c) => (
                          <tr key={c.classe} style={{ background: classeProves === c.classe ? 'var(--sand)' : 'transparent' }}>
                            <td style={{ padding: '4px 10px 4px 0' }}>
                              <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                                <input
                                  type="radio"
                                  name="classeProves"
                                  checked={classeProves === c.classe}
                                  onChange={() => { setClasseProves(c.classe); setConfirmaEsborratProves('') }}
                                />
                                {c.classe}
                              </label>
                            </td>
                            <td style={{ textAlign: 'right', padding: '4px 10px' }}>{c.avaluacio}</td>
                            <td style={{ textAlign: 'right', padding: '4px 10px' }}>{c.assistencia}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Esborrar només una classe ── */}
          <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <strong style={{ fontSize: 13 }}>Esborra només una classe</strong>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
              {classeProves
                ? <>Esborrarà els registres de <strong>{classeProves}</strong> del curs {cursProves}. La resta de classes no es toca.</>
                : 'Prem el botó de sobre i tria una classe de la llista.'}
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={confirmaEsborratProves}
                onChange={(e) => setConfirmaEsborratProves(e.target.value)}
                placeholder="ESBORRA"
                disabled={!esCursEnMarxa || !classeProves}
                style={{ border: '1px solid var(--red)', borderRadius: 8, padding: '8px 10px', maxWidth: 160 }}
              />
              <button
                type="button"
                onClick={() => esborraProvesDelCurs(classeProves)}
                disabled={!esCursEnMarxa || !classeProves || confirmaEsborratProves !== 'ESBORRA' || esborrantProves}
                className="btn-perill"
              >
                {esborrantProves ? 'Esborrant…' : `Esborra ${classeProves || 'la classe triada'}`}
              </button>
            </div>
          </div>

          {/* ── Esborrar el curs sencer ── */}
          <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
            <strong style={{ fontSize: 13, color: 'var(--red)' }}>Esborra tot el curs {cursProves}</strong>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 4 }}>
              Totes les classes de cop. Com que no té volta enrere, aquí cal
              escriure <strong>ESBORRA TOT</strong>, no només ESBORRA.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={confirmaEsborratTot}
                onChange={(e) => setConfirmaEsborratTot(e.target.value)}
                placeholder="ESBORRA TOT"
                style={{ border: '1px solid var(--red)', borderRadius: 8, padding: '8px 10px', maxWidth: 180 }}
              />
              <button
                type="button"
                onClick={() => { esborraProvesDelCurs(''); setConfirmaEsborratTot('') }}
                disabled={!esCursEnMarxa || confirmaEsborratTot !== 'ESBORRA TOT' || esborrantProves}
                className="btn-perill"
              >
                {esborrantProves ? 'Esborrant…' : `Esborra-ho tot del curs ${cursProves}`}
              </button>
            </div>
          </div>

          {resultatEsborratProves && (
            <p style={{ marginTop: 14, fontSize: 13, color: resultatEsborratProves.error ? 'var(--red)' : 'var(--green)' }}>
              {resultatEsborratProves.error
                ? `No s'ha pogut esborrar: ${resultatEsborratProves.error}`
                : `Esborrats ${resultatEsborratProves.avaluacio} registres d'avaluació i ${resultatEsborratProves.assistencia} d'assistència ${resultatEsborratProves.classe ? `de ${resultatEsborratProves.classe}` : 'de totes les classes'} del curs ${cursProves}.` + (resultatEsborratProves.omesos > 0 ? ` ${resultatEsborratProves.omesos} registres antics sense el camp "cursEscolar" s'han deixat estar.` : '')}
            </p>
          )}
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
    for (const {
      nom, numLlista, idalu, neseEconomic,
      pi, adMotiu, adFlag, adTipusA, adTipusB, adTipusC,
    } of alumnes) {
      const id = idalu ? String(idalu) : (existentsPerNom.get(nom)?.id ?? slug(nom))
      const existent = idalu ? existentsPerId.get(id) : existentsPerNom.get(nom)

      vistos.add(id)

      batch.set(
        doc(alumnesRef, id),
        {
          nom, curs, numLlista, idalu: idalu ?? null, neseEconomic: Boolean(neseEconomic), actiu: true,
          // PI i NESE detallat pel SIC automàtic (vegeu sicAlumnatIndicadors.js).
          // Si el fitxer pujat no portava els fulls "ESFERA PI"/"ESFERA AD",
          // aquests venen tots a false/buit — no s'esborra res del que ja hi
          // hagués abans amb el merge, però tampoc es dona per fet que sigui
          // correcte: per això la pantalla avisa quan falten aquests fulls.
          pi: Boolean(pi),
          adMotiu: adMotiu ?? '',
          adFlag: Boolean(adFlag),
          adTipusA: Boolean(adTipusA),
          adTipusB: Boolean(adTipusB),
          adTipusC: Boolean(adTipusC),
          actualitzatEl: serverTimestamp(),
        },
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
