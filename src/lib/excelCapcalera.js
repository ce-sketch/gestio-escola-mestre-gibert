// Capçalera comuna per a tots els Excel que genera l'app, calcada de la que
// porten les plantilles del centre:
//
//     ┌──────────────────────────────────────────────┐
//     │      Escola Mestre Enric Gibert i Camins      │  ← banda blava
//     │                          PGAC · Curs 2026-27 │  ← a la dreta
//     │  Valoració Educació Infantil                 │  ← títol del full
//     │                                              │  ← fila en blanc
//     └──────────────────────────────────────────────┘
//
// A més deixa netes les columnes que no es fan servir: amplada per a les
// que tenen contingut i res de format escampat a la dreta.

export const NOM_ESCOLA = 'Escola Mestre Enric Gibert i Camins'

const BLAU = 'FF1E3A5F'
const CREMA = 'FFF2F0EA'

/**
 * Escriu la capçalera i retorna el número de la primera fila lliure, perquè
 * qui la crida hi continuï afegint files.
 *
 * @param {object} ws            full d'ExcelJS
 * @param {object} opcions
 * @param {string} opcions.titol       títol del full ("Valoració Cicle Mitjà")
 * @param {string} opcions.cursEscolarId  "2026-27"
 * @param {number} opcions.columnes   quantes columnes ocupa la taula de sota
 * @param {string} [opcions.etiqueta] text de l'esquerra de la dreta ("PGAC")
 */
export function afegeixCapcalera(ws, { titol, cursEscolarId, columnes = 4, etiqueta = 'PGAC' }) {
  const ultima = Math.max(2, columnes)
  const lletra = ws.getColumn(ultima).letter

  // Fila 1 — banda amb el nom de l'escola
  ws.mergeCells(`A1:${lletra}1`)
  const banda = ws.getCell('A1')
  banda.value = NOM_ESCOLA
  banda.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
  banda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLAU } }
  banda.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 26

  // Fila 2 — "PGAC · Curs 2026-27", arrambat a la dreta
  ws.mergeCells(`A2:${lletra}2`)
  const curs = ws.getCell('A2')
  curs.value = cursEscolarId ? `${etiqueta} · Curs ${cursEscolarId}` : etiqueta
  curs.font = { size: 10, color: { argb: 'FF666666' } }
  curs.alignment = { horizontal: 'right', vertical: 'middle' }

  // Fila 3 — títol del full
  ws.mergeCells(`A3:${lletra}3`)
  const cap = ws.getCell('A3')
  cap.value = titol ?? ''
  cap.font = { bold: true, size: 12 }
  cap.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CREMA } }
  cap.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
  ws.getRow(3).height = 24

  ws.getRow(4).height = 6 // separació, com als fulls originals
  return 5
}

/**
 * Amplada de les columnes que es fan servir, i prou. Les de la dreta queden
 * en blanc, sense format ni vores escampades.
 *
 * @param {object} ws
 * @param {number[]} amplades  una per columna, d'esquerra a dreta
 */
export function ajustaColumnes(ws, amplades) {
  amplades.forEach((w, i) => { ws.getColumn(i + 1).width = w })
  // ExcelJS pot deixar columnes creades de més si s'hi ha escrit sense voler;
  // les estrenyem perquè no facin nosa visualment.
  for (let c = amplades.length + 1; c <= ws.columnCount; c++) {
    const col = ws.getColumn(c)
    col.width = 3
    col.hidden = true
  }
}

// Les línies de columna (verticals) es marquen més que les de fila: així
// amb moltes columnes seguides l'ull segueix la columna sense perdre's.
// Dins de la capçalera blava han de ser blanques, que una de grisa sobre
// blau marí no es veu.
const VORA_COLUMNA = { style: 'thin', color: { argb: 'FF9AA5B1' } }
const VORA_FILA = { style: 'hair', color: { argb: 'FFD8DCE2' } }
const VORA_COLUMNA_CAP = { style: 'thin', color: { argb: 'FFFFFFFF' } }

export const VORES_TAULA = { top: VORA_FILA, bottom: VORA_FILA, left: VORA_COLUMNA, right: VORA_COLUMNA }
const VORES_CAPCALERA = { top: VORA_COLUMNA_CAP, bottom: VORA_COLUMNA_CAP, left: VORA_COLUMNA_CAP, right: VORA_COLUMNA_CAP }

/**
 * Estil de la fila de capçalera d'una taula: banda blava, text blanc,
 * centrat i **partit en dues línies** quan el títol és llarg.
 *
 * Abans els títols anaven en una sola línia i un text com "Assoliment
 * Satisfactòri" estirava tota la columna encara que a sota només hi
 * hagués números. Amb `wrapText` el títol es parteix i la columna es pot
 * estrènyer — per això va de la mà d'`amplaColumnes()`.
 *
 * @param {object} fila      fila d'ExcelJS
 * @param {number} columnes  fins a quina columna s'aplica
 */
export function estilCapcaleraTaula(fila, columnes, { alcada = 30 } = {}) {
  for (let c = 1; c <= columnes; c++) {
    const cell = fila.getCell(c)
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLAU } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = VORES_CAPCALERA
  }
  fila.height = alcada
  return fila
}

/**
 * Amplada de cada columna a partir del contingut de les DADES, no del
 * títol. Del títol només se'n respecta la paraula més llarga (perquè no
 * es talli a mitges) i la meitat de la seva longitud, comptant que
 * `estilCapcaleraTaula()` el partirà en dues línies.
 *
 * @param {Array} capçalera  la fila de títols
 * @param {Array[]} cosFiles les files de dades (sense la capçalera)
 */
export function amplaColumnes(capçalera, cosFiles, { min = 10, max = 40 } = {}) {
  const columnes = Math.max(capçalera.length, ...cosFiles.map((f) => f.length), 1)
  const amplades = []
  for (let c = 1; c <= columnes; c++) {
    let maxDades = 6
    cosFiles.forEach((fila) => {
      const len = (fila[c - 1] ?? '').toString().length
      if (len > maxDades) maxDades = len
    })
    const titol = (capçalera[c - 1] ?? '').toString()
    const paraulaLlarga = Math.max(0, ...titol.split(/\s+/).map((p) => p.length))
    const meitatTitol = Math.ceil(titol.length / 2)
    const objectiu = Math.max(maxDades, paraulaLlarga, meitatTitol)
    amplades.push(Math.min(Math.max(objectiu + 2, min), max))
  }
  return amplades
}

/** Aplica vores i alternança de files només fins a la columna indicada, per
 *  no tacar les de la dreta. */
export function estilFila(fila, columnes, { fons = null, negreta = false } = {}) {
  for (let c = 1; c <= columnes; c++) {
    const cell = fila.getCell(c)
    cell.border = VORES_TAULA
    cell.alignment = { vertical: 'top', wrapText: true }
    if (negreta) cell.font = { bold: true }
    if (fons) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fons } }
  }
}
