import { afegeixCapcalera, ajustaColumnes, NOM_ESCOLA } from './excelCapcalera'

const BLAU_ESCOLA = 'FF1E3A5F' // mateix blau marí de l'app (--navy)
const GRIS_CLAR = 'FFF2F0EA'
const VORA = { style: 'thin', color: { argb: 'FFCCCCCC' } }

/**
 * Descarrega un Excel (.xlsx) real, amb un full per cada taula, i estil:
 * capçalera en blau amb text blanc, vores fines a totes les cel·les,
 * files alternades, i columnes ajustades a l'amplada del contingut.
 *
 * S'hi passa un sol paquet de dades, no una llista solta de fulls:
 *
 *   { cursEscolarId: '2026-27', fulls: [{ nom: 'TEE', files: [[...], ...] }] }
 *
 * El curs escolar viatja amb les dades a posta. Les files ja vénen
 * filtrades pel mòdul i, un cop filtrades, ja no diuen de quin curs són:
 * si el curs no anés dins del paquet, la capçalera se l'hauria d'inventar i
 * un dia posaria el curs equivocat sense que ningú se n'adonés. Amb aquesta
 * forma, exportar sense curs directament no compila.
 */
function comprovaDades(dades, nomFuncio) {
  if (Array.isArray(dades)) {
    throw new Error(
      `${nomFuncio}: ara cal passar-hi { cursEscolarId, fulls }, no la llista de fulls a seques. ` +
      'Si veus aquest error és que ha quedat alguna crida de la manera antiga.'
    )
  }
  if (!dades?.cursEscolarId) {
    throw new Error(`${nomFuncio}: hi falta el curs escolar. Passa-hi { cursEscolarId, fulls }.`)
  }
  return { cursEscolarId: dades.cursEscolarId, fulls: dades.fulls ?? [] }
}

// L'exceljs pesa gairebé un mega. Es carrega només quan de debò cal
// (exportar o llegir un fitxer), no en obrir l'app: així la primera càrrega
// no l'arrossega.
async function carregaExcelJS() {
  return (await import('exceljs')).default
}

export async function exportaExcel(nomFitxer, dades) {
  const ExcelJS = await carregaExcelJS()
  const { cursEscolarId, fulls } = comprovaDades(dades, 'exportaExcel')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Gestió Escola Mestre Enric Gibert i Camins'
  wb.created = new Date()

  fulls.forEach(({ nom, files }) => {
    const nomSegur = nom.replace(/[:\\/?*[\]]/g, '').slice(0, 31) || 'Full'
    const columnes = Math.max(1, ...files.map((f) => f.length))
    const ws = wb.addWorksheet(nomSegur, {
      // la capçalera del centre ocupa 4 files i la de la taula la 5a
      views: [{ state: 'frozen', ySplit: 5 }],
    })
    afegeixCapcalera(ws, { titol: nom, cursEscolarId, columnes })

    files.forEach((filaDades, i) => {
      const fila = ws.addRow(filaDades)
      const esCapçalera = i === 0
      const esTotal = typeof filaDades[0] === 'string' && filaDades[0].toUpperCase().includes('TOTAL')

      for (let c = 1; c <= columnes; c++) {
        const cell = fila.getCell(c)
        cell.border = { top: VORA, left: VORA, bottom: VORA, right: VORA }
        cell.alignment = { vertical: 'middle', wrapText: false }

        if (esCapçalera) {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLAU_ESCOLA } }
        } else if (esTotal) {
          cell.font = { bold: true }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_CLAR } }
        } else if (i % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAF7' } }
        }
      }
    })

    // Amplada de cada columna segons el contingut més llarg de la TAULA —
    // les files de la capçalera no compten, que si no el nom de l'escola
    // eixamplaria la primera columna ella sola.
    const amplades = []
    for (let c = 1; c <= columnes; c++) {
      let maxLen = 8
      files.forEach((filaDades) => {
        const len = (filaDades[c - 1] ?? '').toString().length
        if (len > maxLen) maxLen = len
      })
      amplades.push(Math.min(Math.max(maxLen + 2, 10), 40))
    }
    ajustaColumnes(ws, amplades)
  })

  const buffer = await wb.xlsx.writeBuffer()
  descarregaBlob(buffer, `${nomFitxer}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

function descarregaBlob(buffer, nomFitxer, mimeType) {
  const blob = new Blob([buffer], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomFitxer
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Obre una finestra amb totes les taules formatades i llança el diàleg
 * d'impressió del navegador — triant "Desa com a PDF" com a impressora
 * s'obté un PDF real, sense necessitat de cap llibreria addicional.
 * fulls: [{ nom: 'TEE', files: [[capçalera...], [fila...], ...] }]
 */
export function exportaPDF(titol, dades) {
  const { cursEscolarId, fulls } = comprovaDades(dades, 'exportaPDF')
  const finestra = window.open('', '_blank')
  if (!finestra) {
    alert('El navegador ha bloquejat la finestra per generar el PDF. Permet finestres emergents per a aquesta pàgina i torna-ho a provar.')
    return
  }

  const taulesHtml = fulls.map(({ nom, files }) => {
    const [capçalera, ...files_] = files
    return `
      <h2>${nom}</h2>
      <table>
        <thead><tr>${capçalera.map((c) => `<th>${c ?? ''}</th>`).join('')}</tr></thead>
        <tbody>
          ${files_.map((fila) => {
            const esTotal = typeof fila[0] === 'string' && fila[0].toUpperCase().includes('TOTAL')
            return `<tr${esTotal ? ' class="total"' : ''}>${fila.map((v) => `<td>${v ?? ''}</td>`).join('')}</tr>`
          }).join('')}
        </tbody>
      </table>
    `
  }).join('')

  finestra.document.write(`
    <html>
      <head>
        <title>${titol}</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #1a1a1a; }
          .banda { background: #1E3A5F; color: #fff; font-weight: 700; font-size: 15px; text-align: center; padding: 8px; }
          .curs { font-size: 11px; color: #666; text-align: right; margin: 4px 0 12px; }
          h1 { font-size: 18px; margin-bottom: 4px; color: #1E3A5F; }
          .data { font-size: 12px; color: #666; margin-bottom: 20px; }
          h2 { font-size: 14px; margin-top: 28px; margin-bottom: 6px; color: #1E3A5F; border-bottom: 2px solid #1E3A5F; padding-bottom: 4px; }
          table { border-collapse: collapse; width: 100%; font-size: 11px; margin-bottom: 8px; }
          th, td { border: 1px solid #ccc; padding: 5px 9px; text-align: left; }
          th { background: #1E3A5F; color: #fff; font-weight: 600; }
          tbody tr:nth-child(even) { background: #FAFAF7; }
          tr.total td { background: #F2F0EA; font-weight: 700; }
          @media print {
            h2 { break-inside: avoid; }
            table { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="banda">${NOM_ESCOLA}</div>
        <p class="curs">PGAC · Curs ${cursEscolarId}</p>
        <h1>${titol}</h1>
        <p class="data">Generat el ${new Date().toLocaleDateString('ca-ES')}</p>
        ${taulesHtml}
      </body>
    </html>
  `)
  finestra.document.close()
  // Petita espera perquè el navegador acabi de renderitzar abans d'imprimir.
  setTimeout(() => finestra.print(), 350)
}
