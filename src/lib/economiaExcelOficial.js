import { ENSENYAMENTS, CONCEPTES, conceptaBuit } from './economia'

const BLAU = 'FF1E3A5F'
const GRIS = 'FFF2F0EA'
const VORA = { style: 'thin', color: { argb: 'FFCCCCCC' } }
const TOTES_VORES = { top: VORA, left: VORA, bottom: VORA, right: VORA }

function colLletra(n) {
  let num = n + 1
  let lletres = ''
  while (num > 0) {
    const resta = (num - 1) % 26
    lletres = String.fromCharCode(65 + resta) + lletres
    num = Math.floor((num - 1) / 26)
  }
  return lletres
}

function estilCapçalera(cell) {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLAU } }
  cell.border = TOTES_VORES
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
}

// L'exceljs pesa gairebé un mega. Es carrega només quan de debò cal
// (exportar o llegir un fitxer), no en obrir l'app: així la primera càrrega
// no l'arrossega.
async function carregaExcelJS() {
  return (await import('exceljs')).default
}

/**
 * Genera l'Excel amb la mateixa estructura, capçaleres i fórmules que la
 * plantilla oficial del CEB/Departament d'Educació ("Seguiment
 * d'Aportacions de Famílies"), a partir de les dades introduïdes al mòdul.
 *
 * Full "Curs XXXX-XXXX": rèplica cel·la per cel·la de l'original (mateixes
 * 49 columnes, mateixes fórmules per fila i el mateix TOTAL amb SUBTOTAL).
 *
 * Full "Total Centre": AQUÍ HI HA UNA DIFERÈNCIA HONESTA respecte
 * l'original — la plantilla oficial compara DOS cursos escolars alhora
 * (per exemple 2024-2025 i 2025-2026 juntes) i creua les dades amb una
 * columna "Comptabilitzat (Extret d'Esfer@)" que ve del sistema comptable
 * del Departament, al qual aquesta app no té accés. Aquí es genera un
 * "Total Centre" d'UN sol curs escolar (el que s'exporta), amb els
 * mateixos totals per concepte que la plantilla oficial calcularia, però
 * sense la comparativa entre dos cursos ni la columna d'Esfer@ (caldria
 * omplir-la a mà igualment, tal com ja es fa amb la plantilla original).
 */
