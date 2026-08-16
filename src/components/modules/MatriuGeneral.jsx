import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, serverTimestamp, where } from 'firebase/firestore'
import { db, auth } from '../../firebase'
import { cursEscolarActual } from '../../lib/cursEscolar'
import { FESTES, mitjanaValoracio, mitjanaObjectiu, objectiuBuit, actuacioBuida, afegeixALlista } from '../../lib/valoracions'
import { exportaValoracionsExcel, exportaValoracionsPDF } from '../../lib/valoracionsExport'
import { carregaConfigValoracions, desaConfigValoracions } from '../../lib/valoracionsConfig'
import { interpretaResum, interpretaFullObjectiu, interpretaResumCicle, interpretaResumFesta, interpretaFullGrupFesta } from '../../lib/comissioTemplateParser'
import { CICLES } from '../../lib/valoracions'
import { GRUPS, festaBuida, objectiuFestaBuit, activitatBuida } from '../../lib/festesDetall'
import { slug } from '../../lib/slug'
import BotoDrive from '../BotoDrive'
import { carregaXLSX } from '../../lib/carregaLlibreries'

function colorPer(valor) {
  if (valor === null || valor === undefined) return 'var(--ink-soft)'
  const n = Number(valor)
  if (n >= 80) return 'var(--green)'
  if (n >= 40) return 'var(--amber-dark)'
  return 'var(--red)'
}

// ── Les quatre seccions del panell de configuració ────────────────────────
// Cicles, comissions, comissions mixtes i festes fan totes la mateixa feina,
// i abans cadascuna s'escrivia sencera amb els seus textos: els botons van
// acabar dient coses diferents per fer el mateix. Ara comparteixen aquests
// trossos i només canvia el text d'ajuda de cada secció.

function TitolSeccio({ titol, ajuda, primer = false }) {
  return (
    <>
      <p style={{ fontSize: 13, fontWeight: 600, marginTop: primer ? 0 : 22 }}>{titol}</p>
      <p style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>{ajuda}</p>
    </>
  )
}

/** La llista d'elements amb la casella per activar i la ✕ per treure'ls.
 *  `clau` és el nom (comissions) o l'identificador (festes). */
function Etiquetes({ elements, onCanvia, onEsborra }) {
  if (elements.length === 0) {
    return <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8 }}>Encara no n&apos;hi ha cap.</p>
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
      {elements.map((e) => (
        <span key={e.clau} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, opacity: e.activa ? 1 : 0.5 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={e.activa} onChange={() => onCanvia(e.clau, e.etiqueta)} />
            {e.etiqueta}
          </label>
          <button
            type="button"
            onClick={() => onEsborra(e.clau, e.etiqueta)}
            title={`Esborra "${e.etiqueta}"`}
            aria-label={`Esborra ${e.etiqueta}`}
            style={{
              background: 'none', border: 'none', color: 'var(--red)',
              cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 2px',
            }}
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  )
}

function AfegeixNom({ valor, onCanvia, placeholder, onAfegeix }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        type="text"
        value={valor}
        onChange={(ev) => onCanvia(ev.target.value)}
        placeholder={placeholder}
        style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '6px 8px', fontSize: 12 }}
      />
      <button type="button" onClick={onAfegeix} className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}>
        + Afegeix en blanc
      </button>
    </div>
  )
}

/** Els dos botons de plantilla: del Drive o de l'ordinador. Fan exactament
 *  el mateix — només canvia d'on surt el fitxer — i per això van sempre
 *  junts i amb el mateix text. */
function BotonsPlantilla({ onFitxer, pujant, onError }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <BotoDrive
        onFitxer={onFitxer}
        tipus="fulls"
        etiqueta="Tria una plantilla del Drive"
        onError={onError}
        disabled={pujant}
      />
      <label className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px', cursor: 'pointer', display: 'inline-flex', color: 'var(--navy)', borderColor: 'var(--navy)' }}>
        {pujant ? 'Llegint la plantilla…' : '📤 Puja una plantilla (Excel)'}
        <input type="file" accept=".xlsx,.xls" onChange={onFitxer} style={{ display: 'none' }} disabled={pujant} />
      </label>
    </div>
  )
}

