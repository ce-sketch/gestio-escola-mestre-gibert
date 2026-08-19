import { carregaExcelJS } from './carregaLlibreries'
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
  // `etiqueta` és el text que surt a la dreta de la capçalera. Per defecte
  // deia sempre "PGAC", també als Excel d'avaluació — que no tenen res a
  // veure amb el PGAC. Ara cada mòdul hi pot posar el seu.
  return { cursEscolarId: dades.cursEscolarId, fulls: dades.fulls ?? [], etiqueta: dades.etiqueta }
}


export async function exportaExcel(nomFitxer, dades) {
  const ExcelJS = await carregaExcelJS()
  const { cursEscolarId, fulls, etiqueta } = comprovaDades(dades, 'exportaExcel')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Gestió Escola Mestre Enric Gibert i Camins'
  wb.created = new Date()

  fulls.forEach(({ nom, files, grups }) => {
    const nomSegur = nom.replace(/[:\\/?*[\]]/g, '').slice(0, 31) || 'Full'
    const columnes = Math.max(1, ...files.map((f) => f.length))
    const teGrups = Boolean(grups?.length)
    const ws = wb.addWorksheet(nomSegur, {
      // La capçalera del centre ocupa 4 files. Quan hi ha grups de
      // columnes (una fila extra amb el nom de cada àrea), la capçalera de
      // la taula pròpiament dita passa a la 6a fila, no la 5a.
      views: [{ state: 'frozen', ySplit: teGrups ? 6 : 5 }],
    })
    afegeixCapcalera(ws, { titol: nom, cursEscolarId, columnes, ...(etiqueta ? { etiqueta } : {}) })

    const [capçalera, ...cosFiles] = files

    // --- Fila de grups: el nom de cada àrea a sobre de les seves columnes,
    // fusionades, perquè es distingeixin d'una ullada quan n'hi ha moltes
    // seguides (p. ex. "Català" a sobre de 1r/2n/3r/Final). ---
    if (teGrups) {
      const nIndex = capçalera.length - grups.reduce((a, g) => a + g.span, 0)
      const filaGrups = ws.addRow([
        ...Array(nIndex).fill(''),
        ...grups.flatMap((g) => [g.label, ...Array(g.span - 1).fill('')]),
      ])
      for (let c = 1; c <= columnes; c++) {
        const cell = filaGrups.getCell(c)
        cell.border = { top: VORA, left: VORA, bottom: VORA, right: VORA }
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLAU_ESCOLA } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      }
      const rGrups = filaGrups.number
      const rCap = rGrups + 1
      for (let c = 1; c <= nIndex; c++) ws.mergeCells(rGrups, c, rCap, c)
      let colActual = nIndex + 1
      for (const g of grups) {
        if (g.span > 1) ws.mergeCells(rGrups, colActual, rGrups, colActual + g.span - 1)
        colActual += g.span
      }
    }

    // --- Fila de capçalera pròpiament dita ---
    const filaCap = ws.addRow(capçalera)
    for (let c = 1; c <= columnes; c++) {
      const cell = filaCap.getCell(c)
      cell.border = { top: VORA, left: VORA, bottom: VORA, right: VORA }
      cell.alignment = { vertical: 'middle', wrapText: false }
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLAU_ESCOLA } }
    }

    // --- Files de dades ---
    cosFiles.forEach((filaDades, i) => {
      const fila = ws.addRow(filaDades)
      const esTotal = typeof filaDades[0] === 'string' && filaDades[0].toUpperCase().includes('TOTAL')

      for (let c = 1; c <= columnes; c++) {
        const cell = fila.getCell(c)
        cell.border = { top: VORA, left: VORA, bottom: VORA, right: VORA }
        cell.alignment = { vertical: 'middle', wrapText: false }

        if (esTotal) {
          cell.font = { bold: true }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_CLAR } }
        } else if (i % 2 === 1) {
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

    // En horitzontal i ajustat a l'amplada del paper: les taules amb
    // moltes àrees tenen moltes columnes, i en vertical (o sense ajustar)
    // queden tallades en imprimir-les.
    ws.pageSetup = {
      orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    }
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
  const { cursEscolarId, fulls, etiqueta } = comprovaDades(dades, 'exportaPDF')
  const finestra = window.open('', '_blank')
  if (!finestra) {
    alert('El navegador ha bloquejat la finestra per generar el PDF. Permet finestres emergents per a aquesta pàgina i torna-ho a provar.')
    return
  }

  // Quantes columnes de dades hi caben en un A4 apaïsat sense que la
  // lletra deixi de ser llegible. Amb 20 (5 àrees de 4 columnes) la lletra
  // es pot quedar a 9-10px, que encara es llegeix bé imprès. Més enllà
  // d'això, encongir la lletra ja no és la solució — cal partir la taula.
  const MAX_COLUMNES_DADES_PER_PAGINA = 20

  function midaLletraPer(nColumnes) {
    return nColumnes > 32 ? 7 : nColumnes > 22 ? 8 : nColumnes > 14 ? 9 : 11
  }

  /** Construeix el <table> d'un tros concret de columnes (o de totes, si
   *  no calia partir res). `capçalera`/`files_` ja vénen retallades a
   *  només les columnes d'aquest tros. */
  function taulaHtml(capçalera, files_, grupsTros, nIndex, midaLletra) {
    let columnaDeGrup = null
    let capçaleraHtml
    if (grupsTros?.length) {
      columnaDeGrup = Array(nIndex).fill(null)
      grupsTros.forEach((g, gi) => { for (let i = 0; i < g.span; i++) columnaDeGrup.push(gi) })
      const filaGrups = capçalera.slice(0, nIndex).map((c) => `<th rowspan="2">${c ?? ''}</th>`).join('')
        + grupsTros.map((g, gi) => `<th colspan="${g.span}" class="capgrup g${gi % 2}">${g.label}</th>`).join('')
      const filaSub = capçalera.slice(nIndex).map((c, i) => `<th class="g${columnaDeGrup[nIndex + i] % 2}">${c ?? ''}</th>`).join('')
      capçaleraHtml = `<tr>${filaGrups}</tr><tr>${filaSub}</tr>`
    } else {
      capçaleraHtml = `<tr>${capçalera.map((c) => `<th>${c ?? ''}</th>`).join('')}</tr>`
    }

    const cosHtml = files_.map((fila) => {
      const esTotal = typeof fila[0] === 'string' && fila[0].toUpperCase().includes('TOTAL')
      const cel·les = fila.map((v, ci) => {
        const classe = columnaDeGrup && columnaDeGrup[ci] !== null ? ` class="g${columnaDeGrup[ci] % 2}"` : ''
        return `<td${classe}>${v ?? ''}</td>`
      }).join('')
      return `<tr${esTotal ? ' class="total"' : ''}>${cel·les}</tr>`
    }).join('')

    return `
      <table style="font-size:${midaLletra}px">
        <thead>${capçaleraHtml}</thead>
        <tbody>${cosHtml}</tbody>
      </table>
    `
  }

  const taulesHtml = fulls.map(({ nom, files, grups }) => {
    const [capçalera, ...files_] = files
    const totalColumnes = capçalera.length

    // Sense grups (taules normals, poques columnes): tal com sempre.
    if (!grups?.length) {
      return `<h2>${nom}</h2>${taulaHtml(capçalera, files_, null, 0, midaLletraPer(totalColumnes))}`
    }

    const nIndex = totalColumnes - grups.reduce((a, g) => a + g.span, 0)
    const totalDades = totalColumnes - nIndex

    // Cap en una sola pàgina: com fins ara, una taula, una àrea al costat
    // de l'altra.
    if (totalDades <= MAX_COLUMNES_DADES_PER_PAGINA) {
      return `<h2>${nom}</h2>${taulaHtml(capçalera, files_, grups, nIndex, midaLletraPer(totalColumnes))}`
    }

    // No hi cap: es parteix en trossos de columnes, cada tros amb Núm. i
    // Alumne repetits al davant perquè cada full es pugui llegir sol, i
    // cada tros comença una pàgina nova.
    const trossos = []
    let trosActual = []
    let colsTrosActual = 0
    for (const g of grups) {
      if (colsTrosActual + g.span > MAX_COLUMNES_DADES_PER_PAGINA && trosActual.length > 0) {
        trossos.push(trosActual)
        trosActual = []
        colsTrosActual = 0
      }
      trosActual.push(g)
      colsTrosActual += g.span
    }
    if (trosActual.length > 0) trossos.push(trosActual)

    return trossos.map((trosGrups, ti) => {
      let inici = nIndex
      for (const g of grups) {
        if (trosGrups.includes(g)) break
        inici += g.span
      }
      const colsTros = trosGrups.reduce((a, g) => a + g.span, 0)
      const capçaleraTros = [...capçalera.slice(0, nIndex), ...capçalera.slice(inici, inici + colsTros)]
      const filesTros = files_.map((fila) => [...fila.slice(0, nIndex), ...fila.slice(inici, inici + colsTros)])
      const midaLletra = midaLletraPer(nIndex + colsTros)
      const titolTros = ti === 0 ? nom : `${nom} — continuació (${trosGrups.map((g) => g.label).join(', ')})`
      return `<h2${ti > 0 ? ' class="continua"' : ''}>${titolTros}</h2>${taulaHtml(capçaleraTros, filesTros, trosGrups, nIndex, midaLletra)}`
    }).join('')
  }).join('')

  finestra.document.write(`
    <html>
      <head>
        <title>${titol}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4 landscape; margin: 12mm 10mm; }
          body { font-family: Arial, sans-serif; padding: 0 6mm; color: #1a1a1a; }
          .banda { background: #1E3A5F; color: #fff; font-weight: 700; font-size: 15px; text-align: center; padding: 8px; }
          .curs { font-size: 11px; color: #666; text-align: right; margin: 4px 0 12px; }
          h1 { font-size: 18px; margin-bottom: 4px; color: #1E3A5F; }
          .data { font-size: 12px; color: #666; margin-bottom: 20px; }
          h2 { font-size: 14px; margin-top: 28px; margin-bottom: 6px; color: #1E3A5F; border-bottom: 2px solid #1E3A5F; padding-bottom: 4px; break-after: avoid; }
          h2.continua { break-before: page; font-size: 12px; color: #555; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 8px; table-layout: fixed; }
          th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; overflow-wrap: break-word; }
          th { background: #1E3A5F; color: #fff; font-weight: 600; }
          th.capgrup { text-align: center; }
          th.g0, td.g0 { background: #E7ECF3; }
          th.g1, td.g1 { background: #F6F7F9; }
          th.capgrup.g0, th.capgrup.g1 { background: #1E3A5F; color: #fff; }
          tbody tr:nth-child(odd) td:not(.g0):not(.g1) { background: #FAFAF7; }
          tr.total td { background: #F2F0EA !important; font-weight: 700; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; }
          @media print {
            h2 { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="banda">${NOM_ESCOLA}</div>
        <p class="curs">${etiqueta ?? 'PGAC'} · Curs ${cursEscolarId}</p>
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
