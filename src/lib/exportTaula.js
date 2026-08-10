import ExcelJS from 'exceljs'

const BLAU_ESCOLA = 'FF1E3A5F' // mateix blau marí de l'app (--navy)
const GRIS_CLAR = 'FFF2F0EA'
const VORA = { style: 'thin', color: { argb: 'FFCCCCCC' } }

/**
 * Descarrega un Excel (.xlsx) real, amb un full per cada taula, i estil:
 * capçalera en blau amb text blanc, vores fines a totes les cel·les,
 * files alternades, i columnes ajustades a l'amplada del contingut.
 * fulls: [{ nom: 'TEE', files: [[capçalera...], [fila...], ...] }]
 */
export async function exportaExcel(nomFitxer, fulls) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Gestió Escola Mestre Enric Gibert i Camins'
  wb.created = new Date()

  fulls.forEach(({ nom, files }) => {
    const nomSegur = nom.replace(/[:\\/?*[\]]/g, '').slice(0, 31) || 'Full'
    const ws = wb.addWorksheet(nomSegur, {
      views: [{ state: 'frozen', ySplit: 1 }], // capçalera sempre visible en fer scroll
    })

    files.forEach((filaDades, i) => {
      const fila = ws.addRow(filaDades)
      const esCapçalera = i === 0
      const esTotal = typeof filaDades[0] === 'string' && filaDades[0].toUpperCase().includes('TOTAL')

      fila.eachCell({ includeEmpty: true }, (cell) => {
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
      })
    })

    // Ajusta l'amplada de cada columna al contingut més llarg (amb un
    // marge mínim i màxim perquè no quedi ni massa estret ni desbocat).
    ws.columns.forEach((col) => {
      let maxLen = 8
      col.eachCell({ includeEmpty: true }, (cell) => {
        const len = (cell.value ?? '').toString().length
        if (len > maxLen) maxLen = len
      })
      col.width = Math.min(Math.max(maxLen + 2, 10), 40)
    })
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
export function exportaPDF(titol, fulls) {
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
        <h1>${titol}</h1>
        <p class="data">Escola Mestre Enric Gibert i Camins — generat el ${new Date().toLocaleDateString('ca-ES')}</p>
        ${taulesHtml}
      </body>
    </html>
  `)
  finestra.document.close()
  // Petita espera perquè el navegador acabi de renderitzar abans d'imprimir.
  setTimeout(() => finestra.print(), 350)
}