export async function exportaExcelOficial({ nomCentre, codiCentre, cursEscolarId, files }) {
  const ExcelJS = await carregaExcelJS()
  const [anyIniciStr, anyFiStr] = cursEscolarId.split('-')
  const anyInici = anyIniciStr
  const anyFi = anyFiStr.length === 2 ? `20${anyFiStr}` : anyFiStr

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Gestió Escola Mestre Enric Gibert i Camins'
  wb.created = new Date()

  // ---------------------------------------------------------------
  // Full "Presentació"
  // ---------------------------------------------------------------
  const wsP = wb.addWorksheet('Presentació')
  wsP.getColumn(1).width = 110
  wsP.getCell('A2').value = 'SEGUIMENT DE LES APORTACIONS DE LES FAMÍLIES'
  wsP.getCell('A2').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  wsP.getCell('A2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLAU } }
  wsP.getCell('A4').value = 'Nom del Centre'
  wsP.getCell('C4').value = nomCentre || ''
  wsP.getCell('A6').value = 'Codi del Centre'
  wsP.getCell('C6').value = codiCentre || ''
  ;['A4', 'A6'].forEach((ref) => { wsP.getCell(ref).font = { bold: true } })
  wsP.getCell('A8').value = `Curs escolar exportat: ${cursEscolarId}. Generat automàticament des de Gestió Interna — Economia.`
  wsP.getCell('A8').font = { italic: true, color: { argb: 'FF666666' } }

  // ---------------------------------------------------------------
  // Full "Curs XXXX-XXXX" — rèplica exacta de la plantilla oficial
  // ---------------------------------------------------------------
  const nomFullDades = `Curs ${cursEscolarId}`.slice(0, 31)
  const ws = wb.addWorksheet(nomFullDades, { views: [{ state: 'frozen', ySplit: 5, xSplit: 4 }] })

  ws.getCell('A1').value = `Aportacions famílies curs ${cursEscolarId}`
  ws.getCell('A1').font = { bold: true, size: 13 }
  ws.mergeCells('A1:D1')

  // Fila 3: nom de cada concepte, fusionat sobre les seves 5 columnes.
  CONCEPTES.forEach((c, ci) => {
    const colBase = 4 + ci * 5 // 0-indexat: E=4
    const cell = ws.getCell(3, colBase + 1)
    cell.value = c.label
    estilCapçalera(cell)
    ws.mergeCells(3, colBase + 1, 3, colBase + 5)
  })
  const colTotalReduccio = 4 + CONCEPTES.length * 5 // AS
  const colTotalEsperat = colTotalReduccio + 1 // AT
  const colCobratAny1 = colTotalReduccio + 2 // AU
  const colCobratAny2 = colTotalReduccio + 3 // AV
  const colTotalCobrat = colTotalReduccio + 4 // AW
  {
    const cell = ws.getCell(3, colTotalReduccio + 1)
    cell.value = `TOTAL CURS ${cursEscolarId}`
    estilCapçalera(cell)
    ws.mergeCells(3, colTotalReduccio + 1, 3, colTotalCobrat + 1)
  }

  // Fila 4: "MÀXIM ESPERAT" (Import+Reducció+Total) / "COBRAT" (any1+any2), per concepte.
  CONCEPTES.forEach((c, ci) => {
    const colBase = 4 + ci * 5
    const c1 = ws.getCell(4, colBase + 1)
    c1.value = 'MÀXIM ESPERAT'
    estilCapçalera(c1)
    ws.mergeCells(4, colBase + 1, 4, colBase + 3)
    const c2 = ws.getCell(4, colBase + 4)
    c2.value = 'COBRAT'
    estilCapçalera(c2)
    ws.mergeCells(4, colBase + 4, 4, colBase + 5)
  })
  {
    const c1 = ws.getCell(4, colTotalReduccio + 1)
    c1.value = 'REDUCCIÓ APORTACIONS'
    estilCapçalera(c1)
    const c2 = ws.getCell(4, colTotalEsperat + 1)
    c2.value = 'MÀXIM ESPERAT'
    estilCapçalera(c2)
    const c3 = ws.getCell(4, colCobratAny1 + 1)
    c3.value = 'COBRAT'
    estilCapçalera(c3)
    ws.mergeCells(4, colCobratAny1 + 1, 4, colTotalCobrat + 1)
  }

  // Fila 5: capçaleres de columna reals.
  const capçalera5 = ['Ensenyament', 'Detall cicle formatiu/altres', 'Curs', 'Núm. Alumnes/as']
  CONCEPTES.forEach(() => {
    capçalera5.push('Import unitari', 'Reducció total', 'Total', anyInici, anyFi)
  })
  capçalera5.push('TOTAL', 'TOTAL', anyInici, anyFi, 'TOTAL')
  capçalera5.forEach((valor, i) => {
    const cell = ws.getCell(5, i + 1)
    cell.value = valor
    estilCapçalera(cell)
  })

  // Files 6-45: 40 files de dades (una per Ensenyament × Curs, com l'original).
  const PRIMERA_FILA_DADES = 6
  const ULTIMA_FILA_DADES = 45
  for (let i = 0; i < ULTIMA_FILA_DADES - PRIMERA_FILA_DADES + 1; i++) {
    const filaExcel = PRIMERA_FILA_DADES + i
    const f = files[i]
    const valors = f ? [f.ensenyament, f.detall, f.curs, Number(f.numAlumnes) || 0] : ['', '', '', '']
    CONCEPTES.forEach((c) => {
      const concepte = f?.conceptes?.[c.id] ?? conceptaBuit()
      valors.push(
        Number(concepte.importUnitari) || 0,
        Number(concepte.reduccio) || 0,
        null, // Total: fórmula
        Number(concepte.cobratAny1) || 0,
        Number(concepte.cobratAny2) || 0
      )
    })
    valors.push(null, null, null, null, null) // AS-AW: totes fórmules
    const fila = ws.addRow(valors)

    // Fórmules per concepte: Total = alumnes × import unitari − reducció.
    const colsReduccio = []
    const colsTotal = []
    const colsAny1 = []
    const colsAny2 = []
    CONCEPTES.forEach((c, ci) => {
      const colBase = 4 + ci * 5 // 0-indexat
      const colImport = colLletra(colBase)
      const colReduccio = colLletra(colBase + 1)
      const colTotalC = colLletra(colBase + 2)
      const colAny1 = colLletra(colBase + 3)
      const colAny2 = colLletra(colBase + 4)
      fila.getCell(colBase + 3).value = { formula: `D${filaExcel}*${colImport}${filaExcel}-${colReduccio}${filaExcel}` }
      colsReduccio.push(`${colReduccio}${filaExcel}`)
      colsTotal.push(`${colTotalC}${filaExcel}`)
      colsAny1.push(`${colAny1}${filaExcel}`)
      colsAny2.push(`${colAny2}${filaExcel}`)
    })
    fila.getCell(colTotalReduccio + 1).value = { formula: colsReduccio.join('+') }
    fila.getCell(colTotalEsperat + 1).value = { formula: colsTotal.join('+') }
    fila.getCell(colCobratAny1 + 1).value = { formula: colsAny1.join('+') }
    fila.getCell(colCobratAny2 + 1).value = { formula: colsAny2.join('+') }
    fila.getCell(colTotalCobrat + 1).value = { formula: `${colLletra(colCobratAny1)}${filaExcel}+${colLletra(colCobratAny2)}${filaExcel}` }

    fila.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = TOTES_VORES
      if (i % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAF7' } }
    })
  }

  // Fila 46: TOTAL amb SUBTOTAL (com l'original — no compta files ocultes/filtrades).
  const filaTotal = ws.addRow(['', '', '', 'TOTAL'])
  for (let col = 5; col <= colTotalCobrat + 1; col++) {
    // A l'original no se subtotalitzen les columnes "Import unitari" (la 1a de cada bloc de 5).
    const esImportUnitari = CONCEPTES.some((c, ci) => col === 4 + ci * 5 + 1)
    if (esImportUnitari) continue
    const lletra = colLletra(col - 1)
    filaTotal.getCell(col).value = { formula: `SUBTOTAL(109,${lletra}${PRIMERA_FILA_DADES}:${lletra}${ULTIMA_FILA_DADES})` }
  }
  filaTotal.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
    cell.border = TOTES_VORES
  })

  ws.getColumn(1).width = 14
  ws.getColumn(2).width = 22
  ws.getColumn(3).width = 8
  ws.getColumn(4).width = 12
  for (let i = 5; i <= colTotalCobrat + 1; i++) ws.getColumn(i).width = 12

  // Validació (desplegable) a Ensenyament i Curs, com a l'original.
  for (let r = PRIMERA_FILA_DADES; r <= ULTIMA_FILA_DADES; r++) {
    ws.getCell(`A${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['Llistes!$A$4:$A$11'] }
    ws.getCell(`C${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['Llistes!$C$4:$C$9'] }
  }

  // ---------------------------------------------------------------
  // Full "Llistes" — origen dels desplegables
  // ---------------------------------------------------------------
  const wsL = wb.addWorksheet('Llistes')
  ENSENYAMENTS.forEach((e, i) => { wsL.getCell(`A${4 + i}`).value = e })
  ;['1r', '2n', '3r', '4t', '5è', '6è'].forEach((c, i) => { wsL.getCell(`C${4 + i}`).value = c })
  wsL.getColumn(1).width = 14
  wsL.getColumn(3).width = 8

  // ---------------------------------------------------------------
  // Full "Total Centre" — d'UN curs (vegeu nota al capdamunt del fitxer)
  // ---------------------------------------------------------------
  const wsT = wb.addWorksheet('Total Centre')
  wsT.getCell('A1').value = `Total Centre — ${cursEscolarId}`
  wsT.getCell('A1').font = { bold: true, size: 13 }
  wsT.mergeCells('A1:D1')
  wsT.getCell('A2').value = 'Nota: la plantilla oficial compara dos cursos escolars i el comptabilitzat a Esfer@; ' +
    'aquest full mostra només el curs exportat, calculat amb fórmules reals a partir del full de dades.'
  wsT.getCell('A2').font = { italic: true, color: { argb: 'FF666666' } }
  wsT.mergeCells('A2:H2')
  wsT.getRow(2).height = 30
  wsT.getCell('A2').alignment = { wrapText: true, vertical: 'middle' }

  const capT = ['Concepte', 'Màxim esperat', 'Reducció', `Cobrat ${anyInici}`, `Cobrat ${anyFi}`, 'Cobrat TOTAL']
  capT.forEach((v, i) => {
    const cell = wsT.getCell(4, i + 1)
    cell.value = v
    estilCapçalera(cell)
  })
  // Columnes del full de dades que corresponen a cada concepte, per a les fórmules.
  const colsPerConcepte = CONCEPTES.map((c, ci) => {
    const colBase = 4 + ci * 5
    return {
      label: c.label,
      esperat: colLletra(colBase + 2),
      reduccio: colLletra(colBase + 1),
      any1: colLletra(colBase + 3),
      any2: colLletra(colBase + 4),
    }
  })
  colsPerConcepte.forEach((c, i) => {
    const filaExcel = 5 + i
    const fila = wsT.addRow([c.label])
    fila.getCell(2).value = { formula: `'${nomFullDades}'!${c.esperat}46` }
    fila.getCell(3).value = { formula: `'${nomFullDades}'!${c.reduccio}46` }
    fila.getCell(4).value = { formula: `'${nomFullDades}'!${c.any1}46` }
    fila.getCell(5).value = { formula: `'${nomFullDades}'!${c.any2}46` }
    fila.getCell(6).value = { formula: `D${filaExcel}+E${filaExcel}` }
    fila.eachCell({ includeEmpty: true }, (cell) => { cell.border = TOTES_VORES })
  })
  const filaTotalT = wsT.addRow(['TOTAL'])
  const primeraT = 5
  const ultimaT = 4 + CONCEPTES.length
  ;[2, 3, 4, 5, 6].forEach((col) => {
    const lletra = colLletra(col - 1)
    filaTotalT.getCell(col).value = { formula: `SUM(${lletra}${primeraT}:${lletra}${ultimaT})` }
  })
  filaTotalT.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
    cell.border = TOTES_VORES
  })
  wsT.getColumn(1).width = 34
  for (let i = 2; i <= 6; i++) wsT.getColumn(i).width = 14

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Aportacions-families-${cursEscolarId}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
