import * as XLSX from 'xlsx'

/**
 * Descarrega un Excel (.xlsx) real, amb un full per cada taula.
 * fulls: [{ nom: 'TEE', files: [[capçalera...], [fila...], ...] }]
 */
export function exportaExcel(nomFitxer, fulls) {
  const wb = XLSX.utils.book_new()
  fulls.forEach(({ nom, files }) => {
    const ws = XLSX.utils.aoa_to_sheet(files)
    // Excel no permet noms de full de més de 31 caràcters ni certs símbols.
    const nomSegur = nom.replace(/[:\\/?*[\]]/g, '').slice(0, 31)
    XLSX.utils.book_append_sheet(wb, ws, nomSegur || 'Full')
  })
  XLSX.writeFile(wb, `${nomFitxer}.xlsx`)
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
          ${files_.map((fila) => `<tr>${fila.map((v) => `<td>${v ?? ''}</td>`).join('')}</tr>`).join('')}
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
          h1 { font-size: 18px; margin-bottom: 4px; }
          .data { font-size: 12px; color: #666; margin-bottom: 20px; }
          h2 { font-size: 14px; margin-top: 28px; margin-bottom: 6px; }
          table { border-collapse: collapse; width: 100%; font-size: 11px; margin-bottom: 8px; }
          th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
          th { background: #f0f0f0; }
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
