import { useEffect, useState } from 'react'
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, serverTimestamp, where } from 'firebase/firestore'
import { db, auth } from '../../firebase'
import { cursEscolarActual } from '../../lib/cursEscolar'
import { FESTES, mitjanaValoracio, mitjanaObjectiu, afegeixALlista, agrupaValoracions, nomJaExistent, mateixNom } from '../../lib/valoracions'
import { exportaValoracionsExcel, exportaValoracionsPDF } from '../../lib/valoracionsExport'
import { carregaConfigValoracions, desaConfigValoracions } from '../../lib/valoracionsConfig'
import { analitzaLlibre, TIPUS } from '../../lib/plantillesImport'
import { CICLES } from '../../lib/valoracions'
import { normalitzaFesta, mitjanaGeneralFesta, mitjanaGrup } from '../../lib/festesDetall'
import { normalitzaCooperatiu, grauGlobal, grauCicle, CICLES_COOPERATIU } from '../../lib/aprenentatgeCooperatiu'
import { grauSatisfaccioCicle, percentValorades, totalRepetirSi, mitjanaActivitat } from '../../lib/activitatsComplementariesDetall'
import { triaDocumentsDelDrive } from '../../lib/drivePicker'
import { slug } from '../../lib/slug'
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

/** La taula de revisió: què s'ha trobat a cada fitxer abans d'escriure res.
 *  El tipus es pot corregir perquè una comissió mixta no es pot distingir
 *  d'una de normal mirant el document — només pel nom. */
