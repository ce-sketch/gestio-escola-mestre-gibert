// Lector de la graella de lectoescriptura d'Educació Infantil.
//
// Què resol
// ---------
// Els cursos anteriors a l'app viuen als fulls de càlcul del centre: un
// full per classe, una fila per alumne i una columna per nivell de
// l'escala Teberosky, amb una marca a les que l'infant ha assolit.
//
// Es desa amb la MATEIXA forma que fa servir la pantalla d'entrada de
// dades (`{ [alumneId]: { [nivellId]: true } }`), perquè l'històric i el
// resum no hagin de saber si un curs es va introduir a mà o es va
// importar.
//
// ⚠️ Els alumnes de fa anys ja no consten a la fitxa del centre, així que
// no se'ls pot assignar el seu identificador real. Es fabrica un
// identificador a partir del nom, prefixat, per deixar clar que ve del
// full i no de la fitxa d'alumnat. Vegeu `idDelFull`.

import { textNet } from './excelLectura'
import { carregaExcelJS } from './carregaLlibreries'
import { NIVELLS_TEBEROSKY, esClasseEI4o5 } from './lectoescripturaEI'
import { slug } from './slug'

const neteja = (t) => String(t ?? '')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/g, '')

/** Què compta com a marca a una casella. */
const ES_MARCA = (t) => {
  const n = neteja(t)
  return n !== '' && n !== '0' && n !== 'no' && n !== 'x0'
}

/**
 * L'identificador d'un alumne d'un curs passat.
 *
 * Va prefixat amb `full__` a posta: no és l'id de la fitxa d'alumnat i no
 * s'ha de poder confondre amb un. Si algun dia es volgués creuar amb
 * l'alumnat real, el prefix diu clarament que caldria casar-los pel nom.
 */
export function idDelFull(classe, nom) {
  // No hi cal el curs: el document de Firestore ja és d'un curs i una
  // classe, i els identificadors només han de ser únics a dins seu.
  return `full__${slug(classe)}__${slug(nom)}`
}

/** El curs escolar escrit al full ("Curs: 2023-24"). */
export function cursEscolarDe(textos) {
  for (const t of textos) {
    const m = String(t ?? '').match(/(\d{4})\s*[-/]\s*(\d{2,4})/)
    if (m) return `${m[1]}-${m[2].slice(-2)}`
  }
  return null
}

/**
 * Llegeix DIVERSES graelles de cop, una per curs.
 *
 * Cada fitxer és un curs escolar, i cadascun conserva el seu: no es poden
 * ajuntar en un de sol perquè el curs forma part de la clau amb què es
 * desa. Si un fitxer peta, els altres es llegeixen igualment.
 */
export async function llegeixResumEIDeVaris(fitxers) {
  const cursos = []
  const errors = []

  for (const fitxer of fitxers ?? []) {
    try {
      const r = await llegeixResumEI(await fitxer.arrayBuffer())
      cursos.push({ ...r, fitxer: fitxer.name, curs: r.cursEscolar ?? '' })
    } catch (err) {
      errors.push(`${fitxer.name}: ${err.message}`)
    }
  }

  if (cursos.length === 0) {
    throw new Error(errors.length > 0 ? errors.join(' · ') : 'No he pogut llegir cap graella.')
  }
  return { cursos, errors }
}

/**
 * Llegeix la graella de lectoescriptura d'un curs.
 *
 * @param {ArrayBuffer} buffer
 * @returns {Promise<{cursEscolar: string|null, classes: Array, avisos: string[]}>}
 *   `classes` és `[{ classe, alumnes: { id: { nivellId: true } }, noms }]`
 */
export async function llegeixResumEI(buffer) {
  const ExcelJS = await carregaExcelJS()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const avisos = []
  const classes = []
  let cursEscolar = null

  for (const ws of wb.worksheets) {
    // El nom del full ha de ser la classe: "I4A", "I5 B"…
    const classe = textNet({ value: ws.name }) || ws.name
    if (!esClasseEI4o5(classe.replace(/\s/g, ''))) continue

    const files = []
    ws.eachRow({ includeEmpty: true }, (row) => {
      const fila = []
      for (let c = 1; c <= Math.min(row.cellCount || 40, 60); c++) fila.push(textNet(row.getCell(c)))
      files.push(fila)
    })

    cursEscolar = cursEscolar ?? cursEscolarDe(files.slice(0, 8).flat())

    const llegida = llegeixFullClasse(files, classe.replace(/\s/g, '').toUpperCase(), avisos)
    if (llegida) classes.push(llegida)
  }

  if (classes.length === 0) {
    throw new Error(
      "No hi he trobat cap full de classe d'I4 o I5. Cada classe ha d'anar al seu full, "
      + 'i el full s\'ha de dir com la classe ("I4A", "I5B").'
    )
  }

  return { cursEscolar, classes, avisos }
}

/** Un full de classe: troba les columnes dels nivells i llegeix les files. */
function llegeixFullClasse(files, classe, avisos) {
  // La capçalera és la fila que anomena més nivells de l'escala.
  let columnes = null
  let filaCapcalera = -1
  for (let i = 0; i < Math.min(files.length, 15); i++) {
    const trobades = []
    for (let c = 0; c < files[i].length; c++) {
      const nivell = NIVELLS_TEBEROSKY.find((n) => neteja(n.label) === neteja(files[i][c]))
      if (nivell && !trobades.some((x) => x.id === nivell.id)) trobades.push({ col: c, id: nivell.id })
    }
    if (trobades.length > (columnes?.length ?? 2)) { columnes = trobades; filaCapcalera = i }
  }

  if (!columnes) {
    avisos.push(`Al full "${classe}" no hi he trobat la fila amb els noms dels nivells; l'he deixat fora.`)
    return null
  }
  if (columnes.length < NIVELLS_TEBEROSKY.length) {
    avisos.push(
      `Al full "${classe}" només hi he reconegut ${columnes.length} dels ${NIVELLS_TEBEROSKY.length} nivells. `
      + 'Els que falten quedaran buits; comprova que els títols coincideixin.'
    )
  }

  // La columna del nom és la primera que té text a les files de dades i
  // que no és cap de les de nivells.
  const colsNivell = new Set(columnes.map((c) => c.col))
  const alumnes = {}
  const noms = []
  for (let i = filaCapcalera + 1; i < files.length; i++) {
    const fila = files[i]
    let nom = null
    for (let c = 0; c < fila.length; c++) {
      if (colsNivell.has(c)) continue
      const t = fila[c]
      // Un nom té lletres; els números de llista, no.
      if (t && /\p{L}{3}/u.test(t)) { nom = t; break }
    }
    if (!nom) continue
    // Files de totals o de resum: no són alumnes.
    if (/^(total|resum|suma|%)/i.test(nom)) continue

    const marques = {}
    for (const { col, id } of columnes) {
      if (ES_MARCA(fila[col])) marques[id] = true
    }
    // Un alumne sense cap marca es desa igualment: forma part de la
    // classe, i el recompte "amb dades" ha de poder-lo distingir d'algú
    // que no hi era.
    alumnes[idDelFull(classe, nom)] = marques
    noms.push(nom)
  }

  if (noms.length === 0) {
    avisos.push(`Al full "${classe}" hi he trobat la capçalera però cap alumne.`)
    return null
  }
  return { classe, alumnes, noms }
}
