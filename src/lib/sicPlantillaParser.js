// Lector de la llista d'indicadors del SIC en Excel.
//
// El problema que resol
// ---------------------
// La llista d'indicadors canvia cada curs, i teclejar-la a mà són més de
// cent línies. Aquí es llegeix d'un Excel.
//
// Com que el fitxer que arriba cada any no té per què tenir la mateixa
// forma, el lector **no dona per fet cap número de columna ni de fila**.
// Busca on són les dades:
//
//   · Si hi ha una columna amb codis jeràrquics ("1.1", "1.1.1"), la fa
//     servir com a codi i agafa el text de la columna de la dreta.
//   · Si no n'hi ha, suposa que el codi va enganxat al text a la mateixa
//     cel·la ("1.1.1 E. Infantil: grups del curs"), que és com solen
//     arribar aquests documents quan es copien d'un PDF.
//
// I si troba una columna que sembla de valors, se'ls emporta també, per
// no haver de reescriure el que ja estigui omplert.
//
// Com que cap lectura automàtica és infal·lible, torna sempre una llista
// d'avisos perquè es pugui ensenyar tot abans de desar res.

import { textNet, numero } from './excelLectura'
import { carregaExcelJS } from './carregaLlibreries'
import { analitzaLlista } from './sic'

/** Un codi jeràrquic sol: "1", "1.1", "2.10.3". */
const NOMES_CODI = /^\d+(?:\.\d+)*\.?$/

/** Capçaleres que delaten una columna de valors. */
const CAPCALERA_VALOR = /^(valor|resultat|dada|dades|curs|%|percentatge|índex|index)\b/i

/**
 * @param {ArrayBuffer} buffer - el fitxer .xlsx pujat
 * @param {{nomFull?: string}} opcions
 * @returns {Promise<{blocs: Array, avisos: string[], full: string, valors: number}>}
 */
export async function llegeixPlantillaSic(buffer, opcions = {}) {
  const ExcelJS = await carregaExcelJS()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const fulls = wb.worksheets.filter((ws) => ws.rowCount > 1)
  if (fulls.length === 0) throw new Error("L'Excel no té cap full amb dades.")

  const ws = opcions.nomFull
    ? (fulls.find((f) => f.name.trim() === opcions.nomFull.trim()) ?? fulls[0])
    : triaFull(fulls)

  const avisos = []
  if (fulls.length > 1 && !opcions.nomFull) {
    avisos.push(
      `L'Excel té ${fulls.length} fulls i he llegit "${ws.name}", que és el que té més indicadors numerats. `
      + 'Si no és el que toca, tria\'l a la llista.'
    )
  }

  const { linies, valors } = llegeixFull(ws, avisos)
  if (linies.length === 0) {
    throw new Error(
      `Al full "${ws.name}" no hi he trobat cap indicador numerat (files que comencin per "1.1", "1.1.1"…). `
      + 'Comprova que és el full de la llista del SIC.'
    )
  }

  const { blocs, avisos: avisosArbre } = analitzaLlista(linies)
  avisos.push(...avisosArbre)

  // Els valors llegits s'apliquen pel codi, igual que a la fusió: la
  // posició dins del full no és fiable si hi ha files de separació.
  let ambValor = 0
  if (valors.size > 0) {
    for (const bloc of blocs) {
      for (const seccio of bloc.seccions) {
        for (const indicador of seccio.indicadors) {
          if (!indicador.codi || !valors.has(indicador.codi)) continue
          indicador.valor = String(valors.get(indicador.codi))
          ambValor++
        }
      }
    }
    if (ambValor > 0) avisos.push(`He llegit també ${ambValor} valors ja omplerts a l'Excel.`)
  }

  return { blocs, avisos, full: ws.name, valors: ambValor }
}

/** Els noms dels fulls, per poder-ne triar un altre des de la pantalla. */
export async function fullsDe(buffer) {
  const ExcelJS = await carregaExcelJS()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  return wb.worksheets.filter((ws) => ws.rowCount > 1).map((ws) => ws.name)
}

