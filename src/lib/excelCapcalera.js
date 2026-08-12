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

/** Aplica vores i alternança de files només fins a la columna indicada, per
 *  no tacar les de la dreta. */
export function estilFila(fila, columnes, { fons = null, negreta = false } = {}) {
  const VORA = { style: 'thin', color: { argb: 'FFCCCCCC' } }
  for (let c = 1; c <= columnes; c++) {
    const cell = fila.getCell(c)
    cell.border = { top: VORA, left: VORA, bottom: VORA, right: VORA }
    cell.alignment = { vertical: 'top', wrapText: true }
    if (negreta) cell.font = { bold: true }
    if (fons) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fons } }
  }
}
