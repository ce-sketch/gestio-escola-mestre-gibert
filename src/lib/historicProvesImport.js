// Lector dels fulls de resultats històrics de TEE, VL/CL i
// lectoescriptura.
//
// Què resol
// ---------
// Els cursos anteriors a l'app viuen als fulls de càlcul del centre
// (l'Eina d'avaluació PGAC i la graella de lectoescriptura). Fins ara
// s'havien d'entrar a mà a Firestore; això els deixa pujar des de la
// pantalla, com ja es fa amb l'Innovamat i les notes per àrea.
//
// Com llegeix
// -----------
// No dona per fetes ni les columnes ni les files. Busca:
//
//   1. Una fila d'encapçalament amb els noms dels nivells (No
//      Assoliment, Assoliment Satisfactòri…) i es queda amb la columna
//      de cadascun.
//   2. Files que comencin per un curs escolar ("22-23", "2022-23") o per
//      una classe, i n'agafa els recomptes de les columnes trobades.
//
// Els percentatges del full NO es llegeixen: es recalculen dels
// recomptes. Als fulls antics hi ha percentatges que no quadren amb les
// seves pròpies xifres, i el recompte és l'única dada que no es pot
// recuperar si es perd.

import { textNet, numero } from './excelLectura'
import { carregaExcelJS } from './carregaLlibreries'
import { NIVELLS_HISTORIC } from './historicProves'

const neteja = (t) => String(t ?? '')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '')

/** Com s'anomenen els nivells als fulls → l'id que fa servir l'app. */
const NIVELLS_FULL = {
  noassoliment: 'na', na: 'na', no: 'na',
  assolimentsatisfactori: 'asat', satisfactori: 'asat', as: 'asat',
  assolimentnotable: 'anot', notable: 'anot', an: 'anot',
  assolimentexcellent: 'aexc', excellent: 'aexc', ae: 'aexc',
}

/** Un curs escolar tal com surt als fulls: "22-23", "2022-23", "2022/23". */
const RE_CURS = /^(\d{2}|\d{4})\s*[-/]\s*(\d{2}|\d{4})$/

/**
 * Normalitza un curs a la forma curta que fa servir l'històric ("22-23").
 * Torna null si no ho sembla, per no endevinar-lo.
 */
export function cursCurt(text) {
  const m = String(text ?? '').trim().match(RE_CURS)
  if (!m) return null
  return `${m[1].slice(-2)}-${m[2].slice(-2)}`
}

/** El trimestre que descriu un text ("1r trimestre", "Inicial", "Final"). */
export function trimestreDe(text) {
  const t = neteja(text)
  if (!t) return null
  if (t.includes('1r') || t.includes('1er') || t.includes('inicial') || t.includes('primer')) return '1r'
  if (t.includes('2n') || t.includes('segon') || t.includes('mitjan')) return '2n'
  if (t.includes('3r') || t.includes('3er') || t.includes('final') || t.includes('tercer')) return '3r'
  return null
}

/** Quina prova descriu el nom d'un full. */
export function provaDeFull(nomFull) {
  const t = neteja(nomFull)
  if (t.includes('tee') || t.includes('textescrit')) return 'tee'
  if (t.includes('vlcl') || t.includes('vl') || t.includes('lectura')) return 'vlcl'
  return null
}

/**
 * Dins d'un full de VL/CL, si un text anuncia el bloc de velocitat o el
 * de comprensió. Torna null si no ho diu.
 */
export function subprovaDe(text) {
  const t = neteja(text)
  if (!t) return null
  if (t.includes('velocitat') || /(^|[^a-z])vl([^a-z]|$)/.test(neteja(text))) return 'vl'
  if (t.includes('comprensio') || /(^|[^a-z])cl([^a-z]|$)/.test(neteja(text))) return 'cl'
  return null
}

/**
 * Llegeix DIVERSOS fitxers de cop.
 *
 * Els cursos passats són un fitxer per any, i pujar-los d'un en un és
 * feina de sobres: la resta de càrregues de l'app (informes d'Innovamat,
 * CSV del COSMOS) ja deixen triar-ne uns quants alhora.
 *
 * Si un fitxer peta, els altres es llegeixen igualment i l'error es diu a
 * part: que un full antic estigui mal format no ha de bloquejar la
 * càrrega dels que sí que estan bé.
 */