function TaulaPendents({ pendents, onCanviaTipus, onTreu }) {
  return (
    <div className="taula-scroll" style={{ marginTop: 10 }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
            <th style={{ padding: '4px 6px' }}>Fitxer</th>
            <th style={{ padding: '4px 6px' }}>Què és</th>
            <th style={{ padding: '4px 6px' }}>Nom</th>
            <th style={{ padding: '4px 6px' }}>Contingut</th>
            <th style={{ padding: '4px 6px' }}></th>
          </tr>
        </thead>
        <tbody>
          {pendents.map((p) => (
            <tr key={p.id} style={{ borderBottom: '1px solid var(--line)', opacity: p.dades ? 1 : 0.6 }}>
              <td style={{ padding: '4px 6px' }}>{p.fitxer}</td>
              <td style={{ padding: '4px 6px' }}>
                {p.dades ? (
                  <select
                    value={p.tipus}
                    onChange={(ev) => onCanviaTipus(p.id, ev.target.value)}
                    style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '3px 6px', fontSize: 12 }}
                  >
                    {TIPUS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                ) : (
                  <span style={{ color: 'var(--red)' }}>No reconegut</span>
                )}
              </td>
              <td style={{ padding: '4px 6px' }}>
                {p.nomExistent ?? p.nom ?? '—'}
                {p.nomExistent && (
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--amber-dark)' }}>
                    al full diu «{p.nom}» — s&apos;actualitza la que ja hi ha
                  </span>
                )}
              </td>
              <td style={{ padding: '4px 6px', color: p.dades ? 'var(--ink-soft)' : 'var(--red)' }}>{p.resum}</td>
              <td style={{ padding: '4px 6px' }}>
                <button
                  type="button"
                  onClick={() => onTreu(p.id)}
                  title="Treu-lo de la llista"
                  aria-label={`Treu ${p.fitxer}`}
                  style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 13, padding: '0 2px' }}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Una de les seccions del resum, amb el seu propi format de columnes:
 *  els cicles/comissions i el cooperatiu tenen gener/juny, les festes un
 *  sol grau, i les activitats complementàries satisfacció/valorades. */
function SeccioResum({ titol, quantes, buit, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', borderBottom: '1px solid var(--line)', paddingBottom: 4 }}>
        {titol} <span style={{ fontWeight: 400 }}>({quantes})</span>
      </p>
      {quantes === 0
        ? <p style={{ fontSize: 12, color: 'var(--ink-soft)', padding: '8px 0' }}>{buit}</p>
        : children}
    </div>
  )
}

function ValorPct({ etiqueta, valor }) {
  return (
    <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
      {etiqueta}: <strong style={{ color: colorPer(valor) }}>{valor === null || valor === undefined ? '—' : `${Math.round(valor)}%`}</strong>
    </span>
  )
}

/** Una fila desplegable, igual que les de la llista de valoracions:
 *  el resum sempre visible, el desglossament només en obrir-la. */
function FilaResum({ nom, valors, extra, detall }) {
  const [oberta, setOberta] = useState(false)
  return (
    <div style={{ borderBottom: '1px dashed var(--line)' }}>
      <div
        onClick={() => setOberta(!oberta)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px', cursor: 'pointer', gap: 12, flexWrap: 'wrap' }}
      >
        <div>
          <strong>{nom}</strong>
          {extra && <span style={{ fontSize: 12, color: 'var(--ink-soft)', marginLeft: 8 }}>{extra}</span>}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {valors.map((v) => <ValorPct key={v.etiqueta} {...v} />)}
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{oberta ? '▲' : '▼'}</span>
        </div>
      </div>
      {oberta && detall?.length > 0 && (
        <div style={{ padding: '0 4px 10px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {detall.map((d) => (
            <div key={d.etiqueta} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span>{d.etiqueta}</span>
              <strong style={{ color: colorPer(d.valor) }}>{d.valor === null || d.valor === undefined ? '—' : `${Math.round(d.valor)}%`}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
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
  /**
   * Esborra una valoració des de la llista de baix, tingui el nom que
   * tingui. Cal perquè les que crea la importació poden no ser a cap
   * llista del panell —i llavors no hi ha cap ✕ que les tregui—, que és el
   * cas de les comissions duplicades amb el nom escrit d'una altra manera.
   *
   * Si el nom sí que és a alguna llista, també se'n treu, per no deixar
   * l'opció penjada als docents apuntant a una valoració que ja no hi és.
   */
  async function esborraValoracio(v) {
    const nom = (v.nom ?? '').trim()
    const te = mitjanaValoracio(v, 'gener') !== null || mitjanaValoracio(v, 'juny') !== null

    // Les files sense nom són restes desades per error: no té sentit
    // demanar que s'escrigui un nom que no existeix.
    if (!nom) {
      if (!window.confirm('Aquesta valoració no té nom i segurament es va desar per error. Vols esborrar-la?')) return
    } else {
      const avis = te
        ? `La valoració "${nom}" té dades. S'esborrarà del tot i no es podrà recuperar.\n\nEscriu el nom per confirmar-ho:`
        : `Segur que vols esborrar la valoració "${nom}"?\n\nEscriu el nom per confirmar-ho:`
      const escrit = window.prompt(avis, '')
      if (escrit === null) return
      if (escrit.trim() !== nom) {
        setMissatge({ type: 'error', text: 'El nom no coincideix: no s\'ha esborrat res.' })
        return
      }
    }
    try {
      await deleteDoc(doc(db, 'valoracions', v.id))
      const configNova = {
        ...config,
        comissions: config.comissions.filter((c) => !mateixNom(c.nom, nom)),
        mixtes: config.mixtes.filter((c) => !mateixNom(c.nom, nom)),
      }
      if (configNova.comissions.length !== config.comissions.length || configNova.mixtes.length !== config.mixtes.length) {
        await desaConfig(configNova)
      }
      setMissatge({ type: 'ok', text: nom ? `Esborrada "${nom}".` : 'Esborrada la valoració sense nom.' })
      await carrega()
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'ha pogut esborrar: ${err.message}` })
    }
  }

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

  // ── Importació de plantilles ──────────────────────────────────────────
  // Un sol camí per a totes: es llegeixen els fitxers, es diu de cada un
  // què sembla que és, i no s'escriu res fins que l'administrador ho
  // confirma. El tipus es pot corregir, perquè una comissió mixta que
  // encara no sigui a la llista arriba com a comissió normal.

  const [festesDetall, setFestesDetall] = useState([])
  const [cooperatiu, setCooperatiu] = useState(null)
  const [activitats, setActivitats] = useState([])
  const [analitzant, setAnalitzant] = useState(false)
  const [pendents, setPendents] = useState([]) // { id, fitxer, tipus, nom, resum, dades }
  const [important, setImportant] = useState(false)
  const [resultatImport, setResultatImport] = useState(null)

  async function analitzaFitxers(fitxers) {
    if (!fitxers || fitxers.length === 0) return
    setAnalitzant(true)
    setMissatge(null)
    setResultatImport(null)
    try {
      const XLSX = await carregaXLSX()
      const mixtes = config.mixtes.map((c) => c.nom)
      const nomsExistents = [
        ...valoracions.map((v) => v.nom),
        ...config.comissions.map((c) => c.nom),
        ...mixtes,
      ].filter(Boolean)
      const trobats = []
      for (const fitxer of fitxers) {
        try {
          const workbook = XLSX.read(await fitxer.arrayBuffer(), { type: 'array' })
          const analisi = analitzaLlibre(XLSX, workbook, { mixtes })
          // "Comissió Anglès" i "Comissió d'anglès" són la mateixa: si ja
          // existeix, es reaprofita el nom que hi ha en comptes de crear-ne
          // una de nova al costat.
          const jaHiEs = analisi.nom ? nomJaExistent(analisi.nom, nomsExistents) : null
          trobats.push({
            id: `${fitxer.name}-${trobats.length}`,
            fitxer: fitxer.name,
            ...analisi,
            nomExistent: jaHiEs && jaHiEs !== analisi.nom ? jaHiEs : null,
          })
        } catch (err) {
          trobats.push({
            id: `${fitxer.name}-${trobats.length}`,
            fitxer: fitxer.name,
            tipus: 'desconegut',
            nom: '',
            resum: `No s'ha pogut llegir: ${err.message}`,
            dades: null,
          })
        }
      }
      setPendents(trobats)
    } catch (err) {
      setMissatge({ type: 'error', text: `No s'han pogut llegir les plantilles: ${err.message}` })
    } finally {
      setAnalitzant(false)
    }
  }

  /** Els fitxers arriben o del selector del Drive o de l'ordinador, i tots
   *  dos camins acaben en una llista de File. */
  function delOrdinador(e) {
    analitzaFitxers([...(e.target.files ?? [])])
    e.target.value = ''
  }

  async function delDrive() {
    setAnalitzant(true)
    setMissatge(null)
    try {
      const triats = await triaDocumentsDelDrive('fulls')
      await analitzaFitxers(triats.map((t) => new File([t.buffer], t.nom, { type: t.mime })))
    } catch (err) {
      setMissatge({ type: 'error', text: err.message })
    } finally {
      setAnalitzant(false)
    }
  }

  function canviaTipus(id, tipus) {
    setPendents(pendents.map((p) => p.id === id ? { ...p, tipus } : p))
  }

  function treuDeLaLlista(id) {
    setPendents(pendents.filter((p) => p.id !== id))
  }

  /**
   * Escriu de debò les plantilles revisades.
   *
   * La configuració es desa **un sol cop al final**: si es desés a cada
   * fitxer, cada escriptura partiria d'una còpia que encara no veu les
   * anteriors i s'hi perdrien activacions.
   */
  async function importa() {
    setImportant(true)
    setMissatge(null)
    setResultatImport(null)
    let configNova = config
    const fets = []
    const fallats = []

    for (const p of pendents.filter((x) => x.dades && x.tipus !== 'desconegut')) {
      try {
        if (p.tipus === 'festa') {
          const entrada = configNova.festes.find((f) => {
            const label = (f.label ?? '').toLowerCase()
            const activitat = p.nom.toLowerCase()
            return label && (activitat.includes(label) || label.includes(activitat.replace(/^festa (de |del |la )?/i, '')))
          })
          if (!entrada) throw new Error(`no sé quina festa és "${p.nom}" — afegeix-la primer a la llista`)
          await setDoc(doc(db, 'festesDetall', `${cursEscolarId}__festa-${entrada.id}`), {
            festa: { ...p.dades.festa, activitat: entrada.label },
            cursEscolar: cursEscolarId,
            actualitzatEl: serverTimestamp(),
            actualitzatPer: auth.currentUser?.email ?? null,
          })
          configNova = {
            ...configNova,
            festes: configNova.festes.map((f) => f.id === entrada.id ? { ...f, activa: true } : f),
          }
          fets.push({ nom: entrada.label, tipus: 'festa' })
          continue
        }

        const { responsable, membres, objectius, metodologies } = p.dades
        const nom = (p.nomExistent ?? p.dades.nom ?? '').trim()
        // El nom és l'identificador del document: sense nom sortiria una
        // fila en blanc a la llista i no hi hauria manera de saber què és.
        if (!nom) throw new Error('el full no diu de quina comissió és')
        await setDoc(doc(db, 'valoracions', `${cursEscolarId}__${slug(nom)}`), {
          nom,
          responsable,
          membres,
          objectius,
          valoracioRevisio: '',
          valoracioFinal: '',
          metodologies: metodologies ?? '',
          propostesMillora: '',
          cursEscolar: cursEscolarId,
          actualitzatEl: serverTimestamp(),
          actualitzatPer: auth.currentUser?.email ?? null,
        })

        // Els cicles sempre estan disponibles: no hi ha cap llista on
        // activar-los. Les comissions i les mixtes, sí.
        if (p.tipus !== 'cicle') {
          const clau = p.tipus === 'mixta' ? 'mixtes' : 'comissions'
          const existent = configNova[clau].find((c) => c.nom.toLowerCase() === nom.toLowerCase())
          if (!existent) {
            configNova = { ...configNova, [clau]: afegeixALlista(configNova[clau], nom) }
          } else if (!existent.activa) {
            configNova = {
              ...configNova,
              [clau]: configNova[clau].map((c) => c.nom === existent.nom ? { ...c, activa: true } : c),
            }
          }
        }
        fets.push({ nom, tipus: p.tipus })
      } catch (err) {
        fallats.push({ fitxer: p.fitxer, motiu: err.message })
      }
    }

    try {
      if (configNova !== config) await desaConfig(configNova)
    } catch (err) {
      fallats.push({ fitxer: 'la configuració', motiu: err.message })
    }

    setResultatImport({ fets, fallats })
    setPendents([])
    setImportant(false)
    await carrega()
  }



  /**
   * Carrega les quatre coses que es valoren, que viuen en col·leccions
   * separades: les valoracions de cicle/comissió/equip, les festes (un
   * document per festa), l'aprenentatge cooperatiu (un per curs) i les
   * activitats complementàries (un per cicle).
   */
  async function carrega() {
    setCarregant(true)
    setMissatge(null)
    const delCurs = (nom) => getDocs(query(collection(db, nom), where('cursEscolar', '==', cursEscolarId)))
    try {
      const [snapVal, snapFestes, snapCoop, snapAct] = await Promise.all([
        delCurs('valoracions'),
        delCurs('festesDetall'),
        getDoc(doc(db, 'aprenentatgeCooperatiu', cursEscolarId)),
        delCurs('activitatsComplementariesDetall'),
      ])

      setValoracions(snapVal.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.nom ?? '').localeCompare(b.nom ?? '', 'ca')))

      // Les festes desades amb el model vell es reparteixen en carregar-les.
      setFestesDetall(snapFestes.docs
        .map((d) => ({ id: d.id, festa: normalitzaFesta(d.data().festa) }))
        .filter((f) => f.festa))

      setCooperatiu(snapCoop.exists() ? normalitzaCooperatiu(snapCoop.data()) : null)

      setActivitats(snapAct.docs
        .map((d) => ({ id: d.id, cicle: d.data().cicle ?? '', activitats: d.data().activitats ?? [] }))
        .sort((a, b) => CICLES.indexOf(a.cicle) - CICLES.indexOf(b.cicle)))
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
              titol="Importa plantilles"
              ajuda="Tria tots els fulls que vulguis d'un cop — de cicle, de comissió o de festa. Es mira què és cadascun i no s'escriu res fins que ho confirmis."
              primer
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={delDrive}
                disabled={analitzant || important}
                className="btn-ghost"
                style={{ color: 'var(--navy)', borderColor: 'var(--navy)', maxWidth: '100%', textAlign: 'left' }}
              >
                {analitzant ? 'Llegint…' : '📁 Tria plantilles del Drive'}
              </button>
              <label className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px', cursor: 'pointer', display: 'inline-flex', color: 'var(--navy)', borderColor: 'var(--navy)' }}>
                📤 Puja plantilles (Excel)
                <input type="file" accept=".xlsx,.xls" multiple onChange={delOrdinador} style={{ display: 'none' }} disabled={analitzant || important} />
              </label>
            </div>

            {pendents.length > 0 && (
              <>
                <TaulaPendents pendents={pendents} onCanviaTipus={canviaTipus} onTreu={treuDeLaLlista} />
                <p style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 8 }}>
                  Una comissió mixta i una de normal tenen la plantilla igual: si alguna surt com a
                  &quot;Comissió o equip&quot; i en realitat és mixta, canvia-ho aquí abans d&apos;importar.
                </p>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={importa}
                    disabled={important || pendents.every((p) => !p.dades)}
                    className="btn-primary"
                    style={{ maxWidth: 260 }}
                  >
                    {important ? 'Important…' : `Importa ${pendents.filter((p) => p.dades).length} plantilles`}
                  </button>
                  <button type="button" onClick={() => setPendents([])} disabled={important} className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}>
                    Cancel·la
                  </button>
                </div>
              </>
            )}

            {resultatImport && (
              <div style={{ marginTop: 10 }}>
                {resultatImport.fets.length > 0 && (
                  <p style={{ fontSize: 12, color: 'var(--green)' }}>
                    ✓ Importades {resultatImport.fets.length}: {resultatImport.fets.map((f) => f.nom).join(', ')}. Ja estan actives per als docents.
                  </p>
                )}
                {resultatImport.fallats.map((f) => (
                  <p key={f.fitxer} style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
                    ✕ {f.fitxer}: {f.motiu}
                  </p>
                ))}
              </div>
            )}

            <TitolSeccio
              titol="Cicles"
              ajuda="Els 4 cicles sempre estan disponibles per als docents — no cal activar-los ni treure'ls."
            />

            <TitolSeccio
              titol="Comissions i equips"
              ajuda="Les del claustre. Marca les que han de sortir aquest curs."
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

            <TitolSeccio
              titol="Comissions mixtes (amb l'AFA)"
              ajuda="Les que tenen participació de famílies, de l'AFA o d'una entitat de fora. Tenen pestanya pròpia a &quot;Documentació&quot;."
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

            <TitolSeccio
              titol="Festes i celebracions"
              ajuda="Les del curs. Una festa que no hi sigui s'ha d'afegir aquí abans de poder-ne importar la plantilla."
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
            onClick={() => descarrega('excel', () => exportaValoracionsExcel(valoracions, cursEscolarId, { festesDetall, cooperatiu, activitats }))}
            disabled={descarregant !== null}
            type="button"
          >
            {descarregant === 'excel' ? 'Generant l\'Excel…' : '📥 Descarrega totes en Excel (amb totes les pestanyes)'}
          </button>
          <button
            className="btn-ghost"
            style={{ color: 'var(--navy)', borderColor: 'var(--navy)' }}
            onClick={() => descarrega('pdf', () => exportaValoracionsPDF(valoracions, cursEscolarId, { festesDetall, cooperatiu, activitats }))}
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
          {agrupaValoracions(valoracions, config).map((seccio) => (
            <div key={seccio.titol} style={{ marginTop: 18 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)', borderBottom: '1px solid var(--line)', paddingBottom: 4 }}>
                {seccio.titol} <span style={{ fontWeight: 400 }}>({seccio.valoracions.length})</span>
              </p>
          {seccio.valoracions.map((v) => {
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
                    {v.nom?.trim()
                      ? <strong>{v.nom}</strong>
                      : <strong style={{ color: 'var(--red)' }}>(sense nom — desada per error)</strong>}
                    {v.responsable && <span style={{ fontSize: 12, color: 'var(--ink-soft)', marginLeft: 8 }}>Resp: {v.responsable}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span style={{ fontSize: 12 }}>Gener: <strong style={{ color: colorPer(gener) }}>{gener !== null ? `${Math.round(gener)}%` : '—'}</strong></span>
                    <span style={{ fontSize: 12 }}>Juny: <strong style={{ color: colorPer(juny) }}>{juny !== null ? `${Math.round(juny)}%` : '—'}</strong></span>
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{oberta ? '▲' : '▼'}</span>
                    <button
                      type="button"
                      onClick={(ev) => { ev.stopPropagation(); esborraValoracio(v) }}
                      title={`Esborra la valoració "${v.nom}"`}
                      aria-label={`Esborra ${v.nom}`}
                      style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 13, padding: '0 2px' }}
                    >
                      ✕
                    </button>
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
          ))}
        </div>
      )}

      <SeccioResum titol="Festes i celebracions" quantes={festesDetall.length} buit="Encara no s'ha valorat cap festa.">
        {festesDetall.map((f) => (
          <FilaResum
            key={f.id}
            nom={f.festa.activitat || f.id}
            valors={[{ etiqueta: 'General', valor: mitjanaGeneralFesta(f.festa) }]}
            detall={f.festa.grups.map((g) => ({ etiqueta: g.nom, valor: mitjanaGrup(f.festa, g.nom) }))}
          />
        ))}
      </SeccioResum>

      <SeccioResum titol="Aprenentatge cooperatiu" quantes={cooperatiu ? 1 : 0} buit="Encara no s'ha començat.">
        {cooperatiu && (
          <FilaResum
            nom="Aprenentatge cooperatiu"
            valors={[
              { etiqueta: 'Gener', valor: grauGlobal(cooperatiu, 'gener') },
              { etiqueta: 'Juny', valor: grauGlobal(cooperatiu, 'juny') },
            ]}
            detall={CICLES_COOPERATIU.flatMap((c) => [
              { etiqueta: `${c.nom} · gener`, valor: grauCicle(cooperatiu, c.id, 'gener') },
              { etiqueta: `${c.nom} · juny`, valor: grauCicle(cooperatiu, c.id, 'juny') },
            ])}
          />
        )}
      </SeccioResum>

      {/* Les activitats complementàries no donen un grau d'assoliment sinó
          un grau de satisfacció (de 0 a 10, aquí en percentatge), i per
          això les seves columnes no són les mateixes que les altres. */}
      <SeccioResum titol="Activitats complementàries" quantes={activitats.length} buit="Encara no s'ha valorat cap sortida.">
        {activitats.map((a) => (
          <FilaResum
            key={a.id}
            nom={a.cicle}
            valors={[
              { etiqueta: 'Satisfacció', valor: grauSatisfaccioCicle(a.activitats) },
              { etiqueta: 'Valorades', valor: percentValorades(a.activitats) },
            ]}
            extra={`${a.activitats.length} sortides · ${totalRepetirSi(a.activitats)} es repetirien`}
            detall={a.activitats.map((act) => ({ etiqueta: `${act.nom || 'Sense nom'} (${act.nivell})`, valor: mitjanaActivitat(act) === null ? null : mitjanaActivitat(act) * 10 }))}
          />
        ))}
      </SeccioResum>
    </div>
  )
}