/** De tots els fulls, el que té més files que semblen indicadors. */
function triaFull(fulls) {
  let millor = fulls[0]
  let maxim = -1
  for (const ws of fulls) {
    let compte = 0
    ws.eachRow({ includeEmpty: false }, (row) => {
      for (let c = 1; c <= Math.min(row.cellCount, 6); c++) {
        const t = textNet(row.getCell(c))
        if (/^\d+(?:\.\d+)+\s*\S/.test(t) || NOMES_CODI.test(t)) { compte++; break }
      }
    })
    if (compte > maxim) { maxim = compte; millor = ws }
  }
  return millor
}

/**
 * Tregui d'un full les línies "codi + text" i, si n'hi ha, els valors.
 *
 * @returns {{linies: string[], valors: Map<string, string|number>}}
 */
function llegeixFull(ws, avisos) {
  const linies = []
  const valors = new Map()
  const maxCol = Math.min(ws.columnCount || 8, 12)

  // ── On és la columna de valors, si n'hi ha cap ───────────────────────
  let colValor = null
  ws.eachRow({ includeEmpty: false }, (row, numFila) => {
    if (colValor !== null || numFila > 12) return
    for (let c = 1; c <= maxCol; c++) {
      if (CAPCALERA_VALOR.test(textNet(row.getCell(c)))) { colValor = c; return }
    }
  })

  ws.eachRow({ includeEmpty: false }, (row) => {
    // La primera cel·la amb contingut de la fila mana: si és un codi sol,
    // el text va a la següent; si ja porta el codi a dins, ja està.
    let codi = null
    let text = ''
    let colText = null

    for (let c = 1; c <= maxCol; c++) {
      const t = textNet(row.getCell(c))
      if (!t) continue
      if (NOMES_CODI.test(t)) {
        codi = t.replace(/\.$/, '')
        // El text és a la primera cel·la amb lletres que vingui després.
        for (let d = c + 1; d <= maxCol; d++) {
          const seguent = textNet(row.getCell(d))
          if (seguent && !NOMES_CODI.test(seguent)) { text = seguent; colText = d; break }
        }
      } else {
        text = t
        colText = c
      }
      break
    }

    if (!text && !codi) return
    // Files de títol de columna ("Indicador", "Descripció"…) i similars:
    // no tenen codi ni pinta d'indicador, i colarien com a "TOTAL GRUPS".
    if (!codi && !/^\d/.test(text) && text.length < 4) return

    const linia = codi ? `${codi} ${text}`.trim() : text
    linies.push(linia)

    // ── El valor, si n'hi ha ──────────────────────────────────────────
    const codiFinal = codi ?? (text.match(/^(\d+(?:\.\d+)+)\s/)?.[1] ?? null)
    if (!codiFinal) return

    let brut = null
    if (colValor !== null && colValor !== colText) {
      brut = row.getCell(colValor)
    } else {
      // Sense capçalera reconeguda, es mira la cel·la de després del text:
      // si és un número, és el valor.
      for (let d = (colText ?? 1) + 1; d <= maxCol; d++) {
        const cell = row.getCell(d)
        if (numero(cell) !== null) { brut = cell; break }
      }
    }
    if (!brut) return
    const n = numero(brut)
    const t = textNet(brut)
    if (n !== null) valors.set(codiFinal, arrodoneix(n))
    else if (t && !NOMES_CODI.test(t)) valors.set(codiFinal, t)
  })

  if (colValor === null && valors.size > 0) {
    avisos.push(
      "He trobat números al costat dels indicadors i els he llegit com a valors. "
      + 'Repassa\'ls abans de desar, perquè l\'Excel no tenia cap capçalera que ho digués.'
    )
  }

  return { linies, valors }
}

/** Els percentatges dels fulls poden venir de 0 a 1 (0,85) o de 0 a 100
 *  (85). Es respecta el que hi hagi, però es treuen els decimals que
 *  només són soroll de la coma flotant. */
function arrodoneix(n) {
  return Math.round(n * 10000) / 10000
}