function ResultatPlantilla({ resultat }) {
  return (
    <p style={{ fontSize: 12, color: 'var(--green)', marginTop: 6 }}>
      ✓ &quot;{resultat.nom}&quot; creada amb {resultat.numObjectius} objectius i {resultat.numActuacions} actuacions. Ja està activa per als docents.
    </p>
  )
}

export default function MatriuGeneral() {
  const [cursEscolarId, setCursEscolarId] = useState(cursEscolarActual())
  const [valoracions, setValoracions] = useState([])
  const [carregant, setCarregant] = useState(true)
  const [missatge, setMissatge] = useState(null)
  const [obert, setObert] = useState(null)

  const [config, setConfig] = useState(null)
  const [nomNouComissio, setNomNouComissio] = useState('')
  const [nomNovaMixta, setNomNovaMixta] = useState('')
  const [nomNovaFesta, setNomNovaFesta] = useState('')
  const [descarregant, setDescarregant] = useState(null)
  const [desantConfig, setDesantConfig] = useState(false)

  useEffect(() => {
    carrega()
    carregaConfig()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursEscolarId])

  async function carregaConfig() {
    try {
      setConfig(await carregaConfigValoracions(cursEscolarId))
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut carregar la configuració: ${err.message}` })
    }
  }

  async function desaConfig(configNova) {
    setConfig(configNova)
    setDesantConfig(true)
    try {
      await desaConfigValoracions(cursEscolarId, configNova)
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut desar la configuració: ${err.message}` })
    } finally {
      setDesantConfig(false)
    }
  }

  /** Les comissions i les comissions mixtes són dues llistes amb la mateixa
   *  forma (`clau` és 'comissions' o 'mixtes'), i es tracten igual. */
  function toggleNom(clau, nom) {
    desaConfig({ ...config, [clau]: config[clau].map((c) => c.nom === nom ? { ...c, activa: !c.activa } : c) })
  }

  function toggleFesta(id) {
    desaConfig({ ...config, festes: config.festes.map((f) => f.id === id ? { ...f, activa: !f.activa } : f) })
  }

  /**
   * Treu una comissió (o una comissió mixta) de la llista, i opcionalment
   * esborra també la valoració que hi hagi desada.
   *
   * Es demana confirmació escrivint el nom perquè, si hi ha dades, es
   * perden: una valoració és feina de tot un curs. Les regles de Firestore
   * només permeten esborrar-la des del compte de direcció.
   *
   * Les mixtes es desen a la mateixa col·lecció `valoracions` que la resta,
   * amb el nom com a identificador, i per això aquí no cal distingir-les.
   */
  async function esborraDeLlista(clau, nom) {
    const teDades = valoracions.some((v) => v.nom === nom)
    const avis = teDades
      ? `"${nom}" té una valoració desada d'aquest curs.\n\nEscriu-ne el nom per confirmar que vols esborrar-la. No es pot desfer.`
      : `Vols treure "${nom}" de la llista? No hi ha cap valoració desada, així que no es perd res.`

    if (teDades) {
      const escrit = window.prompt(avis)
      if (escrit?.trim() !== nom) return
    } else if (!window.confirm(avis)) {
      return
    }

    setDesantConfig(true)
    setMissatge(null)
    try {
      if (teDades) {
        for (const v of valoracions.filter((x) => x.nom === nom)) {
          await deleteDoc(doc(db, 'valoracions', v.id))
        }
      }
      await desaConfig({ ...config, [clau]: config[clau].filter((c) => c.nom !== nom) })
      setMissatge({
        type: 'ok',
        text: teDades ? `"${nom}" i la seva valoració s'han esborrat.` : `"${nom}" s'ha tret de la llista.`,
      })
      carrega()
    } catch (err) {
      setMissatge({
        type: 'error',
        text: err.code === 'permission-denied'
          ? "Només el compte de direcció pot esborrar valoracions."
          : `No s'ha pogut esborrar: ${err.message}`,
      })
    } finally {
      setDesantConfig(false)
    }
  }

  /** Afegeix una festa que no és a la llista de sempre. L'identificador
   *  surt del nom, com a la resta de l'app. */
  /**
   * Genera la descàrrega i, sobretot, ensenya què passa.
   *
   * Abans es cridava la funció d'exportació directament des de l'onClick:
   * si petava, el navegador s'empassava l'error i no passava
   * absolutament res, sense cap pista de per què.
   */
  async function descarrega(quin, fes) {
    setDescarregant(quin)
    setMissatge(null)
    try {
      if (valoracions.length === 0) {
        throw new Error('No hi ha cap valoració desada en aquest curs escolar.')
      }
      await fes()
      setMissatge({ type: 'ok', text: `Descàrrega generada amb ${valoracions.length} valoracions.` })
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut generar la descàrrega: ${err.message}` })
    } finally {
      setDescarregant(null)
    }
  }

  function afegeixFesta() {
    const label = nomNovaFesta.trim()
    if (!label) return
    const id = slug(label)
    if (config.festes.some((f) => f.id === id)) return
    desaConfig({ ...config, festes: [...config.festes, { id, label, activa: true }] })
    setNomNovaFesta('')
  }

  /** Treu una festa de la llista, i la seva valoració si en té. */
  async function esborraFesta(id, label) {
    const idDoc = `${cursEscolarId}__festa-${id}`
    let teDades = false
    try {
      teDades = (await getDoc(doc(db, 'festesDetall', idDoc))).exists()
    } catch { teDades = false }

    if (teDades) {
      const escrit = window.prompt(
        `"${label}" té una valoració desada d'aquest curs.\n\nEscriu-ne el nom per confirmar que vols esborrar-la. No es pot desfer.`
      )
      if (escrit?.trim() !== label) return
    } else if (!window.confirm(`Vols treure "${label}" de la llista? No hi ha cap valoració desada.`)) {
      return
    }

    setDesantConfig(true)
    setMissatge(null)
    try {
      if (teDades) await deleteDoc(doc(db, 'festesDetall', idDoc))
      await desaConfig({ ...config, festes: config.festes.filter((f) => f.id !== id) })
      setMissatge({
        type: 'ok',
        text: teDades ? `"${label}" i la seva valoració s'han esborrat.` : `"${label}" s'ha tret de la llista.`,
      })
    } catch (err) {
      setMissatge({
        type: 'error',
        text: err.code === 'permission-denied'
          ? 'Només el compte de direcció pot esborrar valoracions.'
          : `No s'ha pogut esborrar: ${err.message}`,
      })
    } finally {
      setDesantConfig(false)
    }
  }

  function afegeixComissio() {
    const llista = afegeixALlista(config.comissions, nomNouComissio)
    if (llista === config.comissions) return
    desaConfig({ ...config, comissions: llista })
    setNomNouComissio('')
  }

  function afegeixMixta() {
    const llista = afegeixALlista(config.mixtes, nomNovaMixta)
    if (llista === config.mixtes) return
    desaConfig({ ...config, mixtes: llista })
    setNomNovaMixta('')
  }

  // Quina de les dues llistes està llegint una plantilla ara mateix:
  // 'comissions', 'mixtes' o res.
  const [pujant, setPujant] = useState(null)
  const [resultatPlantilla, setResultatPlantilla] = useState(null)

  /**
   * Puja una plantilla "Valoració [Comissió/Equip]" (Excel amb un full
   * "Resum" i un full "Objectiu N" per cada objectiu), la interpreta, i
   * crea directament la valoració d'aquest curs escolar ja omplerta amb el
   * text real — a més d'activar-la a la llista.
   *
   * Les comissions mixtes tenen plantilles amb la mateixa forma, així que
   * és el mateix lector: `clau` només diu a quina de les dues llistes ha
   * d'anar a parar, que és la secció on s'hagi premut el botó.
   */
  function pujaPlantillaComissio(e, clau = 'comissions') {
    const file = e.target.files?.[0]
    if (!file) return
    setPujant(clau)
    setMissatge(null)
    setResultatPlantilla(null)

    const reader = new FileReader()
    reader.onload = async (event) => {
      const XLSX = await carregaXLSX()
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const nomFullResum = workbook.SheetNames.find((n) => n.toLowerCase().includes('resum')) ?? workbook.SheetNames[0]
        const filesResum = XLSX.utils.sheet_to_json(workbook.Sheets[nomFullResum], { header: 1, raw: false })
        const { nom, responsable, membres, objectius: objectiusResum } = interpretaResum(filesResum)

        if (!nom || objectiusResum.length === 0) {
          setMissatge({ type: 'error', text: 'No he pogut interpretar aquesta plantilla — comprova que és el fitxer correcte (amb un full "Resum").' })
          setPujant(null)
          return
        }

        const objectius = objectiusResum.map(({ num, text }) => {
          const o = objectiuBuit()
          o.text = text
          const nomFullObjectiu = workbook.SheetNames.find((n) => new RegExp(`^objectiu\\s*${num}$`, 'i').test(n.trim()))
          if (nomFullObjectiu) {
            const filesObjectiu = XLSX.utils.sheet_to_json(workbook.Sheets[nomFullObjectiu], { header: 1, raw: false })
            const actuacionsText = interpretaFullObjectiu(filesObjectiu)
            o.actuacions = actuacionsText.map(({ text, indicador }) => {
              const a = actuacioBuida()
              a.text = text
              a.indicador = indicador
              return a
            })
          }
          return o
        })

        // Creem/actualitzem la valoració d'aquest curs amb el que hem trobat.
        const id = `${cursEscolarId}__${slug(nom)}`
        await setDoc(doc(db, 'valoracions', id), {
          nom,
          responsable,
          membres,
          objectius,
          valoracioRevisio: '',
          valoracioFinal: '',
          metodologies: '',
          propostesMillora: '',
          cursEscolar: cursEscolarId,
          actualitzatEl: serverTimestamp(),
          actualitzatPer: auth.currentUser?.email ?? null,
        })

        // I l'activem perquè els docents ja la vegin. Va a la llista de la
        // secció des d'on s'ha pujat, però si el nom ja és a l'altra, mana
        // l'altra: si no, la mateixa comissió sortiria a les dues pestanyes.
        const altra = clau === 'comissions' ? 'mixtes' : 'comissions'
        const jaHiEs = (llista) => llista.find((c) => c.nom.toLowerCase() === nom.toLowerCase())
        const onVa = jaHiEs(config[altra]) ? altra : clau
        const existent = jaHiEs(config[onVa])
        if (!existent) {
          await desaConfig({ ...config, [onVa]: afegeixALlista(config[onVa], nom) })
        } else if (!existent.activa) {
          await desaConfig({
            ...config,
            [onVa]: config[onVa].map((c) => c.nom === existent.nom ? { ...c, activa: true } : c),
          })
        }

        setResultatPlantilla({
          clau: onVa,
          nom,
          numObjectius: objectius.length,
          numActuacions: objectius.reduce((a, o) => a + o.actuacions.length, 0),
        })
        await carrega()
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'ha pogut llegir la plantilla: ${err.message}` })
      } finally {
        setPujant(null)
      }
    }
    reader.onerror = () => {
      setMissatge({ type: 'error', text: 'No s\'ha pogut llegir el fitxer.' })
      setPujant(null)
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  const [pujantCicle, setPujantCicle] = useState(false)
  const [resultatCicle, setResultatCicle] = useState(null)

  /** Puja una plantilla senzilla de CICLE (un sol full, sense fulls
   *  d'objectiu separats) i crea/actualitza la valoració d'aquest curs. */
  function pujaPlantillaCicle(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPujantCicle(true)
    setMissatge(null)
    setResultatCicle(null)

    const reader = new FileReader()
    reader.onload = async (event) => {
      const XLSX = await carregaXLSX()
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const nomFull = workbook.SheetNames.find((n) => n.toLowerCase().includes('valoraci')) ?? workbook.SheetNames[0]
        const files_ = XLSX.utils.sheet_to_json(workbook.Sheets[nomFull], { header: 1, raw: false })
        const { nom, responsable, membres, objectius: textosObjectius, metodologies } = interpretaResumCicle(files_)

        const nomCicle = CICLES.find((c) => c.toLowerCase() === nom.toLowerCase()) ?? nom
        if (!nomCicle || textosObjectius.length === 0) {
          setMissatge({ type: 'error', text: 'No he pogut interpretar aquesta plantilla de cicle — comprova que és el fitxer correcte.' })
          setPujantCicle(false)
          return
        }

        const objectius = textosObjectius.map((text) => {
          const o = objectiuBuit()
          o.text = text
          return o
        })

        const id = `${cursEscolarId}__${slug(nomCicle)}`
        await setDoc(doc(db, 'valoracions', id), {
          nom: nomCicle,
          responsable,
          membres,
          objectius,
          valoracioRevisio: '',
          valoracioFinal: '',
          metodologies,
          propostesMillora: '',
          cursEscolar: cursEscolarId,
          actualitzatEl: serverTimestamp(),
          actualitzatPer: auth.currentUser?.email ?? null,
        })

        setResultatCicle({ nom: nomCicle, numObjectius: objectius.length })
        await carrega()
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'ha pogut llegir la plantilla: ${err.message}` })
      } finally {
        setPujantCicle(false)
      }
    }
    reader.onerror = () => {
      setMissatge({ type: 'error', text: 'No s\'ha pogut llegir el fitxer.' })
      setPujantCicle(false)
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  const [pujantFesta, setPujantFesta] = useState(false)
  const [resultatFesta, setResultatFesta] = useState(null)

  /** Puja una plantilla de FESTA (full "Resum" + un full per cada grup:
   *  Educació Infantil, Cicle Inicial...) i crea/actualitza la valoració
   *  detallada d'aquesta festa per aquest curs. */
  function pujaPlantillaFesta(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPujantFesta(true)
    setMissatge(null)
    setResultatFesta(null)

    const reader = new FileReader()
    reader.onload = async (event) => {
      const XLSX = await carregaXLSX()
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' })
        const nomFullResum = workbook.SheetNames.find((n) => n.toLowerCase().includes('resum')) ?? workbook.SheetNames[0]
        const filesResum = XLSX.utils.sheet_to_json(workbook.Sheets[nomFullResum], { header: 1, raw: false })
        const resumFesta = interpretaResumFesta(filesResum)

        if (!resumFesta.activitat || resumFesta.objectius.length === 0) {
          setMissatge({ type: 'error', text: 'No he pogut interpretar aquesta plantilla de festa — comprova que és el fitxer correcte (amb un full "Resum").' })
          setPujantFesta(false)
          return
        }

        const festival = FESTES.find((f) => resumFesta.activitat.toLowerCase().includes(f.label.toLowerCase()) || f.label.toLowerCase().includes(resumFesta.activitat.toLowerCase().replace(/^festa (de |del |la )?/i, '')))
        if (!festival) {
          setMissatge({ type: 'error', text: `No he pogut identificar quina festa és "${resumFesta.activitat}" — comprova que el nom coincideix amb una de la llista.` })
          setPujantFesta(false)
          return
        }

        const nova = festaBuida(festival.label)
        nova.data = resumFesta.data
        nova.pesCicles = resumFesta.pesCicles
        nova.pesEquipDirectiu = resumFesta.pesEquipDirectiu
        nova.objectius = resumFesta.objectius.map(({ num, text, pes }) => {
          const o = objectiuFestaBuit(pes)
          o.text = text
          o._num = num // temporal, per emparellar amb els grups
          return o
        })

        const grups = {}
        for (const g of GRUPS) {
          grups[g] = {}
          const nomFullGrup = workbook.SheetNames.find((n) => n.trim().toLowerCase() === g.toLowerCase())
          const activitatsPerObjectiu = nomFullGrup
            ? interpretaFullGrupFesta(XLSX.utils.sheet_to_json(workbook.Sheets[nomFullGrup], { header: 1, raw: false }), resumFesta.objectius)
            : {}
          nova.objectius.forEach((o) => {
            const textos = activitatsPerObjectiu[o._num] ?? []
            grups[g][o.id] = {
              activitats: textos.map(({ text }) => { const a = activitatBuida(); a.text = text; return a }),
              comentaris: '',
            }
          })
        }
        nova.grups = grups
        nova.objectius.forEach((o) => { delete o._num })

        const id = `${cursEscolarId}__festa-${festival.id}`
        await setDoc(doc(db, 'festesDetall', id), {
          festa: nova,
          cursEscolar: cursEscolarId,
          actualitzatEl: serverTimestamp(),
          actualitzatPer: auth.currentUser?.email ?? null,
        })

        if (!config.festes.find((f) => f.id === festival.id)?.activa) {
          await desaConfig({ ...config, festes: config.festes.map((f) => f.id === festival.id ? { ...f, activa: true } : f) })
        }

        const totalActivitats = Object.values(grups).reduce((acc, g) => acc + Object.values(g).reduce((a2, o) => a2 + o.activitats.length, 0), 0)
        setResultatFesta({ nom: festival.label, numObjectius: nova.objectius.length, numActivitats: totalActivitats })
      } catch (err) {
        setMissatge({ type: 'error', text: `No s'ha pogut llegir la plantilla: ${err.message}` })
      } finally {
        setPujantFesta(false)
      }
    }
    reader.onerror = () => {
      setMissatge({ type: 'error', text: 'No s\'ha pogut llegir el fitxer.' })
      setPujantFesta(false)
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }


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

      <details style={{ marginTop: 20 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          ⚙ Quines comissions, comissions mixtes i festes surten activades per als docents {desantConfig && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-soft)' }}>(desant…)</span>}
        </summary>
        {!config ? (
          <p style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-soft)' }}>Carregant…</p>
        ) : (
          <div className="placeholder-box" style={{ borderStyle: 'solid', marginTop: 10 }}>
            <TitolSeccio
              titol="Cicles"
              ajuda="Els 4 cicles sempre estan disponibles per als docents — no cal activar-los. Aquí només pots pujar-hi la plantilla d'un curs concret, ja omplerta."
              primer
            />
            <BotonsPlantilla
              onFitxer={pujaPlantillaCicle}
              pujant={pujantCicle}
              onError={(t) => setMissatge({ type: 'error', text: t })}
            />
            {resultatCicle && (
              <p style={{ fontSize: 12, color: 'var(--green)', marginTop: 6 }}>
                ✓ &quot;{resultatCicle.nom}&quot; actualitzat amb {resultatCicle.numObjectius} objectius.
              </p>
            )}

            <TitolSeccio
              titol="Comissions i equips"
              ajuda="Les del claustre. La plantilla ha de ser un Excel &quot;Valoració ...&quot; amb un full Resum i un full per objectiu."
            />
            <Etiquetes
              elements={config.comissions.map((c) => ({ clau: c.nom, etiqueta: c.nom, activa: c.activa }))}
              onCanvia={(nom) => toggleNom('comissions', nom)}
              onEsborra={(nom) => esborraDeLlista('comissions', nom)}
            />
            <AfegeixNom
              valor={nomNouComissio}
              onCanvia={setNomNouComissio}
              placeholder="Nom d'una comissió o equip"
              onAfegeix={afegeixComissio}
            />
            <BotonsPlantilla
              onFitxer={(e) => pujaPlantillaComissio(e, 'comissions')}
              pujant={pujant === 'comissions'}
              onError={(t) => setMissatge({ type: 'error', text: t })}
            />
            {resultatPlantilla?.clau === 'comissions' && <ResultatPlantilla resultat={resultatPlantilla} />}

            <TitolSeccio
              titol="Comissions mixtes (amb l'AFA)"
              ajuda="Les que tenen participació de famílies, de l'AFA o d'una entitat de fora. Tenen pestanya pròpia a &quot;Documentació&quot; i la plantilla té la mateixa forma que la d'una comissió."
            />
            <Etiquetes
              elements={config.mixtes.map((c) => ({ clau: c.nom, etiqueta: c.nom, activa: c.activa }))}
              onCanvia={(nom) => toggleNom('mixtes', nom)}
              onEsborra={(nom) => esborraDeLlista('mixtes', nom)}
            />
            <AfegeixNom
              valor={nomNovaMixta}
              onCanvia={setNomNovaMixta}
              placeholder="Nom d'una comissió mixta"
              onAfegeix={afegeixMixta}
            />
            <BotonsPlantilla
              onFitxer={(e) => pujaPlantillaComissio(e, 'mixtes')}
              pujant={pujant === 'mixtes'}
              onError={(t) => setMissatge({ type: 'error', text: t })}
            />
            {resultatPlantilla?.clau === 'mixtes' && <ResultatPlantilla resultat={resultatPlantilla} />}

            <TitolSeccio
              titol="Festes i celebracions"
              ajuda="La plantilla d'una festa és un Excel amb el full Resum i un full per cada grup (Educació Infantil, Cicle Inicial...)."
            />
            <Etiquetes
              elements={config.festes.map((f) => ({
                clau: f.id,
                etiqueta: f.label ?? FESTES.find((ff) => ff.id === f.id)?.label ?? f.id,
                activa: f.activa,
              }))}
              onCanvia={toggleFesta}
              onEsborra={(id, etiqueta) => esborraFesta(id, etiqueta)}
            />
            <AfegeixNom
              valor={nomNovaFesta}
              onCanvia={setNomNovaFesta}
              placeholder="Nom d'una festa"
              onAfegeix={afegeixFesta}
            />
            <BotonsPlantilla
              onFitxer={pujaPlantillaFesta}
              pujant={pujantFesta}
              onError={(t) => setMissatge({ type: 'error', text: t })}
            />
            {resultatFesta && (
              <p style={{ fontSize: 12, color: 'var(--green)', marginTop: 6 }}>
                ✓ &quot;{resultatFesta.nom}&quot; actualitzada amb {resultatFesta.numObjectius} objectius i {resultatFesta.numActivitats} activitats. Ja està activa per als docents.
              </p>
            )}

            <p style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 16 }}>
              Es desa sol. El professorat, des de &quot;Documentació&quot;, només veurà com a opció el que
              estigui marcat aquí — desmarcar-ne una no esborra les dades que ja s'hi hagin
              introduït, només l'amaga de la llista. La ✕ sí que esborra.
            </p>
          </div>
        )}
      </details>

      {valoracions.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            className="btn-ghost"
            style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
            onClick={() => descarrega('excel', () => exportaValoracionsExcel(valoracions, cursEscolarId))}
            disabled={descarregant !== null}
            type="button"
          >
            {descarregant === 'excel' ? 'Generant l\'Excel…' : '📥 Descarrega totes en Excel (amb totes les pestanyes)'}
          </button>
          <button
            className="btn-ghost"
            style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
            onClick={() => descarrega('pdf', () => exportaValoracionsPDF(valoracions, cursEscolarId))}
            disabled={descarregant !== null}
            type="button"
          >
            {descarregant === 'pdf' ? 'Generant el PDF…' : '📄 Descarrega totes en PDF'}
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

                    <div className="taula-scroll">
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
                    </div>

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