export async function llegeixHistoricProvesDeVaris(fitxers, opcions = {}) {
  const registres = []
  const avisos = []
  const fulls = []
  const errors = []

  for (const fitxer of fitxers ?? []) {
    try {
      const r = await llegeixHistoricProves(await fitxer.arrayBuffer(), opcions)
      registres.push(...r.registres)
      fulls.push(...r.fulls)
      avisos.push(...r.avisos.map((a) => `${fitxer.name}: ${a}`))
    } catch (err) {
      errors.push(`${fitxer.name}: ${err.message}`)
    }
  }

  if (registres.length === 0) {
    throw new Error(errors.length > 0
      ? errors.join(' · ')
      : "No hi he trobat cap fila de resultats a cap dels fitxers.")
  }
  if (errors.length > 0) avisos.push(`No he pogut llegir: ${errors.join(' · ')}`)

  return { registres, avisos, fulls: [...new Set(fulls)] }
}

/**
 * Llegeix un Excel amb els fulls de resultats històrics.
 *
 * @param {ArrayBuffer} buffer
 * @param {{prova?: 'tee'|'vlcl'}} opcions - per forçar la prova quan el
 *        nom del full no ho deixa clar
 * @returns {Promise<{registres: Array, avisos: string[], fulls: string[]}>}
 */
export async function llegeixHistoricProves(buffer, opcions = {}) {
  const ExcelJS = await carregaExcelJS()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const avisos = []
  const registres = []
  const fullsLlegits = []

  for (const ws of wb.worksheets) {
    const prova = opcions.prova ?? provaDeFull(ws.name)
    if (!prova) continue

    const files = []
    ws.eachRow({ includeEmpty: true }, (row) => {
      const fila = []
      for (let c = 1; c <= Math.min(row.cellCount || 30, 40); c++) fila.push(row.getCell(c))
      files.push(fila)
    })

    const delFull = llegeixFull(files, prova, avisos)
    if (delFull.length > 0) {
      fullsLlegits.push(ws.name)
      registres.push(...delFull)
    }
  }

  if (registres.length === 0) {
    throw new Error(
      "No hi he trobat cap fila de resultats. El full ha de tenir una capçalera amb els "
      + 'nivells (No Assoliment, Assoliment Satisfactòri…) i, a sota, una fila per curs '
      + 'escolar amb els recomptes.'
    )
  }

  // Un mateix curs i trimestre no hi pot sortir dues vegades DE LA
  // MATEIXA PROVA: si passa, val més dir-ho que quedar-se amb l'últim en
  // silenci. La prova entra a la clau perquè el TEE i la VL/CL del mateix
  // curs i trimestre són files diferents, no una repetició.
  const claus = registres.map((r) => `${r.prova}__${r.subprova ?? ''}__${r.trimestre}__${r.curs}`)
  const repetits = [...new Set(claus.filter((c, i) => claus.indexOf(c) !== i))]
  if (repetits.length > 0) {
    avisos.push(
      `Hi ha cursos que surten més d'una vegada al mateix trimestre (${repetits.join(', ')}). `
      + 'Els he desat tots; revisa-ho abans de confirmar.'
    )
  }

  return { registres, avisos, fulls: fullsLlegits }
}

/** Les files d'un full. */
function llegeixFull(files, prova, avisos) {
  const resultat = []
  // Columna de cada nivell, i el trimestre del bloc on som. Els fulls
  // tenen un bloc per trimestre, un sota l'altre.
  let columnes = null
  let trimestre = null
  // Als fulls de VL/CL hi ha un bloc de velocitat i un de comprensió: cal
  // saber de quin són les xifres que es llegeixen.
  let subprova = prova === 'vlcl' ? 'vl' : null

  for (const fila of files) {
    const textos = fila.map((c) => textNet(c))

    if (prova === 'vlcl') {
      const s = textos.map(subprovaDe).find(Boolean)
      if (s) subprova = s
    }

    // Una fila que anomena els nivells obre un bloc nou.
    const trobades = []
    for (let c = 0; c < textos.length; c++) {
      const id = NIVELLS_FULL[neteja(textos[c])]
      if (id && !trobades.some((x) => x.id === id)) trobades.push({ col: c, id })
    }
    if (trobades.length >= 3) {
      columnes = trobades
      // El trimestre sol anar a la mateixa fila o a la de sobre; si no
      // s'hi troba, es manté el de l'últim bloc.
      trimestre = textos.map(trimestreDe).find(Boolean) ?? trimestre
      continue
    }

    // Una fila que només diu el trimestre.
    const soloTrim = textos.filter(Boolean)
    if (soloTrim.length <= 2 && soloTrim.length > 0) {
      const t = trimestreDe(soloTrim[0])
      if (t && !cursCurt(soloTrim[0])) { trimestre = t; continue }
    }

    if (!columnes) continue

    // Una fila de dades comença pel curs escolar.
    const curs = textos.map(cursCurt).find(Boolean)
    if (!curs) continue
    if (!trimestre) {
      avisos.push(`He trobat el curs ${curs} però no sé de quin trimestre és; l'he deixat fora.`)
      continue
    }

    const recompte = {}
    let hiHaAlguna = false
    for (const { col, id } of columnes) {
      const n = numero(fila[col])
      recompte[id] = n ?? 0
      if (n !== null) hiHaAlguna = true
    }
    // Una fila amb tots els recomptes buits no és una càrrega a mitges:
    // és una fila de la plantilla que encara no s'ha omplert.
    if (!hiHaAlguna) continue

    const total = NIVELLS_HISTORIC.reduce((t, n) => t + (recompte[n.id] ?? 0), 0)
    if (total === 0) continue

    resultat.push({ prova, ...(subprova ? { subprova } : {}), trimestre, curs, ...recompte, total })
  }

  return resultat
}

/**
 * Passa les files de VL/CL a la forma que espera l'històric: un registre
 * per curs i trimestre, amb la velocitat i la comprensió a dins.
 *
 * És així a Firestore des del principi i no es toca: canviar-ho voldria
 * dir migrar les dades que ja hi ha desades.
 */
export function agrupaVlcl(registres) {
  const buit = () => Object.fromEntries([...NIVELLS_HISTORIC.map((n) => [n.id, 0]), ['total', 0]])
  const perClau = new Map()
  for (const r of (registres ?? []).filter((x) => x.prova === 'vlcl')) {
    const clau = `${r.trimestre}__${r.curs}`
    if (!perClau.has(clau)) {
      perClau.set(clau, { trimestre: r.trimestre, curs: r.curs, vl: buit(), cl: buit() })
    }
    const dest = perClau.get(clau)[r.subprova === 'cl' ? 'cl' : 'vl']
    for (const n of NIVELLS_HISTORIC) dest[n.id] = r[n.id] ?? 0
    dest.total = r.total ?? 0
  }
  return [...perClau.values()]
}

/** Les files de TEE, amb els camps que espera l'històric. */
export function nomesTee(registres) {
  return (registres ?? [])
    .filter((r) => r.prova === 'tee')
    .map(({ prova, subprova, ...camps }) => camps) // eslint-disable-line no-unused-vars
}

/**
 * Ajunta els registres llegits amb els que ja hi havia desats.
 *
 * Els cursos que es tornen a pujar se substitueixen; la resta es queden.
 * Així tornar a pujar un full corregit no obliga a esborrar res abans.
 */
export function fusionaRegistres(existents, nous) {
  const clau = (r) => `${r.trimestre}__${r.curs}`
  const clausNoves = new Set((nous ?? []).map(clau))
  return [
    ...(existents ?? []).filter((r) => !clausNoves.has(clau(r))),
    ...(nous ?? []),
  ]
}

/** Els cursos que hi ha a un conjunt de registres, del més recent al més
 *  antic — per poder-ne desfer la càrrega un per un. */
export function cursosDe(registres) {
  return [...new Set((registres ?? []).map((r) => r.curs).filter(Boolean))]
    .sort()
    .reverse()
}

/** Treu del conjunt tots els registres d'un curs. */
export function treuCurs(registres, curs) {
  return (registres ?? []).filter((r) => r.curs !== curs)
}
